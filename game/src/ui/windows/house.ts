import { DISHES, XP_COOK, produceById } from '../../data';
import { play } from '../../sfx';
import { C, card, txt, well } from '../theme';
import { cook, countIngredient, fiveStarsUsed, gainXp, save, maxStamina } from '../../state';

import { askConfirm } from './report';
import type { UIScene } from '../../scenes/UIScene';


export function openKitchen(ui: UIScene) {
  const s = ui.state;
  const W = 700, H = 490;
  const { c, x, y } = ui.openModal(W, H, 'Dapur');
  c.add(ui.add.text(x + W - 28, y + 24, `Tenaga ${s.stamina}/${maxStamina(s)}`, txt(14, C.secondary)).setOrigin(1, 0));
  const cw = 212, ch = 118, gap = 10;
  DISHES.forEach((d, i) => {
    const cx = x + 20 + (i % 3) * (cw + gap);
    const cy = y + 58 + Math.floor(i / 3) * (ch + 8);
    const ready = Object.entries(d.ingredients).every(([id, n]) => countIngredient(s, id) >= n);
    const g = ui.add.graphics();
    card(g, cx, cy, cw, ch, ready ? 'ready' : 'normal', 16);
    well(g, cx + 32, cy + 38, 24);
    c.add(g);
    c.add(ui.add.image(cx + 32, cy + 38, `icon-${d.id}`).setScale(2.5));
    c.add(ui.add.text(cx + 62, cy + 8, d.name, txt(14)));
    Object.entries(d.ingredients).forEach(([id, n], j) => {
      const have = countIngredient(s, id);
      c.add(
        ui.add.text(cx + 62, cy + 28 + j * 15, `${produceById(id).name} ${Math.min(have, n)}/${n}`, txt(12, have >= n ? C.green : C.red, false)),
      );
    });
    c.add(ui.add.text(cx + 12, cy + ch - 26, `${d.sellPrice} G · +${d.stamina}⚡`, txt(12, C.orange)));
    const doCook = () => {
      const err = cook(s, d.id);
      if (err) {
        play('error');
        return ui.toast(err);
      }
      play('harvest');
      const reached = gainXp(s, XP_COOK);
      save(s);
      ui.toast(`${d.name} jadi! +${XP_COOK} XP`);
      openKitchen(ui);
      if (reached.length) ui.queueLevelUp(reached);
    };
    ui.button(c, cx + cw - 96, cy + ch - 42, 'Masak', () => {
      const best = fiveStarsUsed(s, d.id);
      if (!best.length) return doCook();
      ui.closeModal();
      askConfirm(ui, {
        title: 'Pakai bahan bintang 5?',
        body: `${best.join(', ')} bintang 5 akan ikut dimasak jadi ${d.name}.\nBahan terbaik bisa juga dijual mahal atau dibawa ke festival.`,
        ok: 'Tetap masak',
        onOk: doCook,
        onCancel: () => openKitchen(ui),
      });
    }, 84, !ready);
  });
  ui.button(c, x + W / 2 - 60, y + H - 46, 'Tutup', () => ui.closeModal(), 120);
}
