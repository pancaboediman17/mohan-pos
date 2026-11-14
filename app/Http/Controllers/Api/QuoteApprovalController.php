<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Order;
use App\Models\WorkOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class QuoteApprovalController extends Controller
{
    public function show(string $token)
    {
        $order = $this->findPendingQuote($token);
        $order->load(['customer', 'branch', 'items.finishings']);

        return response()->json([
            'data' => [
                'order_number' => $order->order_number,
                'created_at' => $order->created_at,
                'due_date' => $order->due_date,
                'branch' => $order->branch,
                'customer_name' => $order->customer?->name ?? 'Pelanggan Umum',
                'subtotal' => $order->subtotal,
                'discount' => $order->discount,
                'total' => $order->total,
                'items' => $order->items->map(fn ($item) => [
                    'id' => $item->id,
                    'product_code' => $item->product_code,
                    'product_name' => $item->product_name,
                    'quantity' => $item->quantity,
                    'unit_name' => $item->unit_name,
                    'unit_price' => $item->unit_price,
                    'subtotal' => $item->subtotal,
                    'width' => $item->width,
                    'height' => $item->height,
                    'specifications' => $item->specifications,
                    'finishings' => $item->finishings->map(fn ($finishing) => [
                        'finishing_name' => $finishing->finishing_name,
                    ]),
                ]),
            ],
        ]);
    }

    public function decide(Request $request, string $token)
    {
        $validated = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'reject'])],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);
        $tokenHash = hash('sha256', $token);

        DB::transaction(function () use ($tokenHash, $validated) {
            $order = Order::query()
                ->where('quote_approval_token_hash', $tokenHash)
                ->lockForUpdate()
                ->firstOrFail();

            abort_unless(
                $order->quote_status === 'pending',
                410,
                'Penawaran ini sudah tidak menunggu persetujuan.',
            );

            $approved = $validated['decision'] === 'approve';
            $order->update([
                'quote_status' => $approved ? 'approved' : 'rejected',
                'quote_approval_token_hash' => null,
                'quote_approved_at' => $approved ? now() : null,
                'quote_rejected_at' => $approved ? null : now(),
                'quote_response_note' => $validated['note'] ?? null,
            ]);

            if ($approved) {
                $this->createWorkOrders($order);
            }
        });

        return response()->json([
            'message' => $validated['decision'] === 'approve'
                ? 'Penawaran berhasil disetujui.'
                : 'Penawaran ditolak.',
            'quote_status' => $validated['decision'] === 'approve' ? 'approved' : 'rejected',
        ]);
    }

    public function confirmMarketplace(Request $request, Order $order)
    {
        $this->authorizeBranch($request, $order);
        $validated = $request->validate([
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $confirmedOrder = DB::transaction(function () use ($order, $validated) {
            $lockedOrder = Order::query()->lockForUpdate()->findOrFail($order->id);

            abort_if(
                $lockedOrder->sales_channel === 'pos',
                409,
                'Konfirmasi staf hanya berlaku untuk pesanan marketplace.',
            );
            abort_unless(
                $lockedOrder->quote_status === 'pending' && $lockedOrder->status !== 'cancelled',
                409,
                'Pesanan marketplace ini tidak lagi menunggu tinjauan.',
            );

            $lockedOrder->update([
                'quote_status' => 'approved',
                'quote_approval_token_hash' => null,
                'quote_approved_at' => now(),
                'quote_rejected_at' => null,
                'quote_response_note' => $validated['note'] ?? null,
            ]);
            $this->createWorkOrders($lockedOrder);

            return $lockedOrder;
        });

        return response()->json([
            'message' => 'Pesanan marketplace disetujui dan diteruskan ke alur desain.',
            'data' => $confirmedOrder->load(['customer', 'branch', 'items', 'shipment']),
        ]);
    }

    private function findPendingQuote(string $token): Order
    {
        $order = Order::query()
            ->where('quote_approval_token_hash', hash('sha256', $token))
            ->firstOrFail();

        abort_unless(
            $order->quote_status === 'pending',
            410,
            'Penawaran ini sudah tidak menunggu persetujuan.',
        );

        return $order;
    }

    private function createWorkOrders(Order $order): void
    {
        $productionBranchId = Branch::query()
            ->where('is_active', true)
            ->where('is_production_hub', true)
            ->orderBy('id')
            ->value('id');

        $order->items()->pluck('id')->each(function (int $orderItemId) use ($order, $productionBranchId) {
            WorkOrder::query()->firstOrCreate(
                ['order_item_id' => $orderItemId],
                [
                    'order_id' => $order->id,
                    'production_branch_id' => $productionBranchId,
                    'status' => 'waiting_design',
                ],
            );
        });
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
