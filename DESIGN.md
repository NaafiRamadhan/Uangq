# Uangq — keputusan desain

## Arah visual

Antarmuka mobile-first untuk pencatatan keuangan pribadi: bersih, tenang, dan mudah dibaca, dengan permukaan solid dan batas halus alih-alih efek dekoratif. Tidak menggunakan pola visual atau aset merek aplikasi lain.

## Token

- **Aksen tunggal:** jade `#0B7464` pada mode terang dan jade terang `#5BC4AA` pada mode gelap. Aksen dipakai untuk aksi utama dan penanda navigasi aktif.
- **Warna netral:** latar, permukaan, teks, teks sekunder, dan garis batas memakai variabel CSS semantik yang beradaptasi ke preferensi sistem.
- **Font:** IBM Plex Sans untuk judul dan isi; fallback sistem menjaga keterbacaan saat font eksternal tidak tersedia.
- **Skala:** spacing berbasis kelipatan 4px; radius 10/16/22px; ukuran teks 12/14/16/20/28px.
- **Mode:** pilihan awal mengikuti `prefers-color-scheme`; tombol di header memutar mode Sistem → Terang → Gelap → Sistem.

Token didefinisikan di `src/index.css`. Komponen bersama ada di `src/components/ui.tsx`.

## Komponen dan tata letak

`Card`, `Button`, `Input`, `BottomNav`, `EmptyState`, dan `PageHeader` membentuk lapisan UI dasar. `PageHeader` menyediakan tombol ikon matahari/bulan dengan nama aksesibel yang menyebut mode saat ini dan tujuan berikutnya. Mode tersimpan pada `Setting` dengan kunci `themeMode`; cache `localStorage` dibaca sebelum render pertama agar warna awal sesuai, lalu diselaraskan dengan nilai `Setting`. `theme-color` mengikuti latar efektif, termasuk saat mode Sistem merespons perubahan preferensi perangkat.

Navigasi bawah memakai ikon SVG, lingkaran tab aktif berbingkai inset agar tidak terpotong, teks lebih tegas, dan `aria-current` pada tab aktif. Padding kiri/kanan dan bawah memperhitungkan safe area perangkat. Semua tombol dan tab memiliki target sentuh minimal 44px. Gunakan `EmptyState` untuk halaman atau daftar tanpa data maupun hasil filter kosong, dengan ajakan yang sesuai konteks.

Konten dibatasi selebar 480px dan berada di tengah pada layar lebar. Halaman yang tersedia tetap sama; judul halaman hanya tampil sekali pada header halaman.

## Kontras dan privasi

Teks normal harus mencapai kontras WCAG AA minimal 4.5:1 pada permukaan tempat teks itu tampil. Rasio jade pada permukaan aksen lembut adalah 4.99:1 (terang) dan 5.91:1 (gelap); teks tombol utama pada latar aksen 5.68:1 dan 7.67:1. Placeholder memakai token muted tanpa transparansi agar tetap terbaca. Data pengguna tetap tersimpan di perangkat ini saja. Backup tidak otomatis dan harus diekspor/disimpan secara manual.

## Aturan hitung budget

Alokasi kelompok dibulatkan ke rupiah bulat dengan metode sisa terbesar, sehingga jumlah alokasi selalu sama dengan total budget. Sisa budget harian membagi sisa bulanan dengan jumlah hari yang masih tersedia **termasuk hari ini**, lalu memotong pecahan rupiah menuju nol. Status kategori/kelompok menandai pemakaian mulai 80% sebagai “Mendekati batas” dan pemakaian di atas 100% sebagai “Melewati batas”.
