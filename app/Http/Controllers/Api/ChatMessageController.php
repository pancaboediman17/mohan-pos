<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use Illuminate\Http\Request;

class ChatMessageController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'after_id' => ['nullable', 'integer', 'min:0'],
        ]);

        $query = ChatMessage::query();
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

    public function store(Request $request)
    {
        $request->merge([
            'body' => trim((string) $request->input('body', '')),
        ]);
        $validated = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $user = $request->user();
        $message = ChatMessage::create([
            'user_id' => $user->id,
            'sender_name' => $user->name,
            'body' => $validated['body'],
        ]);

        return response()->json([
            'message' => 'Pesan berhasil dikirim.',
            'data' => $this->messageData($message, true),
        ], 201);
    }

    private function messageData(ChatMessage $message, bool $isMine): array
    {
        return [
            'id' => $message->id,
            'user_id' => $message->user_id,
            'sender_name' => $message->sender_name,
            'body' => $message->body,
            'created_at' => $message->created_at,
            'is_mine' => $isMine,
        ];
    }
}
