<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('customer_upload_token_hash', 64)->nullable()->unique();
            $table->timestamp('customer_upload_token_expires_at')->nullable();
            $table->timestamp('completed_confirmed_at')->nullable();
            $table->foreignId('completed_confirmed_by')->nullable()
                ->constrained('users')->nullOnDelete();
        });

        Schema::create('order_customer_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_item_id')->nullable()->constrained()->nullOnDelete();
            $table->string('file_path');
            $table->string('original_filename');
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('file_size');
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index(['order_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_customer_files');

        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('completed_confirmed_by');
            $table->dropUnique(['customer_upload_token_hash']);
            $table->dropColumn([
                'customer_upload_token_hash',
                'customer_upload_token_expires_at',
                'completed_confirmed_at',
            ]);
        });
    }
};
