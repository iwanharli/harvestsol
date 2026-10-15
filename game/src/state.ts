import {
  CROPS,
  DISHES,
  ITEMS,
  PRODUCTS,
  NPCS,
  REQUEST_DAYS,
  REQUESTS_MAX,
  QUALITY_MULT,
  FEATURE_LEVEL,
  DAY_START_MIN,
  DAYS_PER_SEASON,
  SEASONS,
  FISH,
  FRIENDSHIP_MAX,
  STAMINA_MAX,
  STAMINA_MILESTONE_CAP_LEVEL,
  STAMINA_MILESTONE_EVERY,
  STAMINA_PER_MILESTONE,
  STAMINA_REWARD,
  WATER_CAN_MAX,
  AFFECTION_MAX,
  BAG_TIERS,
  ALARM_WAKE_MIN,
  BIG_BED_BONUS,
  COOK_MINUTES,
  HOUSE_TIERS,
  SOFA_MINUTES,
  SOFA_STAMINA,
  FRIDGE_SLOTS,
  TROPHY_BONUS,
  TROPHY_BONUS_MAX,
  LEGACY_CROPS,
  LEGACY_DISHES,
  FORECAST_DAYS,
  STORM_DAMAGE,
  WEATHER_ODDS,
  isWet,
  type Weather,
  baseId,
  starsOf,
  dishById,
  STACK_MAX,
  FRIDGE_STACK_MAX,
  STORAGE_SLOTS,
  PASS_OUT_FINE,
  ORES,
  QUARRY,
  MINE_NODES,
  STAMINA_COST,
  type Ore,
  FESTIVAL_EVERY,
  FESTIVAL_MAX_ITEMS,
  FESTIVAL_REWARDS,
  FESTIVAL_THEME_MULT,
  FESTIVAL_VARIETY_BONUS,
  GOLDEN_EGG_AFFECTION,
  cropById,
  produceById,
  xpToNext,
  type Season,
  type Tool,
  isBought,
  isOre,
} from './data';

export interface Plot {
  tilled: boolean;
  watered: boolean;
  crop?: { id: string; growth: number; dead?: boolean; missed?: number }; // missed = nights without water
  fertilized?: boolean; // speed fertilizer: 2 growth per watered night, lasts until harvest
  sprinkler?: boolean; // a placed sprinkler occupies this tile
}

export type RequestKind = 'biasa' | 'paket' | 'kualitas' | 'kilat';

export interface RequestItem {
  id: string;
  qty: number;
  minStars: number; // 0 also accepts warung goods; 1+ means your own harvest, of at least that quality
}

export interface Request {
  id: number;
  npc: string;
  kind?: RequestKind;
  items?: RequestItem[];
  crop?: string; // legacy single-item requests
  qty?: number;
  reward: number;
  bonusSeeds?: { id: string; qty: number }; // extra seeds handed over with the coins
  note?: string;
  until: number; // last day the request can be delivered
}

export interface Animal {
  id: number;
  name: string;
  affection: number; // 0..AFFECTION_MAX
  fed: boolean; // fed today
  petted: boolean; // petted today
}

export interface GameState {
  version: 1;
  day: number; // 1-based, counts all days played
  minutes: number;
  coins: number;
  level: number;
  xp: number; // progress inside the current level
  stamina: number;
  water: number;
  tool: Tool;
  ownedTools: Tool[]; // bought tools (the starter tools are always available)
  bagTier: number; // index into BAG_TIERS
  weather: Weather; // today
  forecasts: Weather[]; // the next FORECAST_DAYS days, tomorrow first
  seed: string;
  seeds: Record<string, number>;
  produce: Record<string, number>;
  bagOrder?: string[]; // player-chosen slot order, keys like "produce:jagung@2"
  shipping: Record<string, number>;
  plots: Record<string, Plot>; // key "x,y"
  requests: Request[];
  requestDay?: number; // last day new requests were rolled
  animals: Animal[];
  feed: number;
  coopEggs: Record<string, number>; // eggs waiting in the coop
  nextAnimalId: number;
  festival: { enteredDay: number; points: number; trophies: Record<string, number> };
  nextRequestId: number;
  friendship: Record<string, number>;
  talkedDay: Record<string, number>;
  fishCaught: Record<string, number>; // fish id → best stars caught (the fish book)
  staminaRewards: Record<string, boolean>; // one-off max-stamina rewards already granted
  furniture: Record<string, boolean>; // bought furniture ids
  houseTier: number; // index into HOUSE_TIERS
  sofaDay: number; // last day the sofa rest was used
  fridge: Record<string, number>; // kulkas contents (same keys as produce)
  storage: Record<string, number>; // peti lumbung contents (same keys as produce)
  mine?: { day: number; nodes: Record<string, { ore: Ore; hits: number }> }; // today's rocks in the quarry, by tile "x,y"
  pos?: { x: number; y: number; dir: 'down' | 'up' | 'left' | 'right' }; // where the player stands (world px) // last day the player chatted with each villager
  stats: { harvested: number; earned: number; requestsDone: number };
}

const SAVE_KEY = 'cropfarm-save-v1';

export function newGame(): GameState {
  return {
    version: 1,
    day: 1,
    minutes: DAY_START_MIN,
    coins: 300,
    level: 1,
    xp: 0,
    stamina: STAMINA_MAX,
    water: WATER_CAN_MAX,
    tool: 'cangkul',
    ownedTools: [],
    bagTier: 0,
    weather: 'cerah',
    forecasts: Array.from({ length: FORECAST_DAYS }, (_, i) => rollWeather(2 + i)),
    seed: 'kangkung',
    seeds: { kangkung: 6 },
    produce: {},
    shipping: {},
    plots: {},
    requests: [],
    animals: [],
    feed: 0,
    coopEggs: {},
    nextAnimalId: 1,
    festival: { enteredDay: 0, points: 0, trophies: {} },
    nextRequestId: 1,
    friendship: {},
    talkedDay: {},
    fishCaught: {},
    staminaRewards: {},
    furniture: {},
    houseTier: 0,
    sofaDay: 0,
    fridge: {},
    storage: {},
    stats: { harvested: 0, earned: 0, requestsDone: 0 },
  };
}

/** Fill in fields added after a save was written, so old saves keep working. */
/** Rename keys of a bag record (keeps quality suffixes like "@3"). */
function renameKeys(rec: Record<string, number>, map: (id: string) => string) {
  const out: Record<string, number> = {};
  for (const [k, q] of Object.entries(rec)) {
    const [id, stars] = k.split('@');
    const key = stars ? `${map(id)}@${stars}` : map(id);
    out[key] = (out[key] ?? 0) + q;
  }
  return out;
}

/** The first version used temperate crops, dishes and snow; convert them to the tropical set. */
function migrateTropical(s: GameState) {
  const map = (id: string) => LEGACY_CROPS[id] ?? LEGACY_DISHES[id] ?? id;
  s.produce = renameKeys(s.produce, map);
  s.seeds = renameKeys(s.seeds, map);
  s.shipping = renameKeys(s.shipping, map);
  for (const p of Object.values(s.plots)) if (p.crop) p.crop.id = map(p.crop.id);
  for (const r of s.requests ?? []) if (r.crop) r.crop = map(r.crop);
  s.seed = map(s.seed);
  const snow = (w: string) => (w === 'salju' ? 'cerah' : w) as Weather;
  if (s.weather) s.weather = snow(s.weather);
  if (s.forecasts) s.forecasts = s.forecasts.map(snow);
}

function migrate(s: GameState): GameState {
  migrateTropical(s);
  s.level ??= 1;
  s.ownedTools ??= [];
  s.bagTier ??= 0;
  s.weather ??= 'cerah';
  if (!s.forecasts) {
    const old = (s as unknown as { forecast?: Weather }).forecast; // saves from before the 7-day forecast
    s.forecasts = Array.from({ length: FORECAST_DAYS }, (_, i) => (i === 0 && old ? old : rollWeather(s.day + 1 + i)));
  }
  s.xp ??= 0;
  s.requests ??= [];
  s.animals ??= [];
  s.feed ??= 0;
  s.coopEggs ??= {};
  s.nextAnimalId ??= 1;
  s.festival ??= { enteredDay: 0, points: 0, trophies: {} };
  s.nextRequestId ??= 1;
  s.friendship ??= {};
  s.talkedDay ??= {};
  s.fishCaught ??= {};
  s.staminaRewards ??= {};
  s.furniture ??= {};
  s.houseTier ??= 0;
  s.sofaDay ??= 0;
  s.fridge ??= {};
  s.storage ??= {};
  s.stats.requestsDone ??= 0;
  return s;
}

export function load(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as GameState;
      if (s.version === 1) return rollMine(refreshRequests(migrate(s)));
    }
  } catch {
    // corrupted or unavailable storage: start fresh
  }
  return rollMine(refreshRequests(newGame()));
}

export function save(s: GameState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    // storage blocked (private mode); game keeps running unsaved
  }
}

export function resetSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

export const seasonOf = (day: number): Season => SEASONS[Math.floor((day - 1) / DAYS_PER_SEASON) % 4];
export const dayOfSeason = (day: number) => ((day - 1) % DAYS_PER_SEASON) + 1;
export const yearOf = (day: number) => Math.floor((day - 1) / (DAYS_PER_SEASON * 4)) + 1;

export const plotKey = (x: number, y: number) => `${x},${y}`;

export function add(bag: Record<string, number>, id: string, n: number) {
  bag[id] = (bag[id] ?? 0) + n;
  if (bag[id] <= 0) delete bag[id];
}

export interface DayReport {
  income: number;
  sold: { name: string; qty: number; total: number }[];
  grown: number;
  withered: number;
  sprinkled: number;
  eggs: number;
  hungry: number;
  stormDamage: number;
  passedOut?: 'rumah' | 'luar'; // fell asleep at 02:00, in the house or outside
  fine?: number; // coins paid to the villager who carried you home
}

/** Advance to the next morning: sell shipped goods, grow watered crops, reset daily resources. */
export function endDay(s: GameState, passedOut: boolean, outside = false): DayReport {
  const report: DayReport = { income: 0, sold: [], grown: 0, withered: 0, sprinkled: 0, eggs: 0, hungry: 0, stormDamage: 0 };
  if (passedOut) {
    report.passedOut = outside ? 'luar' : 'rumah';
    if (outside) {
      report.fine = Math.min(PASS_OUT_FINE.max, Math.floor(s.coins * PASS_OUT_FINE.rate));
      s.coins -= report.fine;
    }
  }
  for (const [id, qty] of Object.entries(s.shipping)) {
    const c = produceById(id);
    const total = c.sellPrice * qty;
    report.sold.push({ name: c.name, qty, total });
    report.income += total;
  }
  s.coins += report.income;
  s.stats.earned += report.income;
  s.shipping = {};

  const prevSeason = seasonOf(s.day);
  s.day += 1;
  const season = seasonOf(s.day);

  for (const [key, p] of Object.entries(s.plots)) {
    if (p.crop && !p.crop.dead) {
      const def = cropById(p.crop.id);
      if (season !== prevSeason && !def.seasons.includes(season)) {
        p.crop.dead = true;
        report.withered++;
      } else if (p.watered && p.crop.growth < def.days) {
        p.crop.growth = Math.min(def.days, p.crop.growth + (p.fertilized ? 2 : 1));
        report.grown++;
      } else if (p.crop.growth < def.days) {
        p.crop.missed = (p.crop.missed ?? 0) + 1; // a dry night costs quality
      }
    }
    p.watered = false;
    // untended empty soil slowly reverts to grass
    if (!p.crop && !p.fertilized && p.tilled && Math.random() < 0.1) delete s.plots[key];
  }

  // today's weather comes off the front of the forecast; a new day joins the end
  s.weather = isFestivalDay(s.day) ? 'cerah' : (s.forecasts.shift() ?? 'cerah');
  while (s.forecasts.length < FORECAST_DAYS) s.forecasts.push(rollWeather(s.day + 1 + s.forecasts.length));
  if (isWet(s.weather)) {
    for (const p of Object.values(s.plots)) {
      if (p.tilled) p.watered = true;
      if (s.weather === 'badai' && p.crop && !p.crop.dead && Math.random() < STORM_DAMAGE) {
        p.crop.dead = true;
        report.stormDamage++;
      }
    }
  }

  // sprinklers water the 8 tilled tiles around them for the new day
  for (const [key, p] of Object.entries(s.plots)) {
    if (!p.sprinkler) continue;
    const [x, y] = key.split(',').map(Number);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const n = s.plots[plotKey(x + dx, y + dy)];
        if (n?.tilled && !n.watered) {
          n.watered = true;
          report.sprinkled++;
        }
      }
  }

  s.minutes = s.furniture?.jam ? ALARM_WAKE_MIN : DAY_START_MIN;
  s.stamina = passedOut ? Math.round(maxStamina(s) * 0.6) : maxStamina(s) + (s.furniture?.kasur ? BIG_BED_BONUS : 0);
  // chickens: fed ones lay an egg and grow fonder, hungry ones sulk
  for (const a of s.animals) {
    if (a.fed) {
      a.affection = Math.min(AFFECTION_MAX, a.affection + 1);
      const golden = a.affection >= GOLDEN_EGG_AFFECTION && Math.random() < 0.3;
      add(s.coopEggs, golden ? 'telur-emas' : 'telur', 1);
      report.eggs++;
    } else {
      a.affection = Math.max(0, a.affection - 1);
      report.hungry++;
    }
    a.fed = false;
    a.petted = false;
  }

  refreshRequests(s);
  rollMine(s);
  return report;
}

export const shopStock = (s: GameState) => CROPS.filter((c) => c.seasons.includes(seasonOf(s.day)));

const randInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

/** The items a request asks for (old saves stored a single crop). */
export const reqItems = (r: Request): RequestItem[] => r.items ?? [{ id: r.crop!, qty: r.qty!, minStars: 0 }];

/** How many of the bag's items count toward one line of a request. */
export function countFor(s: GameState, it: RequestItem) {
  let n = 0;
  for (const [k, q] of Object.entries(s.produce)) if (baseId(k) === it.id && starsOf(k) >= it.minStars) n += q;
  return n;
}

export const requestReady = (s: GameState, r: Request) => reqItems(r).every((it) => countFor(s, it) >= it.qty);
export const wantsItem = (r: Request, id: string) => reqItems(r).some((it) => it.id === id);

const pickOne = <T>(a: T[]) => a[randInt(0, a.length - 1)];
const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** What could reasonably be delivered this season: crops you can plant, fish that bite, eggs, dishes. */
function requestPool(s: GameState) {
  const season = seasonOf(s.day);
  const crops = shopStock(s).filter((c) => c.level <= s.level);
  const fish = FISH.filter((f) => f.weight >= 10 && (!f.seasons || f.seasons.includes(season)) && f.rain !== 'only');
  const eggs = s.level >= FEATURE_LEVEL.coop && s.animals.length ? ['telur'] : [];
  const have = new Set([...crops.map((c) => c.id), ...fish.map((f) => f.id), ...eggs]);
  const dishes = s.level >= FEATURE_LEVEL.kitchen ? DISHES.filter((d) => Object.keys(d.ingredients).every((k) => have.has(k))) : [];
  return { crops, fish, eggs, dishes };
}

/** Days needed to get hold of an item from scratch. */
function leadDays(id: string): number {
  const crop = CROPS.find((c) => c.id === id);
  if (crop) return crop.days;
  const dish = DISHES.find((d) => d.id === id);
  if (dish) return Math.max(...Object.keys(dish.ingredients).map(leadDays));
  return 2; // fish and eggs
}

const NOTES: Record<RequestKind, string[]> = {
  biasa: ['Buat stok di rumah.', 'Lagi pengin masak yang segar.', 'Titipan saudara dari kota.'],
  paket: ['Untuk hajatan di balai desa.', 'Mau bikin parsel untuk tamu.', 'Isi dapur umum minggu ini.'],
  kualitas: ['Yang paling bagus, untuk dipamerkan.', 'Mau difoto untuk laporan, jangan yang jelek.', 'Untuk tamu penting.'],
  kilat: ['Butuh sekarang juga, tamunya sudah datang!', 'Lupa belanja, besok pagi sudah dipakai.', 'Mendadak, tolong ya!'],
};

/** Build one random request; null when nothing fits right now. */
export function makeRequest(s: GameState, kind: RequestKind, npc: string): Request | null {
  const { crops, fish, eggs, dishes } = requestPool(s);
  const ids = [...crops.map((c) => c.id), ...fish.map((f) => f.id), ...eggs, ...dishes.map((d) => d.id)];
  if (!ids.length) return null;
  // villagers have tastes: the fisherman wants fish, the cook wants dishes
  const taste: Record<string, string[]> = {
    joyo: fish.map((f) => f.id),
    rani: dishes.length ? dishes.map((d) => d.id) : crops.map((c) => c.id),
    dina: crops.map((c) => c.id),
  };
  const pool = taste[npc]?.length && Math.random() < 0.7 ? taste[npc] : ids;
  const qtyOf = (id: string) => {
    const lead = leadDays(id);
    const price = produceById(id).sellPrice;
    return price >= 150 ? 1 : lead <= 3 ? randInt(2, 5) : lead <= 5 ? randInt(1, 3) : randInt(1, 2);
  };
  let items: RequestItem[];
  let mult: number;
  if (kind === 'paket') {
    const picks = [...new Set([pickOne(pool), pickOne(ids), pickOne(ids)])].slice(0, randInt(2, 3));
    if (picks.length < 2) return null;
    items = picks.map((id) => ({ id, qty: qtyOf(id), minStars: 1 }));
    mult = 1.9;
  } else if (kind === 'kualitas') {
    const cropIds = crops.map((c) => c.id).filter((id) => pool.includes(id) || pool === ids);
    const id = pickOne(cropIds.length ? cropIds : crops.map((c) => c.id));
    if (!id) return null;
    const min = s.level >= 6 && Math.random() < 0.4 ? 4 : 3;
    items = [{ id, qty: randInt(1, 2), minStars: min }];
    mult = 1.6 * QUALITY_MULT[min] * 1.15;
  } else if (kind === 'kilat') {
    // only things you could already have: what is in the bag, or quick crops
    const inBag = [...new Set(Object.keys(s.produce).map(baseId))].filter((id) => ids.includes(id));
    const quick = ids.filter((id) => leadDays(id) <= 2);
    const id = pickOne(inBag.length ? inBag : quick.length ? quick : ids);
    items = [{ id, qty: Math.max(1, Math.ceil(qtyOf(id) / 2)), minStars: 1 }];
    mult = 2.2;
  } else {
    const id = pickOne(pool);
    items = [{ id, qty: qtyOf(id), minStars: 0 }];
    mult = 1.6;
  }
  const value = items.reduce((a, it) => a + produceById(it.id).sellPrice * it.qty, 0);
  const lead = Math.max(...items.map((it) => leadDays(it.id)));
  const until = kind === 'kilat' ? s.day + 1 : s.day + lead + REQUEST_DAYS - 1 + (kind === 'paket' ? 2 : 0);
  const seedable = crops.filter((c) => c.level <= s.level);
  const bonusSeeds = kind !== 'biasa' && seedable.length && Math.random() < 0.35 ? { id: pickOne(seedable).id, qty: randInt(3, 6) } : undefined;
  return { id: s.nextRequestId++, npc, kind, items, reward: round5(value * mult), bonusSeeds, note: pickOne(NOTES[kind]), until };
}

/**
 * Drop expired requests; once per day, villagers may post 0-2 new ones (the board is
 * sometimes empty). The first day always has a couple to show how the board works.
 */
export function refreshRequests(s: GameState): GameState {
  s.requests = s.requests.filter((r) => r.until >= s.day);
  if (s.requestDay === s.day) return s;
  s.requestDay = s.day;
  const roll = Math.random();
  let n = s.day === 1 ? 2 : roll < 0.3 ? 0 : roll < 0.8 ? 1 : 2;
  n = Math.min(n, REQUESTS_MAX - s.requests.length);
  for (let i = 0; i < n; i++) {
    const free = NPCS.filter((v) => !s.requests.some((r) => r.npc === v.id));
    if (!free.length) break;
    const k = Math.random();
    const kind: RequestKind = s.day === 1 ? 'biasa' : k < 0.45 ? 'biasa' : k < 0.7 ? 'paket' : k < 0.88 ? 'kualitas' : 'kilat';
    const r = makeRequest(s, kind, pickOne(free).id) ?? makeRequest(s, 'biasa', pickOne(free).id);
    if (r) s.requests.push(r);
  }
  return s;
}

/** Hand over the goods for a request; returns an error message or null. Lowest qualifying quality goes first. */
export function deliverRequest(s: GameState, id: number): string | null {
  const r = s.requests.find((q) => q.id === id);
  if (!r) return 'Permintaan sudah tidak ada.';
  const short = reqItems(r).find((it) => countFor(s, it) < it.qty);
  if (short) return `Kurang ${short.qty - countFor(s, short)} ${produceById(short.id).name}${short.minStars > 1 ? ` ★${short.minStars}+` : ''}.`;
  if (r.bonusSeeds && !canAdd(s, 'seeds', r.bonusSeeds.id, r.bonusSeeds.qty)) return 'Tas penuh, tidak ada tempat untuk hadiah benih.';
  for (const it of reqItems(r)) {
    let n = it.qty;
    const keys = Object.keys(s.produce)
      .filter((k) => baseId(k) === it.id && starsOf(k) >= it.minStars)
      .sort((a, b) => starsOf(a) - starsOf(b));
    for (const k of keys) {
      if (n <= 0) break;
      const q = Math.min(n, s.produce[k]);
      add(s.produce, k, -q);
      n -= q;
    }
  }
  if (r.bonusSeeds) add(s.seeds, r.bonusSeeds.id, r.bonusSeeds.qty);
  s.coins += r.reward;
  s.stats.earned += r.reward;
  s.stats.requestsDone++;
  s.friendship[r.npc] = (s.friendship[r.npc] ?? 0) + (r.kind && r.kind !== 'biasa' ? 2 : 1);
  s.requests = s.requests.filter((q) => q.id !== id);
  return null;
}

/** Add XP; returns the levels newly reached (usually empty). */
export function gainXp(s: GameState, n: number): number[] {
  const reached: number[] = [];
  s.xp += n;
  while (s.xp >= xpToNext(s.level)) {
    s.xp -= xpToNext(s.level);
    s.level++;
    reached.push(s.level);
    if (s.level % STAMINA_MILESTONE_EVERY === 0 && s.level <= STAMINA_MILESTONE_CAP_LEVEL) s.stamina += STAMINA_PER_MILESTONE;
  }
  return reached;
}

// ---------- festival ----------

export const isFestivalDay = (day: number) => dayOfSeason(day) % FESTIVAL_EVERY === 0;

export function nextFestivalDay(day: number) {
  let d = day;
  while (!isFestivalDay(d)) d++;
  return d;
}

/** Theme crop of the festival on `day`: rotates through that season's crops. */
export function festivalTheme(day: number) {
  const season = seasonOf(day);
  const crops = CROPS.filter((c) => c.seasons.includes(season) && !c.allSeasons);
  const week = Math.floor((dayOfSeason(day) - 1) / FESTIVAL_EVERY);
  return crops[week % crops.length];
}

export function festivalScore(items: string[], themeId: string) {
  let score = 0;
  // quality raises the price, the theme bonus applies to any quality of the theme crop
  for (const key of items) score += produceById(key).sellPrice * (baseId(key) === themeId ? FESTIVAL_THEME_MULT : 1);
  return score + new Set(items.map(baseId)).size * FESTIVAL_VARIETY_BONUS;
}

export interface FestivalResult {
  ranking: { name: string; score: number; you: boolean }[];
  place: number; // 0-based
  reward: (typeof FESTIVAL_REWARDS)[number];
  levels: number[];
  bonusCoins: number; // Lemari Piala
}

/** Hand in the entry, rank it against the villagers, and pay out rewards. */
export function enterFestival(s: GameState, items: string[]): FestivalResult {
  const theme = festivalTheme(s.day);
  const entry = items.filter((k) => !isBought(k) && !isOre(baseId(k))).slice(0, FESTIVAL_MAX_ITEMS); // own harvest only; handed back after judging
  const yours = festivalScore(entry, theme.id);

  // villagers get stronger as the year goes on
  const target = 220 + s.day * 12;
  const ranking = NPCS.slice(0, 4).map((n) => ({
    name: n.name,
    score: Math.round((target * (0.55 + Math.random() * 0.75)) / 5) * 5,
    you: false,
  }));
  ranking.push({ name: 'Kamu', score: yours, you: true });
  ranking.sort((a, b) => b.score - a.score || (a.you ? -1 : 1));
  const place = ranking.findIndex((r) => r.you);
  const reward = FESTIVAL_REWARDS[place];

  const bonusCoins = s.furniture?.piala
    ? Math.round(reward.coins * TROPHY_BONUS * Math.min(TROPHY_BONUS_MAX, s.festival.trophies.emas ?? 0))
    : 0;
  s.coins += reward.coins + bonusCoins;
  s.stats.earned += reward.coins + bonusCoins;
  s.festival.points += reward.points;
  if (reward.trophy) s.festival.trophies[reward.trophy] = (s.festival.trophies[reward.trophy] ?? 0) + 1;
  s.festival.enteredDay = s.day;
  const levels = gainXp(s, reward.xp);
  return { ranking, place, reward, levels, bonusCoins };
}

// ---------- bag capacity ----------

export type BagKind = 'produce' | 'seeds';

const stacks = (q: number) => Math.ceil(q / STACK_MAX);

export const bagCapacity = (s: GameState) => BAG_TIERS[s.bagTier].slots;

/** Slots in use: every 99 of one item takes a slot, across produce and seeds/items. */
export function slotsUsed(s: GameState) {
  let n = 0;
  for (const q of Object.values(s.produce)) n += stacks(q);
  for (const q of Object.values(s.seeds)) n += stacks(q);
  return n;
}

/** How many of `id` still fit in the bag (0 when full). */
export function roomFor(s: GameState, bag: BagKind, id: string) {
  const cur = s[bag][id] ?? 0;
  const freeSlots = bagCapacity(s) - slotsUsed(s);
  const partial = cur % STACK_MAX ? STACK_MAX - (cur % STACK_MAX) : 0; // space left in the open stack
  return Math.max(0, partial + freeSlots * STACK_MAX);
}

export const canAdd = (s: GameState, bag: BagKind, id: string, n = 1) => roomFor(s, bag, id) >= n;

/** Buy the next bag tier; returns an error message or null. */
export function upgradeBag(s: GameState): string | null {
  const next = BAG_TIERS[s.bagTier + 1];
  if (!next) return 'Tas sudah paling besar.';
  if (s.level < next.level) return `${next.name} terbuka di Level ${next.level}.`;
  if (s.coins < next.price) return `Uang tidak cukup (butuh ${next.price} G).`;
  s.coins -= next.price;
  s.bagTier++;
  return null;
}

// ---------- cooking ----------

/** Turn ingredients into a dish. Returns an error message, or null on success. */
export function cook(s: GameState, dishId: string): string | null {
  const dish = dishById(dishId);
  if (!dish) return 'Resep tidak dikenal.';
  for (const [id, n] of Object.entries(dish.ingredients))
    if (countIngredient(s, id) < n) return `Bahan kurang: ${produceById(id).name}.`;
  const taken: Record<string, number> = {};
  for (const [id, n] of Object.entries(dish.ingredients)) {
    const fromBag = Math.min(n, countBase(s, id));
    for (const [k, q] of Object.entries(takeBase(s, id, fromBag))) add(taken, k, q);
    // the rest comes out of the kulkas (returned to the bag if cooking fails)
    for (const [k, q] of Object.entries(takeFrom(s.fridge, id, n - fromBag))) add(taken, k, q);
  }
  const portions = s.houseTier >= 2 ? 2 : 1; // Rumah Besar's big kitchen
  if (!canAdd(s, 'produce', dish.id, portions)) {
    for (const [k, q] of Object.entries(taken)) add(s.produce, k, q); // put everything back
    return 'Tas penuh! Kosongkan satu slot dulu.';
  }
  add(s.produce, dish.id, portions);
  s.minutes += COOK_MINUTES;
  return null;
}

/** Eat a dish from the bag to restore stamina. */
export function eat(s: GameState, dishId: string): string | null {
  const dish = dishById(dishId);
  if (!dish || !s.produce[dishId]) return 'Masakan tidak ada di tas.';
  if (s.stamina >= maxStamina(s)) return 'Tenaga masih penuh.';
  add(s.produce, dishId, -1);
  s.stamina = Math.min(maxStamina(s), s.stamina + dish.stamina);
  return null;
}

// ---------- quality helpers ----------

/** How many of a crop/product the bag holds, any quality. */
export function countBase(s: GameState, id: string) {
  let n = 0;
  for (const [k, q] of Object.entries(s.produce)) if (baseId(k) === id) n += q;
  return n;
}

/** Remove n of a crop/product, lowest quality first, so the best ones stay. Returns what was taken. */
export function takeBase(s: GameState, id: string, n: number): Record<string, number> {
  const taken: Record<string, number> = {};
  const keys = Object.keys(s.produce)
    .filter((k) => baseId(k) === id)
    .sort((a, b) => starsOf(a) - starsOf(b));
  for (const k of keys) {
    if (n <= 0) break;
    const q = Math.min(n, s.produce[k]);
    add(s.produce, k, -q);
    taken[k] = q;
    n -= q;
  }
  return taken;
}

/** Stars for a crop at harvest: steady watering, fertilizer, and a little luck. */
export function harvestStars(s: GameState, crop: NonNullable<Plot['crop']>, fertilized: boolean, rand = Math.random) {
  const missed = crop.missed ?? 0;
  let q = 1 + (missed === 0 ? 2 : missed === 1 ? 1 : 0) + (fertilized ? 1 : 0);
  if (rand() < 0.1 + s.level * 0.02) q++;
  return Math.min(5, q);
}

// ---------- weather ----------

/** Weather for a day: festival days are always clear. */
export function rollWeather(day: number, rand = Math.random): Weather {
  if (isFestivalDay(day)) return 'cerah';
  const odds = WEATHER_ODDS[seasonOf(day)];
  let n = rand() * odds.reduce((a, [, w]) => a + w, 0);
  for (const [w, weight] of odds) if ((n -= weight) < 0) return w;
  return 'cerah';
}

// ---------- max stamina ----------

/** Base 100, +10 every 4 levels up to Lv 20, plus one-off rewards (up to 170). */
export function maxStamina(s: GameState) {
  const milestones = Math.floor(Math.min(s.level, STAMINA_MILESTONE_CAP_LEVEL) / STAMINA_MILESTONE_EVERY);
  const rewards = Object.values(s.staminaRewards ?? {}).filter(Boolean).length;
  return STAMINA_MAX + milestones * STAMINA_PER_MILESTONE + rewards * STAMINA_REWARD;
}

/**
 * Grant one-off max-stamina rewards that are now earned; returns a message per new reward.
 * Jamu Kuat: the first villager to reach ♥10. Fish Book: every species caught.
 */
export function checkStaminaRewards(s: GameState): string[] {
  const out: string[] = [];
  const grant = (key: string, msg: string) => {
    if (s.staminaRewards[key]) return;
    s.staminaRewards[key] = true;
    s.stamina += STAMINA_REWARD; // the new headroom comes filled
    out.push(msg);
  };
  const close = Object.entries(s.friendship).find(([, v]) => v >= FRIENDSHIP_MAX);
  if (close) grant('jamu', `Kamu dapat Jamu Kuat! Tenaga maksimal +${STAMINA_REWARD}.`);
  if (FISH.every((f) => s.fishCaught[f.id])) grant('fishbook', `Buku Ikan lengkap! Tenaga maksimal +${STAMINA_REWARD}.`);
  return out;
}

// ---------- kulkas ----------

/** Ingredients the kitchen can use: the bag, plus the kulkas once it is bought. */
export function countIngredient(s: GameState, id: string) {
  let n = countBase(s, id);
  if (s.furniture?.kulkas) for (const [k, q] of Object.entries(s.fridge)) if (baseId(k) === id) n += q;
  return n;
}

/** Remove n of an item from a record, lowest quality first. */
function takeFrom(rec: Record<string, number>, id: string, n: number): Record<string, number> {
  const taken: Record<string, number> = {};
  const keys = Object.keys(rec)
    .filter((k) => baseId(k) === id)
    .sort((a, b) => starsOf(a) - starsOf(b));
  for (const k of keys) {
    if (n <= 0) break;
    const q = Math.min(n, rec[k]);
    add(rec, k, -q);
    taken[k] = q;
    n -= q;
  }
  return taken;
}

export type Store = 'kulkas' | 'peti';
export const storeOf = (s: GameState, w: Store) => (w === 'kulkas' ? s.fridge : s.storage);
export const storeCap = (w: Store) => (w === 'kulkas' ? FRIDGE_SLOTS : STORAGE_SLOTS);
export const storeSlotsUsed = (s: GameState, w: Store) =>
  Object.values(storeOf(s, w)).reduce((a, q) => a + Math.ceil(q / FRIDGE_STACK_MAX), 0);
export const fridgeSlotsUsed = (s: GameState) => storeSlotsUsed(s, 'kulkas');

/** Seeds, pupuk and sprinklers sit in a store under "benih:<id>"; produce uses its own key. */
export const isSeedKey = (key: string) => key.startsWith('benih:');
const bagRecOf = (s: GameState, key: string) => (isSeedKey(key) ? s.seeds : s.produce);
const bagIdOf = (key: string) => (isSeedKey(key) ? key.slice(6) : key);

/** The peti only takes farm goods: harvested vegetables and fruit, seeds, pupuk and sprinklers. */
export const storeAllows = (w: Store, key: string) =>
  w === 'peti' ? isSeedKey(key) || CROPS.some((c) => c.id === baseId(key)) : !isSeedKey(key) && !isOre(baseId(key));

/** What the bag can offer to a store, keyed the way that store keeps it. */
export function bagFor(s: GameState, w: Store): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, q] of Object.entries(s.produce)) if (q > 0 && storeAllows(w, k)) out[k] = q;
  if (w === 'peti') for (const [k, q] of Object.entries(s.seeds)) if (q > 0) out[`benih:${k}`] = q;
  return out;
}

/** How many more of an item fit in the kulkas or peti. */
export function storeRoom(s: GameState, w: Store, key: string) {
  const cur = storeOf(s, w)[key] ?? 0;
  const partial = cur % FRIDGE_STACK_MAX ? FRIDGE_STACK_MAX - (cur % FRIDGE_STACK_MAX) : 0;
  return partial + Math.max(0, storeCap(w) - storeSlotsUsed(s, w)) * FRIDGE_STACK_MAX;
}

/** Move n of an item (all of it when n is left out) from the bag into the kulkas or peti; returns an error or null. */
export function moveToStore(s: GameState, w: Store, key: string, n?: number): string | null {
  if (!storeAllows(w, key)) return w === 'peti' ? 'Peti Lumbung hanya untuk hasil kebun, benih, pupuk, dan sprinkler.' : 'Kulkas hanya untuk makanan: hasil panen, ikan, telur, dan masakan.';
  const src = bagRecOf(s, key), id = bagIdOf(key);
  const q = Math.min(n ?? Infinity, src[id] ?? 0);
  if (q <= 0) return null;
  if (q > storeRoom(s, w, key)) return w === 'kulkas' ? 'Kulkas penuh.' : 'Peti penuh.';
  add(src, id, -q);
  add(storeOf(s, w), key, q);
  return null;
}

/** Take n of a stored item (as much as fits when n is left out) back into the bag. */
export function moveFromStore(s: GameState, w: Store, key: string, n?: number): string | null {
  const rec = storeOf(s, w);
  const q = Math.min(n ?? Infinity, rec[key] ?? 0);
  if (q <= 0) return null;
  const id = bagIdOf(key);
  const room = roomFor(s, isSeedKey(key) ? 'seeds' : 'produce', id);
  if (!room) return 'Tas penuh.';
  if (n !== undefined && q > room) return `Tas hanya muat ${room} lagi.`;
  const m = Math.min(q, room);
  add(rec, key, -m);
  add(bagRecOf(s, key), id, m);
  return null;
}

export const moveToFridge = (s: GameState, key: string) => moveToStore(s, 'kulkas', key);
export const moveFromFridge = (s: GameState, key: string) => moveFromStore(s, 'kulkas', key);

/** Buy a piece of furniture; returns an error message or null. */
export function buyFurniture(s: GameState, id: string, price: number, level: number): string | null {
  if (s.furniture[id]) return 'Sudah dimiliki.';
  if (s.level < level) return `Terbuka di Level ${level}.`;
  if (s.coins < price) return `Uang tidak cukup (butuh ${price.toLocaleString('id-ID')} G).`;
  s.coins -= price;
  s.furniture[id] = true;
  return null;
}

// ---------- renovation & sofa ----------

export function upgradeHouse(s: GameState): string | null {
  const next = HOUSE_TIERS[s.houseTier + 1];
  if (!next) return 'Rumah sudah paling besar.';
  if (s.level < next.level) return `${next.name} terbuka di Level ${next.level}.`;
  if (s.coins < next.price) return `Uang tidak cukup (butuh ${next.price.toLocaleString('id-ID')} G).`;
  s.coins -= next.price;
  s.houseTier++;
  return null;
}

/** Rest on the sofa once a day for a little stamina (may go above the maximum, like a nap). */
export function restOnSofa(s: GameState): string | null {
  if (s.sofaDay === s.day) return 'Sudah istirahat di sofa hari ini.';
  s.sofaDay = s.day;
  s.stamina += SOFA_STAMINA;
  s.minutes += SOFA_MINUTES;
  return null;
}

// ---------- shipping bin ----------

/** Put a whole stack (or everything) from the bag into the shipping bin. */
export function shipItem(s: GameState, key: string, n = Infinity) {
  const q = Math.min(n, s.produce[key] ?? 0);
  if (q <= 0) return;
  add(s.produce, key, -q);
  add(s.shipping, key, q);
}

export function shipAll(s: GameState) {
  for (const k of Object.keys(s.produce)) shipItem(s, k);
}

/** Take items back out of the bin before the night; returns an error message or null. */
export function unshipItem(s: GameState, key: string, want = Infinity): string | null {
  const q = Math.min(want, s.shipping[key] ?? 0);
  if (q <= 0) return null;
  const n = Math.min(q, roomFor(s, 'produce', key));
  if (!n) return 'Tas penuh.';
  add(s.shipping, key, -n);
  add(s.produce, key, n);
  return null;
}

/** What the bin will pay tomorrow morning. */
export const shippingValue = (s: GameState) =>
  Object.entries(s.shipping).reduce((a, [k, q]) => a + produceById(k).sellPrice * q, 0);

/** Bag entries in the player's order; anything new goes to the end. */
export function bagOrderKeys(s: GameState): string[] {
  const present = [
    ...Object.keys(s.produce).filter((k) => s.produce[k] > 0).map((k) => `produce:${k}`),
    ...Object.keys(s.seeds).filter((k) => s.seeds[k] > 0).map((k) => `seeds:${k}`),
  ];
  const have = new Set(present);
  const order = (s.bagOrder ?? []).filter((k) => have.has(k));
  for (const k of present) if (!order.includes(k)) order.push(k);
  return order;
}

/** Move one bag entry onto another one's place (or to the end when dropped on an empty slot). */
export function moveInBag(s: GameState, from: string, to?: string) {
  const order = bagOrderKeys(s);
  const target = to ? order.indexOf(to) : order.length;
  const i = order.indexOf(from);
  if (i < 0 || from === to) return;
  order.splice(i, 1);
  order.splice(Math.min(target, order.length), 0, from);
  s.bagOrder = order;
}

/** Auto-tidy: crops, fish, animal products, dishes, then seeds and tools; best quality first. */
/** Sort order for "Rapikan": produce before seeds, then by kind and catalogue order, best quality first. */
function tidyRank(seed: boolean, id: string): number[] {
  const b = baseId(id);
  const lists: { id: string }[][] = seed ? [CROPS, ITEMS] : [CROPS, FISH, PRODUCTS, DISHES];
  const group = lists.findIndex((l) => l.some((x) => x.id === b));
  const pos = group < 0 ? 0 : lists[group].findIndex((x) => x.id === b);
  return [seed ? 1 : 0, group < 0 ? 9 : group, pos, -starsOf(id)];
}
const byRank = (ra: number[], rb: number[]) => {
  for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
  return 0;
};

export function sortBag(s: GameState) {
  const rank = (key: string) => tidyRank(key.startsWith('seeds:'), key.slice(key.indexOf(':') + 1));
  s.bagOrder = bagOrderKeys(s).sort((a, b) => byRank(rank(a), rank(b)));
}

/** Tidy the kulkas or peti: the grid follows the record's key order, so rebuild it sorted. */
export function sortStore(s: GameState, w: Store) {
  const rec = storeOf(s, w);
  const rank = (key: string) => (isSeedKey(key) ? tidyRank(true, key.slice(6)) : tidyRank(false, key));
  const sorted = Object.keys(rec).sort((a, b) => byRank(rank(a), rank(b)));
  const out: Record<string, number> = {};
  for (const k of sorted) out[k] = rec[k];
  if (w === 'kulkas') s.fridge = out;
  else s.storage = out;
}

// ---------- mining ----------

/** Fresh rocks in the quarry each morning; ores above your level are rarer. */
export function rollMine(s: GameState, rand = Math.random): GameState {
  if (s.mine?.day === s.day) return s;
  const nodes: Record<string, { ore: Ore; hits: number }> = {};
  const kinds = Object.entries(ORES) as [Ore, (typeof ORES)[Ore]][];
  const weight = (o: (typeof ORES)[Ore]) => (s.level >= o.level ? o.weight : o.weight / 4);
  const total = kinds.reduce((a, [, o]) => a + weight(o), 0);
  let tries = 0;
  while (Object.keys(nodes).length < MINE_NODES && tries++ < 500) {
    // keep the entrance column and the edges walkable
    const x = QUARRY.x + 1 + Math.floor(rand() * (QUARRY.w - 2));
    const y = QUARRY.y + 1 + Math.floor(rand() * (QUARRY.h - 2));
    if (y === QUARRY.y + Math.floor(QUARRY.h / 2)) continue; // the entrance row
    const k = `${x},${y}`;
    if (nodes[k]) continue;
    let n = rand() * total;
    let ore: Ore = 'batu';
    for (const [id, o] of kinds) if ((n -= weight(o)) < 0) { ore = id; break; }
    nodes[k] = { ore, hits: ORES[ore].hits };
  }
  s.mine = { day: s.day, nodes };
  return s;
}

/** One swing at a rock: returns what it dropped when it breaks, an error, or null while it holds. */
export function mineHit(s: GameState, key: string, rand = Math.random): { error?: string; drop?: { id: Ore; qty: number } } {
  const node = s.mine?.nodes[key];
  if (!node) return {};
  const o = ORES[node.ore];
  const qty = o.drop[0] + Math.floor(rand() * (o.drop[1] - o.drop[0] + 1));
  if (node.hits <= 1 && !canAdd(s, 'produce', node.ore, qty)) return { error: 'Tas penuh! Kosongkan slot dulu.' };
  s.stamina -= STAMINA_COST.beliung;
  node.hits--;
  if (node.hits > 0) return {};
  delete s.mine!.nodes[key];
  add(s.produce, node.ore, qty);
  return { drop: { id: node.ore, qty } };
}
