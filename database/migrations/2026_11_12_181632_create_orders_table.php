<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number', 40)->unique();

            $table->foreignId('branch_id')->nullable()
                ->constrained('branches')->nullOnDelete();

            $table->foreignId('customer_id')->nullable()
                ->constrained('customers')->nullOnDelete();

            $table->foreignId('created_by')->nullable()
                ->constrained('users')->nullOnDelete();

            $table->decimal('subtotal', 14, 2)->default(0);
            $table->decimal('discount', 14, 2)->default(0);
            $table->decimal('total', 14, 2)->default(0);
            $table->decimal('paid_amount', 14, 2)->default(0);
            $table->decimal('balance', 14, 2)->default(0);

            $table->string('status', 30)->default('pending')->index();
            $table->string('payment_status', 30)->default('unpaid')->index();

            $table->text('notes')->nullable();
            $table->date('due_date')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['branch_id', 'created_at']);
            $table->index(['customer_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
