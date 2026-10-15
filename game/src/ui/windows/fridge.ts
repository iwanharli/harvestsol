import { CROPS, DISHES, FISH, FRIDGE_STACK_MAX, ITEMS, STACK_MAX, baseId, cropById, dishById, isBought, produceById, seedIcon, starsOf } from '../../data';
import { play } from '../../sfx';
import { bagCapacity, bagFor, isSeedKey, moveFromStore, moveToStore, roomFor, save, slotsUsed, storeCap, storeOf, storeRoom, storeSlotsUsed, type Store } from '../../state';
import { C, HEX, bar as drawBar, card, segmented, txt, well } from '../theme';
import type { UIScene } from '../../scenes/UIScene';

/** The stack being looked at, and which side it is on. */
let pick: { side: 'bag' | 'fridge'; key: string } | undefined;
let amount = 1; // how many to move: starts at the tapped slot's stack
let page = 0; // the peti has more slots than one grid shows
let lastKind: Store | undefined;

/** Sub-tabs: show one kind of goods at a time in both grids. */
const isCrop = (key: string) => !isSeedKey(key) && CROPS.some((c) => c.id === baseId(key));
const FRIDGE_CATS = [
  { name: 'Semua', has: () => true },
  { name: 'Hasil Panen', has: isCrop },
  { name: 'Ikan & Telur', has: (key: string) => FISH.some((f) => f.id === baseId(key)) || baseId(key).startsWith('telur') },
  { name: 'Masakan', has: (key: string) => !!dishById(baseId(key)) },
];
const PETI_CATS = [
  { name: 'Semua', has: () => true },
  { name: 'Hasil Kebun', has: isCrop },
  { name: 'Benih & Alat', has: isSeedKey },
];
let CATS = FRIDGE_CATS;

/** Display name and icon of a store key (seeds and tools are "benih:<id>"). */
function look(key: string) {
  if (isSeedKey(key)) {
    const id = key.slice(6);
    const item = ITEMS.find((i) => i.id === id);
    return { id, name: item ? item.name : `Benih ${cropById(id).name}`, icon: seedIcon(id), seed: true };
  }
  return { id: baseId(key), name: produceById(key).name, icon: `icon-${baseId(key)}`, seed: false };
}
let cat = 0;

export const openFridge = (ui: UIScene) => openStore(ui, 'kulkas');
export const openStorage = (ui: UIScene) => openStore(ui, 'peti');

/** Kulkas or Peti Lumbung: tap a stack to see what it is, then move it between the bag and the store. */
export function openStore(ui: UIScene, kind: Store) {
  const s = ui.state;
  if (lastKind !== kind) (pick = undefined), (page = 0), (cat = 0), (lastKind = kind);
  CATS = kind === 'kulkas' ? FRIDGE_CATS : PETI_CATS;
  const W = 720, H = 536;
  const name = kind === 'kulkas' ? 'Kulkas' : 'Peti Lumbung';
  const where = kind === 'kulkas' ? 'kulkas' : 'peti';
  const rec = storeOf(s, kind);
  const reopen = () => openStore(ui, kind);
  const { c, x, y } = ui.openModal(W, H, name);
  const segW = kind === 'kulkas' ? 132 : 160;
  c.add(
    segmented(ui, x + W / 2 - (segW * CATS.length + 4) / 2, y + 56, CATS.map((k) => k.name), cat, (i) => {
      play('click');
      cat = i;
      page = 0;
      reopen();
    }, segW),
  );

  const SZ = 46, GAP = 7, COLS = 6, ROWS = 4;
  const gridW = COLS * SZ + (COLS - 1) * GAP;
  const side = (label: string, used: number, cap: number, gx: number, rec: Record<string, number>, which: 'bag' | 'fridge', first = 0) => {
    const gy = y + 128;
    c.add(ui.add.text(gx, y + 102, label, txt(14)));
    c.add(ui.add.text(gx + gridW, y + 102, `${used}/${cap}`, txt(12, used >= cap ? C.red : C.secondary)).setOrigin(1, 0));
    const bg = ui.add.graphics();
    drawBar(bg, gx, y + 120, gridW, used / cap, used >= cap ? HEX.red : HEX.blue);
    c.add(bg);
    const stacks = Object.entries(rec).filter(([k]) => CATS[cat].has(k)).flatMap(([k, q]) => {
      const out: [string, number][] = [];
      const per = which === 'bag' ? STACK_MAX : FRIDGE_STACK_MAX;
      for (let left = q; left > 0; left -= per) out.push([k, Math.min(per, left)]);
      return out;
    });
    for (let n = 0; n < COLS * ROWS; n++) {
      const i = first + n;
      const px = gx + (n % COLS) * (SZ + GAP);
      const sy = gy + 8 + Math.floor(n / COLS) * (SZ + GAP);
      const g = ui.add.graphics();
      c.add(g);
      const st = stacks[i];
      if (!st) {
        card(g, px, sy, SZ, SZ, i < cap || cat > 0 ? 'muted' : 'locked', 12);
        continue;
      }
      const [key, q] = st;
      const on = pick?.side === which && pick.key === key;
      card(g, px, sy, SZ, SZ, on ? 'selected' : 'normal', 12);
      c.add(ui.add.image(px + SZ / 2, sy + SZ / 2 - 2, look(key).icon).setScale(2));
      c.add(ui.add.text(px + SZ - 4, sy + SZ - 3, `${q}`, txt(10, C.secondary)).setOrigin(1, 1));
      if (!isSeedKey(key) && starsOf(key) > 1) c.add(ui.add.text(px + 4, sy + 3, `★${starsOf(key)}`, txt(9, '#a86f00')));
      const z = ui.add.zone(px, sy, SZ, SZ).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => {
        play('click');
        pick = { side: which, key };
        amount = q;
        reopen();
      });
      c.add(z);
    }
  };
  const bag = bagFor(s, kind);
  side('Tas', slotsUsed(s), bagCapacity(s), x + 28, bag, 'bag');
  const cap = storeCap(kind);
  const pages = Math.ceil(cap / (COLS * ROWS));
  page = Math.min(page, pages - 1);
  const sx = x + W - 28 - gridW;
  side(name, storeSlotsUsed(s, kind), cap, sx, rec, 'fridge', page * COLS * ROWS);
  if (pages > 1) {
    // page dots under the grid
    for (let p = 0; p < pages; p++) {
      const label = ui.add.text(sx + gridW / 2 + (p - (pages - 1) / 2) * 56, y + 352, `Hal ${p + 1}`, txt(11, p === page ? C.blue : C.tertiary)).setOrigin(0.5, 0);
      label.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        play('click');
        page = p;
        reopen();
      });
      c.add(label);
    }
  }
  // arrows between the two grids
  c.add(ui.add.text(x + W / 2, y + 242, '⇄', txt(26, C.tertiary)).setOrigin(0.5));

  // detail strip: what the picked item is, and the button to move it across
  if (pick && (!((pick.side === 'bag' ? bag : rec)[pick.key] > 0) || !CATS[cat].has(pick.key))) pick = undefined;
  const dx = x + 28, dy = y + 372, dw = W - 56, dh = 92;
  const dg = ui.add.graphics();
  card(dg, dx, dy, dw, dh, 'normal', 16);
  c.add(dg);
  if (!pick) {
    c.add(ui.add.text(dx + dw / 2, dy + dh / 2, `Pilih barang di tas atau ${where}`, txt(13, C.tertiary, false)).setOrigin(0.5));
  } else {
    const { side: at, key } = pick;
    const L = look(key), id = L.id;
    const qty = (at === 'bag' ? bag : rec)[key];
    well(dg, dx + 46, dy + dh / 2, 30);
    c.add(ui.add.image(dx + 46, dy + dh / 2, L.icon).setScale(3));
    c.add(ui.add.text(dx + 90, dy + 14, L.name, txt(16)));
    let info: string[];
    if (L.seed) {
      const item = ITEMS.find((i) => i.id === id);
      const crop = item ? undefined : cropById(id);
      info = [
        `${qty} di ${at === 'bag' ? 'tas' : where}`,
        item ? `${item.desc[0].toUpperCase()}${item.desc.slice(1)}.` : `Tanam: ${crop!.allSeasons ? 'semua musim' : crop!.seasons.join(', ')} · panen ${crop!.days} hari`,
      ];
    } else {
      const p = produceById(key);
      const dish = dishById(id);
      const uses = DISHES.filter((d) => d.ingredients[id]).map((d) => `${d.name} (${d.ingredients[id]})`);
      info = [
        `${qty} di ${at === 'bag' ? 'tas' : where} · jual ${p.sellPrice} G / buah`,
        dish ? `Masakan · dimakan +${dish.stamina} tenaga` : uses.length ? `Bahan untuk: ${uses.join(', ')}` : 'Tidak dipakai di resep mana pun',
        ...(isBought(key) ? ['Dibeli di warung · tidak bisa ikut festival'] : []),
      ];
    }
    c.add(ui.add.text(dx + 90, dy + 38, info.join('\n'), { ...txt(12, C.secondary, false), lineSpacing: 3, wordWrap: { width: dw - 90 - 300 } }));

    // how many to move: limited by what you have and the room on the other side
    const most = Math.max(0, Math.min(qty, at === 'bag' ? storeRoom(s, kind, key) : roomFor(s, L.seed ? 'seeds' : 'produce', id)));
    amount = Math.max(1, Math.min(amount, Math.max(1, most)));
    const rx = dx + dw - 292, ry = dy + 10;
    const step = (label: string, delta: number, bx: number) => {
      const blocked = delta > 0 ? amount >= most : amount <= 1;
      ui.button(c, bx, ry, label, () => {
        if (blocked) return;
        amount = Math.max(1, Math.min(most, amount + delta));
        reopen();
      }, 40, blocked, true);
    };
    step('−10', -10, rx);
    step('−1', -1, rx + 44);
    c.add(ui.add.text(rx + 138, ry + 17, `${amount}`, txt(18, C.blue)).setOrigin(0.5));
    step('+1', 1, rx + 192);
    step('+10', 10, rx + 236);
    ui.button(c, rx, ry + 42, 'Semua', () => ((amount = Math.max(1, most)), reopen()), 84, amount >= most, true);
    const label = at === 'bag' ? `Simpan ${amount} →` : `← Ambil ${amount}`;
    ui.button(c, rx + 92, ry + 42, most < 1 ? (at === 'bag' ? `${where[0].toUpperCase()}${where.slice(1)} penuh` : 'Tas penuh') : label, () => {
      const err = at === 'bag' ? moveToStore(s, kind, key, amount) : moveFromStore(s, kind, key, amount);
      if (err) {
        play('error');
        return ui.toast(err);
      }
      play('click');
      // keep looking at what is left here, or follow the item across when this side is empty
      const left = (at === 'bag' ? bagFor(s, kind) : rec)[key] ?? 0;
      if (!left) pick = { side: at === 'bag' ? 'fridge' : 'bag', key };
      amount = 1;
      save(s);
      ui.refresh();
      reopen();
    }, 184, most < 1);
  }
  ui.button(c, x + W / 2 - 60, y + H - 48, 'Tutup', () => ui.closeModal(), 120);
}
