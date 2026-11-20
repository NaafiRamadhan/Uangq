# Uangq — keputusan desain

## Arah visual

Antarmuka mobile-first untuk pencatatan keuangan pribadi: bersih, tenang, dan mudah dibaca, dengan permukaan solid dan batas halus alih-alih efek dekoratif. Tidak menggunakan pola visual atau aset merek aplikasi lain.

## Token

- **Aksen:** biru terang `#3B82F6` pada mode terang dan biru muda `#93C5FD` pada mode gelap. Aksen dipakai untuk aksi, progres, dan penanda navigasi aktif.
- **Latar dan kartu terang:** latar putih `#FFFFFF`, kartu biru sangat muda `#F1F7FF`.
- **Latar dan kartu gelap:** latar hitam pekat `#050505`, kartu abu sangat gelap `#15171B`.
- **Teks biru terang:** gunakan biru tua `#1D4ED8` untuk teks, tautan, dan ikon pada permukaan terang; jangan gunakan aksen terang `#3B82F6` sebagai teks kecil.
- **Teks utama:** `#101828` pada terang dan `#F2F4F7` pada gelap. Teks sekunder: `#475569` pada terang dan `#B6C0CF` pada gelap.
- **Font:** IBM Plex Sans untuk judul dan isi; fallback sistem menjaga keterbacaan saat font eksternal tidak tersedia.
- **Skala:** spacing berbasis kelipatan 4px; radius 10/16/22px; ukuran teks 12/14/16/20/28px.
- **Mode:** pilihan awal mengikuti `prefers-color-scheme`; tombol di header memutar mode Sistem → Terang → Gelap → Sistem.

Token didefinisikan di `src/index.css`. `--color-accent` untuk aksen visual, sedangkan `--color-accent-text` untuk teks dan tautan agar kontrasnya tetap memadai. Komponen bersama ada di `src/components/ui.tsx`.

## Kontras warna

Rasio dihitung dengan rumus luminans relatif WCAG 2.x. Teks normal memenuhi AA (minimal 4.5:1); aksen visual untuk garis/progres memenuhi batas non-teks 3:1 pada permukaan terang.

| Pasangan warna (teks/aksen di atas permukaan) | Rasio |
|---|---:|
| Teks utama terang `#101828` / latar putih `#FFFFFF` | 17.75:1 |
| Teks utama terang `#101828` / kartu `#F1F7FF` | 16.47:1 |
| Teks sekunder terang `#475569` / latar putih `#FFFFFF` | 7.58:1 |
| Teks sekunder terang `#475569` / kartu `#F1F7FF` | 7.03:1 |
| Teks utama terang `#101828` / aksen lembut `#EAF3FF` | 15.86:1 |
| Teks sekunder terang `#475569` / aksen lembut `#EAF3FF` | 6.77:1 |
| Teks/tautan biru terang `#1D4ED8` / latar putih `#FFFFFF` | 6.70:1 |
| Teks/tautan biru terang `#1D4ED8` / kartu `#F1F7FF` | 6.22:1 |
| Teks biru terang `#1D4ED8` / aksen lembut `#EAF3FF` | 5.99:1 |
| Teks tombol terang `#0B1220` / aksen `#3B82F6` | 5.09:1 |
| Aksen visual terang `#3B82F6` / latar putih `#FFFFFF` | 3.68:1 |
| Aksen visual terang `#3B82F6` / kartu `#F1F7FF` | 3.41:1 |
| Aksen visual terang `#3B82F6` / aksen lembut `#EAF3FF` | 3.29:1 |
| Teks utama gelap `#F2F4F7` / latar hitam `#050505` | 18.50:1 |
| Teks utama gelap `#F2F4F7` / kartu `#15171B` | 16.29:1 |
| Teks sekunder gelap `#B6C0CF` / latar hitam `#050505` | 11.09:1 |
| Teks sekunder gelap `#B6C0CF` / kartu `#15171B` | 9.77:1 |
| Teks utama gelap `#F2F4F7` / aksen lembut `#102A48` | 13.17:1 |
| Teks sekunder gelap `#B6C0CF` / aksen lembut `#102A48` | 7.90:1 |
| Aksen/tautan biru muda `#93C5FD` / latar hitam `#050505` | 11.30:1 |
| Aksen/tautan biru muda `#93C5FD` / kartu `#15171B` | 9.95:1 |
| Aksen/tautan biru muda `#93C5FD` / aksen lembut `#102A48` | 8.05:1 |
| Teks tombol gelap `#0B1220` / aksen `#93C5FD` | 10.38:1 |
| Teks bahaya terang `#B42318` / kartu `#F1F7FF` | 6.10:1 |
| Teks bahaya terang `#B42318` / latar putih `#FFFFFF` | 6.57:1 |
| Teks bahaya gelap `#FDA29B` / kartu `#15171B` | 9.24:1 |
| Teks bahaya gelap `#FDA29B` / latar hitam `#050505` | 10.50:1 |

Placeholder memakai token muted tanpa transparansi. Batas kartu tetap halus; fokus keyboard memakai outline aksen yang jelas.

## Komponen dan tata letak

`Card`, `Button`, `Input`, `BottomNav`, `EmptyState`, dan `PageHeader` membentuk lapisan UI dasar. `PageHeader` menyediakan tombol ikon matahari/bulan dengan nama aksesibel yang menyebut mode saat ini dan tujuan berikutnya. Mode tersimpan pada `Setting` dengan kunci `themeMode`; cache `localStorage` dibaca sebelum render pertama agar warna awal sesuai, lalu diselaraskan dengan nilai `Setting`. `theme-color` mengikuti latar efektif, termasuk saat mode Sistem merespons perubahan preferensi perangkat.

Navigasi bawah memakai ikon SVG, lingkaran tab aktif berbingkai inset agar tidak terpotong, teks lebih tegas, dan `aria-current` pada tab aktif. Padding kiri/kanan dan bawah memperhitungkan safe area perangkat. Semua tombol dan tab memiliki target sentuh minimal 44px. Gunakan `EmptyState` untuk halaman atau daftar tanpa data maupun hasil filter kosong, dengan ajakan yang sesuai konteks.

Beranda menampilkan total pengeluaran bulan ini dan progres terhadap budget, grafik pengeluaran tujuh hari dengan garis rata-rata dan ringkasan aksesibel, pengeluaran per kategori yang diurutkan dari terbesar, input cepat, lalu kartu backup data. Kalender aktivitas tersedia di Laporan untuk bulan yang dipilih. Konten dibatasi selebar 480px dan berada di tengah pada layar lebar; judul halaman hanya tampil sekali pada header.

## Privasi dan hitung budget

Data pengguna tetap tersimpan di perangkat ini saja. Backup tidak otomatis dan harus diekspor/disimpan secara manual.

Alokasi kelompok dibulatkan ke rupiah bulat dengan metode sisa terbesar, sehingga jumlah alokasi selalu sama dengan total budget. Sisa budget harian membagi sisa bulanan dengan jumlah hari yang masih tersedia **termasuk hari ini**, lalu memotong pecahan rupiah menuju nol. Status kategori/kelompok menandai pemakaian mulai 80% sebagai “Mendekati batas” dan pemakaian di atas 100% sebagai “Melewati batas”.
