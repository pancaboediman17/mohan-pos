<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cash_register_shifts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('active_user_id')->nullable()->unique()
                ->constrained('users')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()
                ->constrained()->nullOnDelete();
            $table->decimal('opening_cash', 14, 2);
            $table->decimal('closing_cash', 14, 2)->nullable();
            $table->decimal('cash_received', 14, 2)->default(0);
            $table->decimal('total_received', 14, 2)->default(0);
            $table->decimal('cash_variance', 14, 2)->nullable();
            $table->text('opening_notes')->nullable();
            $table->text('closing_notes')->nullable();
            $table->string('status', 20)->default('open');
            $table->timestamp('opened_at');
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'opened_at']);
            $table->index(['branch_id', 'opened_at']);
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('cash_register_shift_id')->nullable()
                ->after('received_by')
                ->constrained('cash_register_shifts')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cash_register_shift_id');
        });

        Schema::dropIfExists('cash_register_shifts');
    }
};
