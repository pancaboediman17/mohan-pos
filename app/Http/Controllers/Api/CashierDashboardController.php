<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;

class CashierDashboardController extends Controller
{
    public function __invoke(Request $request)
    {
        $user = $request->user();
        $orders = Order::query()
            ->when($user->branch_id, fn ($query) => $query->where('branch_id', $user->branch_id));

        $todayOrders = (clone $orders)
            ->whereDate('created_at', today())
            ->where('status', '!=', 'cancelled');

        $outstandingOrders = (clone $orders)
            ->where('status', '!=', 'cancelled')
            ->whereIn('payment_status', ['unpaid', 'partial']);

        $recentOrders = (clone $orders)
            ->where('status', '!=', 'cancelled')
            ->with('customer:id,name')
            ->latest()
            ->limit(5)
            ->get([
                'id',
                'order_number',
                'customer_id',
                'total',
                'balance',
                'status',
                'payment_status',
                'created_at',
            ]);

        $user->loadMissing('branch');

        return response()->json([
            'data' => [
                'branch_name' => $user->branch?->name ?? 'Semua Cabang',
                'today_transactions' => (clone $todayOrders)->count(),
                'today_sales' => (clone $todayOrders)->sum('total'),
                'outstanding_orders' => (clone $outstandingOrders)->count(),
                'outstanding_balance' => (clone $outstandingOrders)->sum('balance'),
                'recent_orders' => $recentOrders,
            ],
        ]);
    }
}
