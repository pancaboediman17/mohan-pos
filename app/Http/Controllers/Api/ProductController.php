<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $products = Product::with(['category', 'unit'])
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('product_code', 'like', "%{$search}%")
                      ->orWhere('name', 'like', "%{$search}%");
                });
            })
            ->when($request->category_id, function ($query, $categoryId) {
                $query->where('product_category_id', $categoryId);
            })
            ->when($request->status !== null && $request->status !== '', function ($query) use ($request) {
                $query->where('is_active', $request->status);
            })
            ->latest()
            ->paginate(10);

        return response()->json($products);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_category_id' => ['required', 'exists:product_categories,id'],
            'unit_id' => ['required', 'exists:units,id'],
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string'],
            'selling_price' => ['required', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],

            'cost_components' => ['sometimes', 'array'],
            'cost_components.*.name' => ['required', 'string', 'max:150'],
            'cost_components.*.unit_id' => ['nullable', 'exists:units,id'],
            'cost_components.*.component_type' => [
                'required',
                Rule::in(['material', 'printing', 'finishing', 'labor', 'overhead', 'other']),
            ],
            'cost_components.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'cost_components.*.unit_cost' => ['required', 'numeric', 'min:0'],
            'cost_components.*.notes' => ['nullable', 'string'],
        ]);

        $product = DB::transaction(function () use ($validated) {
            $product = Product::create([
                'product_category_id' => $validated['product_category_id'],
                'unit_id' => $validated['unit_id'],
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'selling_price' => $validated['selling_price'],
                'estimated_cost' => 0,
                'is_active' => $validated['is_active'] ?? true,
                'product_code' => 'TEMP-' . uniqid(),
            ]);

            $product->update([
                'product_code' => 'PRD-' . date('Y') . '-' . str_pad($product->id, 6, '0', STR_PAD_LEFT),
            ]);

            $this->saveCostComponents(
                $product,
                $validated['cost_components'] ?? []
            );

            $this->recalculateCost($product);

            return $product;
        });

        return response()->json([
            'message' => 'Produk berhasil ditambahkan.',
            'data' => $product->load(['category', 'unit', 'costComponents.unit']),
        ], 201);
    }

    public function show(Product $product)
    {
        return response()->json([
            'data' => $product->load([
                'category',
                'unit',
                'costComponents.unit',
            ]),
        ]);
    }

    public function update(Request $request, Product $product)
    {
        $validated = $request->validate([
            'product_category_id' => ['sometimes', 'required', 'exists:product_categories,id'],
            'unit_id' => ['sometimes', 'required', 'exists:units,id'],
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'description' => ['nullable', 'string'],
            'selling_price' => ['sometimes', 'required', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],

            'cost_components' => ['sometimes', 'array'],
            'cost_components.*.name' => ['required', 'string', 'max:150'],
            'cost_components.*.unit_id' => ['nullable', 'exists:units,id'],
            'cost_components.*.component_type' => [
                'required',
                Rule::in(['material', 'printing', 'finishing', 'labor', 'overhead', 'other']),
            ],
            'cost_components.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'cost_components.*.unit_cost' => ['required', 'numeric', 'min:0'],
            'cost_components.*.notes' => ['nullable', 'string'],
        ]);

        DB::transaction(function () use ($validated, $product) {
            $product->update(collect($validated)->except('cost_components')->all());

            if (array_key_exists('cost_components', $validated)) {
                $product->costComponents()->delete();

                $this->saveCostComponents(
                    $product,
                    $validated['cost_components']
                );

                $this->recalculateCost($product);
            }
        });

        return response()->json([
            'message' => 'Produk berhasil diperbarui.',
            'data' => $product->fresh()->load([
                'category',
                'unit',
                'costComponents.unit',
            ]),
        ]);
    }

    public function destroy(Product $product)
    {
        $product->delete();

        return response()->json([
            'message' => 'Produk berhasil dihapus.',
        ]);
    }

    private function saveCostComponents(Product $product, array $components): void
    {
        foreach ($components as $component) {
            $quantity = (float) $component['quantity'];
            $unitCost = (float) $component['unit_cost'];

            $product->costComponents()->create([
                'name' => $component['name'],
                'unit_id' => $component['unit_id'] ?? null,
                'component_type' => $component['component_type'],
                'quantity' => $quantity,
                'unit_cost' => $unitCost,
                'total_cost' => round($quantity * $unitCost, 2),
                'notes' => $component['notes'] ?? null,
            ]);
        }
    }

    private function recalculateCost(Product $product): void
    {
        $total = $product->costComponents()->sum('total_cost');

        $product->update([
            'estimated_cost' => $total,
        ]);
    }
}

