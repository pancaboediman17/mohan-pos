<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BusinessProfile;
use Illuminate\Http\Request;

class BusinessProfileController extends Controller
{
    public function publicShow()
    {
        return response()->json([
            'data' => BusinessProfile::query()
                ->findOrFail(1)
                ->only(['business_name', 'phone', 'email', 'address']),
        ]);
    }

    public function show()
    {
        return response()->json([
            'data' => BusinessProfile::query()->findOrFail(1),
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'business_name' => ['required', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:1000'],
        ]);

        $profile = BusinessProfile::query()->findOrFail(1);
        $profile->update($validated);

        return response()->json([
            'message' => 'Profil usaha berhasil disimpan.',
            'data' => $profile->fresh(),
        ]);
    }
}
