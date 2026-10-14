import { STACK_MAX, baseId, produceById, starsOf } from '../../data';
import { play } from '../../sfx';
import { bagCapacity, save, shipAll, shipItem, shippingValue, slotsUsed, unshipItem } from '../../state';
import { C, HEX, card, txt } from '../theme';
import type { UIScene } from '../../scenes/UIScene';

/** Kotak Kirim: choose what to sell. Tap a stack to move it; everything in the bin is paid tomorrow morning. */
export function openShipping(ui: UIScene) {
  const s = ui.state;
  const W = 720, H = 450;
  const { c, x, y } = ui.openModal(W, H, 'Kotak Kirim', 'shipping');
  c.add(ui.add.text(x + W / 2, y + 50, 'Klik barang untuk memindahkannya. Isi kotak dibayar besok pagi.', txt(12, C.secondary, false)).setOrigin(0.5, 0));

  const SZ = 46, GAP = 7, COLS = 6, ROWS = 4;
  const gridW = COLS * SZ + (COLS - 1) * GAP;
  const redraw = () => {
    play('click');
    save(s);
    ui.refresh();
    openShipping(ui);
  };
  const side = (label: string, sub: string, gx: number, rec: Record<string, number>, onTap: (key: string) => string | null) => {
    const gy = y + 104;
    c.add(ui.add.text(gx, y + 80, label, txt(14)));
    c.add(ui.add.text(gx + gridW, y + 82, sub, txt(12, C.secondary)).setOrigin(1, 0));
    const stacks = Object.entries(rec).flatMap(([k, q]) => {
      const out: [string, number][] = [];
      for (let left = q; left > 0; left -= STACK_MAX) out.push([k, Math.min(STACK_MAX, left)]);
      return out;
    });
    for (let i = 0; i < COLS * ROWS; i++) {
      const sx = gx + (i % COLS) * (SZ + GAP);
      const sy = gy + Math.floor(i / COLS) * (SZ + GAP);
      const g = ui.add.graphics();
      c.add(g);
      const st = stacks[i];
      if (!st) {
        card(g, sx, sy, SZ, SZ, 'muted', 12);
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
        redraw();
      });
      z.on('pointerover', () => ui.toast(`${produceById(key).name} · ${produceById(key).sellPrice} G/buah`));
      c.add(z);
    }
  };
  const bagValue = Object.entries(s.produce).reduce((a, [k, q]) => a + produceById(k).sellPrice * q, 0);
  side('Tas', `${slotsUsed(s)}/${bagCapacity(s)} slot · ${bagValue.toLocaleString('id-ID')} G`, x + 28, s.produce, (k) => (shipItem(s, k), null));
  side('Kotak Kirim', '', x + W - 28 - gridW, s.shipping, (k) => unshipItem(s, k));
  c.add(ui.add.text(x + W / 2, y + 205, '⇄', txt(26, C.tertiary)).setOrigin(0.5));

  // expected income, right under the bin
  const value = shippingValue(s);
  const tg = ui.add.graphics();
  tg.fillStyle(HEX.greenSoft, 1).fillRoundedRect(x + W - 28 - gridW, y + 316, gridW, 30, 10);
  c.add(tg);
  c.add(ui.add.text(x + W - 28 - gridW / 2, y + 331, `Dibayar besok: ${value.toLocaleString('id-ID')} G`, txt(13, C.green)).setOrigin(0.5));

  const hasBag = Object.keys(s.produce).length > 0;
  const hasBin = Object.keys(s.shipping).length > 0;
  ui.button(c, x + 28, y + H - 52, 'Kirim Semua', () => {
    if (!hasBag) return;
    shipAll(s);
    redraw();
  }, 150, !hasBag);
  ui.button(c, x + 190, y + H - 52, 'Ambil Semua', () => {
    if (!hasBin) return;
    for (const k of Object.keys(s.shipping)) {
      const err = unshipItem(s, k);
      if (err) {
        play('error');
        ui.toast(err);
        break;
      }
    }
    redraw();
  }, 150, !hasBin);
  ui.button(c, x + W - 148, y + H - 52, 'Tutup', () => ui.closeModal(), 120);
}
