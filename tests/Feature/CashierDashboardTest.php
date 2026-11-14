<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Order;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CashierDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_metrics_only_include_active_orders_from_the_cashiers_branch(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $branch = Branch::create([
            'code' => 'BOGOR',
            'name' => 'Cabang Bogor',
        ]);
        $otherBranch = Branch::create([
            'code' => 'BANDUNG',
            'name' => 'Cabang Bandung',
        ]);

        $cashier = User::factory()->create(['branch_id' => $branch->id]);
        $cashier->assignRole('Kasir');

        $this->createOrder($cashier, $branch, 'PF-TEST-001', 120, 'pending', 'unpaid');
        $this->createOrder($cashier, $branch, 'PF-TEST-002', 80, 'completed', 'paid');
        $this->createOrder($cashier, $branch, 'PF-TEST-003', 50, 'cancelled', 'unpaid');
        $this->createOrder($cashier, $otherBranch, 'PF-TEST-004', 999, 'pending', 'unpaid');

        $this->actingAs($cashier)
            ->getJson('/api/v1/cashier-dashboard')
            ->assertOk()
            ->assertJsonPath('data.branch_name', 'Cabang Bogor')
            ->assertJsonPath('data.today_transactions', 2)
            ->assertJsonPath('data.today_sales', 200)
            ->assertJsonPath('data.outstanding_orders', 1)
            ->assertJsonPath('data.outstanding_balance', 120)
            ->assertJsonCount(2, 'data.recent_orders');
    }

    public function test_cashier_can_load_a_large_page_of_orders_for_payment_selection(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $branch = Branch::create([
            'code' => 'JAKARTA',
            'name' => 'Cabang Jakarta',
        ]);
        $cashier = User::factory()->create(['branch_id' => $branch->id]);
        $cashier->assignRole('Kasir');

        foreach (range(1, 16) as $index) {
            $this->createOrder(
                $cashier,
                $branch,
                sprintf('PF-LIST-%03d', $index),
                100,
                'pending',
                'unpaid',
            );
        }

        $this->actingAs($cashier)
            ->getJson('/api/v1/orders?per_page=100&payment_status=unpaid')
            ->assertOk()
            ->assertJsonCount(16, 'data');

        $this->getJson('/api/v1/orders?per_page=101')
            ->assertUnprocessable();
    }

    private function createOrder(
        User $cashier,
        Branch $branch,
        string $orderNumber,
        int $total,
        string $status,
        string $paymentStatus,
    ): void {
        Order::create([
            'order_number' => $orderNumber,
            'branch_id' => $branch->id,
            'created_by' => $cashier->id,
            'subtotal' => $total,
            'discount' => 0,
            'total' => $total,
            'paid_amount' => $paymentStatus === 'paid' ? $total : 0,
            'balance' => $paymentStatus === 'paid' ? 0 : $total,
            'status' => $status,
            'payment_status' => $paymentStatus,
        ]);
    }
}
