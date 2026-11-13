<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->string('payment_number', 40)->unique();

            $table->foreignId('order_id')
                ->constrained('orders')->cascadeOnDelete();

            $table->foreignId('received_by')->nullable()
                ->constrained('users')->nullOnDelete();

            $table->decimal('amount', 14, 2);
            $table->string('method', 30);
            $table->string('reference_number', 100)->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('paid_at');

            $table->timestamps();

            $table->index(['order_id', 'paid_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
