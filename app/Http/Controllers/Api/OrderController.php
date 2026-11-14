<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashRegisterShift;
use App\Models\FinishingType;
use App\Models\Order;
use App\Models\OrderCustomerFile;
use App\Models\Payment;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
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

        $orders = Order::with(['customer', 'branch', 'creator', 'shipment'])
            ->when($user->branch_id && ! $user->hasGlobalBranchAccess(), function ($query) use ($user) {
                $query->where('branch_id', $user->branch_id);
            })
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('order_number', 'like', "%{$search}%")
                        ->orWhere('external_order_id', 'like', "%{$search}%")
                        ->orWhereHas('customer', function ($customerQuery) use ($search) {
                            $customerQuery->where('name', 'like', "%{$search}%");
                        })
                        ->orWhereHas('shipment', function ($shipmentQuery) use ($search) {
                            $shipmentQuery->where('recipient_name', 'like', "%{$search}%");
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
                'shipment',
                'customerFiles:id,order_id,order_item_id,original_filename,mime_type,file_size,note,created_at',
                'customerFiles.item:id,product_name',
            ]),
        ]);
    }

    public function confirmCompletion(Request $request, Order $order)
    {
        $this->authorizeBranch($request, $order);

        $confirmedOrder = DB::transaction(function () use ($request, $order) {
            $lockedOrder = Order::query()->lockForUpdate()->findOrFail($order->id);
            abort_unless(
                $lockedOrder->status === 'ready_for_confirmation',
                409,
                'Pesanan belum menunggu konfirmasi penyelesaian.',
            );

            $workOrderStatuses = $lockedOrder->workOrders()
                ->lockForUpdate()
                ->pluck('status');
            abort_unless(
                $workOrderStatuses->isNotEmpty()
                    && $workOrderStatuses->every(fn ($status) => $status === 'completed'),
                409,
                'Semua Work Order harus selesai sebelum pesanan dikonfirmasi.',
            );

            $lockedOrder->update([
                'status' => 'completed',
                'completed_confirmed_at' => now(),
                'completed_confirmed_by' => $request->user()->id,
            ]);

            return $lockedOrder;
        });

        return response()->json([
            'message' => 'Penyelesaian pesanan berhasil dikonfirmasi.',
            'data' => $confirmedOrder->load([
                'customer',
                'branch',
                'creator',
                'items.product',
                'items.finishings',
                'payments.receiver',
                'shipment',
                'customerFiles:id,order_id,order_item_id,original_filename,mime_type,file_size,note,created_at',
                'customerFiles.item:id,product_name',
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
            'order_type' => ['sometimes', Rule::in(['invoice', 'pos'])],
            'initial_payment' => [
                'prohibited_unless:order_type,pos',
                'required_if:order_type,pos',
                'array',
            ],
            'initial_payment.type' => [
                'required_if:order_type,pos',
                Rule::in(['full', 'down_payment']),
            ],
            'initial_payment.amount' => [
                'required_if:order_type,pos',
                'numeric',
                'gt:0',
            ],
            'initial_payment.method' => [
                'required_if:order_type,pos',
                Rule::in(['cash', 'transfer', 'qris', 'debit', 'credit', 'other']),
            ],
            'initial_payment.reference_number' => ['nullable', 'string', 'max:100'],
            'initial_payment.notes' => ['nullable', 'string', 'max:2000'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'items.*.width' => ['nullable', 'numeric', 'min:0.01'],
            'items.*.height' => ['nullable', 'numeric', 'min:0.01'],
            'items.*.specifications' => ['nullable', 'string'],
            'items.*.notes' => ['nullable', 'string'],
            'items.*.reference_image' => [
                'nullable',
                'file',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:10240',
            ],
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
        $orderType = $validated['order_type'] ?? 'invoice';
        if ($orderType === 'pos' && ! $user->can('payments.create')) {
            abort(403, 'Anda tidak memiliki izin menerima pembayaran.');
        }
        $approvalToken = Str::random(64);

        // Pengguna cabang tidak boleh membuat transaksi untuk cabang lain.
        $branchId = $user->hasGlobalBranchAccess()
            ? ($validated['branch_id'] ?? $user->branch_id)
            : ($user->branch_id ?: ($validated['branch_id'] ?? null));
        $storedPaths = [];

        try {
            $order = DB::transaction(function () use (
                $validated,
                $user,
                $branchId,
                $orderType,
                $approvalToken,
                &$storedPaths,
            ) {
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
                    'reference_image' => $item['reference_image'] ?? null,
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
                'order_type' => $orderType,
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

                if ($preparedItem['reference_image']) {
                    $image = $preparedItem['reference_image'];
                    $fileName = Str::uuid().'.'.$image->extension();
                    $path = $image->storeAs(
                        'customer-uploads/'.$order->id,
                        $fileName,
                        'local',
                    );

                    if (! $path) {
                        throw new \RuntimeException('Gambar referensi gagal disimpan.');
                    }

                    $storedPaths[] = $path;
                    OrderCustomerFile::create([
                        'order_id' => $order->id,
                        'order_item_id' => $orderItem->id,
                        'file_path' => $path,
                        'original_filename' => mb_substr(
                            $image->getClientOriginalName(),
                            0,
                            255,
                        ),
                        'mime_type' => $image->getMimeType() ?: 'application/octet-stream',
                        'file_size' => $image->getSize(),
                        'note' => 'Referensi item saat pesanan dibuat.',
                    ]);
                }
            }

            if ($orderType === 'pos') {
                $this->recordInitialPayment(
                    $order,
                    $user,
                    $validated['initial_payment'],
                );
            }

            return $order;
            });
        } catch (\Throwable $exception) {
            Storage::disk('local')->delete($storedPaths);
            throw $exception;
        }

        return response()->json([
            'message' => 'Pesanan berhasil dibuat.',
            'approval_url' => url('/?quote='.urlencode($approvalToken)),
            'data' => $order->load([
                'customer',
                'branch',
                'creator',
                'items.finishings',
                'payments.receiver',
                'customerFiles:id,order_id,order_item_id,original_filename,mime_type,file_size,note,created_at',
                'customerFiles.item:id,product_name',
            ]),
        ], 201);
    }

    private function recordInitialPayment(Order $order, User $user, array $paymentData): void
    {
        $amount = round((float) $paymentData['amount'], 2);
        $total = round((float) $order->total, 2);
        $paymentType = $paymentData['type'];

        if (
            $amount > $total ||
            ($paymentType === 'full' && $amount !== $total) ||
            ($paymentType === 'down_payment' && $amount >= $total)
        ) {
            throw ValidationException::withMessages([
                'initial_payment.amount' => [
                    $paymentType === 'full'
                        ? 'Pembayaran lunas harus sama dengan total pesanan.'
                        : 'Nominal DP harus lebih kecil dari total pesanan.',
                ],
            ]);
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

        $payment = Payment::create([
            'payment_number' => 'TMP-'.Str::uuid(),
            'order_id' => $order->id,
            'received_by' => $user->id,
            'cash_register_shift_id' => $cashRegisterShift?->id,
            'amount' => $amount,
            'payment_type' => $paymentType,
            'method' => $paymentData['method'],
            'reference_number' => $paymentData['reference_number'] ?? null,
            'notes' => $paymentData['notes'] ?? null,
            'paid_at' => now(),
        ]);
        $payment->update([
            'payment_number' => 'PAY-'.now()->format('Y').'-'.
                str_pad($payment->id, 6, '0', STR_PAD_LEFT),
        ]);

        $balance = round($total - $amount, 2);
        $order->update([
            'paid_amount' => $amount,
            'balance' => max(0, $balance),
            'payment_status' => $balance <= 0 ? 'paid' : 'partial',
        ]);
    }

    public function approvalLink(Request $request, Order $order)
    {
        $this->authorizeBranch($request, $order);

        abort_if(
            $order->sales_channel !== 'pos',
            409,
            'Pesanan marketplace harus disetujui staf, bukan melalui tautan pelanggan.',
        );
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
            ! $user->hasGlobalBranchAccess() &&
            (int) $user->branch_id !== (int) $order->branch_id
        ) {
            abort(404);
        }
    }
}
