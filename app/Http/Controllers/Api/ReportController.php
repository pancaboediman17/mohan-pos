<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Material;
use App\Models\MaterialStockMovement;
use App\Models\Order;
use App\Models\Payment;
use App\Models\WorkOrder;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ReportController extends Controller
{
    public function index(Request $request)
    {
        $filters = $this->filters($request);
        [$from, $to, $branchId] = [$filters['from'], $filters['to'], $filters['branch_id']];

        $orders = Order::query()
            ->where('orders.quote_status', 'approved')
            ->where('orders.status', '!=', 'cancelled')
            ->when($branchId, fn (Builder $query) => $query->where('orders.branch_id', $branchId));
        $periodOrders = fn () => (clone $orders)->whereBetween('orders.created_at', [$from, $to]);
        $payments = Payment::query()
            ->whereBetween('paid_at', [$from, $to])
            ->whereHas('order', fn (Builder $query) => $query
                ->where('quote_status', 'approved')
                ->where('status', '!=', 'cancelled')
                ->when($branchId, fn (Builder $orderQuery) => $orderQuery->where('branch_id', $branchId)));
        $periodWorkOrders = WorkOrder::query()
            ->whereBetween('created_at', [$from, $to])
            ->when($branchId, fn (Builder $query) => $query->where('production_branch_id', $branchId));
        $inventoryMovements = MaterialStockMovement::query()
            ->whereBetween('material_stock_movements.created_at', [$from, $to])
            ->when($branchId, fn (Builder $query) => $query->where('material_stock_movements.branch_id', $branchId));

        $salesByDay = $periodOrders()
            ->selectRaw('DATE(created_at) as date, COUNT(*) as order_count, SUM(total) as order_value')
            ->groupBy(DB::raw('DATE(created_at)'))
            ->get()
            ->keyBy('date');
        $paymentsByDay = (clone $payments)
            ->selectRaw('DATE(paid_at) as date, SUM(amount) as amount')
            ->groupBy(DB::raw('DATE(paid_at)'))
            ->get()
            ->keyBy('date');
        $daily = collect(CarbonPeriod::create($from->toDateString(), $to->toDateString()))
            ->map(function ($date) use ($salesByDay, $paymentsByDay) {
                $key = $date->toDateString();
                $sales = $salesByDay->get($key);

                return [
                    'date' => $key,
                    'order_count' => (int) ($sales?->order_count ?? 0),
                    'order_value' => (float) ($sales?->order_value ?? 0),
                    'payments_received' => (float) ($paymentsByDay->get($key)?->amount ?? 0),
                ];
            })
            ->values();

        $branchPerformance = $periodOrders()
            ->leftJoin('branches', 'orders.branch_id', '=', 'branches.id')
            ->selectRaw("orders.branch_id, COALESCE(branches.name, 'Tanpa cabang') as branch_name")
            ->selectRaw('COUNT(orders.id) as order_count, COALESCE(SUM(orders.total), 0) as order_value')
            ->groupBy('orders.branch_id', 'branches.name')
            ->orderByDesc('order_value')
            ->limit(20)
            ->get();

        $productionByStatus = (clone $periodWorkOrders)
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->orderBy('status')
            ->get();
        $completedWorkOrders = WorkOrder::query()
            ->whereBetween('completed_at', [$from, $to])
            ->when($branchId, fn (Builder $query) => $query->where('production_branch_id', $branchId));

        $inventoryByType = (clone $inventoryMovements)
            ->selectRaw('movement_type, SUM(quantity) as quantity, COUNT(*) as movement_count')
            ->groupBy('movement_type')
            ->get()
            ->keyBy('movement_type');
        $materialsConsumed = (clone $inventoryMovements)
            ->where('movement_type', 'consumption')
            ->join('materials', 'material_stock_movements.material_id', '=', 'materials.id')
            ->leftJoin('units', 'materials.unit_id', '=', 'units.id')
            ->selectRaw('materials.id, materials.sku, materials.name, units.symbol as unit, SUM(ABS(material_stock_movements.quantity)) as quantity')
            ->groupBy('materials.id', 'materials.sku', 'materials.name', 'units.symbol')
            ->orderByDesc('quantity')
            ->limit(20)
            ->get();
        $stockBalances = DB::table('material_stock_movements')
            ->selectRaw('material_id, SUM(quantity) as on_hand')
            ->when($branchId, fn ($query) => $query->where('branch_id', $branchId))
            ->groupBy('material_id');
        $currentStock = Material::query()
            ->leftJoinSub($stockBalances, 'stock_balances', 'stock_balances.material_id', '=', 'materials.id')
            ->leftJoin('units', 'materials.unit_id', '=', 'units.id')
            ->where('materials.is_active', true);
        $lowStockCount = (clone $currentStock)
            ->whereRaw('COALESCE(stock_balances.on_hand, 0) <= materials.minimum_stock')
            ->count('materials.id');
        $estimatedStockValue = (float) (clone $currentStock)
            ->sum(DB::raw('CASE WHEN COALESCE(stock_balances.on_hand, 0) > 0 THEN stock_balances.on_hand * materials.unit_cost ELSE 0 END'));
        $lowStockMaterials = (clone $currentStock)
            ->whereRaw('COALESCE(stock_balances.on_hand, 0) <= materials.minimum_stock')
            ->select([
                'materials.id',
                'materials.sku',
                'materials.name',
                'materials.minimum_stock',
                'units.symbol as unit',
            ])
            ->selectRaw('COALESCE(stock_balances.on_hand, 0) as on_hand')
            ->orderByRaw('(materials.minimum_stock - COALESCE(stock_balances.on_hand, 0)) DESC')
            ->limit(10)
            ->get();

        $openBalance = (clone $orders)
            ->where('balance', '>', 0)
            ->sum('balance');
        $orderCount = $periodOrders()->count();
        $orderValue = (float) $periodOrders()->sum('total');
        $paymentTotal = (float) (clone $payments)->sum('amount');
        $productionTotal = (clone $periodWorkOrders)->count();
        $completedTotal = (clone $completedWorkOrders)->count();

        return response()->json([
            'data' => [
                'filters' => [
                    'from' => $from->toDateString(),
                    'to' => $to->toDateString(),
                    'branch_id' => $branchId,
                    'branch_name' => $filters['branch_name'],
                ],
                'branches' => $filters['branches'],
                'summary' => [
                    'order_count' => $orderCount,
                    'order_value' => $orderValue,
                    'average_order_value' => $orderCount ? round($orderValue / $orderCount, 2) : 0,
                    'payments_received' => $paymentTotal,
                    'open_balance' => (float) $openBalance,
                    'work_orders_created' => $productionTotal,
                    'work_orders_completed' => $completedTotal,
                ],
                'daily' => $daily,
                'branch_performance' => $branchPerformance,
                'production_by_status' => $productionByStatus,
                'inventory_by_type' => [
                    'receipt' => [
                        'quantity' => (float) ($inventoryByType->get('receipt')?->quantity ?? 0),
                        'count' => (int) ($inventoryByType->get('receipt')?->movement_count ?? 0),
                    ],
                    'adjustment' => [
                        'quantity' => (float) ($inventoryByType->get('adjustment')?->quantity ?? 0),
                        'count' => (int) ($inventoryByType->get('adjustment')?->movement_count ?? 0),
                    ],
                    'consumption' => [
                        'quantity' => abs((float) ($inventoryByType->get('consumption')?->quantity ?? 0)),
                        'count' => (int) ($inventoryByType->get('consumption')?->movement_count ?? 0),
                    ],
                ],
                'stock_summary' => [
                    'material_count' => (clone $currentStock)->count('materials.id'),
                    'low_stock_count' => $lowStockCount,
                    'estimated_value' => $estimatedStockValue,
                ],
                'low_stock_materials' => $lowStockMaterials,
                'materials_consumed' => $materialsConsumed,
                'recent_payments' => (clone $payments)
                    ->with(['order:id,order_number,customer_id', 'order.customer:id,name', 'receiver:id,name'])
                    ->latest('paid_at')
                    ->limit(10)
                    ->get(['id', 'payment_number', 'order_id', 'received_by', 'amount', 'method', 'paid_at']),
            ],
        ]);
    }

    public function export(Request $request)
    {
        $validated = $request->validate([
            'dataset' => ['required', Rule::in(['sales', 'finance', 'production', 'inventory'])],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'branch_id' => ['nullable', 'integer', Rule::exists('branches', 'id')->where('is_active', true)->whereNull('deleted_at')],
        ]);
        $filters = $this->filters($request);
        $from = $filters['from'];
        $to = $filters['to'];
        $branchId = $filters['branch_id'];
        $dataset = $validated['dataset'];

        return response()->streamDownload(function () use ($dataset, $from, $to, $branchId) {
            $stream = fopen('php://output', 'w');
            fwrite($stream, "\xEF\xBB\xBF");

            match ($dataset) {
                'sales' => $this->writeSalesCsv($stream, $from, $to, $branchId),
                'finance' => $this->writeFinanceCsv($stream, $from, $to, $branchId),
                'production' => $this->writeProductionCsv($stream, $from, $to, $branchId),
                'inventory' => $this->writeInventoryCsv($stream, $from, $to, $branchId),
            };

            fclose($stream);
        }, "printflow-{$dataset}-{$from->toDateString()}-{$to->toDateString()}.csv", [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function filters(Request $request): array
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'branch_id' => ['nullable', 'integer', Rule::exists('branches', 'id')->where('is_active', true)->whereNull('deleted_at')],
        ]);
        $from = Carbon::parse($validated['from'] ?? now()->startOfMonth()->toDateString())->startOfDay();
        $toDate = Carbon::parse($validated['to'] ?? today()->toDateString())->startOfDay();

        if ($from->greaterThan($toDate) || $from->diffInDays($toDate) >= 366) {
            throw ValidationException::withMessages([
                'from' => ['Rentang laporan harus berurutan dan tidak lebih dari 366 hari.'],
            ]);
        }
        $to = $toDate->endOfDay();

        $user = $request->user();
        $requestedBranch = $validated['branch_id'] ?? null;
        if ($user->branch_id) {
            if ($requestedBranch && (int) $requestedBranch !== (int) $user->branch_id) {
                abort(403, 'Anda tidak dapat melihat laporan cabang lain.');
            }
            $branchId = $user->branch_id;
        } else {
            if ($requestedBranch && ! $user->can('branches.view')) {
                abort(403, 'Anda tidak dapat memilih cabang laporan.');
            }
            $branchId = $requestedBranch;
        }

        $branches = $user->branch_id
            ? Branch::query()->whereKey($user->branch_id)->get(['id', 'name'])
            : ($user->can('branches.view')
                ? Branch::query()->where('is_active', true)->orderBy('name')->get(['id', 'name'])
                : collect());

        return [
            'from' => $from,
            'to' => $to,
            'branch_id' => $branchId,
            'branch_name' => $branchId
                ? Branch::query()->whereKey($branchId)->value('name')
                : 'Semua cabang',
            'branches' => $branches,
        ];
    }

    private function writeSalesCsv($stream, Carbon $from, Carbon $to, ?int $branchId): void
    {
        fputcsv($stream, ['Nomor pesanan', 'Tanggal', 'Pelanggan', 'Cabang', 'Total', 'Status pesanan', 'Status pembayaran']);
        Order::query()
            ->with(['customer:id,name', 'branch:id,name'])
            ->where('quote_status', 'approved')
            ->where('status', '!=', 'cancelled')
            ->whereBetween('created_at', [$from, $to])
            ->when($branchId, fn ($query) => $query->where('branch_id', $branchId))
            ->orderBy('id')
            ->chunk(500, function ($orders) use ($stream) {
                foreach ($orders as $order) {
                    fputcsv($stream, [
                        $this->csvCell($order->order_number),
                        $order->created_at->toDateTimeString(),
                        $this->csvCell($order->customer?->name ?? 'Pelanggan Umum'),
                        $this->csvCell($order->branch?->name ?? 'Tanpa cabang'),
                        $order->total,
                        $this->csvCell($order->status),
                        $this->csvCell($order->payment_status),
                    ]);
                }
            });
    }

    private function writeFinanceCsv($stream, Carbon $from, Carbon $to, ?int $branchId): void
    {
        fputcsv($stream, ['Nomor pembayaran', 'Waktu bayar', 'Nomor pesanan', 'Pelanggan', 'Jumlah', 'Metode', 'Petugas']);
        Payment::query()
            ->with(['order:id,order_number,customer_id,branch_id', 'order.customer:id,name', 'receiver:id,name'])
            ->whereBetween('paid_at', [$from, $to])
            ->whereHas('order', fn ($query) => $query
                ->where('quote_status', 'approved')
                ->where('status', '!=', 'cancelled')
                ->when($branchId, fn ($orderQuery) => $orderQuery->where('branch_id', $branchId)))
            ->orderBy('id')
            ->chunk(500, function ($payments) use ($stream) {
                foreach ($payments as $payment) {
                    fputcsv($stream, [
                        $this->csvCell($payment->payment_number),
                        $payment->paid_at->toDateTimeString(),
                        $this->csvCell($payment->order?->order_number ?? ''),
                        $this->csvCell($payment->order?->customer?->name ?? 'Pelanggan Umum'),
                        $payment->amount,
                        $this->csvCell($payment->method),
                        $this->csvCell($payment->receiver?->name ?? ''),
                    ]);
                }
            });
    }

    private function writeProductionCsv($stream, Carbon $from, Carbon $to, ?int $branchId): void
    {
        fputcsv($stream, ['Nomor pesanan', 'Produk', 'Jumlah', 'Status Work Order', 'Cabang produksi', 'Mesin', 'Mulai', 'Selesai']);
        WorkOrder::query()
            ->with(['order:id,order_number', 'item:id,product_name,quantity,unit_name', 'productionBranch:id,name', 'machine:id,name'])
            ->whereBetween('created_at', [$from, $to])
            ->when($branchId, fn ($query) => $query->where('production_branch_id', $branchId))
            ->orderBy('id')
            ->chunk(500, function ($workOrders) use ($stream) {
                foreach ($workOrders as $workOrder) {
                    fputcsv($stream, [
                        $this->csvCell($workOrder->order?->order_number ?? ''),
                        $this->csvCell($workOrder->item?->product_name ?? ''),
                        trim(($workOrder->item?->quantity ?? '').' '.($workOrder->item?->unit_name ?? '')),
                        $this->csvCell($workOrder->status),
                        $this->csvCell($workOrder->productionBranch?->name ?? ''),
                        $this->csvCell($workOrder->machine?->name ?? ''),
                        $workOrder->started_at?->toDateTimeString(),
                        $workOrder->completed_at?->toDateTimeString(),
                    ]);
                }
            });
    }

    private function writeInventoryCsv($stream, Carbon $from, Carbon $to, ?int $branchId): void
    {
        fputcsv($stream, ['Waktu', 'Cabang', 'Kode bahan', 'Bahan', 'Jenis mutasi', 'Jumlah', 'Satuan', 'Harga pokok', 'Nomor pesanan', 'Catatan']);
        MaterialStockMovement::query()
            ->with(['branch:id,name', 'material:id,sku,name,unit_id', 'material.unit:id,symbol', 'workOrder:id,order_id', 'workOrder.order:id,order_number'])
            ->whereBetween('created_at', [$from, $to])
            ->when($branchId, fn ($query) => $query->where('branch_id', $branchId))
            ->orderBy('id')
            ->chunk(500, function ($movements) use ($stream) {
                foreach ($movements as $movement) {
                    fputcsv($stream, [
                        $movement->created_at->toDateTimeString(),
                        $this->csvCell($movement->branch?->name ?? ''),
                        $this->csvCell($movement->material?->sku ?? ''),
                        $this->csvCell($movement->material?->name ?? ''),
                        $movement->movement_type,
                        $movement->quantity,
                        $this->csvCell($movement->material?->unit?->symbol ?? ''),
                        $movement->unit_cost,
                        $movement->workOrder?->order?->order_number,
                        $this->csvCell($movement->notes ?? ''),
                    ]);
                }
            });
    }

    private function csvCell(string $value): string
    {
        return preg_match('/^[=+\-@]/', $value) ? "'".$value : $value;
    }
}
