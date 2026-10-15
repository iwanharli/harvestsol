import {
  baseId,
  FESTIVAL_MAX_ITEMS,
  FESTIVAL_THEME_MULT,
  FESTIVAL_VARIETY_BONUS,
  isBought,
} from '../../data';
import { play } from '../../sfx';
import { C, card, txt } from '../theme';
import { enterFestival, festivalScore, festivalTheme, type FestivalResult, save } from '../../state';
import type { UIScene } from '../../scenes/UIScene';

const INK = C.ink;

let festivalPick: string[] = [];

export function openFestival(ui: UIScene) {
  const s = ui.state;
  const theme = festivalTheme(s.day);
  const W = 600, H = 400;
  const { c, x, y } = ui.openModal(W, H, `Festival Panen · tema ${theme.name} ×${FESTIVAL_THEME_MULT}`);
  // keep the selection valid against what is actually in the bag
  const left = { ...s.produce };
  festivalPick = festivalPick.filter((id) => (left[id] ?? 0) > 0 && (left[id]--, true));

  c.add(ui.add.text(x + W / 2, y + 54, `Maks ${FESTIVAL_MAX_ITEMS} barang · ${theme.name} ×${FESTIVAL_THEME_MULT} · +${FESTIVAL_VARIETY_BONUS} per jenis · barang dikembalikan`, txt(12, C.secondary, false)).setOrigin(0.5, 0));

  // entry slots
  for (let i = 0; i < FESTIVAL_MAX_ITEMS; i++) {
    const sx = x + W / 2 - (FESTIVAL_MAX_ITEMS * 64 - 10) / 2 + i * 64;
    const sy = y + 84;
    const g = ui.add.graphics();
    card(g, sx, sy, 54, 54, festivalPick[i] ? 'normal' : 'muted', 14);
    c.add(g);
    const id = festivalPick[i];
    if (!id) continue;
    c.add(ui.add.image(sx + 27, sy + 27, `icon-${baseId(id)}`).setScale(2.5));
    const sb = ui.starBadge(sx + 3, sy + 2, id, 10);
    if (sb) c.add(sb);
    if (baseId(id) === theme.id) c.add(ui.add.text(sx + 50, sy + 4, '×2', txt(11, C.red)).setOrigin(1, 0));
    const z = ui.add.zone(sx, sy, 54, 54).setOrigin(0).setInteractive({ useHandCursor: true });
    z.on('pointerdown', () => {
      play('click');
      festivalPick.splice(i, 1);
      openFestival(ui);
    });
    c.add(z);
  }
  const score = festivalScore(festivalPick, theme.id);
  c.add(ui.add.text(x + W / 2, y + 150, `Skor kamu: ${score}`, txt(18, C.purple)).setOrigin(0.5, 0));

  // produce to choose from
  c.add(ui.add.text(x + 32, y + 184, 'Tas kamu (klik untuk menambah):', txt(13)));
  // only your own harvest can compete: items bought at the warung are left out
  const avail = Object.entries(s.produce)
    .filter(([id]) => !isBought(id))
    .map(([id, q]) => [id, q - festivalPick.filter((p) => p === id).length] as const)
    .filter(([, q]) => q > 0);
  if (Object.keys(s.produce).some(isBought))
    c.add(ui.add.text(x + W - 32, y + 184, 'Bahan dari warung tidak bisa ikut lomba', txt(11, C.tertiary, false)).setOrigin(1, 0));
  if (!avail.length && !festivalPick.length)
    c.add(ui.add.text(x + W / 2, y + 240, 'Belum ada hasil panen. Panen dulu, lalu kembali sebelum 18:00.', txt(14, INK, false)).setOrigin(0.5, 0));
  avail.forEach(([id, q], i) => {
    const cx = x + 32 + (i % 8) * 68;
    const cy = y + 206 + Math.floor(i / 8) * 64;
    const g = ui.add.graphics();
    card(g, cx, cy, 60, 56, baseId(id) === theme.id ? 'today' : 'normal', 14);
    c.add(g);
    c.add(ui.add.image(cx + 30, cy + 24, `icon-${baseId(id)}`).setScale(2.5));
    const cb = ui.starBadge(cx + 4, cy + 3, id, 10);
    if (cb) c.add(cb);
    c.add(ui.add.text(cx + 56, cy + 52, `${q}`, txt(12)).setOrigin(1, 1));
    const z = ui.add.zone(cx, cy, 60, 56).setOrigin(0).setInteractive({ useHandCursor: true });
    z.on('pointerdown', () => {
      if (festivalPick.length >= FESTIVAL_MAX_ITEMS) {
        play('error');
        return ui.toast(`Maksimal ${FESTIVAL_MAX_ITEMS} barang.`);
      }
      play('click');
      festivalPick.push(id);
      openFestival(ui);
    });
    c.add(z);
  });

  const ready = festivalPick.length > 0;
  ui.button(c, x + W / 2 - 130, y + H - 52, 'Ikut Lomba', () => {
    if (!ready) {
      play('error');
      return ui.toast('Pilih minimal 1 hasil panen.');
    }
    const result = enterFestival(s, festivalPick);
    festivalPick = [];
    save(s);
    showFestivalResult(ui, result);
  }, 130, !ready);
  ui.button(c, x + W / 2 + 10, y + H - 52, 'Nanti', () => ui.closeModal(), 120);
}

export function showFestivalResult(ui: UIScene, r: FestivalResult) {
  const s = ui.state;
  const title = r.place === 0 ? 'Juara 1! 🏆' : r.place < 3 ? `Juara ${r.place + 1}!` : `Peringkat ${r.place + 1}`;
  const h = 210 + r.ranking.length * 24 + 60;
  const { c, x, y } = ui.openModal(420, h, title);
  play(r.place < 3 ? 'quest' : 'click');
  r.ranking.forEach((e, i) => {
    const ry = y + 60 + i * 24;
    const col = e.you ? C.purple : INK;
    c.add(ui.add.text(x + 60, ry, `${i + 1}. ${e.name}`, txt(15, col, e.you)));
    c.add(ui.add.text(x + 360, ry, `${e.score}`, txt(15, col, e.you)).setOrigin(1, 0));
  });
  const rewards = [
    r.reward.coins ? `+${r.reward.coins + r.bonusCoins} G${r.bonusCoins ? ' (Lemari Piala)' : ''}` : '',
    `+${r.reward.xp} XP`,
    r.reward.points ? `+${r.reward.points} Poin Festival` : '',
    r.reward.trophy ? `Piala ${r.reward.trophy}` : '',
  ].filter(Boolean);
  const ry = y + 60 + r.ranking.length * 24 + 14;
  c.add(ui.add.text(x + 210, ry, rewards.join(' · '), txt(15, C.orange)).setOrigin(0.5, 0));
  c.add(ui.add.text(x + 210, ry + 26, `Total Poin Festival: ${s.festival.points}`, txt(13, C.secondary, false)).setOrigin(0.5, 0));
  c.add(ui.add.text(x + 210, ry + 46, 'Poin ini nanti menentukan bagian pool hadiah.', txt(12, C.tertiary, false)).setOrigin(0.5, 0));
  ui.button(c, x + 150, y + h - 52, 'Mantap!', () => ui.closeModal(), 120);
  if (r.levels.length) ui.queueLevelUp(r.levels);
}
