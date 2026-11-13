<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_category_id')
                ->constrained('product_categories')
                ->restrictOnDelete();

            $table->foreignId('unit_id')
                ->constrained('units')
                ->restrictOnDelete();

            $table->string('product_code', 40)->unique();
            $table->string('name', 150);
            $table->text('description')->nullable();

            $table->decimal('selling_price', 14, 2)->default(0);
            $table->decimal('estimated_cost', 14, 2)->default(0);

            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
            $table->softDeletes();

            $table->index('name');
            $table->index('product_category_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
