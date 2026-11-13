<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('order_id')
                ->constrained('orders')->cascadeOnDelete();

            $table->foreignId('product_id')->nullable()
                ->constrained('products')->nullOnDelete();

            // Snapshot data produk saat transaksi
            $table->string('product_code', 40)->nullable();
            $table->string('product_name', 150);
            $table->string('unit_name', 50)->nullable();

            $table->decimal('quantity', 12, 3)->default(1);
            $table->decimal('width', 12, 2)->nullable();
            $table->decimal('height', 12, 2)->nullable();

            $table->decimal('unit_price', 14, 2)->default(0);
            $table->decimal('unit_cost', 14, 2)->default(0);
            $table->decimal('subtotal', 14, 2)->default(0);

            $table->text('specifications')->nullable();
            $table->text('notes')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
    }
};
