<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FinishingType;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $user = $request->user();

        $orders = Order::with(['customer', 'branch', 'creator'])
            ->when($user->branch_id, function ($query) use ($user) {
                $query->where('branch_id', $user->branch_id);
            })
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('order_number', 'like', "%{$search}%")
                        ->orWhereHas('customer', function ($customerQuery) use ($search) {
                            $customerQuery->where('name', 'like', "%{$search}%");
                        });
                });
            })
            ->when($request->status, fn ($q, $status) => $q->where('status', $status))
            ->when($request->payment_status, fn ($q, $status) => $q->where('payment_status', $status))
            ->latest()
            ->paginate($validated['per_page'] ?? 15);

        return response()->json($orders);
    }

    public function show(Request $request, Order $order)
    {
        $this->authorizeBranch($request, $order);

        return response()->json([
            'data' => $order->load([
                'customer',
                'branch',
                'creator',
                'items.product',
                'items.finishings',
                'payments.receiver',
            ]),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'customer_id' => ['nullable', 'exists:customers,id'],
            'branch_id' => ['nullable', 'exists:branches,id'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'due_date' => ['nullable', 'date'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'items.*.width' => ['nullable', 'numeric', 'min:0.01'],
            'items.*.height' => ['nullable', 'numeric', 'min:0.01'],
            'items.*.specifications' => ['nullable', 'string'],
            'items.*.notes' => ['nullable', 'string'],
            'items.*.finishing_type_ids' => ['sometimes', 'array'],
            'items.*.finishing_type_ids.*' => [
                'integer',
                'distinct',
                Rule::exists('finishing_types', 'id')->where(
                    fn ($query) => $query
                        ->where('is_active', true)
                        ->whereNull('deleted_at'),
                ),
            ],
        ]);

        $user = $request->user();
        $approvalToken = Str::random(64);

        // Pengguna cabang tidak boleh membuat transaksi untuk cabang lain.
        $branchId = $user->branch_id ?: ($validated['branch_id'] ?? null);

        $order = DB::transaction(function () use ($validated, $user, $branchId, $approvalToken) {
            $preparedItems = [];
            $subtotal = 0;

            foreach ($validated['items'] as $item) {
                $product = Product::with('unit')
                    ->lockForUpdate()
                    ->findOrFail($item['product_id']);

                if (! $product->is_active) {
                    throw ValidationException::withMessages([
                        'items' => ["Produk {$product->name} sedang tidak aktif."],
                    ]);
                }

                $quantity = (float) $item['quantity'];
                $unitPrice = (float) $product->selling_price;
                $unitCost = (float) $product->estimated_cost;
                $finishingTypes = FinishingType::query()
                    ->whereIn('id', $item['finishing_type_ids'] ?? [])
                    ->where('is_active', true)
                    ->lockForUpdate()
                    ->get();

                if ($finishingTypes->count() !== count($item['finishing_type_ids'] ?? [])) {
                    throw ValidationException::withMessages([
                        'items' => ['Jenis finishing yang dipilih sudah tidak aktif.'],
                    ]);
                }

                $finishingUnitCost = $finishingTypes->sum(
                    fn (FinishingType $finishingType) => (float) $finishingType->default_cost,
                );

                // Perhitungan awal berdasarkan kuantitas x harga satuan.
                // Dimensi hanya disimpan sebagai spesifikasi.
                $itemSubtotal = round($quantity * $unitPrice, 2);

                $subtotal += $itemSubtotal;

                $preparedItems[] = [
                    'attributes' => [
                        'product_id' => $product->id,
                        'product_code' => $product->product_code,
                        'product_name' => $product->name,
                        'unit_name' => $product->unit?->name,
                        'quantity' => $quantity,
                        'width' => $item['width'] ?? null,
                        'height' => $item['height'] ?? null,
                        'unit_price' => $unitPrice,
                        'unit_cost' => round($unitCost + $finishingUnitCost, 2),
                        'subtotal' => $itemSubtotal,
                        'specifications' => $item['specifications'] ?? null,
                        'notes' => $item['notes'] ?? null,
                    ],
                    'finishings' => $finishingTypes->map(fn (FinishingType $finishingType) => [
                        'finishing_type_id' => $finishingType->id,
                        'finishing_name' => $finishingType->name,
                        'finishing_code' => $finishingType->code,
                        'unit_cost' => $finishingType->default_cost,
                    ])->all(),
                ];
            }

            $subtotal = round($subtotal, 2);
            $discount = round((float) ($validated['discount'] ?? 0), 2);

            if ($discount > $subtotal) {
                throw ValidationException::withMessages([
                    'discount' => ['Diskon tidak boleh melebihi subtotal.'],
                ]);
            }

            $total = round($subtotal - $discount, 2);

            $order = Order::create([
                'order_number' => 'TMP-'.Str::uuid(),
                'quote_status' => 'pending',
                'quote_approval_token_hash' => hash('sha256', $approvalToken),
                'branch_id' => $branchId,
                'customer_id' => $validated['customer_id'] ?? null,
                'created_by' => $user->id,
                'subtotal' => $subtotal,
                'discount' => $discount,
                'total' => $total,
                'paid_amount' => 0,
                'balance' => $total,
                'status' => 'pending',
                'payment_status' => $total > 0 ? 'unpaid' : 'paid',
                'notes' => $validated['notes'] ?? null,
                'due_date' => $validated['due_date'] ?? null,
            ]);

            $order->update([
                'order_number' => 'PF-'.now()->format('Y').'-'.
                    str_pad($order->id, 6, '0', STR_PAD_LEFT),
            ]);

            foreach ($preparedItems as $preparedItem) {
                $orderItem = $order->items()->create($preparedItem['attributes']);
                $orderItem->finishings()->createMany($preparedItem['finishings']);
            }

            return $order;
        });

        return response()->json([
            'message' => 'Pesanan berhasil dibuat.',
            'approval_url' => url('/?quote='.urlencode($approvalToken)),
            'data' => $order->load([
                'customer',
                'branch',
                'creator',
                'items.finishings',
            ]),
        ], 201);
    }

    public function approvalLink(Request $request, Order $order)
    {
        $this->authorizeBranch($request, $order);

        abort_unless(
            $order->quote_status === 'pending',
            409,
            'Tautan persetujuan hanya dapat dibuat untuk penawaran yang menunggu jawaban.',
        );

        $approvalToken = Str::random(64);
        $order->update([
            'quote_approval_token_hash' => hash('sha256', $approvalToken),
        ]);

        return response()->json([
            'approval_url' => url('/?quote='.urlencode($approvalToken)),
        ]);
    }

    private function authorizeBranch(Request $request, Order $order): void
    {
        $user = $request->user();

        if (
            $user->branch_id &&
            (int) $user->branch_id !== (int) $order->branch_id
        ) {
            abort(404);
        }
    }
}
