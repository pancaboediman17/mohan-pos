<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Order;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentReceiptTest extends TestCase
{
    use RefreshDatabase;

    public function test_successful_payment_returns_the_receipt_details(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $branch = Branch::create([
            'code' => 'STRUK',
            'name' => 'Cabang Struk',
            'address' => 'Jl. Contoh No. 1',
            'phone' => '021123456',
        ]);
        $cashier = User::factory()->create(['branch_id' => $branch->id]);
        $cashier->assignRole('Kasir');

        $this->actingAs($cashier)
            ->postJson('/api/v1/cash-register/open', ['opening_cash' => 100000])
            ->assertCreated();

        $order = Order::create([
            'order_number' => 'PF-RECEIPT-001',
            'branch_id' => $branch->id,
            'created_by' => $cashier->id,
            'subtotal' => 1000,
            'discount' => 0,
            'total' => 1000,
            'paid_amount' => 0,
            'balance' => 1000,
            'status' => 'pending',
            'payment_status' => 'unpaid',
        ]);

        $response = $this->actingAs($cashier)
            ->postJson('/api/v1/payments', [
                'order_id' => $order->id,
                'amount' => 400,
                'method' => 'cash',
            ]);

        $response->assertCreated()
            ->assertJsonPath('data.order.order_number', 'PF-RECEIPT-001')
            ->assertJsonPath('data.order.branch.name', 'Cabang Struk')
            ->assertJsonPath('data.order.payment_status', 'partial')
            ->assertJsonPath('data.receiver.name', $cashier->name);

        $this->assertEquals(400, (float) $response->json('data.order.paid_amount'));
        $this->assertEquals(600, (float) $response->json('data.order.balance'));
        $this->assertStringStartsWith(
            'PAY-'.now()->format('Y').'-',
            $response->json('data.payment_number'),
        );
    }
}
