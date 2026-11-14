<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderCustomerFile;
use App\Models\OrderItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class OrderCustomerFileController extends Controller
{
    public function createUploadLink(Request $request, Order $order)
    {
        $this->authorizeBranch($request, $order);
        abort_if(
            in_array($order->status, ['cancelled', 'ready_for_confirmation', 'completed'], true),
            409,
            'Pesanan ini tidak dapat menerima file baru.',
        );

        $token = Str::random(64);
        $order->update([
            'customer_upload_token_hash' => hash('sha256', $token),
            'customer_upload_token_expires_at' => now()->addDays(30),
        ]);

        return response()->json([
            'message' => 'Tautan unggah pelanggan berlaku selama 30 hari.',
            'upload_url' => url('/?upload='.urlencode($token)),
            'expires_at' => $order->customer_upload_token_expires_at,
        ]);
    }

    public function showPublic(string $token)
    {
        $order = $this->findOrderByToken($token)->load(['customer:id,name', 'items:id,order_id,product_name']);

        return response()->json([
            'data' => [
                'order_number' => $order->order_number,
                'customer_name' => $order->customer?->name ?? 'Pelanggan',
                'items' => $order->items->map(fn (OrderItem $item) => [
                    'id' => $item->id,
                    'product_name' => $item->product_name,
                ]),
            ],
        ]);
    }

    public function storePublic(Request $request, string $token)
    {
        $order = $this->findOrderByToken($token);
        abort_if(
            in_array($order->status, ['cancelled', 'ready_for_confirmation', 'completed'], true),
            409,
            'Pesanan ini tidak dapat menerima file baru.',
        );

        $validated = $request->validate([
            'files' => ['required', 'array', 'min:1', 'max:5'],
            'files.*' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:20480'],
            'order_item_id' => ['nullable', 'integer', Rule::exists('order_items', 'id')],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        if (isset($validated['order_item_id'])) {
            abort_unless(
                $order->items()->whereKey($validated['order_item_id'])->exists(),
                422,
                'Item file tidak sesuai dengan pesanan ini.',
            );
        }

        $storedPaths = [];

        try {
            $records = collect($validated['files'])->map(function ($file) use ($order, $validated, &$storedPaths) {
                $fileName = Str::uuid().'.'.$file->extension();
                $path = $file->storeAs('customer-uploads/'.$order->id, $fileName, 'local');
                if (! $path) {
                    throw new \RuntimeException('File pelanggan gagal disimpan.');
                }
                $storedPaths[] = $path;

                return [
                    'order_id' => $order->id,
                    'order_item_id' => $validated['order_item_id'] ?? null,
                    'file_path' => $path,
                    'original_filename' => mb_substr($file->getClientOriginalName(), 0, 255),
                    'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
                    'file_size' => $file->getSize(),
                    'note' => $validated['note'] ?? null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            });

            DB::table('order_customer_files')->insert($records->all());
        } catch (\Throwable $exception) {
            Storage::disk('local')->delete($storedPaths);
            throw $exception;
        }

        return response()->json([
            'message' => 'File berhasil dikirim kepada tim percetakan.',
            'uploaded' => $records->count(),
        ], 201);
    }

    public function file(Request $request, Order $order, OrderCustomerFile $customerFile)
    {
        abort_unless(
            $request->user()->can('orders.view') || $request->user()->can('production.view'),
            403,
        );
        $this->authorizeBranch($request, $order);
        abort_unless((int) $customerFile->order_id === (int) $order->id, 404);

        $path = Storage::disk('local')->path($customerFile->file_path);
        abort_unless(is_file($path), 404, 'File pelanggan tidak ditemukan.');

        return response()->download($path, $customerFile->original_filename, [
            'Content-Type' => $customerFile->mime_type,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    private function findOrderByToken(string $token): Order
    {
        return Order::query()
            ->where('customer_upload_token_hash', hash('sha256', $token))
            ->where('customer_upload_token_expires_at', '>', now())
            ->whereNotIn('status', ['cancelled', 'ready_for_confirmation', 'completed'])
            ->firstOrFail();
    }

    private function authorizeBranch(Request $request, Order $order): void
    {
        $user = $request->user();
        if (! $user->branch_id || $user->hasGlobalBranchAccess()) {
            return;
        }

        $canViewOrder = $user->can('orders.view')
            && (int) $user->branch_id === (int) $order->branch_id;
        $canViewProduction = $user->can('production.view')
            && $order->workOrders()
                ->where('production_branch_id', $user->branch_id)
                ->exists();

        abort_unless($canViewOrder || $canViewProduction, 404);
    }
}
