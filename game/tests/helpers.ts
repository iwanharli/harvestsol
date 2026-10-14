import { expect, type Page } from '@playwright/test';

type Dir = 'up' | 'down' | 'left' | 'right';

/** Game state as plain JSON (a snapshot, not a live reference). */
export type State = Record<string, any>;

declare global {
  interface Window {
    game: any;
    __toasts: string[];
    __errors: string[];
  }
}

/** Fresh save, welcome window closed, toasts and page errors recorded. */
export async function start(page: Page, query = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?reset');
  await page.waitForFunction(() => window.game?.scene?.getScene('ui')?.sys.isActive());
  if (query) {
    await page.goto(`/${query}`);
    await page.waitForFunction(() => window.game?.scene?.getScene('ui')?.sys.isActive());
  }
  await page.evaluate(() => {
    window.__toasts = [];
    window.game.events.on('toast', (m: string) => window.__toasts.push(m));
    (window.game.scene.getScene('ui') as any).closeModal();
  });
  return errors;
}

export const state = (page: Page): Promise<State> =>
  page.evaluate(() => JSON.parse(JSON.stringify(window.game.registry.get('state'))));

/** Mutate the live state in the page, then refresh the HUD. */
export async function patch(page: Page, fn: string) {
  await page.evaluate((src) => {
    const s = window.game.registry.get('state');
    new Function('s', src)(s);
    window.game.events.emit('hud');
  }, fn);
}

/** Stand on tile (x, y) facing `dir`. */
export async function at(page: Page, x: number, y: number, dir: Dir) {
  await page.evaluate(
    ([x, y, dir]) => {
      const f = window.game.scene.getScene('farm');
      f.player.setPosition((x + 0.5) * 16, (y + 1) * 16 - 2);
      f.dir = dir;
    },
    [x, y, dir] as const,
  );
}

export async function press(page: Page, key: string) {
  await page.keyboard.press(key);
  await page.waitForTimeout(60);
}

/** Use tool slot (1-5) on the tile the player faces. */
export async function use(page: Page, slot: number) {
  await press(page, String(slot));
  await press(page, 'Space');
}

/**
 * Sleep through the night and close the morning report.
 * Tomorrow is forced clear so random rain cannot water plots behind a test's back;
 * weather tests pass keepForecast to use the forecast they set.
 */
export async function sleep(page: Page, keepForecast = false) {
  if (!keepForecast) await page.evaluate(() => (window.game.registry.get('state').forecasts[0] = 'cerah'));
  await page.evaluate(() => window.game.scene.getScene('farm').sleep());
  await page.waitForFunction(() => window.game.registry.get('modal') === true);
  await page.evaluate(() => (window.game.scene.getScene('ui') as any).closeModal());
}

export const toasts = (page: Page): Promise<string[]> => page.evaluate(() => window.__toasts);
export const modalOpen = (page: Page): Promise<boolean> => page.evaluate(() => window.game.registry.get('modal') === true);

export function noErrors(errors: string[]) {
  expect(errors, 'page errors').toEqual([]);
}
