<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FinishingType;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FinishingTypeController extends Controller
{
    public function index()
    {
        return response()->json([
            'success' => true,
            'data' => FinishingType::orderBy('name')->get(),
        ]);
    }

    public function orderOptions()
    {
        return response()->json([
            'success' => true,
            'data' => FinishingType::query()
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'code', 'default_cost']),
        ]);
    }

    public function store(Request $request)
    {
        $item = FinishingType::create($this->valid($request));

        return response()->json([
            'success' => true,
            'message' => 'Jenis finishing berhasil ditambahkan.',
            'data' => $item,
        ], 201);
    }

    public function update(Request $request, FinishingType $finishingType)
    {
        $finishingType->update($this->valid($request, $finishingType));

        return response()->json([
            'success' => true,
            'message' => 'Jenis finishing berhasil diperbarui.',
            'data' => $finishingType->fresh(),
        ]);
    }

    public function destroy(FinishingType $finishingType)
    {
        $finishingType->delete();

        return response()->json([
            'success' => true,
            'message' => 'Jenis finishing berhasil dihapus.',
        ]);
    }

    private function valid(Request $request, ?FinishingType $item = null): array
    {
        return $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('finishing_types', 'name')->ignore($item?->id),
            ],
            'code' => [
                'required',
                'string',
                'max:30',
                Rule::unique('finishing_types', 'code')->ignore($item?->id),
            ],
            'description' => ['nullable', 'string'],
            'default_cost' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
