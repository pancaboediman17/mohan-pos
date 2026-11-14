# MOHAN Digital Lab's

Sistem operasional percetakan berbasis Laravel API dan React untuk pesanan, pembayaran, produksi, inventory, laporan, dan pengelolaan karyawan.

## Modul

- POS: pesanan, pelanggan, produk/jasa, pembayaran, kuitansi, dan invoice.
- Produksi: work order, persetujuan desain/penawaran, finishing, dan pemakaian material.
- Alur file pelanggan: admin membagikan tautan unggah yang berlaku 30 hari; file referensi tersimpan privat dan dapat diunduh oleh admin serta produksi.
- Serah-terima produksi: operator menerima Work Order sebelum memulai, lalu menyelesaikan tahap cetak, finishing, dan QC. Setelah semua item selesai, admin mengonfirmasi pesanan dan dapat membuka WhatsApp dengan pesan siap kirim; pengiriman pesan tetap dilakukan manual.
- Marketplace: impor CSV berformat template MOHAN Digital Lab's untuk Shopee, Tokopedia, TikTok Shop, dan Lazada; pesanan wajib ditinjau staf sebelum masuk alur desain/produksi.
- Pengiriman: alamat, kurir, resi, ongkir, dan status dicatat manual pada detail pesanan. Belum ada booking kurir, pelacakan otomatis, atau sinkronisasi marketplace.
- Operasional: cabang, supplier, mesin, laporan, dan chat internal.
- HR: karyawan, absensi manual atau impor CSV, cuti, payroll, bonus, dan slip gaji.

Payroll saat ini dikelola HR secara manual. Pajak dan BPJS tidak dihitung otomatis. Impor absensi menerima CSV sesuai template di laman HR; baris duplikat dilewati dan data lama tidak ditimpa.

Impor marketplace memakai template CSV MOHAN Digital Lab's yang bisa diunduh dari laman Pesanan (satu baris per item; kolom pesanan diulang untuk setiap item). Kode produk harus cocok dengan SKU aktif. SKU tidak dikenal menolak seluruh pesanan terkait. Status pembayaran marketplace hanya disimpan sebagai informasi pembeli dan tidak dicatat sebagai penerimaan atau settlement.

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
