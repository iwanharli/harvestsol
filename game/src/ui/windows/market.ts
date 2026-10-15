import { MARKET_ITEMS, produceById } from '../../data';
import { play } from '../../sfx';
import { add, canAdd, countBase, save } from '../../state';
import { C, card, txt, well } from '../theme';
import type { UIScene } from '../../scenes/UIScene';

/** Bu Ratu Atit's Warung Bahan: standard-quality cooking ingredients, any season. */
export function openMarket(ui: UIScene) {
  const s = ui.state;
  const COLS = 3, cw = 196, ch = 74, gap = 8;
  const rows = Math.ceil(MARKET_ITEMS.length / COLS);
  const W = 3 * cw + 2 * gap + 48, H = 104 + rows * (ch + gap) + 52;
  const { c, x, y } = ui.openModal(W, H, 'Warung Bahan Bu Ratu Atit', 'market');
  c.add(ui.add.text(x + W - 28, y + 24, `${s.coins.toLocaleString('id-ID')} G`, txt(16, C.orange)).setOrigin(1, 0));
  c.add(
    ui.add
      .text(x + W / 2, y + 54, 'Bahan kualitas standar ★1 · harga sudah termasuk "biaya keluarga"', txt(12, C.secondary, false))
      .setOrigin(0.5, 0),
  );

  MARKET_ITEMS.forEach((it, i) => {
    const cx = x + 24 + (i % COLS) * (cw + gap);
    const cy = y + 84 + Math.floor(i / COLS) * (ch + gap);
    const g = ui.add.graphics();
    card(g, cx, cy, cw, ch, 'normal', 14);
    well(g, cx + 30, cy + ch / 2, 22);
    c.add(g);
    c.add(ui.add.image(cx + 30, cy + ch / 2, `icon-${it.id}`).setScale(2));
    c.add(ui.add.text(cx + 60, cy + 9, produceById(it.id).name, txt(13)));
    c.add(ui.add.text(cx + 60, cy + 27, `${it.price} G · punya ${countBase(s, it.id)}`, txt(11, C.orange)));
    for (const [n, bx] of [[1, 60], [5, 106]] as const) {
      ui.button(c, cx + bx, cy + 42, `+${n}`, () => {
        const cost = it.price * n;
        if (s.coins < cost) {
          play('error');
          return ui.toast(`Uang tidak cukup (butuh ${cost} G).`);
        }
        if (!canAdd(s, 'produce', it.id, n)) {
          play('error');
          return ui.toast('Tas penuh!');
        }
        s.coins -= cost;
        add(s.produce, it.id, n);
        play('coin');
        save(s);
        ui.refresh();
        openMarket(ui);
      }, 40, s.coins < it.price * n);
    }
  });
  ui.button(c, x + W / 2 - 60, y + H - 46, 'Tutup', () => ui.closeModal(), 120);
}
