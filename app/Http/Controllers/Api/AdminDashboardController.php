<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Order;
use App\Models\Payment;
use Carbon\CarbonPeriod;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AdminDashboardController extends Controller
{
    public function __invoke(Request $request)
    {
        $validated = $request->validate([
            'days' => ['sometimes', 'integer', Rule::in([7, 30])],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ]);

        $user = $request->user();
        $requestedBranchId = $validated['branch_id'] ?? null;

        if ($user->branch_id) {
            if (
                $requestedBranchId &&
                (int) $requestedBranchId !== (int) $user->branch_id
            ) {
                abort(403);
            }

            $branchId = $user->branch_id;
        } else {
            if ($requestedBranchId && ! $user->can('branches.view')) {
                abort(403);
            }

            $branchId = $requestedBranchId;
        }

        $days = (int) ($validated['days'] ?? 7);
        $end = now()->endOfDay();
        $start = $end->copy()->startOfDay()->subDays($days - 1);
        $previousEnd = $start->copy()->subSecond();
        $previousStart = $previousEnd->copy()->subDays($days)->addSecond();

        $orders = fn () => Order::query()
            ->when($branchId, fn ($query) => $query->where('branch_id', $branchId));
        $activeOrders = fn () => $orders()->where('status', '!=', 'cancelled');

        $periodOrders = fn ($from, $to) => $activeOrders()
            ->whereBetween('orders.created_at', [$from, $to]);

        $periodPayments = fn ($from, $to) => Payment::query()
            ->whereBetween('paid_at', [$from, $to])
            ->whereHas('order', function ($query) use ($branchId) {
                $query->where('status', '!=', 'cancelled')
                    ->when($branchId, fn ($orderQuery) => $orderQuery->where('branch_id', $branchId));
            });

        $currentOrderCount = $periodOrders($start, $end)->count();
        $previousOrderCount = $periodOrders($previousStart, $previousEnd)->count();
        $currentOrderValue = (float) $periodOrders($start, $end)->sum('total');
        $previousOrderValue = (float) $periodOrders($previousStart, $previousEnd)->sum('total');
        $currentPayments = (float) $periodPayments($start, $end)->sum('amount');
        $previousPayments = (float) $periodPayments($previousStart, $previousEnd)->sum('amount');

        $dailyOrders = $periodOrders($start, $end)
            ->selectRaw('DATE(created_at) as date, COUNT(*) as order_count, SUM(total) as order_value')
            ->groupBy(DB::raw('DATE(created_at)'))
            ->get()
            ->keyBy('date');

        $salesChart = collect(CarbonPeriod::create($start->toDateString(), $end->toDateString()))
            ->map(function ($date) use ($dailyOrders) {
                $row = $dailyOrders->get($date->toDateString());

                return [
                    'date' => $date->toDateString(),
                    'order_count' => (int) ($row?->order_count ?? 0),
                    'order_value' => (float) ($row?->order_value ?? 0),
                ];
            })
            ->values();

        $statusCounts = $orders()
            ->whereBetween('created_at', [$start, $end])
            ->select('status', DB::raw('COUNT(*) as total'))
            ->groupBy('status')
            ->get()
            ->mapWithKeys(fn ($row) => [$row->status => (int) $row->total]);

        $branchOptions = $user->branch_id
            ? Branch::query()->whereKey($user->branch_id)->get(['id', 'name'])
            : ($user->can('branches.view')
                ? Branch::query()->where('is_active', true)->orderBy('name')->get(['id', 'name'])
                : collect());

        $branchPerformance = $user->can('branches.view') || $user->branch_id
            ? $periodOrders($start, $end)
                ->leftJoin('branches', 'orders.branch_id', '=', 'branches.id')
                ->selectRaw("orders.branch_id, COALESCE(branches.name, 'Tanpa cabang') as branch_name")
                ->selectRaw('COUNT(orders.id) as order_count, COALESCE(SUM(orders.total), 0) as order_value')
                ->groupBy('orders.branch_id', 'branches.name')
                ->orderByDesc('order_value')
                ->limit(5)
                ->get()
            : collect();

        $recentOrders = $activeOrders()
            ->with([
                'customer:id,name',
                'branch:id,name',
                'items:id,order_id,product_name',
            ])
            ->latest()
            ->limit(8)
            ->get([
                'id',
                'order_number',
                'branch_id',
                'customer_id',
                'total',
                'balance',
                'status',
                'payment_status',
                'due_date',
                'created_at',
            ]);

        $branch = $branchId ? Branch::find($branchId) : null;

        return response()->json([
            'data' => [
                'filters' => [
                    'days' => $days,
                    'branch_id' => $branchId,
                    'branch_name' => $branch?->name ?? 'Semua cabang',
                ],
                'branches' => $branchOptions,
                'summary' => [
                    'total_orders' => $currentOrderCount,
                    'order_value' => $currentOrderValue,
                    'payments_received' => $currentPayments,
                    'outstanding_balance' => (float) $activeOrders()
                        ->whereIn('payment_status', ['unpaid', 'partial'])
                        ->sum('balance'),
                    'production_queue' => $activeOrders()
                        ->whereIn('status', ['pending', 'processing'])
                        ->count(),
                    'overdue_orders' => $activeOrders()
                        ->whereNotNull('due_date')
                        ->whereDate('due_date', '<', today())
                        ->whereNotIn('status', ['completed', 'cancelled'])
                        ->count(),
                ],
                'comparison' => [
                    'total_orders_percent' => $this->percentageChange(
                        $currentOrderCount,
                        $previousOrderCount,
                    ),
                    'order_value_percent' => $this->percentageChange(
                        $currentOrderValue,
                        $previousOrderValue,
                    ),
                    'payments_received_percent' => $this->percentageChange(
                        $currentPayments,
                        $previousPayments,
                    ),
                ],
                'sales_chart' => $salesChart,
                'status_counts' => [
                    'pending' => $statusCounts->get('pending', 0),
                    'processing' => $statusCounts->get('processing', 0),
                    'completed' => $statusCounts->get('completed', 0),
                    'cancelled' => $statusCounts->get('cancelled', 0),
                ],
                'branch_performance' => $branchPerformance,
                'recent_orders' => $recentOrders,
            ],
        ]);
    }

    private function percentageChange(float|int $current, float|int $previous): ?float
    {
        if ((float) $previous === 0.0) {
            return (float) $current === 0.0 ? 0.0 : null;
        }

        return round((($current - $previous) / $previous) * 100, 1);
    }
}
