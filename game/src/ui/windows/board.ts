import { XP, cropById, npcById } from '../../data';
import { play } from '../../sfx';
import { C, card, txt, well } from '../theme';
import { countBase, deliverRequest, gainXp, save } from '../../state';
import type { UIScene } from '../../scenes/UIScene';

const INK = C.ink;

export function openBoard(ui: UIScene) {
  const s = ui.state;
  const cardH = 74;
  const h = 120 + Math.max(1, s.requests.length) * (cardH + 10);
  const { c, x, y } = ui.openModal(600, h, 'Papan Permintaan Warga');
  if (!s.requests.length) {
    c.add(ui.add.text(x + 300, y + 74, 'Belum ada permintaan. Cek lagi besok pagi.', txt(15, INK, false)).setOrigin(0.5, 0));
  }
  s.requests.forEach((r, i) => {
    const cy = y + 60 + i * (cardH + 10);
    const npc = npcById(r.npc);
    const crop = cropById(r.crop);
    const have = countBase(s, r.crop);
    const ok = have >= r.qty;
    const left = r.until - s.day + 1;
    const g = ui.add.graphics();
    card(g, x + 24, cy, 552, cardH, ok ? 'ready' : 'normal', 16);
    well(g, x + 58, cy + 37, 24);
    c.add(g);
    c.add(ui.add.image(x + 58, cy + 37, `icon-${crop.id}`).setScale(2.5));
    const hearts = '♥'.repeat(Math.min(5, s.friendship[r.npc] ?? 0)) + '♡'.repeat(Math.max(0, 5 - (s.friendship[r.npc] ?? 0)));
    c.add(ui.add.text(x + 92, cy + 8, `${npc.name}`, txt(16)));
    c.add(ui.add.text(x + 92 + npc.name.length * 9 + 10, cy + 10, hearts, txt(13, C.red)));
    c.add(ui.add.text(x + 92, cy + 30, `Butuh ${r.qty} ${crop.name} (punya ${have})`, txt(14, INK, false)));
    c.add(ui.add.text(x + 92, cy + 50, `Hadiah ${r.reward} G · sisa ${left} hari · ${npc.role}`, txt(12, C.secondary, false)));
    ui.button(c, x + 440, cy + 20, ok ? 'Serahkan' : 'Belum cukup', () => {
      if (!deliverRequest(s, r.id)) {
        play('error');
        return ui.toast(`Kurang ${r.qty - countBase(s, r.crop)} ${crop.name}.`);
      }
      play('quest');
      const reached = gainXp(s, XP.request);
      save(s);
      ui.toast(`${npc.name} senang! +${r.reward} G · +${XP.request} XP`);
      openBoard(ui);
      if (reached.length) ui.queueLevelUp(reached);
    }, 120, !ok);
  });
  ui.button(c, x + 240, y + h - 50, 'Tutup', () => ui.closeModal(), 120);
}
