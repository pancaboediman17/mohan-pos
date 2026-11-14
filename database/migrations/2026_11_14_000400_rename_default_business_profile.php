<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('business_profiles')
            ->where('id', 1)
            ->update([
                'business_name' => "MOHAN Digital Lab's",
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('business_profiles')
            ->where('business_name', "MOHAN Digital Lab's")
            ->update([
                'business_name' => 'PRINTFLOW POS',
                'updated_at' => now(),
            ]);
    }
};
