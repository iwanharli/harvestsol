import { XP, npcById, produceById, seedIcon } from '../../data';
import { play } from '../../sfx';
import { C, HEX, card, txt } from '../theme';
import { checkStaminaRewards, countFor, deliverRequest, gainXp, reqItems, requestReady, save, type RequestKind } from '../../state';
import type { UIScene } from '../../scenes/UIScene';

const INK = C.ink;

const KIND: Record<RequestKind, { label: string; color: string; fill: number }> = {
  biasa: { label: 'Biasa', color: C.secondary, fill: 0x767680 },
  paket: { label: 'Paket', color: C.blue, fill: HEX.blue },
  kualitas: { label: 'Kualitas', color: '#a86f00', fill: 0xffd60a },
  kilat: { label: 'Kilat!', color: C.red, fill: HEX.red },
};

/** Villagers' requests: random, some bundle several items, need top quality, or are due tomorrow. */
export function openBoard(ui: UIScene) {
  const s = ui.state;
  const W = 640, cardH = 92, gap = 8;
  const H = 128 + Math.max(1, s.requests.length) * (cardH + gap);
  const { c, x, y } = ui.openModal(W, H, 'Papan Permintaan Warga');
  if (!s.requests.length) {
    c.add(ui.add.text(x + W / 2, y + 84, 'Papan kosong hari ini. Warga belum butuh apa-apa.\nCek lagi besok pagi.', { ...txt(14, C.secondary, false), align: 'center' }).setOrigin(0.5, 0));
  }
  s.requests.forEach((r, i) => {
    const cx = x + 24, cy = y + 60 + i * (cardH + gap), cw = W - 48;
    const npc = npcById(r.npc);
    const kind = KIND[r.kind ?? 'biasa'];
    const ok = requestReady(s, r);
    const left = r.until - s.day + 1;
    const g = ui.add.graphics();
    card(g, cx, cy, cw, cardH, ok ? 'ready' : 'normal', 16);
    c.add(g);

    // header: name, kind pill, hearts
    const name = ui.add.text(cx + 16, cy + 10, npc.name, txt(14));
    c.add(name);
    const pill = ui.add.text(name.x + name.width + 16, cy + 12, kind.label, txt(10, kind.color));
    g.fillStyle(kind.fill, 0.16).fillRoundedRect(pill.x - 7, pill.y - 2, pill.width + 14, pill.height + 4, (pill.height + 4) / 2);
    c.add(pill);
    const fr = Math.min(5, s.friendship[r.npc] ?? 0);
    c.add(ui.add.text(pill.x + pill.width + 14, cy + 11, '♥'.repeat(fr) + '♡'.repeat(5 - fr), txt(11, C.red)));
    c.add(ui.add.text(cx + 16, cy + 30, `“${r.note ?? npc.role}”`, txt(11, C.tertiary, false)));

    // wanted items as chips: icon, have/need, quality requirement
    let ix = cx + 16;
    for (const it of reqItems(r)) {
      const have = countFor(s, it);
      const met = have >= it.qty;
      const label = `${Math.min(have, it.qty)}/${it.qty}${it.minStars > 1 ? ` ★${it.minStars}+` : ''}`;
      const t = ui.add.text(0, cy + 66, label, txt(11, met ? C.green : INK)).setOrigin(0, 0.5);
      const w = 34 + t.width + 10;
      g.fillStyle(met ? HEX.green : 0x767680, met ? 0.14 : 0.1).fillRoundedRect(ix, cy + 52, w, 28, 14);
      c.add(ui.add.image(ix + 17, cy + 66, `icon-${it.id}`).setScale(1.4));
      t.setX(ix + 32);
      c.add(t);
      const hit = ui.add.zone(ix, cy + 52, w, 28).setOrigin(0).setInteractive();
      hit.on('pointerdown', () => ui.toast(`${produceById(it.id).name}${it.minStars >= 1 ? ' · hasil sendiri' : ''}${it.minStars > 1 ? `, minimal ★${it.minStars}` : ''}`));
      c.add(hit);
      ix += w + 6;
    }

    // right: reward, deadline, button
    const rx = cx + cw - 16;
    const rw = ui.add.text(rx, cy + 10, `${r.reward.toLocaleString('id-ID')} G`, txt(14, C.orange)).setOrigin(1, 0);
    c.add(rw);
    if (r.bonusSeeds) {
      const b = ui.add.text(rw.x - rw.width - 8, cy + 12, `+${r.bonusSeeds.qty}`, txt(11, C.green)).setOrigin(1, 0);
      c.add([b, ui.add.image(b.x - b.width - 10, cy + 19, seedIcon(r.bonusSeeds.id)).setScale(1.2)]);
    }
    c.add(ui.add.text(rx, cy + 30, left <= 1 ? 'hari ini terakhir' : left === 2 ? 'sampai besok' : `sisa ${left} hari`, txt(11, left <= 1 ? C.red : C.secondary, false)).setOrigin(1, 0));
    ui.button(c, rx - 226, cy + 48, r.marked ? '★ Ditandai' : '☆ Tandai', () => {
      r.marked = !r.marked;
      play('click');
      save(s);
      ui.refresh();
      openBoard(ui);
    }, 100, false, true);
    ui.button(c, rx - 120, cy + 48, ok ? 'Serahkan' : 'Belum cukup', () => {
      const err = deliverRequest(s, r.id);
      if (err) {
        play('error');
        return ui.toast(err);
      }
      play('quest');
      const reached = gainXp(s, XP.request);
      const rewards = checkStaminaRewards(s);
      save(s);
      ui.toast(rewards[0] ?? `${npc.name} senang! +${r.reward} G${r.bonusSeeds ? ' + benih' : ''} · +${XP.request} XP`);
      openBoard(ui);
      if (reached.length) ui.queueLevelUp(reached);
    }, 120, !ok);
  });
  c.add(ui.add.text(x + 24, y + H - 40, 'Muncul acak tiap pagi · Paket/Kualitas/Kilat hanya terima hasil sendiri', txt(11, C.tertiary, false)));
  ui.button(c, x + W - 144, y + H - 50, 'Tutup', () => ui.closeModal(), 120);
}
