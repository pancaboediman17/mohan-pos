<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
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
            ->when($user->branch_id, function ($query) use ($user) {
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
                (int) $user->branch_id !== (int) $order->branch_id
            ) {
                abort(404);
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

            $payment = Payment::create([
                'payment_number' => 'TMP-' . Str::uuid(),
                'order_id' => $order->id,
                'received_by' => $user->id,
                'amount' => $amount,
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
}
