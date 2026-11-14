<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Branch;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Unit;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class MarketplaceOrderImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_marketplace_import_waits_for_staff_review_and_is_idempotent(): void
    {
        $cashier = $this->createCashier();
        $this->createProduct();
        $csv = $this->marketplaceCsv([
            $this->marketplaceRow(),
            $this->marketplaceRow([
                'quantity' => '1',
                'unit_price' => '10000',
                'specifications' => 'Poster A4',
            ]),
        ]);

        $this->actingAs($cashier)
            ->post('/api/v1/marketplace/orders/import/preview', [
                'file' => UploadedFile::fake()->createWithContent('marketplace.csv', $csv),
            ])
            ->assertOk()
            ->assertJsonPath('data.ready', 1)
            ->assertJsonPath('data.imported', 0);

        $this->assertDatabaseCount('orders', 0);

        $this->actingAs($cashier)
            ->post('/api/v1/marketplace/orders/import', [
                'file' => UploadedFile::fake()->createWithContent('marketplace.csv', $csv),
            ])
            ->assertOk()
            ->assertJsonPath('data.imported', 1);

        $order = Order::query()->firstOrFail();
        $this->assertSame('shopee', $order->sales_channel);
        $this->assertSame('SP-10001', $order->external_order_id);
        $this->assertSame('paid', $order->channel_payment_status);
        $this->assertSame('unpaid', $order->payment_status);
        $this->assertSame('pending', $order->quote_status);
        $this->assertNull($order->quote_approval_token_hash);
        $this->assertDatabaseCount('order_items', 2);
        $this->assertDatabaseCount('work_orders', 0);
        $this->assertDatabaseHas('order_shipments', [
            'order_id' => $order->id,
            'tracking_number' => 'TRK-10001',
            'status' => 'in_transit',
        ]);

        $this->actingAs($cashier)
            ->post('/api/v1/marketplace/orders/import', [
                'file' => UploadedFile::fake()->createWithContent('marketplace.csv', $csv),
            ])
            ->assertOk()
            ->assertJsonPath('data.imported', 0)
            ->assertJsonPath('data.duplicates', 1);
        $this->assertDatabaseCount('orders', 1);

        $this->actingAs($cashier)
            ->postJson("/api/v1/orders/{$order->id}/confirm-marketplace")
            ->assertOk()
            ->assertJsonPath('data.quote_status', 'approved');
        $this->assertDatabaseCount('work_orders', 2);
    }

    public function test_marketplace_import_rejects_an_order_with_an_unknown_sku(): void
    {
        $cashier = $this->createCashier();
        $this->createProduct();
        $csv = $this->marketplaceCsv([
            $this->marketplaceRow(),
            $this->marketplaceRow(['product_code' => 'UNKNOWN-001']),
        ]);

        $this->actingAs($cashier)
            ->post('/api/v1/marketplace/orders/import/preview', [
                'file' => UploadedFile::fake()->createWithContent('marketplace.csv', $csv),
            ])
            ->assertOk()
            ->assertJsonPath('data.ready', 0)
            ->assertJsonPath('data.invalid', 1)
            ->assertJsonFragment(['Baris 3: SKU UNKNOWN-001 tidak ditemukan atau tidak aktif.']);

        $this->actingAs($cashier)
            ->post('/api/v1/marketplace/orders/import', [
                'file' => UploadedFile::fake()->createWithContent('marketplace.csv', $csv),
            ])
            ->assertOk()
            ->assertJsonPath('data.imported', 0)
            ->assertJsonPath('data.invalid', 1);

        $this->assertDatabaseCount('orders', 0);
    }

    public function test_staff_can_update_a_shipment_manually(): void
    {
        $cashier = $this->createCashier();
        $this->createProduct();
        $csv = $this->marketplaceCsv([$this->marketplaceRow([
            'shipping_address' => null,
            'courier' => null,
            'tracking_number' => null,
            'shipment_status' => null,
        ])]);

        $this->actingAs($cashier)
            ->post('/api/v1/marketplace/orders/import', [
                'file' => UploadedFile::fake()->createWithContent('marketplace.csv', $csv),
            ])
            ->assertOk();

        $order = Order::query()->firstOrFail();
        $this->actingAs($cashier)
            ->putJson("/api/v1/orders/{$order->id}/shipment", [
                'recipient_name' => 'Pelanggan Toko',
                'recipient_phone' => '08123456789',
                'shipping_address' => 'Jl. Contoh No. 10',
                'courier' => 'GoSend',
                'service_name' => 'Same Day',
                'tracking_number' => 'GS-10001',
                'shipping_fee' => 15000,
                'status' => 'delivered',
                'notes' => null,
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'delivered')
            ->assertJsonPath('data.courier', 'GoSend');

        $this->assertDatabaseHas('order_shipments', [
            'order_id' => $order->id,
            'tracking_number' => 'GS-10001',
            'status' => 'delivered',
        ]);
    }

    public function test_staff_confirmation_is_required_before_marketplace_sales_enter_reports(): void
    {
        $cashier = $this->createCashier();
        $cashier->givePermissionTo('reports.view');
        $this->createProduct();
        $csv = $this->marketplaceCsv([$this->marketplaceRow()]);

        $this->actingAs($cashier)->post('/api/v1/marketplace/orders/import', [
            'file' => UploadedFile::fake()->createWithContent('marketplace.csv', $csv),
        ])->assertOk();

        $this->actingAs($cashier)
            ->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.id', 'pending_marketplace_orders');

        $order = Order::query()->firstOrFail();
        $this->actingAs($cashier)
            ->getJson('/api/v1/reports?from=2026-11-14&to=2026-11-14')
            ->assertOk()
            ->assertJsonPath('data.summary.order_count', 0);

        $this->actingAs($cashier)
            ->postJson("/api/v1/orders/{$order->id}/confirm-marketplace")
            ->assertOk();

        $this->actingAs($cashier)
            ->getJson('/api/v1/reports?from=2026-11-14&to=2026-11-14')
            ->assertOk()
            ->assertJsonPath('data.summary.order_count', 1)
            ->assertJsonPath('data.summary.order_value', 45000);
    }

    public function test_shipment_updates_remain_scoped_to_the_users_branch(): void
    {
        $userBranch = Branch::create(['code' => 'JKT', 'name' => 'Jakarta']);
        $orderBranch = Branch::create(['code' => 'BDG', 'name' => 'Bandung']);
        $cashier = $this->createCashier();
        $cashier->update(['branch_id' => $userBranch->id]);
        $order = Order::create([
            'order_number' => 'PF-BRANCH-001',
            'branch_id' => $orderBranch->id,
            'subtotal' => 100,
            'total' => 100,
            'balance' => 100,
            'status' => 'pending',
            'payment_status' => 'unpaid',
        ]);

        $this->actingAs($cashier)
            ->putJson("/api/v1/orders/{$order->id}/shipment", [
                'shipping_address' => 'Jl. Contoh No. 10',
                'courier' => 'GoSend',
                'status' => 'pending',
            ])
            ->assertNotFound();

        $this->assertDatabaseCount('order_shipments', 0);
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

    private function marketplaceRow(array $overrides = []): array
    {
        return array_replace([
            'sales_channel' => 'shopee',
            'external_order_id' => 'SP-10001',
            'order_date' => '2026-11-14',
            'customer_name' => 'Pelanggan Marketplace',
            'customer_phone' => '08123456789',
            'customer_email' => 'marketplace@example.test',
            'channel_payment_status' => 'paid',
            'product_code' => 'CETAK-001',
            'quantity' => '2',
            'unit_price' => '25000',
            'width' => null,
            'height' => null,
            'discount' => '5000',
            'specifications' => 'Poster A3',
            'item_notes' => null,
            'recipient_name' => 'Pelanggan Toko',
            'recipient_phone' => '08123456789',
            'shipping_address' => 'Jl. Contoh No. 10',
            'courier' => 'J&T',
            'service_name' => 'Reguler',
            'shipping_fee' => '10000',
            'tracking_number' => 'TRK-10001',
            'shipment_status' => 'in_transit',
            'notes' => null,
        ], $overrides);
    }

    private function marketplaceCsv(array $rows): string
    {
        $headers = array_keys($this->marketplaceRow());
        $stream = fopen('php://temp', 'r+');
        fputcsv($stream, $headers);

        foreach ($rows as $row) {
            fputcsv($stream, array_map(fn ($header) => $row[$header] ?? '', $headers));
        }

        rewind($stream);
        $csv = stream_get_contents($stream);
        fclose($stream);

        return $csv;
    }
}
