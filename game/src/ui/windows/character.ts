import { BAG_TIERS, COSTUMES, DEFAULT_OUTFIT, TIER_COLORS, TIER_EFFECTS, TOOLS, TOOL_TIERS, UPGRADABLE, costumeById, needsPurchase, type Tool } from '../../data';
import { play } from '../../sfx';
import {

  bagCapacity,
  canUnequip,
  equipFromBox,
  gearBox,
  isWorn,
  maxStamina,
  save,
  slotsUsed,
  atForge,
  tierOf,
  unequipSlot,
  waterMax,
  type BoxItem,
  type Wear,
} from '../../state';
import { C, HEX, card, tierBadge, txt } from '../theme';
import { openInventory } from './bag';
import type { UIScene } from '../../scenes/UIScene';

const SLOT_NAME: Record<Wear, string> = { topi: 'Kepala', baju: 'Badan', celana: 'Kaki', sepatu: 'Alas kaki' };
const TOOL_INFO: Partial<Record<Tool, string>> = {
  benih: 'Menanam benih dan memasang sprinkler. Tekan Q untuk ganti benih.',
  tangan: 'Memanen, mengambil barang, memberi pakan ayam.',
};

/** What is picked: a body slot ('tool:x', 'wear:x', 'stat:tas', 'stat:level') or a box item ('box:<key>'). */
let picked: string | undefined;
let lastClick = { key: '', at: 0 };

/**
 * Paper doll on the left, details top right, and the Perlengkapan box below it with every spare tool
 * and costume. Double-click or drag between the doll and the box to take things off or put them on.
 */
export function openCharacter(ui: UIScene) {
  const s = ui.state;
  picked ??= `tool:${s.tool}`;
  const W = 780, H = 480;
  const { c, x, y } = ui.openModal(W, H, 'Karakter', 'character');
  const g = ui.add.graphics();
  c.add(g);

  const B = 78, S = 52, GAP = 10;
  const x0 = x + 24, y0 = y + 58;
  const col = (i: number) => x0 + i * (B + GAP);
  const row = (i: number) => y0 + i * (B + GAP);
  const doll = { x: x0, y: y0, w: 3 * B + 2 * GAP, h: 4 * B + 3 * GAP };
  const rx = doll.x + doll.w + 22, rw = x + W - 24 - rx;
  const inv = { x: rx, y: y0 + 214, w: rw, h: doll.h - 214 };
  const box = gearBox(s);
  if (picked.startsWith('box:') && !box.some((b) => `box:${b.key}` === picked)) picked = `tool:${s.tool}`;

  const owned = (t: Tool) => !needsPurchase(t) || s.ownedTools.includes(t);
  const inside = (r: { x: number; y: number; w: number; h: number }, wx: number, wy: number) => wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h;
  const act = (err: string | null) => {
    if (err) {
      play('error');
      ui.toast(err);
      return;
    }
    play('plant');
    save(s);
    ui.game.events.emit('hud');
  };
  /** Doll slot → box, or box item → its slot on the doll. */
  const flip = (sel: string) => {
    if (sel.startsWith('box:')) {
      const key = sel.slice(4);
      const it = box.find((b) => b.key === key);
      act(equipFromBox(s, key));
      if (it) picked = it.slot;
    } else if (!sel.startsWith('stat:') && isWorn(s, sel)) act(unequipSlot(s, sel));
  };

  /** Click selects, a second click soon after toggles, dragging across to the other side toggles too. */
  const interact = (sel: string, from: 'doll' | 'inv', icon: string, z: Phaser.GameObjects.Zone) => {
    z.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const cam = ui.cameras.main;
      const start = cam.getWorldPoint(p.x, p.y);
      const draggable = from === 'inv' || (!sel.startsWith('stat:') && isWorn(s, sel) && canUnequip(sel));
      let ghost: Phaser.GameObjects.Image | undefined;
      const move = (q: Phaser.Input.Pointer) => {
        if (!draggable) return;
        const w = cam.getWorldPoint(q.x, q.y);
        if (!ghost && Math.hypot(w.x - start.x, w.y - start.y) < 6) return;
        ghost ??= ui.add.image(w.x, w.y, icon).setScale(icon.startsWith('wear') ? 4 : 2.8).setAlpha(0.85).setDepth(10000);
        ghost.setPosition(w.x, w.y);
      };
      const up = (q: Phaser.Input.Pointer) => {
        ui.input.off('pointermove', move);
        ui.input.off('pointerup', up);
        const w = cam.getWorldPoint(q.x, q.y);
        picked = sel;
        if (ghost) {
          ghost.destroy();
          if (from === 'doll' ? inside(inv, w.x, w.y) : inside(doll, w.x, w.y)) flip(sel);
        } else {
          const now = Date.now();
          if (lastClick.key === sel && now - lastClick.at < 400) {
            lastClick = { key: '', at: 0 };
            if (sel === 'stat:tas') return openInventory(ui);
            flip(sel);
          } else {
            lastClick = { key: sel, at: now };
            play('click');
          }
        }
        openCharacter(ui);
      };
      ui.input.on('pointermove', move);
      ui.input.on('pointerup', up);
    });
  };

  const cell = (sel: string, cx: number, cy: number, size: number) => {
    const [kind, id] = sel.split(':');
    const isSel = sel === picked;
    const off = kind !== 'stat' && !isWorn(s, sel);
    const tool = kind === 'tool' ? (id as Tool) : undefined;
    card(g, cx, cy, size, size, isSel ? 'selected' : 'muted', 12);
    if (tool && owned(tool) && !off && tierOf(s, tool)) g.lineStyle(2, TIER_COLORS[tierOf(s, tool)], 1).strokeRoundedRect(cx + 1, cy + 1, size - 2, size - 2, 11);
    if (isSel) g.lineStyle(2.5, HEX.blue, 1).strokeRoundedRect(cx - 1, cy - 1, size + 2, size + 2, 13);
    const mx = cx + size / 2, my = cy + size / 2;
    let icon = 'icon-tas';
    if (sel === 'stat:level') {
      c.add(ui.add.text(mx, my - 6, `${s.level}`, txt(15, C.purple)).setOrigin(0.5));
      c.add(ui.add.text(mx, my + 11, 'Level', txt(9, C.tertiary)).setOrigin(0.5));
    } else if (sel === 'stat:tas') {
      c.add(ui.add.image(mx, my - 6, 'icon-tas').setScale(2));
      c.add(ui.add.text(mx, my + 15, 'Tas', txt(9, C.tertiary)).setOrigin(0.5));
    } else {
      icon = kind === 'wear' ? `wear-${s.outfit?.[id as Wear] || id}` : `tool-${id}`;
      const img = ui.add.image(mx, my - (tool && UPGRADABLE.includes(tool) && !off ? 5 : 0), icon).setScale(kind === 'wear' ? 4.6 : size >= B ? 3.2 : 2.4);
      if ((tool && !owned(tool)) || off) img.setTint(0x1d1d1f).setAlpha(0.14);
      c.add(img);
      if (off) c.add(ui.add.text(mx, cy + size - 6, tool && atForge(s, tool) ? 'di Bengkel' : 'kosong', txt(9, tool && atForge(s, tool) ? C.orange : C.tertiary)).setOrigin(0.5, 1));
      else if (tool && owned(tool) && UPGRADABLE.includes(tool)) c.add(tierBadge(ui, g, mx, cy + size, tierOf(s, tool), size < B));
      if (tool && s.tool === tool) c.add(ui.add.text(cx + size - 5, cy + 4, '●', txt(9, C.blue)).setOrigin(1, 0));
    }
    const z = ui.add.zone(cx, cy, size, size).setOrigin(0).setInteractive({ useHandCursor: true });
    interact(sel, 'doll', icon, z);
    c.add(z);
  };

  cell('stat:tas', col(0) + B - S, row(0) + B - S, S);
  cell('wear:topi', col(1), row(0), B);
  cell('stat:level', col(2), row(0) + B - S, S);
  cell('tool:cangkul', col(0), row(1), B);
  cell('wear:baju', col(1), row(1), B);
  cell('tool:siram', col(2), row(1), B);
  cell('tool:pancing', col(0), row(2), B);
  cell('wear:celana', col(1), row(2), B);
  cell('tool:beliung', col(2), row(2), B);
  cell('tool:benih', col(0) + B - S, row(3), S);
  cell('wear:sepatu', col(1), row(3), B);
  cell('tool:tangan', col(2), row(3), S);

  // bottom right: the Perlengkapan box
  const ig = ui.add.graphics();
  c.add(ig);
  card(ig, inv.x, inv.y, inv.w, inv.h, 'muted', 16);
  c.add(ui.add.text(inv.x + 14, inv.y + 10, `TAS · PERLENGKAPAN (${box.length})`, txt(11, C.tertiary)));
  c.add(ui.add.text(inv.x + inv.w - 14, inv.y + 11, 'klik 2× atau seret untuk pasang / copot', txt(10, C.tertiary, false)).setOrigin(1, 0));
  const IS = 46, IG = 8, ICOLS = Math.floor((inv.w - 28 + IG) / (IS + IG));
  const ix0 = inv.x + 14, iy0 = inv.y + 32;
  for (let i = 0; i < ICOLS * 2; i++) {
    const sx = ix0 + (i % ICOLS) * (IS + IG), sy = iy0 + Math.floor(i / ICOLS) * (IS + IG);
    const it = box[i];
    const sel = it ? `box:${it.key}` : '';
    card(ig, sx, sy, IS, IS, it ? 'normal' : 'muted', 10);
    if (!it) continue;
    if (it.tier) ig.lineStyle(2, TIER_COLORS[it.tier], 1).strokeRoundedRect(sx + 1, sy + 1, IS - 2, IS - 2, 9);
    if (sel === picked) ig.lineStyle(2, HEX.blue, 1).strokeRoundedRect(sx - 1, sy - 1, IS + 2, IS + 2, 11);
    c.add(ui.add.image(sx + IS / 2, sy + IS / 2 - (it.kind === 'tool' ? 6 : 0), it.icon).setScale(it.kind === "wear" ? 2.8 : 1.9));
    const tool = it.slot.slice(5) as Tool;
    if (it.kind === 'tool' && UPGRADABLE.includes(tool)) c.add(tierBadge(ui, ig, sx + IS / 2, sy + IS, it.tier ?? 0, true));
    const z = ui.add.zone(sx, sy, IS, IS).setOrigin(0).setInteractive({ useHandCursor: true });
    interact(sel, 'inv', it.icon, z);
    c.add(z);
  }
  if (box.length > ICOLS * 2) c.add(ui.add.text(inv.x + inv.w - 14, inv.y + inv.h - 6, `+${box.length - ICOLS * 2} lagi di Tas`, txt(10, C.tertiary)).setOrigin(1, 1));

  // top right: details
  const px = rx, pw = rw, py = y0, ph = 200;
  card(g, px, py, pw, ph, 'normal', 16);
  const tx = px + 18;
  let ty = py + 14;
  const head = (icon: string | undefined, title: string, sub: string, dim = false) => {
    if (icon) {
      g.fillStyle(HEX.well, 1).fillCircle(tx + 24, ty + 24, 24);
      const im = ui.add.image(tx + 24, ty + 24, icon).setScale(icon.startsWith('wear') ? 3.4 : 2.4);
      if (dim) im.setAlpha(0.35);
      c.add(im);
    }
    c.add(ui.add.text(tx + (icon ? 60 : 0), ty + 5, title, txt(16, dim ? C.tertiary : C.ink)));
    c.add(ui.add.text(tx + (icon ? 60 : 0), ty + 28, sub, txt(10, C.tertiary)));
    ty += 60;
  };
  const para = (t: string, color: string = C.secondary) => {
    const o = ui.add.text(tx, ty, t, { ...txt(12, color, false), wordWrap: { width: pw - 36 }, lineSpacing: 3 });
    c.add(o);
    ty += o.height + 8;
  };
  const actionButton = (label: string, primary: boolean) =>
    ui.button(c, px + pw - 122, py + 18, label, () => {
      flip(picked!);
      openCharacter(ui);
    }, 104, false, !primary);
  const tiers = (tool: Tool, tier: number) =>
    TOOL_TIERS.forEach((name, i) => {
      const done = i <= tier;
      const ry = ty + i * 26;
      if (i === tier) g.fillStyle(TIER_COLORS[i] || 0x767680, i ? 0.3 : 0.12).fillRoundedRect(tx - 8, ry - 4, pw - 20, 24, 8);
      g.fillStyle(i ? TIER_COLORS[i] : 0x9a9aa0, done ? 1 : 0.3).fillCircle(tx + 6, ry + 8, 5);
      c.add(ui.add.text(tx + 20, ry, name, txt(12, done ? C.ink : C.disabled)));
      c.add(ui.add.text(tx + 90, ry + 1, TIER_EFFECTS[tool]?.[i] ?? '', txt(11, done ? C.secondary : C.disabled, false)));
    });

  const [kind, id] = picked.split(':');
  if (kind === 'box') {
    const it = box.find((b) => `box:${b.key}` === picked) as BoxItem;
    if (it.kind === 'wear') {
      const cos = costumeById(it.key.slice(4))!;
      head(it.icon, cos.name, `KOSTUM · ${SLOT_NAME[cos.slot].toUpperCase()} · DI TAS`);
      para(cos.desc, C.ink);
      const now = costumeById(s.outfit?.[cos.slot] ?? '');
      para(now ? `Dipasang menggantikan ${now.name}.` : 'Slotnya sedang kosong.', C.tertiary);
    } else {
      const tool = it.slot.slice(5) as Tool;
      head(it.icon, it.name, `ALAT · ${TOOL_TIERS[it.tier ?? 0].toUpperCase()} · DI TAS`);
      if (UPGRADABLE.includes(tool)) tiers(tool, it.tier ?? 0);
      else para(TOOL_INFO[tool] ?? '', C.ink);
    }
    actionButton('Pasang', true);
  } else if (kind === 'wear') {
    const cur = costumeById(s.outfit?.[id as Wear] ?? '');
    if (cur) {
      head(`wear-${cur.id}`, cur.name, `KOSTUM · ${SLOT_NAME[id as Wear].toUpperCase()} · DIPAKAI`);
      para(cur.desc, C.ink);
      const more = COSTUMES.filter((k) => k.slot === id && (s.wardrobe ?? []).includes(k.id)).length - 1;
      para(more ? `${more} pilihan lain di kotak Perlengkapan.` : 'Beli kostum lain di Toko Peralatan & Pakaian.', C.tertiary);
      actionButton('Copot', false);
    } else {
      head(`wear-${DEFAULT_OUTFIT[id as Wear]}`, 'Kosong', `KOSTUM · ${SLOT_NAME[id as Wear].toUpperCase()}`, true);
      para('Pilih kostum dari kotak Perlengkapan di bawah: klik 2× atau seret ke karakter.', C.secondary);
    }
  } else if (picked === 'stat:level') {
    head(undefined, `Level ${s.level}`, `TENAGA ${s.stamina}/${maxStamina(s)} · AIR ${s.water}/${waterMax(s)}`);
    para('Naik level dengan bertani, memancing, memasak, dan membantu warga. Level membuka benih, alat, dan bangunan baru.');
  } else if (picked === 'stat:tas') {
    head('icon-tas', BAG_TIERS[s.bagTier].name, `TAS · ${slotsUsed(s)}/${bagCapacity(s)} SLOT`);
    para('Menyimpan hasil panen, benih, dan barang. Alat dan kostum cadangan ada di kotak Perlengkapan, tanpa memakai slot.');
    ui.button(c, px + pw - 122, py + 18, 'Buka Tas', () => openInventory(ui), 104, false, true);
  } else {
    const tool = id as Tool;
    const t = TOOLS.find((o) => o.id === tool)!;
    const has = owned(tool);
    const on = isWorn(s, picked);
    head(`tool-${tool}`, t.name, `ALAT · TOMBOL ${t.key}${!has ? '' : !on ? ' · KOSONG' : s.tool === tool ? ' · DIPEGANG' : ''}`, !has || !on);
    if (!has) para('Belum punya. Beli di Toko Peralatan.', C.red);
    else if (!on && atForge(s, tool)) {
      const spare = box.some((b) => b.slot === picked);
      para(`${t.name} utamamu sedang ditempa di Bengkel Pandai Besi.`, C.orange);
      para(spare ? 'Pakai cadangan dari kotak Perlengkapan sementara: klik 2× atau seret ke slot ini.' : 'Beli cadangan di Toko Peralatan kalau mau tetap bekerja sambil menunggu.', C.secondary);
    } else if (!on) para('Slot kosong. Pasang dari kotak Perlengkapan di bawah.', C.secondary);
    else {
      if (canUnequip(picked)) actionButton('Copot', false);
      if (UPGRADABLE.includes(tool)) tiers(tool, tierOf(s, tool));
      else para(TOOL_INFO[tool] ?? '', C.ink);
    }
  }

  ui.button(c, x + W / 2 - 60, y + H - 48, 'Tutup', () => ui.closeModal(), 120);
}
