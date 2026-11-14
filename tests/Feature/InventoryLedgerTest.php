<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Unit;
use App\Models\User;
use App\Models\WorkOrder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryLedgerTest extends TestCase
{
    use RefreshDatabase;

    public function test_stock_receipts_adjustments_and_work_order_consumption_share_the_ledger(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $branch = Branch::create([
            'code' => 'PUSAT',
            'name' => 'Produksi Pusat',
            'is_production_hub' => true,
            'is_active' => true,
        ]);
        $unit = Unit::create([
            'name' => 'Lembar',
            'symbol' => 'lbr',
            'is_active' => true,
        ]);
        $category = ProductCategory::create([
            'name' => 'Cetak',
            'slug' => 'cetak',
            'is_active' => true,
        ]);
        $product = Product::create([
            'product_category_id' => $category->id,
            'unit_id' => $unit->id,
            'product_code' => 'POSTER-01',
            'name' => 'Poster',
            'selling_price' => 10000,
            'estimated_cost' => 5000,
            'is_active' => true,
        ]);

        $admin = User::factory()->create();
        $admin->assignRole('Admin');
        $materialResponse = $this->actingAs($admin)->postJson('/api/v1/inventory/materials', [
            'sku' => 'PAPER-01',
            'name' => 'Art Paper',
            'unit_id' => $unit->id,
            'minimum_stock' => 2,
            'unit_cost' => 500,
        ])->assertCreated();
        $materialId = $materialResponse->json('data.id');

        $this->postJson('/api/v1/inventory/movements', [
            'branch_id' => $branch->id,
            'material_id' => $materialId,
            'movement_type' => 'adjustment',
            'quantity' => 0.0001,
        ])->assertUnprocessable();

        $this->postJson('/api/v1/inventory/movements', [
            'branch_id' => $branch->id,
            'material_id' => $materialId,
            'movement_type' => 'receipt',
            'quantity' => 10,
            'unit_cost' => 600,
        ])->assertCreated();

        $cashier = User::factory()->create(['branch_id' => $branch->id]);
        $cashier->assignRole('Kasir');
        $created = $this->actingAs($cashier)->postJson('/api/v1/orders', [
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 1,
            ]],
        ])->assertCreated();
        $quoteToken = $this->tokenFromUrl($created->json('approval_url'));
        $this->postJson('/api/v1/public/quotes/'.$quoteToken.'/decision', [
            'decision' => 'approve',
        ])->assertOk();

        $workOrder = WorkOrder::query()->firstOrFail();
        $workOrder->update(['status' => 'printing']);
        $operator = User::factory()->create(['branch_id' => $branch->id]);
        $operator->assignRole('Operator Produksi');

        $this->actingAs($operator)
            ->postJson('/api/v1/work-orders/'.$workOrder->id.'/materials', [
                'material_id' => $materialId,
                'quantity' => 3,
            ])
            ->assertCreated()
            ->assertJsonPath('data.movement_type', 'consumption')
            ->assertJsonPath('data.quantity', '-3.000');

        $this->postJson('/api/v1/work-orders/'.$workOrder->id.'/materials', [
            'material_id' => $materialId,
            'quantity' => 8,
        ])->assertUnprocessable();

        $this->actingAs($admin)
            ->postJson('/api/v1/inventory/movements', [
                'branch_id' => $branch->id,
                'material_id' => $materialId,
                'movement_type' => 'adjustment',
                'quantity' => -2,
                'notes' => 'Hasil opname',
            ])
            ->assertCreated();

        $this->getJson('/api/v1/inventory/materials?branch_id='.$branch->id)
            ->assertOk()
            ->assertJsonPath('data.0.on_hand', 5)
            ->assertJsonPath('summary.low_stock', 0);

        $this->assertDatabaseCount('material_stock_movements', 3);
    }

    private function tokenFromUrl(string $url): string
    {
        parse_str(parse_url($url, PHP_URL_QUERY) ?? '', $query);

        return $query['quote'] ?? '';
    }
}
