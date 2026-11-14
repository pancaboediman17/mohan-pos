<?php

namespace Tests\Feature;

use App\Models\FinishingType;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FinishingTypeManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_production_manager_can_manage_finishing_types(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('Admin');

        $response = $this->actingAs($admin)
            ->postJson('/api/v1/finishing-types', [
                'name' => 'Laminasi Doff',
                'code' => 'LAM-DOFF',
                'description' => 'Laminasi matte',
                'default_cost' => 1500,
                'is_active' => true,
            ]);

        $response->assertCreated()
            ->assertJsonPath('data.name', 'Laminasi Doff')
            ->assertJsonPath('data.code', 'LAM-DOFF');

        $finishingType = FinishingType::query()->firstOrFail();

        $this->putJson('/api/v1/finishing-types/'.$finishingType->id, [
            'name' => 'Laminasi Glossy',
            'code' => 'LAM-GLOSSY',
            'description' => null,
            'default_cost' => 2000,
            'is_active' => true,
        ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Laminasi Glossy');

        $this->deleteJson('/api/v1/finishing-types/'.$finishingType->id)
            ->assertOk();

        $this->assertSoftDeleted('finishing_types', [
            'id' => $finishingType->id,
        ]);
    }

    public function test_production_viewer_can_list_but_cannot_manage_finishing_types(): void
    {
        $this->seed(RolePermissionSeeder::class);

        FinishingType::create([
            'name' => 'Potong',
            'code' => 'POTONG',
            'default_cost' => 0,
            'is_active' => true,
        ]);

        $designer = User::factory()->create();
        $designer->assignRole('Desainer');

        $this->actingAs($designer)
            ->getJson('/api/v1/finishing-types')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Potong');

        $this->postJson('/api/v1/finishing-types', [
            'name' => 'Laminasi',
            'code' => 'LAM',
            'default_cost' => 1000,
        ])->assertForbidden();
    }
}
