<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\ChatReadState;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ChatMessageController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'after_id' => ['nullable', 'integer', 'min:0'],
            'conversation_with' => [
                'nullable',
                'integer',
                'min:1',
                'exists:users,id',
                'not_in:'.$request->user()->id,
            ],
        ]);

        $query = ChatMessage::query();
        if (isset($validated['conversation_with'])) {
            $contact = $this->findAvailableContact(
                $validated['conversation_with'],
                $request->user()->id,
            );
            $query->where(function ($messages) use ($request, $contact) {
                $messages
                    ->where(function ($sent) use ($request, $contact) {
                        $sent
                            ->where('user_id', $request->user()->id)
                            ->where('recipient_id', $contact->id);
                    })
                    ->orWhere(function ($received) use ($request, $contact) {
                        $received
                            ->where('user_id', $contact->id)
                            ->where('recipient_id', $request->user()->id);
                    });
            });
        } else {
            $query->whereNull('recipient_id');
        }

        if (isset($validated['after_id'])) {
            $messages = $query
                ->where('id', '>', $validated['after_id'])
                ->orderBy('id')
                ->limit(100)
                ->get();
        } else {
            $messages = $query
                ->latest('id')
                ->limit(50)
                ->get()
                ->reverse()
                ->values();
        }

        return response()->json([
            'data' => $messages->map(fn (ChatMessage $message) => $this->messageData(
                $message,
                $message->user_id === $request->user()->id,
            )),
        ]);
    }

    public function contacts(Request $request)
    {
        $user = $request->user();
        $unread = $this->unreadSummary($user);
        $contacts = User::permission('chat.access')
            ->where('is_active', true)
            ->whereKeyNot($user->id)
            ->with('branch:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'branch_id', 'chat_last_seen_at'])
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'branch_name' => $user->branch?->name,
                'is_online' => $user->chat_last_seen_at?->greaterThanOrEqualTo(
                    now()->subSeconds(120),
                ) ?? false,
                'unread_count' => $unread['direct_unread_counts'][$user->id] ?? 0,
            ]);

        return response()->json([
            'data' => $contacts,
            'meta' => $unread,
        ]);
    }

    public function unread(Request $request)
    {
        return response()->json([
            'data' => $this->unreadSummary($request->user()),
        ]);
    }

    public function presence(Request $request)
    {
        $validated = $request->validate([
            'online' => ['sometimes', 'boolean'],
        ]);
        $online = $validated['online'] ?? true;

        $request->user()->forceFill([
            'chat_last_seen_at' => $online ? now() : null,
        ])->save();

        return response()->json([
            'data' => ['is_online' => $online],
        ]);
    }

    public function markRead(Request $request)
    {
        $validated = $request->validate([
            'conversation_with' => [
                'nullable',
                'integer',
                'min:1',
                'exists:users,id',
                'not_in:'.$request->user()->id,
            ],
        ]);

        $user = $request->user();
        $conversationType = isset($validated['conversation_with'])
            ? 'direct'
            : 'team';
        $peerUserId = 0;

        $query = ChatMessage::query();
        if ($conversationType === 'direct') {
            $contact = $this->findAvailableContact(
                $validated['conversation_with'],
                $user->id,
            );
            $peerUserId = $contact->id;
            $query->where(function ($messages) use ($user, $contact) {
                $messages
                    ->where(function ($sent) use ($user, $contact) {
                        $sent
                            ->where('user_id', $user->id)
                            ->where('recipient_id', $contact->id);
                    })
                    ->orWhere(function ($received) use ($user, $contact) {
                        $received
                            ->where('user_id', $contact->id)
                            ->where('recipient_id', $user->id);
                    });
            });
        } else {
            $query->whereNull('recipient_id');
        }

        ChatReadState::updateOrCreate(
            [
                'user_id' => $user->id,
                'conversation_type' => $conversationType,
                'peer_user_id' => $peerUserId,
            ],
            ['last_read_message_id' => $query->max('id') ?? 0],
        );

        return response()->json([
            'data' => $this->unreadSummary($user),
        ]);
    }

    public function store(Request $request)
    {
        $request->merge([
            'body' => trim((string) $request->input('body', '')),
        ]);
        $validated = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
            'recipient_id' => [
                'nullable',
                'integer',
                'min:1',
                'exists:users,id',
                'not_in:'.$request->user()->id,
            ],
        ]);

        $user = $request->user();
        if (isset($validated['recipient_id'])) {
            $this->findAvailableContact($validated['recipient_id'], $user->id);
        }
        $message = ChatMessage::create([
            'user_id' => $user->id,
            'recipient_id' => $validated['recipient_id'] ?? null,
            'sender_name' => $user->name,
            'body' => $validated['body'],
        ]);

        return response()->json([
            'message' => 'Pesan berhasil dikirim.',
            'data' => $this->messageData($message, true),
        ], 201);
    }

    private function findAvailableContact(int $userId, int $currentUserId): User
    {
        return User::permission('chat.access')
            ->where('is_active', true)
            ->whereKeyNot($currentUserId)
            ->findOrFail($userId);
    }

    private function unreadSummary(User $user): array
    {
        $teamCursor = ChatReadState::query()
            ->where('user_id', $user->id)
            ->where('conversation_type', 'team')
            ->where('peer_user_id', 0)
            ->value('last_read_message_id') ?? 0;
        $teamUnreadCount = ChatMessage::query()
            ->whereNull('recipient_id')
            ->where('user_id', '!=', $user->id)
            ->where('id', '>', $teamCursor)
            ->count();

        $directUnreadCounts = DB::table('chat_messages as messages')
            ->leftJoin('chat_read_states as read_states', function ($join) use ($user) {
                $join
                    ->on('read_states.peer_user_id', '=', 'messages.user_id')
                    ->where('read_states.user_id', $user->id)
                    ->where('read_states.conversation_type', 'direct');
            })
            ->where('messages.recipient_id', $user->id)
            ->whereRaw('messages.id > COALESCE(read_states.last_read_message_id, 0)')
            ->selectRaw('messages.user_id, COUNT(*) as unread_count')
            ->groupBy('messages.user_id')
            ->pluck('unread_count', 'user_id')
            ->map(fn ($count) => (int) $count)
            ->all();

        return [
            'team_unread_count' => $teamUnreadCount,
            'direct_unread_counts' => $directUnreadCounts,
            'total_unread_count' => $teamUnreadCount + array_sum($directUnreadCounts),
        ];
    }

    private function messageData(ChatMessage $message, bool $isMine): array
    {
        return [
            'id' => $message->id,
            'user_id' => $message->user_id,
            'recipient_id' => $message->recipient_id,
            'sender_name' => $message->sender_name,
            'body' => $message->body,
            'created_at' => $message->created_at,
            'is_mine' => $isMine,
        ];
    }
}
