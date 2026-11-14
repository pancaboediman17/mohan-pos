<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Branch;
use App\Models\Order;
use App\Models\OrderCustomerFile;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Unit;
use App\Models\User;
use App\Models\WorkOrder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class OrderCustomerFileTest extends TestCase
{
    use RefreshDatabase;

    public function test_order_creation_accepts_an_optional_reference_image_for_each_item(): void
    {
        $this->seed(RolePermissionSeeder::class);
        Storage::fake('local');

        $cashier = User::factory()->create();
        $cashier->assignRole('Kasir');
        $category = ProductCategory::create([
            'name' => 'Cetak Multi Item',
            'slug' => 'cetak-multi-item',
            'is_active' => true,
        ]);
        $unit = Unit::create([
            'name' => 'Lembar',
            'symbol' => 'lbr',
            'is_active' => true,
        ]);
        $products = collect(['Cetak Banner', 'Stiker Label'])->map(
            fn (string $name) => Product::create([
                'product_category_id' => $category->id,
                'unit_id' => $unit->id,
                'product_code' => 'IMG-'.uniqid(),
                'name' => $name,
                'selling_price' => 10000,
                'estimated_cost' => 5000,
                'is_active' => true,
            ]),
        );

        $response = $this->actingAs($cashier)->post('/api/v1/orders', [
            'items' => [
                [
                    'product_id' => $products[0]->id,
                    'quantity' => 1,
                    'reference_image' => UploadedFile::fake()->image('banner.png'),
                ],
                [
                    'product_id' => $products[1]->id,
                    'quantity' => 2,
                ],
            ],
        ])->assertCreated()
            ->assertJsonCount(1, 'data.customer_files')
            ->assertJsonPath('data.customer_files.0.item.product_name', 'Cetak Banner');

        $file = OrderCustomerFile::query()->firstOrFail();
        $items = $response->json('data.items');
        $this->assertSame($response->json('data.id'), $file->order_id);
        $this->assertSame($items[0]['id'], $file->order_item_id);
        $this->assertDatabaseMissing('order_customer_files', [
            'order_item_id' => $items[1]['id'],
        ]);
        Storage::disk('local')->assertExists($file->file_path);

        $this->actingAs($cashier)->withHeader('Accept', 'application/json')->post('/api/v1/orders', [
            'items' => [[
                'product_id' => $products[0]->id,
                'quantity' => 1,
                'reference_image' => UploadedFile::fake()->create(
                    'layout.pdf',
                    100,
                    'application/pdf',
                ),
            ]],
        ])->assertUnprocessable();

        $this->assertDatabaseCount('orders', 1);
    }

    public function test_customer_uploads_private_reference_file_for_admin_and_production(): void
    {
        $this->seed(RolePermissionSeeder::class);
        Storage::fake('local');
        $salesBranch = Branch::create([
            'code' => 'SALES',
            'name' => 'Cabang Penjualan',
            'is_active' => true,
        ]);
        $productionBranch = Branch::create([
            'code' => 'PROD',
            'name' => 'Hub Produksi',
            'is_production_hub' => true,
            'is_active' => true,
        ]);
        $cashier = User::factory()->create(['branch_id' => $salesBranch->id]);
        $cashier->assignRole('Kasir');
        [$cashier, $order, $item] = $this->createOrder($cashier);
        WorkOrder::query()
            ->where('order_id', $order->id)
            ->update(['production_branch_id' => $productionBranch->id]);

        $linkResponse = $this->actingAs($cashier)
            ->postJson('/api/v1/orders/'.$order->id.'/customer-upload-link')
            ->assertOk()
            ->assertJsonPath('message', 'Tautan unggah pelanggan berlaku selama 30 hari.');

        $token = $this->tokenFromUrl($linkResponse->json('upload_url'));
        $this->assertSame(
            hash('sha256', $token),
            $order->fresh()->customer_upload_token_hash,
        );
        $this->getJson('/api/v1/public/orders/'.$token.'/upload')
            ->assertOk()
            ->assertJsonPath('data.order_number', $order->order_number)
            ->assertJsonPath('data.items.0.product_name', $item->product_name);

        $this->post('/api/v1/public/orders/'.$token.'/files', [
            'files' => [UploadedFile::fake()->image('referensi.png')],
            'order_item_id' => $item->id,
            'note' => 'Gunakan gambar ini untuk sisi depan.',
        ])->assertCreated()
            ->assertJsonPath('uploaded', 1);

        $customerFile = OrderCustomerFile::query()->firstOrFail();
        Storage::disk('local')->assertExists($customerFile->file_path);
        $this->assertSame($order->id, $customerFile->order_id);
        $this->assertSame($item->id, $customerFile->order_item_id);

        $operator = User::factory()->create(['branch_id' => $productionBranch->id]);
        $operator->assignRole('Operator Produksi');
        $this->actingAs($operator)
            ->getJson('/api/v1/work-orders')
            ->assertOk()
            ->assertJsonPath('data.0.order.customer_files.0.note', 'Gunakan gambar ini untuk sisi depan.');
        $this->get('/api/v1/orders/'.$order->id.'/customer-files/'.$customerFile->id.'/file')
            ->assertOk();
    }

    public function test_customer_cannot_attach_file_to_another_orders_item_or_use_expired_link(): void
    {
        $this->seed(RolePermissionSeeder::class);
        Storage::fake('local');
        [$cashier, $order] = $this->createOrder();
        [, , $otherItem] = $this->createOrder($cashier);

        $linkResponse = $this->actingAs($cashier)
            ->postJson('/api/v1/orders/'.$order->id.'/customer-upload-link')
            ->assertOk();
        $token = $this->tokenFromUrl($linkResponse->json('upload_url'));

        $this->post('/api/v1/public/orders/'.$token.'/files', [
            'files' => [UploadedFile::fake()->image('tidak-berlaku.png')],
            'order_item_id' => $otherItem->id,
        ])->assertUnprocessable();
        $this->assertDatabaseCount('order_customer_files', 0);

        $replacement = $this->actingAs($cashier)
            ->postJson('/api/v1/orders/'.$order->id.'/customer-upload-link')
            ->assertOk();
        $replacementToken = $this->tokenFromUrl($replacement->json('upload_url'));
        $this->getJson('/api/v1/public/orders/'.$token.'/upload')->assertNotFound();
        $this->getJson('/api/v1/public/orders/'.$replacementToken.'/upload')->assertOk();

        $order->update(['customer_upload_token_expires_at' => now()->subMinute()]);
        $this->getJson('/api/v1/public/orders/'.$replacementToken.'/upload')->assertNotFound();
    }

    private function createOrder(?User $cashier = null): array
    {
        $cashier ??= User::factory()->create();
        if (! $cashier->hasRole('Kasir')) {
            $cashier->assignRole('Kasir');
        }

        $category = ProductCategory::firstOrCreate([
            'slug' => 'referensi-cetak',
        ], [
            'name' => 'Referensi Cetak',
            'is_active' => true,
        ]);
        $unit = Unit::firstOrCreate([
            'symbol' => 'lbr',
        ], [
            'name' => 'Lembar',
            'is_active' => true,
        ]);
        $product = Product::create([
            'product_category_id' => $category->id,
            'unit_id' => $unit->id,
            'product_code' => 'REF-'.uniqid(),
            'name' => 'Cetak Referensi',
            'selling_price' => 10000,
            'estimated_cost' => 5000,
            'is_active' => true,
        ]);
        $customer = Customer::create([
            'name' => 'Pelanggan Uji',
            'customer_type' => 'individual',
            'phone' => '08123456789',
            'is_active' => true,
        ]);

        $created = $this->actingAs($cashier)->postJson('/api/v1/orders', [
            'customer_id' => $customer->id,
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 1,
            ]],
        ])->assertCreated();
        $order = Order::query()->latest('id')->firstOrFail();
        $item = $order->items()->firstOrFail();
        $quoteToken = $this->tokenFromUrl($created->json('approval_url'), 'quote');
        $this->postJson('/api/v1/public/quotes/'.$quoteToken.'/decision', [
            'decision' => 'approve',
        ])->assertOk();

        return [$cashier, $order, $item, WorkOrder::query()->where('order_id', $order->id)->firstOrFail()];
    }

    private function tokenFromUrl(string $url, string $key = 'upload'): string
    {
        parse_str(parse_url($url, PHP_URL_QUERY) ?? '', $query);

        return $query[$key] ?? '';
    }
}
