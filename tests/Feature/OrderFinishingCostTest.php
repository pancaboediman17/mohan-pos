<?php

namespace Tests\Feature;

use App\Models\FinishingType;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderFinishingCostTest extends TestCase
{
    use RefreshDatabase;

    public function test_finishing_cost_is_added_to_internal_unit_cost_not_customer_total(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $cashier = User::factory()->create();
        $cashier->assignRole('Kasir');

        $product = $this->createProduct();

        $lamination = FinishingType::create([
            'name' => 'Laminasi Doff',
            'code' => 'LAM-DOFF',
            'default_cost' => 500,
            'is_active' => true,
        ]);
        $cutting = FinishingType::create([
            'name' => 'Potong',
            'code' => 'POTONG',
            'default_cost' => 2000,
            'is_active' => true,
        ]);

        $response = $this->actingAs($cashier)->postJson('/api/v1/orders', [
            'discount' => 0,
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 3,
                'finishing_type_ids' => [$lamination->id, $cutting->id],
            ]],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.total', '60000.00')
            ->assertJsonPath('data.items.0.unit_cost', '12500.00')
            ->assertJsonCount(2, 'data.items.0.finishings');

        $this->assertDatabaseHas('orders', ['total' => 60000]);
        $this->assertDatabaseHas('order_items', ['unit_cost' => 12500]);
        $this->assertDatabaseCount('order_item_finishings', 2);
    }

    public function test_cashier_can_load_active_finishing_options_but_cannot_select_inactive_types(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $cashier = User::factory()->create();
        $cashier->assignRole('Kasir');

        $activeFinishing = FinishingType::create([
            'name' => 'Laminasi Glossy',
            'code' => 'LAM-GLOSSY',
            'default_cost' => 1000,
            'is_active' => true,
        ]);
        $inactiveFinishing = FinishingType::create([
            'name' => 'Finishing Nonaktif',
            'code' => 'NONAKTIF',
            'default_cost' => 1000,
            'is_active' => false,
        ]);
        $product = $this->createProduct();

        $this->actingAs($cashier)
            ->getJson('/api/v1/order-finishing-types')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $activeFinishing->id);

        $this->postJson('/api/v1/orders', [
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 1,
                'finishing_type_ids' => [$inactiveFinishing->id],
            ]],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('items.0.finishing_type_ids.0');
    }

    private function createProduct(): Product
    {
        $category = ProductCategory::create([
            'name' => 'Cetak',
            'slug' => 'cetak',
            'is_active' => true,
        ]);
        $unit = Unit::create([
            'name' => 'Lembar',
            'symbol' => 'lbr',
            'is_active' => true,
        ]);

        return Product::create([
            'product_category_id' => $category->id,
            'unit_id' => $unit->id,
            'product_code' => 'CETAK-001',
            'name' => 'Cetak Poster',
            'selling_price' => 20000,
            'estimated_cost' => 10000,
            'is_active' => true,
        ]);
    }
}
