# SPEC — Aplikasi Keuangan Pribadi (PWA, data lokal) — Versi 1

> Taruh file ini di root repo. Di Copilot CLI / OpenCode / Cline, salin isinya ke `AGENTS.md`
> (atau `.github/copilot-instructions.md`) supaya selalu terbaca agent.
> Nama aplikasi: `Uangq` (ganti sendiri; jangan memakai nama, logo, atau teks milik pihak lain).

## 1. Tujuan

Aplikasi pencatat keuangan pribadi berbahasa Indonesia yang:
- berjalan sebagai **PWA** (bisa di-install ke layar utama Android dan iOS),
- menyimpan **semua data lokal di perangkat** (tanpa server, tanpa login),
- biayanya **Rp0** (tanpa layanan berbayar),
- bisa **backup dan restore** data lewat file, karena data terikat ke satu perangkat.

Terinspirasi alur aplikasi budgeting modern: dompet, transaksi, budget 50/30/20, ringkasan harian.
Tiru **konsep dan alur** saja. Jangan menyalin desain, teks, atau aset visual mentah-mentah.

## 2. Di luar cakupan versi 1 (JANGAN dibuat dulu)

Login/akun, sinkronisasi antar perangkat, bot Telegram, AI Advisor, Scan Struk, Utang, Investasi,
Aset, Goals, paket berbayar, notifikasi push, multi-bahasa (cukup Bahasa Indonesia).
Widget Home Screen dan Siri Shortcuts native (memerlukan aplikasi native dan tidak bisa dibuat sebagai PWA).

## 3. Stack (tetap, jangan ganti tanpa alasan kuat)

- React + Vite + TypeScript
- Dexie (IndexedDB) untuk penyimpanan
- vite-plugin-pwa (manifest + service worker, mode offline)
- Tailwind CSS
- Vitest untuk unit test (wajib untuk parser dan logika uang)
- Tanpa library grafik; gunakan bar CSS atau SVG sederhana.
- Tanpa backend. Tanpa API key apa pun di kode.

## 4. Aturan teknis wajib

1. **Uang = bilangan bulat rupiah** (integer). Dilarang memakai float untuk nominal.
2. Tanggal disimpan sebagai string `YYYY-MM-DD` (zona waktu lokal), waktu pembuatan sebagai ISO string.
3. Semua id memakai `crypto.randomUUID()`.
4. Format tampilan: `Rp 1.234.567` (`Intl.NumberFormat('id-ID')`).
5. Pakai hanya fitur web yang didukung **Safari iOS** dan Chrome Android. Hindari API yang khusus Chrome.
6. Panggil `navigator.storage.persist()` saat app pertama kali dibuka (jika tersedia), dan jangan bergantung padanya.
7. Layout **mobile-first** (lebar 360px ke atas), area sentuh minimal 44px, dukung `safe-area-inset` untuk iPhone.
8. Mode gelap dan terang mengikuti sistem, dengan opsi manual di Pengaturan.
9. Seluruh logika bisnis (hitung saldo, budget, parser) ada di `src/lib/` sebagai fungsi murni yang ditest, bukan di komponen UI.
10. Kode harus lolos `tsc --noEmit`, lint, dan seluruh test sebelum sebuah fase dianggap selesai.

## 5. Struktur folder

```
src/
  db/          # skema Dexie, migrasi, seed
  lib/         # money.ts, date.ts, parser.ts, budget.ts, backup.ts (fungsi murni + test)
  features/    # wallets/, transactions/, budget/, home/, settings/
  components/  # komponen UI bersama
  pages/
public/        # ikon PWA (192, 512, maskable)
```

## 6. Model data (Dexie, `schemaVersion` = 1)

```ts
Wallet      { id, name, type: 'bank'|'ewallet'|'credit_card'|'paylater'|'cash',
              initialBalance: number, archived: boolean, createdAt }

Category    { id, name, group: 'needs'|'wants'|'savings'|'income', icon: string, archived: boolean }

Transaction { id, type: 'expense'|'income'|'transfer', amount: number,        // amount > 0
              walletId, toWalletId?: string,                                   // toWalletId hanya untuk transfer
              categoryId?: string,                                             // kosong untuk transfer
              note: string, date: 'YYYY-MM-DD', createdAt }

Budget      { id, month: 'YYYY-MM', total: number,
              splitNeeds: number, splitWants: number, splitSavings: number }   // persen, jumlahnya 100

BudgetItem  { id, month: 'YYYY-MM', categoryId, limit: number }

Setting     { key: string, value: any }                                        // tema, lastBackupAt, dll.
```

Saldo dompet = `initialBalance` + pemasukan − pengeluaran ± transfer. **Dihitung dari transaksi, tidak disimpan.**

Kategori awal (seed, bisa diubah pengguna):
- needs: Makan, Listrik, Air, Transportasi, Kuota/Internet, Kebutuhan Lain
- wants: Hangout, Belanja Online, Hobi
- savings: Tabungan, Dana Darurat
- income: Gaji, Pemasukan Lain

## 7. Format backup (`backup.ts`)

```json
{
  "app": "Uangq",
  "schemaVersion": 1,
  "exportedAt": "2026-01-01T00:00:00.000Z",
  "data": { "wallets": [], "categories": [], "transactions": [], "budgets": [], "budgetItems": [], "settings": [] }
}
```

- Ekspor: unduh file `.json` bernama `<uangq>-backup-YYYY-MM-DD.json`.
- Impor: validasi struktur dan `schemaVersion` dulu, tampilkan ringkasan (jumlah dompet/transaksi),
  minta konfirmasi, lalu **ganti seluruh data** dalam satu transaksi database (gagal = tidak ada yang berubah).
- Tolak file dengan `schemaVersion` lebih baru dari yang dikenal app. Sediakan fungsi migrasi untuk versi lama.
- Ekspor tambahan: CSV transaksi (opsional, fase 5).
- Pengingat backup: jika `lastBackupAt` lebih dari 30 hari lalu, tampilkan banner di Home.

## 8. Parser input cepat (`src/lib/parser.ts`, tanpa AI)

Satu kolom teks: `makan siang 25rb bca`, `gaji 5jt`, `kemarin bensin 30rb tunai`.

Aturan:
- **Nominal:** `25rb`, `25k`, `25.000`, `25000`, `1,5jt`, `1.5jt`, `2jt`, `500 ribu`, `1 juta`. Hasil integer rupiah.
- **Tanggal:** `hari ini` (default), `kemarin`, `lusa lalu`, `tgl 5` (bulan berjalan), `5 mar` / `5 maret`.
- **Dompet:** cocokkan kata pada teks dengan nama dompet (tidak peka huruf besar/kecil, abaikan spasi ganda). Jika tidak ada, pakai dompet default.
- **Tipe:** default `expense`. Menjadi `income` jika ada kata `gaji`, `terima`, `bonus`, `masuk`. Transfer lewat form khusus, bukan parser.
- **Kategori:** cocokkan kata kunci sederhana dengan nama kategori. Jika tidak yakin, kosongkan dan biarkan pengguna memilih.
- **Catatan:** sisa teks setelah nominal, tanggal, dan dompet dikeluarkan.
- Hasil parser **selalu ditampilkan sebagai draf** yang bisa diedit, lalu disimpan setelah pengguna menekan Simpan.
- Kembalikan `{ ok: false, reason }` jika nominal tidak ditemukan. Jangan menebak.

Contoh test minimal (harus ada di `parser.test.ts`):

| Input | Hasil |
|---|---|
| `makan siang 25rb bca` | expense, 25000, dompet BCA, catatan "makan siang" |
| `gaji 5jt` | income, 5000000 |
| `kemarin bensin 30rb tunai` | expense, 30000, tanggal kemarin, dompet Tunai |
| `kopi 1,5k` | `ok: false` atau 1500 (tentukan dan dokumentasikan) |
| `belanja` | `ok: false` (tanpa nominal) |

## 9. Fase pengerjaan (satu fase = satu sesi agent = satu commit/PR)

### Fase 0 — Fondasi
- Scaffold Vite + React + TS + Tailwind + Vitest + vite-plugin-pwa.
- Skema Dexie + seed kategori + `navigator.storage.persist()`.
- Manifest, ikon, service worker, layout dasar dengan navigasi bawah (Home, Dompet, Transaksi, Budget, Pengaturan).
- `backup.ts` (ekspor/impor) beserta test, dan halaman Pengaturan dengan tombol Ekspor/Impor.
- **Selesai jika:** app bisa di-install di Android, jalan offline, dan backup bisa dibuat lalu dipulihkan tanpa selisih data.

### Fase 1 — Dompet dan transaksi
- CRUD dompet (5 tipe, saldo awal, arsipkan).
- CRUD transaksi (pengeluaran, pemasukan, transfer), daftar dikelompokkan per tanggal, filter (periode, dompet, tipe, kategori), pencarian catatan.
- Input massal: beberapa baris sekaligus dalam satu form.
- **Selesai jika:** saldo dompet selalu sama dengan hasil hitung dari transaksi, termasuk setelah edit dan hapus.

### Fase 2 — Input cepat
- `parser.ts` sesuai bagian 8, dengan test lengkap.
- Kolom input cepat di Home dan Transaksi, dengan draf yang bisa diedit sebelum disimpan.
- **Selesai jika:** semua contoh test lulus dan draf bisa diedit.

### Fase 3 — Budget dan Home
- Budget bulanan: nominal total, pembagian default 50/30/20 dengan slider (jumlah harus 100%), batas per kategori.
- Home: sisa budget hari ini (sisa budget bulan ÷ sisa hari), progres per kelompok, transaksi terbaru, kalender aktivitas bulanan.
- **Selesai jika:** angka di Home cocok dengan perhitungan manual untuk minimal 3 skenario di unit test.

### Fase 4 — Analitik ringan
- Halaman Laporan dapat dibuka dari Beranda dan Budget, tanpa tab baru di navigasi bawah.
- Tampilkan pengeluaran per kategori untuk bulan terpilih (bar horizontal dan persentase), tren 6 bulan terakhir (total pengeluaran dan pemasukan per bulan), perbandingan bulan terpilih dengan bulan sebelumnya (selisih rupiah dan persen), serta ringkasan bulan terpilih (rata-rata pengeluaran per hari, hari terboros, jumlah transaksi).
- Semua perhitungan berada di `src/lib/analytics.ts` sebagai fungsi murni dengan unit test, termasuk bulan tanpa data dan pergantian tahun.
- **Selesai jika:** angka di Laporan cocok dengan hitungan manual untuk minimal 3 skenario.

### Fase 5 — Polesan
- Mode gelap/terang, banner pengingat backup, ekspor CSV, prompt install PWA yang sopan, halaman kosong yang ramah.
- Tambahkan catatan privasi di Pengaturan bahwa seluruh data tersimpan di perangkat ini saja.
- URL `?tambah=1` langsung memfokuskan kolom input cepat.
- Tambahkan shortcut manifest PWA bernama “Tambah transaksi” dengan URL `/?tambah=1`.
- Uji manual di Android (Chrome) dan, jika perangkat tersedia, iOS (Safari, setelah ditambahkan ke Home Screen).

## 10. Prompt untuk agent (salin satu per sesi)

**Fase 0**
> Baca SPEC.md bagian 1–7. Kerjakan Fase 0 saja, jangan membuat fitur fase lain. Buat rencana singkat dulu dan tunggu persetujuanku, lalu implementasikan. Setelah selesai jalankan `tsc --noEmit`, lint, dan test, lalu tunjukkan hasilnya.

**Fase 1**
> Baca SPEC.md bagian 4, 6, dan Fase 1. Kerjakan Fase 1 saja. Semua logika saldo harus fungsi murni di `src/lib/` dengan unit test. Jangan ubah skema database tanpa menaikkan versi dan membuat migrasi.

**Fase 2**
> Baca SPEC.md bagian 8 dan Fase 2. Tulis dulu test untuk parser berdasarkan tabel contoh (tambahkan minimal 10 kasus tepi), baru implementasikan parser sampai semua test lulus. Jangan memakai AI atau layanan eksternal.

**Fase 3**
> Baca SPEC.md bagian 4, 6, dan Fase 3. Tulis rumus budget sebagai fungsi murni di `src/lib/budget.ts` dengan test untuk minimal 3 skenario. Baru bangun UI-nya.

**Fase 4**
> Baca SPEC.md bagian 4, 6, dan Fase 4. Bangun halaman Laporan yang dibuka dari Beranda dan Budget tanpa tab navigasi baru. Implementasikan semua perhitungan analitik sebagai fungsi murni di `src/lib/analytics.ts`; uji bulan tanpa data, pergantian tahun, dan minimal 3 skenario yang dicocokkan dengan hitungan manual. Gunakan bar CSS atau SVG sederhana, tanpa library grafik.

**Fase 5**
> Baca SPEC.md Fase 5. Kerjakan polesan saja: tambahkan catatan privasi di Pengaturan, fokuskan input cepat saat URL `?tambah=1` dibuka, dan tambahkan shortcut manifest PWA “Tambah transaksi” ke `/?tambah=1`. Audit seluruh kode untuk API yang tidak didukung Safari iOS dan laporkan sebelum memperbaikinya.

## 11. Aturan kerja untuk agent

- Kerjakan satu fase per sesi. Jangan menambah fitur di luar fase yang diminta.
- Sebelum menulis kode, ringkas rencanamu dalam beberapa baris dan tunggu persetujuan.
- Jangan menambah dependensi baru tanpa menjelaskan alasannya dan menunggu persetujuan.
- Jangan pernah menaruh API key, token, atau data pribadi di kode atau repo.
- Setiap perubahan logika uang wajib disertai test.
- Jika spesifikasi ambigu, tanya. Jangan menebak.
- Commit kecil dengan pesan jelas. Gunakan branch per fase.

## 12. Checklist sebelum dipakai harian

- [ ] Backup diekspor, file dipindahkan ke tempat lain (Drive/email), lalu dicoba dipulihkan.
- [ ] App terpasang di Home Screen, bukan hanya tab browser.
- [ ] Saldo tiap dompet dicocokkan dengan saldo asli.
- [ ] Kebiasaan backup bulanan sudah diatur.
- [ ] Sebelum pindah ke iPhone: ekspor backup, pasang app ke Home Screen iPhone **dulu**, baru impor.

## 13. Referensi

- **Budggt:** referensi konsep alur dompet, transaksi, budget 50/30/20, dan laporan.
- **Inpenso** ([github.com/VintusS/Inpenso](https://github.com/VintusS/Inpenso)): aplikasi iOS native berlisensi MIT; referensi konsep analitik per kategori/bulan/tren, budget bulanan, dan data yang tetap tersimpan di perangkat.

Hanya konsep yang dirujuk dari referensi tersebut; tidak ada kode yang disalin.
