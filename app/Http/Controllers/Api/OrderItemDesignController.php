<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\OrderItem;
use App\Models\OrderItemDesign;
use App\Models\WorkOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class OrderItemDesignController extends Controller
{
    public function store(Request $request, OrderItem $orderItem)
    {
        $validated = $request->validate([
            'design_file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:20480'],
        ]);
        $orderItem->load('order');
        $this->authorizeBranch($request, $orderItem);

        abort_unless(
            $orderItem->order->quote_status === 'approved',
            409,
            'Desain hanya dapat dikirim setelah penawaran disetujui.',
        );

        $workOrder = $orderItem->workOrder;
        if ($workOrder) {
            abort_unless(
                in_array($workOrder->status, ['waiting_design', 'design_approval', 'design_revision'], true),
                409,
                'Desain tidak dapat diubah setelah produksi dimulai.',
            );
        }

        $file = $validated['design_file'];
        $fileName = Str::uuid().'.'.$file->extension();
        $path = $file->storeAs('designs/'.$orderItem->id, $fileName, 'local');
        if (! $path) {
            throw new \RuntimeException('File desain gagal disimpan.');
        }

        $token = Str::random(64);

        try {
            $design = DB::transaction(function () use ($request, $orderItem, $file, $path, $token) {
                $lockedItem = OrderItem::query()->lockForUpdate()->findOrFail($orderItem->id);
                $version = ((int) $lockedItem->designs()->max('version')) + 1;
                $workOrder = WorkOrder::query()
                    ->where('order_item_id', $lockedItem->id)
                    ->lockForUpdate()
                    ->first();

                if ($workOrder) {
                    abort_unless(
                        in_array($workOrder->status, ['waiting_design', 'design_approval', 'design_revision'], true),
                        409,
                        'Desain tidak dapat diubah setelah produksi dimulai.',
                    );
                }

                $lockedItem->designs()
                    ->where('status', 'pending_approval')
                    ->update([
                        'status' => 'superseded',
                        'approval_token_hash' => null,
                    ]);

                $design = $lockedItem->designs()->create([
                    'uploaded_by' => $request->user()->id,
                    'version' => $version,
                    'file_path' => $path,
                    'original_filename' => mb_substr($file->getClientOriginalName(), 0, 255),
                    'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
                    'file_size' => $file->getSize(),
                    'status' => 'pending_approval',
                    'approval_token_hash' => hash('sha256', $token),
                ]);

                $hubId = Branch::query()
                    ->where('is_active', true)
                    ->where('is_production_hub', true)
                    ->orderBy('id')
                    ->value('id');

                $workOrder = WorkOrder::query()->firstOrCreate(
                    ['order_item_id' => $lockedItem->id],
                    [
                        'order_id' => $lockedItem->order_id,
                        'production_branch_id' => $hubId,
                        'status' => 'waiting_design',
                    ],
                );
                $workOrder->update(['status' => 'design_approval']);

                return $design;
            });
        } catch (\Throwable $exception) {
            Storage::disk('local')->delete($path);
            throw $exception;
        }

        return response()->json([
            'message' => 'Desain berhasil diunggah untuk persetujuan pelanggan.',
            'approval_url' => url('/?design='.urlencode($token)),
            'data' => $design,
        ], 201);
    }

    public function reissueLink(Request $request, OrderItem $orderItem)
    {
        abort_unless($request->user()->can('designs.manage'), 403);
        $orderItem->load('order');
        $this->authorizeBranch($request, $orderItem);
        abort_unless(
            $orderItem->order->quote_status === 'approved',
            409,
            'Tautan desain hanya dapat dibuat setelah penawaran disetujui.',
        );

        $design = $orderItem->designs()
            ->where('status', 'pending_approval')
            ->latest('version')
            ->firstOrFail();
        $token = Str::random(64);
        $design->update(['approval_token_hash' => hash('sha256', $token)]);

        return response()->json([
            'message' => 'Tautan persetujuan desain berhasil dibuat.',
            'approval_url' => url('/?design='.urlencode($token)),
        ]);
    }

    public function showPublic(string $token)
    {
        $design = OrderItemDesign::query()
            ->where('approval_token_hash', hash('sha256', $token))
            ->with(['item.order.customer'])
            ->firstOrFail();

        return response()->json([
            'data' => [
                'order_number' => $design->item->order->order_number,
                'customer_name' => $design->item->order->customer?->name ?? 'Pelanggan Umum',
                'product_name' => $design->item->product_name,
                'quantity' => $design->item->quantity,
                'unit_name' => $design->item->unit_name,
                'width' => $design->item->width,
                'height' => $design->item->height,
                'specifications' => $design->item->specifications,
                'version' => $design->version,
                'original_filename' => $design->original_filename,
                'mime_type' => $design->mime_type,
                'status' => $design->status,
                'customer_note' => $design->customer_note,
                'file_url' => url('/api/v1/public/designs/'.$token.'/file'),
            ],
        ]);
    }

    public function file(string $token)
    {
        $design = OrderItemDesign::query()
            ->where('approval_token_hash', hash('sha256', $token))
            ->firstOrFail();
        $path = Storage::disk('local')->path($design->file_path);
        abort_unless(is_file($path), 404, 'File desain tidak ditemukan.');

        return response()->file($path, [
            'Content-Type' => $design->mime_type,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function decide(Request $request, string $token)
    {
        $validated = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'request_revision'])],
            'note' => ['required_if:decision,request_revision', 'nullable', 'string', 'max:1000'],
        ]);
        $tokenHash = hash('sha256', $token);

        DB::transaction(function () use ($tokenHash, $validated) {
            $design = OrderItemDesign::query()
                ->where('approval_token_hash', $tokenHash)
                ->lockForUpdate()
                ->firstOrFail();

            abort_unless(
                $design->status === 'pending_approval',
                410,
                'Desain ini sudah tidak menunggu persetujuan.',
            );

            $approved = $validated['decision'] === 'approve';
            $design->update([
                'status' => $approved ? 'approved' : 'revision_requested',
                'customer_note' => $validated['note'] ?? null,
                'approved_at' => $approved ? now() : null,
                'decided_at' => now(),
            ]);

            $design->item->workOrder()->update([
                'status' => $approved ? 'queued' : 'design_revision',
            ]);
        });

        return response()->json([
            'message' => $validated['decision'] === 'approve'
                ? 'Desain berhasil disetujui.'
                : 'Permintaan revisi desain berhasil dikirim.',
            'status' => $validated['decision'] === 'approve' ? 'approved' : 'revision_requested',
        ]);
    }

    private function authorizeBranch(Request $request, OrderItem $orderItem): void
    {
        $user = $request->user();
        $branchId = $orderItem->workOrder?->production_branch_id
            ?? $orderItem->order->branch_id;

        abort_if(
            $user->branch_id &&
                ! $user->hasGlobalBranchAccess() &&
                $branchId !== $user->branch_id,
            403,
            'Desain pesanan ini berada di cabang lain.',
        );
    }
}
