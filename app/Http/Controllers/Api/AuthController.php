<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Login pengguna.
     */
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $credentials['email'])->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Email atau password tidak sesuai.'],
            ]);
        }

        if (!$user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Akun Anda sedang dinonaktifkan. Hubungi administrator.']
            ]);
        }

        // Hapus token lama untuk menjaga satu sesi aktif per perangkat ini.
        $user->tokens()
            ->where('name', 'printflow-web')
            ->delete();

        $token = $user->createToken('printflow-web')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login berhasil.',
            'token' => $token,
            'user' => $this->userData($user),
        ]);
    }

    /**
     * Data pengguna yang sedang login.
     */
    public function me(Request $request)
    {
        return response()->json([
            'success' => true,
            'user' => $this->userData($request->user()),
        ]);
    }

    /**
     * Logout pengguna.
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logout berhasil.',
        ]);
    }

    /**
     * Format data pengguna dan hak akses.
     */
    private function userData(User $user): array
    {
        $user->loadMissing('branch');

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'branch' => $user->branch ? [
                'id' => $user->branch->id,
                'code' => $user->branch->code,
                'name' => $user->branch->name,
            ] : null,
            'roles' => $user->getRoleNames(),
            'permissions' => $user->getAllPermissions()
                ->pluck('name')
                ->values(),
        ];
    }
}
