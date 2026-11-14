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

    public function test_users_can_exchange_private_messages_without_exposing_them_to_the_team(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $sender = User::factory()->create(['name' => 'Kasir']);
        $sender->assignRole('Kasir');
        $recipient = User::factory()->create(['name' => 'Desainer']);
        $recipient->assignRole('Desainer');
        $otherUser = User::factory()->create(['name' => 'Operator']);
        $otherUser->assignRole('Operator Produksi');

        $sent = $this->actingAs($sender)
            ->postJson('/api/v1/chat/messages', [
                'body' => 'File desain sudah saya kirim.',
                'recipient_id' => $recipient->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.recipient_id', $recipient->id)
            ->assertJsonPath('data.is_mine', true);
        $messageId = $sent->json('data.id');

        $this->actingAs($recipient)
            ->getJson('/api/v1/chat/messages?conversation_with='.$sender->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.body', 'File desain sudah saya kirim.')
            ->assertJsonPath('data.0.is_mine', false);

        $this->actingAs($otherUser)
            ->getJson('/api/v1/chat/messages?conversation_with='.$sender->id)
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAs($sender)
            ->getJson('/api/v1/chat/messages')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $reply = $this->actingAs($recipient)
            ->postJson('/api/v1/chat/messages', [
                'body' => 'Baik, saya cek sekarang.',
                'recipient_id' => $sender->id,
            ])
            ->assertCreated();

        $this->actingAs($sender)
            ->getJson('/api/v1/chat/messages?conversation_with='.$recipient->id.'&after_id='.$messageId)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $reply->json('data.id'))
            ->assertJsonPath('data.0.is_mine', false);
    }

    public function test_chat_contacts_only_include_other_active_chat_members(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $user = User::factory()->create();
        $user->assignRole('Kasir');
        $contact = User::factory()->create(['name' => 'Operator Aktif']);
        $contact->assignRole('Operator Produksi');
        $inactive = User::factory()->create(['is_active' => false]);
        $inactive->assignRole('Desainer');
        User::factory()->create(['name' => 'Tanpa Akses Chat']);

        $this->actingAs($user)
            ->getJson('/api/v1/chat/contacts')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $contact->id)
            ->assertJsonPath('data.0.name', 'Operator Aktif');
    }

    public function test_chat_unread_counts_clear_per_conversation_and_contacts_show_presence(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $sender = User::factory()->create(['name' => 'Pengirim']);
        $sender->assignRole('Kasir');
        $recipient = User::factory()->create(['name' => 'Penerima']);
        $recipient->assignRole('Desainer');

        $this->actingAs($sender)
            ->postJson('/api/v1/chat/messages', ['body' => 'Pesan untuk tim.'])
            ->assertCreated();
        $this->postJson('/api/v1/chat/messages', [
            'body' => 'Pesan pribadi.',
            'recipient_id' => $recipient->id,
        ])->assertCreated();
        $this->postJson('/api/v1/chat/presence', ['online' => true])
            ->assertOk()
            ->assertJsonPath('data.is_online', true);

        $this->actingAs($recipient)
            ->getJson('/api/v1/chat/unread')
            ->assertOk()
            ->assertJsonPath('data.team_unread_count', 1)
            ->assertJsonPath('data.direct_unread_counts.'.$sender->id, 1)
            ->assertJsonPath('data.total_unread_count', 2);

        $this->getJson('/api/v1/chat/contacts')
            ->assertOk()
            ->assertJsonFragment([
                'id' => $sender->id,
                'is_online' => true,
                'unread_count' => 1,
            ]);

        $this->postJson('/api/v1/chat/read', [
            'conversation_with' => $sender->id,
        ])->assertOk()
            ->assertJsonPath('data.team_unread_count', 1)
            ->assertJsonPath('data.total_unread_count', 1);

        $this->postJson('/api/v1/chat/read', [])
            ->assertOk()
            ->assertJsonPath('data.team_unread_count', 0)
            ->assertJsonPath('data.total_unread_count', 0);

        $sender->forceFill([
            'chat_last_seen_at' => now()->subMinutes(3),
        ])->save();
        $this->getJson('/api/v1/chat/contacts')
            ->assertOk()
            ->assertJsonFragment([
                'id' => $sender->id,
                'is_online' => false,
                'unread_count' => 0,
            ]);
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
