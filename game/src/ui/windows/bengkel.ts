import Phaser from 'phaser';
import { TIER_COLORS, TIER_EFFECTS, TOOLS, TOOL_TIERS, UPGRADABLE, UPGRADE_COST, needsPurchase, produceById } from '../../data';
import { play } from '../../sfx';
import { collectUpgrade, countBase, dateLabel, isWorn, save, startUpgrade, tierOf } from '../../state';
import { C, card, txt, well } from '../theme';
import type { UIScene } from '../../scenes/UIScene';

const INK = C.ink;
const HEX_ORANGE = 0xf07a2a;

/** Bengkel Pandai Besi: raise a tool one tier at a time with coins and ore; it stays at the forge for a day or two. */
export function openBengkel(ui: UIScene) {
  const s = ui.state;
  const W = 640, H = 512;
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

  // what is on the anvil right now: a little animated forge while a tool is in the works
  const SH = 70; // status card height
  const sg = ui.add.graphics();
  card(sg, x + 24, y + 56, W - 48, SH, s.forge && s.day >= s.forge.ready ? 'ready' : 'normal', 14);
  c.add(sg);
  const mid = y + 56 + SH / 2;
  if (!s.forge) {
    c.add(ui.add.image(x + 64, mid + 6, 'anvil').setScale(3).setAlpha(0.45));
    c.add(ui.add.text(x + 104, mid, 'Tungku kosong. Pilih satu alat untuk ditempa, tingkatnya naik satu per satu.', txt(12, C.secondary, false)).setOrigin(0, 0.5));
  } else {
    const f = s.forge;
    const name = TOOLS.find((t) => t.id === f.tool)!.name;
    const ready = s.day >= f.ready;
    const anims: Phaser.Tweens.Tween[] = [];
    c.once('destroy', () => anims.forEach((t) => t.remove()));

    // the stage: fire, anvil, the tool on it
    const ax = x + 100;
    const fire = ui.add.image(x + 50, mid + 22, 'forge-fire').setScale(2.4).setOrigin(0.5, 1);
    const glow = ui.add.image(x + 50, mid + 8, 'glow').setScale(0.55).setBlendMode(Phaser.BlendModes.ADD).setAlpha(ready ? 0.15 : 0.5);
    const anvil = ui.add.image(ax, mid + 30, 'anvil').setScale(2.6).setOrigin(0.5, 1);
    const tool = ui.add.image(ax - 2, mid - 6, `tool-${f.tool}`).setScale(2).setAngle(-15);
    c.add([glow, fire, anvil, tool]);
    if (ready) {
      // done: cooled down, bobbing gently
      fire.setAlpha(0.4);
      anims.push(ui.tweens.add({ targets: tool, y: tool.y - 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' }));
    } else {
      fire.setAlpha(1);
      tool.setTint(0xffa060); // red-hot metal
      anims.push(ui.tweens.add({ targets: fire, scaleY: 2.8, scaleX: 2.2, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.InOut' }));
      anims.push(ui.tweens.add({ targets: [glow], alpha: 0.75, duration: 420, yoyo: true, repeat: -1 }));
      anims.push(ui.tweens.add({ targets: tool, alpha: 0.75, duration: 500, yoyo: true, repeat: -1 }));
      // the hammer swings down onto the tool; every hit throws sparks
      const hammer = ui.add.image(ax + 30, mid - 8, 'smith-hammer').setScale(2.6).setOrigin(1, 0.5).setFlipX(true).setAngle(35);
      c.add(hammer);
      const sparks = () => {
        for (let i = 0; i < 6; i++) {
          const sp = ui.add.rectangle(ax - 4, mid - 8, 3, 3, Phaser.Math.RND.pick([0xfff3a8, 0xf8c84a, 0xf07a2a]));
          c.add(sp);
          const ang = Phaser.Math.FloatBetween(-Math.PI * 0.95, -Math.PI * 0.05);
          const dist = Phaser.Math.Between(14, 30);
          anims.push(ui.tweens.add({
            targets: sp, x: sp.x + Math.cos(ang) * dist, y: sp.y + Math.sin(ang) * dist + 6, alpha: 0, duration: 380,
            ease: 'Quad.Out', onComplete: () => sp.destroy(),
          }));
        }
      };
      anims.push(ui.tweens.add({
        targets: hammer, angle: -14, duration: 180, ease: 'Quad.In', yoyo: true, hold: 60, repeatDelay: 380, repeat: -1,
        onYoyo: () => {
          sparks();
          anims.push(ui.tweens.add({ targets: tool, y: tool.y + 1, duration: 50, yoyo: true }));
        },
      }));
    }

    // text and a progress bar of the days at the forge
    const tx = x + 144;
    c.add(ui.add.text(tx, mid - 22, ready ? `${name} ${TOOL_TIERS[f.tier]} sudah jadi!` : `Sedang ditempa: ${name} → ${TOOL_TIERS[f.tier]}`, txt(14, ready ? C.green : INK)));
    if (ready) c.add(ui.add.text(tx, mid + 2, 'Ambil untuk memasangnya (atau masuk Perlengkapan kalau slotnya terisi).', txt(11, C.secondary, false)));
    else {
      const days = UPGRADE_COST[f.tier]?.days ?? 1;
      const done0 = Math.max(0, Math.min(days, days - (f.ready - s.day)));
      c.add(ui.add.text(tx, mid + 1, `Siap ${dateLabel(f.ready, s.day)}`, txt(11, C.secondary, false)));
      const bw = W - 24 - (tx - x) - 80, by = mid + 20;
      sg.fillStyle(0x767680, 0.15).fillRoundedRect(tx, by, bw, 6, 3);
      sg.fillStyle(TIER_COLORS[f.tier] || HEX_ORANGE, 1).fillRoundedRect(tx, by, Math.max(6, (bw * done0) / days), 6, 3);
      c.add(ui.add.text(tx + bw + 8, by + 3, `${done0}/${days} hari`, txt(10, C.tertiary)).setOrigin(0, 0.5));
    }
    const tierName = TOOL_TIERS[f.tier]; // read before collecting clears the forge
    // a spare in the slot keeps its place: the upgraded one goes to the box
    const spareWorn = isWorn(s, `tool:${f.tool}`);
    if (ready)
      ui.button(c, x + W - 144, mid - 17, 'Ambil', () => done(collectUpgrade(s), spareWorn
        ? `${name} ${tierName} masuk Tas › Perlengkapan (cadanganmu masih terpasang). Tukar di jendela Karakter (C).`
        : `${name} ${tierName} terpasang, siap dipakai!`), 104);
  }

  // one card per tool: now, next tier, cost
  const cw = (W - 48 - 10) / 2, ch = 150;
  UPGRADABLE.forEach((id, i) => {
    const t = TOOLS.find((tt) => tt.id === id)!;
    const cx = x + 24 + (i % 2) * (cw + 10), cy = y + 56 + SH + 12 + Math.floor(i / 2) * (ch + 10);
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
