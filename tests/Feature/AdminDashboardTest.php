<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_dashboard_returns_live_period_and_operational_metrics(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $branch = Branch::create([
            'code' => 'JKT',
            'name' => 'Jakarta',
        ]);
        $admin = User::factory()->create();
        $admin->assignRole('Admin');

        $pending = $this->createOrder($branch, $admin, 'PF-ADMIN-001', 500, 'pending', 'partial');
        $pending->update(['due_date' => today()->subDay()]);
        $paid = $this->createOrder($branch, $admin, 'PF-ADMIN-002', 300, 'completed', 'paid');
        $this->createOrder($branch, $admin, 'PF-ADMIN-003', 900, 'cancelled', 'unpaid');
        $previous = $this->createOrder($branch, $admin, 'PF-ADMIN-004', 100, 'processing', 'unpaid');
        $previous->forceFill(['created_at' => now()->subDays(8)])->save();

        Payment::create([
            'payment_number' => 'PAY-ADMIN-001',
            'order_id' => $pending->id,
            'received_by' => $admin->id,
            'amount' => 100,
            'method' => 'cash',
            'paid_at' => now(),
        ]);
        Payment::create([
            'payment_number' => 'PAY-ADMIN-002',
            'order_id' => $paid->id,
            'received_by' => $admin->id,
            'amount' => 300,
            'method' => 'transfer',
            'paid_at' => now(),
        ]);

        $this->actingAs($admin)
            ->getJson('/api/v1/admin-dashboard?days=7')
            ->assertOk()
            ->assertJsonPath('data.summary.total_orders', 2)
            ->assertJsonPath('data.summary.order_value', 800)
            ->assertJsonPath('data.summary.payments_received', 400)
            ->assertJsonPath('data.summary.outstanding_balance', 500)
            ->assertJsonPath('data.summary.production_queue', 2)
            ->assertJsonPath('data.summary.overdue_orders', 1)
            ->assertJsonPath('data.status_counts.cancelled', 1)
            ->assertJsonPath('data.comparison.total_orders_percent', 100)
            ->assertJsonCount(7, 'data.sales_chart')
            ->assertJsonCount(3, 'data.recent_orders')
            ->assertJsonPath('data.filters.branch_name', 'Semua cabang');
    }

    public function test_admin_dashboard_filters_by_branch_and_branch_users_cannot_switch_branches(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $branch = Branch::create([
            'code' => 'BDG',
            'name' => 'Bandung',
        ]);
        $otherBranch = Branch::create([
            'code' => 'SBY',
            'name' => 'Surabaya',
        ]);
        $admin = User::factory()->create();
        $admin->assignRole('Admin');
        $cashier = User::factory()->create(['branch_id' => $branch->id]);
        $cashier->assignRole('Kasir');

        $this->createOrder($branch, $admin, 'PF-BRANCH-001', 200, 'pending', 'unpaid');
        $this->createOrder($otherBranch, $admin, 'PF-BRANCH-002', 700, 'pending', 'unpaid');

        $this->actingAs($admin)
            ->getJson('/api/v1/admin-dashboard?branch_id='.$branch->id)
            ->assertOk()
            ->assertJsonPath('data.filters.branch_name', 'Bandung')
            ->assertJsonPath('data.summary.total_orders', 1)
            ->assertJsonPath('data.summary.order_value', 200);

        $this->actingAs($cashier)
            ->getJson('/api/v1/admin-dashboard?branch_id='.$otherBranch->id)
            ->assertForbidden();
    }

    public function test_admin_dashboard_rejects_unsupported_periods(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('Admin');

        $this->actingAs($admin)
            ->getJson('/api/v1/admin-dashboard?days=14')
            ->assertUnprocessable();
    }

    private function createOrder(
        Branch $branch,
        User $user,
        string $orderNumber,
        int $total,
        string $status,
        string $paymentStatus,
    ): Order {
        return Order::create([
            'order_number' => $orderNumber,
            'branch_id' => $branch->id,
            'created_by' => $user->id,
            'subtotal' => $total,
            'discount' => 0,
            'total' => $total,
            'paid_amount' => match ($paymentStatus) {
                'paid' => $total,
                'partial' => 100,
                default => 0,
            },
            'balance' => match ($paymentStatus) {
                'paid' => 0,
                'partial' => $total - 100,
                default => $total,
            },
            'status' => $status,
            'payment_status' => $paymentStatus,
        ]);
    }
}
