import { C, card, txt } from '../theme';
import type { UIScene } from '../../scenes/UIScene';

export type CaveAsk = { floors: number[]; deepest: number; last?: number; onPick: (floor: number) => void };

/** The kerekan at the cave mouth, a basket on a rope and pulley: back to your deepest floor, or the start of any zone you have reached. */
export function askCaveFloor(ui: UIScene, q: CaveAsk) {
  const COLS = 4, bw = 92, gap = 10;
  const rows = Math.ceil(q.floors.length / COLS);
  const W = 460, H = 150 + rows * (34 + gap) + 40;
  const { c, x, y } = ui.openModal(W, H, 'Kerekan Gua Tambang');
  const g = ui.add.graphics();
  card(g, x + 24, y + 56, W - 48, 40, 'normal', 12);
  c.add(g);
  c.add(ui.add.text(x + W / 2, y + 76, `Lanjut ke lantai terakhir (batu yang sudah digali tetap hilang) atau mulai baru`, txt(12, C.secondary, false)).setOrigin(0.5));
  const gx = x + (W - (COLS * bw + (COLS - 1) * gap)) / 2;
  q.floors.forEach((f, i) => {
    const bx = gx + (i % COLS) * (bw + gap), by = y + 112 + Math.floor(i / COLS) * (34 + gap);
    const resume = f === q.last;
    ui.button(c, bx, by, resume ? `Lanjut ${f}` : `Lantai ${f}`, () => {
      ui.closeModal();
      q.onPick(f);
    }, bw, false, !resume);
  });
  ui.button(c, x + W / 2 - 60, y + H - 52, 'Batal', () => ui.closeModal(), 120);
}
