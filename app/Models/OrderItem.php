<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id',
        'product_id',
        'product_code',
        'product_name',
        'unit_name',
        'quantity',
        'width',
        'height',
        'unit_price',
        'unit_cost',
        'subtotal',
        'specifications',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
            'width' => 'decimal:2',
            'height' => 'decimal:2',
            'unit_price' => 'decimal:2',
            'unit_cost' => 'decimal:2',
            'subtotal' => 'decimal:2',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function finishings(): HasMany
    {
        return $this->hasMany(OrderItemFinishing::class);
    }

    public function designs(): HasMany
    {
        return $this->hasMany(OrderItemDesign::class);
    }

    public function latestDesign(): HasOne
    {
        return $this->hasOne(OrderItemDesign::class)->latestOfMany('version');
    }

    public function workOrder(): HasOne
    {
        return $this->hasOne(WorkOrder::class);
    }
}
