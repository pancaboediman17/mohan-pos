<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashRegisterShift;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PaymentController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $payments = Payment::with(['order.customer', 'order.branch', 'receiver'])
            ->when($user->branch_id && ! $user->hasGlobalBranchAccess(), function ($query) use ($user) {
                $query->whereHas('order', function ($q) use ($user) {
                    $q->where('branch_id', $user->branch_id);
                });
            })
            ->when($request->order_id, function ($query, $orderId) {
                $query->where('order_id', $orderId);
            })
            ->latest('paid_at')
            ->paginate(15);

        return response()->json($payments);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'order_id' => ['required', 'exists:orders,id'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'payment_type' => [
                'nullable',
                'in:full,down_payment,installment,settlement',
            ],
            'method' => [
                'required',
                'in:cash,transfer,qris,debit,credit,other',
            ],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
            'paid_at' => ['nullable', 'date'],
        ]);

        $user = $request->user();

        $payment = DB::transaction(function () use ($validated, $user) {
            $order = Order::whereKey($validated['order_id'])
                ->lockForUpdate()
                ->firstOrFail();

            if (
                $user->branch_id &&
                ! $user->hasGlobalBranchAccess() &&
                (int) $user->branch_id !== (int) $order->branch_id
            ) {
                abort(404);
            }

            $cashRegisterShift = null;
            if ($user->hasRole('Kasir') && ! $user->hasGlobalBranchAccess()) {
                User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
                $cashRegisterShift = CashRegisterShift::query()
                    ->where('active_user_id', $user->id)
                    ->lockForUpdate()
                    ->first();

                if (! $cashRegisterShift) {
                    throw ValidationException::withMessages([
                        'shift' => ['Buka kasir terlebih dahulu sebelum menerima pembayaran.'],
                    ]);
                }
            }

            if ($order->status === 'cancelled') {
                throw ValidationException::withMessages([
                    'order_id' => ['Pesanan yang dibatalkan tidak dapat menerima pembayaran.'],
                ]);
            }

            $amount = round((float) $validated['amount'], 2);
            $balance = round((float) $order->balance, 2);

            if ($amount > $balance) {
                throw ValidationException::withMessages([
                    'amount' => ['Jumlah pembayaran melebihi sisa tagihan.'],
                ]);
            }

            $paymentType = $validated['payment_type'] ?? (
                abs($amount - $balance) < 0.005
                    ? ((float) $order->paid_amount > 0 ? 'settlement' : 'full')
                    : ((float) $order->paid_amount > 0 ? 'installment' : 'down_payment')
            );
            $this->validatePaymentType($order, $amount, $balance, $paymentType);

            $payment = Payment::create([
                'payment_number' => 'TMP-' . Str::uuid(),
                'order_id' => $order->id,
                'received_by' => $user->id,
                'cash_register_shift_id' => $cashRegisterShift?->id,
                'amount' => $amount,
                'payment_type' => $paymentType,
                'method' => $validated['method'],
                'reference_number' => $validated['reference_number'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'paid_at' => $validated['paid_at'] ?? now(),
            ]);

            $payment->update([
                'payment_number' => 'PAY-' . now()->format('Y') . '-' .
                    str_pad($payment->id, 6, '0', STR_PAD_LEFT),
            ]);

            $newPaidAmount = round((float) $order->paid_amount + $amount, 2);
            $newBalance = round((float) $order->total - $newPaidAmount, 2);

            $order->update([
                'paid_amount' => $newPaidAmount,
                'balance' => max(0, $newBalance),
                'payment_status' => $newBalance <= 0 ? 'paid' : 'partial',
            ]);

            return $payment;
        });

        return response()->json([
            'message' => 'Pembayaran berhasil dicatat.',
            'data' => $payment->load([
                'order.customer',
                'order.branch',
                'receiver',
            ]),
        ], 201);
    }

    private function validatePaymentType(
        Order $order,
        float $amount,
        float $balance,
        string $paymentType,
    ): void {
        $hasPreviousPayment = (float) $order->paid_amount > 0;
        $paysRemainingBalance = abs($amount - $balance) < 0.005;

        $valid = match ($paymentType) {
            'full' => ! $hasPreviousPayment && $paysRemainingBalance,
            'down_payment' => ! $hasPreviousPayment && ! $paysRemainingBalance,
            'installment' => $hasPreviousPayment && ! $paysRemainingBalance,
            'settlement' => $hasPreviousPayment && $paysRemainingBalance,
            default => false,
        };

        if (! $valid) {
            throw ValidationException::withMessages([
                'payment_type' => ['Jenis pembayaran tidak sesuai dengan sisa tagihan.'],
            ]);
        }
    }
}
