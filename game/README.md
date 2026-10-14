# CropFarm — prototipe fase 1

Game farming pixel art (Phaser 4 + TypeScript + Vite). Fase 1 sesuai whitepaper v2: belum ada uang sungguhan, belum ada backend.

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # hasil di dist/
```

Uji otomatis (Playwright, memainkan game di Chromium sungguhan):

```bash
npx playwright install chromium   # sekali saja
npm test
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
| Kalender & prakiraan cuaca 7 hari | K | Klik jam di tengah atas |
| Buku Ikan | J | - |
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

**Memancing**: beli Pancing di toko (Peralatan, 500 G, Lv 2). Hadapkan pemain ke air (kolam atau danau, paling enak dari ujung dermaga), tekan Spasi, tunggu tanda "!", lalu tekan Spasi lagi secepatnya: makin cepat reaksimu, makin tinggi kualitas ikannya (★1–5). Ada 13 jenis ikan; tiap jenis punya tempat (kolam/danau), jam, musim, dan sebagian butuh hujan (misalnya Belut hanya saat hujan malam, Arwana malam di musim Kemarau). Lihat semuanya di **Buku Ikan (J)**: ikan yang belum tertangkap tampil sebagai siluet dengan petunjuknya.

**Musim tropis** (28 hari per musim): Tanam (awal hujan), Hujan, Panen (pancaroba), dan Kemarau. Tanaman: Kangkung, Timun, Terong, Tomat, Ubi, Padi, Cabai, Singkong, Jagung, Kedelai, Semangka, dan **Sawit (Lv 12)**: benih mahal, tumbuh 14 hari di semua musim, lalu berbuah lagi tiap 5 hari tanpa ditanam ulang.

**Cuaca**: Cerah, Hujan, Badai, atau Kabut Asap (Kemarau), diundi dengan prakiraan 7 hari ke depan (lihat Kalender, K). Ikon cuaca dan jam ada di tengah atas layar. Hujan dan badai menyiram semua tanah yang dicangkul (tidak mengurangi kualitas) dan membuat Lele/Ikan Emas 2× lebih sering. Badai merusak sekitar 7% tanaman, ada kilat dan petir, dan warga tinggal di rumah. Ayam berteduh di kandang saat tidak cerah. Hari festival selalu cerah.

**Kualitas tanaman (★1–5)**: ditentukan saat panen. Disiram setiap malam tanpa bolong +★2 (bolong 1 malam +★1), pupuk +★1, ditambah sedikit keberuntungan (naik seiring level). Harga ×1 / ×1,25 / ×1,5 / ×2 / ×3. Kualitas berbeda memakai slot tas terpisah; festival memakai harga berkualitas; permintaan warga dan resep memakai kualitas terendah dulu.

**Memasak (Lv 3)**: hadapkan pemain ke pintu rumah lalu pilih Dapur. 9 resep dari hasil panen, telur, dan ikan; masakan dijual lebih mahal dari bahannya, bisa dimakan dari Tas untuk memulihkan tenaga, atau diserahkan ke festival.

**Tas**: setiap jenis barang memakai 1 slot (maks 99 per slot). Kapasitas awal 12 slot (Tas Kain), upgrade ke Tas Kulit 18 (2.000 G, Lv 2), Ransel Petani 24 (5.000 G, Lv 4), Ransel Besar 30 (12.000 G, Lv 6) dari layar Tas (I) atau toko. Kalau penuh, panen/pancing/telur/belanja ditolak dan tanaman tetap di ladang.

Loop: cangkul → tanam → siram tiap hari → tidur (pintu rumah) → panen → kotak kirim → dibayar pagi berikutnya. Isi penyiram di kolam. Jam 24:00 pemain pingsan dan tenaga pagi berikutnya hanya 60%.

## Struktur

- `src/data.ts` — konstanta, daftar tanaman, musim, alat
- `src/state.ts` — state game, save/load (localStorage), logika pergantian hari
- `src/textures.ts` — semua grafis pixel dibuat prosedural (ganti dengan asset pack nanti)
- `src/scenes/FarmScene.ts` — peta, pemain, tabrakan, aksi, jam
- `src/sfx.ts` — efek suara disintesis dengan Web Audio (tanpa file audio)
- `src/music.ts` — musik latar prosedural: lagu berbeda per musim, lebih tenang di malam hari, lebih meriah di hari festival
- `src/ui/theme.ts` — gaya UI kaca minimalis ala Apple: panel kaca, kartu, tombol pil, segmented control, warna dan font sistem
- `src/scenes/UIScene.ts` — HUD, toolbar, toko, laporan pagi, overlay malam

## Catatan satire

Warga desa memakai nama plesetan pejabat Indonesia yang **sudah divonis bersalah oleh pengadilan**. Semua tokoh di game ini fiktif; dialog mereka hanya menyindir fakta yang tercatat dalam putusan, bukan tuduhan baru.

| Tokoh di game | Plesetan dari | Fakta putusan yang disindir |
| --- | --- | --- |
| Pak Setya Nopanto | Setya Novanto | Korupsi e-KTP, vonis 15 tahun (2018), dikurangi PK menjadi 12,5 tahun (2025); mobilnya menabrak tiang lampu jalan (Nov 2017) |
| Pak Juliyari Batubata | Juliari Batubara | Fee Rp10 ribu per paket bansos Covid-19, vonis 12 tahun (2021) |
| Pak Edi Lobstero | Edhy Prabowo | Suap ekspor benih lobster: 5 tahun, diperberat 9 tahun, dikurangi MA menjadi 5 tahun (2022) |
| Bu Ratu Atit | Ratu Atut Chosiyah | Suap Ketua MK (2014) dan korupsi alkes Banten (2017); dinasti politik keluarga |
| Pak Sahrul Lempo | Syahrul Yasin Limpo | Pemerasan pejabat Kementan, vonis 10 tahun diperberat menjadi 12 tahun (2024) |

Sumber: [Tempo](https://en.tempo.co/read/917861/e-ktp-trial-setya-novanto-sentenced-to-15-year-in-jail), [Bisnis.com (tiang lampu)](https://kabar24.bisnis.com/read/20171117/16/710125/setya-novanto-kecelakaan-polisi-periksa-4-saksi-), [Hukumonline (bansos)](https://www.hukumonline.com/berita/a/begini-kronologis-mensos-juliari-minta-fee-rp10-ribu-paket-sembako-bansos-lt6037336f69e89/), [Hukumonline (lobster)](https://www.hukumonline.com/berita/a/ma-korting-vonis-edhy-prabowo-jadi-5-tahun-penjara-lt622951b1071fa/?page=all), [Liputan6 (Atut)](https://www.liputan6.com/news/read/2099618/vonis-sang-ratu-banten), [Republika (alkes)](https://news.republika.co.id/berita/otdygj354/ratu-atut-divonis-lima-setengah-tahun-penjara), [Bisnis.com (SYL)](https://kabar24.bisnis.com/read/20240910/16/1798391/banding-hukuman-syahrul-yasin-limpo-diperberat-jadi-12-tahun-penjara).
