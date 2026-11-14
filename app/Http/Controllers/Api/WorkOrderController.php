<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductionMachine;
use App\Models\WorkOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class WorkOrderController extends Controller
{
    private const TRANSITIONS = [
        'queued' => 'accepted',
        'accepted' => 'printing',
        'printing' => 'finishing',
        'finishing' => 'quality_check',
        'quality_check' => 'ready',
        'ready' => 'completed',
    ];

    public function index(Request $request)
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::in([
                'waiting_design',
                'design_approval',
                'design_revision',
                'queued',
                'accepted',
                'printing',
                'finishing',
                'quality_check',
                'ready',
                'completed',
            ])],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);
        $user = $request->user();
        $query = WorkOrder::query()
            ->when(
                $user->branch_id && ! $user->hasGlobalBranchAccess(),
                fn ($builder) => $builder->where('production_branch_id', $user->branch_id),
            );
        $summary = (clone $query)
            ->selectRaw('status, count(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        $workOrders = $query
            ->with([
                'order:id,order_number,customer_id,due_date,branch_id',
                'order.customer:id,name',
                'item:id,order_id,product_name,quantity,unit_name,width,height,specifications,notes',
                'item.latestDesign',
                'order.customerFiles:id,order_id,order_item_id,original_filename,mime_type,file_size,note,created_at',
                'order.customerFiles.item:id,product_name',
                'productionBranch:id,code,name',
                'machine:id,branch_id,machine_code,name',
            ])
            ->when(
                $validated['status'] ?? null,
                fn ($query, $status) => $query->where('status', $status),
            )
            ->orderByRaw('completed_at IS NULL DESC')
            ->orderBy('created_at')
            ->paginate($validated['per_page'] ?? 30);

        return response()->json(array_merge($workOrders->toArray(), [
            'summary' => $summary,
        ]));
    }

    public function update(Request $request, WorkOrder $workOrder)
    {
        $user = $request->user();
        abort_if(
            $user->branch_id &&
                ! $user->hasGlobalBranchAccess() &&
                $workOrder->production_branch_id !== $user->branch_id,
            403,
            'Work order ini berada di cabang produksi lain.',
        );

        $validated = $request->validate([
            'status' => ['sometimes', Rule::in(array_values(self::TRANSITIONS))],
            'production_machine_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('production_machines', 'id')
                    ->where('is_active', true)
                    ->whereNull('deleted_at'),
            ],
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ]);

        return DB::transaction(function () use ($validated, $workOrder) {
            $workOrder = WorkOrder::query()->lockForUpdate()->findOrFail($workOrder->id);

            if (array_key_exists('production_machine_id', $validated)) {
                $machine = isset($validated['production_machine_id'])
                    ? ProductionMachine::query()->findOrFail($validated['production_machine_id'])
                    : null;

                if ($machine && $workOrder->production_branch_id
                    && $machine->branch_id !== $workOrder->production_branch_id) {
                    abort(422, 'Mesin harus berada di cabang produksi Work Order ini.');
                }

                $workOrder->production_machine_id = $machine?->id;
                if ($machine && ! $workOrder->production_branch_id) {
                    $workOrder->production_branch_id = $machine->branch_id;
                }
            }

            if (isset($validated['status'])) {
                $nextStatus = self::TRANSITIONS[$workOrder->status] ?? null;
                abort_unless(
                    $validated['status'] === $nextStatus,
                    409,
                    'Tahap Work Order harus dilanjutkan secara berurutan.',
                );

                if ($validated['status'] === 'printing' && ! $workOrder->production_machine_id) {
                    abort(422, 'Pilih mesin produksi sebelum memulai pencetakan.');
                }

                $workOrder->status = $validated['status'];
                if ($validated['status'] === 'printing') {
                    $workOrder->started_at = now();
                }
                if ($validated['status'] === 'completed') {
                    $workOrder->completed_at = now();
                }
            }

            if (array_key_exists('notes', $validated)) {
                $workOrder->notes = $validated['notes'];
            }

            $workOrder->save();
            $this->syncOrderStatus($workOrder);

            return response()->json([
                'message' => 'Work Order berhasil diperbarui.',
                'data' => $workOrder->load([
                    'order:id,order_number,customer_id,due_date,branch_id',
                    'order.customer:id,name',
                    'item:id,order_id,product_name,quantity,unit_name,width,height,specifications,notes',
                    'item.latestDesign',
                    'order.customerFiles:id,order_id,order_item_id,original_filename,mime_type,file_size,note,created_at',
                    'order.customerFiles.item:id,product_name',
                    'productionBranch:id,code,name',
                    'machine:id,branch_id,machine_code,name',
                ]),
            ]);
        });
    }

    private function syncOrderStatus(WorkOrder $workOrder): void
    {
        $order = $workOrder->order()->lockForUpdate()->firstOrFail();
        $statuses = $order->workOrders()->pluck('status');

        if ($statuses->isNotEmpty() && $statuses->every(fn ($status) => $status === 'completed')) {
            $order->update(['status' => 'ready_for_confirmation']);
        } elseif ($statuses->contains(fn ($status) => in_array(
            $status,
            ['accepted', 'printing', 'finishing', 'quality_check', 'ready'],
            true,
        ))) {
            $order->update(['status' => 'processing']);
        }
    }
}
