import { DAYS_PER_SEASON, FESTIVAL_EVERY, WEEKDAYS } from '../../data';
import { C, card, txt } from '../theme';
import { festivalTheme, dayOfSeason, seasonOf, yearOf } from '../../state';
import type { UIScene } from '../../scenes/UIScene';

const INK = C.ink;

export function openCalendar(ui: UIScene) {
  const s = ui.state;
  const W = 572, H = 430;
  const { c, x, y } = ui.openModal(W, H, `Kalender · ${seasonOf(s.day)}, Tahun ${yearOf(s.day)}`, 'calendar');
  const today = dayOfSeason(s.day);
  const seasonStart = s.day - today + 1; // absolute day of the 1st of this season
  const cw = 72, ch = 62, gap = 6;
  const gx = x + (W - (7 * cw + 6 * gap)) / 2;
  const gy = y + 84;
  WEEKDAYS.forEach((d, i) => c.add(ui.add.text(gx + i * (cw + gap) + cw / 2, gy - 20, d, txt(12, C.tertiary)).setOrigin(0.5, 0)));

  for (let d = 1; d <= DAYS_PER_SEASON; d++) {
    const abs = seasonStart + d - 1;
    const cx = gx + ((d - 1) % 7) * (cw + gap);
    const cy = gy + Math.floor((d - 1) / 7) * (ch + gap);
    const past = d < today;
    const isToday = d === today;
    const ahead = abs - s.day; // 1 = tomorrow
    const festival = d % FESTIVAL_EVERY === 0;
    const g = ui.add.graphics();
    card(g, cx, cy, cw, ch, isToday ? 'today' : past ? 'muted' : festival ? 'alert' : 'normal', 12);
    c.add(g);
    c.add(ui.add.text(cx + 8, cy + 6, `${d}`, txt(13, past ? C.disabled : isToday ? C.blue : INK)));
    // weather: today and the forecast window; nothing for days we cannot see yet
    const wx = isToday ? s.weather : ahead >= 1 && ahead <= s.forecasts.length ? s.forecasts[ahead - 1] : null;
    if (wx) c.add(ui.add.image(cx + cw - 20, cy + 20, `wx-${wx}`).setScale(1.5));
    if (festival) {
      c.add(ui.add.image(cx + 14, cy + ch - 16, `icon-${festivalTheme(abs).id}`).setScale(1.5).setAlpha(past ? 0.5 : 1));
      c.add(ui.add.text(cx + cw - 5, cy + ch - 5, 'Festival', txt(10, past ? C.disabled : C.red)).setOrigin(1, 1));
    } else if (isToday) c.add(ui.add.text(cx + cw - 5, cy + ch - 5, 'Hari ini', txt(10, C.blue)).setOrigin(1, 1));
  }
  c.add(
    ui.add
      .text(x + W / 2, y + H - 72, 'Ikon cuaca = prakiraan 7 hari ke depan · Festival tiap hari ke-7 (ikon = tema ×2)', txt(11, C.tertiary, false))
      .setOrigin(0.5, 0),
  );
  ui.button(c, x + W / 2 - 60, y + H - 50, 'Tutup', () => ui.closeModal(), 120);
}
