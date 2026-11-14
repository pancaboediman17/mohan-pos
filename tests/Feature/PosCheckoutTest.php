<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PosCheckoutTest extends TestCase
{
    use RefreshDatabase;

    public function test_pos_checkout_creates_the_order_and_payment_together(): void
    {
        $this->seed(RolePermissionSeeder::class);
        [$cashier, $product] = $this->cashierAndProduct();

        $this->actingAs($cashier)
            ->postJson('/api/v1/cash-register/open', ['opening_cash' => 0])
            ->assertCreated();

        $response = $this->actingAs($cashier)->postJson('/api/v1/orders', [
            'order_type' => 'pos',
            'initial_payment' => [
                'type' => 'down_payment',
                'amount' => 25000,
                'method' => 'qris',
                'reference_number' => 'QRIS-001',
            ],
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 2,
            ]],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.order_type', 'pos')
            ->assertJsonPath('data.payment_status', 'partial')
            ->assertJsonPath('data.paid_amount', '25000.00')
            ->assertJsonPath('data.balance', '15000.00')
            ->assertJsonPath('data.payments.0.payment_type', 'down_payment')
            ->assertJsonPath('data.payments.0.method', 'qris');

        $this->assertDatabaseHas('payments', [
            'order_id' => $response->json('data.id'),
            'amount' => 25000,
            'payment_type' => 'down_payment',
            'method' => 'qris',
        ]);

        $this->actingAs($cashier)
            ->postJson('/api/v1/payments', [
                'order_id' => $response->json('data.id'),
                'amount' => 15000,
                'payment_type' => 'settlement',
                'method' => 'cash',
            ])
            ->assertCreated()
            ->assertJsonPath('data.payment_type', 'settlement')
            ->assertJsonPath('data.order.payment_status', 'paid')
            ->assertJsonPath('data.order.balance', '0.00');
    }

    public function test_pos_checkout_is_rolled_back_when_cashier_has_no_open_shift(): void
    {
        $this->seed(RolePermissionSeeder::class);
        [$cashier, $product] = $this->cashierAndProduct();

        $this->actingAs($cashier)->postJson('/api/v1/orders', [
            'order_type' => 'pos',
            'initial_payment' => [
                'type' => 'full',
                'amount' => 20000,
                'method' => 'cash',
            ],
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 1,
            ]],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('shift');

        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('payments', 0);
    }

    private function cashierAndProduct(): array
    {
        $branch = Branch::create(['code' => 'POS', 'name' => 'Cabang POS']);
        $cashier = User::factory()->create(['branch_id' => $branch->id]);
        $cashier->assignRole('Kasir');

        $category = ProductCategory::create([
            'name' => 'Cetak POS',
            'slug' => 'cetak-pos',
            'is_active' => true,
        ]);
        $unit = Unit::create([
            'name' => 'Lembar',
            'symbol' => 'lbr',
            'is_active' => true,
        ]);
        $product = Product::create([
            'product_category_id' => $category->id,
            'unit_id' => $unit->id,
            'product_code' => 'POS-001',
            'name' => 'Cetak POS',
            'selling_price' => 20000,
            'estimated_cost' => 10000,
            'is_active' => true,
        ]);

        return [$cashier, $product];
    }
}
