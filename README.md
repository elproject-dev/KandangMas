# Kantong Mas 💰

Aplikasi Point of Sales (POS) modern yang dirancang khusus untuk efisiensi transaksi penjualan. Dibangun menggunakan teknologi web terkini dan siap dijalankan sebagai aplikasi Android menggunakan Capacitor.

## 🚀 Fitur Utama

- **Dashboard Real-time**: Pantau ringkasan pendapatan, jumlah transaksi, dan grafik penjualan secara instan.
- **Sistem Kasir (POS)**: Antarmuka kasir yang intuitif dengan fitur varian harga produk.
- **Manajemen Pelanggan**: Kelola data pelanggan setia lengkap dengan riwayat order dan statistik kunjungan.
- **Riwayat Transaksi**: Lacak semua transaksi yang telah dilakukan dengan detail item yang lengkap.
- **Laporan Excel**: Generate laporan penjualan periodik (bulanan/tahunan) langsung ke format Excel.
- **Mode Admin**: Fitur khusus untuk pemilik toko untuk mengelola data sensitif.
- **Multi-Theme**: Mendukung mode terang dan gelap (Light/Dark mode).

## 🛠️ Stack Teknologi

- **Frontend**: React.js dengan Vite
- **Styling**: TailwindCSS & shadcn/ui
- **Database & Auth**: Supabase
- **Mobile Wrapper**: Capacitor (Android)
- **Charts**: Recharts
- **Excel Handling**: ExcelJS

## 📦 Cara Instalasi & Pengembangan

### Prasyarat
- Node.js (versi terbaru direkomendasikan)
- Akun Supabase (untuk database)

### Langkah-langkah
1. **Clone Repository**
   ```bash
   git clone https://github.com/elproject-dev/KandangMas.git
   cd KandangMas
   ```

2. **Instal Dependensi**
   ```bash
   npm install
   ```

3. **Konfigurasi Environment**
   Buat file `.env` di direktori root dan tambahkan kredensial Supabase Anda:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Jalankan Mode Pengembangan**
   ```bash
   npm run dev
   ```

5. **Build untuk Produksi**
   ```bash
   npm run build
   ```

## 📱 Build untuk Android

Jika Anda ingin menjalankan aplikasi ini di Android:
```bash
# Copy hasil build ke folder android
npx cap copy android

# Buka proyek di Android Studio
npx cap open android
```

---
Dibuat dengan ❤️ oleh **elproject-dev**
