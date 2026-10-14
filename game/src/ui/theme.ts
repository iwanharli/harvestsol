import Phaser from 'phaser';

// Minimal "glass" look inspired by Apple's UI: translucent white panels, hairline
// borders, soft shadows, system font, one blue accent.

/** Layout is designed for 960x540; the canvas renders at 2x for crisp text and glass. */
export const VIEW = { w: 960, h: 540 };
export const UI_SCALE = 2;

export const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Inter, Roboto, sans-serif';

export const C = {
  ink: '#1d1d1f',
  secondary: '#6e6e73',
  tertiary: '#86868b',
  disabled: '#aeaeb2',
  blue: '#0071e3',
  green: '#248a3d',
  red: '#ff3b30',
  orange: '#c26a00',
  purple: '#8944ab',
  white: '#ffffff',
};

export const HEX = {
  blue: 0x0071e3,
  blueSoft: 0xe8f1fd,
  green: 0x34c759,
  greenSoft: 0xeaf8ee,
  red: 0xff3b30,
  orange: 0xff9f0a,
  purple: 0xbf5af2,
  well: 0xf2f2f5,
  hairline: 0x000000,
};

export const txt = (size: number, color = C.ink, bold = true): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: FONT,
  fontSize: `${size}px`,
  color,
  fontStyle: bold ? '600' : 'normal',
  resolution: 2,
});

/** Soft, wide drop shadow made of a few faint layers. */
function shadow(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, r: number, depth: number) {
  for (let i = depth; i > 0; i -= 2) {
    g.fillStyle(0x000000, 0.018);
    g.fillRoundedRect(x - i / 2, y - i / 2 + i * 0.6, w + i, h + i, r + i / 2);
  }
}

/** Frosted glass panel: translucent white, a bright top edge and a hairline border. */
export function glass(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  r = 18,
  opts: { alpha?: number; shadow?: number } = {},
) {
  const { alpha = 0.78, shadow: depth = 14 } = opts;
  if (depth) shadow(g, x, y, w, h, r, depth);
  g.fillStyle(0xffffff, alpha).fillRoundedRect(x, y, w, h, r);
  g.fillStyle(0xffffff, 0.35).fillRoundedRect(x + 1, y + 1, w - 2, Math.min(h / 2, 28), { tl: r - 1, tr: r - 1, bl: 0, br: 0 });
  g.lineStyle(1, 0xffffff, 0.9).strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
  g.lineStyle(1, HEX.hairline, 0.08).strokeRoundedRect(x - 0.5, y - 0.5, w + 1, h + 1, r + 0.5);
  return g;
}

export type CardState = 'normal' | 'selected' | 'ready' | 'locked' | 'muted' | 'today' | 'alert';

/** A card or slot inside a glass panel. */
export function card(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, state: CardState = 'normal', r = 14) {
  const fill: Record<CardState, [number, number]> = {
    normal: [0xffffff, 0.82],
    selected: [0xffffff, 1],
    ready: [HEX.greenSoft, 0.95],
    locked: [0xf2f2f5, 0.55],
    muted: [0xf5f5f7, 0.6],
    today: [HEX.blueSoft, 0.95],
    alert: [0xffffff, 0.9],
  };
  const [col, a] = fill[state];
  if (state === 'selected' || state === 'today') shadow(g, x, y, w, h, r, 6);
  g.fillStyle(col, a).fillRoundedRect(x, y, w, h, r);
  if (state === 'selected' || state === 'today') g.lineStyle(2, HEX.blue, 1).strokeRoundedRect(x, y, w, h, r);
  else if (state === 'ready') g.lineStyle(1.5, HEX.green, 0.9).strokeRoundedRect(x, y, w, h, r);
  else if (state === 'alert') g.lineStyle(1.5, HEX.red, 0.7).strokeRoundedRect(x, y, w, h, r);
  else g.lineStyle(1, HEX.hairline, state === 'locked' || state === 'muted' ? 0.05 : 0.08).strokeRoundedRect(x, y, w, h, r);
  return g;
}

/** Round grey well behind an icon. */
export function well(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, faded = false) {
  g.fillStyle(HEX.well, faded ? 0.6 : 1).fillCircle(cx, cy, r);
  return g;
}

/** Thin progress bar with a rounded track. */
export function bar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, frac: number, color: number) {
  g.fillStyle(HEX.hairline, 0.08).fillRoundedRect(x, y, w, 8, 4);
  const fw = Math.max(0, Math.min(1, frac)) * w;
  if (fw > 0) g.fillStyle(color, 1).fillRoundedRect(x, y, Math.max(8, fw), 8, 4);
}

/**
 * iOS-style segmented control. Returns the objects to add to a container.
 * `onPick(i)` fires when another segment is tapped.
 */
export function segmented(
  scene: Phaser.Scene,
  x: number,
  y: number,
  labels: string[],
  active: number,
  onPick: (i: number) => void,
  segW = 112,
) {
  const h = 32;
  const out: Phaser.GameObjects.GameObject[] = [];
  const g = scene.add.graphics();
  g.fillStyle(0x767680, 0.12).fillRoundedRect(x, y, labels.length * segW + 4, h, 9);
  const ax = x + 2 + active * segW;
  g.fillStyle(0x000000, 0.06).fillRoundedRect(ax, y + 3, segW, h - 4, 7);
  g.fillStyle(0xffffff, 1).fillRoundedRect(ax, y + 2, segW, h - 4, 7);
  out.push(g);
  labels.forEach((label, i) => {
    out.push(scene.add.text(x + 2 + i * segW + segW / 2, y + h / 2, label, txt(13, i === active ? C.ink : C.secondary, i === active)).setOrigin(0.5));
    const z = scene.add.zone(x + 2 + i * segW, y, segW, h).setOrigin(0).setInteractive({ useHandCursor: true });
    z.on('pointerdown', () => i !== active && onPick(i));
    out.push(z);
  });
  return out;
}
