import { FRIDGE_SLOTS, STACK_MAX, baseId, starsOf } from '../../data';
import { play } from '../../sfx';
import { bagCapacity, fridgeSlotsUsed, moveFromFridge, moveToFridge, save, slotsUsed } from '../../state';
import { C, HEX, bar as drawBar, card, txt } from '../theme';
import type { UIScene } from '../../scenes/UIScene';

/** Kulkas: tap a stack in the bag to store it, tap a stack in the kulkas to take it back. */
export function openFridge(ui: UIScene) {
  const s = ui.state;
  const W = 720, H = 430;
  const { c, x, y } = ui.openModal(W, H, 'Kulkas');
  c.add(ui.add.text(x + W / 2, y + 50, 'Klik barang untuk memindahkannya. Dapur memakai bahan dari kulkas.', txt(12, C.secondary, false)).setOrigin(0.5, 0));

  const SZ = 46, GAP = 7, COLS = 6, ROWS = 4;
  const gridW = COLS * SZ + (COLS - 1) * GAP;
  const side = (label: string, used: number, cap: number, gx: number, rec: Record<string, number>, onTap: (key: string) => string | null) => {
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
      card(g, sx, sy, SZ, SZ, 'normal', 12);
      c.add(ui.add.image(sx + SZ / 2, sy + SZ / 2 - 2, `icon-${baseId(key)}`).setScale(2));
      c.add(ui.add.text(sx + SZ - 4, sy + SZ - 3, `${q}`, txt(10, C.secondary)).setOrigin(1, 1));
      if (starsOf(key) > 1) c.add(ui.add.text(sx + 4, sy + 3, `★${starsOf(key)}`, txt(9, '#a86f00')));
      const z = ui.add.zone(sx, sy, SZ, SZ).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => {
        const err = onTap(key);
        if (err) {
          play('error');
          return ui.toast(err);
        }
        play('click');
        save(s);
        ui.refresh();
        openFridge(ui);
      });
      c.add(z);
    }
  };
  side('Tas (hasil panen)', slotsUsed(s), bagCapacity(s), x + 28, s.produce, (k) => moveToFridge(s, k));
  side('Kulkas', fridgeSlotsUsed(s), FRIDGE_SLOTS, x + W - 28 - gridW, s.fridge, (k) => moveFromFridge(s, k));
  // arrows between the two grids
  c.add(ui.add.text(x + W / 2, y + 230, '⇄', txt(26, C.tertiary)).setOrigin(0.5));
  ui.button(c, x + W / 2 - 60, y + H - 48, 'Tutup', () => ui.closeModal(), 120);
}
