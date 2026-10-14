import { expect, test } from '@playwright/test';
import { at, modalOpen, noErrors, patch, press, sleep, start, state, toasts, use } from './helpers';

// Field tile (10,10) is tilled from (10,9) facing down.

test('tanam, siram, tumbuh, panen, kirim, dibayar', async ({ page }) => {
  const errors = await start(page);
  await at(page, 10, 9, 'down');
  await use(page, 1);
  await use(page, 3);
  await use(page, 2);
  let s = await state(page);
  expect(s.plots['10,10']).toMatchObject({ tilled: true, watered: true, crop: { id: 'lobak', growth: 0 } });

  for (let d = 0; d < 3; d++) {
    await sleep(page);
    await patch(page, "s.plots['10,10'].watered = true");
  }
  s = await state(page);
  expect(s.plots['10,10'].crop.growth).toBe(3);

  await at(page, 10, 9, 'down');
  await use(page, 4);
  // watered every night → at least 3 stars
  const keys = Object.keys((await state(page)).produce);
  expect(keys).toHaveLength(1);
  expect(keys[0]).toMatch(/^lobak@[345]$/);

  await at(page, 8, 7, 'up'); // shipping bin
  await press(page, 'Space');
  expect(Object.keys((await state(page)).shipping)).toEqual(keys);
  await sleep(page);
  expect((await state(page)).coins).toBeGreaterThanOrEqual(300 + Math.round(45 * 1.5));
  noErrors(errors);
});

test('air penyiram tidak terisi saat tidur', async ({ page }) => {
  const errors = await start(page);
  await patch(page, 's.water = 7');
  await sleep(page);
  expect((await state(page)).water).toBe(7);
  noErrors(errors);
});

test('pupuk tumbuh 2x, sprinkler menyiram tetangga', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.level = 5; s.seeds = { lobak: 3, pupuk: 1, sprinkler: 1 }");
  await at(page, 10, 9, 'down');
  await use(page, 1);
  await patch(page, "s.seed = 'pupuk'");
  await use(page, 3);
  await patch(page, "s.seed = 'lobak'");
  await use(page, 3);
  await use(page, 2);
  await at(page, 12, 9, 'down'); // planted but not watered
  await use(page, 1);
  await patch(page, "s.seed = 'lobak'");
  await use(page, 3);
  await at(page, 11, 9, 'down'); // sprinkler between them
  await patch(page, "s.seed = 'sprinkler'");
  await use(page, 3);
  expect((await state(page)).plots['11,10'].sprinkler).toBe(true);

  await sleep(page);
  const s = await state(page);
  expect(s.plots['10,10'].crop.growth).toBe(2);
  expect(s.plots['12,10'].watered).toBe(true);
  noErrors(errors);
});

test('fitur terkunci sampai levelnya', async ({ page }) => {
  const errors = await start(page);
  await at(page, 44, 7, 'up'); // request board on the plaza
  await press(page, 'Space');
  expect(await modalOpen(page)).toBe(false);
  expect((await toasts(page)).join()).toContain('Level 2');

  await patch(page, 's.level = 2');
  await press(page, 'Space');
  expect(await modalOpen(page)).toBe(true);
  noErrors(errors);
});

test('menyerahkan permintaan warga', async ({ page }) => {
  const errors = await start(page);
  const r = (await state(page)).requests[0];
  await patch(page, `s.level = 2; s.produce = { ${JSON.stringify(r.crop)}: ${r.qty} }`);
  await at(page, 44, 7, 'up');
  await press(page, 'Space');
  await page.mouse.click(680, 181); // first card's "Serahkan"
  const s = await state(page);
  expect(s.coins).toBe(300 + r.reward);
  expect(s.friendship[r.npc]).toBe(1);
  expect(s.stats.requestsDone).toBe(1);
  noErrors(errors);
});

test('festival mingguan', async ({ page }) => {
  const errors = await start(page);
  await patch(page, 's.day = 7; s.minutes = 600; s.level = 2; s.produce = { lobak: 4, kentang: 1 }');
  await at(page, 50, 7, 'up'); // stage
  await press(page, 'Space');
  expect(await modalOpen(page)).toBe(true);
  // each click redraws the window, so give it a beat between clicks
  for (let i = 0; i < 5; i++) {
    await page.mouse.click(242, 304); // first chip each time
    await page.waitForTimeout(100);
  }
  await page.mouse.click(405, 435); // "Ikut Lomba"
  await page.waitForTimeout(100);
  const s = await state(page);
  expect(s.festival.enteredDay).toBe(7);
  expect(s.produce).toEqual({});
  noErrors(errors);
});

test('ayam diberi pakan lalu bertelur', async ({ page }) => {
  const errors = await start(page);
  await patch(
    page,
    "s.level = 7; s.feed = 3; s.animals = [1, 2].map((id) => ({ id, name: 'Ayam ' + id, affection: 0, fed: false, petted: false }))",
  );
  await page.evaluate(() => window.game.events.emit('animals-changed'));
  await at(page, 25, 10, 'up'); // coop
  await press(page, 'Space');
  let s = await state(page);
  expect(s.animals.every((a: { fed: boolean }) => a.fed)).toBe(true);
  expect(s.feed).toBe(1);

  await sleep(page);
  await at(page, 25, 10, 'up');
  await press(page, 'Space');
  s = await state(page);
  expect((s.produce.telur ?? 0) + (s.produce['telur-emas'] ?? 0)).toBe(2);
  noErrors(errors);
});

test('pancing harus dibeli, lalu bisa dapat ikan', async ({ page }) => {
  const errors = await start(page);
  await press(page, '5');
  expect((await toasts(page)).join()).toContain('belum punya Pancing');

  await patch(page, "s.ownedTools = ['pancing']");
  await press(page, '5');
  await at(page, 24, 29, 'down'); // end of the dock
  await press(page, 'Space');
  await page.waitForFunction(() => window.game.scene.getScene('farm').fishing?.stage === 'bite', null, { timeout: 8000 });
  await press(page, 'Space');
  const fish = Object.keys((await state(page)).produce);
  expect(fish.length).toBe(1);
  expect(fish[0]).toMatch(/^ikan-/);
  noErrors(errors);
});

test('tas penuh menolak panen, lalu upgrade tas', async ({ page }) => {
  const errors = await start(page);
  // 12 stacks of 99 fill the starter bag
  await patch(page, "s.seeds = {}; s.produce = { lobak: 12 * 99 }; s.plots['10,10'] = { tilled: true, watered: false, crop: { id: 'tomat', growth: 4 } }");
  await at(page, 10, 9, 'down');
  await use(page, 4);
  let s = await state(page);
  expect(s.plots['10,10'].crop).toBeTruthy();
  expect((await toasts(page)).join()).toContain('Tas penuh');

  await patch(page, 's.level = 2; s.coins = 2500');
  await press(page, 'i');
  await page.mouse.click(300, 475); // "Upgrade → 18 slot"
  s = await state(page);
  expect(s.bagTier).toBe(1);
  expect(s.coins).toBe(500);
  noErrors(errors);
});

test('lari dengan Shift lebih cepat', async ({ page }) => {
  const errors = await start(page);
  const walk = async (shift: boolean) => {
    await at(page, 10, 7, 'right');
    const x0 = await page.evaluate(() => window.game.scene.getScene('farm').player.x);
    if (shift) await page.keyboard.down('Shift');
    await page.keyboard.down('d');
    await page.waitForTimeout(500);
    await page.keyboard.up('d');
    if (shift) await page.keyboard.up('Shift');
    return (await page.evaluate(() => window.game.scene.getScene('farm').player.x)) - x0;
  };
  const w = await walk(false);
  const r = await walk(true);
  expect(r / w).toBeGreaterThan(1.4);
  noErrors(errors);
});

test('joystick sentuh menggerakkan pemain', async ({ page }) => {
  const errors = await start(page, '?touch');
  const y0 = await page.evaluate(() => window.game.scene.getScene('farm').player.y);
  await page.mouse.move(120, 420);
  await page.mouse.down();
  await page.mouse.move(120, 452, { steps: 4 });
  await page.waitForTimeout(500);
  await page.mouse.up();
  const y1 = await page.evaluate(() => window.game.scene.getScene('farm').player.y);
  expect(y1 - y0).toBeGreaterThan(10);
  noErrors(errors);
});

test('memasak di dapur lalu makan untuk tenaga', async ({ page }) => {
  const errors = await start(page);
  // before level 3 the door only offers sleep
  await at(page, 5, 6, 'up');
  await press(page, 'Space');
  expect((await page.evaluate(() => window.game.scene.getScene('ui').modalKind))).toBe('');
  await press(page, 'Escape');

  await patch(page, 's.level = 3; s.stamina = 50; s.produce = { lobak: 2 }');
  await press(page, 'Space');
  await page.mouse.click(480, 288); // "Dapur"
  await page.waitForTimeout(100);
  await page.screenshot({ path: 'test-results/dapur.png' });
  await page.mouse.click(308, 176); // "Masak" on Sup Lobak
  await page.waitForTimeout(100);
  let s = await state(page);
  expect(s.produce).toEqual({ 'sup-lobak': 1 });
  expect(s.minutes).toBeGreaterThanOrEqual(6 * 60 + 30);

  await press(page, 'Escape');
  await press(page, 'i');
  await page.mouse.click(690, 380); // "Makan" in the detail card
  s = await state(page);
  expect(s.produce).toEqual({});
  expect(s.stamina).toBe(75);
  noErrors(errors);
});

test('kualitas: dirawat sempurna ★4+, ditelantarkan ★1-2', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.level = 3; s.seeds = { lobak: 2, pupuk: 1 }");
  // tile A (10,10): fertilizer + water every night
  await at(page, 10, 9, 'down');
  await use(page, 1);
  await patch(page, "s.seed = 'pupuk'");
  await use(page, 3);
  await patch(page, "s.seed = 'lobak'");
  await use(page, 3);
  // tile B (12,10): planted, left dry for two nights
  await at(page, 12, 9, 'down');
  await use(page, 1);
  await use(page, 3);
  await patch(page, "s.plots['10,10'].watered = true");
  await sleep(page);
  await patch(page, "s.plots['10,10'].watered = true");
  await sleep(page);
  for (let d = 0; d < 3; d++) {
    await patch(page, "s.plots['12,10'].watered = true");
    await sleep(page);
  }
  let s = await state(page);
  expect(s.plots['12,10'].crop.missed).toBe(2);

  await at(page, 10, 9, 'down');
  await use(page, 4);
  await at(page, 12, 9, 'down');
  await use(page, 4);
  s = await state(page);
  const stars = Object.keys(s.produce).map((k) => Number(k.split('@')[1] ?? 1)).sort();
  expect(stars[0]).toBeLessThanOrEqual(2); // neglected
  expect(stars[1]).toBeGreaterThanOrEqual(4); // fertilized and always watered
  noErrors(errors);
});

test('permintaan warga memakai kualitas terendah dulu', async ({ page }) => {
  const errors = await start(page);
  await patch(
    page,
    "s.level = 2; s.produce = { lobak: 2, 'lobak@4': 2 }; s.requests = [{ id: 99, npc: 'sari', crop: 'lobak', qty: 2, reward: 100, until: 99 }]",
  );
  await at(page, 44, 7, 'up');
  await press(page, 'Space');
  await page.mouse.click(680, 265); // one request → shorter window, button sits lower
  expect((await state(page)).produce).toEqual({ 'lobak@4': 2 });
  noErrors(errors);
});

test('hujan menyiram ladang otomatis', async ({ page }) => {
  const errors = await start(page);
  await at(page, 10, 9, 'down');
  await use(page, 1);
  await use(page, 3); // planted, not watered
  await patch(page, "s.forecast = 'hujan'");
  await sleep(page, true);
  const s = await state(page);
  expect(s.weather).toBe('hujan');
  expect(s.plots['10,10'].watered).toBe(true);
  noErrors(errors);
});

test('hari festival selalu cerah, badai berjalan tanpa error', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.day = 6; s.forecast = 'badai'");
  await sleep(page, true);
  expect((await state(page)).weather).toBe('cerah'); // day 7 = festival

  await patch(page, "s.forecast = 'badai'");
  await sleep(page, true);
  expect((await state(page)).weather).toBe('badai');
  await page.waitForTimeout(3000); // first lightning strike
  noErrors(errors);
});
