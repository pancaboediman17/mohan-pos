<?php

namespace Tests\Feature;

use App\Models\ChatMessage;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChatMessageTest extends TestCase
{
    use RefreshDatabase;

    public function test_team_members_can_send_and_poll_internal_messages(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $sender = User::factory()->create(['name' => 'Operator A']);
        $sender->assignRole('Operator Produksi');
        $recipient = User::factory()->create(['name' => 'Desainer B']);
        $recipient->assignRole('Desainer');

        $sent = $this->actingAs($sender)
            ->postJson('/api/v1/chat/messages', ['body' => '  Pesanan poster siap dicetak.  '])
            ->assertCreated()
            ->assertJsonPath('data.sender_name', 'Operator A')
            ->assertJsonPath('data.body', 'Pesanan poster siap dicetak.')
            ->assertJsonPath('data.is_mine', true);
        $messageId = $sent->json('data.id');

        $this->actingAs($recipient)
            ->getJson('/api/v1/chat/messages?after_id='.$messageId)
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $secondMessage = ChatMessage::create([
            'user_id' => $sender->id,
            'sender_name' => $sender->name,
            'body' => 'QC sudah selesai.',
        ]);
        $this->actingAs($recipient)
            ->getJson('/api/v1/chat/messages?after_id='.$messageId)
            ->assertOk()
            ->assertJsonPath('data.0.id', $secondMessage->id)
            ->assertJsonPath('data.0.is_mine', false);
    }

    public function test_chat_requires_permission_and_rejects_empty_or_oversized_messages(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/v1/chat/messages')
            ->assertForbidden();

        $member = User::factory()->create();
        $member->assignRole('Kasir');

        $this->actingAs($member)
            ->postJson('/api/v1/chat/messages', ['body' => '   '])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('body');

        $this->postJson('/api/v1/chat/messages', ['body' => str_repeat('x', 2001)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('body');
    }
}
