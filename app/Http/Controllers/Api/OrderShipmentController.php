<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OrderShipmentController extends Controller
{
    private const STATUSES = [
        'pending',
        'booked',
        'picked_up',
        'in_transit',
        'delivered',
        'failed',
        'cancelled',
    ];

    public function update(Request $request, Order $order)
    {
        $this->authorizeBranch($request, $order);

        $validated = $request->validate([
            'recipient_name' => ['nullable', 'string', 'max:150'],
            'recipient_phone' => ['nullable', 'string', 'max:25'],
            'shipping_address' => ['nullable', 'string', 'max:2000'],
            'courier' => ['nullable', 'string', 'max:80'],
            'service_name' => ['nullable', 'string', 'max:80'],
            'tracking_number' => ['nullable', 'string', 'max:100'],
            'shipping_fee' => ['nullable', 'numeric', 'min:0'],
            'status' => ['required', Rule::in(self::STATUSES)],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        if (! collect([
            $validated['shipping_address'] ?? null,
            $validated['courier'] ?? null,
            $validated['tracking_number'] ?? null,
        ])->contains(fn ($value) => filled($value))) {
            throw ValidationException::withMessages([
                'shipment' => ['Isi alamat, nama kurir, atau nomor resi sebelum menyimpan pengiriman.'],
            ]);
        }

        $shipment = DB::transaction(function () use ($request, $order, $validated) {
            $lockedOrder = Order::query()->lockForUpdate()->findOrFail($order->id);
            $existing = $lockedOrder->shipment()->lockForUpdate()->first();
            $status = $validated['status'];
            $now = now();

            $timestamps = [
                'booked_at' => $existing?->booked_at,
                'shipped_at' => $existing?->shipped_at,
                'delivered_at' => $existing?->delivered_at,
            ];

            if (in_array($status, ['booked', 'picked_up', 'in_transit', 'delivered'], true)) {
                $timestamps['booked_at'] ??= $now;
            }
            if (in_array($status, ['picked_up', 'in_transit', 'delivered'], true)) {
                $timestamps['shipped_at'] ??= $now;
            }
            if ($status === 'delivered') {
                $timestamps['delivered_at'] ??= $now;
            }

            return $lockedOrder->shipment()->updateOrCreate([], [
                ...$validated,
                'shipping_fee' => $validated['shipping_fee'] ?? 0,
                'updated_by' => $request->user()->id,
                ...$timestamps,
            ]);
        });

        return response()->json([
            'message' => 'Informasi pengiriman berhasil disimpan.',
            'data' => $shipment,
        ]);
    }

    private function authorizeBranch(Request $request, Order $order): void
    {
        $user = $request->user();

        if (
            $user->branch_id &&
            ! $user->hasGlobalBranchAccess() &&
            (int) $user->branch_id !== (int) $order->branch_id
        ) {
            abort(404);
        }
    }
}
