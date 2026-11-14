<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Material;
use App\Models\MaterialStockMovement;
use App\Models\Unit;
use App\Models\WorkOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class InventoryController extends Controller
{
    public function branches(Request $request)
    {
        $branches = Branch::query()
            ->where('is_active', true)
            ->when(
                $request->user()->branch_id && ! $request->user()->hasGlobalBranchAccess(),
                fn ($query, $id) => $query->whereKey($id),
            )
            ->orderByDesc('is_production_hub')
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'is_production_hub']);

        return response()->json(['data' => $branches]);
    }

    public function units()
    {
        return response()->json([
            'data' => Unit::query()
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'symbol']),
        ]);
    }

    public function materials(Request $request)
    {
        $validated = $request->validate([
            'branch_id' => ['nullable', 'integer', Rule::exists('branches', 'id')->where('is_active', true)->whereNull('deleted_at')],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);
        $branchId = $this->resolveBranchId($request, $validated['branch_id'] ?? null);
        $balances = DB::table('material_stock_movements')
            ->selectRaw('material_id, SUM(quantity) as on_hand')
            ->when($branchId, fn ($query) => $query->where('branch_id', $branchId))
            ->groupBy('material_id');
        $query = Material::query()
            ->leftJoinSub($balances, 'stock_balances', 'stock_balances.material_id', '=', 'materials.id')
            ->with('unit:id,name,symbol')
            ->select('materials.*')
            ->selectRaw('COALESCE(stock_balances.on_hand, 0) as on_hand')
            ->where('materials.is_active', true)
            ->when($validated['search'] ?? null, function ($query, $search) {
                $query->where(function ($builder) use ($search) {
                    $builder->where('materials.name', 'like', "%{$search}%")
                        ->orWhere('materials.sku', 'like', "%{$search}%");
                });
            });

        $lowStockCount = (clone $query)
            ->whereRaw('COALESCE(stock_balances.on_hand, 0) <= materials.minimum_stock')
            ->count('materials.id');
        $estimatedValue = (clone $query)
            ->sum(DB::raw('CASE WHEN COALESCE(stock_balances.on_hand, 0) > 0 THEN stock_balances.on_hand * materials.unit_cost ELSE 0 END'));
        $paginator = $query
            ->orderBy('materials.name')
            ->paginate($validated['per_page'] ?? 30);

        $paginator->getCollection()->transform(function (Material $material) {
            $material->setAttribute('on_hand', (float) $material->on_hand);
            $material->setAttribute(
                'is_low_stock',
                (float) $material->on_hand <= (float) $material->minimum_stock,
            );

            return $material;
        });

        return response()->json(array_merge($paginator->toArray(), [
            'branch_id' => $branchId,
            'summary' => [
                'total_materials' => (clone $query)->count('materials.id'),
                'low_stock' => $lowStockCount,
                'estimated_value' => (float) $estimatedValue,
            ],
        ]));
    }

    public function storeMaterial(Request $request)
    {
        $validated = $request->validate([
            'sku' => ['required', 'string', 'max:40', 'unique:materials,sku'],
            'name' => ['required', 'string', 'max:150'],
            'unit_id' => ['required', 'integer', Rule::exists('units', 'id')->where('is_active', true)],
            'minimum_stock' => ['nullable', 'numeric', 'decimal:0,3', 'min:0'],
            'unit_cost' => ['nullable', 'numeric', 'decimal:0,2', 'min:0'],
        ]);
        $material = Material::create($validated);

        return response()->json([
            'message' => 'Bahan berhasil ditambahkan.',
            'data' => $material->load('unit:id,name,symbol'),
        ], 201);
    }

    public function updateMaterial(Request $request, Material $material)
    {
        $validated = $request->validate([
            'sku' => ['required', 'string', 'max:40', Rule::unique('materials', 'sku')->ignore($material->id)],
            'name' => ['required', 'string', 'max:150'],
            'unit_id' => ['required', 'integer', Rule::exists('units', 'id')->where('is_active', true)],
            'minimum_stock' => ['nullable', 'numeric', 'decimal:0,3', 'min:0'],
            'unit_cost' => ['nullable', 'numeric', 'decimal:0,2', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $material->update($validated);

        return response()->json([
            'message' => 'Bahan berhasil diperbarui.',
            'data' => $material->fresh()->load('unit:id,name,symbol'),
        ]);
    }

    public function movements(Request $request)
    {
        $validated = $request->validate([
            'branch_id' => ['nullable', 'integer', Rule::exists('branches', 'id')->where('is_active', true)->whereNull('deleted_at')],
            'material_id' => ['nullable', 'integer', 'exists:materials,id'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);
        $branchId = $this->resolveBranchId($request, $validated['branch_id'] ?? null);
        $movements = MaterialStockMovement::query()
            ->with([
                'material:id,sku,name,unit_id',
                'material.unit:id,name,symbol',
                'branch:id,code,name',
                'workOrder:id,order_id,order_item_id',
                'workOrder.order:id,order_number',
                'creator:id,name',
            ])
            ->when($branchId, fn ($query) => $query->where('branch_id', $branchId))
            ->when(
                $validated['material_id'] ?? null,
                fn ($query, $materialId) => $query->where('material_id', $materialId),
            )
            ->latest()
            ->paginate($validated['per_page'] ?? 20);

        return response()->json($movements);
    }

    public function storeMovement(Request $request)
    {
        $validated = $request->validate([
            'branch_id' => ['nullable', 'integer', Rule::exists('branches', 'id')->where('is_active', true)->whereNull('deleted_at')],
            'material_id' => ['required', 'integer', 'exists:materials,id'],
            'movement_type' => ['required', Rule::in(['receipt', 'adjustment'])],
            'quantity' => ['required', 'numeric', 'decimal:0,3', 'not_in:0'],
            'unit_cost' => ['nullable', 'numeric', 'decimal:0,2', 'min:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
        $branchId = $this->resolveBranchId($request, $validated['branch_id'] ?? null);
        if (! $branchId) {
            throw ValidationException::withMessages([
                'branch_id' => ['Pilih cabang sebelum mencatat mutasi stok.'],
            ]);
        }

        $quantity = (float) $validated['quantity'];
        if ($validated['movement_type'] === 'receipt' && $quantity < 0) {
            throw ValidationException::withMessages([
                'quantity' => ['Penerimaan stok harus bernilai positif.'],
            ]);
        }

        $movement = DB::transaction(function () use ($validated, $branchId, $quantity, $request) {
            $material = Material::query()
                ->where('is_active', true)
                ->lockForUpdate()
                ->findOrFail($validated['material_id']);
            $balance = (float) MaterialStockMovement::query()
                ->where('branch_id', $branchId)
                ->where('material_id', $material->id)
                ->sum('quantity');
            $newBalance = $balance + $quantity;

            if ($newBalance < 0) {
                throw ValidationException::withMessages([
                    'quantity' => ['Stok tidak mencukupi untuk pengurangan ini.'],
                ]);
            }

            $unitCost = (float) ($validated['unit_cost'] ?? $material->unit_cost);
            if ($validated['movement_type'] === 'receipt' && isset($validated['unit_cost'])) {
                $material->update(['unit_cost' => $unitCost]);
            }

            return MaterialStockMovement::create([
                'branch_id' => $branchId,
                'material_id' => $material->id,
                'created_by' => $request->user()->id,
                'movement_type' => $validated['movement_type'],
                'quantity' => $quantity,
                'unit_cost' => $unitCost,
                'notes' => $validated['notes'] ?? null,
            ])->load(['material.unit:id,name,symbol', 'branch:id,code,name', 'creator:id,name']);
        });

        return response()->json([
            'message' => 'Mutasi stok berhasil dicatat.',
            'data' => $movement,
        ], 201);
    }

    public function consumeWorkOrder(Request $request, WorkOrder $workOrder)
    {
        $validated = $request->validate([
            'material_id' => ['required', 'integer', 'exists:materials,id'],
            'quantity' => ['required', 'numeric', 'decimal:0,3', 'min:0.001'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
        $user = $request->user();
        abort_unless($workOrder->production_branch_id, 409, 'Tentukan cabang produksi Work Order terlebih dahulu.');
        abort_if(
            $user->branch_id &&
                ! $user->hasGlobalBranchAccess() &&
                $workOrder->production_branch_id !== $user->branch_id,
            403,
            'Work Order ini berada di cabang produksi lain.',
        );

        $movement = DB::transaction(function () use ($validated, $workOrder, $request) {
            $lockedWorkOrder = WorkOrder::query()->lockForUpdate()->findOrFail($workOrder->id);
            abort_unless(
                in_array($lockedWorkOrder->status, ['printing', 'finishing'], true),
                409,
                'Bahan hanya dapat dipakai saat Work Order sedang dicetak atau finishing.',
            );

            $material = Material::query()
                ->where('is_active', true)
                ->lockForUpdate()
                ->findOrFail($validated['material_id']);
            $balance = (float) MaterialStockMovement::query()
                ->where('branch_id', $lockedWorkOrder->production_branch_id)
                ->where('material_id', $material->id)
                ->sum('quantity');
            $quantity = (float) $validated['quantity'];

            if ($balance < $quantity) {
                throw ValidationException::withMessages([
                    'quantity' => ['Stok bahan di cabang produksi tidak mencukupi.'],
                ]);
            }

            return MaterialStockMovement::create([
                'branch_id' => $lockedWorkOrder->production_branch_id,
                'material_id' => $material->id,
                'work_order_id' => $lockedWorkOrder->id,
                'created_by' => $request->user()->id,
                'movement_type' => 'consumption',
                'quantity' => -$quantity,
                'unit_cost' => $material->unit_cost,
                'notes' => $validated['notes'] ?? null,
            ])->load(['material.unit:id,name,symbol', 'branch:id,code,name', 'creator:id,name']);
        });

        return response()->json([
            'message' => 'Pemakaian bahan berhasil dicatat pada Work Order.',
            'data' => $movement,
        ], 201);
    }

    private function resolveBranchId(Request $request, ?int $requestedBranchId): ?int
    {
        if ($request->user()->branch_id && ! $request->user()->hasGlobalBranchAccess()) {
            return $request->user()->branch_id;
        }

        return $requestedBranchId
            ?? Branch::query()
                ->where('is_active', true)
                ->where('is_production_hub', true)
                ->orderBy('id')
                ->value('id')
            ?? Branch::query()->where('is_active', true)->orderBy('id')->value('id');
    }
}
