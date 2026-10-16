import { SPARE_TOOL_PRICE, TIER_COLORS, TIER_EFFECTS, TOOLS, TOOL_TIERS, UPGRADABLE, UPGRADE_COST, needsPurchase, produceById } from '../../data';
import { play } from '../../sfx';
import { buySpareTool, collectUpgrade, countBase, dayOfSeason, save, seasonOf, startUpgrade, tierOf } from '../../state';
import { C, card, txt, well } from '../theme';
import type { UIScene } from '../../scenes/UIScene';

const INK = C.ink;

/** Bengkel Pandai Besi: raise a tool one tier at a time with coins and ore; it stays at the forge for a day or two. */
export function openBengkel(ui: UIScene) {
  const s = ui.state;
  const W = 640, H = 494;
  const { c, x, y } = ui.openModal(W, H, 'Bengkel Pandai Besi');
  c.add(ui.add.text(x + W - 28, y + 24, `${s.coins.toLocaleString('id-ID')} G`, txt(16, C.orange)).setOrigin(1, 0));
  const redraw = () => openBengkel(ui);
  const done = (err: string | null, ok: string) => {
    if (err) {
      play('error');
      return ui.toast(err);
    }
    play('quest');
    save(s);
    ui.refresh();
    ui.toast(ok);
    redraw();
  };

  // what is on the anvil right now
  const sg = ui.add.graphics();
  card(sg, x + 24, y + 56, W - 48, 44, s.forge && s.day >= s.forge.ready ? 'ready' : 'normal', 14);
  c.add(sg);
  if (!s.forge) {
    c.add(ui.add.text(x + 40, y + 78, 'Tungku kosong. Pilih satu alat untuk ditempa, tingkatnya naik satu per satu.', txt(12, C.secondary, false)).setOrigin(0, 0.5));
  } else {
    const name = TOOLS.find((t) => t.id === s.forge!.tool)!.name;
    const ready = s.day >= s.forge.ready;
    c.add(
      ui.add
        .text(x + 40, y + 78, ready ? `${name} ${TOOL_TIERS[s.forge.tier]} sudah jadi!` : `Sedang ditempa: ${name} → ${TOOL_TIERS[s.forge.tier]} · siap hari ${dayOfSeason(s.forge.ready)} ${seasonOf(s.forge.ready)}`, txt(13, ready ? C.green : INK))
        .setOrigin(0, 0.5),
    );
    const tierName = TOOL_TIERS[s.forge.tier]; // read before collecting clears the forge
    if (ready) ui.button(c, x + W - 144, y + 61, 'Ambil', () => done(collectUpgrade(s), `${name} ${tierName} siap dipakai!`), 104);
  }

  // one card per tool: now, next tier, cost
  const cw = (W - 48 - 10) / 2, ch = 160;
  UPGRADABLE.forEach((id, i) => {
    const t = TOOLS.find((tt) => tt.id === id)!;
    const cx = x + 24 + (i % 2) * (cw + 10), cy = y + 112 + Math.floor(i / 2) * (ch + 10);
    const tier = tierOf(s, id);
    const next = tier + 1;
    const cost = UPGRADE_COST[next];
    const owned = !needsPurchase(id) || s.ownedTools.includes(id);
    const busy = s.forge?.tool === id;
    const g = ui.add.graphics();
    card(g, cx, cy, cw, ch, busy ? 'muted' : 'normal', 16);
    well(g, cx + 34, cy + 34, 22, !owned);
    c.add(g);
    const icon = ui.add.image(cx + 34, cy + 34, `tool-${id}`).setScale(2.2);
    if (!owned) icon.setAlpha(0.4);
    c.add(icon);
    c.add(ui.add.text(cx + 66, cy + 14, t.name, txt(15)));
    // tier chip in the tier's colour
    const chip = ui.add.text(cx + 66, cy + 36, TOOL_TIERS[tier], txt(10, tier ? INK : C.secondary));
    g.fillStyle(tier ? TIER_COLORS[tier] : 0x767680, tier ? 0.5 : 0.14).fillRoundedRect(chip.x - 6, chip.y - 2, chip.width + 12, chip.height + 4, (chip.height + 4) / 2);
    c.add(chip);
    // the steps so far as pips, next to the tier chip
    for (let p = 1; p <= 3; p++) g.fillStyle(p <= tier ? TIER_COLORS[p] : 0xd8d8de, 1).fillCircle(chip.x + chip.width + 4 + p * 12, cy + 43, 4);
    // a brand-new spare copy (Biasa), kept in Tas › Perlengkapan
    const price = SPARE_TOOL_PRICE[id];
    const spares = (s.spareTools ?? []).filter((sp) => sp.tool === id).length;
    if (price && owned) {
      ui.button(c, cx + cw - 124, cy + 10, `+ Cadangan ${price} G`, () => done(buySpareTool(s, id), `${t.name} cadangan jadi! Ada di Tas › Perlengkapan (${spares + 1}).`), 112, s.coins < price, true);
      if (spares) c.add(ui.add.text(cx + cw - 68, cy + 48, `cadangan: ${spares}`, txt(10, C.tertiary)).setOrigin(0.5, 0));
    }

    const fx = TIER_EFFECTS[id]!;
    c.add(ui.add.text(cx + 14, cy + 66, `Sekarang: ${fx[tier]}`, { ...txt(11, C.secondary, false), wordWrap: { width: cw - 28 } }));
    if (!cost) {
      c.add(ui.add.text(cx + 14, cy + 88, 'Tingkat tertinggi. Mantap!', txt(12, C.green)));
      return;
    }
    c.add(ui.add.text(cx + 14, cy + 84, `${TOOL_TIERS[next]}: ${fx[next]}`, { ...txt(11, INK, false), wordWrap: { width: cw - 28 } }));
    const have = countBase(s, cost.ore);
    const costText = ui.add.text(cx + 14, cy + ch - 28, `${cost.coins.toLocaleString('id-ID')} G`, txt(12, s.coins >= cost.coins ? C.orange : C.red)).setOrigin(0, 0.5);
    c.add(costText);
    c.add(ui.add.image(costText.x + costText.width + 16, cy + ch - 28, `icon-${cost.ore}`).setScale(1.2));
    c.add(ui.add.text(costText.x + costText.width + 28, cy + ch - 28, `${Math.min(have, cost.qty)}/${cost.qty}`, txt(12, have >= cost.qty ? C.green : C.red)).setOrigin(0, 0.5));
    const bx = cx + cw - 118, by = cy + ch - 45;
    const reason = !owned ? 'Beli dulu' : busy ? 'Di tungku' : s.forge ? 'Tungku penuh' : s.level < cost.level ? `Lv ${cost.level}` : '';
    if (reason) {
      c.add(ui.add.text(bx + 52, by + 17, reason, txt(12, C.secondary)).setOrigin(0.5));
      return;
    }
    const can = s.coins >= cost.coins && have >= cost.qty;
    ui.button(c, bx, by, `Tempa · ${cost.days} hari`, () => {
      const err = startUpgrade(s, id);
      done(err, `${t.name} ditinggal di bengkel. Ambil ${cost.days} hari lagi (${produceById(cost.ore).name} −${cost.qty}).`);
    }, 104, !can);
  });
  ui.button(c, x + W / 2 - 60, y + H - 48, 'Tutup', () => ui.closeModal(), 120);
}
