<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class MarketplaceOrderImportController extends Controller
{
    private const CHANNELS = ['shopee', 'tokopedia', 'tiktok_shop', 'lazada'];

    private const SHIPMENT_STATUSES = [
        'pending',
        'booked',
        'picked_up',
        'in_transit',
        'delivered',
        'failed',
        'cancelled',
    ];

    private const HEADERS = [
        'sales_channel',
        'external_order_id',
        'order_date',
        'customer_name',
        'customer_phone',
        'customer_email',
        'channel_payment_status',
        'product_code',
        'quantity',
        'unit_price',
        'width',
        'height',
        'discount',
        'specifications',
        'item_notes',
        'recipient_name',
        'recipient_phone',
        'shipping_address',
        'courier',
        'service_name',
        'shipping_fee',
        'tracking_number',
        'shipment_status',
        'notes',
    ];

    private const ORDER_FIELDS = [
        'sales_channel',
        'external_order_id',
        'order_date',
        'customer_name',
        'customer_phone',
        'customer_email',
        'channel_payment_status',
        'discount',
        'recipient_name',
        'recipient_phone',
        'shipping_address',
        'courier',
        'service_name',
        'shipping_fee',
        'tracking_number',
        'shipment_status',
        'notes',
    ];

    public function template()
    {
        return response()->streamDownload(function () {
            $stream = fopen('php://output', 'w');
            fputcsv($stream, self::HEADERS);
            fclose($stream);
        }, 'mohan-digital-labs-marketplace-orders-template.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function preview(Request $request)
    {
        $groups = $this->parseFile($this->validatedFile($request));

        return response()->json([
            'data' => $this->summary($groups),
        ]);
    }

    public function import(Request $request)
    {
        $validated = $request->validate([
            'branch_id' => [
                'nullable',
                'integer',
                Rule::exists('branches', 'id')
                    ->where('is_active', true)
                    ->whereNull('deleted_at'),
            ],
        ]);
        $user = $request->user();
        $branchId = $user->hasGlobalBranchAccess()
            ? ($validated['branch_id'] ?? $user->branch_id)
            : ($user->branch_id ?? ($validated['branch_id'] ?? null));
        $groups = $this->parseFile($this->validatedFile($request));
        $imported = 0;

        foreach ($groups as $index => $group) {
            if ($group['status'] !== 'ready') {
                continue;
            }

            $created = DB::transaction(function () use ($request, $group, $branchId) {
                $exists = Order::withTrashed()
                    ->where('sales_channel', $group['order']['sales_channel'])
                    ->where('external_order_id', $group['order']['external_order_id'])
                    ->exists();

                if ($exists) {
                    return false;
                }

                $customer = $this->findOrCreateCustomer($group['order']);
                $subtotal = round($group['subtotal'], 2);
                $discount = round((float) ($group['order']['discount'] ?? 0), 2);
                $total = round($subtotal - $discount, 2);
                $order = Order::create([
                    'order_number' => 'TMP-'.Str::uuid(),
                    'sales_channel' => $group['order']['sales_channel'],
                    'external_order_id' => $group['order']['external_order_id'],
                    'external_order_date' => $group['order']['order_date'],
                    'channel_payment_status' => $group['order']['channel_payment_status'],
                    'quote_status' => 'pending',
                    'quote_approval_token_hash' => null,
                    'branch_id' => $branchId,
                    'customer_id' => $customer->id,
                    'created_by' => $request->user()->id,
                    'subtotal' => $subtotal,
                    'discount' => $discount,
                    'total' => $total,
                    'paid_amount' => 0,
                    'balance' => $total,
                    'status' => 'pending',
                    'payment_status' => $total > 0 ? 'unpaid' : 'paid',
                    'notes' => $group['order']['notes'],
                ]);
                $order->update([
                    'order_number' => 'PF-'.now()->format('Y').'-'.
                        str_pad($order->id, 6, '0', STR_PAD_LEFT),
                ]);

                foreach ($group['items'] as $item) {
                    $quantity = (float) $item['quantity'];
                    $unitPrice = (float) $item['unit_price'];
                    $order->items()->create([
                        'product_id' => $item['product']->id,
                        'product_code' => $item['product']->product_code,
                        'product_name' => $item['product']->name,
                        'unit_name' => $item['product']->unit?->name,
                        'quantity' => $quantity,
                        'width' => $item['width'],
                        'height' => $item['height'],
                        'unit_price' => $unitPrice,
                        'unit_cost' => $item['product']->estimated_cost,
                        'subtotal' => round($quantity * $unitPrice, 2),
                        'specifications' => $item['specifications'],
                        'notes' => $item['item_notes'],
                    ]);
                }

                if ($this->hasShipmentData($group['order'])) {
                    $status = $group['order']['shipment_status'] ?: 'pending';
                    $now = now();
                    $order->shipment()->create([
                        'recipient_name' => $group['order']['recipient_name'],
                        'recipient_phone' => $group['order']['recipient_phone'],
                        'shipping_address' => $group['order']['shipping_address'],
                        'courier' => $group['order']['courier'],
                        'service_name' => $group['order']['service_name'],
                        'shipping_fee' => $group['order']['shipping_fee'] ?? 0,
                        'tracking_number' => $group['order']['tracking_number'],
                        'status' => $status,
                        'updated_by' => $request->user()->id,
                        'booked_at' => in_array($status, ['booked', 'picked_up', 'in_transit', 'delivered'], true)
                            ? $now
                            : null,
                        'shipped_at' => in_array($status, ['picked_up', 'in_transit', 'delivered'], true)
                            ? $now
                            : null,
                        'delivered_at' => $status === 'delivered' ? $now : null,
                    ]);
                }

                return true;
            });

            if ($created) {
                $imported++;
                $groups[$index]['status'] = 'imported';
            } else {
                $groups[$index]['status'] = 'duplicate';
                $groups[$index]['errors'][] = 'Pesanan sudah pernah diimpor; data lama tidak ditimpa.';
            }
        }

        return response()->json([
            'message' => 'Proses impor selesai.',
            'data' => $this->summary($groups, $imported),
        ]);
    }

    private function validatedFile(Request $request): UploadedFile
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:10240'],
        ]);

        return $validated['file'];
    }

    private function parseFile(UploadedFile $file): array
    {
        $handle = fopen($file->getRealPath(), 'rb');
        if ($handle === false) {
            throw ValidationException::withMessages([
                'file' => ['File CSV tidak dapat dibaca.'],
            ]);
        }

        try {
            $firstLine = fgets($handle);
            if ($firstLine === false) {
                throw ValidationException::withMessages([
                    'file' => ['File CSV kosong.'],
                ]);
            }

            $delimiter = $this->csvDelimiter($firstLine);
            rewind($handle);
            $headers = fgetcsv($handle, 0, $delimiter, '"', '');
            $headers = array_map(fn ($header) => $this->normalizeHeader($header), $headers ?: []);

            if (array_diff(self::HEADERS, $headers)) {
                throw ValidationException::withMessages([
                    'file' => ["Header CSV tidak lengkap. Unduh template MOHAN Digital Lab's untuk format yang benar."],
                ]);
            }
            if (count($headers) !== count(array_unique($headers))) {
                throw ValidationException::withMessages([
                    'file' => ['Header CSV tidak boleh duplikat.'],
                ]);
            }

            $groups = [];
            $recordNumber = 1;
            $dataRows = 0;
            while (($values = fgetcsv($handle, 0, $delimiter, '"', '')) !== false) {
                $recordNumber++;
                if ($values === [null] || count(array_filter($values, fn ($value) => trim((string) $value) !== '')) === 0) {
                    continue;
                }
                if (++$dataRows > 5000) {
                    throw ValidationException::withMessages([
                        'file' => ['CSV maksimal berisi 5.000 baris item.'],
                    ]);
                }

                $columnError = count($values) !== count($headers);
                $values = array_slice(array_pad($values, count($headers), ''), 0, count($headers));
                $row = array_combine($headers, array_map(
                    fn ($value) => trim((string) $value) === '' ? null : trim((string) $value),
                    $values,
                ));
                $row['discount'] = $row['discount'] ?? '0';
                $row['shipping_fee'] = $row['shipping_fee'] ?? '0';
                $row['line'] = $recordNumber;

                $errors = Validator::make($row, [
                    'sales_channel' => ['required', Rule::in(self::CHANNELS)],
                    'external_order_id' => ['required', 'string', 'max:100'],
                    'order_date' => ['required', 'date_format:Y-m-d'],
                    'customer_name' => ['required', 'string', 'max:150'],
                    'customer_phone' => ['nullable', 'string', 'max:25'],
                    'customer_email' => ['nullable', 'email', 'max:255'],
                    'channel_payment_status' => ['required', Rule::in(['paid', 'unpaid'])],
                    'product_code' => ['required', 'string', 'max:40'],
                    'quantity' => ['required', 'numeric', 'gt:0', 'max:999999999'],
                    'unit_price' => ['required', 'numeric', 'min:0', 'max:999999999999.99'],
                    'discount' => ['required', 'numeric', 'min:0', 'max:999999999999.99'],
                    'width' => ['nullable', 'numeric', 'gt:0', 'max:999999'],
                    'height' => ['nullable', 'numeric', 'gt:0', 'max:999999'],
                    'specifications' => ['nullable', 'string', 'max:2000'],
                    'item_notes' => ['nullable', 'string', 'max:2000'],
                    'recipient_name' => ['nullable', 'string', 'max:150'],
                    'recipient_phone' => ['nullable', 'string', 'max:25'],
                    'shipping_address' => ['nullable', 'string', 'max:2000'],
                    'courier' => ['nullable', 'string', 'max:80'],
                    'service_name' => ['nullable', 'string', 'max:80'],
                    'shipping_fee' => ['required', 'numeric', 'min:0', 'max:999999999999.99'],
                    'tracking_number' => ['nullable', 'string', 'max:100'],
                    'shipment_status' => ['nullable', Rule::in(self::SHIPMENT_STATUSES)],
                    'notes' => ['nullable', 'string', 'max:2000'],
                ])->errors()->all();

                if ($columnError) {
                    $errors[] = 'Jumlah kolom tidak sesuai dengan header.';
                }

                $key = ($row['sales_channel'] ?? 'invalid').'|'.($row['external_order_id'] ?? 'line-'.$recordNumber);
                $groups[$key] ??= [
                    'order' => $row,
                    'items' => [],
                    'errors' => [],
                    'status' => 'ready',
                    'subtotal' => 0,
                ];

                foreach ($errors as $error) {
                    $groups[$key]['errors'][] = "Baris {$recordNumber}: {$error}";
                }

                if ($dataRows === 1) {
                    $groups[$key]['order'] = $row;
                } else {
                    foreach (self::ORDER_FIELDS as $field) {
                        if (($groups[$key]['order'][$field] ?? null) !== ($row[$field] ?? null)) {
                            $groups[$key]['errors'][] = "Baris {$recordNumber}: data tingkat pesanan {$field} berbeda antar-item.";
                        }
                    }
                }

                $groups[$key]['items'][] = $row;
            }

            if ($dataRows === 0) {
                throw ValidationException::withMessages([
                    'file' => ['CSV tidak berisi baris item pesanan.'],
                ]);
            }

            $productCodes = [];
            foreach ($groups as $group) {
                foreach ($group['items'] as $row) {
                    if ($row['product_code'] ?? null) {
                        $productCodes[] = strtoupper($row['product_code']);
                    }
                }
            }
            $products = Product::query()
                ->with('unit')
                ->where('is_active', true)
                ->whereIn(DB::raw('UPPER(product_code)'), array_values(array_unique($productCodes)))
                ->get()
                ->keyBy(fn (Product $product) => strtoupper($product->product_code));

            foreach ($groups as $key => $group) {
                $items = [];
                $subtotal = 0;
                foreach ($group['items'] as $row) {
                    $product = $products->get(strtoupper((string) ($row['product_code'] ?? '')));
                    if (! $product) {
                        $groups[$key]['errors'][] = "Baris {$row['line']}: SKU {$row['product_code']} tidak ditemukan atau tidak aktif.";
                        continue;
                    }

                    $itemSubtotal = round((float) $row['quantity'] * (float) $row['unit_price'], 2);
                    $subtotal += $itemSubtotal;
                    $items[] = [
                        ...$row,
                        'product' => $product,
                        'item_subtotal' => $itemSubtotal,
                    ];
                }

                $groups[$key]['items'] = $items;
                $groups[$key]['subtotal'] = round($subtotal, 2);
                if ((float) ($group['order']['discount'] ?? 0) > $subtotal) {
                    $groups[$key]['errors'][] = 'Diskon tidak boleh melebihi subtotal item.';
                }

                if (! $groups[$key]['errors']) {
                    $exists = Order::withTrashed()
                        ->where('sales_channel', $group['order']['sales_channel'])
                        ->where('external_order_id', $group['order']['external_order_id'])
                        ->exists();
                    $groups[$key]['status'] = $exists ? 'duplicate' : 'ready';
                    if ($exists) {
                        $groups[$key]['errors'][] = 'Pesanan sudah pernah diimpor; data lama tidak ditimpa.';
                    }
                } else {
                    $groups[$key]['status'] = 'invalid';
                }
            }

            return array_values($groups);
        } finally {
            fclose($handle);
        }
    }

    private function csvDelimiter(string $firstLine): string
    {
        foreach ([',', ';'] as $delimiter) {
            $headers = str_getcsv(rtrim($firstLine, "\r\n"), $delimiter, '"', '');
            $headers = array_map(fn ($header) => $this->normalizeHeader($header), $headers);
            if (in_array('sales_channel', $headers, true) && in_array('external_order_id', $headers, true)) {
                return $delimiter;
            }
        }

        throw ValidationException::withMessages([
            'file' => ['Header CSV tidak dikenali. Gunakan template dengan pemisah koma atau titik koma.'],
        ]);
    }

    private function normalizeHeader(?string $header): string
    {
        return strtolower(trim(preg_replace('/^\xEF\xBB\xBF/', '', (string) $header)));
    }

    private function findOrCreateCustomer(array $order): Customer
    {
        $phone = $order['customer_phone'] ?? null;
        $email = $order['customer_email'] ?? null;
        $customer = null;

        if ($phone || $email) {
            $customer = Customer::query()
                ->where(function ($query) use ($phone, $email) {
                    if ($phone) {
                        $query->where('phone', $phone);
                    }
                    if ($email) {
                        $phone ? $query->orWhere('email', $email) : $query->where('email', $email);
                    }
                })
                ->first();
        }

        return $customer ?? Customer::create([
            'name' => $order['customer_name'],
            'customer_type' => 'individual',
            'phone' => $phone,
            'email' => $email,
            'is_active' => true,
        ]);
    }

    private function hasShipmentData(array $order): bool
    {
        foreach ([
            'recipient_name',
            'recipient_phone',
            'shipping_address',
            'courier',
            'service_name',
            'tracking_number',
        ] as $field) {
            if (filled($order[$field] ?? null)) {
                return true;
            }
        }

        return (float) ($order['shipping_fee'] ?? 0) > 0;
    }

    private function summary(array $groups, int $imported = 0): array
    {
        return [
            'total' => count($groups),
            'ready' => collect($groups)->where('status', 'ready')->count(),
            'imported' => $imported,
            'duplicates' => collect($groups)->where('status', 'duplicate')->count(),
            'invalid' => collect($groups)->where('status', 'invalid')->count(),
            'orders' => array_map(fn (array $group) => [
                'sales_channel' => $group['order']['sales_channel'] ?? null,
                'external_order_id' => $group['order']['external_order_id'] ?? null,
                'order_date' => $group['order']['order_date'] ?? null,
                'customer_name' => $group['order']['customer_name'] ?? null,
                'channel_payment_status' => $group['order']['channel_payment_status'] ?? null,
                'item_count' => count($group['items']),
                'total' => round(
                    $group['subtotal'] - (float) ($group['order']['discount'] ?? 0),
                    2,
                ),
                'status' => $group['status'],
                'errors' => array_values(array_unique($group['errors'])),
                'items' => array_map(fn (array $item) => [
                    'product_code' => $item['product_code'] ?? null,
                    'product_name' => $item['product']->name ?? null,
                    'quantity' => $item['quantity'] ?? null,
                    'unit_price' => $item['unit_price'] ?? null,
                    'subtotal' => $item['item_subtotal'] ?? null,
                ], $group['items']),
            ], $groups),
        ];
    }
}
