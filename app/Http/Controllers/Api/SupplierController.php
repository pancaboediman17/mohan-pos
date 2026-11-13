<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SupplierController extends Controller
{
    public function index(Request $request)
    {
        $suppliers = Supplier::query()
            ->when($request->filled('search'), function ($query) use ($request) {
                $search = $request->string('search')->trim();
                $query->where(fn ($q) => $q->where('supplier_code', 'like', "%{$search}%")->orWhere('name', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%"));
            })
            ->when($request->has('status') && $request->status !== '', fn ($query) => $query->where('is_active', $request->boolean('status')))
            ->orderBy('name')->get();

        return response()->json(['success' => true, 'data' => $suppliers]);
    }

    public function store(Request $request)
    {
        $supplier = DB::transaction(function () use ($request) {
            $supplier = Supplier::create($this->validated($request));
            $supplier->update(['supplier_code' => 'SUP-' . now()->format('Y') . '-' . str_pad((string) $supplier->id, 6, '0', STR_PAD_LEFT)]);
            return $supplier;
        });
        return response()->json(['success' => true, 'message' => 'Supplier berhasil ditambahkan.', 'data' => $supplier], 201);
    }

    public function update(Request $request, Supplier $supplier)
    {
        $supplier->update($this->validated($request, $supplier));
        return response()->json(['success' => true, 'message' => 'Supplier berhasil diperbarui.', 'data' => $supplier->fresh()]);
    }

    public function destroy(Supplier $supplier)
    {
        $supplier->delete();
        return response()->json(['success' => true, 'message' => 'Supplier berhasil dihapus.']);
    }

    private function validated(Request $request, ?Supplier $supplier = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:150', Rule::unique('suppliers', 'name')->ignore($supplier?->id)],
            'contact_person' => ['nullable', 'string', 'max:100'], 'phone' => ['nullable', 'string', 'max:25'],
            'email' => ['nullable', 'email', 'max:255'], 'address' => ['nullable', 'string'], 'notes' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
