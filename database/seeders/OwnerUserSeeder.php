<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class OwnerUserSeeder extends Seeder
{
    public function run(): void
    {
        $name = env('OWNER_NAME');
        $email = env('OWNER_EMAIL');
        $password = env('OWNER_PASSWORD');

        if (!$name || !$email || !$password) {
            throw new \RuntimeException(
                'OWNER_NAME, OWNER_EMAIL, dan OWNER_PASSWORD wajib diisi di .env'
            );
        }

        $user = User::updateOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password' => Hash::make($password),
            ]
        );

        $ownerRole = Role::where('name', 'Owner')
            ->where('guard_name', 'web')
            ->firstOrFail();

        $user->syncRoles([$ownerRole]);

        $this->command->info("Akun Owner berhasil disiapkan: {$email}");
    }
}
