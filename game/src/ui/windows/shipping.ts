import { STACK_MAX, baseId, produceById, starsOf } from '../../data';
import { play } from '../../sfx';
import { bagCapacity, save, shipAll, shipItem, shippingValue, slotsUsed, unshipItem } from '../../state';
import { C, HEX, card, txt } from '../theme';
import type { UIScene } from '../../scenes/UIScene';

/** The stack being moved and how many of it (kept between redraws). */
let pick: { from: 'bag' | 'bin'; key: string; qty: number } | undefined;

/** Kotak Kirim: choose what to sell and how many. Everything in the bin is paid tomorrow morning. */
export function openShipping(ui: UIScene) {
  const s = ui.state;
  const W = 720, H = 474;
  const { c, x, y } = ui.openModal(W, H, 'Kotak Kirim', 'shipping');
  c.add(ui.add.text(x + W / 2, y + 50, 'Klik barang lalu pilih jumlahnya. Isi kotak dibayar besok pagi.', txt(12, C.secondary, false)).setOrigin(0.5, 0));

  const SZ = 46, GAP = 7, COLS = 6, ROWS = 4;
  const gridW = COLS * SZ + (COLS - 1) * GAP;
  const redraw = () => {
    play('click');
    save(s);
    ui.refresh();
    openShipping(ui);
  };
  const side = (label: string, sub: string, gx: number, rec: Record<string, number>, from: 'bag' | 'bin') => {
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
      card(g, sx, sy, SZ, SZ, pick?.from === from && pick.key === key ? 'selected' : 'normal', 12);
      c.add(ui.add.image(sx + SZ / 2, sy + SZ / 2 - 2, `icon-${baseId(key)}`).setScale(2));
      c.add(ui.add.text(sx + SZ - 4, sy + SZ - 3, `${q}`, txt(10, C.secondary)).setOrigin(1, 1));
      if (starsOf(key) > 1) c.add(ui.add.text(sx + 4, sy + 3, `★${starsOf(key)}`, txt(9, '#a86f00')));
      const z = ui.add.zone(sx, sy, SZ, SZ).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => {
        pick = { from, key, qty: rec[key] }; // start at "all", adjust below
        redraw();
      });
      z.on('pointerover', () => ui.toast(`${produceById(key).name} · ${produceById(key).sellPrice} G/buah`));
      c.add(z);
    }
  };
  const bagValue = Object.entries(s.produce).reduce((a, [k, q]) => a + produceById(k).sellPrice * q, 0);
  // drop a selection whose stack is gone
  if (pick && !(pick.from === 'bag' ? s.produce : s.shipping)[pick.key]) pick = undefined;
  side('Tas', `${slotsUsed(s)}/${bagCapacity(s)} slot · ${bagValue.toLocaleString('id-ID')} G`, x + 28, s.produce, 'bag');
  side('Kotak Kirim', '', x + W - 28 - gridW, s.shipping, 'bin');

  // quantity picker under the bag grid
  const px = x + 28, py = y + 318, pw = gridW;
  const pg = ui.add.graphics();
  card(pg, px, py, pw, 80, 'muted', 14);
  c.add(pg);
  if (!pick) {
    c.add(ui.add.text(px + pw / 2, py + 40, 'Pilih barang di tas atau di kotak', txt(12, C.tertiary, false)).setOrigin(0.5));
  } else {
    const p = pick;
    const have = (p.from === 'bag' ? s.produce : s.shipping)[p.key] ?? 0;
    p.qty = Math.max(1, Math.min(have, p.qty));
    const info = produceById(p.key);
    c.add(ui.add.image(px + 24, py + 40, `icon-${baseId(p.key)}`).setScale(2));
    c.add(ui.add.text(px + 46, py + 14, info.name, txt(12)));
    c.add(ui.add.text(px + 46, py + 33, `${p.qty} / ${have}`, txt(16, C.blue)));
    c.add(ui.add.text(px + 46, py + 56, `${(info.sellPrice * p.qty).toLocaleString('id-ID')} G`, txt(11, C.orange)));
    const step = (label: string, delta: number | 'max', bx: number) =>
      ui.button(c, bx, py + 6, label, () => {
        p.qty = delta === 'max' ? have : Math.max(1, Math.min(have, p.qty + delta));
        redraw();
      }, 34, false, true);
    step('−10', -10, px + 128);
    step('−1', -1, px + 166);
    step('+1', 1, px + 204);
    step('+10', 10, px + 242);
    ui.button(c, px + 128, py + 42, 'Maks', () => ((p.qty = have), redraw()), 64, false, true);
    ui.button(c, px + 196, py + 42, p.from === 'bag' ? `Kirim ${p.qty}` : `Ambil ${p.qty}`, () => {
      const err = p.from === 'bag' ? (shipItem(s, p.key, p.qty), null) : unshipItem(s, p.key, p.qty);
      if (err) {
        play('error');
        return ui.toast(err);
      }
      redraw();
    }, 112);
  }
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
