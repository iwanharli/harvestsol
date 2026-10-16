import { FISH, LAKES, type Water } from '../../data';
import { play } from '../../sfx';
import { C, HEX, bar as drawBar, card, segmented, txt } from '../theme';

import type { UIScene } from '../../scenes/UIScene';

const INK = C.ink;
const LAKE_IDS = Object.keys(LAKES) as Water[];
const SHORT: Record<Water, string> = { kolam: 'Kolam', danau: 'Danau', rawa: 'Rawa', telaga: 'Telaga', waduk: 'Waduk', muara: 'Muara' };

let lake: Water = 'kolam';

/** Rarity from how often a fish bites, shown as a coloured tag. */
function rarity(weight: number) {
  if (weight >= 20) return { label: 'Umum', fill: 0x767680, color: C.secondary };
  if (weight >= 10) return { label: 'Jarang', fill: HEX.blue, color: C.blue };
  if (weight >= 5) return { label: 'Langka', fill: 0xaf52de, color: C.purple };
  return { label: 'Legenda', fill: 0xffd60a, color: '#a86f00' };
}

/** Every fish, one tab per lake, two columns of cards; uncaught ones are silhouettes with hints. */
export function openFishBook(ui: UIScene) {
  const s = ui.state;
  const fish = FISH.filter((f) => f.where.includes(lake));
  const most = Math.max(...LAKE_IDS.map((id) => FISH.filter((f) => f.where.includes(id)).length));
  const COLS = 2, cw = 286, ch = 64, gap = 8;
  const rows = Math.ceil(most / COLS); // fixed height so the window does not jump between tabs
  const W = 24 * 2 + COLS * cw + gap, H = 150 + rows * (ch + gap) + 54;
  const caught = FISH.filter((f) => s.fishCaught[f.id]).length;
  const { c, x, y } = ui.openModal(W, H, 'Buku Ikan', 'fishbook');
  c.add(ui.add.text(x + W - 28, y + 18, `${caught}/${FISH.length} ditemukan`, txt(12, C.secondary)).setOrigin(1, 0));
  const pb = ui.add.graphics();
  drawBar(pb, x + W - 128, y + 38, 100, caught / FISH.length, HEX.blue);
  c.add(pb);

  // one tab per lake
  const segW = (W - 48) / LAKE_IDS.length;
  c.add(
    segmented(ui, x + 24, y + 56, LAKE_IDS.map((id) => SHORT[id]), LAKE_IDS.indexOf(lake), (i) => {
      play('click');
      lake = LAKE_IDS[i];
      openFishBook(ui);
    }, segW - 1),
  );

  // lake header: name, description, progress for this lake
  const got = fish.filter((f) => s.fishCaught[f.id]).length;
  const hg = ui.add.graphics();
  card(hg, x + 24, y + 92, W - 48, 48, 'muted', 14);
  c.add(hg);
  c.add(ui.add.text(x + 40, y + 98, LAKES[lake].name, txt(15)));
  c.add(ui.add.text(x + 40, y + 119, LAKES[lake].desc, txt(11, C.secondary, false)));
  c.add(ui.add.text(x + W - 40, y + 98, `${got}/${fish.length}`, txt(15, got === fish.length ? C.green : C.blue)).setOrigin(1, 0));
  drawBar(hg, x + W - 120, y + 124, 80, got / fish.length, got === fish.length ? HEX.green : HEX.blue);

  fish.forEach((f, i) => {
    const cx = x + 24 + (i % COLS) * (cw + gap);
    const cy = y + 150 + Math.floor(i / COLS) * (ch + gap);
    const best = s.fishCaught[f.id] ?? 0;
    const g = ui.add.graphics();
    card(g, cx, cy, cw, ch, best ? 'normal' : 'muted', 14);
    // icon on a disc tinted with the fish's own colour
    const tint = Number.parseInt(f.colors[1].slice(1), 16);
    g.fillStyle(best ? tint : HEX.well, best ? 0.35 : 0.8).fillCircle(cx + 36, cy + ch / 2, 24);
    c.add(g);
    const icon = ui.add.image(cx + 36, cy + ch / 2, `icon-${f.id}`).setScale(2.1);
    if (!best) icon.setTint(0x1d1d1f).setAlpha(0.22); // silhouette until caught
    c.add(icon);

    // line 1: name, rarity tag, price
    const tx = cx + 70;
    const name = ui.add.text(tx, cy + 7, best ? f.name : '???', txt(14, best ? INK : C.tertiary));
    c.add(name);
    const r = rarity(f.weight);
    const tag = ui.add.text(name.x + name.width + 14, cy + 10, r.label, txt(10, r.color));
    g.fillStyle(r.fill, 0.16).fillRoundedRect(tag.x - 6, tag.y - 2, tag.width + 12, tag.height + 4, (tag.height + 4) / 2);
    c.add(tag);
    c.add(ui.add.text(cx + cw - 12, cy + 8, `${f.sellPrice} G`, txt(13, C.orange)).setOrigin(1, 0));

    // line 2: best quality caught
    c.add(
      ui.add.text(tx, cy + 26, best ? '★'.repeat(best) + '☆'.repeat(5 - best) : 'Belum tertangkap', txt(11, best ? '#d4a017' : C.disabled, !!best)),
    );

    // line 3: when it bites, as small pills
    const pills = [
      `${String(f.hours[0]).padStart(2, '0')}–${String(f.hours[1]).padStart(2, '0')}`,
      f.seasons ? f.seasons.join(' & ') : 'Semua musim',
      ...(f.rain === 'only' ? ['Hujan saja'] : f.rain === 'bonus' ? ['Hujan ↑'] : []),
    ];
    let px = tx;
    for (const p of pills) {
      const t = ui.add.text(px + 7, cy + 50, p, txt(10, C.secondary, false)).setOrigin(0, 0.5);
      g.fillStyle(0x767680, 0.1).fillRoundedRect(px, cy + 42, t.width + 14, 16, 8);
      c.add(t);
      px += t.width + 18;
    }
    // other lakes, small and to the right of the stars
    const also = f.where.filter((w) => w !== lake).map((w) => SHORT[w]);
    if (also.length) c.add(ui.add.text(cx + cw - 12, cy + 27, `juga di ${also.join(', ')}`, txt(10, C.tertiary, false)).setOrigin(1, 0));
  });
  ui.button(c, x + W / 2 - 60, y + H - 46, 'Tutup', () => ui.closeModal(), 120);
}
