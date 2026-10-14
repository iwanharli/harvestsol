export const TILE = 16;
export const MAP_W = 64;
export const MAP_H = 40;

// Field where the player may till soil.
export const FIELD = { x: 8, y: 8, w: 16, h: 9 };

export type Season = 'Semi' | 'Panas' | 'Gugur' | 'Dingin';
export const SEASONS: Season[] = ['Semi', 'Panas', 'Gugur', 'Dingin'];
export const DAYS_PER_SEASON = 28;

export interface CropDef {
  id: string;
  name: string;
  seasons: Season[];
  seedPrice: number;
  sellPrice: number;
  days: number; // watered days needed to mature
  level: number; // player level needed to buy the seed
  color: string; // produce colour used for procedural sprites
  leaf: string;
}

export const CROPS: CropDef[] = [
  { id: 'lobak', name: 'Lobak', seasons: ['Semi'], seedPrice: 20, sellPrice: 45, days: 3, level: 1, color: '#f4f1e8', leaf: '#5fb04a' },
  { id: 'kentang', name: 'Kentang', seasons: ['Semi'], seedPrice: 40, sellPrice: 95, days: 5, level: 2, color: '#c9955a', leaf: '#4f9a3f' },
  { id: 'stroberi', name: 'Stroberi', seasons: ['Semi'], seedPrice: 90, sellPrice: 240, days: 8, level: 6, color: '#e2434b', leaf: '#3f8a3a' },
  { id: 'tomat', name: 'Tomat', seasons: ['Panas'], seedPrice: 35, sellPrice: 80, days: 4, level: 2, color: '#e5533d', leaf: '#4a9a3d' },
  { id: 'jagung', name: 'Jagung', seasons: ['Panas'], seedPrice: 60, sellPrice: 150, days: 7, level: 4, color: '#f2cf3c', leaf: '#6aa84f' },
  { id: 'labu', name: 'Labu', seasons: ['Gugur'], seedPrice: 70, sellPrice: 190, days: 7, level: 5, color: '#e88a2d', leaf: '#4f8f3a' },
  { id: 'ubi', name: 'Ubi', seasons: ['Gugur'], seedPrice: 30, sellPrice: 70, days: 4, level: 2, color: '#a0527d', leaf: '#5b9c46' },
];

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
  { id: 'sari', name: 'Bu Sari', role: 'pemilik warung' },
  { id: 'darto', name: 'Pak Darto', role: 'kepala desa' },
  { id: 'rani', name: 'Mbak Rani', role: 'koki' },
  { id: 'joyo', name: 'Kakek Joyo', role: 'nelayan tua' },
  { id: 'dina', name: 'Dina', role: 'anak penjual roti' },
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
  { id: 'sup-lobak', name: 'Sup Lobak', ingredients: { lobak: 2 }, sellPrice: 130, stamina: 25, color: '#f4f1e8' },
  { id: 'kentang-goreng', name: 'Kentang Goreng', ingredients: { kentang: 2 }, sellPrice: 230, stamina: 30, color: '#f2cf3c' },
  { id: 'telur-dadar', name: 'Telur Dadar', ingredients: { telur: 2 }, sellPrice: 140, stamina: 30, color: '#f7d65a' },
  { id: 'ikan-bakar', name: 'Ikan Bakar', ingredients: { 'ikan-nila': 1 }, sellPrice: 75, stamina: 35, color: '#a0703f' },
  { id: 'sambal-tomat', name: 'Sambal Tomat', ingredients: { tomat: 2 }, sellPrice: 210, stamina: 20, color: '#d9402f' },
  { id: 'jagung-bakar', name: 'Jagung Bakar', ingredients: { jagung: 1 }, sellPrice: 190, stamina: 25, color: '#e8b830' },
  { id: 'kolak-labu', name: 'Kolak Labu', ingredients: { labu: 1, ubi: 1 }, sellPrice: 340, stamina: 40, color: '#e88a2d' },
  { id: 'selai-stroberi', name: 'Selai Stroberi', ingredients: { stroberi: 2 }, sellPrice: 600, stamina: 20, color: '#c0303b' },
  { id: 'nasi-goreng', name: 'Nasi Goreng Spesial', ingredients: { telur: 1, kentang: 1, 'ikan-lele': 1 }, sellPrice: 320, stamina: 60, color: '#c98a4a' },
];

export const dishById = (id: string) => DISHES.find((d) => d.id === id);
export const XP_COOK = 4;
export const COOK_MINUTES = 30;

// ---------- crop quality ----------
// Bag keys carry quality as "lobak@3" (3 stars). A plain "lobak" is 1 star (also old saves).

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

export const NPC_LINES: Record<string, string[]> = {
  sari: ['Warungku selalu butuh sayur segar!', 'Kentangmu kemarin enak sekali.', 'Jangan lupa makan, petani juga butuh tenaga.'],
  darto: ['Desa ini makin ramai sejak kamu datang.', 'Festival minggu ini jangan sampai terlewat.', 'Kakekmu dulu petani terbaik di sini.'],
  rani: ['Aku sedang mencoba resep baru.', 'Bahan segar membuat masakan istimewa.', 'Telur emas? Wah, aku mau lihat!'],
  joyo: ['Danau sedang tenang hari ini.', 'Dulu ikan di sini sebesar lenganku.', 'Duduklah di dermaga sore hari, indah sekali.'],
  dina: ['Kak, ayamnya lucu ya!', 'Aku mau jadi petani juga nanti!', 'Ibu bilang roti hari ini laris.'],
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

export function rollFish(where: 'kolam' | 'danau', rand = Math.random) {
  const table = FISH_TABLE[where];
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
