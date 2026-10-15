import Phaser from 'phaser';
import { CAVE_ROOM, HOUSE_TIERS, TILE } from '../../data';

export type Dir = 'down' | 'up' | 'left' | 'right';
export const DIR_VEC: Record<Dir, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
export const SPEED = 62; // world px per second

export type Spot =
  | 'door' | 'shop' | 'bin' | 'pond' | 'lakesign' | 'minesign' | 'ore' | 'cave' | 'descend' | 'pillar' | 'treasure' | 'bengkel' | 'board' | 'coop' | 'stage' | 'house'
  | 'bed' | 'stove' | 'tv' | 'shelf' | 'wardrobe' | 'fridge' | 'storage' | 'radio' | 'trophy' | 'slot'
  | 'mebel' | 'counter' | 'display' | 'sofa';

/** Shown the first time you reach each zone. */
export const ZONE_HINTS = [
  '',
  'Stalaktit menghalangi jalan, Besi lebih banyak.',
  'Ada Kristal Kuarsa. Tangga hanya tersembunyi di batu bijih.',
  'Udara panas: tiap pukulan butuh 3 tenaga. Bawa masakan!',
  'Gelap dan berat (4 tenaga per pukulan). Ada Batu Mulia, dan dasar gua di lantai 50.',
];

/** The farmhouse interior lives in empty world space east of the map (tiles), so all systems just work inside. */
export const ROOM = { x: 100, y: 4, w: 20, h: 12 }; // Rumah Kecil
/** One interior per house tier (renovations), all reached through the farmhouse door. */
export const HOUSE_ROOMS = HOUSE_TIERS.map((t) => (t.x === ROOM.x ? ROOM : { x: t.x, y: 4, w: t.w, h: t.h }));
/** The Toko Mebel interior, further east. */
export const SHOP = { x: 160, y: 4, w: 14, h: 9 }; // far enough that the house never shows at the screen edge
/** Where each room's doormat leads back to outside (world px, facing down). */
export const ROOMS = [
  ...HOUSE_ROOMS.map((room) => ({ room, exit: { x: 4.5 * TILE + 8, y: 7 * TILE - 2 } })),
  { room: SHOP, exit: { x: 58 * TILE, y: 19 * TILE - 2 } },
  { room: CAVE_ROOM, exit: { x: 56.5 * TILE, y: 46 * TILE - 2 } },
];
export const roomAt = (tx: number, ty: number) =>
  ROOMS.find(({ room: r }) => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h);
export const inRoom = (tx: number, ty: number) => !!roomAt(tx, ty);


/** Dashed rounded outline marking an empty furniture slot. */
export function dashed(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  g.fillStyle(0xffffff, 0.12).fillRect(x, y, w, h);
  g.fillStyle(0xfff6dc, 0.7);
  for (let i = 0; i < w; i += 4) {
    g.fillRect(x + i, y, 2, 1);
    g.fillRect(x + i, y + h - 1, 2, 1);
  }
  for (let i = 0; i < h; i += 4) {
    g.fillRect(x, y + i, 1, 2);
    g.fillRect(x + w - 1, y + i, 1, 2);
  }
}
