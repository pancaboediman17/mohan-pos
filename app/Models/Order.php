<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Order extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'order_number',
        'sales_channel',
        'order_type',
        'external_order_id',
        'external_order_date',
        'channel_payment_status',
        'quote_status',
        'quote_approval_token_hash',
        'quote_approved_at',
        'quote_rejected_at',
        'quote_response_note',
        'customer_upload_token_hash',
        'customer_upload_token_expires_at',
        'completed_confirmed_at',
        'completed_confirmed_by',
        'branch_id',
        'customer_id',
        'created_by',
        'subtotal',
        'discount',
        'total',
        'paid_amount',
        'balance',
        'status',
        'payment_status',
        'notes',
        'due_date',
    ];

    protected $hidden = [
        'quote_approval_token_hash',
        'customer_upload_token_hash',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'discount' => 'decimal:2',
            'total' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'balance' => 'decimal:2',
            'due_date' => 'date',
            'external_order_date' => 'date',
            'quote_approved_at' => 'datetime',
            'quote_rejected_at' => 'datetime',
            'customer_upload_token_expires_at' => 'datetime',
            'completed_confirmed_at' => 'datetime',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function workOrders(): HasMany
    {
        return $this->hasMany(WorkOrder::class);
    }

    public function shipment(): HasOne
    {
        return $this->hasOne(OrderShipment::class);
    }

    public function customerFiles(): HasMany
    {
        return $this->hasMany(OrderCustomerFile::class);
    }
}
