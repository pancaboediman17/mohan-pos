<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuoteApprovalTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_view_and_approve_a_quote_once(): void
    {
        $cashier = $this->createCashier();
        $product = $this->createProduct();

        $created = $this->actingAs($cashier)->postJson('/api/v1/orders', [
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 2,
            ], [
                'product_id' => $product->id,
                'quantity' => 1,
            ]],
        ]);

        $created->assertCreated()
            ->assertJsonPath('data.quote_status', 'pending')
            ->assertJsonMissingPath('data.quote_approval_token_hash');

        $order = Order::query()->firstOrFail();
        $token = $this->tokenFromUrl($created->json('approval_url'));

        $this->getJson('/api/v1/public/quotes/'.$token)
            ->assertOk()
            ->assertJsonPath('data.order_number', $order->order_number)
            ->assertJsonPath('data.total', '60000.00')
            ->assertJsonMissingPath('data.items.0.unit_cost');

        $this->postJson('/api/v1/public/quotes/'.$token.'/decision', [
            'decision' => 'approve',
        ])
            ->assertOk()
            ->assertJsonPath('quote_status', 'approved');

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'quote_status' => 'approved',
            'payment_status' => 'unpaid',
            'quote_approval_token_hash' => null,
        ]);
        $this->assertDatabaseCount('work_orders', 2);

        $this->getJson('/api/v1/public/quotes/'.$token)->assertNotFound();
    }

    public function test_customer_can_reject_a_quote_without_cancelling_the_order(): void
    {
        $cashier = $this->createCashier();
        $product = $this->createProduct();

        $created = $this->actingAs($cashier)->postJson('/api/v1/orders', [
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 1,
            ]],
        ])->assertCreated();
        $order = Order::query()->firstOrFail();
        $token = $this->tokenFromUrl($created->json('approval_url'));

        $this->postJson('/api/v1/public/quotes/'.$token.'/decision', [
            'decision' => 'reject',
            'note' => 'Mohon revisi spesifikasi.',
        ])
            ->assertOk()
            ->assertJsonPath('quote_status', 'rejected');

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'quote_status' => 'rejected',
            'status' => 'pending',
            'payment_status' => 'unpaid',
            'quote_response_note' => 'Mohon revisi spesifikasi.',
        ]);
    }

    public function test_staff_can_reissue_a_pending_quote_link_and_invalidate_the_old_link(): void
    {
        $cashier = $this->createCashier();
        $product = $this->createProduct();

        $created = $this->actingAs($cashier)->postJson('/api/v1/orders', [
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 1,
            ]],
        ])->assertCreated();
        $order = Order::query()->firstOrFail();
        $oldToken = $this->tokenFromUrl($created->json('approval_url'));

        $reissued = $this->postJson('/api/v1/orders/'.$order->id.'/approval-link')
            ->assertOk();
        $newToken = $this->tokenFromUrl($reissued->json('approval_url'));

        $this->assertNotSame($oldToken, $newToken);
        $this->getJson('/api/v1/public/quotes/'.$oldToken)->assertNotFound();
        $this->getJson('/api/v1/public/quotes/'.$newToken)->assertOk();
    }

    private function createCashier(): User
    {
        $this->seed(RolePermissionSeeder::class);
        $cashier = User::factory()->create();
        $cashier->assignRole('Kasir');

        return $cashier;
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

    private function tokenFromUrl(string $url): string
    {
        parse_str(parse_url($url, PHP_URL_QUERY) ?? '', $query);

        return $query['quote'];
    }
}
