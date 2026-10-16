import Phaser from 'phaser';
import { CAVE_ROOM, caveTint, zoneOf, zoneIndex, CAVE_BOTTOM, TILE } from '../../data';
import { plotKey, genFloor } from '../../state';
import { ZONE_HINTS } from './common';
import type { FarmScene } from '../FarmScene';

export function refreshCave(scene: FarmScene) {
    for (const [k, img] of scene.mineImgs) {
      img.destroy();
      scene.blocked.delete(k);
      scene.spots.delete(k);
    }
    scene.mineImgs.clear();
    const cave = scene.state.cave;
    if (!cave?.floor) return;
    for (const [k, n] of Object.entries(cave.nodes)) {
      const [x, y] = k.split(',').map(Number);
      scene.mineImgs.set(k, scene.add.image((x + 0.5) * TILE, (y + 1) * TILE, `rock-${n.ore}`).setOrigin(0.5, 1).setDepth((y + 1) * TILE));
      scene.blocked.add(k);
      scene.spots.set(k, 'ore');
    }
    for (const k of cave.pillars ?? []) {
      const [x, y] = k.split(',').map(Number);
      scene.mineImgs.set(k, scene.add.image((x + 0.5) * TILE, (y + 1) * TILE, 'stalaktit').setOrigin(0.5, 1).setDepth((y + 1) * TILE));
      scene.blocked.add(k);
      scene.spots.set(k, 'pillar');
    }
    if (cave.chest) {
      const [x, y] = cave.chest.split(',').map(Number);
      scene.mineImgs.set(cave.chest, scene.add.image((x + 0.5) * TILE, (y + 1) * TILE, 'peti-harta').setOrigin(0.5, 1).setDepth((y + 1) * TILE));
      scene.blocked.add(cave.chest);
      scene.spots.set(cave.chest, 'treasure');
    }
    if (cave.ladderOpen) {
      const [x, y] = cave.ladder.split(',').map(Number);
      scene.mineImgs.set(cave.ladder, scene.add.image(x * TILE, y * TILE, 'ladder-down').setOrigin(0).setDepth(-8));
      scene.blocked.add(cave.ladder);
      scene.spots.set(cave.ladder, 'descend');
    }
    const tint = caveTint(cave.floor);
    for (const img of scene.caveFloorImgs) img.setTint(tint);
    const zone = zoneOf(cave.floor);
    scene.caveLabel?.setText(`Lantai ${cave.floor} · ${zone.name}${cave.floor >= CAVE_BOTTOM ? ' · Dasar' : ''}`);
    scene.caveDark?.setFillStyle(0x05030a, zone.dark);
}

export function buildCave(scene: FarmScene) {
    const R = CAVE_ROOM;
    const X = (lx: number) => (R.x + lx) * TILE;
    const Y = (ly: number) => (R.y + ly) * TILE;
    // a ring of solid rock outside the room, so the edges fade into darkness
    scene.add.rectangle(X(-6), Y(-6), (R.w + 12) * TILE, (R.h + 12) * TILE, 0x0e0b09).setOrigin(0).setDepth(-11);
    const hash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
    for (let ly = 0; ly < R.h; ly++)
      for (let lx = 0; lx < R.w; lx++) {
        const side = lx === 0 || lx === R.w - 1;
        const wall = ly < 2 || side;
        const h = hash(lx, ly);
        const key = side ? 'cave-side' : ly === 0 ? 'cave-face' : ly === 1 ? 'cave-face-base' : (h >> 3) % 9 < 6 ? 'cave-floor-0' : `cave-floor-${1 + ((h >> 5) % 3)}`;
        const img = scene.add.image(X(lx), Y(ly), key).setOrigin(0).setDepth(-10);
        if (!side && h % 2) img.setFlipX(true);
        scene.caveFloorImgs.push(img);
        if (wall) scene.blocked.add(plotKey(R.x + lx, R.y + ly));
        // scattered decor on open floor (walkable, drawn flat under everything)
        if (!wall && ly < R.h - 2 && h % 23 === 0) {
          const deco = ['cave-crystal', 'cave-shroom', 'cave-bones'][h % 3];
          const d = scene.add.image(X(lx) + 8, Y(ly) + 16, deco).setOrigin(0.5, 1).setDepth(-9).setScale(0.75);
          scene.caveFloorImgs.push(d);
        }
      }
    // soft shadow along the walls, so the room has depth
    const sh = scene.add.graphics().setDepth(-9.5);
    for (let i = 0; i < 6; i++) {
      const a = 0.09 * (1 - i / 6);
      sh.fillStyle(0x000000, a);
      sh.fillRect(X(1), Y(2) + i * 2, (R.w - 2) * TILE, 2); // below the back wall
      sh.fillRect(X(1) + i * 2, Y(2), 2, (R.h - 2) * TILE); // left
      sh.fillRect(X(R.w - 1) - (i + 1) * 2, Y(2), 2, (R.h - 2) * TILE); // right
    }
    const mid = R.w / 2;
    scene.add.image(X(mid), Y(R.h), 'ladder-up').setOrigin(0.5, 1).setDepth(-8.5);
    scene.caveLabel = scene.add
      .text(X(mid), Y(1) + 4, '', { fontFamily: 'monospace', fontSize: '9px', color: '#f2dcb0', stroke: '#2a1d17', strokeThickness: 3 })
      .setOrigin(0.5)
      .setResolution(4)
      .setDepth(-8);
    // deeper zones are darker; the lantern around the player still shows the way
    scene.caveDark = scene.add.rectangle(X(0) - 8, Y(0) - 8, R.w * TILE + 16, R.h * TILE + 16, 0x05030a, 0).setOrigin(0).setDepth(9500);
    // a few lanterns on the back wall
    for (const lx of [3, mid, R.w - 4]) {
      scene.add.image(X(lx), Y(2) - 2, 'lamp').setOrigin(0.5, 1).setScale(0.8).setDepth(-8.4);
      scene.add.image(X(lx), Y(1), 'glow').setScale(1.2).setBlendMode(Phaser.BlendModes.ADD).setDepth(9600).setAlpha(0.55);
    }
}

export function enterCave(scene: FarmScene, floor: number) {
    if (!scene.state.ownedTools.includes('beliung')) return scene.fail('Gua tambang gelap dan berbatu. Bawa Beliung dulu (beli di Toko Peralatan).');
    const R = CAVE_ROOM;
    const before = zoneIndex(scene.state.cave?.deepest ?? 0);
    scene.moveTo((R.x + R.w / 2) * TILE, (R.y + R.h - 1) * TILE - 2, 'up', () => {
      genFloor(scene.state, floor);
      scene.refreshCave();
    });
    const z = zoneOf(floor);
    const first = floor === z.from && zoneIndex(floor) > before;
    if (floor >= CAVE_BOTTOM) scene.toast(scene.state.caveTreasure ? 'Dasar gua. Petinya sudah kamu buka.' : 'Dasar gua! Ada peti harta di sini...');
    else if (first) scene.toast(`Zona baru: ${z.name}! ${ZONE_HINTS[zoneIndex(floor)]}`);
    else scene.toast(`Gua Tambang · Lantai ${floor} · ${z.name}`);
}
