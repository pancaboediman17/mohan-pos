<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('sender_name');
            $table->text('body');
            $table->timestamps();

            $table->index(['id', 'created_at']);
        });

        Schema::create('business_profiles', function (Blueprint $table) {
            $table->id();
            $table->string('business_name', 120);
            $table->string('phone', 30)->nullable();
            $table->string('email')->nullable();
            $table->text('address')->nullable();
            $table->timestamps();
        });

        DB::table('business_profiles')->insert([
            'id' => 1,
            'business_name' => 'PRINTFLOW POS',
            'phone' => null,
            'email' => null,
            'address' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('business_profiles');
        Schema::dropIfExists('chat_messages');
    }
};
