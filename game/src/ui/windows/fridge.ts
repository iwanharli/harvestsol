import { DISHES, FRIDGE_STACK_MAX, STACK_MAX, baseId, dishById, isBought, produceById, starsOf } from '../../data';
import { play } from '../../sfx';
import { bagCapacity, moveFromStore, moveToStore, save, slotsUsed, storeCap, storeOf, storeSlotsUsed, type Store } from '../../state';
import { C, HEX, bar as drawBar, card, txt, well } from '../theme';
import type { UIScene } from '../../scenes/UIScene';

/** The stack being looked at, and which side it is on. */
let pick: { side: 'bag' | 'fridge'; key: string } | undefined;
let page = 0; // the peti has more slots than one grid shows
let lastKind: Store | undefined;

export const openFridge = (ui: UIScene) => openStore(ui, 'kulkas');
export const openStorage = (ui: UIScene) => openStore(ui, 'peti');

/** Kulkas or Peti Lumbung: tap a stack to see what it is, then move it between the bag and the store. */
export function openStore(ui: UIScene, kind: Store) {
  const s = ui.state;
  if (lastKind !== kind) (pick = undefined), (page = 0), (lastKind = kind);
  const W = 720, H = 514;
  const name = kind === 'kulkas' ? 'Kulkas' : 'Peti Lumbung';
  const where = kind === 'kulkas' ? 'kulkas' : 'peti';
  const rec = storeOf(s, kind);
  const reopen = () => openStore(ui, kind);
  const { c, x, y } = ui.openModal(W, H, name);
  const hint = kind === 'kulkas' ? 'Dapur memakai bahan dari kulkas.' : 'Simpan hasil panen sebanyak apa pun, ambil kapan saja.';
  c.add(ui.add.text(x + W / 2, y + 50, `Klik barang untuk melihat detailnya. ${hint}`, txt(12, C.secondary, false)).setOrigin(0.5, 0));

  const SZ = 46, GAP = 7, COLS = 6, ROWS = 4;
  const gridW = COLS * SZ + (COLS - 1) * GAP;
  const side = (label: string, used: number, cap: number, gx: number, rec: Record<string, number>, which: 'bag' | 'fridge', first = 0) => {
    const gy = y + 104;
    c.add(ui.add.text(gx, y + 78, label, txt(14)));
    c.add(ui.add.text(gx + gridW, y + 78, `${used}/${cap}`, txt(12, used >= cap ? C.red : C.secondary)).setOrigin(1, 0));
    const bg = ui.add.graphics();
    drawBar(bg, gx, y + 96, gridW, used / cap, used >= cap ? HEX.red : HEX.blue);
    c.add(bg);
    const stacks = Object.entries(rec).flatMap(([k, q]) => {
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
        card(g, px, sy, SZ, SZ, i < cap ? 'muted' : 'locked', 12);
        continue;
      }
      const [key, q] = st;
      const on = pick?.side === which && pick.key === key;
      card(g, px, sy, SZ, SZ, on ? 'selected' : 'normal', 12);
      c.add(ui.add.image(px + SZ / 2, sy + SZ / 2 - 2, `icon-${baseId(key)}`).setScale(2));
      c.add(ui.add.text(px + SZ - 4, sy + SZ - 3, `${q}`, txt(10, C.secondary)).setOrigin(1, 1));
      if (starsOf(key) > 1) c.add(ui.add.text(px + 4, sy + 3, `★${starsOf(key)}`, txt(9, '#a86f00')));
      const z = ui.add.zone(px, sy, SZ, SZ).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => {
        play('click');
        pick = { side: which, key };
        reopen();
      });
      c.add(z);
    }
  };
  side('Tas (hasil panen)', slotsUsed(s), bagCapacity(s), x + 28, s.produce, 'bag');
  const cap = storeCap(kind);
  const pages = Math.ceil(cap / (COLS * ROWS));
  page = Math.min(page, pages - 1);
  const sx = x + W - 28 - gridW;
  side(name, storeSlotsUsed(s, kind), cap, sx, rec, 'fridge', page * COLS * ROWS);
  if (pages > 1) {
    // page dots under the grid
    for (let p = 0; p < pages; p++) {
      const label = ui.add.text(sx + gridW / 2 + (p - (pages - 1) / 2) * 56, y + 330, `Hal ${p + 1}`, txt(11, p === page ? C.blue : C.tertiary)).setOrigin(0.5, 0);
      label.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        play('click');
        page = p;
        reopen();
      });
      c.add(label);
    }
  }
  // arrows between the two grids
  c.add(ui.add.text(x + W / 2, y + 218, '⇄', txt(26, C.tertiary)).setOrigin(0.5));

  // detail strip: what the picked item is, and the button to move it across
  if (pick && !((pick.side === 'bag' ? s.produce : rec)[pick.key] > 0)) pick = undefined;
  const dx = x + 28, dy = y + 350, dw = W - 56, dh = 92;
  const dg = ui.add.graphics();
  card(dg, dx, dy, dw, dh, 'normal', 16);
  c.add(dg);
  if (!pick) {
    c.add(ui.add.text(dx + dw / 2, dy + dh / 2, `Pilih barang di tas atau ${where}`, txt(13, C.tertiary, false)).setOrigin(0.5));
  } else {
    const { side: at, key } = pick;
    const id = baseId(key);
    const qty = (at === 'bag' ? s.produce : rec)[key];
    const p = produceById(key);
    well(dg, dx + 46, dy + dh / 2, 30);
    c.add(ui.add.image(dx + 46, dy + dh / 2, `icon-${id}`).setScale(3));
    c.add(ui.add.text(dx + 90, dy + 14, p.name, txt(16)));
    const dish = dishById(id);
    const uses = DISHES.filter((d) => d.ingredients[id]).map((d) => `${d.name} (${d.ingredients[id]})`);
    const info = [
      `${qty} di ${at === 'bag' ? 'tas' : where} · jual ${p.sellPrice} G / buah`,
      dish ? `Masakan · dimakan +${dish.stamina} tenaga` : uses.length ? `Bahan untuk: ${uses.join(', ')}` : 'Tidak dipakai di resep mana pun',
      ...(isBought(key) ? ['Dibeli di warung · tidak bisa ikut festival'] : []),
    ];
    c.add(ui.add.text(dx + 90, dy + 38, info.join('\n'), { ...txt(12, C.secondary, false), lineSpacing: 3, wordWrap: { width: dw - 90 - 190 } }));
    ui.button(c, dx + dw - 176, dy + dh / 2 - 17, at === 'bag' ? `Simpan ke ${where} →` : '← Ambil ke tas', () => {
      const err = at === 'bag' ? moveToStore(s, kind, key) : moveFromStore(s, kind, key);
      if (err) {
        play('error');
        return ui.toast(err);
      }
      play('click');
      pick = { side: at === 'bag' ? 'fridge' : 'bag', key };
      save(s);
      ui.refresh();
      reopen();
    }, 160);
  }
  ui.button(c, x + W / 2 - 60, y + H - 48, 'Tutup', () => ui.closeModal(), 120);
}
