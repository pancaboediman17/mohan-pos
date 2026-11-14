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
        });

        return response()->json([
            'message' => $validated['decision'] === 'approve'
                ? 'Penawaran berhasil disetujui.'
                : 'Penawaran ditolak.',
            'quote_status' => $validated['decision'] === 'approve' ? 'approved' : 'rejected',
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
}
