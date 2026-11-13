<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Unit;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UnitController extends Controller
{
    public function index()
    {
        return response()->json(
            Unit::withCount('products')
                ->orderBy('name')
                ->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50', 'unique:units,name'],
            'symbol' => ['required', 'string', 'max:20', 'unique:units,symbol'],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $unit = Unit::create([
            ...$validated,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return response()->json([
            'message' => 'Satuan berhasil ditambahkan.',
            'data' => $unit,
        ], 201);
    }

    public function update(Request $request, Unit $unit)
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:50',
                Rule::unique('units', 'name')->ignore($unit->id),
            ],
            'symbol' => [
                'required',
                'string',
                'max:20',
                Rule::unique('units', 'symbol')->ignore($unit->id),
            ],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $unit->update($validated);

        return response()->json([
            'message' => 'Satuan berhasil diperbarui.',
            'data' => $unit,
        ]);
    }

    public function destroy(Unit $unit)
    {
        if ($unit->products()->exists() || $unit->costComponents()->exists()) {
            return response()->json([
                'message' => 'Satuan masih digunakan oleh produk atau komponen HPP.',
            ], 422);
        }

        $unit->delete();

        return response()->json([
            'message' => 'Satuan berhasil dihapus.',
        ]);
    }
}
