# CropFarm — prototipe fase 1

Game farming pixel art (Phaser 4 + TypeScript + Vite). Fase 1 sesuai whitepaper v2: belum ada uang sungguhan, belum ada backend.

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # hasil di dist/
```

Buka `?reset` di URL untuk menghapus save lokal. Kontrol sentuh (joystick + tombol Aksi) muncul otomatis di HP/tablet; paksa tampil di desktop dengan `?touch`.

## Kontrol

| Aksi | Keyboard | Mouse / sentuh |
| --- | --- | --- |
| Gerak | WASD / panah | Klik/tap tujuan |
| Aksi pada petak di depan | Spasi / E | Klik petak di dekat pemain |
| Pilih alat | 1 Cangkul · 2 Penyiram · 3 Benih · 4 Tangan · 5 Pancing | Klik slot alat |
| Lari | tahan Shift | Dorong joystick sampai penuh |
| Ganti benih | Q | Klik slot benih saat sudah terpilih |
| Buka tas (inventory) | I | Klik panel Tas kanan atas |
| Semua suara nyala/mati | M | - |
| Musik nyala/mati | N | - |
| Tutup jendela | Esc | Tombol di jendela |

Item di toko (masuk slot 3, ganti dengan Q):

- **Pupuk Cepat** (50 G): taburkan di tanah yang sudah dicangkul; tanaman di petak itu tumbuh 2 hari per malam sampai dipanen.
- **Sprinkler** (400 G): pasang di petak kosong di ladang; tiap pagi menyiram 8 petak tanah di sekitarnya. Ambil lagi dengan Tangan (4).

**Peta** 64×40 petak: Ladang (barat laut), Perkampungan Warga dengan alun-alun (timur), Danau Biru dengan dermaga (selatan), dan Hutan Kecil (tenggara). Toko, papan permintaan, dan panggung festival ada di alun-alun. Ajak warga bicara sekali sehari untuk menambah keakraban.

**Papan permintaan warga** (di alun-alun): setiap pagi ada sampai 3 permintaan hasil panen. Hadiahnya sekitar 1,6× harga jual dan menambah keakraban (♥) dengan warga. Batas waktunya menyesuaikan lama tumbuh tanaman. Tanda "!" muncul di atas papan kalau ada permintaan yang bisa langsung diserahkan.

**Level**: XP dari mencangkul, menyiram, menanam, memanen, permintaan warga, dan merawat ayam. Fitur terbuka bertahap: Papan Permintaan (Lv 2), Pupuk (Lv 3), Sprinkler (Lv 5), Kandang Ayam (Lv 7), dan benih tertentu.

**Ternak (Lv 7)**: beli Ayam (maks 4) dan Pakan di toko, tab Ternak. Hadapkan pemain ke kandang lalu tekan Spasi untuk mengambil telur sekaligus memberi pakan. Ayam yang diberi pakan bertelur keesokan pagi. Elus ayam (Tangan) sekali sehari supaya akrab; ayam yang sangat akrab bisa memberi Telur Emas.

**Festival mingguan** (hari ke-7, 14, 21, 28 tiap musim, 09:00–18:00, di panggung alun-alun): serahkan sampai 5 hasil panen. Skor = harga jual (tanaman tema ×2) + 40 per jenis berbeda. Juara 1–3 mendapat koin, XP, piala, dan Poin Festival (dasar pembagian pool hadiah di fase 3 whitepaper). Datangi panggung di hari lain untuk melihat tema festival berikutnya.

**Memancing**: beli Pancing di toko (Peralatan, 500 G, Lv 2). Hadapkan pemain ke air (kolam atau danau, paling enak dari ujung dermaga), tekan Spasi, tunggu tanda "!", lalu tekan Spasi lagi dengan cepat. Danau punya Ikan Lele dan Ikan Emas yang langka.

**Tas**: setiap jenis barang memakai 1 slot (maks 99 per slot). Kapasitas awal 12 slot (Tas Kain), upgrade ke Tas Kulit 18 (2.000 G, Lv 2), Ransel Petani 24 (5.000 G, Lv 4), Ransel Besar 30 (12.000 G, Lv 6) dari layar Tas (I) atau toko. Kalau penuh, panen/pancing/telur/belanja ditolak dan tanaman tetap di ladang.

Loop: cangkul → tanam → siram tiap hari → tidur (pintu rumah) → panen → kotak kirim → dibayar pagi berikutnya. Isi penyiram di kolam. Jam 24:00 pemain pingsan dan tenaga pagi berikutnya hanya 60%.

## Struktur

- `src/data.ts` — konstanta, daftar tanaman, musim, alat
- `src/state.ts` — state game, save/load (localStorage), logika pergantian hari
- `src/textures.ts` — semua grafis pixel dibuat prosedural (ganti dengan asset pack nanti)
- `src/scenes/FarmScene.ts` — peta, pemain, tabrakan, aksi, jam
- `src/sfx.ts` — efek suara disintesis dengan Web Audio (tanpa file audio)
- `src/music.ts` — musik latar prosedural: lagu berbeda per musim, lebih tenang di malam hari, lebih meriah di hari festival
- `src/scenes/UIScene.ts` — HUD, toolbar, toko, laporan pagi, overlay malam
