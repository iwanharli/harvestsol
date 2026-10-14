export const TILE = 16;
export const MAP_W = 64;
export const MAP_H = 40;

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
  { id: 'kangkung', name: 'Kangkung', seasons: ['Tanam', 'Hujan'], seedPrice: 15, sellPrice: 35, days: 2, level: 1, color: '#3f9a3f', leaf: '#5fb04a' },
  { id: 'timun', name: 'Timun', seasons: ['Hujan', 'Panen'], seedPrice: 25, sellPrice: 60, days: 3, level: 2, color: '#7cbf4a', leaf: '#4f9a3f' },
  { id: 'terong', name: 'Terong', seasons: ['Hujan'], seedPrice: 30, sellPrice: 75, days: 4, level: 2, color: '#6b3fa0', leaf: '#4a9a3d' },
  { id: 'tomat', name: 'Tomat', seasons: ['Panen'], seedPrice: 35, sellPrice: 80, days: 4, level: 2, color: '#e5533d', leaf: '#4a9a3d' },
  { id: 'ubi', name: 'Ubi', seasons: ['Panen', 'Kemarau'], seedPrice: 30, sellPrice: 70, days: 4, level: 2, color: '#a0527d', leaf: '#5b9c46' },
  { id: 'padi', name: 'Padi', seasons: ['Tanam', 'Hujan'], seedPrice: 50, sellPrice: 130, days: 6, level: 3, color: '#e8c35a', leaf: '#7fb84a' },
  { id: 'cabai', name: 'Cabai', seasons: ['Tanam', 'Kemarau'], seedPrice: 40, sellPrice: 105, days: 5, level: 3, color: '#d62828', leaf: '#3f8a3a' },
  { id: 'singkong', name: 'Singkong', seasons: ['Kemarau'], seedPrice: 45, sellPrice: 115, days: 6, level: 3, color: '#a0703f', leaf: '#4f9a3f' },
  { id: 'jagung', name: 'Jagung', seasons: ['Panen', 'Kemarau'], seedPrice: 60, sellPrice: 150, days: 7, level: 4, color: '#f2cf3c', leaf: '#6aa84f' },
  { id: 'kedelai', name: 'Kedelai', seasons: ['Panen'], seedPrice: 40, sellPrice: 95, days: 5, level: 4, color: '#c9b16a', leaf: '#5b9c46' },
  { id: 'semangka', name: 'Semangka', seasons: ['Kemarau'], seedPrice: 90, sellPrice: 260, days: 8, level: 6, color: '#3f8a3a', leaf: '#4f9a3f' },
  // high-level perennial: expensive, slow, then fruits every few days in any season
  { id: 'sawit', name: 'Sawit', seasons: ['Tanam', 'Hujan', 'Panen', 'Kemarau'], seedPrice: 2000, sellPrice: 300, days: 14, level: 12, regrow: 5, allSeasons: true, color: '#d9541e', leaf: '#2f7d3a' },
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

export type Tool = 'cangkul' | 'siram' | 'benih' | 'tangan' | 'pancing';
export const TOOLS: { id: Tool; name: string; key: string }[] = [
  { id: 'cangkul', name: 'Cangkul', key: '1' },
  { id: 'siram', name: 'Penyiram', key: '2' },
  { id: 'benih', name: 'Benih', key: '3' },
  { id: 'tangan', name: 'Tangan', key: '4' },
  { id: 'pancing', name: 'Pancing', key: '5' },
];

export const WATER_CAN_MAX = 20;
export const STAMINA_MAX = 100;
export const STAMINA_COST: Record<Tool, number> = { cangkul: 2, siram: 1, benih: 0, tangan: 0, pancing: 3 };

// Clock: 1 real second = 10 game minutes. Day runs 06:00–24:00 (108 real seconds).
export const DAY_START_MIN = 6 * 60;
export const DAY_END_MIN = 24 * 60;
export const GAME_MIN_PER_SEC = 10;

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
  { id: 'sprinkler', name: 'Sprinkler', price: 400, desc: 'siram 8 petak tiap pagi', level: 5 },
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
export const REQUESTS_PER_DAY = 3;
export const REQUEST_DAYS = 3;

// ---------- levels ----------

export const XP = { till: 1, water: 1, plant: 2, harvestPerDay: 2, request: 25 };

/** XP needed to go from level l to l+1. */
export const xpToNext = (l: number) => Math.round(40 * Math.pow(l, 1.6));

export const FEATURE_LEVEL = { board: 2, kitchen: 3, coop: 7 };

export const FEATURES: { level: number; name: string }[] = [
  { level: FEATURE_LEVEL.board, name: 'Papan Permintaan Warga' },
  { level: FEATURE_LEVEL.kitchen, name: 'Dapur: masak di rumah' },
  { level: FEATURE_LEVEL.coop, name: 'Kandang Ayam: beli ayam dan pakan di toko' },
];

/** Everything that opens at exactly this level, for the level-up screen. */
export function unlocksAt(level: number): string[] {
  return [
    ...FEATURES.filter((f) => f.level === level).map((f) => f.name),
    ...CROPS.filter((c) => c.level === level).map((c) => `Benih ${c.name}`),
    ...ITEMS.filter((i) => i.level === level).map((i) => i.name),
  ];
}

// ---------- livestock ----------

export const MAX_CHICKENS = 4;
export const CHICKEN_PRICE = 800;
export const FEED_PRICE = 10;
export const AFFECTION_MAX = 10;
export const GOLDEN_EGG_AFFECTION = 8;

/** Sellable goods that are not crops. */
export const PRODUCTS: { id: string; name: string; sellPrice: number }[] = [
  { id: 'telur', name: 'Telur', sellPrice: 50 },
  { id: 'telur-emas', name: 'Telur Emas', sellPrice: 150 },
  { id: 'ikan-nila', name: 'Ikan Nila', sellPrice: 45 },
  { id: 'ikan-mas', name: 'Ikan Mas', sellPrice: 60 },
  { id: 'ikan-lele', name: 'Ikan Lele', sellPrice: 80 },
  { id: 'ikan-emas', name: 'Ikan Emas', sellPrice: 300 },
];

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
  { id: 'tumis-kangkung', name: 'Tumis Kangkung', ingredients: { kangkung: 2 }, sellPrice: 105, stamina: 25, color: '#3f9a3f' },
  { id: 'singkong-goreng', name: 'Singkong Goreng', ingredients: { singkong: 2 }, sellPrice: 300, stamina: 30, color: '#e8c35a' },
  { id: 'telur-dadar', name: 'Telur Dadar', ingredients: { telur: 2 }, sellPrice: 140, stamina: 30, color: '#f7d65a' },
  { id: 'ikan-bakar', name: 'Ikan Bakar', ingredients: { 'ikan-nila': 1 }, sellPrice: 75, stamina: 35, color: '#a0703f' },
  { id: 'sambal-tomat', name: 'Sambal Tomat', ingredients: { tomat: 1, cabai: 1 }, sellPrice: 230, stamina: 20, color: '#d9402f' },
  { id: 'jagung-bakar', name: 'Jagung Bakar', ingredients: { jagung: 1 }, sellPrice: 190, stamina: 25, color: '#e8b830' },
  { id: 'kolak-ubi', name: 'Kolak Ubi', ingredients: { ubi: 2 }, sellPrice: 200, stamina: 40, color: '#c98a4a' },
  { id: 'es-semangka', name: 'Es Semangka', ingredients: { semangka: 2 }, sellPrice: 650, stamina: 20, color: '#e2434b' },
  { id: 'nasi-goreng', name: 'Nasi Goreng Spesial', ingredients: { telur: 1, padi: 1, 'ikan-lele': 1 }, sellPrice: 360, stamina: 60, color: '#c98a4a' },
];

export const dishById = (id: string) => DISHES.find((d) => d.id === id);
export const XP_COOK = 4;
export const COOK_MINUTES = 30;

// ---------- crop quality ----------
// Bag keys carry quality as "padi@3" (3 stars). A plain "padi" is 1 star (also old saves).

export const QUALITY_MULT = [1, 1, 1.25, 1.5, 2, 3]; // indexed by stars
export const baseId = (key: string) => key.split('@')[0];
export const starsOf = (key: string) => Number(key.split('@')[1] ?? 1);
export const qualityKey = (id: string, stars: number) => (stars > 1 ? `${id}@${stars}` : id);
export const stars = (n: number) => '★'.repeat(n);

/** Name and price of anything that can sit in the produce bag (crops, quality crops, products, dishes). */
export function produceById(key: string): { id: string; name: string; sellPrice: number } {
  const id = baseId(key);
  const base = PRODUCTS.find((p) => p.id === id) ?? dishById(id) ?? cropById(id);
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
  { name: 'Ladang', x0: 0, y0: 0, x1: 33, y1: 21 },
  { name: 'Perkampungan Warga', x0: 34, y0: 0, x1: 63, y1: 23 },
  { name: 'Hutan Kecil', x0: 44, y0: 24, x1: 63, y1: 39 },
  { name: 'Danau Biru', x0: 0, y0: 22, x1: 43, y1: 39 },
];

export const zoneAt = (x: number, y: number) => ZONES.find((z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1)?.name ?? '';

// ---------- fishing ----------

export const XP_FISH = 5;
export const RUN_MULT = 1.7;

/** Catch weights per water body; the lake holds bigger and rarer fish. */
export const FISH_TABLE: Record<'kolam' | 'danau', [string, number][]> = {
  kolam: [['ikan-nila', 70], ['ikan-mas', 30]],
  danau: [['ikan-nila', 35], ['ikan-mas', 32], ['ikan-lele', 28], ['ikan-emas', 5]],
};

export function rollFish(where: 'kolam' | 'danau', rainy = false, rand = Math.random) {
  // rain brings the catfish and the golden fish out (double weight)
  const table = FISH_TABLE[where].map(([id, w]) => [id, rainy && (id === 'ikan-lele' || id === 'ikan-emas') ? w * 2 : w] as [string, number]);
  let n = rand() * table.reduce((a, [, w]) => a + w, 0);
  for (const [id, w] of table) if ((n -= w) < 0) return id;
  return table[0][0];
}

/** Tools that must be bought once before they can be used. */
export const BUYABLE_TOOLS: { id: Tool; name: string; price: number; level: number; desc: string }[] = [
  { id: 'pancing', name: 'Pancing', price: 500, level: 2, desc: 'untuk kolam & danau' },
];
export const needsPurchase = (tool: Tool) => BUYABLE_TOOLS.some((t) => t.id === tool);

// ---------- bag capacity ----------

export const STACK_MAX = 99;

export const BAG_TIERS: { name: string; slots: number; price: number; level: number }[] = [
  { name: 'Tas Kain', slots: 12, price: 0, level: 1 },
  { name: 'Tas Kulit', slots: 18, price: 2000, level: 2 },
  { name: 'Ransel Petani', slots: 24, price: 5000, level: 4 },
  { name: 'Ransel Besar', slots: 30, price: 12000, level: 6 },
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
