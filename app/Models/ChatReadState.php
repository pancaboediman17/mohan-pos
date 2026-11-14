<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChatReadState extends Model
{
    protected $fillable = [
        'user_id',
        'conversation_type',
        'peer_user_id',
        'last_read_message_id',
    ];
}
