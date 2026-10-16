import { ALARM_WAKE_MIN, DAY_START_MIN, FULL_SLEEP_HOURS, NAP_HOURS } from '../../data';
import { WEEKDAYS, WEATHER_INFO, isWet } from '../../data';
import { C, HEX, card, txt, well } from '../theme';
import { festivalTheme, isFestivalDay, dayOfSeason, seasonOf, type DayReport } from '../../state';
import type { UIScene } from '../../scenes/UIScene';

const INK = C.ink;

export function showWelcome(ui: UIScene) {
  const { c, x, y } = ui.openModal(580, 370, 'Selamat datang di CropFarm');
  const body = [
    'Kakek mewariskan ladang ini padamu. Saatnya bertani!',
    '',
    'Gerak: WASD / panah, atau klik/tap tujuan',
    'Aksi: Spasi / E, atau klik petak di dekatmu',
    'Alat: 1 Cangkul · 2 Penyiram · 3 Benih · 4 Tangan · 5 Pancing · 6 Beliung',
    'Lari: Shift  ·  Tas: I  ·  Kalender: K  ·  Buku Ikan: J  ·  Peta: P  ·  Musik: N',
    'Ganti benih: Q  ·  Semua suara: M  ·  Tutup jendela: Esc',
    '',
    'Cangkul → tanam → siram setiap hari → panen.',
    'Kirim panen di kotak kayu, tidur di pintu rumah.',
    'Cek papan permintaan warga untuk hadiah ekstra.',
  ];
  c.add(ui.add.text(x + 34, y + 62, body.join('\n'), { ...txt(15, INK, false), lineSpacing: 4 }));
  ui.button(c, x + 580 / 2 - 60, y + 370 - 52, 'Mulai', () => ui.closeModal(), 120);
}

export function askSleep(ui: UIScene) {
  const s = ui.state;
  const wake = s.furniture?.jam ? ALARM_WAKE_MIN : DAY_START_MIN;
  let d = (((wake - s.minutes) % 1440) + 1440) % 1440;
  if (d === 0) d = 1440;
  const hours = Math.max(3, d / 60);
  const pct = Math.round(Math.min(1, hours / FULL_SLEEP_HOURS) * 100);
  const hh = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
  const wakeAt = hh(s.minutes + hours * 60);
  const day = s.minutes >= 6 * 60 && s.minutes < 18 * 60; // daytime: offer a short nap too
  const { c, x, y } = ui.openModal(420, 200, 'Tidur?');
  c.add(
    ui.add
      .text(x + 210, y + 58, day
        ? `Tidur siang ${NAP_HOURS} jam: tenaga +25%.\nAtau tidur sampai besok ${wakeAt}: tenaga pulih ${pct}%.`
        : `Tidur sampai ${wakeAt} (${Math.round(hours)} jam): tenaga pulih ${pct}%.\nHari berganti sendiri tiap tengah malam.`, {
        ...txt(13, INK, false),
        align: 'center',
        wordWrap: { width: 370 },
      })
      .setOrigin(0.5, 0),
  );
  const go = (kind: 'bed' | 'nap') => () => {
    ui.closeModal();
    ui.game.events.emit('do-sleep', kind);
  };
  if (day) {
    ui.button(c, x + 20, y + 136, `Tidur siang ${NAP_HOURS} jam`, go('nap'), 150);
    ui.button(c, x + 176, y + 136, `Sampai besok`, go('bed'), 120, false, true);
    ui.button(c, x + 302, y + 136, 'Belum', () => ui.closeModal(), 98);
  } else {
    ui.button(c, x + 60, y + 136, 'Tidur', go('bed'), 140);
    ui.button(c, x + 220, y + 136, 'Belum', () => ui.closeModal(), 140);
  }
}

export type Confirm = { title: string; body: string; ok: string; onOk: () => void; onCancel?: () => void };

/** A small yes/no question; the action only runs on the first button. */
export function askConfirm(ui: UIScene, q: Confirm) {
  const { c, x, y } = ui.openModal(400, 180, q.title);
  c.add(ui.add.text(x + 200, y + 60, q.body, { ...txt(13, INK, false), align: 'center', wordWrap: { width: 340 } }).setOrigin(0.5, 0));
  ui.button(c, x + 64, y + 118, q.ok, () => {
    ui.closeModal();
    q.onOk();
  }, 130);
  ui.button(c, x + 206, y + 118, 'Batal', () => {
    ui.closeModal();
    q.onCancel?.();
  }, 130);
}

/** Morning report: a header, an iOS-style grouped list, sales detail and notices. */
export function showReport(ui: UIScene, r: DayReport) {
  const s = ui.state;
  ui.refresh();
  type Row = { icon: string; label: string; value: string; color?: string };
  const rows: Row[] = [
    { icon: 'ic-coin', label: 'Pendapatan kemarin', value: r.income ? `+${r.income.toLocaleString('id-ID')} G` : '0 G', color: r.income ? C.green : C.tertiary },
    { icon: 'ic-sprout', label: 'Tanaman tumbuh', value: `${r.grown}` },
    { icon: `wx-${s.weather}`, label: 'Cuaca hari ini', value: WEATHER_INFO[s.weather].name },
    { icon: `wx-${s.forecasts[0]}`, label: 'Besok', value: WEATHER_INFO[s.forecasts[0]].name, color: C.secondary },
  ];
  if (r.sprinkled) rows.push({ icon: 'icon-sprinkler', label: 'Disiram sprinkler', value: `${r.sprinkled} petak` });
  if (r.eggs) rows.push({ icon: 'icon-telur', label: 'Telur di kandang', value: `${r.eggs} butir` });
  const warnings: string[] = [];
  if (r.passedOut === 'luar') warnings.push(`Kamu pingsan di luar. Warga mengantarmu pulang${r.fine ? ` (biaya ${r.fine.toLocaleString('id-ID')} G)` : ''}. Tenaga hanya 60%.`);
  if (r.passedOut === 'rumah') warnings.push('Kamu tertidur kelelahan di lantai rumah. Tenaga hanya 60%.');
  if (isWet(s.weather)) warnings.push('Hujan menyiram ladang otomatis hari ini.');
  if (s.weather === 'kabut') warnings.push('Kabut asap dari kebakaran lahan. Siram tanamanmu sendiri.');
  if (r.stormDamage) warnings.push(`Badai merusak ${r.stormDamage} tanaman.`);
  if (r.withered) warnings.push(`${r.withered} tanaman layu karena ganti musim.`);
  if (r.hungry) warnings.push(`${r.hungry} ayam kelaparan semalam, keakraban turun.`);
  let festival = '';
  if (isFestivalDay(s.day)) festival = `Festival hari ini · tema ${festivalTheme(s.day).name} ×2 · 09:00–18:00`;
  else if (isFestivalDay(s.day + 1)) festival = `Besok Festival. Siapkan ${festivalTheme(s.day + 1).name}!`;

  // measure first so the window fits its content
  const W = 440, P = 20, ROW = 32;
  const MAX_SALES = 3;
  const sold = r.sold.slice(0, MAX_SALES);
  const more = r.sold.length - sold.length;
  const sales = sold.length + (more > 0 ? 1 : 0);
  let h = 86 + rows.length * ROW + 14;
  if (sales) h += 30 + sales * 20 + 12;
  h += warnings.length * 22 + (warnings.length ? 10 : 0);
  if (festival) h += 46;
  h += 58;
  const { c, x, y } = ui.openModal(W, h, '');

  // header
  const hg = ui.add.graphics();
  well(hg, x + P + 24, y + 42, 24);
  c.add(hg);
  c.add(ui.add.image(x + P + 24, y + 42, `wx-${s.weather}`).setScale(2.5));
  c.add(ui.add.text(x + P + 60, y + 22, 'Selamat pagi!', txt(20)));
  c.add(
    ui.add.text(x + P + 60, y + 48, `Musim ${seasonOf(s.day)} · Hari ${dayOfSeason(s.day)} · ${WEEKDAYS[(s.day - 1) % 7]}`, txt(13, C.secondary, false)),
  );

  // grouped list
  let cy = y + 86;
  const lg = ui.add.graphics();
  c.add(lg); // added before the row text so it sits underneath
  card(lg, x + P, cy, W - 2 * P, rows.length * ROW, 'normal', 14);
  rows.forEach((row, i) => {
    const ry = cy + i * ROW;
    if (i) lg.fillStyle(HEX.hairline, 0.08).fillRect(x + P + 48, ry, W - 2 * P - 48, 1);
    c.add(ui.add.image(x + P + 24, ry + ROW / 2, row.icon).setScale(1.5));
    c.add(ui.add.text(x + P + 48, ry + ROW / 2, row.label, txt(14, INK, false)).setOrigin(0, 0.5));
    c.add(ui.add.text(x + W - P - 14, ry + ROW / 2, row.value, txt(14, row.color ?? INK)).setOrigin(1, 0.5));
  });
  cy += rows.length * ROW + 14;

  // what sold
  if (sales) {
    c.add(ui.add.text(x + P + 4, cy, 'TERJUAL', txt(11, C.tertiary)));
    cy += 22;
    const sg = ui.add.graphics();
    card(sg, x + P, cy, W - 2 * P, sales * 20 + 12, 'muted', 12);
    c.add(sg);
    sold.forEach((it, i) => {
      const ly = cy + 6 + i * 20;
      c.add(ui.add.text(x + P + 14, ly, `${it.name} ×${it.qty}`, txt(13, INK, false)));
      c.add(ui.add.text(x + W - P - 14, ly, `${it.total.toLocaleString('id-ID')} G`, txt(13, C.secondary)).setOrigin(1, 0));
    });
    if (more > 0) c.add(ui.add.text(x + P + 14, cy + 6 + sold.length * 20, `+${more} lainnya`, txt(13, C.tertiary, false)));
    cy += sales * 20 + 22;
  }

  // notices
  warnings.forEach((w) => {
    c.add(ui.add.image(x + P + 10, cy + 9, 'ic-warn').setScale(1));
    c.add(ui.add.text(x + P + 26, cy, w, txt(13, C.secondary, false)));
    cy += 22;
  });
  if (warnings.length) cy += 10;

  if (festival) {
    const fg = ui.add.graphics();
    card(fg, x + P, cy, W - 2 * P, 36, 'today', 12);
    c.add(fg);
    c.add(ui.add.text(x + W / 2, cy + 18, festival, txt(13, C.blue)).setOrigin(0.5));
    cy += 46;
  }

  ui.button(c, x + P, y + h - 52, 'Lanjut', () => ui.closeModal(), W - 2 * P);
}
