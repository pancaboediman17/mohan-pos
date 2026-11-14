<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('chat_last_seen_at')->nullable();
        });

        Schema::create('chat_read_states', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('conversation_type', 10);
            $table->unsignedBigInteger('peer_user_id')->default(0);
            $table->unsignedBigInteger('last_read_message_id')->default(0);
            $table->timestamps();

            $table->unique(['user_id', 'conversation_type', 'peer_user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_read_states');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('chat_last_seen_at');
        });
    }
};
