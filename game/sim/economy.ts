// Economy simulation: plays one in-game year (112 days) with a few player styles,
// using the game's real rules (crops, quality, XP curve, fish, festivals, weather).
// Run: npm run sim
import {
  CHICKEN_PRICE,
  CROPS,
  FEATURE_LEVEL,
  FEED_PRICE,
  ITEMS,
  QUALITY_MULT,
  STAMINA_COST,
  XP,
  fishById,
  fishStars,
  fishXp,
  rollFish,
  ORES,
  UPGRADE_COST,
  CAVE_BOTTOM,
  CAVE_TREASURE,
  mineCost,
  produceById,
  type CropDef,
  type Ore,
} from '../src/data';
import {
  festivalScore,
  festivalTheme,
  gainXp,
  harvestStars,
  isFestivalDay,
  maxStamina,
  newGame,
  rollWeather,
  seasonOf,
  genFloor,
  type GameState,
} from '../src/state';
import { FESTIVAL_REWARDS } from '../src/data';

const DAYS = Number(process.env.SIM_DAYS ?? 112); // one year by default; SIM_DAYS=224 for two
const FIELD_MAX = 16 * 9;

interface Style {
  name: string;
  maxTiles: number; // how much field the player bothers to farm
  castsPerDay: number; // fishing casts per day once the rod is owned
  nightFishing: boolean; // fishes in the evening too (night-only species)
  fertilizer: boolean;
  sprinklers: boolean;
  chickens: boolean;
  festivals: boolean;
  requestRate: number; // share of days a villager request gets delivered
  sawit: boolean; // converts the field to oil palm at Lv 12
  reactionMs: [number, number]; // fishing reaction time range
  mineBudget: number; // stamina spent in the cave per day (once the pickaxe is bought)
  upgrades: boolean; // takes tools to the Bengkel when it can
}

const STYLES: Style[] = [
  { name: 'Santai', maxTiles: 16, castsPerDay: 3, nightFishing: false, fertilizer: false, sprinklers: false, chickens: false, festivals: false, requestRate: 0.3, sawit: false, reactionMs: [350, 700], mineBudget: 0, upgrades: false },
  { name: 'Rajin', maxTiles: 72, castsPerDay: 4, nightFishing: true, fertilizer: true, sprinklers: true, chickens: true, festivals: true, requestRate: 0.7, sawit: false, reactionMs: [250, 500], mineBudget: 30, upgrades: true },
  { name: 'Pemancing', maxTiles: 8, castsPerDay: 22, nightFishing: true, fertilizer: false, sprinklers: false, chickens: false, festivals: true, requestRate: 0.3, sawit: false, reactionMs: [200, 450], mineBudget: 0, upgrades: true },
  { name: 'Sawit', maxTiles: 72, castsPerDay: 2, nightFishing: false, fertilizer: true, sprinklers: true, chickens: true, festivals: true, requestRate: 0.6, sawit: true, reactionMs: [300, 600], mineBudget: 0, upgrades: true },
  { name: 'Penambang', maxTiles: 16, castsPerDay: 2, nightFishing: false, fertilizer: false, sprinklers: false, chickens: false, festivals: false, requestRate: 0.3, sawit: false, reactionMs: [300, 600], mineBudget: 90, upgrades: true },
];

interface Tile {
  crop?: { def: CropDef; growth: number; missed: number; fert: boolean };
}

interface Result {
  style: string;
  levelDays: Record<number, number>;
  coinsBySeason: number[];
  income: Record<string, number>;
  finalLevel: number;
  firstSawitDay?: number;
  bestDay: number;
  deepest: number;
  tiers: Record<string, number>;
  upgradeSpend: number;
}

/** Deterministic RNG so runs are comparable. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function simulate(style: Style, seed: number): Result {
  const rand = rng(seed);
  const realRandom = Math.random;
  Math.random = rand; // game helpers that use Math.random (weather, luck) follow the seed

  const s: GameState = newGame();
  const tiles: Tile[] = [];
  let tilled = 0;
  let sprinklers = 0;
  let chickens = 0;
  let rod = false;
  const levelDays: Record<number, number> = { 1: 1 };
  const coinsBySeason: number[] = [];
  const income: Record<string, number> = { tanaman: 0, ikan: 0, telur: 0, permintaan: 0, festival: 0, tambang: 0 };
  const spent: Record<string, number> = { upgrade: 0 };
  let pick = false;
  let deepest = 0;
  const ore: Record<string, number> = {};
  const tier: Record<string, number> = { siram: 0, cangkul: 0, pancing: 0, beliung: 0 };
  let forge: { tool: string; ready: number } | undefined;
  let chest = false;
  let firstSawitDay: number | undefined;
  let bestDay = 0;
  let weather = s.weather;
  let forecast = rollWeather(2, rand);

  const xp = (n: number) => {
    for (const l of gainXp(s, n)) levelDays[l] ??= s.day;
  };
  const bestCrop = (season: ReturnType<typeof seasonOf>) => {
    const options = CROPS.filter((c) => c.level <= s.level && c.seasons.includes(season) && (style.sawit ? true : c.id !== 'sawit'));
    // value per day, assuming ~3 stars
    return options
      .filter((c) => c.id !== 'sawit')
      .sort((a, b) => (b.sellPrice * 1.5 - b.seedPrice) / b.days - (a.sellPrice * 1.5 - a.seedPrice) / a.days)[0];
  };

  for (s.day = 1; s.day <= DAYS; s.day++) {
    const season = seasonOf(s.day);
    if (s.day > 1) {
      weather = isFestivalDay(s.day) ? 'cerah' : forecast;
      forecast = rollWeather(s.day + 1, rand);
    }
    const wet = weather === 'hujan' || weather === 'badai';
    const startCoins = s.coins;
    let stamina = maxStamina(s); // grows at level milestones

    // ---- shopping / upgrades in the morning ----
    const rodPrice = 800;
    if (!rod && s.level >= 2 && s.coins >= rodPrice + 300) {
      s.coins -= rodPrice;
      rod = true;
    }
    if (style.mineBudget && !pick && s.level >= 3 && s.coins >= 1500 + 300) {
      s.coins -= 1500;
      pick = true;
    }
    // the Bengkel: collect, then hand in the next tool (watering can, hoe, pickaxe, rod)
    if (forge && s.day >= forge.ready) {
      tier[forge.tool]++;
      forge = undefined;
    }
    if (style.upgrades && !forge) {
      for (const tool of ['siram', 'cangkul', 'beliung', 'pancing']) {
        if (tool === 'beliung' && !pick) continue;
        if (tool === 'pancing' && !rod) continue;
        const c = UPGRADE_COST[tier[tool] + 1];
        if (!c || s.level < c.level || s.coins < c.coins + 500 || (ore[c.ore] ?? 0) < c.qty) continue;
        s.coins -= c.coins;
        spent.upgrade += c.coins;
        ore[c.ore] -= c.qty;
        forge = { tool, ready: s.day + c.days };
        break;
      }
    }
    if (style.sprinklers && s.level >= 5) {
      const sprinklerPrice = ITEMS.find((i) => i.id === 'sprinkler')!.price;
      while (sprinklers * 8 < tiles.length && s.coins >= sprinklerPrice + 600) {
        s.coins -= sprinklerPrice;
        sprinklers++;
      }
    }
    if (style.chickens && s.level >= FEATURE_LEVEL.coop) {
      while (chickens < 4 && s.coins >= CHICKEN_PRICE + 1500) {
        s.coins -= CHICKEN_PRICE;
        chickens++;
      }
    }

    // ---- field: grow to the target size, plant, water, harvest ----
    const fishingStamina = rod ? style.castsPerDay * STAMINA_COST.pancing : 0;
    const mineStamina = pick && forge?.tool !== 'beliung' ? style.mineBudget : 0;
    const manualWaterBudget = Math.max(0, stamina - fishingStamina - mineStamina - 10) * [1, 1, 3, 9][tier.siram];
    const sprinkled = Math.min(tiles.length, sprinklers * 8);
    const wantTiles = Math.min(style.maxTiles, FIELD_MAX, sprinkled + manualWaterBudget);
    while (tiles.length < wantTiles && stamina > fishingStamina + 12) {
      tiles.push({});
      tilled++;
      stamina -= STAMINA_COST.cangkul / [1, 2, 3, 9][forge?.tool === 'cangkul' ? 0 : tier.cangkul];
      xp(XP.till);
    }

    for (const t of tiles) {
      // season change withers crops that do not grow now (sawit grows in all seasons)
      if (t.crop && !t.crop.def.seasons.includes(season)) t.crop = undefined;

      if (!t.crop) {
        const sawitPrice = CROPS.find((c) => c.id === 'sawit')!.seedPrice;
        const wantSawit = style.sawit && s.level >= 12 && s.coins >= sawitPrice + 500;
        const def = wantSawit ? CROPS.find((c) => c.id === 'sawit')! : bestCrop(season);
        if (def && s.coins >= def.seedPrice) {
          s.coins -= def.seedPrice;
          const fert = style.fertilizer && s.level >= 3 && s.coins >= 50 && def.sellPrice * 0.5 > 50;
          if (fert) s.coins -= ITEMS.find((i) => i.id === 'pupuk')!.price;
          t.crop = { def, growth: 0, missed: 0, fert };
          xp(XP.plant);
          if (def.id === 'sawit') firstSawitDay ??= s.day;
        }
      }
    }

    // watering: rain and sprinklers first, then by hand while stamina lasts
    let sprinklerLeft = sprinklers * 8;
    const watered = new Set<Tile>();
    for (const t of tiles) {
      if (!t.crop) continue;
      if (wet) watered.add(t);
      else if (sprinklerLeft > 0) {
        sprinklerLeft--;
        watered.add(t);
      } else if (stamina - fishingStamina >= STAMINA_COST.siram) {
        stamina -= STAMINA_COST.siram / [1, 1, 3, 9][forge?.tool === 'siram' ? 0 : tier.siram];
        watered.add(t);
        xp(XP.water);
      }
    }

    // ---- fishing ----
    if (rod) {
      for (let i = 0; i < style.castsPerDay && stamina >= STAMINA_COST.pancing; i++) {
        stamina -= STAMINA_COST.pancing;
        const hour = style.nightFishing ? 6 + rand() * 18 : 6 + rand() * 12;
        const id = rollFish('danau', season, hour, wet, rand);
        const reaction = style.reactionMs[0] + rand() * (style.reactionMs[1] - style.reactionMs[0]);
        const q = fishStars(reaction, s.level, rand);
        const value = Math.round((fishById(id)?.sellPrice ?? 45) * QUALITY_MULT[q]);
        s.coins += value;
        income.ikan += value;
        xp(fishXp(id));
      }
    }

    // ---- the cave: back down to the deepest floor, break rocks until the ladder shows ----
    if (mineStamina) {
      let budget = Math.min(mineStamina, stamina);
      let floor = Math.max(1, deepest);
      const damage = 1 + (forge?.tool === 'beliung' ? 0 : tier.beliung);
      while (budget > 0) {
        genFloor(s, floor, rand);
        const cave = s.cave!;
        const keys = Object.keys(cave.nodes).sort(() => rand() - 0.5);
        let found = false;
        for (const k of keys) {
          const n = cave.nodes[k];
          const swings = Math.ceil(n.hits / damage);
          const cost = swings * mineCost(floor);
          if (budget < cost) break;
          budget -= cost;
          stamina -= cost;
          const o = ORES[n.ore as Ore];
          const qty = o.drop[0] + Math.floor(rand() * (o.drop[1] - o.drop[0] + 1));
          ore[n.ore] = (ore[n.ore] ?? 0) + qty;
          xp(n.ore === 'batu' ? 1 : 3);
          if (k === cave.ladder) {
            found = true;
            break;
          }
        }
        if (floor >= CAVE_BOTTOM && !chest) {
          chest = true;
          s.coins += CAVE_TREASURE.coins;
          income.tambang += CAVE_TREASURE.coins;
        }
        if (!found || floor >= CAVE_BOTTOM) break;
        floor++;
        deepest = Math.max(deepest, floor);
      }
      // sell what the next upgrades do not need (keep 10 of each ore)
      for (const id of Object.keys(ore)) {
        const keep = id === 'batu' || id === 'kristal' || id === 'batu-mulia' ? 0 : 10;
        const sell = Math.max(0, ore[id] - keep);
        if (!sell) continue;
        ore[id] -= sell;
        const v = sell * produceById(id).sellPrice;
        s.coins += v;
        income.tambang += v;
      }
    }

    // ---- villager requests ----
    // about 0.9 new requests a day; a mix of simple (1.6x), bundles (1.9x, ~6 items), quality and rush ones
    if (s.level >= FEATURE_LEVEL.board && rand() < style.requestRate * 0.9) {
      const c = bestCrop(season);
      if (c) {
        const reward = Math.round(c.sellPrice * 6.1 * (0.6 + rand() * 0.8));
        s.coins += reward;
        income.permintaan += reward;
        xp(XP.request);
      }
    }

    // ---- chickens ----
    if (chickens) {
      const eggValue = s.day > (levelDays[FEATURE_LEVEL.coop] ?? DAYS) + 10 ? 80 : 50; // golden eggs once they are fond of you
      const net = chickens * (eggValue - FEED_PRICE);
      s.coins += net;
      income.telur += net;
    }

    // ---- night: grow, harvest tomorrow morning (modelled here) ----
    let harvestValue = 0;
    let bestKey = '';
    let bestPrice = 0;
    for (const t of tiles) {
      const c = t.crop;
      if (!c) continue;
      if (watered.has(t)) c.growth = Math.min(c.def.days, c.growth + (c.fert ? 2 : 1));
      else c.missed++;
      if (c.growth >= c.def.days) {
        const q = harvestStars(s, { id: c.def.id, growth: c.growth, missed: c.missed }, c.fert, rand);
        const price = Math.round(c.def.sellPrice * QUALITY_MULT[q]);
        harvestValue += price;
        if (price > bestPrice) {
          bestPrice = price;
          bestKey = q > 1 ? `${c.def.id}@${q}` : c.def.id;
        }
        xp(XP.harvestPerDay * c.def.days);
        if (c.def.regrow) {
          c.growth = c.def.days - c.def.regrow;
          c.missed = 0;
        } else t.crop = undefined;
      }
    }
    s.coins += harvestValue;
    income.tanaman += harvestValue;

    // ---- festival (entry: up to 5 of today's best harvest) ----
    if (style.festivals && isFestivalDay(s.day) && bestKey) {
      const theme = festivalTheme(s.day);
      const entry = Array(5).fill(bestKey);
      const yours = festivalScore(entry, theme.id);
      const target = 220 + s.day * 12;
      const npcs = Array.from({ length: 4 }, () => target * (0.55 + rand() * 0.75));
      const place = npcs.filter((n) => n > yours).length;
      const reward = FESTIVAL_REWARDS[place];
      s.coins += reward.coins; // entries are handed back after judging
      income.festival += reward.coins;
      xp(reward.xp);
    }

    bestDay = Math.max(bestDay, s.coins - startCoins);
    if (s.day % 28 === 0) coinsBySeason.push(s.coins);
  }

  Math.random = realRandom;
  return { style: style.name, levelDays, coinsBySeason, income, finalLevel: s.level, firstSawitDay, bestDay, deepest, tiers: { ...tier }, upgradeSpend: spent.upgrade };
}

// ---- run several seeds per style and report medians ----
const SEEDS = 25;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const fmt = (n: number) => Math.round(n).toLocaleString('id-ID');

for (const style of STYLES) {
  const runs = Array.from({ length: SEEDS }, (_, i) => simulate(style, 1000 + i * 7919));
  const lv = (l: number) => {
    const days = runs.map((r) => r.levelDays[l]).filter((d): d is number => d !== undefined);
    return days.length < SEEDS / 2 ? '—' : `hari ${median(days)}`;
  };
  console.log(`\n=== ${style.name} (median dari ${SEEDS} percobaan) ===`);
  console.log(`Level akhir tahun: ${median(runs.map((r) => r.finalLevel))}`);
  console.log(`Lv2 ${lv(2)} · Lv3 ${lv(3)} · Lv5 ${lv(5)} · Lv7 ${lv(7)} · Lv10 ${lv(10)} · Lv12 ${lv(12)}`);
  console.log(`Uang akhir musim: ${runs[0].coinsBySeason.map((_, i) => i).map((i) => fmt(median(runs.map((r) => r.coinsBySeason[i])))).join(' → ')} G`);
  const inc = Object.keys(runs[0].income).map((k) => `${k} ${fmt(median(runs.map((r) => r.income[k])))}`);
  console.log(`Pendapatan setahun: ${inc.join(' · ')}`);
  console.log(`Hari terbaik: +${fmt(median(runs.map((r) => r.bestDay)))} G`);
  const sawit = runs.map((r) => r.firstSawitDay).filter((d): d is number => d !== undefined);
  if (style.mineBudget) console.log(`Gua terdalam: lantai ${median(runs.map((r) => r.deepest))}`);
  if (style.upgrades) console.log(`Tingkat alat (siram/cangkul/beliung/pancing): ${['siram', 'cangkul', 'beliung', 'pancing'].map((t) => median(runs.map((r) => r.tiers[t]))).join('/')} · belanja upgrade ${fmt(median(runs.map((r) => r.upgradeSpend)))} G`);
  if (style.sawit) console.log(`Sawit pertama: ${sawit.length ? `hari ${median(sawit)}` : 'tidak tercapai dalam setahun'}`);
}
