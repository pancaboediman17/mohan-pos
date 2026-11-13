<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class BranchController extends Controller
{
    public function index(Request $request)
    {
        $branches = Branch::query()
            ->withCount('users')
            ->when($request->filled('search'), function ($query) use ($request) {
                $search = $request->string('search')->trim();
                $query->where(function ($subQuery) use ($search) {
                    $subQuery->where('code', 'like', "%{$search}%")
                        ->orWhere('name', 'like', "%{$search}%")
                        ->orWhere('address', 'like', "%{$search}%");
                });
            })
            ->when($request->has('status') && $request->status !== '', fn ($query) =>
                $query->where('is_active', $request->boolean('status')))
            ->orderByDesc('is_production_hub')
            ->orderBy('name')
            ->get();

        return response()->json(['success' => true, 'data' => $branches]);
    }

    public function store(Request $request)
    {
        $validated = $this->validated($request);
        $branch = DB::transaction(function () use ($validated) {
            $this->clearOtherProductionHubs($validated['is_production_hub'] ?? false);
            return Branch::create($validated);
        });

        return response()->json([
            'success' => true,
            'message' => 'Cabang berhasil ditambahkan.',
            'data' => $branch->loadCount('users'),
        ], 201);
    }

    public function update(Request $request, Branch $branch)
    {
        $validated = $this->validated($request, $branch);

        DB::transaction(function () use ($validated, $branch) {
            $this->clearOtherProductionHubs($validated['is_production_hub'] ?? false, $branch->id);
            $branch->update($validated);
        });

        return response()->json([
            'success' => true,
            'message' => 'Cabang berhasil diperbarui.',
            'data' => $branch->fresh()->loadCount('users'),
        ]);
    }

    public function destroy(Branch $branch)
    {
        if ($branch->users()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Cabang masih memiliki pengguna yang terhubung.',
            ], 422);
        }

        $branch->delete();

        return response()->json([
            'success' => true,
            'message' => 'Cabang berhasil dihapus.',
        ]);
    }

    private function validated(Request $request, ?Branch $branch = null): array
    {
        return $request->validate([
            'code' => [
                'required', 'string', 'max:20', 'uppercase',
                Rule::unique('branches', 'code')->ignore($branch?->id),
            ],
            'name' => ['required', 'string', 'max:150'],
            'phone' => ['nullable', 'string', 'max:25'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string'],
            'is_production_hub' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }

    private function clearOtherProductionHubs(bool $isProductionHub, ?int $exceptId = null): void
    {
        if (!$isProductionHub) {
            return;
        }

        Branch::query()
            ->when($exceptId, fn ($query) => $query->whereKeyNot($exceptId))
            ->where('is_production_hub', true)
            ->update(['is_production_hub' => false]);
    }
}
