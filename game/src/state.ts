import {
  CROPS,
  NPCS,
  REQUEST_DAYS,
  REQUESTS_PER_DAY,
  DAY_START_MIN,
  DAYS_PER_SEASON,
  SEASONS,
  STAMINA_MAX,
  WATER_CAN_MAX,
  AFFECTION_MAX,
  BAG_TIERS,
  COOK_MINUTES,
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
} from './data';

export interface Plot {
  tilled: boolean;
  watered: boolean;
  crop?: { id: string; growth: number; dead?: boolean; missed?: number }; // missed = nights without water
  fertilized?: boolean; // speed fertilizer: 2 growth per watered night, lasts until harvest
  sprinkler?: boolean; // a placed sprinkler occupies this tile
}

export interface Request {
  id: number;
  npc: string;
  crop: string;
  qty: number;
  reward: number;
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
  shipping: Record<string, number>;
  plots: Record<string, Plot>; // key "x,y"
  requests: Request[];
  animals: Animal[];
  feed: number;
  coopEggs: Record<string, number>; // eggs waiting in the coop
  nextAnimalId: number;
  festival: { enteredDay: number; points: number; trophies: Record<string, number> };
  nextRequestId: number;
  friendship: Record<string, number>;
  talkedDay: Record<string, number>; // last day the player chatted with each villager
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
  for (const r of s.requests ?? []) r.crop = map(r.crop);
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
  s.stats.requestsDone ??= 0;
  return s;
}

export function load(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as GameState;
      if (s.version === 1) return refreshRequests(migrate(s));
    }
  } catch {
    // corrupted or unavailable storage: start fresh
  }
  return refreshRequests(newGame());
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
}

/** Advance to the next morning: sell shipped goods, grow watered crops, reset daily resources. */
export function endDay(s: GameState, passedOut: boolean): DayReport {
  const report: DayReport = { income: 0, sold: [], grown: 0, withered: 0, sprinkled: 0, eggs: 0, hungry: 0, stormDamage: 0 };
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

  s.minutes = DAY_START_MIN;
  s.stamina = passedOut ? Math.round(STAMINA_MAX * 0.6) : STAMINA_MAX;
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
  return report;
}

export const shopStock = (s: GameState) => CROPS.filter((c) => c.seasons.includes(seasonOf(s.day)));

const randInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

/** Drop expired requests and top the board up with new ones for this season. */
export function refreshRequests(s: GameState): GameState {
  s.requests = s.requests.filter((r) => r.until >= s.day);
  const crops = shopStock(s).filter((c) => c.level <= s.level);
  while (s.requests.length < REQUESTS_PER_DAY && crops.length) {
    const free = NPCS.filter((n) => !s.requests.some((r) => r.npc === n.id));
    const npc = free[randInt(0, free.length - 1)];
    const crop = crops[randInt(0, crops.length - 1)];
    const qty = crop.days <= 3 ? randInt(2, 5) : crop.days <= 5 ? randInt(1, 3) : randInt(1, 2);
    s.requests.push({
      id: s.nextRequestId++,
      npc: npc.id,
      crop: crop.id,
      qty,
      reward: Math.round((crop.sellPrice * qty * 1.6) / 5) * 5,
      // enough time to plant from scratch, grow, and deliver
      until: s.day + crop.days + REQUEST_DAYS - 1,
    });
  }
  return s;
}

/** Hand over produce for a request. Returns false if the player lacks the items. */
export function deliverRequest(s: GameState, id: number): boolean {
  const r = s.requests.find((q) => q.id === id);
  if (!r || countBase(s, r.crop) < r.qty) return false;
  takeBase(s, r.crop, r.qty);
  s.coins += r.reward;
  s.stats.earned += r.reward;
  s.stats.requestsDone++;
  s.friendship[r.npc] = (s.friendship[r.npc] ?? 0) + 1;
  s.requests = s.requests.filter((q) => q.id !== id);
  return true;
}

/** Add XP; returns the levels newly reached (usually empty). */
export function gainXp(s: GameState, n: number): number[] {
  const reached: number[] = [];
  s.xp += n;
  while (s.xp >= xpToNext(s.level)) {
    s.xp -= xpToNext(s.level);
    s.level++;
    reached.push(s.level);
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
}

/** Hand in the entry, rank it against the villagers, and pay out rewards. */
export function enterFestival(s: GameState, items: string[]): FestivalResult {
  const theme = festivalTheme(s.day);
  const entry = items.slice(0, FESTIVAL_MAX_ITEMS);
  for (const id of entry) add(s.produce, id, -1);
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

  s.coins += reward.coins;
  s.stats.earned += reward.coins;
  s.festival.points += reward.points;
  if (reward.trophy) s.festival.trophies[reward.trophy] = (s.festival.trophies[reward.trophy] ?? 0) + 1;
  s.festival.enteredDay = s.day;
  const levels = gainXp(s, reward.xp);
  return { ranking, place, reward, levels };
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
    if (countBase(s, id) < n) return `Bahan kurang: ${produceById(id).name}.`;
  const taken: Record<string, number> = {};
  for (const [id, n] of Object.entries(dish.ingredients))
    for (const [k, q] of Object.entries(takeBase(s, id, n))) add(taken, k, q);
  if (!canAdd(s, 'produce', dish.id)) {
    for (const [k, q] of Object.entries(taken)) add(s.produce, k, q); // put everything back
    return 'Tas penuh! Kosongkan satu slot dulu.';
  }
  add(s.produce, dish.id, 1);
  s.minutes += COOK_MINUTES;
  return null;
}

/** Eat a dish from the bag to restore stamina. */
export function eat(s: GameState, dishId: string): string | null {
  const dish = dishById(dishId);
  if (!dish || !s.produce[dishId]) return 'Masakan tidak ada di tas.';
  if (s.stamina >= STAMINA_MAX) return 'Tenaga masih penuh.';
  add(s.produce, dishId, -1);
  s.stamina = Math.min(STAMINA_MAX, s.stamina + dish.stamina);
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
