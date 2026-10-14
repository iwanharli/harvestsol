import { FURNITURE } from '../../data';
import { play } from '../../sfx';
import { buyFurniture, save } from '../../state';
import { C, card, txt, well } from '../theme';
import type { UIScene } from '../../scenes/UIScene';

const ICON: Record<string, string> = { jam: 'in-clock', radio: 'in-radio', piala: 'in-trophy', kulkas: 'in-fridge', kasur: 'in-bigbed' };

/** Toko Mebel catalogue. `focus` highlights the piece the player looked at on its stand. */
export function openMebel(ui: UIScene, focus?: string) {
  const s = ui.state;
  const ROW = 70, gap = 6;
  const W = 560, H = 70 + FURNITURE.length * (ROW + gap) + 54;
  const { c, x, y } = ui.openModal(W, H, 'Toko Mebel');
  c.add(ui.add.text(x + W - 28, y + 24, `${s.coins.toLocaleString('id-ID')} G`, txt(16, C.orange)).setOrigin(1, 0));

  FURNITURE.forEach((f, i) => {
    const cx = x + 24, cy = y + 64 + i * (ROW + gap), cw = W - 48;
    const owned = !!s.furniture[f.id];
    const locked = s.level < f.level;
    const g = ui.add.graphics();
    card(g, cx, cy, cw, ROW, f.id === focus ? 'selected' : owned ? 'ready' : locked ? 'locked' : 'normal', 16);
    well(g, cx + 40, cy + ROW / 2, 28, locked);
    c.add(g);
    const icon = ui.add.image(cx + 40, cy + ROW / 2, ICON[f.id]);
    icon.setScale(Math.min(2, 44 / icon.height, 44 / icon.width) >= 1 ? Math.floor(Math.min(2, 44 / icon.height, 44 / icon.width)) : 1);
    if (locked) icon.setTint(0x9a9aa0).setAlpha(0.5);
    c.add(icon);
    c.add(ui.add.text(cx + 80, cy + 12, f.name, txt(15, locked ? C.disabled : C.ink)));
    c.add(ui.add.text(cx + 80, cy + 33, f.desc, { ...txt(11, C.secondary, false), wordWrap: { width: cw - 80 - 130, useAdvancedWrap: true } }));

    const bx = cx + cw - 118;
    if (owned) {
      c.add(ui.add.text(bx + 55, cy + ROW / 2, 'Sudah dipasang', txt(12, C.green)).setOrigin(0.5));
    } else if (locked) {
      c.add(ui.add.text(bx + 55, cy + ROW / 2, `Level ${f.level}`, txt(12, C.secondary)).setOrigin(0.5));
    } else {
      c.add(ui.add.text(bx + 55, cy + 8, `${f.price.toLocaleString('id-ID')} G`, txt(13, C.orange)).setOrigin(0.5, 0));
      ui.button(c, bx + 6, cy + ROW - 39, 'Beli', () => {
        const err = buyFurniture(s, f.id, f.price, f.level);
        if (err) {
          play('error');
          return ui.toast(err);
        }
        play('quest');
        save(s);
        ui.game.events.emit('furniture-changed');
        ui.refresh();
        ui.toast(`${f.name} sudah dipasang di rumahmu!`);
        openMebel(ui, f.id);
      }, 98, s.coins < f.price);
    }
  });
  ui.button(c, x + W / 2 - 60, y + H - 48, 'Tutup', () => ui.closeModal(), 120);
}
