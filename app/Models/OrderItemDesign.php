<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItemDesign extends Model
{
    protected $fillable = [
        'order_item_id',
        'uploaded_by',
        'version',
        'file_path',
        'original_filename',
        'mime_type',
        'file_size',
        'status',
        'approval_token_hash',
        'customer_note',
        'approved_at',
        'decided_at',
    ];

    protected $hidden = [
        'file_path',
        'approval_token_hash',
    ];

    protected function casts(): array
    {
        return [
            'approved_at' => 'datetime',
            'decided_at' => 'datetime',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class, 'order_item_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
