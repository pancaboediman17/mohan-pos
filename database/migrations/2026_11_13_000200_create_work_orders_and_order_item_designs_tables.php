<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('work_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_item_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('production_branch_id')->nullable()
                ->constrained('branches')->nullOnDelete();
            $table->foreignId('production_machine_id')->nullable()
                ->constrained('production_machines')->nullOnDelete();
            $table->string('status', 30)->default('waiting_design')->index();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['production_branch_id', 'status']);
        });

        Schema::create('order_item_designs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('version');
            $table->string('file_path');
            $table->string('original_filename');
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('file_size');
            $table->string('status', 30)->default('pending_approval')->index();
            $table->string('approval_token_hash', 64)->nullable()->unique();
            $table->text('customer_note')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();

            $table->unique(['order_item_id', 'version']);
        });

        $productionBranchId = DB::table('branches')
            ->where('is_active', true)
            ->where('is_production_hub', true)
            ->orderBy('id')
            ->value('id');
        $timestamp = now();

        DB::table('orders')
            ->where('quote_status', 'approved')
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->orderBy('id')
            ->get(['id'])
            ->each(function ($order) use ($productionBranchId, $timestamp) {
                DB::table('order_items')
                    ->where('order_id', $order->id)
                    ->orderBy('id')
                    ->pluck('id')
                    ->each(function ($orderItemId) use ($order, $productionBranchId, $timestamp) {
                        DB::table('work_orders')->insertOrIgnore([
                            'order_id' => $order->id,
                            'order_item_id' => $orderItemId,
                            'production_branch_id' => $productionBranchId,
                            'status' => 'waiting_design',
                            'created_at' => $timestamp,
                            'updated_at' => $timestamp,
                        ]);
                    });
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_item_designs');
        Schema::dropIfExists('work_orders');
    }
};
