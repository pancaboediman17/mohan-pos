<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
class ProductionMachine extends Model
{
    use SoftDeletes;
    protected $fillable = ['branch_id','machine_code','name','type','brand','model','hourly_cost','is_active'];
    protected function casts(): array { return ['hourly_cost' => 'decimal:2', 'is_active' => 'boolean']; }
    public function branch(): BelongsTo { return $this->belongsTo(Branch::class); }
}
