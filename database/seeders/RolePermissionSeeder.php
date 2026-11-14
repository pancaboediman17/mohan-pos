<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            'dashboard.view',
            'orders.view',
            'orders.create',
            'orders.edit',
            'orders.delete',
            'payments.view',
            'payments.create',
            'customers.view',
            'customers.manage',
            'products.view',
            'products.manage',
            'branches.view',
            'branches.manage',
            'suppliers.view',
            'suppliers.manage',
            'production.view',
            'production.manage',
            'designs.manage',
            'inventory.view',
            'inventory.manage',
            'inventory.consume',
            'reports.view',
            'users.view',
            'users.manage',
            'hr.manage',
            'chat.access',
            'settings.manage',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }

        $roles = [
            'Owner' => $permissions,

            'Admin' => [
                'dashboard.view',
                'orders.view',
                'orders.create',
                'orders.edit',
                'orders.delete',
                'payments.view',
                'payments.create',
                'customers.view',
                'customers.manage',
                'products.view',
                'products.manage',
                'branches.view',
                'branches.manage',
                'suppliers.view',
                'suppliers.manage',
                'production.view',
                'production.manage',
                'designs.manage',
                'inventory.view',
                'inventory.manage',
                'inventory.consume',
                'reports.view',
                'users.view',
                'users.manage',
                'chat.access',
            ],

            'Kasir' => [
                'dashboard.view',
                'orders.view',
                'orders.create',
                'orders.edit',
                'payments.view',
                'payments.create',
                'customers.view',
                'customers.manage',
                'products.view',
                'branches.view',
                'suppliers.view',
                'chat.access',
            ],

            'Operator Produksi' => [
                'dashboard.view',
                'orders.view',
                'production.view',
                'production.manage',
                'designs.manage',
                'inventory.view',
                'inventory.consume',
                'chat.access',
            ],

            'Desainer' => [
                'dashboard.view',
                'orders.view',
                'production.view',
                'designs.manage',
                'chat.access',
            ],

            'HR' => [
                'hr.manage',
            ],
        ];

        foreach ($roles as $roleName => $rolePermissions) {
            $role = Role::firstOrCreate([
                'name' => $roleName,
                'guard_name' => 'web',
            ]);

            $role->syncPermissions($rolePermissions);
        }

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }
}
