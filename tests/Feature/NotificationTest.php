<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Material;
use App\Models\MaterialStockMovement;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Unit;
use App\Models\User;
use App\Models\WorkOrder;
use Carbon\Carbon;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_notifications_summarize_action_items_with_the_users_branch_scope(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $branch = Branch::create(['code' => 'JKT', 'name' => 'Jakarta']);
        $otherBranch = Branch::create(['code' => 'BDG', 'name' => 'Bandung']);
        $user = User::factory()->create(['branch_id' => $branch->id]);
        $user->assignRole('Admin');

        $this->createOrder($branch, $user, 'PF-NOTIFY-001', 'pending', 100, today()->addDays(3));
        $overdue = $this->createOrder($branch, $user, 'PF-NOTIFY-002', 'approved', 40, today()->subDay());
        $this->createOrder($otherBranch, $user, 'PF-NOTIFY-003', 'approved', 90, today()->subDay());

        $item = OrderItem::create([
            'order_id' => $overdue->id,
            'product_name' => 'Banner',
            'unit_name' => 'pcs',
            'quantity' => 1,
            'unit_price' => 40,
            'unit_cost' => 20,
            'subtotal' => 40,
        ]);
        WorkOrder::create([
            'order_id' => $overdue->id,
            'order_item_id' => $item->id,
            'production_branch_id' => $branch->id,
            'status' => 'queued',
        ]);

        $unit = Unit::create(['name' => 'Meter', 'symbol' => 'm', 'is_active' => true]);
        $material = Material::create([
            'sku' => 'VINYL-01',
            'name' => 'Vinyl',
            'unit_id' => $unit->id,
            'minimum_stock' => 10,
            'unit_cost' => 2000,
            'is_active' => true,
        ]);
        MaterialStockMovement::create([
            'branch_id' => $branch->id,
            'material_id' => $material->id,
            'movement_type' => 'receipt',
            'quantity' => 5,
            'unit_cost' => 2000,
        ]);

        $this->actingAs($user)
            ->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonPath('data.count', 4)
            ->assertJsonPath('data.items.0.id', 'pending_quotes')
            ->assertJsonPath('data.items.0.count', 1)
            ->assertJsonPath('data.items.1.id', 'overdue_orders')
            ->assertJsonPath('data.items.1.count', 1)
            ->assertJsonPath('data.items.2.id', 'low_stock')
            ->assertJsonPath('data.items.2.count', 1)
            ->assertJsonPath('data.items.3.id', 'production_queue')
            ->assertJsonPath('data.items.3.count', 1);
    }

    public function test_notification_endpoint_requires_dashboard_permission(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/v1/notifications')
            ->assertForbidden();
    }

    private function createOrder(
        Branch $branch,
        User $user,
        string $number,
        string $quoteStatus,
        int $balance,
        Carbon $dueDate,
    ): Order {
        return Order::create([
            'order_number' => $number,
            'quote_status' => $quoteStatus,
            'branch_id' => $branch->id,
            'created_by' => $user->id,
            'subtotal' => $balance,
            'discount' => 0,
            'total' => $balance,
            'paid_amount' => 0,
            'balance' => $balance,
            'status' => $quoteStatus === 'approved' ? 'processing' : 'pending',
            'payment_status' => 'unpaid',
            'due_date' => $dueDate,
        ]);
    }
}
