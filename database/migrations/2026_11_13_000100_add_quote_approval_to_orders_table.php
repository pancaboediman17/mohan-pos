<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('quote_status', 20)->default('pending')->index();
            $table->string('quote_approval_token_hash', 64)->nullable()->unique();
            $table->timestamp('quote_approved_at')->nullable();
            $table->timestamp('quote_rejected_at')->nullable();
            $table->text('quote_response_note')->nullable();
        });

        DB::table('orders')->update([
            'quote_status' => 'approved',
            'quote_approved_at' => DB::raw('created_at'),
        ]);
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique(['quote_approval_token_hash']);
            $table->dropIndex(['quote_status']);
            $table->dropColumn([
                'quote_status',
                'quote_approval_token_hash',
                'quote_approved_at',
                'quote_rejected_at',
                'quote_response_note',
            ]);
        });
    }
};
