<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    public function index(Request $request)
    {
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
            ->paginate(15);

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
        ]);

        $user = $request->user();

        // Pengguna cabang tidak boleh membuat transaksi untuk cabang lain.
        $branchId = $user->branch_id ?: ($validated['branch_id'] ?? null);

        $order = DB::transaction(function () use ($validated, $user, $branchId) {
            $preparedItems = [];
            $subtotal = 0;

            foreach ($validated['items'] as $item) {
                $product = Product::with('unit')
                    ->lockForUpdate()
                    ->findOrFail($item['product_id']);

                if (!$product->is_active) {
                    throw ValidationException::withMessages([
                        'items' => ["Produk {$product->name} sedang tidak aktif."],
                    ]);
                }

                $quantity = (float) $item['quantity'];
                $unitPrice = (float) $product->selling_price;
                $unitCost = (float) $product->estimated_cost;

                // Perhitungan awal berdasarkan kuantitas x harga satuan.
                // Dimensi hanya disimpan sebagai spesifikasi.
                $itemSubtotal = round($quantity * $unitPrice, 2);

                $subtotal += $itemSubtotal;

                $preparedItems[] = [
                    'product_id' => $product->id,
                    'product_code' => $product->product_code,
                    'product_name' => $product->name,
                    'unit_name' => $product->unit?->name,
                    'quantity' => $quantity,
                    'width' => $item['width'] ?? null,
                    'height' => $item['height'] ?? null,
                    'unit_price' => $unitPrice,
                    'unit_cost' => $unitCost,
                    'subtotal' => $itemSubtotal,
                    'specifications' => $item['specifications'] ?? null,
                    'notes' => $item['notes'] ?? null,
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
                'order_number' => 'TMP-' . Str::uuid(),
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
                'order_number' => 'PF-' . now()->format('Y') . '-' .
                    str_pad($order->id, 6, '0', STR_PAD_LEFT),
            ]);

            $order->items()->createMany($preparedItems);

            return $order;
        });

        return response()->json([
            'message' => 'Pesanan berhasil dibuat.',
            'data' => $order->load(['customer', 'branch', 'creator', 'items']),
        ], 201);
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
