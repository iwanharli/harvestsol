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
  expect(s.plots['10,10']).toMatchObject({ tilled: true, watered: true, crop: { id: 'kangkung', growth: 0 } });

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
  expect(keys[0]).toMatch(/^kangkung@[345]$/);

  await at(page, 8, 7, 'up'); // shipping bin
  await press(page, 'Space');
  await page.waitForTimeout(150);
  await page.mouse.click(195, 484); // "Kirim Semua"
  await page.waitForTimeout(100);
  expect(Object.keys((await state(page)).shipping)).toEqual(keys);
  await press(page, 'Escape');
  await sleep(page);
  expect((await state(page)).coins).toBeGreaterThanOrEqual(300 + Math.round(30 * 1.4)); // kangkung ★3+
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
  await patch(page, "s.level = 5; s.seeds = { kangkung: 3, pupuk: 1, sprinkler: 1 }");
  await at(page, 10, 9, 'down');
  await use(page, 1);
  await patch(page, "s.seed = 'pupuk'");
  await use(page, 3);
  await patch(page, "s.seed = 'kangkung'");
  await use(page, 3);
  await use(page, 2);
  await at(page, 12, 9, 'down'); // planted but not watered
  await use(page, 1);
  await patch(page, "s.seed = 'kangkung'");
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
  const st = await state(page);
  expect(st.requests.length).toBe(2); // day 1 always shows two simple requests
  const r = st.requests[0];
  const it = r.items[0];
  await patch(page, `s.level = 2; s.produce = { ${JSON.stringify(it.id)}: ${it.qty} }`);
  await at(page, 44, 7, 'up');
  await press(page, 'Space');
  await page.mouse.click(700, 231); // first card's "Serahkan"
  const s = await state(page);
  expect(s.coins).toBe(300 + r.reward);
  expect(s.friendship[r.npc]).toBe(1);
  expect(s.stats.requestsDone).toBe(1);
  noErrors(errors);
});

test('festival mingguan', async ({ page }) => {
  const errors = await start(page);
  await patch(page, 's.day = 7; s.minutes = 600; s.level = 2; s.produce = { kangkung: 4, padi: 1 }');
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
  expect(s.produce).toEqual({ kangkung: 4, padi: 1 }); // handed back after judging
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
  const s = await state(page);
  const fish = Object.keys(s.produce);
  expect(fish.length).toBe(1);
  expect(fish[0]).toMatch(/^ikan-[a-z]+(@[2-5])?$/); // a fish, maybe with quality
  const id = fish[0].split('@')[0];
  expect(s.fishCaught[id]).toBeGreaterThanOrEqual(1); // recorded in the fish book

  await press(page, 'j');
  expect(await page.evaluate(() => window.game.scene.getScene('ui').modalKind)).toBe('fishbook');
  noErrors(errors);
});

test('tas penuh menolak panen, lalu upgrade tas', async ({ page }) => {
  const errors = await start(page);
  // 12 stacks of 50 fill the starter bag
  await patch(page, "s.seeds = {}; s.produce = { kangkung: 12 * 50 }; s.plots['10,10'] = { tilled: true, watered: false, crop: { id: 'tomat', growth: 5 } }");
  await at(page, 10, 9, 'down');
  await use(page, 4);
  let s = await state(page);
  expect(s.plots['10,10'].crop).toBeTruthy();
  expect((await toasts(page)).join()).toContain('Tas penuh');

  await patch(page, 's.level = 2; s.coins = 3500');
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
  await at(page, 5, 6, 'up'); // farmhouse door
  await press(page, 'Space');
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.game.registry.get('indoors'))).toBe(true);

  // the stove refuses before Lv 3
  await at(page, 113, 8, 'up');
  await press(page, 'Space');
  expect((await toasts(page)).join()).toContain('Level 3');

  await patch(page, 's.level = 3; s.stamina = 50; s.produce = { kangkung: 2 }');
  await press(page, 'Space');
  expect(await page.evaluate(() => window.game.scene.getScene('ui').modalKind)).toBe('');
  await page.mouse.click(308, 176); // "Masak" on Tumis Kangkung
  await page.waitForTimeout(100);
  let s = await state(page);
  expect(s.produce).toEqual({ 'tumis-kangkung': 1 });
  expect(s.minutes).toBeGreaterThanOrEqual(6 * 60 + 30);

  await press(page, 'Escape');
  await press(page, 'i');
  await page.mouse.click(690, 380); // "Makan" in the detail card
  s = await state(page);
  expect(s.produce).toEqual({});
  expect(s.stamina).toBe(75);
  noErrors(errors);
});

test('rumah: masuk, perabot, tidur bangun di kasur, keluar lewat keset', async ({ page }) => {
  const errors = await start(page);
  await at(page, 5, 6, 'up');
  await press(page, 'Space');
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.game.registry.get('indoors'))).toBe(true);

  await at(page, 102, 7, 'left'); // facing the bed
  await press(page, 'Space');
  expect(await page.evaluate(() => window.game.registry.get('modal'))).toBe(true);
  await press(page, 'Escape');

  await at(page, 108, 8, 'up'); // bookshelf → fish book
  await press(page, 'Space');
  expect(await page.evaluate(() => window.game.scene.getScene('ui').modalKind)).toBe('fishbook');
  await press(page, 'Escape');

  await at(page, 117, 8, 'right'); // wardrobe → stamina record
  await press(page, 'Space');
  expect(await page.evaluate(() => window.game.registry.get('modal'))).toBe(true);
  await press(page, 'Escape');

  await sleep(page); // wake up indoors, next to the bed
  expect(await page.evaluate(() => window.game.registry.get('indoors'))).toBe(true);

  await at(page, 110, 14, 'down'); // step onto the doormat
  await page.keyboard.down('s');
  await page.waitForTimeout(250);
  await page.keyboard.up('s');
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.game.registry.get('indoors'))).toBe(false);
  noErrors(errors);
});

test('kualitas: dirawat sempurna ★4+, ditelantarkan ★1-2', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.level = 3; s.seeds = { kangkung: 2, pupuk: 1 }");
  // tile A (10,10): fertilizer + watered every night → kangkung (3 days) matures in two nights
  await at(page, 10, 9, 'down');
  await use(page, 1);
  await patch(page, "s.seed = 'pupuk'");
  await use(page, 3);
  await patch(page, "s.seed = 'kangkung'");
  await use(page, 3);
  await use(page, 2);
  // tile B (12,10): left dry for two nights, then watered for two
  await at(page, 12, 9, 'down');
  await use(page, 1);
  await use(page, 3);
  await sleep(page);
  await patch(page, "s.plots['10,10'].watered = true"); // tile A again; tile B stays dry
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
    "s.level = 2; s.produce = { kangkung: 2, 'kangkung@4': 2 }; s.requests = [{ id: 99, npc: 'sari', crop: 'kangkung', qty: 2, reward: 100, until: 99 }]",
  );
  await at(page, 44, 7, 'up');
  await press(page, 'Space');
  await page.mouse.click(700, 281); // one request → shorter window, button sits lower
  expect((await state(page)).produce).toEqual({ 'kangkung@4': 2 });
  noErrors(errors);
});

test('hujan menyiram ladang otomatis', async ({ page }) => {
  const errors = await start(page);
  await at(page, 10, 9, 'down');
  await use(page, 1);
  await use(page, 3); // planted, not watered
  await patch(page, "s.forecasts[0] = 'hujan'");
  await sleep(page, true);
  const s = await state(page);
  expect(s.weather).toBe('hujan');
  expect(s.plots['10,10'].watered).toBe(true);
  noErrors(errors);
});

test('hari festival selalu cerah, badai berjalan tanpa error', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.day = 6; s.forecasts[0] = 'badai'");
  await sleep(page, true);
  expect((await state(page)).weather).toBe('cerah'); // day 7 = festival

  await patch(page, "s.forecasts[0] = 'badai'");
  await sleep(page, true);
  expect((await state(page)).weather).toBe('badai');
  await page.waitForTimeout(3000); // first lightning strike
  noErrors(errors);
});

test('sawit terbuka di level 12 dan berbuah ulang', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.seeds = { sawit: 1 }; s.seed = 'sawit'");
  await at(page, 10, 9, 'down');
  await use(page, 1);
  await use(page, 3);
  expect((await state(page)).plots['10,10'].crop.id).toBe('sawit'); // planting needs no level, buying does

  await patch(page, "s.level = 12; s.plots['10,10'].crop.growth = 14");
  await use(page, 4);
  const s = await state(page);
  expect(Object.keys(s.produce)[0]).toMatch(/^sawit/);
  expect(s.plots['10,10'].crop).toMatchObject({ id: 'sawit', growth: 7 }); // stays and fruits again in 7 days
  noErrors(errors);
});

test('save lama (musim subtropis) dikonversi ke tropis', async ({ page }) => {
  const errors = await start(page);
  const snapshot = await state(page);
  // stop the game (Phaser finishes destroying on its next frame) so it cannot save over the old-format save
  await page.evaluate(() => window.game.destroy(true));
  await page.waitForTimeout(200);
  await page.evaluate((s) => {
    s.produce = { lobak: 3, 'kentang@3': 1, 'sup-lobak': 1 };
    s.seeds = { stroberi: 2 };
    s.seed = 'stroberi';
    s.forecasts = ['salju', 'cerah', 'cerah', 'cerah', 'cerah', 'cerah', 'cerah'];
    localStorage.setItem('cropfarm-save-v1', JSON.stringify(s));
  }, snapshot);
  await page.goto('/');
  await page.waitForFunction(() => window.game?.scene?.getScene('ui')?.sys.isActive());
  const s = await state(page);
  expect(s.produce).toEqual({ kangkung: 3, 'singkong@3': 1, 'tumis-kangkung': 1 });
  expect(s.seeds).toEqual({ semangka: 2 });
  expect(s.seed).toBe('semangka');
  expect(s.forecasts[0]).toBe('cerah');
  noErrors(errors);
});

test('kanvas mengikuti rasio jendela tanpa pita hitam, termasuk saat diubah', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 868 });
  const errors = await start(page);
  const fills = () =>
    page.evaluate(() => {
      const c = window.game.canvas.getBoundingClientRect();
      return { w: Math.round(c.width), h: Math.round(c.height), vw: innerWidth, vh: innerHeight };
    });
  let f = await fills();
  expect(Math.abs(f.w - f.vw)).toBeLessThanOrEqual(2);
  expect(Math.abs(f.h - f.vh)).toBeLessThanOrEqual(2);

  await page.setViewportSize({ width: 1800, height: 800 }); // live resize to ultrawide (within the 21:9 limit)
  await page.waitForTimeout(600);
  f = await fills();
  expect(Math.abs(f.w - f.vw)).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => window.game.scene.getScene('ui').sys.isActive())).toBe(true);
  await press(page, '2'); // HUD still works after the rebuild
  expect((await state(page)).tool).toBe('siram');
  noErrors(errors);
});

test('tenaga maksimal naik di level tonggak dan dari Jamu Kuat', async ({ page }) => {
  const errors = await start(page);
  await patch(page, 's.level = 4');
  await sleep(page);
  expect((await state(page)).stamina).toBe(110); // Lv 4 milestone: 100 → 110

  // first villager to reach ♥10 gives Jamu Kuat (+10, once)
  await patch(page, 's.friendship.sari = 9');
  const v = await page.evaluate(() => {
    const img = window.game.scene.getScene('farm').villagers.get('sari');
    window.game.scene.getScene('farm').tweens.killTweensOf(img);
    return [img.x, img.y];
  });
  await page.evaluate(([x, y]) => {
    const f = window.game.scene.getScene('farm');
    f.player.setPosition(x - 16, y);
    f.dir = 'right';
  }, v);
  await press(page, 'Space');
  const s = await state(page);
  expect(s.friendship.sari).toBe(10);
  expect(s.staminaRewards.jamu).toBe(true);
  expect(s.stamina).toBe(120);
  noErrors(errors);
});

test('posisi pemain tetap setelah halaman di-refresh', async ({ page }) => {
  const errors = await start(page);
  await at(page, 20, 12, 'left');
  await page.waitForTimeout(1300); // standing still → position saved
  await page.reload();
  await page.waitForFunction(() => window.game?.scene?.getScene('ui')?.sys.isActive());
  const p = await page.evaluate(() => {
    const f = window.game.scene.getScene('farm');
    return { x: Math.floor(f.player.x / 16), y: Math.floor((f.player.y - 4) / 16), dir: f.dir };
  });
  expect(p).toEqual({ x: 20, y: 12, dir: 'left' });

  // inside the house too (close the welcome window the reload brought back)
  await page.evaluate(() => window.game.scene.getScene('ui').closeModal());
  await at(page, 5, 6, 'up');
  await press(page, 'Space');
  await page.waitForTimeout(700);
  await page.reload();
  await page.waitForFunction(() => window.game?.scene?.getScene('ui')?.sys.isActive());
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.game.registry.get('indoors'))).toBe(true);
  noErrors(errors);
});

test('toko mebel: masuk, beli kulkas dari pajangan, simpan bahan, masak dari kulkas', async ({ page }) => {
  const errors = await start(page);
  await patch(page, 's.level = 6; s.coins = 20000; s.produce = { kangkung: 2 }');
  await at(page, 57, 18, 'up'); // shop door
  await press(page, 'Space');
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.game.registry.get('indoors'))).toBe(true);

  await at(page, 167, 11, 'up'); // the kulkas stand
  await press(page, 'Space');
  expect(await page.evaluate(() => window.game.registry.get('modal'))).toBe(true);
  await page.waitForTimeout(150);
  await page.mouse.click(707, 312); // "Beli" on the kulkas card
  await page.waitForTimeout(150);
  let s = await state(page);
  expect(s.furniture.kulkas).toBe(true);
  expect(s.coins).toBe(16000);
  await press(page, 'Escape');

  // store the kangkung in the kulkas, then cook with nothing in the bag
  await page.evaluate(() => {
    const st = window.game.registry.get('state');
    st.fridge = { kangkung: 2 };
    st.produce = {};
  });
  await page.evaluate(() => window.game.events.emit('open-kitchen'));
  await page.waitForTimeout(150);
  await page.mouse.click(308, 176); // "Masak" on Tumis Kangkung
  await page.waitForTimeout(150);
  s = await state(page);
  expect(s.fridge).toEqual({});
  expect(s.produce).toEqual({ 'tumis-kangkung': 1 });
  noErrors(errors);
});

test('jam dinding bangun 05:00, kasur besar +15 tenaga', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.furniture = { jam: true, kasur: true }");
  await sleep(page);
  const s = await state(page);
  expect(s.minutes).toBeGreaterThanOrEqual(5 * 60);
  expect(s.minutes).toBeLessThan(5 * 60 + 5); // the clock may tick a moment after the report closes
  expect(s.stamina).toBe(115);
  noErrors(errors);
});

test('renovasi rumah: lebih luas, sofa +20 tenaga, dapur besar 2 porsi', async ({ page }) => {
  const errors = await start(page);
  await patch(page, 's.level = 5; s.coins = 15000; s.stamina = 50');
  await page.evaluate(() => window.game.events.emit('open-mebel'));
  await page.waitForTimeout(150);
  await page.mouse.click(436, 87); // "Renovasi Rumah" tab
  await page.waitForTimeout(150);
  await page.mouse.click(702, 277); // "Renovasi" on Rumah Sedang
  await page.waitForTimeout(150);
  let s = await state(page);
  expect(s.houseTier).toBe(1);
  expect(s.coins).toBe(3000);
  await press(page, 'Escape');

  // the door now leads into the bigger house
  await at(page, 5, 6, 'up');
  await press(page, 'Space');
  await page.waitForTimeout(700);
  const inside = await page.evaluate(() => Math.floor(window.game.scene.getScene('farm').player.x / 16));
  expect(inside).toBeGreaterThanOrEqual(220);

  await at(page, 243, 10, 'up'); // facing the sofa
  await press(page, 'Space');
  s = await state(page);
  expect(s.stamina).toBe(70);
  await press(page, 'Space'); // only once a day
  expect((await state(page)).stamina).toBe(70);

  // Rumah Besar: cooking makes two portions
  await patch(page, "s.houseTier = 2; s.level = 10; s.produce = { kangkung: 2 }");
  await page.evaluate(() => window.game.events.emit('open-kitchen'));
  await page.waitForTimeout(150);
  await page.mouse.click(308, 176); // "Masak" on Tumis Kangkung
  await page.waitForTimeout(150);
  expect((await state(page)).produce).toEqual({ 'tumis-kangkung': 2 });
  noErrors(errors);
});

test('ukuran jendela toko tetap saat pindah tab', async ({ page }) => {
  const errors = await start(page);
  await patch(page, 's.level = 7; s.day = 85'); // Kemarau: the fullest seed tab
  await page.evaluate(() => window.game.events.emit('open-shop'));
  await page.waitForTimeout(150);
  const box = () => page.evaluate(() => {
    const m = window.game.scene.getScene('ui').modalBox;
    return { top: Math.round(m.top), bottom: Math.round(m.bottom) };
  });
  const first = await box();
  for (const cx of [386, 510, 262]) { // Peralatan, Ternak, back to Benih
    await page.mouse.click(cx, first.top + 56 + 16);
    await page.waitForTimeout(120);
    expect(await box()).toEqual(first);
  }
  noErrors(errors);
});

test('kotak kirim: pilih barang, ambil kembali, kirim semua', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.produce = { kangkung: 3, padi: 2 }");
  await at(page, 8, 7, 'up');
  await press(page, 'Space');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.game.scene.getScene('ui').modalKind)).toBe('shipping');

  // window: W 720 × H 474 at (120, 33); bag grid at (148, 137); picker at y 351
  await page.mouse.click(171, 160); // select kangkung (starts at 1)
  await page.waitForTimeout(120);
  await page.mouse.click(369, 374); // "+1" → 2
  await page.waitForTimeout(120);
  await page.mouse.click(400, 410); // "Kirim 2"
  await page.waitForTimeout(120);
  let s = await state(page);
  expect(s.shipping).toEqual({ kangkung: 2 });
  expect(s.produce).toEqual({ kangkung: 1, padi: 2 }); // one kangkung and the padi stay

  await page.mouse.click(524, 160); // select the kangkung in the bin
  await page.waitForTimeout(120);
  await page.mouse.click(312, 410); // "Maks" → 2
  await page.waitForTimeout(120);
  await page.mouse.click(400, 410); // "Ambil 2"
  await page.waitForTimeout(120);
  s = await state(page);
  expect(s.shipping).toEqual({});
  expect(s.produce).toEqual({ kangkung: 3, padi: 2 });

  await page.mouse.click(195, 484); // "Kirim Semua"
  await page.waitForTimeout(120);
  s = await state(page);
  expect(s.produce).toEqual({});
  expect(s.shipping).toEqual({ kangkung: 3, padi: 2 });
  noErrors(errors);
});

test('warung bahan: tutup pagi buta, beli bahan standar', async ({ page }) => {
  const errors = await start(page);
  await at(page, 37, 6, 'up'); // Bu Ratu Atit's door
  await patch(page, 's.minutes = 6 * 60; s.coins = 1000');
  await press(page, 'Space');
  expect((await toasts(page)).join()).toContain('07:00');

  await patch(page, 's.minutes = 10 * 60');
  await press(page, 'Space');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.game.scene.getScene('ui').modalKind)).toBe('market');
  // window 720×440 at (120, 50); kangkung is selected first; "Beli 1" sits in the detail panel
  await page.mouse.click(620, 50 + 84 + 170 + 42 + 17);
  await page.waitForTimeout(120);
  const s = await state(page);
  expect(s.produce).toEqual({ 'kangkung@0': 1 }); // standard quality, marked as bought
  expect(s.coins).toBe(1000 - 95);
  noErrors(errors);
});

test('barang dari warung tidak bisa ikut festival', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.day = 7; s.minutes = 600; s.level = 2; s.produce = { 'kangkung@0': 5 }");
  await at(page, 50, 7, 'up'); // stage
  await press(page, 'Space');
  await page.waitForTimeout(150);
  for (let i = 0; i < 5; i++) {
    await page.mouse.click(242, 304); // where the first bag item would be
    await page.waitForTimeout(80);
  }
  await page.mouse.click(405, 435); // "Ikut Lomba" (stays disabled: nothing eligible)
  await page.waitForTimeout(120);
  expect((await state(page)).festival.enteredDay).toBe(0);
  noErrors(errors);
});

test('tas: geser slot dan rapikan otomatis', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.produce = { 'ikan-nila': 2, kangkung: 3, 'kangkung@3': 1 }; s.seeds = { kangkung: 4 }; s.bagOrder = undefined");
  await press(page, 'KeyI');
  await page.waitForTimeout(200);
  // drag slot 1 (ikan-nila) onto slot 3 (kangkung@3)
  const slot = (i: number) => [183 + (i % 6) * 58, 153 + Math.floor(i / 6) * 58] as const;
  await page.mouse.move(...slot(0));
  await page.mouse.down();
  await page.mouse.move(slot(1)[0], slot(1)[1], { steps: 4 });
  await page.mouse.move(...slot(2), { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  expect((await state(page)).bagOrder).toEqual(['produce:kangkung', 'produce:kangkung@3', 'produce:ikan-nila', 'seeds:kangkung']);
  await page.mouse.click(751, 101); // Rapikan
  await page.waitForTimeout(150);
  expect((await state(page)).bagOrder).toEqual(['produce:kangkung@3', 'produce:kangkung', 'produce:ikan-nila', 'seeds:kangkung']);
  noErrors(errors);
});

test('kulkas: klik barang menampilkan detail, lalu simpan', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.furniture.kulkas = true; s.produce = { kangkung: 3 }; s.fridge = {}");
  await page.evaluate(() => window.game.events.emit('open-fridge'));
  await page.waitForTimeout(150);
  await page.mouse.click(171, 155); // first bag slot: only selects
  await page.waitForTimeout(120);
  expect((await state(page)).fridge).toEqual({});
  await page.mouse.click(716, 420); // "Simpan ke kulkas"
  await page.waitForTimeout(120);
  const s = await state(page);
  expect(s.fridge).toEqual({ kangkung: 3 });
  expect(s.produce).toEqual({});
  noErrors(errors);
});

test('permintaan kualitas hanya menerima hasil sendiri berbintang cukup', async ({ page }) => {
  const errors = await start(page);
  await patch(
    page,
    "s.level = 2; s.produce = { 'kangkung@0': 5, 'kangkung@2': 2, 'kangkung@3': 1 }; s.requests = [{ id: 98, npc: 'dina', kind: 'kualitas', items: [{ id: 'kangkung', qty: 2, minStars: 3 }], reward: 200, note: 'tes', until: 99 }]",
  );
  await at(page, 44, 7, 'up');
  await press(page, 'Space');
  await page.mouse.click(700, 281);
  let s = await state(page);
  expect(s.requests.length).toBe(1); // only one ★3+, not enough
  await patch(page, "s.produce['kangkung@4'] = 1");
  await press(page, 'Escape');
  await press(page, 'Space');
  await page.mouse.click(700, 281);
  s = await state(page);
  expect(s.requests.length).toBe(0);
  expect(s.produce).toEqual({ 'kangkung@0': 5, 'kangkung@2': 2 });
  expect(s.friendship.dina).toBe(2);
  noErrors(errors);
});

test('permintaan baru muncul acak sekali sehari, papan bisa kosong', async ({ page }) => {
  const errors = await start(page);
  const counts = await page.evaluate(async () => {
    const st = window.game.registry.get('state');
    const mod = await import('/src/state.ts');
    const out: number[] = [];
    st.level = 5;
    for (let d = 2; d < 60; d++) {
      st.requests = [];
      st.day = d;
      mod.refreshRequests(st);
      const n = st.requests.length;
      mod.refreshRequests(st); // same day again: nothing new
      if (st.requests.length !== n) return [-1];
      out.push(n);
    }
    return out;
  });
  expect(counts).not.toContain(-1);
  expect(counts).toContain(0);
  expect(Math.max(...counts)).toBeLessThanOrEqual(2);
  noErrors(errors);
});

test('slot tas maksimal 50, slot kulkas maksimal 99', async ({ page }) => {
  const errors = await start(page);
  const r = await page.evaluate(async () => {
    const st = window.game.registry.get('state');
    const mod = await import('/src/state.ts');
    st.seeds = {};
    st.produce = { kangkung: 120 };
    st.fridge = {};
    const bag = mod.slotsUsed(st); // 50 + 50 + 20
    mod.moveToFridge(st, 'kangkung');
    return { bag, fridge: mod.fridgeSlotsUsed(st) }; // 99 + 21
  });
  expect(r).toEqual({ bag: 3, fridge: 2 });
  noErrors(errors);
});

test('peti lumbung: 48 slot, simpan dan ambil hasil panen', async ({ page }) => {
  const errors = await start(page);
  const r = await page.evaluate(async () => {
    const st = window.game.registry.get('state');
    const mod = await import('/src/state.ts');
    st.produce = { kangkung: 30, 'jagung@3': 5 };
    st.storage = {};
    const a = mod.moveToStore(st, 'peti', 'kangkung');
    const b = mod.moveToStore(st, 'peti', 'jagung@3');
    const stored = { ...st.storage };
    st.storage = Object.fromEntries(Array.from({ length: 48 }, (_, i) => [`x${i}`, 1]));
    st.produce = { kangkung: 1 };
    const full = mod.moveToStore(st, 'peti', 'kangkung');
    return { a, b, stored, full };
  });
  expect(r).toEqual({ a: null, b: null, stored: { kangkung: 30, 'jagung@3': 5 }, full: 'Peti penuh.' });
  noErrors(errors);
});

test('peti lumbung: jendela dibuka dari rumah setelah dibeli', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.furniture.peti = true; s.produce = { kangkung: 4 }; s.storage = {}");
  await page.evaluate(() => window.game.events.emit('open-storage'));
  await page.waitForTimeout(150);
  await page.mouse.click(171, 148); // first bag slot
  await page.waitForTimeout(120);
  await page.mouse.click(716, 420); // "Simpan ke peti"
  await page.waitForTimeout(120);
  const s = await state(page);
  expect(s.storage).toEqual({ kangkung: 4 });
  noErrors(errors);
});
