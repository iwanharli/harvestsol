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
  await page.mouse.click(704, 443); // "Simpan ke kulkas"
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
  await page.mouse.click(704, 443); // "Simpan ke peti"
  await page.waitForTimeout(120);
  const s = await state(page);
  expect(s.storage).toEqual({ kangkung: 4 });
  noErrors(errors);
});

test('mencopot sprinkler minta konfirmasi', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.level = 5; s.seeds = {}; s.plots['11,10'] = { tilled: false, watered: false, sprinkler: true }");
  await page.evaluate(() => window.game.events.emit('plots-changed'));
  await at(page, 11, 9, 'down');
  await use(page, 4); // Tangan
  expect(await modalOpen(page)).toBe(true);
  await page.mouse.click(551, 315); // "Batal"
  await page.waitForTimeout(120);
  let s = await state(page);
  expect(s.plots['11,10'].sprinkler).toBe(true);
  await use(page, 4);
  await page.mouse.click(409, 315); // "Copot"
  await page.waitForTimeout(120);
  s = await state(page);
  expect(s.plots['11,10']).toBeUndefined();
  expect(s.seeds.sprinkler).toBe(1);
  noErrors(errors);
});

test('danau baru: tiap perairan punya nama dan ikannya sendiri', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.ownedTools = ['pancing']; s.minutes = 10 * 60");
  await press(page, '5');
  const spots: [number, number, 'left' | 'right' | 'up' | 'down', string][] = [
    [5, 47, 'right', 'rawa'],
    [52, 63, 'right', 'muara'],
  ];
  for (const [x, y, dir, lake] of spots) {
    await at(page, x, y, dir);
    await press(page, 'Space');
    expect(await page.evaluate(() => window.game.scene.getScene('farm').fishing?.where)).toBe(lake);
    await page.waitForFunction(() => window.game.scene.getScene('farm').fishing?.stage === 'bite', null, { timeout: 8000 });
    await press(page, 'Space');
    await page.waitForTimeout(100);
  }
  const caught = Object.keys((await state(page)).produce).map((k) => k.split('@')[0]);
  const lakeOf = await page.evaluate(async () => {
    const d = await import('/src/data.ts');
    return Object.fromEntries(d.FISH.map((f) => [f.id, f.where]));
  });
  expect(lakeOf[caught[0]]).toContain('rawa');
  expect(lakeOf[caught[caught.length - 1]]).toContain('muara');
  noErrors(errors);
});

test('setiap perairan selalu punya ikan di siang hari, di musim apa pun', async ({ page }) => {
  const errors = await start(page);
  const empty = await page.evaluate(async () => {
    const d = await import('/src/data.ts');
    const out: string[] = [];
    for (const lake of Object.keys(d.LAKES)) for (const season of d.SEASONS) for (let h = 6; h < 24; h++)
      if (!d.fishAvailable(lake as never, season, h, false).length) out.push(`${lake} ${season} ${h}`);
    return out;
  });
  expect(empty).toEqual([]);
  noErrors(errors);
});

test('peta dunia: tombol P, gambar peta, dan posisi pemain', async ({ page }) => {
  const errors = await start(page);
  await at(page, 30, 40, 'down');
  await press(page, 'p');
  expect(await page.evaluate(() => window.game.scene.getScene('ui').modalKind)).toBe('worldmap');
  const info = await page.evaluate(() => {
    const ui = window.game.scene.getScene('ui');
    const tex = ui.textures.get('minimap').getSourceImage() as HTMLCanvasElement;
    // the player's dot: the blue circle with a white outline inside the modal
    const layer = ui.modalLayer;
    const all = layer.list as Phaser.GameObjects.GameObject[];
    const texts = all.filter((o) => o.type === 'Text').map((o) => (o as Phaser.GameObjects.Text).text);
    const dot = all.find((o) => o.type === 'Arc' && (o as Phaser.GameObjects.Arc).isStroked) as Phaser.GameObjects.Arc;
    const img = all.find((o) => o.type === 'Image' && (o as Phaser.GameObjects.Image).texture.key === 'minimap') as Phaser.GameObjects.Image;
    return { w: tex.width, h: tex.height, texts, dot: { x: dot.x, y: dot.y }, img: { x: img.x, y: img.y, w: img.displayWidth, h: img.displayHeight } };
  });
  expect(info.w).toBe(64 * 4);
  expect(info.h).toBe(72 * 4);
  for (const name of ['Danau Sirep', 'Rawa Gambut', 'Telaga Kabut', 'Waduk Kedung Lali', 'Muara Payau', 'Kamu di sini']) expect(info.texts).toContain(name);
  // the dot sits where tile (30, 40) is on the map picture
  expect(info.dot.x).toBeCloseTo(info.img.x + (30.5 / 64) * info.img.w, 0);
  expect(info.dot.y).toBeCloseTo(info.img.y + (40.5 / 72) * info.img.h, 0);
  await press(page, 'p'); // P again closes it
  expect(await modalOpen(page)).toBe(false);
  noErrors(errors);
});

test('kulkas: hanya slot yang dipilih yang pindah, jumlahnya bisa diatur', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.furniture.kulkas = true; s.seeds = {}; s.produce = { kangkung: 60 }; s.fridge = {}");
  await page.evaluate(() => window.game.events.emit('open-fridge'));
  await page.waitForTimeout(150);
  await page.mouse.click(224, 161); // second bag slot: the stack of 10
  await page.waitForTimeout(100);
  await page.mouse.click(704, 443); // "Simpan 10"
  await page.waitForTimeout(100);
  let s = await state(page);
  expect(s.produce).toEqual({ kangkung: 50 });
  expect(s.fridge).toEqual({ kangkung: 10 });

  await page.mouse.click(524, 161); // the kulkas stack of 10
  await page.waitForTimeout(100);
  for (let i = 0; i < 6; i++) {
    await page.mouse.click(584, 401); // −1
    await page.waitForTimeout(60);
  }
  await page.mouse.click(704, 443); // "Ambil 4"
  await page.waitForTimeout(100);
  s = await state(page);
  expect(s.fridge).toEqual({ kangkung: 6 });
  expect(s.produce).toEqual({ kangkung: 54 });
  noErrors(errors);
});

test('peti hanya untuk hasil kebun, benih, pupuk, sprinkler; ikan/telur/masakan ke kulkas', async ({ page }) => {
  const errors = await start(page);
  const r = await page.evaluate(async () => {
    const st = window.game.registry.get('state');
    const m = await import('/src/state.ts');
    st.produce = { kangkung: 5, 'ikan-nila': 2, telur: 3, 'tumis-kangkung': 1 };
    st.seeds = { kangkung: 6, pupuk: 2, sprinkler: 1 };
    st.storage = {};
    st.fridge = {};
    const peti = {
      crop: m.moveToStore(st, 'peti', 'kangkung'),
      fish: m.moveToStore(st, 'peti', 'ikan-nila'),
      egg: m.moveToStore(st, 'peti', 'telur'),
      dish: m.moveToStore(st, 'peti', 'tumis-kangkung'),
      seed: m.moveToStore(st, 'peti', 'benih:kangkung', 4),
      pupuk: m.moveToStore(st, 'peti', 'benih:pupuk'),
      sprinkler: m.moveToStore(st, 'peti', 'benih:sprinkler'),
    };
    const kulkas = {
      fish: m.moveToStore(st, 'kulkas', 'ikan-nila'),
      egg: m.moveToStore(st, 'kulkas', 'telur'),
      dish: m.moveToStore(st, 'kulkas', 'tumis-kangkung'),
      seed: m.moveToStore(st, 'kulkas', 'benih:kangkung'),
    };
    const back = m.moveFromStore(st, 'peti', 'benih:pupuk', 1);
    return { peti, kulkas, back, storage: st.storage, fridge: st.fridge, seeds: st.seeds, produce: st.produce };
  });
  const noPeti = 'Peti Lumbung hanya untuk hasil kebun, benih, pupuk, dan sprinkler.';
  expect(r.peti).toEqual({ crop: null, fish: noPeti, egg: noPeti, dish: noPeti, seed: null, pupuk: null, sprinkler: null });
  expect(r.kulkas).toEqual({ fish: null, egg: null, dish: null, seed: 'Kulkas hanya untuk makanan: hasil panen, ikan, telur, dan masakan.' });
  expect(r.back).toBeNull();
  expect(r.storage).toEqual({ kangkung: 5, 'benih:kangkung': 4, 'benih:pupuk': 1, 'benih:sprinkler': 1 });
  expect(r.fridge).toEqual({ 'ikan-nila': 2, telur: 3, 'tumis-kangkung': 1 });
  expect(r.seeds).toEqual({ kangkung: 2, pupuk: 1 });
  expect(r.produce).toEqual({});
  noErrors(errors);
});

test('gua tambang: masuk, pecahkan batu, temukan tangga, turun, kerekan di awal zona', async ({ page }) => {
  const errors = await start(page);
  await at(page, 56, 45, 'up'); // in front of the cave mouth
  await press(page, 'Space');
  expect((await toasts(page)).join()).toContain('Bawa Beliung');

  await patch(page, "s.ownedTools = ['beliung']; s.seeds = {}; s.produce = {}");
  await press(page, '6');
  await press(page, 'Space');
  await page.waitForTimeout(700);
  let s = await state(page);
  expect(s.cave.floor).toBe(1);
  expect(await page.evaluate(() => window.game.registry.get('indoors'))).toBe(true);

  // put the ladder rock right above the player and break it
  const [px, py] = await page.evaluate(() => {
    const p = window.game.scene.getScene('farm').player;
    return [Math.floor(p.x / 16), Math.floor((p.y - 4) / 16)];
  });
  const key = `${px},${py - 1}`;
  await patch(page, `s.cave.nodes = { '${key}': { ore: 'bijih-tembaga', hits: 2 } }; s.cave.ladder = '${key}'; s.cave.ladderOpen = false`);
  await page.evaluate(() => window.game.scene.getScene('farm').refreshCave());
  await press(page, 'Space');
  await page.waitForTimeout(250);
  await press(page, 'Space');
  await page.waitForTimeout(250);
  s = await state(page);
  expect(s.produce['bijih-tembaga']).toBeGreaterThanOrEqual(1);
  expect(s.cave.ladderOpen).toBe(true);
  expect((await toasts(page)).join()).toContain('tangga ke bawah');

  // the open hole takes you one floor down, with fresh rocks
  await press(page, 'Space');
  await page.waitForTimeout(700);
  s = await state(page);
  expect(s.cave.floor).toBe(2);
  expect(s.cave.deepest).toBe(2);
  expect(Object.keys(s.cave.nodes).length).toBeGreaterThanOrEqual(14);

  // deeper floors hold better ore, and the lift offers every 5th floor reached
  const r = await page.evaluate(async () => {
    const st = window.game.registry.get('state');
    const m = await import('/src/state.ts');
    const d = await import('/src/data.ts');
    st.cave.deepest = 12;
    return { lift: m.liftFloors(st), shallowGold: d.oreWeights(1)['bijih-emas'], deepGold: d.oreWeights(45)['bijih-emas'] };
  });
  expect(r.lift).toEqual([1, 2, 10, 12]); // 2 = the floor you are on now
  expect(r.deepGold).toBeGreaterThan(r.shallowGold * 10);
  noErrors(errors);
});

test('hari berganti sendiri jam 00:00 tanpa tidur', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.minutes = 22 * 60 - 0.5; s.stamina = 100");
  await page.waitForTimeout(800);
  expect((await toasts(page)).join()).toContain('jam 10 malam');

  await patch(page, "s.minutes = 24 * 60 - 1; s.shipping = { kangkung: 2 }; s.coins = 300");
  await page.waitForFunction(() => window.game.registry.get('state').day === 2, null, { timeout: 5000 });
  await page.waitForTimeout(1500);
  const s = await state(page);
  expect(s.coins).toBe(360); // paid at midnight, while awake
  expect(s.shipping).toEqual({});
  expect(s.minutes).toBeLessThan(60);
  expect((await toasts(page)).join()).toContain('Tengah malam: tanggal');
  const ui = await page.evaluate(() => {
    const t = window.game.scene.getScene('ui').timeText;
    return { text: t.text, color: t.style.color };
  });
  expect(ui.text).toMatch(/^00:/);
  expect(ui.color).toBe('#ff3b30'); // red: tiredness drains fastest after midnight
  expect(await modalOpen(page)).toBe(false); // no report popping up mid-play
  noErrors(errors);
});

test('tidur memulihkan tenaga sesuai lamanya, tidur siang 2 jam', async ({ page }) => {
  const errors = await start(page);
  // 01:00 → 06:00 is 5 of 8 hours: 63% of 100
  await patch(page, 's.minutes = 60; s.stamina = 10');
  await page.evaluate(() => window.game.scene.getScene('farm').sleep('bed'));
  await page.waitForTimeout(1300);
  let s = await state(page);
  expect(s.day).toBe(1);
  expect(Math.abs(s.minutes - 6 * 60)).toBeLessThan(5); // the clock runs on after waking
  expect(s.stamina).toBeGreaterThanOrEqual(62); // ~5 of 8 hours
  expect(s.stamina).toBeLessThanOrEqual(63);

  // a nap at 10:00: two hours later, a quarter of max stamina back
  await patch(page, 's.minutes = 10 * 60; s.stamina = 20');
  await page.evaluate(() => window.game.scene.getScene('farm').sleep('nap'));
  await page.waitForTimeout(1300);
  s = await state(page);
  expect(Math.abs(s.minutes - 12 * 60)).toBeLessThan(5);
  expect(s.stamina).toBe(45);
  noErrors(errors);
});

test('pingsan saat tenaga habis: bangun 4 jam kemudian, biaya kalau di luar', async ({ page }) => {
  const errors = await start(page);
  await patch(page, 's.minutes = 10 * 60; s.stamina = 1; s.coins = 300');
  await at(page, 10, 9, 'down');
  await use(page, 1); // the hoe costs 1: stamina hits 0 in the field
  await page.waitForFunction(() => window.game.registry.get('state').minutes >= 14 * 60, null, { timeout: 5000 });
  await page.waitForTimeout(800);
  const s = await state(page);
  expect(s.day).toBe(1);
  expect(s.stamina).toBe(30);
  expect(s.coins).toBe(270);
  noErrors(errors);
});

test('kulkas dan peti bisa dirapikan', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.furniture.kulkas = true; s.fridge = { 'tumis-kangkung': 1, 'ikan-nila': 2, kangkung: 4, 'kangkung@3': 1 }");
  await page.evaluate(() => window.game.events.emit('open-fridge'));
  await page.waitForTimeout(150);
  await page.mouse.click(761, 33); // "Rapikan"
  await page.waitForTimeout(120);
  expect(Object.keys((await state(page)).fridge)).toEqual(['kangkung@3', 'kangkung', 'ikan-nila', 'tumis-kangkung']);

  const peti = await page.evaluate(async () => {
    const st = window.game.registry.get('state');
    const m = await import('/src/state.ts');
    st.storage = { 'benih:pupuk': 1, jagung: 2, 'benih:kangkung': 3, kangkung: 1 };
    m.sortStore(st, 'peti');
    return Object.keys(st.storage);
  });
  expect(peti).toEqual(['kangkung', 'jagung', 'benih:kangkung', 'benih:pupuk']);
  noErrors(errors);
});

test('kerekan gua: pilih lantai yang pernah dicapai', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.ownedTools = ['beliung']; s.cave = { floor: 0, deepest: 12, nodes: {}, ladder: '', ladderOpen: false }");
  await at(page, 56, 45, 'up');
  await press(page, 'Space');
  expect(await modalOpen(page)).toBe(true);
  await page.mouse.click(429, 282); // "Lantai 10"
  await page.waitForTimeout(700);
  const s = await state(page);
  expect(s.cave.floor).toBe(10);
  expect(s.cave.deepest).toBe(12);
  noErrors(errors);
});

test('zona gua: makin dalam makin beda, dasar di lantai 50 dengan peti harta sekali', async ({ page }) => {
  const errors = await start(page);
  const r = await page.evaluate(async () => {
    const st = window.game.registry.get('state');
    const m = await import('/src/state.ts');
    const d = await import('/src/data.ts');
    st.produce = {};
    st.coins = 0;
    m.genFloor(st, 3);
    const shallow = { pillars: st.cave.pillars.length, ladderOre: st.cave.nodes[st.cave.ladder].ore };
    m.genFloor(st, 25);
    const crystal = {
      pillars: st.cave.pillars.length,
      ladderIsOre: st.cave.nodes[st.cave.ladder].ore !== 'batu',
      kristalWeight: d.oreWeights(25).kristal,
    };
    const hits = { shallowGold: d.rockHits('bijih-emas', 3), deepGold: d.rockHits('bijih-emas', 45), deepStone: d.rockHits('batu', 45) };
    const cost = [d.mineCost(5), d.mineCost(35), d.mineCost(45)];
    const mulia = [d.oreWeights(35)['batu-mulia'], d.oreWeights(45)['batu-mulia']];
    m.genFloor(st, 80); // there is nothing below 50
    const bottom = { floor: st.cave.floor, ladder: st.cave.ladder, chest: !!st.cave.chest };
    const first = m.openCaveTreasure(st);
    const coins = st.coins;
    const items = { ...st.produce };
    const again = m.openCaveTreasure(st);
    m.genFloor(st, 50);
    return { shallow, crystal, hits, cost, mulia, bottom, first, coins, items, again, chestAfter: !!st.cave.chest, names: d.CAVE_ZONES.map((z) => z.name) };
  });
  expect(r.shallow.pillars).toBe(0);
  expect(r.crystal.pillars).toBeGreaterThan(0);
  expect(r.crystal.ladderIsOre).toBe(true);
  expect(r.crystal.kristalWeight).toBeGreaterThan(0);
  expect(r.hits).toEqual({ shallowGold: 4, deepGold: 11, deepStone: 3 });
  expect(r.cost).toEqual([2, 3, 4]);
  expect(r.mulia[0]).toBe(0);
  expect(r.mulia[1]).toBeGreaterThan(0);
  expect(r.bottom).toEqual({ floor: 50, ladder: '', chest: true });
  expect(r.first).toBeNull();
  expect(r.coins).toBe(5000);
  expect(r.items).toEqual({ 'batu-mulia': 3, 'bijih-emas': 5 });
  expect(r.again).toBe('Peti ini sudah kosong.');
  expect(r.chestAfter).toBe(false);
  expect(r.names).toEqual(['Gua Tanah', 'Gua Kapur', 'Gua Kristal', 'Gua Panas', 'Perut Bumi']);
  noErrors(errors);
});

test('kerekan gua: lanjut dari lantai terdalam setelah keluar', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.ownedTools = ['beliung']; s.cave = { floor: 0, deepest: 7, nodes: {}, ladder: '', ladderOpen: false }");
  await at(page, 56, 45, 'up');
  await press(page, 'Space');
  expect(await modalOpen(page)).toBe(true);
  await page.mouse.click(429, 282); // "Lanjut 7"
  await page.waitForTimeout(700);
  expect((await state(page)).cave.floor).toBe(7);
  noErrors(errors);
});

test('begadang menguras tenaga: 5 per jam sebelum, 10 per jam setelah tengah malam', async ({ page }) => {
  const errors = await start(page);
  // speed the clock up so a few real seconds cover a couple of game hours
  const drained = await page.evaluate(async () => {
    const d = await import('/src/data.ts');
    return d.NIGHT_DRAIN;
  });
  expect(drained).toEqual({ from: 22 * 60, perHour: 5, afterMidnight: 10 });
  await patch(page, 's.minutes = 2 * 60; s.stamina = 100');
  await page.waitForTimeout(6000); // 6 s ≈ 9 game minutes at 10/h: about 1-2 stamina
  const s = await state(page);
  expect(s.stamina).toBeLessThan(100);
  expect(s.stamina).toBeGreaterThan(95);
  noErrors(errors);
});

test('bengkel: upgrade bertahap, alat ditinggal sehari, lalu diambil', async ({ page }) => {
  const errors = await start(page);
  const r = await page.evaluate(async () => {
    const st = window.game.registry.get('state');
    const m = await import('/src/state.ts');
    st.level = 9;
    st.coins = 30000;
    st.seeds = {};
    st.produce = { 'bijih-tembaga': 5, 'bijih-besi': 5, 'bijih-emas': 5 };
    const noOre = (() => { const p = { ...st.produce }; st.produce = {}; const e = m.startUpgrade(st, 'siram'); st.produce = p; return e; })();
    const first = m.startUpgrade(st, 'siram'); // Biasa → Tembaga, uses copper
    const busy = m.startUpgrade(st, 'cangkul'); // one tool at a time
    const early = m.collectUpgrade(st);
    st.day += 1;
    const got = m.collectUpgrade(st);
    const tier1 = m.tierOf(st, 'siram');
    const water1 = m.waterMax(st);
    const second = m.startUpgrade(st, 'siram'); // Tembaga → Besi, uses iron
    st.day += 2;
    m.collectUpgrade(st);
    return { noOre, first, busy, early: !!early, got, tier1, water1, second, tier2: m.tierOf(st, 'siram'), water2: m.waterMax(st), coins: st.coins, produce: st.produce };
  });
  expect(r.noOre).toBe('Butuh 5 Bijih Tembaga.');
  expect(r.first).toBeNull();
  expect(r.busy).toBe('Pandai besi masih mengerjakan alat lain.');
  expect(r.early).toBe(true);
  expect(r.got).toBeNull();
  expect([r.tier1, r.water1]).toEqual([1, 40]);
  expect(r.second).toBeNull();
  expect([r.tier2, r.water2]).toEqual([2, 70]);
  expect(r.coins).toBe(30000 - 2000 - 5000);
  expect(r.produce).toEqual({ 'bijih-emas': 5 }); // copper and iron used, gold kept
  noErrors(errors);
});

test('alat tingkat tinggi: cangkul 3 petak, penyiram 3x3, alat di bengkel tidak bisa dipakai', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.toolTier = { cangkul: 2, siram: 3 }; s.water = 100; s.stamina = 100");
  await at(page, 12, 9, 'down');
  await use(page, 1); // Besi hoe: (12,10) (12,11) (12,12)
  let s = await state(page);
  for (const y of [10, 11, 12]) expect(s.plots[`12,${y}`]?.tilled).toBe(true);
  expect(s.stamina).toBe(99); // one swing, one stamina
  await page.waitForTimeout(400); // let the swing finish before moving
  await patch(page, "for (const k of ['11,10','13,10','11,11','13,11','11,12','13,12']) s.plots[k] = { tilled: true, watered: false }");
  await at(page, 12, 10, 'down');
  await use(page, 2); // Emas can: 3x3 around (12,11)
  s = await state(page);
  for (const x of [11, 12, 13]) for (const y of [10, 11, 12]) expect(s.plots[`${x},${y}`].watered, `${x},${y}`).toBe(true);
  expect(s.water).toBe(91);

  await patch(page, "s.forge = { tool: 'cangkul', tier: 3, ready: 99 }; s.unequipped = ['tool:cangkul']");
  await press(page, '1');
  expect((await toasts(page)).join()).toContain('sedang ditempa');
  await page.evaluate(() => window.game.events.emit('open-bengkel'));
  expect(await modalOpen(page)).toBe(true);
  noErrors(errors);
});

test('bengkel buka siang, tutup malam', async ({ page }) => {
  const errors = await start(page);
  await patch(page, 's.minutes = 20 * 60');
  await page.waitForTimeout(150);
  await at(page, 49, 38, 'up');
  await press(page, 'Space');
  expect(await modalOpen(page)).toBe(false);
  expect((await toasts(page)).join()).toContain('Bengkel tutup');
  expect(await page.evaluate(() => window.game.scene.getScene('farm').smithy.parts[0].visible)).toBe(false);

  await patch(page, 's.minutes = 10 * 60');
  await page.waitForTimeout(150);
  await press(page, 'Space');
  expect(await modalOpen(page)).toBe(true);
  expect(await page.evaluate(() => window.game.scene.getScene('farm').smithy.parts[0].visible)).toBe(true);
  noErrors(errors);
});

test('bengkel: tombol Ambil memperbarui jendela', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.forge = { tool: 'cangkul', tier: 1, ready: 1 }; s.toolTier = {}; s.unequipped = ['tool:cangkul']");
  await page.evaluate(() => window.game.events.emit('open-bengkel'));
  await page.waitForTimeout(150);
  await page.mouse.click(708, 101); // "Ambil"
  await page.waitForTimeout(150);
  const s = await state(page);
  expect(s.forge).toBeUndefined();
  expect(s.toolTier.cangkul).toBe(1);
  const texts = await page.evaluate(() =>
    (window.game.scene.getScene('ui').modalLayer.list as Phaser.GameObjects.GameObject[]).filter((o) => o.type === 'Text').map((o) => (o as Phaser.GameObjects.Text).text),
  );
  expect(texts.join('|')).toContain('Tungku kosong'); // the window redrew
  expect(texts).toContain('Tembaga'); // the hoe's card shows its new tier
  noErrors(errors);
});

test('permintaan yang ditandai muncul di daftar quest HUD', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.requests = [{ id: 1, npc: s.requests[0]?.npc ?? 'pak-darto', kind: 'biasa', items: [{ id: 'kangkung', qty: 3, minStars: 0 }], reward: 100, until: s.day + 2, marked: true }]; s.produce = { 'kangkung@2': 1 }");
  await page.evaluate(() => (window as any).game.events.emit('hud'));
  await page.waitForTimeout(150);
  const ui = await page.evaluate(() => {
    const sc = (window as any).game.scene.getScene('ui');
    return { label: sc.questLabel.text, rows: sc.questList.list.filter((o: any) => o.type === 'Text').map((o: any) => o.text) };
  });
  expect(ui.label).toBe('Quest 1');
  expect(ui.rows[1]).toContain('1/3');
  await page.screenshot({ path: 'test-results/quest-hud.png' });
  noErrors(errors);
});

test('festival: 5 hasil bintang 5 di tahun ke-2 menang dari warga', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.day = 119; s.minutes = 600; s.level = 15; s.produce = { 'kangkung@5': 2, 'timun@5': 2, 'cabai@5': 1 }");
  await at(page, 50, 7, 'up');
  await press(page, 'Space');
  for (let i = 0; i < 5; i++) {
    await page.mouse.click(242, 304);
    await page.waitForTimeout(100);
  }
  await page.screenshot({ path: 'test-results/festival.png' });
  await page.mouse.click(405, 435);
  await page.waitForTimeout(150);
  const s = await state(page);
  expect(s.festival.trophies.emas ?? 0).toBeGreaterThanOrEqual(1);
  noErrors(errors);
});

test('sprinkler bisa dilewati, tidak menabrak', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.plots['12,12'] = { tilled: false, watered: false, sprinkler: true }");
  await page.evaluate(() => window.game.scene.getScene('farm').refreshPlot('12,12'));
  const blocked = await page.evaluate(() => (window.game.scene.getScene('farm') as any).isBlocked(12.5 * 16, 12.5 * 16));
  expect(blocked).toBe(false);
  noErrors(errors);
});

test('pagar bawah kebun: berjalan ke pagar langsung melompat', async ({ page }) => {
  const errors = await start(page);
  const tileY = () => page.evaluate(() => Math.floor((window.game.scene.getScene('farm').player.y - 3) / 16));
  await at(page, 12, 16, 'down'); // last field row, fence is row 17
  await page.keyboard.down('s');
  await page.waitForTimeout(700);
  await page.keyboard.up('s');
  await page.waitForTimeout(200);
  expect(await tileY()).toBeGreaterThanOrEqual(18);
  await page.keyboard.down('w');
  await page.waitForTimeout(700);
  await page.keyboard.up('w');
  await page.waitForTimeout(200);
  expect(await tileY()).toBeLessThanOrEqual(16);
  noErrors(errors);
});

test('jendela karakter: tombol C membuka dan menutup', async ({ page }) => {
  const errors = await start(page);
  await press(page, 'c');
  expect(await page.evaluate(() => window.game.scene.getScene('ui').modalKind)).toBe('character');
  await press(page, 'c');
  expect(await modalOpen(page)).toBe(false);
  noErrors(errors);
});

test('perlengkapan: alat dan kostum bisa dicopot dan dipasang lagi', async ({ page }) => {
  const errors = await start(page);
  const r = await page.evaluate(async () => {
    const m = await import('/src/state.ts');
    const s = window.game.registry.get('state');
    s.tool = 'cangkul';
    m.unequipSlot(s, 'tool:cangkul');
    m.unequipSlot(s, 'wear:topi');
    const hand = m.unequipSlot(s, 'tool:tangan');
    return { tool: s.tool, off: [...s.unequipped], hat: s.outfit.topi, key: m.outfitKey(s), hand, box: m.gearBox(s).map((b) => b.key) };
  });
  expect(r).toEqual({ tool: 'tangan', off: ['tool:cangkul'], hat: '', key: '|kemeja-biru|celana-kerja|sepatu-bot', hand: 'Tangan tidak bisa dicopot.', box: ['cos:caping', 'tool:cangkul'] });
  await press(page, '1');
  expect((await toasts(page)).join()).toContain('sedang dicopot');
  expect(await page.evaluate(() => window.game.scene.getScene('farm').player.texture.key)).toContain('~|kemeja-biru');
  await page.evaluate(async () => {
    const m = await import('/src/state.ts');
    m.equipFromBox(window.game.registry.get('state'), 'tool:cangkul');
  });
  await press(page, '1');
  expect((await state(page)).tool).toBe('cangkul');
  noErrors(errors);
});

test('karakter: klik 2× atau seret untuk copot/pasang', async ({ page }) => {
  const errors = await start(page);
  await press(page, 'c');
  await page.waitForTimeout(200);
  // double-click the hoe on the doll: it goes to the Perlengkapan box
  await page.mouse.click(153, 215);
  await page.waitForTimeout(80);
  await page.mouse.click(153, 215);
  await page.waitForTimeout(200);
  expect((await state(page)).unequipped).toEqual(['tool:cangkul']);
  await page.screenshot({ path: 'test-results/char-inv.png' });
  // drag it from the box back onto the doll
  await page.mouse.move(427, 357);
  await page.mouse.down();
  await page.mouse.move(300, 300, { steps: 6 });
  await page.mouse.move(240, 260, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  expect((await state(page)).unequipped).toEqual([]);
  // drag the hat off the doll into the box
  await page.mouse.move(241, 127);
  await page.mouse.down();
  await page.mouse.move(400, 300, { steps: 6 });
  await page.mouse.move(500, 360, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  expect((await state(page)).outfit.topi).toBe('');
  noErrors(errors);
});

test('punya lebih dari satu: kostum dari toko dan cangkul cadangan bisa ditukar', async ({ page }) => {
  const errors = await start(page);
  const r = await page.evaluate(async () => {
    const m = await import('/src/state.ts');
    const s = window.game.registry.get('state');
    s.coins = 5000;
    s.toolTier = { cangkul: 2 };
    const a = m.buyCostume(s, 'kaos-merah');
    const b = m.buySpareTool(s, 'cangkul');
    m.equipFromBox(s, 'cos:kaos-merah');
    m.equipFromBox(s, 'spare:0'); // wear the new Biasa hoe, the Besi one goes to the box
    return { a, b, coins: s.coins, shirt: s.outfit.baju, tier: s.toolTier.cangkul, spares: s.spareTools, box: m.gearBox(s).map((x) => x.key) };
  });
  expect(r).toEqual({ a: null, b: null, coins: 4700, shirt: 'kaos-merah', tier: 0, spares: [{ tool: 'cangkul', tier: 2 }], box: ['cos:kemeja-biru', 'spare:0'] });
  noErrors(errors);
});

test('dua toko: kios benih dan kios peralatan isinya beda', async ({ page }) => {
  const errors = await start(page);
  const title = () => page.evaluate(() => {
    const ui = window.game.scene.getScene('ui') as any;
    return ui.modalLayer.list.filter((o: any) => o.type === 'Text').map((o: any) => o.text).find((t: string) => t.startsWith('Toko'));
  });
  await at(page, 40, 7, 'up');
  await press(page, 'Space');
  expect(await title()).toBe('Toko Peralatan & Pakaian');
  await press(page, 'Escape');
  await at(page, 46, 7, 'up');
  await press(page, 'Space');
  expect(await title()).toContain('Toko Benih & Ternak');
  const names = await page.evaluate(() => (window.game.scene.getScene('ui') as any).modalLayer.list.filter((o: any) => o.type === 'Text').map((o: any) => o.text));
  expect(names).toContain('Pupuk Cepat');
  noErrors(errors);
});

test('bengkel: selagi alat ditempa, cadangan bisa dipakai; hasil tempa masuk kotak', async ({ page }) => {
  const errors = await start(page);
  const r = await page.evaluate(async () => {
    const m = await import('/src/state.ts');
    const s = window.game.registry.get('state');
    s.coins = 9000; s.level = 5; s.produce = { 'bijih-tembaga': 5 };
    m.buySpareTool(s, 'cangkul');
    const forge = m.startUpgrade(s, 'cangkul'); // main hoe goes to the smith, its slot is empty
    const emptyWhileForging = !m.isWorn(s, 'tool:cangkul');
    const eq = m.equipFromBox(s, 'spare:0'); // wear the spare meanwhile
    s.day = s.forge.ready;
    const got = m.collectUpgrade(s);
    return { forge, emptyWhileForging, eq, got, worn: m.isWorn(s, 'tool:cangkul'), tier: s.toolTier.cangkul ?? 0, spares: s.spareTools };
  });
  expect(r).toEqual({ forge: null, emptyWhileForging: true, eq: null, got: null, worn: true, tier: 0, spares: [{ tool: 'cangkul', tier: 1 }] });
  await press(page, '1');
  expect((await state(page)).tool).toBe('cangkul'); // the spare works while the main one was away
  noErrors(errors);
});

test('alat di bengkel tapi ada cadangan: memilih alatnya langsung memakai cadangan', async ({ page }) => {
  const errors = await start(page);
  await patch(page, "s.spareTools = [{ tool: 'siram', tier: 1 }]; s.unequipped = ['tool:siram']; s.toolTier = {}; s.forge = { tool: 'siram', tier: 1, ready: 99 }");
  await press(page, '2');
  const s = await state(page);
  expect(s.tool).toBe('siram');
  expect(s.toolTier.siram).toBe(1); // the Tembaga spare was the best one in the box
  expect(s.unequipped).toEqual([]);
  expect(s.spareTools).toEqual([]);
  noErrors(errors);
});

test('gua: keluar lalu masuk lagi ke lantai terakhir, batu yang sudah digali tidak muncul lagi', async ({ page }) => {
  const errors = await start(page);
  const r = await page.evaluate(async () => {
    const m = await import('/src/state.ts');
    const s = window.game.registry.get('state');
    m.genFloor(s, 7);
    const before = Object.keys(s.cave.nodes).length;
    delete s.cave.nodes[Object.keys(s.cave.nodes)[0]]; // dig one rock
    return { before, lift: m.liftFloors(s) };
  });
  expect(r.lift).toContain(7);
  await patch(page, "s.ownedTools = ['beliung']");
  await page.evaluate(() => window.game.scene.getScene('farm').enterCave(7));
  await page.waitForTimeout(700);
  expect(Object.keys((await state(page)).cave.nodes).length).toBe(r.before - 1);
  // another floor is fresh
  await page.evaluate(() => window.game.scene.getScene('farm').enterCave(1));
  await page.waitForTimeout(700);
  const s = await state(page);
  expect(s.cave.floor).toBe(1);
  expect(Object.keys(s.cave.nodes).length).toBeGreaterThanOrEqual(14);
  noErrors(errors);
});

test('beli cangkul cadangan di toko: masuk Perlengkapan dan label menghitung cadangan', async ({ page }) => {
  const errors = await start(page);
  await at(page, 40, 7, 'up');
  await press(page, 'Space');
  const texts = () => page.evaluate(() => (window.game.scene.getScene('ui') as any).modalLayer.list.filter((o: any) => o.type === 'Text').map((o: any) => ({ t: o.text, x: o.x, y: o.y })));
  const before = await texts();
  const name = before.find((o) => o.t === 'Cangkul')!;
  expect(before.some((o) => o.t === '300 G · cadangan 0')).toBe(true);
  await page.mouse.click(name.x + 159, name.y + 37); // its "Beli" button
  await page.waitForTimeout(150);
  const s = await state(page);
  expect(s.spareTools).toEqual([{ tool: 'cangkul', tier: 0 }]);
  expect((await texts()).some((o) => o.t === '300 G · cadangan 1')).toBe(true);
  const box = await page.evaluate(async () => (await import('/src/state.ts')).gearBox(window.game.registry.get('state')).map((b) => b.key));
  expect(box).toContain('spare:0');
  noErrors(errors);
});

test('tenaga <= 20: tepi layar berdenyut merah, hilang lagi setelah pulih', async ({ page }) => {
  const errors = await start(page);
  const on = () => page.evaluate(() => !!(window.game.scene.getScene('ui') as any).tiredTween);
  expect(await on()).toBe(false);
  await patch(page, 's.stamina = 20');
  expect(await on()).toBe(true);
  await patch(page, 's.stamina = 80');
  expect(await on()).toBe(false);
  noErrors(errors);
});

test('festival mulai jam 09:00: muncul pemberitahuan di layar, hari biasa tidak', async ({ page }) => {
  const errors = await start(page);
  const shown = () => page.evaluate(() => !!(window.game.scene.getScene('ui') as any).bannerBox?.active);
  await patch(page, 's.day = 6; s.minutes = 8 * 60 + 59');
  await page.waitForTimeout(100);
  await patch(page, 's.minutes = 9 * 60');
  await page.waitForTimeout(100);
  expect(await shown()).toBe(false);
  await patch(page, 's.day = 7; s.minutes = 8 * 60 + 59');
  await page.waitForTimeout(100);
  await patch(page, 's.minutes = 9 * 60');
  await page.waitForTimeout(100);
  expect(await shown()).toBe(true);
  noErrors(errors);
});
