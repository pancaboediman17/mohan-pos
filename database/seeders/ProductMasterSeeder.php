<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\ProductCategory;
use App\Models\Unit;
use Illuminate\Support\Str;

class ProductMasterSeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            'Digital Printing' => 'Layanan cetak digital',
            'Offset Printing' => 'Layanan cetak offset',
            'Large Format Printing' => 'Banner, spanduk, dan media besar',
            'Merchandise' => 'Produk merchandise dan souvenir',
            'ATK' => 'Alat tulis dan perlengkapan kantor',
            'Finishing' => 'Layanan finishing percetakan',
            'Jasa Desain' => 'Layanan desain grafis',
        ];

        foreach ($categories as $name => $description) {
            ProductCategory::firstOrCreate(
                ['name' => $name],
                [
                    'slug' => Str::slug($name),
                    'description' => $description,
                    'is_active' => true,
                ]
            );
        }

        $units = [
            ['name' => 'Pieces', 'symbol' => 'pcs'],
            ['name' => 'Lembar', 'symbol' => 'lbr'],
            ['name' => 'Meter', 'symbol' => 'm'],
            ['name' => 'Meter Persegi', 'symbol' => 'm²'],
            ['name' => 'Box', 'symbol' => 'box'],
            ['name' => 'Rim', 'symbol' => 'rim'],
            ['name' => 'Paket', 'symbol' => 'paket'],
            ['name' => 'Set', 'symbol' => 'set'],
            ['name' => 'Roll', 'symbol' => 'roll'],
            ['name' => 'Unit', 'symbol' => 'unit'],
        ];

        foreach ($units as $unit) {
            Unit::firstOrCreate(
                ['symbol' => $unit['symbol']],
                [
                    'name' => $unit['name'],
                    'is_active' => true,
                ]
            );
        }
    }
}

