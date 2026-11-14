<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('sales_channel', 30)->default('pos')->after('order_number');
            $table->string('external_order_id', 100)->nullable()->after('sales_channel');
            $table->date('external_order_date')->nullable()->after('external_order_id');
            $table->string('channel_payment_status', 20)->nullable()->after('payment_status');
            $table->unique(['sales_channel', 'external_order_id']);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique(['sales_channel', 'external_order_id']);
            $table->dropColumn([
                'sales_channel',
                'external_order_id',
                'external_order_date',
                'channel_payment_status',
            ]);
        });
    }
};
