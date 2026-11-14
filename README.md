# PRINTFLOW POS

Sistem operasional percetakan berbasis Laravel API dan React untuk pesanan, pembayaran, produksi, inventory, laporan, dan pengelolaan karyawan.

## Modul

- POS: pesanan, pelanggan, produk/jasa, pembayaran, kuitansi, dan invoice.
- Produksi: work order, persetujuan desain/penawaran, finishing, dan pemakaian material.
- Operasional: cabang, supplier, mesin, laporan, dan chat internal.
- HR: karyawan, absensi manual atau impor CSV, cuti, payroll, bonus, dan slip gaji.

Payroll saat ini dikelola HR secara manual. Pajak dan BPJS tidak dihitung otomatis. Impor absensi menerima CSV sesuai template di laman HR; baris duplikat dilewati dan data lama tidak ditimpa.

## Teknologi dan prasyarat

- PHP 8.2+, Composer, Node.js/npm.
- Laravel 12, React 19, Vite 7, Tailwind CSS 4.
- MySQL atau SQLite sesuai konfigurasi `.env`; tes menggunakan SQLite in-memory.

## Menyiapkan lingkungan lokal

1. Instal dependensi:

   ```sh
   composer install
   npm install
   ```

2. Salin `.env.example` menjadi `.env`, lalu atur koneksi database dan `APP_URL`.
3. Buat application key:

   ```sh
   php artisan key:generate
   ```

4. Jalankan migrasi:

   ```sh
   php artisan migrate
   ```

5. Untuk membuat akun Owner awal, isi `OWNER_NAME`, `OWNER_EMAIL`, dan `OWNER_PASSWORD` di `.env`, kemudian jalankan:

   ```sh
   php artisan db:seed
   ```

   Jangan masukkan kredensial nyata ke Git.

6. Jalankan server Laravel dan Vite di dua terminal:

   ```sh
   php artisan serve
   ```

   ```sh
   npm run dev
   ```

Untuk membuat bundle produksi, jalankan `npm run build`.

## Pengujian

```sh
php artisan test
```

Tes memakai database SQLite in-memory yang dikonfigurasi di `phpunit.xml`; data database aplikasi tidak digunakan oleh tes.
