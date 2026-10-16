import {
  BAG_MAX_SLOTS,
  baseId,
  starsOf,
  dishById,
  BAG_TIERS,
  FEATURE_LEVEL,
  ITEMS,
  MAX_CHICKENS,
  STACK_MAX,
  cropById,
  itemName,
  npcById,
  produceById,
  seedIcon,
  isBought,
  isOre,
  TOOLS,
  TOOL_TIERS,
  needsPurchase,
} from '../../data';
import { play } from '../../sfx';
import { C, HEX, bar as drawBar, card, segmented, txt, well } from '../theme';
import {
  bagCapacity,
  wantsItem,
  bagOrderKeys,
  moveInBag,
  sortBag,
  eat,
  festivalTheme,
  isFestivalDay,
  save,
  seasonOf,
  slotsUsed,
  upgradeBag,
  maxStamina,
  WEARS,
  isWorn,
  canUnequip,
  toggleEquip,
  tierOf,
  type Wear,
} from '../../state';
import type { UIScene } from '../../scenes/UIScene';

const INK = C.ink;

type InvTab = 'semua' | 'panen' | 'benih' | 'ternak' | 'perlengkapan';

let invSel: { bag: 'produce' | 'seeds' | 'other'; id: string } | undefined;

let invTab: InvTab = 'semua';

export function openInventory(ui: UIScene, openTab?: InvTab) {
  if (openTab) invTab = openTab;
  const s = ui.state;
  const W = 700, H = 480;
  const cap = bagCapacity(s);
  const used = slotsUsed(s);
  const { c, x, y } = ui.openModal(W, H, `Tas · ${BAG_TIERS[s.bagTier].name}`, 'inventory');

  // capacity: "9/12 slot" with a thin bar under it
  const full = used >= cap;
  c.add(ui.add.text(x + W - 28, y + 20, `${used}/${cap} slot`, txt(13, full ? C.red : C.secondary)).setOrigin(1, 0));
  const capBar = ui.add.graphics();
  drawBar(capBar, x + W - 128, y + 40, 100, used / cap, full ? HEX.red : HEX.blue);
  c.add(capBar);

  type Slot = { bag: 'produce' | 'seeds' | 'other'; id: string; icon: string; qty: number | string };
  // one slot per stack of up to STACK_MAX
  const stacksOf = (bag: 'produce' | 'seeds', rec: Record<string, number>) =>
    Object.entries(rec).flatMap(([id, q]) => {
      const out: Slot[] = [];
      for (let left = q; left > 0; left -= STACK_MAX) out.push({ bag, id, icon: bag === 'seeds' ? seedIcon(id) : `icon-${baseId(id)}`, qty: Math.min(STACK_MAX, left) });
      return out;
    });
  // follow the player's order (drag to rearrange, "Rapikan" to auto-sort)
  const ordered = bagOrderKeys(s).flatMap((k) => {
    const bag = k.startsWith('seeds:') ? 'seeds' : 'produce';
    const id = k.slice(bag.length + 1);
    return stacksOf(bag, { [id]: (bag === 'seeds' ? s.seeds : s.produce)[id] });
  });
  const produce = ordered.filter((sl) => sl.bag === 'produce');
  const seeds = ordered.filter((sl) => sl.bag === 'seeds');
  const eggs = Object.values(s.coopEggs).reduce((a, b) => a + b, 0);
  const livestock: Slot[] =
    s.level >= FEATURE_LEVEL.coop
      ? [
          { bag: 'other', id: 'ayam', icon: 'icon-ayam', qty: `${s.animals.length}/${MAX_CHICKENS}` },
          { bag: 'other', id: 'pakan', icon: 'icon-pakan', qty: s.feed },
          ...(eggs ? [{ bag: 'other' as const, id: 'kandang', icon: 'icon-telur', qty: eggs }] : []),
        ]
      : [];

  const items0 = () => ordered.length > 1;
  // tabs
  const tabs: { id: InvTab; name: string; empty: string }[] = [
    { id: 'semua', name: 'Semua', empty: 'Tas masih kosong' },
    { id: 'panen', name: 'Hasil Panen', empty: 'Belum ada hasil panen' },
    { id: 'benih', name: 'Benih & Alat', empty: 'Belum ada benih atau alat · beli di toko' },
    ...(livestock.length ? [{ id: 'ternak' as const, name: 'Ternak', empty: 'Belum ada ternak' }] : []),
    { id: 'perlengkapan', name: 'Perlengkapan', empty: '' },
  ];
  if (!tabs.some((t) => t.id === invTab)) invTab = 'semua';
  const tab = tabs.find((t) => t.id === invTab)!;
  c.add(
    segmented(ui, x + 24, y + 54, tabs.map((t) => t.name), tabs.indexOf(tab), (i) => {
      play('click');
      invTab = tabs[i].id;
      openInventory(ui);
    }, tabs.length > 4 ? 100 : 112),
  );
  if (invTab === 'perlengkapan') return drawGear(ui, c, x, y, W, H);

  ui.button(c, x + W - 130, y + 54, 'Rapikan', () => {
    play('click');
    sortBag(s);
    save(s);
    ui.toast('Tas dirapikan.');
    openInventory(ui);
  }, 102, !items0(), true);

  // every tab shows a full grid: items first, then empty slots, then locked ones ("Semua")
  type Cell = Slot | 'empty' | 'locked';
  const items: Slot[] = invTab === 'semua' ? ordered : invTab === 'panen' ? produce : invTab === 'benih' ? seeds : livestock;
  const COLS = 6; // 6 x 5 = BAG_MAX_SLOTS
  const cells: Cell[] = [...items];
  for (let i = items.length; i < BAG_MAX_SLOTS; i++) cells.push(invTab === 'semua' && i >= cap ? 'locked' : 'empty');

  // the detail card follows the open tab: keep the selection only if it is shown here
  if (!invSel || !items.some((sl) => sl.bag === invSel!.bag && sl.id === invSel!.id)) {
    const first = items[0];
    invSel = first ? { bag: first.bag, id: first.id } : undefined;
  }

  const SZ = 50, GAP = 8;
  const gx = x + 28, gy = y + 98;
  cells.forEach((cl, i) => {
    const sx = gx + (i % COLS) * (SZ + GAP);
    const sy = gy + Math.floor(i / COLS) * (SZ + GAP);
    const g = ui.add.graphics();
    c.add(g);
    if (cl === 'locked') {
      card(g, sx, sy, SZ, SZ, 'locked', 12);
      g.fillStyle(0x8e8e93, 0.35).fillCircle(sx + SZ / 2, sy + SZ / 2, 3);
      return;
    }
    if (cl === 'empty') {
      card(g, sx, sy, SZ, SZ, 'muted', 12);
      return;
    }
    const on = invSel?.bag === cl.bag && invSel.id === cl.id;
    const draw = (hover: boolean) => {
      g.clear();
      card(g, sx, sy, SZ, SZ, on ? 'selected' : 'normal', 12);
      if (hover && !on) g.lineStyle(1.5, HEX.blue, 0.45).strokeRoundedRect(sx, sy, SZ, SZ, 12);
    };
    draw(false);
    c.add(ui.add.image(sx + SZ / 2, sy + SZ / 2 - 3, cl.icon).setScale(2));
    // quantity pill, bottom-right
    const q = ui.add.text(sx + SZ - 6, sy + SZ - 5, `${cl.qty}`, txt(10, C.secondary)).setOrigin(1, 1);
    const qg = ui.add.graphics();
    qg.fillStyle(0x767680, 0.14).fillRoundedRect(q.x - q.width - 4, q.y - q.height - 1, q.width + 8, q.height + 2, (q.height + 2) / 2);
    c.add([qg, q]);
    if (cl.bag === 'produce' && isBought(cl.id)) {
      const st = ui.add.text(sx + 6, sy + 5, 'beli', txt(8, C.secondary));
      const sg = ui.add.graphics();
      sg.fillStyle(0x767680, 0.16).fillRoundedRect(st.x - 3, st.y - 1, st.width + 6, st.height + 2, (st.height + 2) / 2);
      c.add([sg, st]);
    }
    if (cl.bag === 'produce' && starsOf(cl.id) > 1) {
      const st = ui.add.text(sx + 6, sy + 5, `★${starsOf(cl.id)}`, txt(9, '#a86f00'));
      const sg = ui.add.graphics();
      sg.fillStyle(0xffd60a, 0.3).fillRoundedRect(st.x - 3, st.y - 1, st.width + 6, st.height + 2, (st.height + 2) / 2);
      c.add([sg, st]);
    }
    if (cl.bag === 'seeds' && s.seed === cl.id) c.add(ui.add.circle(sx + SZ - 8, sy + 8, 3.5, HEX.blue)); // equipped in slot 3
    const z = ui.add.zone(sx, sy, SZ, SZ).setOrigin(0).setInteractive({ useHandCursor: true });
    z.on('pointerover', () => draw(true));
    z.on('pointerout', () => draw(false));
    z.on('pointerdown', (p: Phaser.Input.Pointer) => startDrag(cl, p));
    c.add(z);
  });
  // drag a slot onto another to move it there; a plain click just selects it
  const cellAt = (wx: number, wy: number) => {
    const col = Math.floor((wx - gx) / (SZ + GAP)), row = Math.floor((wy - gy) / (SZ + GAP));
    if (col < 0 || col >= COLS || row < 0 || (wx - gx) % (SZ + GAP) > SZ || (wy - gy) % (SZ + GAP) > SZ) return -1;
    const i = row * COLS + col;
    return i < cells.length ? i : -1;
  };
  const startDrag = (cl: Slot, p: Phaser.Input.Pointer) => {
    if (cl.bag === 'other') {
      play('click');
      invSel = { bag: cl.bag, id: cl.id };
      return openInventory(ui);
    }
    const cam = ui.cameras.main;
    const start = cam.getWorldPoint(p.x, p.y);
    let ghost: Phaser.GameObjects.Image | undefined;
    const move = (q: Phaser.Input.Pointer) => {
      const w = cam.getWorldPoint(q.x, q.y);
      if (!ghost && Math.hypot(w.x - start.x, w.y - start.y) < 6) return;
      ghost ??= ui.add.image(w.x, w.y, cl.icon).setScale(2.6).setAlpha(0.85).setDepth(10000);
      ghost.setPosition(w.x, w.y);
    };
    const up = (q: Phaser.Input.Pointer) => {
      ui.input.off('pointermove', move);
      ui.input.off('pointerup', up);
      const w = cam.getWorldPoint(q.x, q.y);
      const dragged = !!ghost;
      ghost?.destroy();
      invSel = { bag: cl.bag, id: cl.id };
      if (dragged) {
        const i = cellAt(w.x, w.y);
        if (i >= 0) {
          const t = cells[i];
          const to = typeof t === 'object' ? `${t.bag}:${t.id}` : undefined;
          if (t !== 'locked' && (typeof t !== 'object' || t.bag !== 'other')) {
            moveInBag(s, `${cl.bag}:${cl.id}`, to);
            save(s);
            play('plant');
          }
        }
      } else play('click');
      openInventory(ui);
    };
    ui.input.on('pointermove', move);
    ui.input.on('pointerup', up);
  };

  if (!items.length) {
    const gw = COLS * (SZ + GAP) - GAP;
    const m = ui.add.text(gx + gw / 2, gy + SZ + GAP / 2, tab.empty, txt(13, C.secondary, false)).setOrigin(0.5);
    const mg = ui.add.graphics();
    mg.fillStyle(0xffffff, 0.92).fillRoundedRect(m.x - m.width / 2 - 14, m.y - 15, m.width + 28, 30, 15);
    mg.lineStyle(1, HEX.hairline, 0.08).strokeRoundedRect(m.x - m.width / 2 - 14, m.y - 15, m.width + 28, 30, 15);
    c.add([mg, m]);
  }

  // right: detail card
  const dx = x + W - 250, dy = y + 98, dw = 222, dh = 284;
  const g = ui.add.graphics();
  card(g, dx, dy, dw, dh, 'normal', 18);
  c.add(g);
  const sel = invSel;
  if (!sel) {
    well(g, dx + dw / 2, dy + 92, 32, true);
    c.add(ui.add.image(dx + dw / 2, dy + 92, 'icon-tas').setScale(3).setAlpha(0.5));
    c.add(ui.add.text(dx + dw / 2, dy + 150, 'Pilih barang untuk\nmelihat detailnya', { ...txt(13, C.tertiary, false), align: 'center' }).setOrigin(0.5, 0));
  } else {
    const d = describe(ui, sel.bag, sel.id);
    well(g, dx + dw / 2, dy + 46, 32);
    c.add(ui.add.image(dx + dw / 2, dy + 46, d.icon).setScale(3.5));
    c.add(ui.add.text(dx + dw / 2, dy + 86, d.name, txt(16)).setOrigin(0.5, 0));
    // category chip
    const kind =
      sel.bag === 'other' ? 'Ternak'
      : sel.bag === 'seeds' ? (ITEMS.some((i) => i.id === sel.id) ? 'Alat' : 'Benih')
      : dishById(baseId(sel.id)) ? 'Masakan'
      : baseId(sel.id).startsWith('ikan') ? 'Ikan'
      : baseId(sel.id).startsWith('telur') ? 'Produk Ternak'
      : isOre(baseId(sel.id)) ? 'Hasil Tambang'
      : 'Hasil Panen';
    const chip = ui.add.text(dx + dw / 2, dy + 116, kind, txt(11, C.blue)).setOrigin(0.5);
    const cg = ui.add.graphics();
    cg.fillStyle(HEX.blueSoft, 1).fillRoundedRect(chip.x - chip.width / 2 - 10, chip.y - 10, chip.width + 20, 20, 10);
    c.add([cg, chip]);

    // label/value rows; lines without a colon become small notes
    const action = sel.bag === 'seeds' || (sel.bag === 'produce' && !!dishById(baseId(sel.id)));
    const bottom = dy + dh - (action ? 58 : 14);
    let ry = dy + 136;
    for (const line of d.lines) {
      if (ry > bottom - 18) break;
      const i = line.indexOf(':');
      if (i > 0) {
        if (ry > dy + 136) g.fillStyle(HEX.hairline, 0.07).fillRect(dx + 14, ry - 3, dw - 28, 1);
        c.add(ui.add.text(dx + 14, ry, line.slice(0, i), txt(12, C.secondary, false)));
        const v = ui.add.text(dx + dw - 14, ry, line.slice(i + 1).trim(), { ...txt(12, INK), align: 'right', wordWrap: { width: dw - 100 } }).setOrigin(1, 0);
        c.add(v);
        ry += Math.max(20, v.height + 4);
      } else {
        const n = ui.add.text(dx + 14, ry, line, { ...txt(11, C.tertiary, false), wordWrap: { width: dw - 28 } });
        c.add(n);
        ry += n.height + 4;
      }
    }

    const dish = sel.bag === 'produce' ? dishById(baseId(sel.id)) : undefined;
    if (dish) {
      ui.button(c, dx + 14, dy + dh - 48, `Makan (+${dish.stamina} tenaga)`, () => {
        const err = eat(s, dish.id);
        if (err) {
          play('error');
          return ui.toast(err);
        }
        play('plant');
        save(s);
        ui.toast(`Nyam! ${dish.name}, tenaga ${s.stamina}/${maxStamina(s)}.`);
        openInventory(ui);
      }, dw - 28, s.stamina >= maxStamina(s));
    }
    if (sel.bag === 'seeds') {
      const active = s.seed === sel.id;
      ui.button(c, dx + 14, dy + dh - 48, active ? 'Sedang dipakai' : 'Pakai (slot 3)', () => {
        s.seed = sel.id;
        s.tool = 'benih';
        save(s);
        ui.toast(`Slot 3: ${itemName(sel.id)}`);
        openInventory(ui);
      }, dw - 28, active);
    }
  }

  // footer: capsules for wallet and collection
  const value = Object.entries(s.produce).reduce((a, [id, q]) => a + produceById(id).sellPrice * q, 0);
  const t = s.festival.trophies;
  const caps = [
    { icon: 'ic-coin', text: `${s.coins.toLocaleString('id-ID')} G`, color: C.orange },
    { icon: '', text: `Nilai panen ${value.toLocaleString('id-ID')} G`, color: INK },
    { icon: '', text: `Poin Festival ${s.festival.points}`, color: C.purple },
    { icon: '', text: `Piala ${t.emas ?? 0} · ${t.perak ?? 0} · ${t.perunggu ?? 0}`, color: INK },
  ];
  const fy = y + 386;
  const objs = caps.map((cp) => ui.add.text(0, fy + 15, cp.text, txt(12, cp.color)).setOrigin(0, 0.5));
  const widths = caps.map((cp, i) => objs[i].width + 24 + (cp.icon ? 18 : 0));
  let fx = x + W / 2 - (widths.reduce((a, b) => a + b, 0) + 8 * (caps.length - 1)) / 2;
  const fg = ui.add.graphics();
  c.add(fg);
  caps.forEach((cp, i) => {
    fg.fillStyle(0x767680, 0.1).fillRoundedRect(fx, fy, widths[i], 30, 15);
    let tx = fx + 12;
    if (cp.icon) {
      c.add(ui.add.image(tx + 7, fy + 15, cp.icon).setScale(1));
      tx += 18;
    }
    objs[i].setX(tx);
    c.add(objs[i]);
    fx += widths[i] + 8;
  });

  const next = BAG_TIERS[s.bagTier + 1];
  const by = y + H - 52;
  if (next) {
    const blocked = s.level < next.level || s.coins < next.price;
    const label = s.level < next.level ? `${next.name} · butuh Level ${next.level}` : `Upgrade → ${next.slots} slot · ${next.price.toLocaleString('id-ID')} G`;
    ui.button(c, x + 24, by, label, () => {
      const err = upgradeBag(s);
      if (err) {
        play('error');
        return ui.toast(err);
      }
      play('quest');
      save(s);
      ui.toast(`${BAG_TIERS[s.bagTier].name}! Tas sekarang ${bagCapacity(s)} slot.`);
      openInventory(ui);
    }, 300, blocked);
  } else c.add(ui.add.text(x + 24, by + 10, 'Tas sudah ukuran maksimal.', txt(13, C.secondary, false)));
  ui.button(c, x + W - 144, by, 'Tutup', () => ui.closeModal(), 120);
}

/** Display info for an inventory entry. */
export function describe(ui: UIScene, bag: 'produce' | 'seeds' | 'other', id: string): { name: string; icon: string; lines: string[] } {
  const s = ui.state;
  if (bag === 'other') {
    if (id === 'ayam') {
      const lines = s.animals.length
        ? s.animals.map((a) => `${a.name}: ♥${a.affection}${a.fed ? ' · sudah makan' : ' · lapar'}`)
        : ['Belum punya ayam.'];
      return { name: 'Ayam', icon: 'icon-ayam', lines };
    }
    if (id === 'pakan') return { name: 'Pakan', icon: 'icon-pakan', lines: [`Punya ${s.feed}.`, '1 pakan per ayam per hari.', 'Beri di kandang.'] };
    const eggs = Object.entries(s.coopEggs).map(([e, q]) => `${produceById(e).name} ×${q}`);
    return { name: 'Telur di kandang', icon: 'icon-telur', lines: [...eggs, 'Ambil di kandang.'] };
  }
  if (bag === 'produce') {
    const p = produceById(id);
    const qty = s.produce[id] ?? 0;
    const lines = [`Jumlah: ${qty}`, `Jual: ${p.sellPrice} G / buah`, `Total: ${(p.sellPrice * qty).toLocaleString('id-ID')} G`];
    const dishInfo = dishById(id);
    if (dishInfo) lines.push(`Makan: +${dishInfo.stamina} tenaga`);
    const want = s.requests.filter((r) => wantsItem(r, baseId(id)));
    if (want.length) lines.push(`Diminta: ${want.map((r) => npcById(r.npc).name).join(', ')}`);
    if (isFestivalDay(s.day) && festivalTheme(s.day).id === baseId(id)) lines.push('Tema festival hari ini ×2!');
    if (starsOf(id) > 1) lines.splice(1, 0, `Kualitas: ${'★'.repeat(starsOf(id))}`);
    if (isBought(id)) lines.push('Asal: Warung · tidak bisa ikut festival');
    return { name: p.name, icon: `icon-${baseId(id)}`, lines };
  }
  const item = ITEMS.find((i) => i.id === id);
  if (item) return { name: item.name, icon: `icon-${id}`, lines: [`Jumlah: ${s.seeds[id] ?? 0}`, `${item.desc[0].toUpperCase()}${item.desc.slice(1)}.`] };
  const crop = cropById(id);
  const inSeason = crop.seasons.includes(seasonOf(s.day));
  return {
    name: `Benih ${crop.name}`,
    icon: seedIcon(id),
    lines: [
      `Jumlah: ${s.seeds[id] ?? 0}`,
      crop.allSeasons ? 'Musim: semua musim' : `Musim: ${crop.seasons.join(', ')}${inSeason ? '' : ' (bukan musimnya!)'}`,
      crop.regrow ? `Panen pertama ${crop.days} hari, lalu tiap ${crop.regrow} hari` : `Panen setelah ${crop.days} hari disiram`,
      `Hasil dijual ${crop.sellPrice} G`,
    ],
  };
}

let gearSel: string | undefined;
const WEAR_NAMES: Record<Wear, string> = { topi: 'Caping Bambu', baju: 'Kemeja Biru', celana: 'Celana Kerja', sepatu: 'Sepatu Bot' };

/** Perlengkapan: tools and outfit pieces, worn ones on top, the ones taken off below. Tap one to wear or remove it. */
function drawGear(ui: UIScene, c: Phaser.GameObjects.Container, x: number, y: number, W: number, H: number) {
  const s = ui.state;
  type Gear = { key: string; name: string; icon: string; sub: string };
  const all: Gear[] = [
    ...WEARS.map((w) => ({ key: `wear:${w}`, name: WEAR_NAMES[w], icon: `wear-${w}`, sub: 'Kostum' })),
    ...TOOLS.filter((t) => !needsPurchase(t.id) || s.ownedTools.includes(t.id)).map((t) => {
      const tier = tierOf(s, t.id);
      return { key: `tool:${t.id}`, name: t.name, icon: `tool-${t.id}`, sub: tier ? `Alat · ${TOOL_TIERS[tier]}` : 'Alat' };
    }),
  ];
  const worn = all.filter((g) => isWorn(s, g.key));
  const off = all.filter((g) => !isWorn(s, g.key));
  if (!gearSel || !all.some((g) => g.key === gearSel)) gearSel = all[0]?.key;

  const SZ = 50, GAP = 8, COLS = 6;
  const gx = x + 28;
  let gy = y + 98;
  const section = (title: string, list: Gear[], empty: string) => {
    c.add(ui.add.text(gx, gy, title, txt(11, C.tertiary)));
    gy += 20;
    if (!list.length) {
      c.add(ui.add.text(gx, gy + 6, empty, txt(12, C.tertiary, false)));
      gy += 40;
      return;
    }
    list.forEach((it, i) => {
      const sx = gx + (i % COLS) * (SZ + GAP);
      const sy = gy + Math.floor(i / COLS) * (SZ + GAP);
      const g = ui.add.graphics();
      const sel = it.key === gearSel;
      card(g, sx, sy, SZ, SZ, sel ? 'selected' : 'muted', 12);
      if (sel) g.lineStyle(2, HEX.blue, 1).strokeRoundedRect(sx, sy, SZ, SZ, 12);
      c.add(g);
      c.add(ui.add.image(sx + SZ / 2, sy + SZ / 2, it.icon).setScale(it.key.startsWith('wear') ? 3 : 2.2));
      if (it.key === `tool:${s.tool}`) c.add(ui.add.text(sx + SZ - 5, sy + 3, '●', txt(9, C.blue)).setOrigin(1, 0));
      const z = ui.add.zone(sx, sy, SZ, SZ).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => {
        play('click');
        gearSel = it.key;
        openInventory(ui);
      });
      c.add(z);
    });
    gy += Math.ceil(list.length / COLS) * (SZ + GAP) + 14;
  };
  section('DIPAKAI', worn, 'Tidak ada yang dipakai');
  section('DI TAS', off, 'Belum ada yang dicopot. Pilih alat atau kostum lalu tekan Copot.');
  c.add(ui.add.text(gx, y + H - 92, 'Alat & kostum tidak memakai slot tas.', txt(11, C.tertiary, false)));

  // detail card with the wear / remove button
  const dx = x + W - 250, dy = y + 98, dw = 222, dh = 284;
  const g = ui.add.graphics();
  card(g, dx, dy, dw, dh, 'normal', 18);
  c.add(g);
  const it = all.find((a) => a.key === gearSel);
  if (it) {
    const on = isWorn(s, it.key);
    well(g, dx + dw / 2, dy + 52, 34, !on);
    const im = ui.add.image(dx + dw / 2, dy + 52, it.icon).setScale(it.key.startsWith('wear') ? 4.5 : 3.4);
    if (!on) im.setAlpha(0.6);
    c.add(im);
    c.add(ui.add.text(dx + dw / 2, dy + 96, it.name, txt(16)).setOrigin(0.5, 0));
    c.add(ui.add.text(dx + dw / 2, dy + 120, `${it.sub} · ${on ? 'dipakai' : 'di tas'}`, txt(12, on ? C.green : C.secondary, false)).setOrigin(0.5, 0));
    const note = !canUnequip(it.key)
      ? 'Tangan tidak bisa dicopot.'
      : on
        ? it.key.startsWith('tool') ? 'Dicopot: alat tidak bisa dipakai sampai dipasang lagi.' : 'Dicopot: tampilan karakter ikut berubah.'
        : 'Pasang lagi untuk memakainya.';
    c.add(ui.add.text(dx + 16, dy + 150, note, { ...txt(11, C.tertiary, false), wordWrap: { width: dw - 32 }, align: 'center' }).setOrigin(0, 0).setFixedSize(dw - 32, 0));
    ui.button(c, dx + 14, dy + dh - 48, on ? 'Copot' : 'Pasang', () => {
      play('click');
      toggleEquip(s, it.key);
      save(s);
      ui.game.events.emit('hud');
      openInventory(ui);
    }, dw - 28, !canUnequip(it.key), on);
  }
  ui.button(c, x + W - 144, y + H - 52, 'Tutup', () => ui.closeModal(), 120);
}
