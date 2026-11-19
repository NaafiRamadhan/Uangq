# AGENTS.md — Uangq

PWA pencatat keuangan pribadi, data lokal di perangkat (tanpa server, tanpa login).
Spesifikasi lengkap ada di SPEC.md. Baca hanya bagian yang relevan dengan tugas, jangan seluruhnya.

## Aturan wajib
- Kerjakan SATU fase per sesi (SPEC.md bagian 9). Jangan menambah fitur di luar fase yang diminta.
- Sebelum menulis kode, ringkas rencana dalam beberapa baris dan tunggu persetujuan.
- Stack tetap: React + Vite + TypeScript, Dexie, vite-plugin-pwa, Tailwind, Vitest. Tanpa backend.
- Uang = bilangan bulat rupiah, dilarang float. Logika bisnis di `src/lib/` sebagai fungsi murni + test.
- Jangan tambah dependensi baru tanpa menjelaskan alasannya dan menunggu persetujuan.
- Jangan taruh API key, token, atau data pribadi di kode atau repo.
- Hanya pakai fitur web yang didukung Safari iOS dan Chrome Android.
- Sebelum fase dianggap selesai: `tsc --noEmit`, lint, dan semua test harus lolos.
- Jika spesifikasi ambigu, tanya. Jangan menebak.
