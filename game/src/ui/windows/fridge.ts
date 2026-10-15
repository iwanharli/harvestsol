import { DISHES, FRIDGE_SLOTS, STACK_MAX, baseId, dishById, isBought, produceById, starsOf } from '../../data';
import { play } from '../../sfx';
import { bagCapacity, fridgeSlotsUsed, moveFromFridge, moveToFridge, save, slotsUsed } from '../../state';
import { C, HEX, bar as drawBar, card, txt, well } from '../theme';
import type { UIScene } from '../../scenes/UIScene';

/** The stack being looked at, and which side it is on. */
let pick: { side: 'bag' | 'fridge'; key: string } | undefined;

/** Kulkas: tap a stack to see what it is, then move it between the bag and the kulkas. */
export function openFridge(ui: UIScene) {
  const s = ui.state;
  const W = 720, H = 500;
  const { c, x, y } = ui.openModal(W, H, 'Kulkas');
  c.add(ui.add.text(x + W / 2, y + 50, 'Klik barang untuk melihat detailnya. Dapur memakai bahan dari kulkas.', txt(12, C.secondary, false)).setOrigin(0.5, 0));

  const SZ = 46, GAP = 7, COLS = 6, ROWS = 4;
  const gridW = COLS * SZ + (COLS - 1) * GAP;
  const side = (label: string, used: number, cap: number, gx: number, rec: Record<string, number>, which: 'bag' | 'fridge') => {
    const gy = y + 104;
    c.add(ui.add.text(gx, y + 78, label, txt(14)));
    c.add(ui.add.text(gx + gridW, y + 78, `${used}/${cap}`, txt(12, used >= cap ? C.red : C.secondary)).setOrigin(1, 0));
    const bg = ui.add.graphics();
    drawBar(bg, gx, y + 96, gridW, used / cap, used >= cap ? HEX.red : HEX.blue);
    c.add(bg);
    const stacks = Object.entries(rec).flatMap(([k, q]) => {
      const out: [string, number][] = [];
      for (let left = q; left > 0; left -= STACK_MAX) out.push([k, Math.min(STACK_MAX, left)]);
      return out;
    });
    for (let i = 0; i < COLS * ROWS; i++) {
      const sx = gx + (i % COLS) * (SZ + GAP);
      const sy = gy + 8 + Math.floor(i / COLS) * (SZ + GAP);
      const g = ui.add.graphics();
      c.add(g);
      const st = stacks[i];
      if (!st) {
        card(g, sx, sy, SZ, SZ, i < cap ? 'muted' : 'locked', 12);
        continue;
      }
      const [key, q] = st;
      const on = pick?.side === which && pick.key === key;
      card(g, sx, sy, SZ, SZ, on ? 'selected' : 'normal', 12);
      c.add(ui.add.image(sx + SZ / 2, sy + SZ / 2 - 2, `icon-${baseId(key)}`).setScale(2));
      c.add(ui.add.text(sx + SZ - 4, sy + SZ - 3, `${q}`, txt(10, C.secondary)).setOrigin(1, 1));
      if (starsOf(key) > 1) c.add(ui.add.text(sx + 4, sy + 3, `★${starsOf(key)}`, txt(9, '#a86f00')));
      const z = ui.add.zone(sx, sy, SZ, SZ).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => {
        play('click');
        pick = { side: which, key };
        openFridge(ui);
      });
      c.add(z);
    }
  };
  side('Tas (hasil panen)', slotsUsed(s), bagCapacity(s), x + 28, s.produce, 'bag');
  side('Kulkas', fridgeSlotsUsed(s), FRIDGE_SLOTS, x + W - 28 - gridW, s.fridge, 'fridge');
  // arrows between the two grids
  c.add(ui.add.text(x + W / 2, y + 218, '⇄', txt(26, C.tertiary)).setOrigin(0.5));

  // detail strip: what the picked item is, and the button to move it across
  if (pick && !((pick.side === 'bag' ? s.produce : s.fridge)[pick.key] > 0)) pick = undefined;
  const dx = x + 28, dy = y + 336, dw = W - 56, dh = 92;
  const dg = ui.add.graphics();
  card(dg, dx, dy, dw, dh, 'normal', 16);
  c.add(dg);
  if (!pick) {
    c.add(ui.add.text(dx + dw / 2, dy + dh / 2, 'Pilih barang di tas atau kulkas', txt(13, C.tertiary, false)).setOrigin(0.5));
  } else {
    const { side: where, key } = pick;
    const id = baseId(key);
    const qty = (where === 'bag' ? s.produce : s.fridge)[key];
    const p = produceById(key);
    well(dg, dx + 46, dy + dh / 2, 30);
    c.add(ui.add.image(dx + 46, dy + dh / 2, `icon-${id}`).setScale(3));
    c.add(ui.add.text(dx + 90, dy + 14, p.name, txt(16)));
    const dish = dishById(id);
    const uses = DISHES.filter((d) => d.ingredients[id]).map((d) => `${d.name} (${d.ingredients[id]})`);
    const info = [
      `${qty} di ${where === 'bag' ? 'tas' : 'kulkas'} · jual ${p.sellPrice} G / buah`,
      dish ? `Masakan · dimakan +${dish.stamina} tenaga` : uses.length ? `Bahan untuk: ${uses.join(', ')}` : 'Tidak dipakai di resep mana pun',
      ...(isBought(key) ? ['Dibeli di warung · tidak bisa ikut festival'] : []),
    ];
    c.add(ui.add.text(dx + 90, dy + 38, info.join('\n'), { ...txt(12, C.secondary, false), lineSpacing: 3, wordWrap: { width: dw - 90 - 190 } }));
    ui.button(c, dx + dw - 176, dy + dh / 2 - 17, where === 'bag' ? 'Simpan ke kulkas →' : '← Ambil ke tas', () => {
      const err = where === 'bag' ? moveToFridge(s, key) : moveFromFridge(s, key);
      if (err) {
        play('error');
        return ui.toast(err);
      }
      play('click');
      pick = { side: where === 'bag' ? 'fridge' : 'bag', key };
      save(s);
      ui.refresh();
      openFridge(ui);
    }, 160);
  }
  ui.button(c, x + W / 2 - 60, y + H - 48, 'Tutup', () => ui.closeModal(), 120);
}
