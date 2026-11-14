<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_shipments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->unique()
                ->constrained('orders')->cascadeOnDelete();
            $table->string('recipient_name', 150)->nullable();
            $table->string('recipient_phone', 25)->nullable();
            $table->text('shipping_address')->nullable();
            $table->string('courier', 80)->nullable();
            $table->string('service_name', 80)->nullable();
            $table->string('tracking_number', 100)->nullable();
            $table->decimal('shipping_fee', 14, 2)->default(0);
            $table->string('status', 30)->default('pending')->index();
            $table->text('notes')->nullable();
            $table->foreignId('updated_by')->nullable()
                ->constrained('users')->nullOnDelete();
            $table->timestamp('booked_at')->nullable();
            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_shipments');
    }
};
