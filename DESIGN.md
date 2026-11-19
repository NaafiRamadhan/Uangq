# Uangq — keputusan desain

## Arah visual

Antarmuka mobile-first untuk pencatatan keuangan pribadi: bersih, tenang, dan mudah dibaca, dengan permukaan solid dan batas halus alih-alih efek dekoratif. Tidak menggunakan pola visual atau aset merek aplikasi lain.

## Token

- **Aksen tunggal:** jade `#0B7464` pada mode terang dan jade terang `#5BC4AA` pada mode gelap. Aksen dipakai untuk aksi utama dan penanda navigasi aktif.
- **Warna netral:** latar, permukaan, teks, teks sekunder, dan garis batas memakai variabel CSS semantik yang beradaptasi ke preferensi sistem.
- **Font:** IBM Plex Sans untuk judul dan isi; fallback sistem menjaga keterbacaan saat font eksternal tidak tersedia.
- **Skala:** spacing berbasis kelipatan 4px; radius 10/16/22px; ukuran teks 12/14/16/20/28px.
- **Mode:** terang/gelap mengikuti `prefers-color-scheme`, tanpa kontrol tema atau perilaku aplikasi baru.

Token didefinisikan di `src/index.css`. Komponen bersama ada di `src/components/ui.tsx`.

## Komponen dan tata letak

`Card`, `Button`, `Input`, `BottomNav`, `EmptyState`, dan `PageHeader` membentuk lapisan UI dasar. Navigasi bawah memakai ikon SVG dengan ikon beralas aksen, teks lebih tegas, dan `aria-current` pada tab aktif. Target sentuh minimal 44px; padding area konten dan navigasi memperhitungkan safe area perangkat.

Konten dibatasi selebar 480px dan berada di tengah pada layar lebar. Halaman yang tersedia tetap sama; judul halaman hanya tampil sekali pada header halaman.
