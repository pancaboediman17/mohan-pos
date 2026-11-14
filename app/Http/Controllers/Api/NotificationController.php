<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Material;
use App\Models\Order;
use App\Models\WorkOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $items = [];

        if ($user->can('orders.view')) {
            $orders = Order::query()
                ->where('status', '!=', 'cancelled')
                ->when($user->branch_id, fn ($query) => $query->where('branch_id', $user->branch_id));
            $pendingQuotes = (clone $orders)->where('quote_status', 'pending');
            $pendingQuoteCount = $pendingQuotes->count();

            if ($pendingQuoteCount) {
                $latestQuote = (clone $pendingQuotes)->latest('created_at')->first();
                $items[] = $this->notification(
                    'pending_quotes',
                    'Penawaran menunggu persetujuan',
                    "{$latestQuote->order_number} perlu ditindaklanjuti.",
                    $pendingQuoteCount,
                    'orders',
                    $latestQuote->created_at,
                );
            }

            $overdueOrders = (clone $orders)
                ->where('quote_status', 'approved')
                ->where('balance', '>', 0)
                ->whereNotNull('due_date')
                ->whereDate('due_date', '<', today());
            $overdueCount = $overdueOrders->count();

            if ($overdueCount) {
                $oldestOverdue = (clone $overdueOrders)->orderBy('due_date')->first();
                $items[] = $this->notification(
                    'overdue_orders',
                    'Tagihan melewati jatuh tempo',
                    "{$oldestOverdue->order_number} memiliki sisa tagihan dan perlu ditindaklanjuti.",
                    $overdueCount,
                    'orders',
                    $oldestOverdue->due_date,
                );
            }
        }

        if ($user->can('inventory.view')) {
            $balances = DB::table('material_stock_movements')
                ->selectRaw('material_id, SUM(quantity) as on_hand')
                ->when($user->branch_id, fn ($query) => $query->where('branch_id', $user->branch_id))
                ->groupBy('material_id');
            $lowStock = Material::query()
                ->leftJoinSub($balances, 'stock_balances', 'stock_balances.material_id', '=', 'materials.id')
                ->where('materials.is_active', true)
                ->whereRaw('COALESCE(stock_balances.on_hand, 0) <= materials.minimum_stock');
            $lowStockCount = (clone $lowStock)->count('materials.id');

            if ($lowStockCount) {
                $firstLowStock = (clone $lowStock)
                    ->orderByRaw('(materials.minimum_stock - COALESCE(stock_balances.on_hand, 0)) DESC')
                    ->first(['materials.name', 'materials.minimum_stock']);
                $items[] = $this->notification(
                    'low_stock',
                    'Stok bahan mencapai batas minimum',
                    "{$firstLowStock->name} adalah salah satu dari {$lowStockCount} bahan yang perlu diperiksa.",
                    $lowStockCount,
                    'inventory',
                    now(),
                );
            }
        }

        if ($user->can('production.view')) {
            $workOrders = WorkOrder::query()
                ->with(['order:id,order_number', 'item:id,product_name'])
                ->whereIn('status', ['waiting_design', 'queued'])
                ->when($user->branch_id, fn ($query) => $query->where('production_branch_id', $user->branch_id));
            $workOrderCount = (clone $workOrders)->count();

            if ($workOrderCount) {
                $latestWorkOrder = (clone $workOrders)->latest('created_at')->first();
                $productName = $latestWorkOrder->item?->product_name ?? 'Item pesanan';
                $items[] = $this->notification(
                    'production_queue',
                    'Work Order menunggu proses',
                    "{$latestWorkOrder->order?->order_number} · {$productName}.",
                    $workOrderCount,
                    'production',
                    $latestWorkOrder->created_at,
                );
            }
        }

        return response()->json([
            'data' => [
                'count' => collect($items)->sum('count'),
                'items' => $items,
            ],
        ]);
    }

    private function notification(
        string $type,
        string $title,
        string $description,
        int $count,
        string $target,
        mixed $occurredAt,
    ): array {
        return [
            'id' => $type,
            'type' => $type,
            'title' => $title,
            'description' => $description,
            'count' => $count,
            'target' => $target,
            'occurred_at' => $occurredAt,
        ];
    }
}
