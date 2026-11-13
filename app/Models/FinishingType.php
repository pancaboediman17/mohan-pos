<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
class FinishingType extends Model { use SoftDeletes; protected $fillable=['name','code','description','default_cost','is_active']; protected function casts(): array { return ['default_cost'=>'decimal:2','is_active'=>'boolean']; } }
