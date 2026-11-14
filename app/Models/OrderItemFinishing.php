<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItemFinishing extends Model
{
    protected $fillable = [
        'order_item_id',
        'finishing_type_id',
        'finishing_name',
        'finishing_code',
        'unit_cost',
    ];

    protected function casts(): array
    {
        return [
            'unit_cost' => 'decimal:2',
        ];
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }

    public function finishingType(): BelongsTo
    {
        return $this->belongsTo(FinishingType::class);
    }
}
