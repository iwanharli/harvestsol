import { FISH, STAMINA_MAX, STAMINA_MILESTONE_CAP_LEVEL, STAMINA_MILESTONE_EVERY, STAMINA_PER_MILESTONE, STAMINA_REWARD } from '../../data';
import { maxStamina } from '../../state';
import { C, HEX, card, txt } from '../theme';
import type { UIScene } from '../../scenes/UIScene';

/** The wardrobe holds the player's "stamina record": every source of max stamina and whether it is earned. */
export function openWardrobe(ui: UIScene) {
  const s = ui.state;
  const rows: { label: string; detail: string; amount: number; done: boolean }[] = [
    { label: 'Tenaga dasar', detail: 'Bawaan petani', amount: STAMINA_MAX, done: true },
  ];
  for (let l = STAMINA_MILESTONE_EVERY; l <= STAMINA_MILESTONE_CAP_LEVEL; l += STAMINA_MILESTONE_EVERY)
    rows.push({ label: `Level ${l}`, detail: 'Tonggak level', amount: STAMINA_PER_MILESTONE, done: s.level >= l });
  const fishFound = FISH.filter((f) => s.fishCaught[f.id]).length;
  rows.push({ label: 'Jamu Kuat', detail: 'Warga pertama yang ♥10', amount: STAMINA_REWARD, done: !!s.staminaRewards.jamu });
  rows.push({ label: 'Buku Ikan lengkap', detail: `${fishFound}/${FISH.length} ikan`, amount: STAMINA_REWARD, done: !!s.staminaRewards.fishbook });

  const ROW = 30;
  const W = 420, H = 104 + rows.length * ROW + 60;
  const { c, x, y } = ui.openModal(W, H, 'Lemari · Catatan Tenaga');
  c.add(ui.add.text(x + W / 2, y + 50, `Tenaga maksimal sekarang ${maxStamina(s)}`, txt(14, C.blue)).setOrigin(0.5, 0));

  const g = ui.add.graphics();
  c.add(g);
  const ly = y + 82;
  card(g, x + 20, ly, W - 40, rows.length * ROW, 'normal', 14);
  rows.forEach((r, i) => {
    const ry = ly + i * ROW;
    if (i) g.fillStyle(HEX.hairline, 0.07).fillRect(x + 36, ry, W - 72, 1);
    // check mark when earned, a hollow circle when not yet
    if (r.done) g.fillStyle(HEX.green, 1).fillCircle(x + 42, ry + ROW / 2, 7);
    else g.lineStyle(1.5, 0x8e8e93, 0.6).strokeCircle(x + 42, ry + ROW / 2, 6);
    if (r.done) c.add(ui.add.text(x + 42, ry + ROW / 2, '✓', txt(10, C.white)).setOrigin(0.5));
    c.add(ui.add.text(x + 58, ry + 8, r.label, txt(13, r.done ? C.ink : C.tertiary)));
    c.add(ui.add.text(x + 58 + 130, ry + 9, r.detail, txt(11, C.tertiary, false)));
    c.add(ui.add.text(x + W - 36, ry + ROW / 2, `+${r.amount}`, txt(13, r.done ? C.green : C.disabled)).setOrigin(1, 0.5));
  });
  ui.button(ui.modalLayerOrThrow(), x + W / 2 - 60, y + H - 48, 'Tutup', () => ui.closeModal(), 120);
}
