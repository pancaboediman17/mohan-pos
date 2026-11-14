<?php

namespace Tests\Feature;

use App\Models\Order;
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

class DesignApprovalTest extends TestCase
{
    use RefreshDatabase;

    public function test_designer_can_upload_design_and_customer_can_approve_it(): void
    {
        $this->seed(RolePermissionSeeder::class);
        Storage::fake('local');
        $cashier = User::factory()->create();
        $cashier->assignRole('Kasir');
        $product = $this->createProduct();

        $created = $this->actingAs($cashier)->postJson('/api/v1/orders', [
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 2,
            ]],
        ])->assertCreated();
        $order = Order::query()->firstOrFail();
        $quoteToken = $this->tokenFromUrl($created->json('approval_url'));

        $this->postJson('/api/v1/public/quotes/'.$quoteToken.'/decision', [
            'decision' => 'approve',
        ])->assertOk();

        $workOrder = WorkOrder::query()->firstOrFail();
        $this->assertSame('waiting_design', $workOrder->status);

        $designer = User::factory()->create();
        $designer->assignRole('Desainer');
        $upload = $this->actingAs($designer)->post(
            '/api/v1/order-items/'.$workOrder->order_item_id.'/designs',
            ['design_file' => UploadedFile::fake()->image('poster.png')],
        );
        $upload->assertCreated()
            ->assertJsonPath('data.status', 'pending_approval');

        $designToken = $this->tokenFromUrl($upload->json('approval_url'));
        $this->getJson('/api/v1/public/designs/'.$designToken)
            ->assertOk()
            ->assertJsonPath('data.order_number', $order->order_number)
            ->assertJsonPath('data.version', 1)
            ->assertJsonMissingPath('data.approval_token_hash')
            ->assertJsonMissingPath('data.file_path');
        $this->get('/api/v1/public/designs/'.$designToken.'/file')->assertOk();

        $this->postJson('/api/v1/public/designs/'.$designToken.'/decision', [
            'decision' => 'approve',
        ])->assertOk()->assertJsonPath('status', 'approved');

        $this->assertDatabaseHas('order_item_designs', [
            'order_item_id' => $workOrder->order_item_id,
            'version' => 1,
            'status' => 'approved',
        ]);
        $this->assertDatabaseHas('work_orders', [
            'id' => $workOrder->id,
            'status' => 'queued',
        ]);
    }

    public function test_customer_revision_request_moves_the_work_order_back_to_design(): void
    {
        $this->seed(RolePermissionSeeder::class);
        Storage::fake('local');
        $cashier = User::factory()->create();
        $cashier->assignRole('Kasir');
        $product = $this->createProduct();

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
        $designer = User::factory()->create();
        $designer->assignRole('Desainer');
        $upload = $this->actingAs($designer)->post(
            '/api/v1/order-items/'.$workOrder->order_item_id.'/designs',
            ['design_file' => UploadedFile::fake()->image('poster.png')],
        )->assertCreated();
        $designToken = $this->tokenFromUrl($upload->json('approval_url'));

        $this->postJson('/api/v1/public/designs/'.$designToken.'/decision', [
            'decision' => 'request_revision',
            'note' => 'Perbaiki ukuran logo.',
        ])->assertOk()->assertJsonPath('status', 'revision_requested');

        $this->assertDatabaseHas('order_item_designs', [
            'order_item_id' => $workOrder->order_item_id,
            'status' => 'revision_requested',
            'customer_note' => 'Perbaiki ukuran logo.',
        ]);
        $this->assertDatabaseHas('work_orders', [
            'id' => $workOrder->id,
            'status' => 'design_revision',
        ]);
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

        return $query['quote'] ?? $query['design'] ?? '';
    }
}
