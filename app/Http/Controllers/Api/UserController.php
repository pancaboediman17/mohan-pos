<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    private function allowedRoles(Request $request): array
    {
        return $request->user()->hasRole('Owner')
            ? ['Owner', 'Admin', 'Kasir', 'Operator Produksi', 'Desainer', 'HR']
            : ['Kasir', 'Operator Produksi', 'Desainer', 'HR'];
    }

    private function authorizeTarget(Request $request, User $user): void
    {
        if (
            !$request->user()->hasRole('Owner') &&
            $user->hasAnyRole(['Owner', 'Admin'])
        ) {
            abort(403, 'Anda tidak memiliki izin mengelola akun ini.');
        }
    }

    public function index(Request $request)
    {
        $users = User::with(['roles', 'branch'])
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->when($request->role, function ($query, $role) {
                $query->role($role);
            })
            ->when($request->has('status'), function ($query) use ($request) {
                $query->where('is_active', $request->boolean('status'));
            })
            ->latest()
            ->paginate(10);

        return response()->json([
            'success' => true,
            'data' => $users,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => [
                'required',
                'string',
                Rule::in($this->allowedRoles($request)),
                Rule::exists('roles', 'name')->where('guard_name', 'web'),
            ],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $user = DB::transaction(function () use ($validated) {
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'branch_id' => $validated['branch_id'] ?? null,
                'is_active' => $validated['is_active'] ?? true,
            ]);

            $user->syncRoles([$validated['role']]);

            return $user;
        });

        return response()->json([
            'success' => true,
            'message' => 'Pengguna berhasil dibuat.',
            'data' => $user->load(['roles', 'branch']),
        ], 201);
    }

    public function show(Request $request, User $user)
    {
        $this->authorizeTarget($request, $user);

        return response()->json([
            'success' => true,
            'data' => $user->load(['roles', 'branch']),
        ]);
    }

    public function update(Request $request, User $user)
    {
        $this->authorizeTarget($request, $user);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => [
                'sometimes',
                'required',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user->id),
            ],
            'password' => ['sometimes', 'nullable', 'string', 'min:8'],
            'role' => [
                'sometimes',
                'required',
                'string',
                Rule::in($this->allowedRoles($request)),
                Rule::exists('roles', 'name')->where('guard_name', 'web'),
            ],
            'branch_id' => ['sometimes', 'nullable', 'integer', 'exists:branches,id'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (
            $user->id === $request->user()->id &&
            isset($validated['is_active']) &&
            $validated['is_active'] === false
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak dapat menonaktifkan akun sendiri.',
            ], 422);
        }

        DB::transaction(function () use ($validated, $user) {
            $data = collect($validated)
                ->only(['name', 'email', 'branch_id', 'is_active'])
                ->toArray();

            if (!empty($validated['password'])) {
                $data['password'] = Hash::make($validated['password']);
            }

            $user->update($data);

            if (isset($validated['role'])) {
                $user->syncRoles([$validated['role']]);
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Pengguna berhasil diperbarui.',
            'data' => $user->fresh()->load(['roles', 'branch']),
        ]);
    }
}
