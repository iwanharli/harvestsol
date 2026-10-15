import { FURNITURE, HOUSE_TIERS } from '../../data';
import { play } from '../../sfx';
import { buyFurniture, save, upgradeHouse } from '../../state';
import { C, card, segmented, txt, well } from '../theme';
import type { UIScene } from '../../scenes/UIScene';

const ICON: Record<string, string> = { jam: 'in-clock', radio: 'in-radio', piala: 'in-trophy', kulkas: 'in-fridge', kasur: 'in-bigbed', peti: 'in-chest' };

let tab: 'perabot' | 'renovasi' = 'perabot';

/** Toko Mebel catalogue. `focus` highlights the piece the player looked at on its stand. */
export function openMebel(ui: UIScene, focus?: string) {
  if (focus) tab = 'perabot';
  const s = ui.state;
  // furniture: a 2-column grid of cards; the renovation tab fits in the same window
  const COLS = 2, CH = 108, gap = 10;
  const rows = Math.ceil(FURNITURE.length / COLS);
  const W = 620, H = 104 + rows * (CH + gap) + 56;
  const { c, x, y } = ui.openModal(W, H, 'Toko Mebel');
  c.add(ui.add.text(x + W - 28, y + 24, `${s.coins.toLocaleString('id-ID')} G`, txt(16, C.orange)).setOrigin(1, 0));
  const tabs = ['perabot', 'renovasi'] as const;
  c.add(
    segmented(ui, x + 24, y + 56, ['Perabot', 'Renovasi Rumah'], tabs.indexOf(tab), (i) => {
      play('click');
      tab = tabs[i];
      openMebel(ui);
    }, 140),
  );
  const top = y + 102;

  const buyButton = (bx: number, by: number, label: string, price: number, disabled: boolean, onBuy: () => string | null, done: string) => {
    c.add(ui.add.text(bx - 8, by + 17, `${price.toLocaleString('id-ID')} G`, txt(14, C.orange)).setOrigin(1, 0.5));
    ui.button(c, bx, by, label, () => {
      const err = onBuy();
      if (err) {
        play('error');
        return ui.toast(err);
      }
      play('quest');
      save(s);
      ui.refresh();
      ui.toast(done);
      openMebel(ui);
    }, 96, disabled);
  };

  if (tab === 'perabot') {
    const cw = (W - 48 - gap) / COLS;
    FURNITURE.forEach((f, i) => {
      const cx = x + 24 + (i % COLS) * (cw + gap), cy = top + Math.floor(i / COLS) * (CH + gap);
      const owned = !!s.furniture[f.id];
      const locked = s.level < f.level;
      const g = ui.add.graphics();
      card(g, cx, cy, cw, CH, f.id === focus ? 'selected' : owned ? 'ready' : locked ? 'locked' : 'normal', 16);
      well(g, cx + 38, cy + 40, 26, locked);
      c.add(g);
      const icon = ui.add.image(cx + 38, cy + 40, ICON[f.id]);
      icon.setScale(Math.min(2, 34 / Math.max(icon.width, icon.height)));
      if (locked) icon.setTint(0x9a9aa0).setAlpha(0.5);
      c.add(icon);
      c.add(ui.add.text(cx + 76, cy + 14, f.name, txt(15, locked ? C.disabled : C.ink)));
      c.add(ui.add.text(cx + 76, cy + 35, f.desc, { ...txt(11, C.secondary, false), lineSpacing: 2, wordWrap: { width: cw - 76 - 14, useAdvancedWrap: true } }));
      // bottom row: status or price + buy
      const by = cy + CH - 44, bx = cx + cw - 110;
      const status = (label: string, color: string) => c.add(ui.add.text(cx + cw - 16, by + 17, label, txt(12, color)).setOrigin(1, 0.5));
      if (owned) status('✓ Sudah dipasang', C.green);
      else if (locked) status(`Terbuka di Level ${f.level}`, C.secondary);
      else
        buyButton(bx, by, 'Beli', f.price, s.coins < f.price, () => {
          const err = buyFurniture(s, f.id, f.price, f.level);
          if (!err) ui.game.events.emit('furniture-changed');
          return err;
        }, `${f.name} sudah dipasang di rumahmu!`);
    });
  } else {
    const TROW = 104;
    const row = (i: number, h: number) => ({ cx: x + 24, cy: top + i * (h + 6), cw: W - 48 });
    HOUSE_TIERS.forEach((t, i) => {
      const { cx, cy, cw } = row(i, TROW);
      const current = s.houseTier === i;
      const done = s.houseTier > i;
      const next = s.houseTier + 1 === i;
      const locked = next && s.level < t.level;
      const g = ui.add.graphics();
      card(g, cx, cy, cw, TROW, current ? 'selected' : done ? 'ready' : next && !locked ? 'normal' : 'locked', 16);
      well(g, cx + 40, cy + TROW / 2, 28, !current && !done && !next);
      c.add(g);
      // a little house icon scaled by tier
      const icon = ui.add.image(cx + 40, cy + TROW / 2 + 4, 'house').setScale(0.5 + i * 0.12);
      if (!current && !done && !next) icon.setTint(0x9a9aa0).setAlpha(0.5);
      c.add(icon);
      c.add(ui.add.text(cx + 80, cy + 12, t.name, txt(15, current || done || next ? C.ink : C.disabled)));
      c.add(ui.add.text(cx + 80, cy + 33, `${t.w}×${t.h} petak`, txt(11, C.tertiary)));
      c.add(ui.add.text(cx + 80, cy + 50, t.perk, { ...txt(11, C.secondary, false), wordWrap: { width: cw - 80 - 230, useAdvancedWrap: true } }));
      const bx = cx + cw - 112;
      if (current) c.add(ui.add.text(bx + 48, cy + TROW / 2, 'Rumahmu sekarang', txt(12, C.blue)).setOrigin(0.5));
      else if (done) c.add(ui.add.text(bx + 48, cy + TROW / 2, 'Sudah', txt(12, C.green)).setOrigin(0.5));
      else if (!next) c.add(ui.add.text(bx + 48, cy + TROW / 2, 'Renovasi dulu\nyang sebelumnya', { ...txt(11, C.tertiary, false), align: 'center' }).setOrigin(0.5));
      else if (locked) c.add(ui.add.text(bx + 48, cy + TROW / 2, `Level ${t.level}`, txt(12, C.secondary)).setOrigin(0.5));
      else
        buyButton(bx, cy + TROW / 2 - 17, 'Renovasi', t.price, s.coins < t.price, () => {
          const err = upgradeHouse(s);
          if (!err) ui.game.events.emit('house-upgraded');
          return err;
        }, `${t.name} selesai! Masuk rumah untuk melihatnya.`);
    });
  }
  ui.button(c, x + W / 2 - 60, y + H - 46, 'Tutup', () => ui.closeModal(), 120);
}
