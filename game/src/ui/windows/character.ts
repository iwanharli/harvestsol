import { TIER_COLORS, TIER_EFFECTS, TOOLS, TOOL_TIERS, UPGRADABLE, needsPurchase, type Tool } from '../../data';
import { play } from '../../sfx';
import { BAG_TIERS } from '../../data';
import { bagCapacity, canUnequip, isWorn, maxStamina, save, slotsUsed, tierOf, toggleEquip, waterMax, type Wear } from '../../state';
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
const same = (a?: Slot, b?: Slot) => !!a && !!b && a.kind === b.kind && a.id === b.id;

/** Paper-doll view: the outfit down the middle, tools on both sides, details of the picked slot on the right. */
export function openCharacter(ui: UIScene) {
  const s = ui.state;
  picked ??= { kind: 'tool', id: s.tool };
  const W = 680, H = 470;
  const { c, x, y } = ui.openModal(W, H, 'Karakter', 'character');
  const g = ui.add.graphics();
  c.add(g);

  const B = 78, S = 52, GAP = 10;
  const x0 = x + 24, y0 = y + 58;
  const col = (i: number) => x0 + i * (B + GAP);
  const row = (i: number) => y0 + i * (B + GAP);

  const owned = (t: Tool) => !needsPurchase(t) || s.ownedTools.includes(t);
  const cell = (slot: Slot, cx: number, cy: number, size: number) => {
    const sel = same(slot, picked);
    let edge: number | undefined;
    if (slot.kind === 'tool' && owned(slot.id) && tierOf(s, slot.id)) edge = TIER_COLORS[tierOf(s, slot.id)];
    card(g, cx, cy, size, size, sel ? 'selected' : 'muted', 12);
    if (edge !== undefined) g.lineStyle(2, edge, 1).strokeRoundedRect(cx + 1, cy + 1, size - 2, size - 2, 11);
    if (sel) g.lineStyle(2.5, HEX.blue, 1).strokeRoundedRect(cx - 1, cy - 1, size + 2, size + 2, 13);
    const mid = [cx + size / 2, cy + size / 2] as const;
    if (slot.kind === 'stat' && slot.id === 'level') {
      c.add(ui.add.text(mid[0], mid[1] - 6, `${s.level}`, txt(15, C.purple)).setOrigin(0.5));
      c.add(ui.add.text(mid[0], mid[1] + 11, 'Level', txt(9, C.tertiary)).setOrigin(0.5));
    } else if (slot.kind === 'stat') {
      c.add(ui.add.image(mid[0], mid[1] - 5, 'icon-tas').setScale(2));
      c.add(ui.add.text(mid[0], mid[1] + 15, `${slotsUsed(s)}/${bagCapacity(s)}`, txt(9, C.tertiary)).setOrigin(0.5));
    } else {
      const key = slot.kind === 'wear' ? `wear-${slot.id}` : `tool-${slot.id}`;
      const img = ui.add.image(mid[0], mid[1], key).setScale(slot.kind === 'wear' ? 4.6 : size >= B ? 3.6 : 2.4);
      const off = !isWorn(s, `${slot.kind}:${slot.id}`);
      if ((slot.kind === 'tool' && !owned(slot.id)) || off) img.setTint(0x1d1d1f).setAlpha(0.18);
      c.add(img);
      if (off) c.add(ui.add.text(mid[0], cy + size - 6, 'kosong', txt(9, C.tertiary)).setOrigin(0.5, 1));
      if (slot.kind === 'tool' && s.tool === slot.id) c.add(ui.add.text(cx + size - 5, cy + 4, '●', txt(9, C.blue)).setOrigin(1, 0));
    }
    const z = ui.add.zone(cx, cy, size, size).setOrigin(0).setInteractive({ useHandCursor: true });
    z.on('pointerdown', () => {
      play('click');
      picked = slot;
      openCharacter(ui);
    });
    c.add(z);
  };

  // row 0: head, with level and stamina in the small side slots
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

  // right: details of the picked slot
  const px = col(3) + 8, pw = x + W - 24 - px, py = y0, ph = 4 * B + 3 * GAP;
  card(g, px, py, pw, ph, 'normal', 16);
  const p = picked;
  const tx = px + 20;
  let ty = py + 18;
  const head = (icon: string | undefined, title: string, sub: string, dim = false) => {
    if (icon) {
      g.fillStyle(HEX.well, 1).fillCircle(tx + 26, ty + 26, 26);
      const im = ui.add.image(tx + 26, ty + 26, icon).setScale(2.6);
      if (dim) im.setTint(0x1d1d1f).setAlpha(0.25);
      c.add(im);
    }
    c.add(ui.add.text(tx + (icon ? 66 : 0), ty + 6, title, txt(17, dim ? C.tertiary : C.ink)));
    c.add(ui.add.text(tx + (icon ? 66 : 0), ty + 30, sub, txt(11, C.tertiary)));
    ty += 70;
  };
  const equipButton = (key: string) => {
    if (!canUnequip(key)) return;
    const on = isWorn(s, key);
    ui.button(c, px + pw - 128, py + 22, on ? 'Copot' : 'Pasang', () => {
      play('click');
      toggleEquip(s, key);
      save(s);
      ui.game.events.emit('hud');
      openCharacter(ui);
    }, 108, false, on);
  };
  const para = (t: string, color: string = C.secondary) => {
    const o = ui.add.text(tx, ty, t, { ...txt(12, color, false), wordWrap: { width: pw - 40 }, lineSpacing: 3 });
    c.add(o);
    ty += o.height + 12;
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
      para('Tenaga maksimal naik tiap 4 level dan dari hadiah khusus.', C.tertiary);
    } else {
      head('icon-tas', BAG_TIERS[s.bagTier].name, `TAS · ${slotsUsed(s)}/${bagCapacity(s)} SLOT`);
      para('Menyimpan hasil panen, benih, dan barang. Alat dan kostum yang dicopot disimpan di tab Perlengkapan.');
      ui.button(c, tx, py + ph - 52, 'Buka Tas', () => openInventory(ui, 'perlengkapan'), 130);
    }
  } else {
    const t = TOOLS.find((o) => o.id === p.id)!;
    const has = owned(p.id);
    const using = s.tool === p.id;
    const on = isWorn(s, `tool:${p.id}`);
    head(`tool-${p.id}`, t.name, `ALAT · TOMBOL ${t.key}${!on ? ' · DI TAS' : using ? ' · DIPEGANG' : ''}`, !has || !on);
    if (has) equipButton(`tool:${p.id}`);
    if (!has) para('Belum punya. Beli di toko.', C.red);
    else if (UPGRADABLE.includes(p.id)) {
      const tier = tierOf(s, p.id);
      // every tier, the current one highlighted
      TOOL_TIERS.forEach((name, i) => {
        const done = i <= tier;
        const ry = ty + i * 30;
        if (i === tier) g.fillStyle(TIER_COLORS[i] || 0x767680, i ? 0.3 : 0.12).fillRoundedRect(tx - 8, ry - 4, pw - 24, 28, 8);
        g.fillStyle(i ? TIER_COLORS[i] : 0x9a9aa0, done ? 1 : 0.3).fillCircle(tx + 6, ry + 10, 6);
        c.add(ui.add.text(tx + 20, ry + 2, name, txt(12, done ? C.ink : C.disabled)));
        c.add(ui.add.text(tx + 90, ry + 3, TIER_EFFECTS[p.id]?.[i] ?? '', txt(11, done ? C.secondary : C.disabled, false)));
      });
      ty += TOOL_TIERS.length * 30 + 10;
      if (tier < TOOL_TIERS.length - 1) para('Upgrade berikutnya di Bengkel Pandai Besi.', C.tertiary);
      else para('Sudah tingkat tertinggi.', C.green);
    } else para(TOOL_INFO[p.id] ?? '', C.ink);
  }

  ui.button(c, x + W / 2 - 60, y + H - 48, 'Tutup', () => ui.closeModal(), 120);
}
