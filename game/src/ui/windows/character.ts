import { TIER_COLORS, TIER_EFFECTS, TOOLS, TOOL_TIERS, UPGRADABLE, needsPurchase, type Tool } from '../../data';
import { play } from '../../sfx';
import { BAG_TIERS } from '../../data';
import { WEARS, bagCapacity, canUnequip, isWorn, maxStamina, save, slotsUsed, tierOf, toggleEquip, waterMax, type Wear } from '../../state';
import { openInventory } from './bag';
import { C, HEX, card, txt } from '../theme';
import type { UIScene } from '../../scenes/UIScene';

type Slot = { kind: 'wear'; id: Wear } | { kind: 'tool'; id: Tool } | { kind: 'stat'; id: 'level' | 'tas' };

const WEAR: Record<Wear, { name: string; slot: string; desc: string }> = {
  topi: { name: 'Caping Bambu', slot: 'Kepala', desc: 'Topi anyaman bambu dengan pita merah. Menahan terik matahari di ladang.' },
  baju: { name: 'Kemeja Biru', slot: 'Badan', desc: 'Kemeja kerja katun, nyaman untuk mencangkul seharian.' },
  celana: { name: 'Celana Kerja', slot: 'Kaki', desc: 'Celana ungu tua yang tahan lumpur sawah.' },
  sepatu: { name: 'Sepatu Bot', slot: 'Alas kaki', desc: 'Bot karet untuk tanah becek dan pematang.' },
};
const TOOL_INFO: Partial<Record<Tool, string>> = {
  benih: 'Menanam benih dan memasang sprinkler. Tekan Q untuk ganti benih.',
  tangan: 'Memanen, mengambil barang, memberi pakan ayam.',
};

let picked: Slot | undefined;
let lastClick = { key: '', at: 0 };
const same = (a?: Slot, b?: Slot) => !!a && !!b && a.kind === b.kind && a.id === b.id;
const keyOf = (sl: Slot) => `${sl.kind}:${sl.id}`;

/**
 * Paper doll on the left, details top right, and the Perlengkapan box (gear taken off) below.
 * Double-click or drag between the doll and the box to take things off or put them on.
 */
export function openCharacter(ui: UIScene) {
  const s = ui.state;
  picked ??= { kind: 'tool', id: s.tool };
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

  const owned = (t: Tool) => !needsPurchase(t) || s.ownedTools.includes(t);
  const inside = (r: { x: number; y: number; w: number; h: number }, wx: number, wy: number) => wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h;
  const flip = (sl: Slot) => {
    if (sl.kind === 'stat' || (sl.kind === 'tool' && !owned(sl.id))) return;
    const key = keyOf(sl);
    if (!canUnequip(key)) {
      play('error');
      return ui.toast('Tangan tidak bisa dicopot.');
    }
    toggleEquip(s, key);
    play('plant');
    save(s);
    ui.game.events.emit('hud');
  };

  /** Click selects, a second click soon after toggles, dragging across to the other side toggles too. */
  const interact = (sl: Slot, from: 'doll' | 'inv', icon: string, z: Phaser.GameObjects.Zone) => {
    z.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const cam = ui.cameras.main;
      const start = cam.getWorldPoint(p.x, p.y);
      const draggable = sl.kind !== 'stat' && isWorn(s, keyOf(sl)) === (from === 'doll') && canUnequip(keyOf(sl)) && (sl.kind !== 'tool' || owned(sl.id));
      let ghost: Phaser.GameObjects.Image | undefined;
      const move = (q: Phaser.Input.Pointer) => {
        if (!draggable) return;
        const w = cam.getWorldPoint(q.x, q.y);
        if (!ghost && Math.hypot(w.x - start.x, w.y - start.y) < 6) return;
        ghost ??= ui.add.image(w.x, w.y, icon).setScale(sl.kind === 'wear' ? 4 : 2.8).setAlpha(0.85).setDepth(10000);
        ghost.setPosition(w.x, w.y);
      };
      const up = (q: Phaser.Input.Pointer) => {
        ui.input.off('pointermove', move);
        ui.input.off('pointerup', up);
        const w = cam.getWorldPoint(q.x, q.y);
        picked = sl;
        if (ghost) {
          ghost.destroy();
          if (from === 'doll' ? inside(inv, w.x, w.y) : inside(doll, w.x, w.y)) flip(sl);
        } else {
          const now = Date.now();
          if (lastClick.key === keyOf(sl) && now - lastClick.at < 400) {
            lastClick = { key: '', at: 0 };
            if (sl.kind === 'stat' && sl.id === 'tas') return openInventory(ui);
            flip(sl);
          } else {
            lastClick = { key: keyOf(sl), at: now };
            play('click');
          }
        }
        openCharacter(ui);
      };
      ui.input.on('pointermove', move);
      ui.input.on('pointerup', up);
    });
  };

  const cell = (slot: Slot, cx: number, cy: number, size: number) => {
    const sel = same(slot, picked);
    let edge: number | undefined;
    if (slot.kind === 'tool' && owned(slot.id) && tierOf(s, slot.id)) edge = TIER_COLORS[tierOf(s, slot.id)];
    card(g, cx, cy, size, size, sel ? 'selected' : 'muted', 12);
    const off = slot.kind !== 'stat' && !isWorn(s, keyOf(slot));
    if (edge !== undefined && !off) g.lineStyle(2, edge, 1).strokeRoundedRect(cx + 1, cy + 1, size - 2, size - 2, 11);
    if (sel) g.lineStyle(2.5, HEX.blue, 1).strokeRoundedRect(cx - 1, cy - 1, size + 2, size + 2, 13);
    const mid = [cx + size / 2, cy + size / 2] as const;
    let icon = 'icon-tas';
    if (slot.kind === 'stat' && slot.id === 'level') {
      c.add(ui.add.text(mid[0], mid[1] - 6, `${s.level}`, txt(15, C.purple)).setOrigin(0.5));
      c.add(ui.add.text(mid[0], mid[1] + 11, 'Level', txt(9, C.tertiary)).setOrigin(0.5));
    } else if (slot.kind === 'stat') {
      c.add(ui.add.image(mid[0], mid[1] - 6, 'icon-tas').setScale(2));
      c.add(ui.add.text(mid[0], mid[1] + 15, 'Tas', txt(9, C.tertiary)).setOrigin(0.5));
    } else {
      icon = slot.kind === 'wear' ? `wear-${slot.id}` : `tool-${slot.id}`;
      const img = ui.add.image(mid[0], mid[1], icon).setScale(slot.kind === 'wear' ? 4.6 : size >= B ? 3.6 : 2.4);
      if ((slot.kind === 'tool' && !owned(slot.id)) || off) img.setTint(0x1d1d1f).setAlpha(0.14);
      c.add(img);
      if (off) c.add(ui.add.text(mid[0], cy + size - 6, 'kosong', txt(9, C.tertiary)).setOrigin(0.5, 1));
      if (slot.kind === 'tool' && s.tool === slot.id) c.add(ui.add.text(cx + size - 5, cy + 4, '●', txt(9, C.blue)).setOrigin(1, 0));
    }
    const z = ui.add.zone(cx, cy, size, size).setOrigin(0).setInteractive({ useHandCursor: true });
    interact(slot, 'doll', icon, z);
    c.add(z);
  };

  // row 0: head, with the bag and level in the small side slots
  cell({ kind: 'stat', id: 'tas' }, col(0) + B - S, row(0) + B - S, S);
  cell({ kind: 'wear', id: 'topi' }, col(1), row(0), B);
  cell({ kind: 'stat', id: 'level' }, col(2), row(0) + B - S, S);
  // rows 1-2: tools on the sides, shirt and trousers in the middle
  cell({ kind: 'tool', id: 'cangkul' }, col(0), row(1), B);
  cell({ kind: 'wear', id: 'baju' }, col(1), row(1), B);
  cell({ kind: 'tool', id: 'siram' }, col(2), row(1), B);
  cell({ kind: 'tool', id: 'pancing' }, col(0), row(2), B);
  cell({ kind: 'wear', id: 'celana' }, col(1), row(2), B);
  cell({ kind: 'tool', id: 'beliung' }, col(2), row(2), B);
  // row 3: boots, with seeds and hand in the small slots
  cell({ kind: 'tool', id: 'benih' }, col(0) + B - S, row(3), S);
  cell({ kind: 'wear', id: 'sepatu' }, col(1), row(3), B);
  cell({ kind: 'tool', id: 'tangan' }, col(2), row(3), S);

  // bottom right: the Perlengkapan box, gear that is taken off
  const ig = ui.add.graphics();
  c.add(ig);
  card(ig, inv.x, inv.y, inv.w, inv.h, 'muted', 16);
  c.add(ui.add.text(inv.x + 14, inv.y + 10, 'TAS · PERLENGKAPAN', txt(11, C.tertiary)));
  c.add(ui.add.text(inv.x + inv.w - 14, inv.y + 11, 'klik 2× atau seret untuk pasang / copot', txt(10, C.tertiary, false)).setOrigin(1, 0));
  const offList: Slot[] = [
    ...WEARS.map((w) => ({ kind: 'wear' as const, id: w })),
    ...TOOLS.filter((t) => owned(t.id)).map((t) => ({ kind: 'tool' as const, id: t.id })),
  ].filter((sl) => !isWorn(s, keyOf(sl)));
  const IS = 46, IG = 8, ICOLS = Math.floor((inv.w - 28 + IG) / (IS + IG));
  const ix0 = inv.x + 14, iy0 = inv.y + 32;
  for (let i = 0; i < ICOLS * 2; i++) {
    const sx = ix0 + (i % ICOLS) * (IS + IG), sy = iy0 + Math.floor(i / ICOLS) * (IS + IG);
    const sl = offList[i];
    const sel = !!sl && same(sl, picked);
    card(ig, sx, sy, IS, IS, sl ? 'normal' : 'muted', 10);
    if (sel) ig.lineStyle(2, HEX.blue, 1).strokeRoundedRect(sx, sy, IS, IS, 10);
    if (!sl) continue;
    const icon = sl.kind === 'wear' ? `wear-${sl.id}` : `tool-${sl.id}`;
    c.add(ui.add.image(sx + IS / 2, sy + IS / 2, icon).setScale(sl.kind === 'wear' ? 2.8 : 2.1));
    const z = ui.add.zone(sx, sy, IS, IS).setOrigin(0).setInteractive({ useHandCursor: true });
    interact(sl, 'inv', icon, z);
    c.add(z);
  }

  // top right: details of the picked slot
  const px = rx, pw = rw, py = y0, ph = 200;
  card(g, px, py, pw, ph, 'normal', 16);
  const p = picked;
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
  const equipButton = (key: string) => {
    if (!canUnequip(key)) return;
    const on = isWorn(s, key);
    ui.button(c, px + pw - 122, py + 18, on ? 'Copot' : 'Pasang', () => {
      flip(p);
      openCharacter(ui);
    }, 104, false, on);
  };

  if (p.kind === 'wear') {
    const w = WEAR[p.id];
    const on = isWorn(s, `wear:${p.id}`);
    head(`wear-${p.id}`, w.name, `KOSTUM · ${w.slot.toUpperCase()} · ${on ? 'DIPAKAI' : 'DI TAS'}`, !on);
    para(w.desc, C.ink);
    para('Bawaan Petani Desa. Kostum lain belum tersedia.', C.tertiary);
    equipButton(`wear:${p.id}`);
  } else if (p.kind === 'stat') {
    if (p.id === 'level') {
      head(undefined, `Level ${s.level}`, `TENAGA ${s.stamina}/${maxStamina(s)} · AIR ${s.water}/${waterMax(s)}`);
      para('Naik level dengan bertani, memancing, memasak, dan membantu warga. Level membuka benih, alat, dan bangunan baru.');
    } else {
      head('icon-tas', BAG_TIERS[s.bagTier].name, `TAS · ${slotsUsed(s)}/${bagCapacity(s)} SLOT`);
      para('Menyimpan hasil panen, benih, dan barang. Alat dan kostum yang dicopot masuk ke kotak Perlengkapan di bawah, tanpa memakai slot.');
      ui.button(c, px + pw - 122, py + 18, 'Buka Tas', () => openInventory(ui), 104, false, true);
    }
  } else {
    const t = TOOLS.find((o) => o.id === p.id)!;
    const has = owned(p.id);
    const on = isWorn(s, `tool:${p.id}`);
    head(`tool-${p.id}`, t.name, `ALAT · TOMBOL ${t.key}${!has ? '' : !on ? ' · DI TAS' : s.tool === p.id ? ' · DIPEGANG' : ''}`, !has || !on);
    if (has) equipButton(`tool:${p.id}`);
    if (!has) para('Belum punya. Beli di toko.', C.red);
    else if (UPGRADABLE.includes(p.id)) {
      const tier = tierOf(s, p.id);
      TOOL_TIERS.forEach((name, i) => {
        const done = i <= tier;
        const ry = ty + i * 26;
        if (i === tier) g.fillStyle(TIER_COLORS[i] || 0x767680, i ? 0.3 : 0.12).fillRoundedRect(tx - 8, ry - 4, pw - 20, 24, 8);
        g.fillStyle(i ? TIER_COLORS[i] : 0x9a9aa0, done ? 1 : 0.3).fillCircle(tx + 6, ry + 8, 5);
        c.add(ui.add.text(tx + 20, ry, name, txt(12, done ? C.ink : C.disabled)));
        c.add(ui.add.text(tx + 90, ry + 1, TIER_EFFECTS[p.id]?.[i] ?? '', txt(11, done ? C.secondary : C.disabled, false)));
      });
    } else para(TOOL_INFO[p.id] ?? '', C.ink);
  }

  ui.button(c, x + W / 2 - 60, y + H - 48, 'Tutup', () => ui.closeModal(), 120);
}
