<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration { public function up(): void { Schema::create('finishing_types', function (Blueprint $table) { $table->id(); $table->string('name',100)->unique(); $table->string('code',30)->unique(); $table->text('description')->nullable(); $table->decimal('default_cost',14,2)->default(0); $table->boolean('is_active')->default(true)->index(); $table->timestamps(); $table->softDeletes(); }); } public function down(): void { Schema::dropIfExists('finishing_types'); } };
