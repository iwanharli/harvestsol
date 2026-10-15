export const TILE = 16;
export const MAP_W = 64;
export const MAP_H = 72; // the south half holds the far lakes

// Field where the player may till soil.
export const FIELD = { x: 8, y: 8, w: 16, h: 9 };

// Tropical Asian year: planting (early rains), the wet season, harvest (transition), dry season.
export type Season = 'Tanam' | 'Hujan' | 'Panen' | 'Kemarau';
export const SEASONS: Season[] = ['Tanam', 'Hujan', 'Panen', 'Kemarau'];
export const DAYS_PER_SEASON = 28;

export interface CropDef {
  id: string;
  name: string;
  seasons: Season[];
  seedPrice: number;
  sellPrice: number;
  days: number; // watered days needed to mature
  level: number; // player level needed to buy the seed
  regrow?: number; // perennial: after harvest it fruits again after this many watered days
  allSeasons?: boolean; // grows in every season
  color: string; // produce colour used for procedural sprites
  leaf: string;
}

export const CROPS: CropDef[] = [
  { id: 'kangkung', name: 'Kangkung', seasons: ['Tanam', 'Hujan'], seedPrice: 15, sellPrice: 30, days: 3, level: 1, color: '#3f9a3f', leaf: '#5fb04a' },
  { id: 'timun', name: 'Timun', seasons: ['Hujan', 'Panen'], seedPrice: 25, sellPrice: 50, days: 4, level: 2, color: '#7cbf4a', leaf: '#4f9a3f' },
  { id: 'terong', name: 'Terong', seasons: ['Hujan'], seedPrice: 30, sellPrice: 65, days: 5, level: 2, color: '#6b3fa0', leaf: '#4a9a3d' },
  { id: 'tomat', name: 'Tomat', seasons: ['Panen'], seedPrice: 35, sellPrice: 70, days: 5, level: 2, color: '#e5533d', leaf: '#4a9a3d' },
  { id: 'ubi', name: 'Ubi', seasons: ['Panen', 'Kemarau'], seedPrice: 30, sellPrice: 60, days: 5, level: 2, color: '#a0527d', leaf: '#5b9c46' },
  { id: 'padi', name: 'Padi', seasons: ['Tanam', 'Hujan'], seedPrice: 50, sellPrice: 110, days: 7, level: 3, color: '#e8c35a', leaf: '#7fb84a' },
  { id: 'cabai', name: 'Cabai', seasons: ['Tanam', 'Kemarau'], seedPrice: 40, sellPrice: 95, days: 6, level: 3, color: '#d62828', leaf: '#3f8a3a' },
  { id: 'singkong', name: 'Singkong', seasons: ['Kemarau'], seedPrice: 45, sellPrice: 100, days: 7, level: 3, color: '#a0703f', leaf: '#4f9a3f' },
  { id: 'jagung', name: 'Jagung', seasons: ['Panen', 'Kemarau'], seedPrice: 60, sellPrice: 140, days: 8, level: 4, color: '#f2cf3c', leaf: '#6aa84f' },
  { id: 'kedelai', name: 'Kedelai', seasons: ['Panen'], seedPrice: 40, sellPrice: 90, days: 6, level: 4, color: '#c9b16a', leaf: '#5b9c46' },
  { id: 'semangka', name: 'Semangka', seasons: ['Kemarau'], seedPrice: 90, sellPrice: 220, days: 9, level: 6, color: '#3f8a3a', leaf: '#4f9a3f' },
  // high-level perennial: expensive, slow, then fruits every few days in any season
  { id: 'sawit', name: 'Sawit', seasons: ['Tanam', 'Hujan', 'Panen', 'Kemarau'], seedPrice: 6000, sellPrice: 200, days: 14, level: 12, regrow: 7, allSeasons: true, color: '#d9541e', leaf: '#2f7d3a' },
];

/** Crop ids from the temperate first version, mapped to their tropical replacement. */
export const LEGACY_CROPS: Record<string, string> = { lobak: 'kangkung', kentang: 'singkong', stroberi: 'semangka', labu: 'kedelai' };
export const LEGACY_DISHES: Record<string, string> = {
  'sup-lobak': 'tumis-kangkung',
  'kentang-goreng': 'singkong-goreng',
  'selai-stroberi': 'es-semangka',
  'kolak-labu': 'kolak-ubi',
};

export const cropById = (id: string) => CROPS.find((c) => c.id === id)!;

export type Tool = 'cangkul' | 'siram' | 'benih' | 'tangan' | 'pancing' | 'beliung';
export const TOOLS: { id: Tool; name: string; key: string }[] = [
  { id: 'cangkul', name: 'Cangkul', key: '1' },
  { id: 'siram', name: 'Penyiram', key: '2' },
  { id: 'benih', name: 'Benih', key: '3' },
  { id: 'tangan', name: 'Tangan', key: '4' },
  { id: 'pancing', name: 'Pancing', key: '5' },
  { id: 'beliung', name: 'Beliung', key: '6' },
];

export const WATER_CAN_MAX = 20;
export const STAMINA_MAX = 100; // base; grows with level milestones and one-off rewards

/** Every 4 levels up to Lv 20 adds 10 max stamina (100 → 150). */
export const STAMINA_PER_MILESTONE = 10;
export const STAMINA_MILESTONE_EVERY = 4;
export const STAMINA_MILESTONE_CAP_LEVEL = 20;
export const STAMINA_REWARD = 10; // one-off rewards: Jamu Kuat (first villager at ♥10), complete Fish Book
export const FRIENDSHIP_MAX = 10;
export const STAMINA_COST: Record<Tool, number> = { cangkul: 2, siram: 2, benih: 0, tangan: 0, pancing: 4, beliung: 4 };

// Clock: 1 real second = 1.5 game minutes, so a day (06:00–24:00) lasts 12 real minutes.
export const DAY_START_MIN = 6 * 60;
export const DAY_END_MIN = 26 * 60; // 02:00: past this you fall asleep wherever you are
/** Gentle reminders before that: 22:00, and half an hour before 02:00. */
export const LATE_WARNINGS: [number, string][] = [
  [22 * 60, 'Sudah jam 10 malam. Sebaiknya pulang dan tidur.'],
  [25.5 * 60, '30 menit lagi kamu akan tertidur di mana pun kamu berada!'],
];
/** Falling asleep outside: a villager carries you home for a small fee. */
export const PASS_OUT_FINE = { rate: 0.1, max: 500 };
export const GAME_MIN_PER_SEC = 1.5;

// Non-seed items that live in the same bag as seeds (tool slot 3).
export interface ItemDef {
  id: string;
  name: string;
  price: number;
  desc: string;
  level: number;
}

export const ITEMS: ItemDef[] = [
  { id: 'pupuk', name: 'Pupuk Cepat', price: 50, desc: 'tumbuh 2× per malam', level: 3 },
  { id: 'sprinkler', name: 'Sprinkler', price: 1500, desc: 'siram 8 petak tiap pagi', level: 5 },
];

export const isItem = (id: string) => ITEMS.some((i) => i.id === id);
export const itemName = (id: string) => ITEMS.find((i) => i.id === id)?.name ?? cropById(id).name;

// Villagers who post requests on the board.
export const NPCS: { id: string; name: string; role: string }[] = [
  { id: 'sari', name: 'Bu Ratu Atit', role: 'pemilik warung keluarga' },
  { id: 'darto', name: 'Pak Setya Nopanto', role: 'kepala desa' },
  { id: 'rani', name: 'Pak Juliyari Batubata', role: 'juru masak dapur umum' },
  { id: 'joyo', name: 'Pak Edi Lobstero', role: 'nelayan' },
  { id: 'dina', name: 'Pak Sahrul Lempo', role: 'mantan pejabat pertanian' },
];
export const npcById = (id: string) => NPCS.find((n) => n.id === id)!;
export const REQUESTS_MAX = 4; // the board holds at most this many
export const REQUEST_DAYS = 3;

// ---------- levels ----------

export const XP = { till: 1, water: 1, plant: 2, harvestPerDay: 1, request: 25 };

/** XP needed to go from level l to l+1. */
export const xpToNext = (l: number) => Math.round(55 * Math.pow(l, 1.6));

export const FEATURE_LEVEL = { board: 2, kitchen: 3, coop: 7 };

export const FEATURES: { level: number; name: string }[] = [
  { level: FEATURE_LEVEL.board, name: 'Papan Permintaan Warga' },
  { level: FEATURE_LEVEL.kitchen, name: 'Dapur: masak di rumah' },
  { level: FEATURE_LEVEL.coop, name: 'Kandang Ayam: beli ayam dan pakan di toko' },
];

/** Everything that opens at exactly this level, for the level-up screen. */
export function unlocksAt(level: number): string[] {
  const stamina = level % STAMINA_MILESTONE_EVERY === 0 && level <= STAMINA_MILESTONE_CAP_LEVEL ? [`Tenaga maksimal +${STAMINA_PER_MILESTONE}`] : [];
  return [
    ...stamina,
    ...FEATURES.filter((f) => f.level === level).map((f) => f.name),
    ...CROPS.filter((c) => c.level === level).map((c) => `Benih ${c.name}`),
    ...ITEMS.filter((i) => i.level === level).map((i) => i.name),
  ];
}

// ---------- livestock ----------

export const MAX_CHICKENS = 4;
export const CHICKEN_PRICE = 2500;
export const FEED_PRICE = 15;
export const AFFECTION_MAX = 10;
export const GOLDEN_EGG_AFFECTION = 8;

/** Sellable goods that are not crops. */
export const PRODUCTS: { id: string; name: string; sellPrice: number }[] = [
  { id: 'telur', name: 'Telur', sellPrice: 50 },
  { id: 'telur-emas', name: 'Telur Emas', sellPrice: 150 },
  // from the Tambang (mining); kept for tool upgrades later, or sold
  { id: 'batu', name: 'Batu', sellPrice: 4 },
  { id: 'bijih-tembaga', name: 'Bijih Tembaga', sellPrice: 25 },
  { id: 'bijih-besi', name: 'Bijih Besi', sellPrice: 45 },
  { id: 'bijih-emas', name: 'Bijih Emas', sellPrice: 120 },
];

// ---------- mining ----------

/** The gravel yard in the east woods with the cave mouth at its back (world tiles). */
export const QUARRY = { x: 51, y: 41, w: 11, h: 10 };
/** The cave interior: one room in empty world space, rebuilt for every floor you reach. */
export const CAVE_ROOM = { x: 400, y: 4, w: 20, h: 14 };
export const CAVE_LIFT_EVERY = 5; // a lift stop every 5 floors you have reached
export type Ore = 'batu' | 'bijih-tembaga' | 'bijih-besi' | 'bijih-emas';
/** Rock kinds: how many hits they take and what they drop. */
export const ORES: Record<Ore, { name: string; hits: number; drop: [number, number] }> = {
  batu: { name: 'Batu', hits: 1, drop: [1, 3] },
  'bijih-tembaga': { name: 'Batu Tembaga', hits: 2, drop: [1, 2] },
  'bijih-besi': { name: 'Batu Besi', hits: 3, drop: [1, 2] },
  'bijih-emas': { name: 'Batu Emas', hits: 4, drop: [1, 1] },
};
/** How common each rock is on a floor: deeper floors hold better ore. */
export function oreWeights(floor: number): Record<Ore, number> {
  return {
    batu: 60,
    'bijih-tembaga': floor <= 10 ? 30 : 20,
    'bijih-besi': floor < 5 ? 2 : floor < 10 ? 12 : 25,
    'bijih-emas': floor < 10 ? 0.5 : floor < 15 ? 4 : 12,
  };
}
/** The look of a floor band: shallow brown, middle grey-blue, deep purple. */
export const caveTint = (floor: number) => (floor < 5 ? 0xffffff : floor < 10 ? 0xc8d0e0 : floor < 15 ? 0xb8a8d8 : 0xe0a0a0);
export const isOre = (id: string) => id in ORES;

// ---------- cooking ----------

export interface Dish {
  id: string;
  name: string;
  ingredients: Record<string, number>;
  sellPrice: number;
  stamina: number;
  color: string; // main colour of the food on the plate
}

export const DISHES: Dish[] = [
  { id: 'tumis-kangkung', name: 'Tumis Kangkung', ingredients: { kangkung: 2 }, sellPrice: 90, stamina: 25, color: '#3f9a3f' },
  { id: 'singkong-goreng', name: 'Singkong Goreng', ingredients: { singkong: 2 }, sellPrice: 250, stamina: 30, color: '#e8c35a' },
  { id: 'telur-dadar', name: 'Telur Dadar', ingredients: { telur: 2 }, sellPrice: 140, stamina: 30, color: '#f7d65a' },
  { id: 'ikan-bakar', name: 'Ikan Bakar', ingredients: { 'ikan-nila': 1 }, sellPrice: 60, stamina: 35, color: '#a0703f' },
  { id: 'sambal-tomat', name: 'Sambal Tomat', ingredients: { tomat: 1, cabai: 1 }, sellPrice: 210, stamina: 20, color: '#d9402f' },
  { id: 'jagung-bakar', name: 'Jagung Bakar', ingredients: { jagung: 1 }, sellPrice: 175, stamina: 25, color: '#e8b830' },
  { id: 'kolak-ubi', name: 'Kolak Ubi', ingredients: { ubi: 2 }, sellPrice: 160, stamina: 40, color: '#c98a4a' },
  { id: 'es-semangka', name: 'Es Semangka', ingredients: { semangka: 2 }, sellPrice: 560, stamina: 20, color: '#e2434b' },
  { id: 'nasi-goreng', name: 'Nasi Goreng Spesial', ingredients: { telur: 1, padi: 1, 'ikan-lele': 1 }, sellPrice: 300, stamina: 60, color: '#c98a4a' },
];

export const dishById = (id: string) => DISHES.find((d) => d.id === id);
export const XP_COOK = 4;
export const COOK_MINUTES = 30;

// ---------- crop quality ----------
// Bag keys carry quality as "padi@3" (3 stars). A plain "padi" is 1 star (also old saves).

export const QUALITY_MULT = [1, 1, 1.2, 1.4, 1.7, 2.2]; // indexed by stars
export const baseId = (key: string) => key.split('@')[0];
export const starsOf = (key: string) => Number(key.split('@')[1] ?? 1);
export const qualityKey = (id: string, stars: number) => (stars > 1 ? `${id}@${stars}` : id);
/** Bought at the Warung Bahan: standard (1-star) value, but marked so it cannot enter festivals. */
export const boughtKey = (id: string) => `${id}@0`;
export const isBought = (key: string) => key.endsWith('@0');
export const stars = (n: number) => '★'.repeat(n);

/** Name and price of anything that can sit in the produce bag (crops, quality crops, products, dishes). */
export function produceById(key: string): { id: string; name: string; sellPrice: number } {
  const id = baseId(key);
  const base = PRODUCTS.find((p) => p.id === id) ?? FISH.find((f) => f.id === id) ?? dishById(id) ?? cropById(id);
  const q = starsOf(key);
  if (q <= 1) return base;
  return { id: key, name: `${base.name} ${stars(q)}`, sellPrice: Math.round(base.sellPrice * QUALITY_MULT[q]) };
}

export const XP_ANIMAL = { feed: 1, egg: 2, pet: 1 };

// ---------- weekly festival ----------

export const FESTIVAL_EVERY = 7; // days 7, 14, 21, 28 of each season
export const FESTIVAL_OPEN = 9 * 60;
export const FESTIVAL_CLOSE = 18 * 60;
export const FESTIVAL_MAX_ITEMS = 5;
export const FESTIVAL_VARIETY_BONUS = 40;
export const FESTIVAL_THEME_MULT = 2;

/** Rewards by finishing place (index 0 = 1st). Points feed the future reward pool (whitepaper v2). */
export const FESTIVAL_REWARDS = [
  { coins: 500, xp: 60, points: 3, trophy: 'emas' },
  { coins: 250, xp: 40, points: 2, trophy: 'perak' },
  { coins: 100, xp: 25, points: 1, trophy: 'perunggu' },
  { coins: 0, xp: 10, points: 0, trophy: '' },
  { coins: 0, xp: 10, points: 0, trophy: '' },
] as const;

// ---------- village ----------

/** Villager homes: top-left tile of the 4x4 house and its texture. Door is on the bottom row. */
export const NPC_HOMES: { npc: string; x: number; y: number; tex: string }[] = [
  { npc: 'sari', x: 36, y: 2, tex: 'house-sari' },
  { npc: 'darto', x: 54, y: 2, tex: 'house-darto' },
  { npc: 'rani', x: 56, y: 9, tex: 'house-rani' },
  { npc: 'joyo', x: 41, y: 18, tex: 'house-joyo' },
  { npc: 'dina', x: 51, y: 18, tex: 'house-dina' },
];

// Satire: every line pokes at a court-proven case (see README "Catatan satire").
export const NPC_LINES: Record<string, string[]> = {
  sari: [
    'Warung ini usaha keluarga. Adik, ipar, keponakan, semua kebagian jabatan.',
    'Kalau ada sengketa harga, tenang, saya kenal orang di Mahkamah.',
    'Alat kesehatan desa? Sudah... dianggarkan.',
  ],
  darto: [
    'Desa butuh KTP elektronik baru. Anggarannya biar saya yang urus.',
    'Hati-hati di jalan. Tiang lampu di sini suka tiba-tiba ada di depan mobil.',
    'Hukuman bisa dikurangi kok, asal rajin mengajukan peninjauan kembali.',
  ],
  rani: [
    'Satu paket sembako nilainya tiga ratus ribu. Yang sepuluh ribu... ongkos masak.',
    'Masak untuk orang banyak itu berat, apalagi kalau dipotong sedikit-sedikit.',
    'Telur emas? Wah, bisa jadi paket bantuan premium!',
  ],
  joyo: [
    'Danau ini indah. Sayang tidak ada benih lobster untuk diekspor.',
    'Lima tahun, jadi sembilan, lalu balik lima lagi. Ombak memang naik turun.',
    'Duduk di dermaga sore hari itu tenang. Asal tidak ada yang datang dari KPK.',
  ],
  dina: [
    'Saya ahli pertanian. Hasil panenmu boleh setor sedikit ke saya, ya.',
    'Dulu bawahan saya rajin patungan buat keperluan saya. Loyal sekali.',
    'Sawit? Bagus itu. Asal ada bagian untuk kementerian.',
  ],
};

/** Named areas, shown as a banner when the player walks in. First match wins. */
export const ZONES: { name: string; x0: number; y0: number; x1: number; y1: number }[] = [
  { name: 'Rumah', x0: 100, y0: 4, x1: 113, y1: 13 }, // the farmhouse interior (east of the map)
  { name: 'Toko Mebel', x0: 160, y0: 4, x1: 171, y1: 12 },
  { name: 'Rumah', x0: 220, y0: 4, x1: 239, y1: 15 },
  { name: 'Rumah', x0: 290, y0: 4, x1: 315, y1: 17 },
  { name: 'Ladang', x0: 0, y0: 0, x1: 33, y1: 21 },
  { name: 'Perkampungan Warga', x0: 34, y0: 0, x1: 63, y1: 23 },
  { name: 'Hutan Kecil', x0: 44, y0: 24, x1: 63, y1: 39 },
  { name: 'Danau Biru', x0: 0, y0: 22, x1: 43, y1: 39 },
];

export const zoneAt = (x: number, y: number) => ZONES.find((z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1)?.name ?? '';

// ---------- fishing ----------

export const RUN_MULT = 1.7;

// ---------- fish ----------

export type Water = 'kolam' | 'danau' | 'rawa' | 'telaga' | 'waduk' | 'muara';

/** Every body of water has its own name, character and fish. */
export const LAKES: Record<Water, { name: string; desc: string; tint: number }> = {
  kolam: { name: 'Kolam Kebun', desc: 'Kolam kecil di samping ladang. Ikan hias dan ikan sawah.', tint: 0xffffff },
  danau: { name: 'Danau Sirep', desc: 'Danau tenang di selatan desa. Ikan air tawar yang umum.', tint: 0xffffff },
  rawa: { name: 'Rawa Gambut Kelam', desc: 'Air cokelat gambut di barat daya. Ikan predator dan ikan lumpur.', tint: 0x9fb07a },
  telaga: { name: 'Telaga Kabut Sunyi', desc: 'Telaga dingin di kaki bukit. Ikan yang suka air jernih.', tint: 0xc8ecff },
  waduk: { name: 'Waduk Kedung Lali', desc: 'Waduk luas di balik bendungan. Ikan besar air dalam.', tint: 0x7f9fe0 },
  muara: { name: 'Muara Payau Senja', desc: 'Pertemuan sungai dan laut di tenggara. Ikan air payau.', tint: 0xd9cfa6 },
};

export interface FishDef {
  id: string;
  name: string;
  sellPrice: number;
  where: Water[];
  seasons?: Season[]; // undefined = every season
  hours: [number, number]; // bites from..until (24h clock, until is exclusive)
  weight: number; // relative chance among the fish that can bite right now
  rain?: 'bonus' | 'only'; // rain doubles the chance, or is required
  colors: [string, string, string]; // body, light, dark
  shape?: 'fish' | 'eel' | 'shrimp' | 'long';
  art?: string; // reuse another fish's pixel art (recoloured)
}

export const FISH: FishDef[] = [
  { id: 'ikan-nila', name: 'Ikan Nila', sellPrice: 25, where: ['kolam', 'danau', 'waduk'], hours: [6, 24], weight: 40, colors: ['#8a9aa8', '#b8c6d2', '#5f6f7d'] },
  { id: 'ikan-mas', name: 'Ikan Mas', sellPrice: 35, where: ['kolam', 'danau', 'telaga'], hours: [6, 20], weight: 30, colors: ['#e88a2d', '#f4b66a', '#b8651c'] },
  { id: 'ikan-betok', name: 'Ikan Betok', sellPrice: 30, where: ['kolam', 'rawa'], hours: [6, 12], weight: 22, colors: ['#7a8a5a', '#a0b07a', '#556040'] },
  { id: 'ikan-lele', name: 'Ikan Lele', sellPrice: 50, where: ['danau', 'rawa'], seasons: ['Tanam', 'Hujan'], hours: [18, 24], weight: 26, rain: 'bonus', colors: ['#5a5248', '#7d746a', '#3b352f'] },
  { id: 'ikan-belut', name: 'Belut', sellPrice: 60, where: ['kolam', 'rawa'], seasons: ['Tanam', 'Hujan'], hours: [18, 24], weight: 16, rain: 'only', colors: ['#6a5a3a', '#8f7a52', '#4a3f2a'], shape: 'eel' },
  { id: 'ikan-gabus', name: 'Ikan Gabus', sellPrice: 55, where: ['danau', 'rawa'], seasons: ['Hujan', 'Panen'], hours: [6, 18], weight: 18, colors: ['#4f5a4a', '#6f7a68', '#353d32'], shape: 'long' },
  { id: 'ikan-patin', name: 'Ikan Patin', sellPrice: 65, where: ['waduk'], seasons: ['Panen', 'Kemarau'], hours: [6, 18], weight: 15, colors: ['#9aa6b2', '#c8d2dc', '#6a7682'] },
  { id: 'ikan-gurame', name: 'Ikan Gurame', sellPrice: 80, where: ['danau', 'waduk'], hours: [9, 17], weight: 14, colors: ['#b8a07a', '#d8c4a0', '#8a7452'] },
  { id: 'ikan-bawal', name: 'Ikan Bawal', sellPrice: 70, where: ['waduk'], seasons: ['Kemarau'], hours: [12, 24], weight: 12, colors: ['#5a6a7a', '#8a9aaa', '#3a4a5a'] },
  { id: 'ikan-udang', name: 'Udang Galah', sellPrice: 90, where: ['muara'], seasons: ['Hujan'], hours: [18, 24], weight: 10, rain: 'bonus', colors: ['#5f8fb0', '#8fbfdf', '#3f6f90'], shape: 'shrimp' },
  { id: 'ikan-koi', name: 'Ikan Koi', sellPrice: 160, where: ['kolam'], seasons: ['Panen'], hours: [10, 16], weight: 5, colors: ['#f4f1e8', '#ffffff', '#e2434b'] },
  { id: 'ikan-emas', name: 'Ikan Emas', sellPrice: 200, where: ['telaga'], hours: [6, 24], weight: 3, rain: 'bonus', colors: ['#f2c94c', '#fff3a8', '#c99a2e'] },
  { id: 'ikan-arwana', name: 'Ikan Arwana', sellPrice: 400, where: ['rawa'], seasons: ['Kemarau'], hours: [18, 24], weight: 2, colors: ['#d9b45a', '#f2dc94', '#a8843a'], shape: 'long' },
  // fish found only at the far lakes
  { id: 'ikan-sepat', name: 'Ikan Sepat', sellPrice: 20, where: ['rawa'], hours: [6, 24], weight: 35, colors: ['#7f8fa0', '#b0bccb', '#56616e'], art: 'ikan-betok' },
  { id: 'ikan-toman', name: 'Ikan Toman', sellPrice: 180, where: ['rawa'], seasons: ['Hujan', 'Panen'], hours: [6, 18], weight: 5, colors: ['#3e4a40', '#d0603a', '#28302a'], art: 'ikan-gabus' },
  { id: 'ikan-tawes', name: 'Ikan Tawes', sellPrice: 30, where: ['telaga'], hours: [6, 24], weight: 35, colors: ['#c8c8b0', '#eeeedc', '#94947a'], art: 'ikan-mas' },
  { id: 'ikan-sidat', name: 'Ikan Sidat', sellPrice: 220, where: ['telaga'], hours: [20, 24], weight: 4, colors: ['#4a5560', '#7a8794', '#2c343c'], shape: 'eel' },
  { id: 'ikan-baung', name: 'Ikan Baung', sellPrice: 75, where: ['waduk'], hours: [17, 24], weight: 18, colors: ['#7a6a58', '#a8988a', '#4e4236'], art: 'ikan-lele' },
  { id: 'ikan-bandeng', name: 'Ikan Bandeng', sellPrice: 45, where: ['muara'], hours: [6, 24], weight: 35, colors: ['#b4c4d0', '#e4eef4', '#7890a4'], art: 'ikan-patin' },
  { id: 'ikan-belanak', name: 'Ikan Belanak', sellPrice: 40, where: ['muara'], hours: [6, 24], weight: 25, colors: ['#8e9a8a', '#c4ccbc', '#5e6a5a'], art: 'ikan-patin' },
  { id: 'ikan-kakap', name: 'Kakap Merah', sellPrice: 140, where: ['muara'], seasons: ['Panen', 'Kemarau'], hours: [15, 24], weight: 6, colors: ['#d04a3a', '#f08a70', '#902a20'], art: 'ikan-gurame' },
];

export const fishById = (id: string) => FISH.find((f) => f.id === id);

/** Fish that can bite here and now (any-season fish always count; rain-only fish need rain). */
export function fishAvailable(where: Water, season: Season, hour: number, rainy: boolean) {
  return FISH.filter(
    (f) =>
      f.where.includes(where) &&
      (!f.seasons || f.seasons.includes(season)) &&
      hour >= f.hours[0] &&
      (hour < f.hours[1] || (f.hours[1] === 24 && hour >= 24)) && // night fish keep biting after midnight
      (f.rain !== 'only' || rainy),
  );
}

export function rollFish(where: Water, season: Season, hour: number, rainy: boolean, rand = Math.random): string {
  const pool = fishAvailable(where, season, hour, rainy).map((f) => [f.id, f.rain && rainy ? f.weight * 2 : f.weight] as const);
  if (!pool.length) return FISH.find((f) => f.where.includes(where))?.id ?? 'ikan-nila';
  let n = rand() * pool.reduce((a, [, w]) => a + w, 0);
  for (const [id, w] of pool) if ((n -= w) < 0) return id;
  return pool[0][0];
}

/** Stars from how fast the player reacted to the bite (ms), plus a little level-based luck. */
export function fishStars(reactionMs: number, level: number, rand = Math.random) {
  let q = 1;
  if (reactionMs < 550) q++;
  if (reactionMs < 380) q++;
  if (reactionMs < 240) q++;
  if (rand() < 0.08 + level * 0.015) q++;
  return Math.min(5, q);
}

/** XP for a catch grows with how valuable the fish is. */
export const fishXp = (id: string) => 4 + Math.round((fishById(id)?.sellPrice ?? 45) / 40);

/** Tools that must be bought once before they can be used. */
export const BUYABLE_TOOLS: { id: Tool; name: string; price: number; level: number; desc: string }[] = [
  { id: 'pancing', name: 'Pancing', price: 800, level: 2, desc: 'untuk kolam, danau, rawa, telaga, waduk & muara' },
  { id: 'beliung', name: 'Beliung', price: 1500, level: 3, desc: 'menambang batu dan bijih di Tambang Bukit Kapur' },
];
export const needsPurchase = (tool: Tool) => BUYABLE_TOOLS.some((t) => t.id === tool);

// ---------- bag capacity ----------

export const STACK_MAX = 50; // items per bag slot
export const FRIDGE_STACK_MAX = 99; // items per kulkas slot

export const BAG_TIERS: { name: string; slots: number; price: number; level: number }[] = [
  { name: 'Tas Kain', slots: 12, price: 0, level: 1 },
  { name: 'Tas Kulit', slots: 18, price: 3000, level: 2 },
  { name: 'Ransel Petani', slots: 24, price: 9000, level: 4 },
  { name: 'Ransel Besar', slots: 30, price: 20000, level: 6 },
];
export const BAG_MAX_SLOTS = BAG_TIERS[BAG_TIERS.length - 1].slots;

// ---------- weather ----------

export type Weather = 'cerah' | 'hujan' | 'badai' | 'kabut';

export const WEATHER_INFO: Record<Weather, { name: string; icon: string }> = {
  cerah: { name: 'Cerah', icon: '☀' },
  hujan: { name: 'Hujan', icon: '🌧' },
  badai: { name: 'Badai', icon: '⛈' },
  kabut: { name: 'Kabut Asap', icon: '🌫' },
};

/** Odds per season. */
export const WEATHER_ODDS: Record<Season, [Weather, number][]> = {
  Tanam: [['cerah', 45], ['hujan', 45], ['badai', 10]],
  Hujan: [['cerah', 25], ['hujan', 55], ['badai', 20]],
  Panen: [['cerah', 60], ['hujan', 30], ['badai', 10]],
  Kemarau: [['cerah', 72], ['kabut', 23], ['hujan', 5]],
};

export const FORECAST_DAYS = 7;
export const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
export const STORM_DAMAGE = 0.07; // chance per growing crop to be ruined by a storm
export const isWet = (w: Weather) => w === 'hujan' || w === 'badai';

// ---------- furniture (Toko Mebel) ----------

export interface FurnitureDef {
  id: string;
  name: string;
  price: number;
  level: number;
  desc: string;
}

export const FURNITURE: FurnitureDef[] = [
  { id: 'jam', name: 'Jam Dinding', price: 800, level: 2, desc: 'Alarm pagi: bangun pukul 05:00, satu jam ekstra setiap hari.' },
  { id: 'radio', name: 'Radio', price: 2000, level: 4, desc: 'Siaran desa: ikan langka hari ini dan cuaca besok.' },
  { id: 'piala', name: 'Lemari Piala', price: 3000, level: 5, desc: '+5% hadiah koin festival per piala emas (maks +25%).' },
  { id: 'kulkas', name: 'Kulkas', price: 4000, level: 3, desc: 'Simpan bahan, ikan, telur, dan masakan; dapur memakai isinya.' },
  { id: 'peti', name: 'Peti Lumbung', price: 2500, level: 3, desc: 'Gudang kebun: hasil panen, benih, pupuk, sprinkler. 48 slot.' },
  { id: 'kasur', name: 'Kasur Besar', price: 6000, level: 6, desc: 'Tidur nyenyak: +15 tenaga bonus setiap pagi.' },
];
export const furnitureById = (id: string) => FURNITURE.find((f) => f.id === id);

export const FRIDGE_SLOTS = 24;
export const STORAGE_SLOTS = 48;
export const BIG_BED_BONUS = 15;
export const ALARM_WAKE_MIN = 5 * 60;
export const TROPHY_BONUS = 0.05;
export const TROPHY_BONUS_MAX = 5;

// ---------- house renovation ----------

export interface HouseTier {
  name: string;
  w: number; // interior size in tiles
  h: number;
  x: number; // where this interior lives in world tiles (far apart so rooms never show each other)
  price: number;
  level: number;
  perk: string;
}

export const HOUSE_TIERS: HouseTier[] = [
  { name: 'Rumah Kecil', w: 20, h: 12, x: 100, price: 0, level: 1, perk: 'Kamar, dapur, dan meja makan.' },
  { name: 'Rumah Sedang', w: 26, h: 14, x: 220, price: 12000, level: 5, perk: 'Ruang keluarga dengan sofa: istirahat sekali sehari +20 tenaga.' },
  { name: 'Rumah Besar', w: 32, h: 16, x: 290, price: 35000, level: 10, perk: 'Dapur besar: setiap masak jadi 2 porsi. Ruang baca dan akuarium.' },
];
export const SOFA_STAMINA = 20;
export const SOFA_MINUTES = 30;

/** Seeds show as a seed bag; tools and items keep their own icon. */
export const seedIcon = (id: string) => (CROPS.some((c) => c.id === id) ? `seed-${id}` : `icon-${id}`);

// ---------- Warung Bahan (ingredient shop) ----------

export const MARKET_OPEN = 7 * 60;
export const MARKET_CLOSE = 20 * 60;
export const MARKET_OWNER = 'sari'; // Bu Ratu Atit's family warung

/**
 * Every ingredient a recipe uses, at standard (1-star) quality. Prices start at twice the sell
 * price and are raised where needed so buying ingredients to cook and sell never makes a profit,
 * even with the Rumah Besar kitchen's two portions.
 */
export const MARKET_ITEMS: { id: string; price: number }[] = (() => {
  const ids = [...new Set(DISHES.flatMap((d) => Object.keys(d.ingredients)))];
  const price: Record<string, number> = Object.fromEntries(ids.map((id) => [id, produceById(id).sellPrice * 2]));
  for (let pass = 0; pass < 5; pass++)
    for (const d of DISHES) {
      const cost = Object.entries(d.ingredients).reduce((a, [id, n]) => a + price[id] * n, 0);
      const best = d.sellPrice * 2; // two portions in the big kitchen
      if (cost <= best) {
        const k = (best + 5) / cost; // lift this dish's ingredients just above the dish price
        for (const id of Object.keys(d.ingredients)) price[id] = Math.ceil(price[id] * k);
      }
    }
  return ids.map((id) => ({ id, price: Math.ceil(price[id] / 5) * 5 }));
})();
