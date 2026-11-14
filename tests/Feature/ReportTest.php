<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Material;
use App\Models\MaterialStockMovement;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Unit;
use App\Models\User;
use App\Models\WorkOrder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_reports_use_live_operational_data_and_apply_branch_date_filters(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $branch = Branch::create(['code' => 'JKT', 'name' => 'Jakarta']);
        $otherBranch = Branch::create(['code' => 'BDG', 'name' => 'Bandung']);
        $admin = User::factory()->create();
        $admin->assignRole('Admin');

        $included = $this->createApprovedOrder($branch, $admin, 'PF-REPORT-001', 100);
        $this->createApprovedOrder($otherBranch, $admin, 'PF-REPORT-002', 500);
        $pending = $this->createApprovedOrder($branch, $admin, 'PF-REPORT-003', 900);
        $pending->update(['quote_status' => 'pending']);
        $oldOrder = $this->createApprovedOrder($branch, $admin, 'PF-REPORT-004', 300);
        $oldOrder->forceFill(['created_at' => now()->subDays(3), 'updated_at' => now()->subDays(3)])->save();

        Payment::create([
            'payment_number' => 'PAY-REPORT-001',
            'order_id' => $included->id,
            'received_by' => $admin->id,
            'amount' => 30,
            'method' => 'cash',
            'paid_at' => now(),
        ]);
        Payment::create([
            'payment_number' => 'PAY-REPORT-002',
            'order_id' => $oldOrder->id,
            'received_by' => $admin->id,
            'amount' => 50,
            'method' => 'transfer',
            'paid_at' => now()->subDays(3),
        ]);

        $item = OrderItem::create([
            'order_id' => $included->id,
            'product_name' => 'Poster',
            'unit_name' => 'lembar',
            'quantity' => 2,
            'unit_price' => 50,
            'unit_cost' => 20,
            'subtotal' => 100,
        ]);
        WorkOrder::create([
            'order_id' => $included->id,
            'order_item_id' => $item->id,
            'production_branch_id' => $branch->id,
            'status' => 'completed',
            'started_at' => now(),
            'completed_at' => now(),
        ]);

        $unit = Unit::create(['name' => 'Lembar', 'symbol' => 'lbr', 'is_active' => true]);
        $material = Material::create([
            'sku' => 'PAPER-REPORT',
            'name' => 'Kertas',
            'unit_id' => $unit->id,
            'minimum_stock' => 9,
            'unit_cost' => 5,
            'is_active' => true,
        ]);
        MaterialStockMovement::create([
            'branch_id' => $branch->id,
            'material_id' => $material->id,
            'created_by' => $admin->id,
            'movement_type' => 'receipt',
            'quantity' => 10,
            'unit_cost' => 5,
        ]);
        MaterialStockMovement::create([
            'branch_id' => $branch->id,
            'material_id' => $material->id,
            'created_by' => $admin->id,
            'movement_type' => 'consumption',
            'quantity' => -2,
            'unit_cost' => 5,
        ]);

        $this->actingAs($admin)
            ->getJson('/api/v1/reports?from='.today()->toDateString().'&to='.today()->toDateString().'&branch_id='.$branch->id)
            ->assertOk()
            ->assertJsonPath('data.filters.branch_name', 'Jakarta')
            ->assertJsonPath('data.summary.order_count', 1)
            ->assertJsonPath('data.summary.order_value', 100)
            ->assertJsonPath('data.summary.payments_received', 30)
            ->assertJsonPath('data.summary.open_balance', 340)
            ->assertJsonPath('data.summary.work_orders_created', 1)
            ->assertJsonPath('data.summary.work_orders_completed', 1)
            ->assertJsonPath('data.daily.0.order_count', 1)
            ->assertJsonPath('data.inventory_by_type.receipt.quantity', 10)
            ->assertJsonPath('data.inventory_by_type.consumption.quantity', 2)
            ->assertJsonPath('data.stock_summary.material_count', 1)
            ->assertJsonPath('data.stock_summary.low_stock_count', 1)
            ->assertJsonPath('data.stock_summary.estimated_value', 40)
            ->assertJsonPath('data.materials_consumed.0.name', 'Kertas');
    }

    public function test_report_exports_filtered_sales_as_csv_and_rejects_long_periods(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $branch = Branch::create(['code' => 'SBY', 'name' => 'Surabaya']);
        $otherBranch = Branch::create(['code' => 'MLG', 'name' => 'Malang']);
        $admin = User::factory()->create();
        $admin->assignRole('Admin');
        $this->createApprovedOrder($branch, $admin, 'PF-EXPORT-001', 120);
        $this->createApprovedOrder($otherBranch, $admin, 'PF-EXPORT-002', 240);

        $response = $this->actingAs($admin)
            ->get('/api/v1/reports/export?dataset=sales&from='.today()->toDateString().'&to='.today()->toDateString().'&branch_id='.$branch->id)
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $csv = $response->streamedContent();

        $this->assertStringStartsWith("\xEF\xBB\xBF", $csv);
        $this->assertStringContainsString('Nomor pesanan', $csv);
        $this->assertStringContainsString('PF-EXPORT-001', $csv);
        $this->assertStringNotContainsString('PF-EXPORT-002', $csv);

        $this->getJson('/api/v1/reports?from='.today()->subDays(400)->toDateString().'&to='.today()->toDateString())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('from');
    }

    public function test_branch_assigned_report_user_cannot_select_another_branch(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $branch = Branch::create(['code' => 'DPS', 'name' => 'Denpasar']);
        $otherBranch = Branch::create(['code' => 'LOM', 'name' => 'Lombok']);
        $admin = User::factory()->create(['branch_id' => $branch->id]);
        $admin->assignRole('Admin');

        $this->actingAs($admin)
            ->getJson('/api/v1/reports?branch_id='.$otherBranch->id)
            ->assertForbidden();
    }

    private function createApprovedOrder(Branch $branch, User $user, string $number, int $total): Order
    {
        return Order::create([
            'order_number' => $number,
            'quote_status' => 'approved',
            'branch_id' => $branch->id,
            'created_by' => $user->id,
            'subtotal' => $total,
            'discount' => 0,
            'total' => $total,
            'paid_amount' => 30,
            'balance' => $total - 30,
            'status' => 'processing',
            'payment_status' => 'partial',
        ]);
    }
}
