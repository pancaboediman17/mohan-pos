<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductionMachine;
use App\Models\Unit;
use App\Models\User;
use App\Models\WorkOrder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkOrderTest extends TestCase
{
    use RefreshDatabase;

    public function test_quote_approval_creates_item_work_order_and_production_advances_in_order(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $hub = Branch::create([
            'code' => 'PUSAT',
            'name' => 'Produksi Pusat',
            'is_production_hub' => true,
            'is_active' => true,
        ]);
        $cashier = User::factory()->create();
        $cashier->assignRole('Kasir');

        $created = $this->actingAs($cashier)->postJson('/api/v1/orders', [
            'items' => [[
                'product_id' => $this->createProduct()->id,
                'quantity' => 1,
            ], [
                'product_id' => $this->createProduct('CETAK-002')->id,
                'quantity' => 3,
            ]],
        ])->assertCreated();
        $token = $this->tokenFromUrl($created->json('approval_url'));

        $this->postJson('/api/v1/public/quotes/'.$token.'/decision', [
            'decision' => 'approve',
        ])->assertOk();

        $this->assertDatabaseCount('work_orders', 2);
        $workOrder = WorkOrder::query()->firstOrFail();
        $this->assertSame($hub->id, $workOrder->production_branch_id);
        $this->assertSame('waiting_design', $workOrder->status);

        $this->actingAs($cashier)
            ->postJson('/api/v1/orders/'.$workOrder->order_id.'/confirm-completion')
            ->assertStatus(409);

        $operator = User::factory()->create(['branch_id' => $hub->id]);
        $operator->assignRole('Operator Produksi');
        $this->actingAs($operator)
            ->getJson('/api/v1/work-orders')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.status', 'waiting_design')
            ->assertJsonPath('summary.waiting_design', 2);

        $machine = ProductionMachine::create([
            'branch_id' => $hub->id,
            'machine_code' => 'PRN-01',
            'name' => 'Printer Digital 01',
            'hourly_cost' => 0,
            'is_active' => true,
        ]);

        WorkOrder::query()->update(['status' => 'queued']);
        $this->patchJson('/api/v1/work-orders/'.$workOrder->id, [
            'status' => 'printing',
        ])->assertStatus(409);
        $this->patchJson('/api/v1/work-orders/'.$workOrder->id, [
            'status' => 'accepted',
        ])->assertOk()->assertJsonPath('data.status', 'accepted');
        $this->patchJson('/api/v1/work-orders/'.$workOrder->id, [
            'status' => 'printing',
        ])->assertUnprocessable();

        foreach (WorkOrder::query()->get() as $itemWorkOrder) {
            $this->patchJson('/api/v1/work-orders/'.$itemWorkOrder->id, [
                'production_machine_id' => $machine->id,
            ])->assertOk();

            if ($itemWorkOrder->fresh()->status === 'queued') {
                $this->patchJson('/api/v1/work-orders/'.$itemWorkOrder->id, [
                    'status' => 'accepted',
                ])->assertOk()->assertJsonPath('data.status', 'accepted');
            }

            foreach ([
                'printing',
                'finishing',
                'quality_check',
                'ready',
                'completed',
            ] as $status) {
                $this->patchJson('/api/v1/work-orders/'.$itemWorkOrder->id, [
                    'status' => $status,
                ])->assertOk()->assertJsonPath('data.status', $status);
            }
        }

        $this->assertDatabaseHas('orders', [
            'id' => $workOrder->order_id,
            'status' => 'ready_for_confirmation',
        ]);
        $this->assertNotNull($workOrder->fresh()->started_at);
        $this->assertNotNull($workOrder->fresh()->completed_at);

        $this->actingAs($cashier)
            ->postJson('/api/v1/orders/'.$workOrder->order_id.'/confirm-completion')
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');
        $this->assertDatabaseHas('orders', [
            'id' => $workOrder->order_id,
            'status' => 'completed',
            'completed_confirmed_by' => $cashier->id,
        ]);
    }

    private function createProduct(string $code = 'CETAK-001'): Product
    {
        static $counter = 0;
        $counter++;
        $category = ProductCategory::firstOrCreate([
            'slug' => 'cetak',
        ], [
            'name' => 'Cetak',
            'is_active' => true,
        ]);
        $unit = Unit::firstOrCreate([
            'symbol' => 'lbr',
        ], [
            'name' => 'Lembar',
            'is_active' => true,
        ]);

        return Product::create([
            'product_category_id' => $category->id,
            'unit_id' => $unit->id,
            'product_code' => $code,
            'name' => 'Cetak Poster '.$counter,
            'selling_price' => 20000,
            'estimated_cost' => 10000,
            'is_active' => true,
        ]);
    }

    private function tokenFromUrl(string $url): string
    {
        parse_str(parse_url($url, PHP_URL_QUERY) ?? '', $query);

        return $query['quote'] ?? '';
    }
}
