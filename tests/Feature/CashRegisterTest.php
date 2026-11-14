<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CashRegisterTest extends TestCase
{
    use RefreshDatabase;

    public function test_cashier_shift_tracks_payments_and_reconciles_cash_on_close(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $branch = Branch::create(['code' => 'KSR', 'name' => 'Cabang Kasir']);
        $cashier = User::factory()->create(['branch_id' => $branch->id]);
        $cashier->assignRole('Kasir');

        $order = $this->createOrder($cashier, $branch);

        $this->actingAs($cashier)
            ->postJson('/api/v1/cash-register/open', [
                'opening_cash' => 10000,
                'opening_notes' => 'Modal awal',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'open')
            ->assertJsonPath('data.expected_cash', 10000);

        $this->postJson('/api/v1/cash-register/open', ['opening_cash' => 5000])
            ->assertStatus(409);

        $cashPayment = $this->postJson('/api/v1/payments', [
            'order_id' => $order->id,
            'amount' => 2500,
            'method' => 'cash',
        ])->assertCreated();

        $this->postJson('/api/v1/payments', [
            'order_id' => $order->id,
            'amount' => 1500,
            'method' => 'qris',
        ])->assertCreated();

        $this->assertNotNull($cashPayment->json('data.cash_register_shift_id'));
        $this->assertDatabaseCount('payments', 2);

        $this->getJson('/api/v1/cash-register?date='.today()->toDateString())
            ->assertOk()
            ->assertJsonPath('data.current_shift.payment_count', 2)
            ->assertJsonPath('data.current_shift.cash_received', 2500)
            ->assertJsonPath('data.current_shift.total_received', 4000)
            ->assertJsonPath('data.current_shift.expected_cash', 12500)
            ->assertJsonPath('data.daily_report.order_count', 1)
            ->assertJsonPath('data.daily_report.order_value', 10000)
            ->assertJsonPath('data.daily_report.payment_count', 2)
            ->assertJsonPath('data.daily_report.payments_received', 4000)
            ->assertJsonPath('data.daily_report.cash_received', 2500);

        $this->postJson('/api/v1/cash-register/close', [
            'closing_cash' => 12400,
            'closing_notes' => 'Selisih Rp100',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'closed')
            ->assertJsonPath('data.expected_cash', 12500)
            ->assertJsonPath('data.closing_cash', 12400)
            ->assertJsonPath('data.cash_variance', -100)
            ->assertJsonPath('data.total_received', 4000);

        $this->getJson('/api/v1/cash-register?date='.today()->toDateString())
            ->assertOk()
            ->assertJsonPath('data.current_shift', null)
            ->assertJsonPath('data.shifts.0.status', 'closed')
            ->assertJsonPath('data.shifts.0.cash_variance', -100);
    }

    public function test_cashier_cannot_accept_a_payment_without_opening_a_shift(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $branch = Branch::create(['code' => 'NO-CASH', 'name' => 'Cabang Belum Buka']);
        $cashier = User::factory()->create(['branch_id' => $branch->id]);
        $cashier->assignRole('Kasir');
        $order = $this->createOrder($cashier, $branch);

        $this->actingAs($cashier)
            ->postJson('/api/v1/payments', [
                'order_id' => $order->id,
                'amount' => 1000,
                'method' => 'cash',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('shift');

        $this->assertDatabaseCount('payments', 0);
    }

    private function createOrder(User $cashier, Branch $branch): Order
    {
        return Order::create([
            'order_number' => 'PF-CASH-001',
            'branch_id' => $branch->id,
            'created_by' => $cashier->id,
            'subtotal' => 10000,
            'discount' => 0,
            'total' => 10000,
            'paid_amount' => 0,
            'balance' => 10000,
            'status' => 'pending',
            'payment_status' => 'unpaid',
        ]);
    }
}
