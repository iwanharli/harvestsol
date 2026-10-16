import { TIER_COLORS, TIER_EFFECTS, TOOLS, TOOL_TIERS, UPGRADABLE, needsPurchase } from '../../data';
import { play } from '../../sfx';
import { maxStamina, tierOf, waterMax } from '../../state';
import { C, HEX, card, txt } from '../theme';
import type { UIScene } from '../../scenes/UIScene';

const DIRS = ['down', 'side', 'up', 'side'] as const;
let turn = 0;

/** The farmer at a glance: the outfit being worn (turn it around) and every tool with its tier. */
export function openCharacter(ui: UIScene) {
  const s = ui.state;
  const W = 640, H = 450;
  const { c, x, y } = ui.openModal(W, H, 'Karakter', 'character');

  // left: the outfit on a stage, with arrows to turn the farmer around
  const lx = x + 24, ly = y + 58, lw = 200, lh = 300;
  const g = ui.add.graphics();
  card(g, lx, ly, lw, lh, 'normal', 16);
  g.fillStyle(0x000000, 0.08).fillEllipse(lx + lw / 2, ly + 170, 90, 18); // floor shadow
  c.add(g);
  c.add(ui.add.text(lx + lw / 2, ly + 14, 'KOSTUM', txt(11, C.tertiary)).setOrigin(0.5, 0));
  const d = DIRS[turn % 4];
  c.add(ui.add.image(lx + lw / 2, ly + 172, `player-${d}-0`).setOrigin(0.5, 1).setScale(7).setFlipX(turn % 4 === 3));
  const spin = (by: number) => () => {
    play('click');
    turn = (turn + by + 4) % 4;
    openCharacter(ui);
  };
  ui.button(c, lx + 14, ly + 150, '‹', spin(-1), 34, false, true);
  ui.button(c, lx + lw - 48, ly + 150, '›', spin(1), 34, false, true);
  c.add(ui.add.text(lx + lw / 2, ly + 196, 'Petani Desa', txt(15)).setOrigin(0.5, 0));
  c.add(ui.add.text(lx + lw / 2, ly + 218, 'Topi caping · kemeja biru', txt(11, C.secondary, false)).setOrigin(0.5, 0));
  c.add(ui.add.text(lx + lw / 2, ly + 250, `Level ${s.level}`, txt(13, C.purple)).setOrigin(0.5, 0));
  c.add(ui.add.text(lx + lw / 2, ly + 270, `Tenaga maks ${maxStamina(s)} · Air ${waterMax(s)}`, txt(11, C.secondary, false)).setOrigin(0.5, 0));

  // right: every tool, with its tier and what it does
  const rx = lx + lw + 16, rw = W - 24 - (rx - x), ROW = 48;
  c.add(ui.add.text(rx + 4, ly - 2, 'ALAT', txt(11, C.tertiary)));
  const tg = ui.add.graphics();
  c.add(tg);
  card(tg, rx, ly + 16, rw, TOOLS.length * ROW, 'normal', 14);
  TOOLS.forEach((t, i) => {
    const ry = ly + 16 + i * ROW;
    if (i) tg.fillStyle(HEX.hairline, 0.07).fillRect(rx + 56, ry, rw - 70, 1);
    const owned = !needsPurchase(t.id) || s.ownedTools.includes(t.id);
    const using = s.tool === t.id;
    if (using) tg.fillStyle(HEX.blue, 0.08).fillRoundedRect(rx + 4, ry + 4, rw - 8, ROW - 8, 10);
    const icon = ui.add.image(rx + 30, ry + ROW / 2, `tool-${t.id}`).setScale(2);
    if (!owned) icon.setTint(0x1d1d1f).setAlpha(0.25);
    c.add(icon);
    const name = ui.add.text(rx + 56, ry + 8, t.name, txt(13, owned ? C.ink : C.tertiary));
    c.add(name);
    let tagX = name.x + name.width + 12;
    const upgradable = UPGRADABLE.includes(t.id);
    if (owned && upgradable) {
      const tier = tierOf(s, t.id);
      const tag = ui.add.text(tagX + 6, ry + 10, TOOL_TIERS[tier], txt(10, tier ? C.ink : C.secondary));
      tg.fillStyle(tier ? TIER_COLORS[tier] : 0x767680, tier ? 0.55 : 0.12).fillRoundedRect(tagX, ry + 8, tag.width + 12, tag.height + 4, (tag.height + 4) / 2);
      c.add(tag);
      tagX += tag.width + 20;
    }
    if (using) c.add(ui.add.text(tagX, ry + 10, 'dipakai', txt(10, C.blue)));
    const detail = !owned
      ? 'Belum punya · beli di toko'
      : upgradable
        ? TIER_EFFECTS[t.id]?.[tierOf(s, t.id)] ?? ''
        : t.id === 'benih' ? 'Menanam benih & memasang sprinkler' : 'Panen, ambil barang, beri pakan';
    c.add(ui.add.text(rx + 56, ry + 27, detail, txt(11, C.secondary, false)));
    c.add(ui.add.text(rx + rw - 14, ry + ROW / 2, t.key, txt(11, C.tertiary)).setOrigin(1, 0.5));
  });
  c.add(ui.add.text(rx + 4, ly + 16 + TOOLS.length * ROW + 8, 'Upgrade alat di Bengkel Pandai Besi', txt(11, C.tertiary, false)));
  ui.button(c, x + W / 2 - 60, y + H - 48, 'Tutup', () => ui.closeModal(), 120);
}
