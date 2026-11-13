<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_cost_components', function (Blueprint $table) {
            $table->id();

            $table->foreignId('product_id')
                ->constrained('products')
                ->cascadeOnDelete();

            $table->foreignId('unit_id')
                ->nullable()
                ->constrained('units')
                ->nullOnDelete();

            $table->string('name', 150);

            $table->string('component_type', 30)->default('material');

            $table->decimal('quantity', 12, 3)->default(1);
            $table->decimal('unit_cost', 14, 2)->default(0);
            $table->decimal('total_cost', 14, 2)->default(0);

            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['product_id', 'component_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_cost_components');
    }
};
