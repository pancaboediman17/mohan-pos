<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_item_finishings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_item_id')
                ->constrained('order_items')
                ->cascadeOnDelete();
            $table->foreignId('finishing_type_id')
                ->nullable()
                ->constrained('finishing_types')
                ->nullOnDelete();
            $table->string('finishing_name', 100);
            $table->string('finishing_code', 30);
            $table->decimal('unit_cost', 14, 2)->default(0);
            $table->timestamps();

            $table->unique(['order_item_id', 'finishing_type_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_item_finishings');
    }
};
