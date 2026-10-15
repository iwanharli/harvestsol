import { MARKET_ITEMS, produceById } from '../../data';
import { play } from '../../sfx';
import { add, countBase, roomFor, save } from '../../state';
import { C, HEX, card, txt, well } from '../theme';
import type { UIScene } from '../../scenes/UIScene';

/** The ingredient being looked at and how many to buy (kept between redraws). */
let sel = MARKET_ITEMS[0].id;
let qty = 1;

/** Bu Ratu Atit's Warung Bahan: pick an ingredient on the left, choose an amount and buy on the right. */
export function openMarket(ui: UIScene) {
  const s = ui.state;
  const W = 720, H = 440;
  const { c, x, y } = ui.openModal(W, H, 'Warung Bahan Bu Ratu Atit', 'market');
  c.add(ui.add.text(x + W - 28, y + 24, `${s.coins.toLocaleString('id-ID')} G`, txt(16, C.orange)).setOrigin(1, 0));
  c.add(ui.add.text(x + W / 2, y + 52, 'Kualitas standar ★1 · harga sudah termasuk "biaya keluarga"', txt(12, C.secondary, false)).setOrigin(0.5, 0));

  const redraw = () => openMarket(ui);
  const item = MARKET_ITEMS.find((m) => m.id === sel) ?? MARKET_ITEMS[0];

  // ---- left: ingredient tiles ----
  const COLS = 4, tw = 92, th = 92, gap = 8;
  const gx = x + 24, gy = y + 84;
  MARKET_ITEMS.forEach((it, i) => {
    const tx = gx + (i % COLS) * (tw + gap);
    const ty = gy + Math.floor(i / COLS) * (th + gap);
    const on = it.id === item.id;
    const g = ui.add.graphics();
    const draw = (hover: boolean) => {
      g.clear();
      card(g, tx, ty, tw, th, on ? 'selected' : 'normal', 14);
      if (hover && !on) g.lineStyle(1.5, HEX.blue, 0.45).strokeRoundedRect(tx, ty, tw, th, 14);
    };
    draw(false);
    c.add(g);
    c.add(ui.add.image(tx + tw / 2, ty + 30, `icon-${it.id}`).setScale(2.5));
    const name = ui.add.text(tx + tw / 2, ty + 56, produceById(it.id).name, txt(12)).setOrigin(0.5, 0);
    if (name.width > tw - 10) name.setScale((tw - 10) / name.width);
    c.add(name);
    c.add(ui.add.text(tx + tw / 2, ty + 73, `${it.price} G`, txt(11, C.orange)).setOrigin(0.5, 0));
    const z = ui.add.zone(tx, ty, tw, th).setOrigin(0).setInteractive({ useHandCursor: true });
    z.on('pointerover', () => draw(true));
    z.on('pointerout', () => draw(false));
    z.on('pointerdown', () => {
      play('click');
      if (sel !== it.id) qty = 1;
      sel = it.id;
      redraw();
    });
    c.add(z);
  });

  // ---- right: detail and purchase ----
  const px = gx + COLS * (tw + gap) + 8, py = gy, pw = x + W - 24 - px, ph = 3 * (th + gap) - gap;
  const g = ui.add.graphics();
  card(g, px, py, pw, ph, 'normal', 18);
  well(g, px + pw / 2, py + 42, 30);
  c.add(g);
  c.add(ui.add.image(px + pw / 2, py + 42, `icon-${item.id}`).setScale(3));
  c.add(ui.add.text(px + pw / 2, py + 78, produceById(item.id).name, txt(16)).setOrigin(0.5, 0));
  const chip = ui.add.text(px + pw / 2, py + 108, 'Standar ★1', txt(11, C.blue)).setOrigin(0.5);
  const cg = ui.add.graphics();
  cg.fillStyle(HEX.blueSoft, 1).fillRoundedRect(chip.x - chip.width / 2 - 10, chip.y - 10, chip.width + 20, 20, 10);
  c.add([cg, chip]);

  // how many can be bought: limited by money and bag space
  const most = Math.max(0, Math.min(Math.floor(s.coins / item.price), roomFor(s, 'produce', item.id), 99));
  qty = Math.max(1, Math.min(qty, Math.max(1, most)));
  const rows: [string, string][] = [
    ['Di tas', `${countBase(s, item.id)}`],
    ['Harga satuan', `${item.price} G`],
  ];
  rows.forEach(([l, v], i) => {
    const ry = py + 126 + i * 20;
    c.add(ui.add.text(px + 16, ry, l, txt(12, C.secondary, false)));
    c.add(ui.add.text(px + pw - 16, ry, v, txt(12)).setOrigin(1, 0));
  });

  // stepper: − qty +, with ±10 and Maks
  const sy = py + 170;
  const step = (label: string, delta: number, bx: number, w = 34) => {
    const blocked = delta > 0 ? qty >= most : qty <= 1;
    ui.button(c, bx, sy, label, () => {
      if (blocked) return;
      qty = Math.max(1, Math.min(most, qty + delta));
      redraw();
    }, w, blocked, true);
  };
  step('−10', -10, px + 14);
  step('−1', -1, px + 52);
  c.add(ui.add.text(px + pw / 2, sy + 17, `${qty}`, txt(18, C.blue)).setOrigin(0.5));
  step('+1', 1, px + pw - 86);
  step('+10', 10, px + pw - 48);

  const total = item.price * qty;
  const can = most >= 1;
  const reason = s.coins < item.price ? 'Uang tidak cukup' : roomFor(s, 'produce', item.id) < 1 ? 'Tas penuh' : '';
  ui.button(c, px + 14, sy + 42, can ? `Beli ${qty} · ${total.toLocaleString('id-ID')} G` : reason, () => {
    if (!can) {
      play('error');
      return ui.toast(reason);
    }
    s.coins -= total;
    add(s.produce, item.id, qty);
    play('coin');
    save(s);
    ui.refresh();
    ui.toast(`Beli ${qty} ${produceById(item.id).name}.`);
    redraw();
  }, pw - 28, !can);
  ui.button(c, px + 14, sy + 82, 'Maks', () => ((qty = Math.max(1, most)), redraw()), pw - 28, qty >= most, true);

  ui.button(c, x + W / 2 - 60, y + H - 48, 'Tutup', () => ui.closeModal(), 120);
}
