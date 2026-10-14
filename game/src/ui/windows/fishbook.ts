import { FISH } from '../../data';
import { C, HEX, bar as drawBar, card, txt, well } from '../theme';

import type { UIScene } from '../../scenes/UIScene';

const INK = C.ink;

/** Every fish with where and when it bites; uncaught ones are silhouettes with hints. */
export function openFishBook(ui: UIScene) {
  const s = ui.state;
  const COLS = 5, cw = 124, ch = 112, gap = 8;
  const rows = Math.ceil(FISH.length / COLS);
  const W = 680, H = 78 + rows * (ch + gap) + 52;
  const caught = FISH.filter((f) => s.fishCaught[f.id]).length;
  const { c, x, y } = ui.openModal(W, H, 'Buku Ikan', 'fishbook');
  c.add(ui.add.text(x + W - 28, y + 20, `${caught}/${FISH.length} ditemukan`, txt(13, C.secondary)).setOrigin(1, 0));
  const pb = ui.add.graphics();
  drawBar(pb, x + W - 128, y + 40, 100, caught / FISH.length, HEX.blue);
  c.add(pb);

  const gx = x + (W - (COLS * cw + (COLS - 1) * gap)) / 2;
  FISH.forEach((f, i) => {
    const cx = gx + (i % COLS) * (cw + gap);
    const cy = y + 66 + Math.floor(i / COLS) * (ch + gap);
    const best = s.fishCaught[f.id] ?? 0;
    const g = ui.add.graphics();
    card(g, cx, cy, cw, ch, best ? 'normal' : 'muted', 14);
    well(g, cx + cw / 2, cy + 28, 20, !best);
    c.add(g);
    const icon = ui.add.image(cx + cw / 2, cy + 28, `icon-${f.id}`).setScale(2);
    if (!best) icon.setTint(0x1d1d1f).setAlpha(0.25); // silhouette until caught
    c.add(icon);
    c.add(ui.add.text(cx + cw / 2, cy + 54, best ? f.name : '???', txt(12, best ? INK : C.tertiary)).setOrigin(0.5, 0));
    c.add(
      ui.add
        .text(cx + cw / 2, cy + 70, best ? `${'★'.repeat(best)} · ${f.sellPrice} G` : `${f.sellPrice} G`, txt(10, best ? '#a86f00' : C.disabled))
        .setOrigin(0.5, 0),
    );
    // hints: where, when, which season/weather
    const where = f.where.map((w) => (w === 'kolam' ? 'Kolam' : 'Danau')).join(' & ');
    const when = `${String(f.hours[0]).padStart(2, '0')}–${f.hours[1]}`;
    const season = f.seasons ? f.seasons.join(', ') : 'Semua musim';
    const rain = f.rain === 'only' ? ' · hujan' : '';
    c.add(ui.add.text(cx + cw / 2, cy + 85, `${where} · ${when}`, txt(10, C.secondary, false)).setOrigin(0.5, 0));
    c.add(ui.add.text(cx + cw / 2, cy + 97, `${season}${rain}`, txt(10, C.tertiary, false)).setOrigin(0.5, 0));
  });
  ui.button(c, x + W / 2 - 60, y + H - 46, 'Tutup', () => ui.closeModal(), 120);
}
