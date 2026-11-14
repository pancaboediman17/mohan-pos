<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MasterDataPaginationTest extends TestCase
{
    use RefreshDatabase;

    public function test_order_form_master_data_can_request_more_than_default_page_size(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $user = User::factory()->create();
        $user->assignRole('Kasir');

        foreach (range(1, 12) as $index) {
            Customer::create([
                'name' => "Customer {$index}",
                'customer_type' => 'individual',
            ]);
        }

        $category = ProductCategory::create([
            'name' => 'Cetak',
            'slug' => 'cetak',
        ]);
        $unit = Unit::create([
            'name' => 'Lembar',
            'symbol' => 'lbr',
        ]);

        foreach (range(1, 12) as $index) {
            Product::create([
                'product_category_id' => $category->id,
                'unit_id' => $unit->id,
                'product_code' => sprintf('PRD-%06d', $index),
                'name' => "Product {$index}",
                'selling_price' => 1000,
            ]);
        }

        $this->actingAs($user)
            ->getJson('/api/v1/customers?per_page=100')
            ->assertOk()
            ->assertJsonCount(12, 'data.data');

        $this->getJson('/api/v1/products?per_page=100')
            ->assertOk()
            ->assertJsonCount(12, 'data');
    }
}
