import { FISH, LAKES, type Water } from '../../data';
import { play } from '../../sfx';
import { C, HEX, bar as drawBar, card, segmented, txt, well } from '../theme';

import type { UIScene } from '../../scenes/UIScene';

const INK = C.ink;
const LAKE_IDS = Object.keys(LAKES) as Water[];
const SHORT: Record<Water, string> = { kolam: 'Kolam', danau: 'Danau', rawa: 'Rawa', telaga: 'Telaga', waduk: 'Waduk', muara: 'Muara' };

let lake: Water = 'kolam';

/** Every fish, one tab per lake, with when it bites; uncaught ones are silhouettes with hints. */
export function openFishBook(ui: UIScene) {
  const s = ui.state;
  const COLS = 4, ROWS = 2, cw = 130, ch = 112, gap = 8;
  const W = 600, H = 128 + ROWS * (ch + gap) + 50;
  const caught = FISH.filter((f) => s.fishCaught[f.id]).length;
  const { c, x, y } = ui.openModal(W, H, 'Buku Ikan', 'fishbook');
  c.add(ui.add.text(x + W - 28, y + 20, `${caught}/${FISH.length} ditemukan`, txt(13, C.secondary)).setOrigin(1, 0));
  const pb = ui.add.graphics();
  drawBar(pb, x + W - 128, y + 40, 100, caught / FISH.length, HEX.blue);
  c.add(pb);

  // one tab per lake, with how many of its fish you have caught
  const segW = (W - 48) / LAKE_IDS.length;
  c.add(
    segmented(ui, x + 24, y + 56, LAKE_IDS.map((id) => SHORT[id]), LAKE_IDS.indexOf(lake), (i) => {
      play('click');
      lake = LAKE_IDS[i];
      openFishBook(ui);
    }, segW - 1),
  );
  const fish = FISH.filter((f) => f.where.includes(lake));
  const got = fish.filter((f) => s.fishCaught[f.id]).length;
  c.add(ui.add.text(x + 24, y + 98, `${LAKES[lake].name} · ${got}/${fish.length}`, txt(13)));
  c.add(ui.add.text(x + 24, y + 116, LAKES[lake].desc, txt(11, C.secondary, false)));

  const gx = x + (W - (COLS * cw + (COLS - 1) * gap)) / 2;
  fish.forEach((f, i) => {
    const cx = gx + (i % COLS) * (cw + gap);
    const cy = y + 140 + Math.floor(i / COLS) * (ch + gap);
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
    // hints: when, which season/weather, and the other lakes it lives in
    const when = `${String(f.hours[0]).padStart(2, '0')}–${f.hours[1]}`;
    const season = f.seasons ? f.seasons.join(', ') : 'Semua musim';
    const rain = f.rain === 'only' ? ' · hujan' : '';
    const also = f.where.filter((w) => w !== lake).map((w) => SHORT[w]);
    c.add(ui.add.text(cx + cw / 2, cy + 85, `${when}${also.length ? ` · juga ${also.join(', ')}` : ''}`, txt(10, C.secondary, false)).setOrigin(0.5, 0));
    c.add(ui.add.text(cx + cw / 2, cy + 97, `${season}${rain}`, txt(10, C.tertiary, false)).setOrigin(0.5, 0));
  });
  ui.button(c, x + W / 2 - 60, y + H - 46, 'Tutup', () => ui.closeModal(), 120);
}
