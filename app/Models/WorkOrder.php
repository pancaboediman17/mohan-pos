<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkOrder extends Model
{
    protected $fillable = [
        'order_id',
        'order_item_id',
        'production_branch_id',
        'production_machine_id',
        'status',
        'started_at',
        'completed_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class, 'order_item_id');
    }

    public function productionBranch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'production_branch_id');
    }

    public function machine(): BelongsTo
    {
        return $this->belongsTo(ProductionMachine::class, 'production_machine_id');
    }

    public function materialStockMovements(): HasMany
    {
        return $this->hasMany(MaterialStockMovement::class);
    }
}
