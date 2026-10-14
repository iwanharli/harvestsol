import {
  BAG_TIERS,
  BUYABLE_TOOLS,
  CHICKEN_PRICE,
  FEATURE_LEVEL,
  FEED_PRICE,
  ITEMS,
  MAX_CHICKENS,
  TOOLS,
} from '../../data';
import { play } from '../../sfx';
import { C, card, segmented, txt, well } from '../theme';
import { add, bagCapacity, canAdd, save, seasonOf, shopStock } from '../../state';
import type { UIScene } from '../../scenes/UIScene';

const INK = C.ink;

type ShopTab = 'benih' | 'alat' | 'ternak';

let shopTab: ShopTab = 'benih';

export function openShop(ui: UIScene) {
  const s = ui.state;
  type Entry = { id: string; name: string; price: number; level: number; info: string; owned: () => string; buy: (n: number) => string | null; unique?: () => boolean };
  const bag = (id: string) => (n: number) => {
    if (!canAdd(s, 'seeds', id, n)) return 'Tas penuh! Upgrade tas atau kosongkan slot.';
    add(s.seeds, id, n);
    if (!s.seeds[s.seed]) s.seed = id;
    return null;
  };
  const tabs: { id: ShopTab; name: string; items: Entry[] }[] = [
    {
      id: 'benih',
      name: 'Benih',
      items: shopStock(s).map((d) => ({
        id: d.id, name: d.name, price: d.seedPrice, level: d.level,
        info: d.regrow ? `${d.days} hari, lalu tiap ${d.regrow} hari` : `${d.days} hari · jual ${d.sellPrice}`,
        owned: () => `${s.seeds[d.id] ?? 0}`,
        buy: bag(d.id),
      })),
    },
    {
      id: 'alat',
      name: 'Peralatan',
      items: [
        ...(() => {
          const next = BAG_TIERS[s.bagTier + 1];
          const top = BAG_TIERS[s.bagTier];
          return [
            {
              id: 'tas',
              name: next ? next.name : top.name,
              price: next ? next.price : 0,
              level: next ? next.level : 1,
              info: next ? `tas ${top.slots} → ${next.slots} slot` : `${top.slots} slot (maksimal)`,
              owned: () => '',
              unique: () => !BAG_TIERS[s.bagTier + 1],
              buy: () => {
                if (!BAG_TIERS[s.bagTier + 1]) return 'Tas sudah paling besar.';
                s.bagTier++;
                ui.toast(`Tas sekarang ${bagCapacity(s)} slot!`);
                return null;
              },
            },
          ];
        })(),
        ...BUYABLE_TOOLS.map((t) => ({
          id: t.id, name: t.name, price: t.price, level: t.level, info: t.desc,
          owned: () => '',
          unique: () => s.ownedTools.includes(t.id),
          buy: () => {
            if (s.ownedTools.includes(t.id)) return `Kamu sudah punya ${t.name}.`;
            s.ownedTools.push(t.id);
            ui.toast(`${t.name} terpasang di slot ${TOOLS.findIndex((x) => x.id === t.id) + 1}.`);
            return null;
          },
        })),
        ...ITEMS.map((i) => ({
          id: i.id, name: i.name, price: i.price, level: i.level, info: i.desc,
          owned: () => `${s.seeds[i.id] ?? 0}`,
          buy: bag(i.id),
        })),
      ],
    },
    {
      id: 'ternak',
      name: 'Ternak',
      items: [
        {
          id: 'ayam', name: 'Ayam', price: CHICKEN_PRICE, level: FEATURE_LEVEL.coop, info: 'bertelur tiap hari',
          owned: () => `${s.animals.length}/${MAX_CHICKENS}`,
          buy: (n) => {
            if (s.animals.length + n > MAX_CHICKENS) return `Kandang muat ${MAX_CHICKENS} ayam.`;
            for (let i = 0; i < n; i++) {
              const id = s.nextAnimalId++;
              s.animals.push({ id, name: `Ayam ${id}`, affection: 0, fed: false, petted: false });
            }
            ui.game.events.emit('animals-changed');
            return null;
          },
        },
        {
          id: 'pakan', name: 'Pakan', price: FEED_PRICE, level: FEATURE_LEVEL.coop, info: '1 per ayam per hari',
          owned: () => `${s.feed}`,
          buy: (n) => {
            s.feed += n;
            return null;
          },
        },
      ],
    },
  ];
  const tab = tabs.find((t) => t.id === shopTab)!;

  // App Store-style list: two columns of horizontal cards, as many rows as needed
  const items = [...tab.items].sort((p, q) => Number(p.level > s.level) - Number(q.level > s.level)); // locked last
  const COLS = 2, cw = 280, ch = 94, gap = 10;
  const rows = Math.max(1, Math.ceil(items.length / COLS));
  const W = 620, H = 108 + rows * (ch + gap) + 58;
  const { c, x, y } = ui.openModal(W, H, `Toko · musim ${seasonOf(s.day)}`);
  const coin = ui.add.text(x + W - 28, y + 24, '', txt(16, C.orange)).setOrigin(1, 0);
  c.add(coin);

  // tabs
  c.add(
    segmented(ui, x + 28, y + 56, tabs.map((t) => t.name), tabs.findIndex((t) => t.id === shopTab), (i) => {
      play('click');
      shopTab = tabs[i].id;
      openShop(ui);
    }, 124),
  );

  const gx = x + (W - (COLS * cw + gap)) / 2;
  const refresh: (() => void)[] = [() => coin.setText(`${s.coins.toLocaleString('id-ID')} G`), () => ui.refresh()];
  if (!items.length) c.add(ui.add.text(x + W / 2, y + 150, 'Tidak ada barang untuk musim ini.', txt(14, C.secondary, false)).setOrigin(0.5));
  items.forEach((it, i) => {
    const cx = gx + (i % COLS) * (cw + gap);
    const cy = y + 104 + Math.floor(i / COLS) * (ch + gap);
    const locked = it.level > s.level;
    const g = ui.add.graphics();
    card(g, cx, cy, cw, ch, locked ? 'locked' : 'normal', 16);
    well(g, cx + 40, cy + ch / 2, 26, locked);
    c.add(g);
    const icon = ui.add.image(cx + 40, cy + ch / 2, `icon-${it.id}`).setScale(2.5);
    if (locked) icon.setTint(0x9a9aa0).setAlpha(0.5);
    c.add(icon);
    const tx = cx + 78;
    const textW = cw - 78 - 92; // room left of the buttons
    c.add(ui.add.text(tx, cy + 10, it.name, txt(15, locked ? C.disabled : INK)));
    c.add(ui.add.text(tx, cy + 31, it.info, { ...txt(11, C.secondary, false), wordWrap: { width: textW, useAdvancedWrap: true } }));
    const price = ui.add.text(tx, cy + ch - 24, '', txt(13, locked ? C.disabled : C.orange));
    c.add(price);
    refresh.push(() => price.setText(it.owned() ? `${it.price.toLocaleString('id-ID')} G · punya ${it.owned()}` : `${it.price.toLocaleString('id-ID')} G`));

    const bx = cx + cw - 76;
    if (locked) {
      const lt = ui.add.text(bx + 34, cy + ch / 2, `Level ${it.level}`, txt(12, C.secondary)).setOrigin(0.5);
      const lg = ui.add.graphics();
      lg.fillStyle(0x767680, 0.12).fillRoundedRect(bx - 2, cy + ch / 2 - 15, 72, 30, 15);
      c.add([lg, lt]);
      const z = ui.add.zone(cx, cy, cw, ch).setOrigin(0).setInteractive();
      z.on('pointerdown', () => {
        play('error');
        ui.toast(`${it.name} terbuka di Level ${it.level}.`);
      });
      c.add(z);
      return;
    }
    // +1 / +5 stacked on the right (one "Beli" for one-off items)
    const buttons: [number, number][] = it.unique ? [[1, cy + ch / 2 - 17]] : [[1, cy + 9], [5, cy + ch - 43]];
    for (const [n, by] of buttons) {
      const have = it.unique?.() ?? false;
      const label = it.unique ? (have ? 'Punya' : 'Beli') : `+${n}`;
      ui.button(c, bx, by, label, () => {
        const cost = it.price * n;
        if (s.coins < cost) {
          play('error');
          return ui.toast(`Uang tidak cukup (butuh ${cost.toLocaleString('id-ID')} G).`);
        }
        const err = it.buy(n);
        if (err) {
          play('error');
          return ui.toast(err);
        }
        s.coins -= cost;
        play('coin');
        save(s);
        refresh.forEach((f) => f());
        if (it.unique) openShop(ui); // redraw the card as owned
      }, 66, have);
    }
  });
  refresh.forEach((f) => f());
  ui.button(c, x + W / 2 - 60, y + H - 48, 'Tutup', () => ui.closeModal(), 120);
}
