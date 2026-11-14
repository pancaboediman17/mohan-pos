<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BusinessProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_load_and_update_the_business_profile(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $owner = User::factory()->create();
        $owner->assignRole('Owner');

        $this->actingAs($owner)
            ->getJson('/api/v1/business-profile')
            ->assertOk()
            ->assertJsonPath('data.business_name', "MOHAN Digital Lab's");

        $this->putJson('/api/v1/business-profile', [
            'business_name' => 'Mohan Print Studio',
            'phone' => '0215550101',
            'email' => 'info@example.test',
            'address' => 'Jl. Merdeka 10',
        ])
            ->assertOk()
            ->assertJsonPath('data.business_name', 'Mohan Print Studio');

        $this->assertDatabaseHas('business_profiles', [
            'id' => 1,
            'business_name' => 'Mohan Print Studio',
            'phone' => '0215550101',
        ]);
    }

    public function test_business_profile_is_restricted_to_settings_managers_and_validates_email(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $this->getJson('/api/v1/public/business-profile')
            ->assertOk()
            ->assertJsonPath('data.business_name', "MOHAN Digital Lab's");

        $cashier = User::factory()->create();
        $cashier->assignRole('Kasir');

        $this->actingAs($cashier)
            ->getJson('/api/v1/business-profile')
            ->assertForbidden();

        $owner = User::factory()->create();
        $owner->assignRole('Owner');
        $this->actingAs($owner)
            ->putJson('/api/v1/business-profile', [
                'business_name' => 'Studio',
                'phone' => null,
                'email' => 'not-an-email',
                'address' => null,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->assertDatabaseHas('business_profiles', [
            'id' => 1,
            'business_name' => "MOHAN Digital Lab's",
        ]);
    }
}
