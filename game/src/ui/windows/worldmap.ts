import { LAKES, MAP_H, MAP_W, TILE, type Water } from '../../data';
import { C, HEX, card, txt } from '../theme';
import type { UIScene } from '../../scenes/UIScene';

/** Pixels per tile in the minimap texture painted by the farm scene. */
export const MAP_PX = 4;

/** Named places, in world tiles. */
const PLACES: { name: string; x: number; y: number; lake?: Water }[] = [
  { name: 'Rumah', x: 5, y: 3 },
  { name: 'Ladang', x: 16, y: 12 },
  { name: 'Alun-alun', x: 47, y: 10 },
  { name: 'Toko Mebel', x: 58, y: 16 },
  { name: 'Hutan', x: 55, y: 33 },
  { name: 'Kolam', x: 26, y: 12, lake: 'kolam' },
  { name: 'Danau Sirep', x: 24, y: 31, lake: 'danau' },
  { name: 'Rawa Gambut', x: 13, y: 47, lake: 'rawa' },
  { name: 'Telaga Kabut', x: 11, y: 62, lake: 'telaga' },
  { name: 'Waduk Kedung Lali', x: 34, y: 58, lake: 'waduk' },
  { name: 'Muara Payau', x: 56, y: 64, lake: 'muara' },
];

/** The world map: the whole world at a glance, named places, and where you are. */
export function openWorldMap(ui: UIScene) {
  const W = 700, H = 500;
  const { c, x, y } = ui.openModal(W, H, 'Peta Desa', 'worldmap');

  // the map picture, scaled to fit the left side
  const mh = H - 120, scale = mh / (MAP_H * MAP_PX);
  const mw = MAP_W * MAP_PX * scale;
  const mx = x + 24, my = y + 58;
  const frame = ui.add.graphics();
  card(frame, mx - 6, my - 6, mw + 12, mh + 12, 'normal', 14);
  c.add(frame);
  c.add(ui.add.image(mx, my, 'minimap').setOrigin(0).setScale(scale));
  const at = (tx: number, ty: number) => ({ px: mx + (tx + 0.5) * MAP_PX * scale, py: my + (ty + 0.5) * MAP_PX * scale });

  // labels on the map
  for (const p of PLACES) {
    const { px, py } = at(p.x, p.y);
    const t = ui.add.text(px, py, p.name, { ...txt(9, C.ink), stroke: '#ffffff', strokeThickness: 3 }).setOrigin(0.5);
    c.add(t);
  }

  // you are here: the farm scene's player, or the door of the building you are inside
  const farm = ui.scene.get('farm') as unknown as { player: { x: number; y: number } };
  let tx = Math.floor(farm.player.x / TILE), ty = Math.floor(farm.player.y / TILE);
  const indoors = !!ui.registry.get('indoors');
  if (tx >= MAP_W) [tx, ty] = tx >= 150 && tx < 200 ? [57, 18] : [4, 6];
  const { px, py } = at(tx, ty);
  const ring = ui.add.circle(px, py, 9, HEX.red, 0.3);
  const dot = ui.add.circle(px, py, 4.5, HEX.red).setStrokeStyle(2, 0xffffff);
  c.add([ring, dot]);
  ui.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 1100, repeat: -1 });

  // right: legend and the list of lakes
  const lx = mx + mw + 30, lw = x + W - 24 - lx;
  let ly = y + 58;
  c.add(ui.add.text(lx, ly, indoors ? 'Kamu di dalam ruangan' : 'Kamu di sini', txt(13, C.red)));
  ly += 30;
  c.add(ui.add.text(lx, ly, 'Perairan', txt(13)));
  ly += 22;
  for (const id of Object.keys(LAKES) as Water[]) {
    const g = ui.add.graphics();
    const t = LAKES[id].tint, base = 0x4a90d8;
    const mix = (sh: number) => Math.round((((base >> sh) & 255) * ((t >> sh) & 255)) / 255) << sh;
    g.fillStyle(mix(16) | mix(8) | mix(0), 1).fillRoundedRect(lx, ly + 2, 14, 14, 4);
    c.add(g);
    c.add(ui.add.text(lx + 22, ly, LAKES[id].name, { ...txt(12, C.ink, false), wordWrap: { width: lw - 22 } }));
    ly += 22;
  }
  ly += 10;
  c.add(ui.add.text(lx, ly, 'Lainnya', txt(13)));
  ly += 22;
  for (const [col, name] of [[0x5b9440, 'Ladang'], [0xd8b67e, 'Jalan'], [0x2f6b34, 'Pohon'], [0xa5623e, 'Bangunan']] as const) {
    const g = ui.add.graphics();
    g.fillStyle(col, 1).fillRoundedRect(lx, ly + 2, 14, 14, 4);
    c.add(g);
    c.add(ui.add.text(lx + 22, ly, name, txt(12, C.ink, false)));
    ly += 22;
  }
  c.add(ui.add.text(lx, y + H - 92, 'Tekan P untuk membuka/menutup peta.', { ...txt(11, C.tertiary, false), wordWrap: { width: lw } }));
  ui.button(c, x + W - 144, y + H - 52, 'Tutup', () => ui.closeModal(), 120);
}
