<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OwnerGlobalBranchAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_with_a_branch_assignment_can_access_and_filter_all_branches(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $assignedBranch = Branch::create(['code' => 'OWN-A', 'name' => 'Cabang Owner']);
        $otherBranch = Branch::create(['code' => 'OWN-B', 'name' => 'Cabang Lain']);
        $owner = User::factory()->create(['branch_id' => $assignedBranch->id]);
        $owner->assignRole('Owner');

        $this->createPaidOrder($owner, $assignedBranch, 'PF-OWNER-A', 1000);
        $otherOrder = $this->createPaidOrder($owner, $otherBranch, 'PF-OWNER-B', 2000);

        $this->actingAs($owner)
            ->getJson('/api/v1/orders')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->getJson('/api/v1/orders/'.$otherOrder->id)
            ->assertOk()
            ->assertJsonPath('data.branch.name', 'Cabang Lain');

        $this->getJson('/api/v1/admin-dashboard?branch_id='.$otherBranch->id)
            ->assertOk()
            ->assertJsonPath('data.filters.branch_id', $otherBranch->id)
            ->assertJsonPath('data.summary.total_orders', 1)
            ->assertJsonCount(2, 'data.branches');

        $this->getJson('/api/v1/reports?from='.today()->toDateString().'&to='.today()->toDateString().'&branch_id='.$otherBranch->id)
            ->assertOk()
            ->assertJsonPath('data.summary.order_count', 1)
            ->assertJsonPath('data.summary.order_value', 2000)
            ->assertJsonCount(2, 'data.branches');

        $this->getJson('/api/v1/payments')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->getJson('/api/v1/inventory/branches')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    private function createPaidOrder(User $owner, Branch $branch, string $number, int $total): Order
    {
        $order = Order::create([
            'order_number' => $number,
            'quote_status' => 'approved',
            'branch_id' => $branch->id,
            'created_by' => $owner->id,
            'subtotal' => $total,
            'discount' => 0,
            'total' => $total,
            'paid_amount' => 100,
            'balance' => $total - 100,
            'status' => 'processing',
            'payment_status' => 'partial',
        ]);

        Payment::create([
            'payment_number' => 'PAY-'.$number,
            'order_id' => $order->id,
            'received_by' => $owner->id,
            'amount' => 100,
            'method' => 'cash',
            'paid_at' => now(),
        ]);

        return $order;
    }
}
