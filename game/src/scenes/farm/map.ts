import Phaser from 'phaser';
import { FIELD, MAP_H, QUARRY, LAKES, type Water, NPC_HOMES, MAP_W, TILE, FEATURE_LEVEL } from '../../data';
import { plotKey } from '../../state';
import { MAP_PX } from '../../ui/windows/worldmap';
import type { FarmScene } from '../FarmScene';

export function buildMap(scene: FarmScene) {
    const r = new Phaser.Math.RandomDataGenerator(['cropfarm']);

    // ---- ground plan: g grass, p path, s stone, d sand, w water, k dock ----
    const G: string[][] = Array.from({ length: MAP_H }, () => Array<string>(MAP_W).fill('g'));
    const set = (x: number, y: number, t: string) => {
      if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) G[y][x] = t;
    };
    const rect = (x0: number, y0: number, x1: number, y1: number, t: string) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t);
    };

    // lakes, each ringed with sand: Danau Sirep south of the village, the far ones further south
    const water = (x: number, y: number, id: Water) => {
      set(x, y, 'w');
      if (G[y]?.[x] === 'w') scene.waterAt.set(plotKey(x, y), id);
    };
    const blob = (cx: number, cy: number, rx: number, ry: number, id: Water, wobble = 0) => {
      for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++)
        for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
          const ang = Math.atan2(y - cy, x - cx);
          const k = 1 + wobble * Math.sin(ang * 3 + cx) * 0.5;
          if (((x - cx) / (rx * k)) ** 2 + ((y - cy) / (ry * k)) ** 2 < 1) water(x, y, id);
        }
    };
    blob(24, 31, 13, 5.2, 'danau');
    blob(34, 33.5, 7, 3.6, 'danau');
    blob(13, 47, 8, 4, 'rawa', 0.35); // ragged swamp
    blob(20, 50, 4, 2.6, 'rawa', 0.3);
    blob(11, 62, 6, 4, 'telaga');
    blob(34, 58, 11, 5, 'waduk');
    blob(57, 64, 8, 5, 'muara', 0.2);
    for (let y = 60; y <= 66; y++) for (let x = 60; x < MAP_W; x++) water(x, y, 'muara'); // the river mouth runs off the map
    for (let y = 1; y < MAP_H - 1; y++)
      for (let x = 1; x < MAP_W - 1; x++) {
        if (G[y][x] === 'w') continue;
        let near = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (G[y + dy][x + dx] === 'w') near = true;
        if (near) set(x, y, 'd');
      }

    // roads
    rect(4, 6, 5, 6, 'p'); // farmhouse door
    rect(4, 7, 41, 7, 'p'); // farm → village
    rect(4, 8, 4, 23, 'p'); // farm → lake
    rect(4, 23, 24, 23, 'p');
    rect(24, 24, 24, 24, 'p');
    rect(53, 7, 57, 7, 'p'); // plaza → Pak Darto
    rect(37, 6, 38, 6, 'p'); // Bu Sari's door
    rect(55, 6, 56, 6, 'p'); // Pak Darto's door
    rect(53, 13, 58, 13, 'p'); // plaza → Mbak Rani
    rect(47, 15, 47, 30, 'p'); // plaza → south road → forest clearing
    rect(40, 22, 58, 22, 'p');
    rect(57, 18, 58, 21, 'p'); // to the Toko Mebel door
    rect(42, 7, 52, 14, 's'); // village plaza
    for (let y = 26; y <= 29; y++) set(24, y, 'k'); // dock
    // the southern lakes: the forest road continues south, a long east-west road links them
    rect(47, 30, 47, 69, 'p');
    rect(3, 38, 47, 38, 'p');
    rect(3, 39, 3, 69, 'p');
    rect(3, 54, 47, 54, 'p');
        rect(22, 64, 46, 64, 's'); // the waduk's dam
    rect(18, 66, 47, 66, 'p');
    rect(48, 63, 52, 63, 'k'); // a jetty into the muara
    // Tambang Bukit Kapur: a gravel quarry in the east woods, reached from the south road
    rect(QUARRY.x, QUARRY.y, QUARRY.x + QUARRY.w - 1, QUARRY.y + QUARRY.h - 1, 'q');
    rect(48, 38, 51, 38, 'p'); // in front of the Bengkel
    rect(48, QUARRY.y + Math.floor(QUARRY.h / 2), QUARRY.x - 1, QUARRY.y + Math.floor(QUARRY.h / 2), 'p');

    // forest clearing with flowers
    const clearing = { x: 54, y: 32, r: 3.2 };

    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        const t = G[y][x];
        const X = x * TILE, Y = y * TILE;
        if (t === 'w') {
          const lake = scene.waterAt.get(plotKey(x, y)) ?? 'danau';
          scene.waterImgs.push(scene.add.image(X, Y, 'water0').setOrigin(0).setDepth(-9).setTint(LAKES[lake].tint));
          if (y > 0 && G[y - 1][x] !== 'w' && G[y - 1][x] !== 'k') scene.add.image(X, Y, 'shore').setOrigin(0).setDepth(-8.8);
          scene.block(x, y, 'pond');
          continue;
        }
        let key = 'grass0';
        if (t === 'p') key = 'path';
        else if (t === 's') key = 'stone';
        else if (t === 'd') key = 'sand';
        else if (t === 'k') key = 'plank';
        else if (t === 'q') key = 'gravel';
        else {
          const inClearing = Math.hypot(x - clearing.x, y - clearing.y) < clearing.r;
          const n = r.frac();
          key = inClearing ? (n < 0.5 ? 'grass2' : 'grass3') : n < 0.06 ? 'grass2' : n < 0.12 ? 'grass3' : n < 0.38 ? 'grass1' : 'grass0';
        }
        scene.add.image(X, Y, key).setOrigin(0).setDepth(-10);
      }

    // field area: slightly darker grass so players know where they can till
    scene.add
      .rectangle(FIELD.x * TILE, FIELD.y * TILE, FIELD.w * TILE, FIELD.h * TILE, 0x3f7a2a, 0.2)
      .setOrigin(0)
      .setDepth(-9);

    // farm pond with a sandy rim and lily pads
    const pond = { x: 25, y: 11, w: 3, h: 4 };
    scene.add
      .rectangle(pond.x * TILE - 2, pond.y * TILE - 2, pond.w * TILE + 4, pond.h * TILE + 4, 0xe6cf9a)
      .setOrigin(0)
      .setDepth(-9.5);
    for (let y = pond.y; y < pond.y + pond.h; y++)
      for (let x = pond.x; x < pond.x + pond.w; x++) {
        scene.waterImgs.push(scene.add.image(x * TILE, y * TILE, 'water0').setOrigin(0).setDepth(-9));
        scene.waterAt.set(plotKey(x, y), 'kolam');
        scene.block(x, y, 'pond');
      }
    scene.add.rectangle(pond.x * TILE, pond.y * TILE, pond.w * TILE, 2, 0x2f7fb8).setOrigin(0).setDepth(-8.9);
    scene.add.image(25.6 * TILE, 12.4 * TILE, 'lily').setDepth(-8.5);
    scene.add.image(27.2 * TILE, 14.1 * TILE, 'lily').setDepth(-8.5).setFlipX(true);

    // lake dressing: lily pads, reeds on the sand
    for (const [x, y] of [[15, 29], [19, 33], [30, 28], [36, 33], [27, 34], [12, 31]]) {
      if (G[y][x] === 'w') scene.add.image((x + 0.5) * TILE, (y + 0.5) * TILE, 'lily').setDepth(-8.5).setFlipX(x % 2 === 0);
    }
    for (let y = 22; y < MAP_H - 1; y++)
      for (let x = 2; x < MAP_W - 1; x++)
        if (G[y][x] === 'd' && (x * 7 + y * 13) % 5 === 0)
          scene.add.image((x + 0.5) * TILE, (y + 1) * TILE, 'reeds').setOrigin(0.5, 1).setDepth((y + 1) * TILE - 2);

    // a signpost with its name at every lake
    for (const [id, x, y] of [['kolam', 28, 13], ['danau', 25, 24], ['rawa', 4, 44], ['telaga', 4, 61], ['waduk', 46, 56], ['muara', 46, 61]] as const) {
      scene.add.image((x + 0.5) * TILE, (y + 1) * TILE, 'signpost').setOrigin(0.5, 1).setDepth((y + 1) * TILE);
      scene.block(x, y, 'lakesign');
      scene.lakeSigns.set(plotKey(x, y), id);
    }
    const mx = QUARRY.x - 2, my = QUARRY.y + Math.floor(QUARRY.h / 2) - 1;
    scene.add.image((mx + 0.5) * TILE, (my + 1) * TILE, 'signpost').setOrigin(0.5, 1).setDepth((my + 1) * TILE);
    scene.block(mx, my, 'minesign');
    // the cave mouth at the back of the yard (3 tiles wide), entered from the row in front of it
    scene.add.image(56.5 * TILE, 45 * TILE, 'cave-mouth').setOrigin(0.5, 1).setDepth(45 * TILE);
    for (let x = 55; x <= 57; x++) for (let y = 42; y <= 44; y++) scene.block(x, y, y === 44 ? 'cave' : undefined);
    // the kerekan beside it: a rope-and-pulley basket down to the floors you have reached
    scene.add.image(58.5 * TILE, 45 * TILE, 'kerekan').setOrigin(0.5, 1).setDepth(45 * TILE);
    scene.block(58, 44, 'cave');

    // farmhouse (4x4 tiles), door on bottom row
    scene.building('house', 3, 2);
    scene.spots.set(plotKey(4, 5), 'door').set(plotKey(5, 5), 'door');
    scene.windowGlow(3, 2);

    // villager houses
    for (const h of NPC_HOMES) {
      scene.building(h.tex, h.x, h.y);
      scene.spots.set(plotKey(h.x + 1, h.y + 3), 'house').set(plotKey(h.x + 2, h.y + 3), 'house');
      scene.houseOwner.set(plotKey(h.x + 1, h.y + 3), h.npc).set(plotKey(h.x + 2, h.y + 3), h.npc);
      scene.windowGlow(h.x, h.y);
    }

    // Toko Mebel, east of the village, with its own path to the south road
    scene.building('house-mebel', 56, 14);
    scene.spots.set(plotKey(57, 17), 'mebel').set(plotKey(58, 17), 'mebel');
    scene.windowGlow(56, 14);
    scene.add.image(58 * TILE, 14 * TILE + 30, 'sign-mebel').setOrigin(0.5, 0.5).setDepth(18 * TILE + 1);
    scene.add
      .text(58 * TILE, 14 * TILE + 30, 'MEBEL', { fontFamily: 'monospace', fontSize: '8px', color: '#1a5a56', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setResolution(4)
      .setDepth(18 * TILE + 2);

    // Bengkel Pandai Besi: an open smithy beside the road south to the cave
    scene.shadow(50 * TILE, 38 * TILE - 1, 66);
    scene.add.image(50 * TILE, 38 * TILE, 'smithy').setOrigin(0.5, 1).setDepth(36 * TILE);
    scene.add
      .text(50 * TILE, 33 * TILE + 13, 'BENGKEL', { fontFamily: 'monospace', fontSize: '7px', color: '#fffbe6', stroke: '#26262c', strokeThickness: 3, fontStyle: 'bold' })
      .setOrigin(0.5)
      .setResolution(4)
      .setDepth(36 * TILE + 1);
    for (let x = 48; x <= 51; x++) for (let y = 34; y <= 37; y++) scene.block(x, y, y === 37 && (x === 49 || x === 50) ? 'bengkel' : undefined);
    const fire = scene.add.image(48.5 * TILE - 1, 37 * TILE - 2, 'forge-fire').setOrigin(0.5, 1).setDepth(36 * TILE + 2);
    const fireGlow = scene.add.image(48.5 * TILE, 36.6 * TILE, 'glow').setScale(1.1).setBlendMode(Phaser.BlendModes.ADD).setDepth(9600);
    const smith = scene.add.image(50.3 * TILE, 38 * TILE - 1, 'npc-smith-0').setOrigin(0.5, 1).setDepth(37 * TILE + 4);
    const anvil = scene.add.image(49.3 * TILE, 38 * TILE, 'anvil').setOrigin(0.5, 1).setDepth(37 * TILE + 3);
    const hammer = scene.add.image(50 * TILE, 37 * TILE + 6, 'smith-hammer').setOrigin(0.9, 0.5).setDepth(37 * TILE + 5);
    scene.tweens.add({ targets: fire, scaleY: 1.15, alpha: 0.85, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    // the smith swings: hammer up, then down onto the anvil with a few sparks
    scene.tweens.add({
      targets: hammer,
      angle: { from: 70, to: -10 },
      duration: 220,
      hold: 60,
      repeatDelay: 420,
      yoyo: true,
      repeat: -1,
      ease: 'Quad.In',
      onYoyo: () => {
        if (!scene.smithy.open) return;
        for (let i = 0; i < 4; i++) {
          const sp = scene.add.rectangle(anvil.x + 2, anvil.y - 11, 1.5, 1.5, i % 2 ? 0xfff3a8 : 0xf8a03a).setDepth(37 * TILE + 6);
          scene.tweens.add({ targets: sp, x: sp.x + Phaser.Math.Between(-10, 10), y: sp.y - Phaser.Math.Between(4, 12), alpha: 0, duration: 380, onComplete: () => sp.destroy() });
        }
      },
    });
    scene.smithy = { open: true, parts: [smith, hammer], fire, fireGlow };

    // plaza: shop, board, stage, fountain, lamps, benches, flowers
    scene.shadow(47 * TILE, 7 * TILE - 1, 36);
    scene.add.image(46 * TILE, 5 * TILE, 'shop').setOrigin(0).setDepth(7 * TILE);
    for (let y = 5; y <= 6; y++) for (let x = 46; x <= 47; x++) scene.block(x, y, 'shop');
    // tools & clothes stall, left of the board
    scene.shadow(41 * TILE, 7 * TILE - 1, 36);
    scene.add.image(40 * TILE, 5 * TILE, 'shop-alat').setOrigin(0).setDepth(7 * TILE);
    for (let y = 5; y <= 6; y++) for (let x = 40; x <= 41; x++) scene.block(x, y, 'shop-alat');

    scene.shadow(44 * TILE, 7 * TILE - 1, 22);
    scene.add.image(44 * TILE, 7 * TILE, 'board').setOrigin(0.5, 1).setDepth(7 * TILE);
    scene.block(43, 6, 'board');
    scene.block(44, 6, 'board');
    scene.boardBubble = scene.add.image(44 * TILE, 7 * TILE - 34, 'bubble').setDepth(9200).setVisible(false);
    scene.tweens.add({ targets: scene.boardBubble, y: scene.boardBubble.y - 3, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    scene.shadow(50.5 * TILE, 7 * TILE - 1, 50);
    scene.add.image(50.5 * TILE, 7 * TILE, 'stage').setOrigin(0.5, 1).setDepth(7 * TILE);
    for (let y = 5; y <= 6; y++) for (let x = 49; x <= 51; x++) scene.block(x, y, 'stage');
    scene.bunting = scene.add.image(50.5 * TILE, 4 * TILE + 6, 'bunting').setDepth(7 * TILE + 1);

    scene.add.image(47.5 * TILE, 13 * TILE, 'fountain').setOrigin(0.5, 1).setDepth(13 * TILE);
    for (let y = 11; y <= 12; y++) for (let x = 46; x <= 48; x++) scene.block(x, y);

    for (const [x, y] of [[42, 8], [52, 8], [42, 14], [52, 14], [40, 22], [54, 22], [24, 24]]) {
      scene.add.image((x + 0.5) * TILE, (y + 1) * TILE, 'lamp').setOrigin(0.5, 1).setDepth((y + 1) * TILE);
      scene.block(x, y);
      scene.lamps.push(scene.add.image((x + 0.5) * TILE, y * TILE - 8, 'glow').setScale(0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(9600).setAlpha(0));
    }
    for (const [x, y] of [[44, 13], [49, 13]]) {
      scene.add.image((x + 1) * TILE, (y + 1) * TILE, 'bench').setOrigin(0.5, 1).setDepth((y + 1) * TILE);
      scene.block(x, y);
      scene.block(x + 1, y);
    }
    for (const [x, y] of [[43, 9], [51, 9], [43, 10], [51, 10]]) scene.deco('flowerbed', x, y, false);
    scene.add.image(39 * TILE, 12 * TILE, 'well').setOrigin(0.5, 1).setDepth(12 * TILE);
    scene.block(38, 11);
    scene.block(39, 11);

    // chicken coop (locked until FEATURE_LEVEL.coop)
    scene.shadow(25.5 * TILE, 10 * TILE - 1, 50);
    scene.add.image(24 * TILE, 10 * TILE, 'coop').setOrigin(0, 1).setDepth(10 * TILE);
    for (let y = 8; y <= 9; y++) for (let x = 24; x <= 26; x++) scene.block(x, y, 'coop');
    scene.coopLock = scene.add.image(27.5 * TILE, 10 * TILE, 'sign-lock').setOrigin(0.5, 1).setDepth(10 * TILE + 1);
    scene.coopLockText = scene.add
      .text(27.5 * TILE, 10 * TILE - 22, `Lv ${FEATURE_LEVEL.coop}`, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#fffbe6',
        stroke: '#2a1d17',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 1)
      .setDepth(10 * TILE + 2)
      .setResolution(4);

    // shipping bin
    scene.shadow(8.5 * TILE, 7 * TILE - 1, 18);
    scene.add.image(8 * TILE, 6 * TILE, 'bin').setOrigin(0).setDepth(7 * TILE);
    scene.block(8, 6, 'bin');

    // fence below the field
    for (let x = FIELD.x - 1; x <= FIELD.x + FIELD.w; x++) {
      scene.add.image(x * TILE, (FIELD.y + FIELD.h) * TILE, 'fence').setOrigin(0).setDepth((FIELD.y + FIELD.h + 1) * TILE);
      scene.block(x, FIELD.y + FIELD.h);
    }

    // trees: world border, farm, village, and a forest in the south-east
    const free = (x: number, y: number) => G[y]?.[x] === 'g' && !scene.blocked.has(plotKey(x, y));
    const tree = (x: number, y: number, fruit = false) => {
      if (!free(x, y)) return;
      scene.shadow((x + 0.5) * TILE, (y + 1) * TILE - 2, 26);
      scene.add.image((x + 0.5) * TILE, (y + 1) * TILE, fruit ? 'tree-fruit' : 'tree').setOrigin(0.5, 1).setDepth((y + 1) * TILE);
      scene.block(x, y);
      scene.treeTiles.add(plotKey(x, y));
    };
    for (let x = 0; x < MAP_W; x += 2) {
      tree(x, 0);
      tree(x + 1, MAP_H - 1);
    }
    for (let y = 2; y < MAP_H - 1; y += 2) {
      tree(0, y);
      tree(MAP_W - 1, y + 1);
    }
    for (const [x, y, f] of [
      [20, 3, 1], [23, 2, 0], [10, 2, 1], [26, 5, 0], [3, 15, 0], [5, 17, 1],
      [31, 3, 0], [33, 10, 1], [30, 15, 0], [32, 19, 0], [29, 21, 1], [12, 20, 0], [18, 21, 1],
      [40, 3, 0], [60, 5, 1], [35, 12, 0], [36, 16, 1], [57, 16, 0], [61, 14, 0], [59, 20, 1], [41, 11, 0],
      [8, 37, 0], [44, 30, 0], [42, 36, 1],
    ] as const)
      tree(x, y, f === 1);
    for (let y = 24; y < 52; y++)
      for (let x = 45; x < MAP_W - 1; x++) {
        if (Math.hypot(x - clearing.x, y - clearing.y) < clearing.r + 1) continue;
        if ((x + y) % 2 === 0 && r.frac() < 0.62) tree(x, y, r.frac() < 0.1);
      }

    // the south: woods between the lakes, thicker around the misty telaga
    for (let y = 40; y < MAP_H - 1; y++)
      for (let x = 1; x < MAP_W - 1; x++) {
        const nearTelaga = Math.hypot(x - 11, y - 62) < 10;
        if ((x * 3 + y) % 2 === 0 && r.frac() < (nearTelaga ? 0.4 : 0.14)) tree(x, y, r.frac() < 0.08);
      }

    // small decorations
    for (const [x, y] of [[2, 8], [3, 11], [6, 13], [22, 5], [2, 5], [34, 6], [58, 7], [39, 19], [27, 20], [9, 21], [46, 24]]) scene.deco('bush', x, y);
    for (const [x, y] of [[6, 10], [19, 2], [11, 25], [38, 27], [50, 27], [61, 10]]) scene.deco('rock', x, y);
    for (const [x, y] of [[12, 5], [21, 18], [52, 34], [56, 30]]) scene.deco('stump', x, y);
    scene.paintMinimap(G);
}

export function paintMinimap(scene: FarmScene, G: string[][]) {
    if (scene.textures.exists('minimap')) scene.textures.remove('minimap');
    const tex = scene.textures.createCanvas('minimap', MAP_W * MAP_PX, MAP_H * MAP_PX)!;
    const ctx = tex.getContext();
    const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
    const tint = (base: number, t: number) => {
      const ch = (sh: number) => Math.round((((base >> sh) & 255) * ((t >> sh) & 255)) / 255);
      return hex((ch(16) << 16) | (ch(8) << 8) | ch(0));
    };
    const ground: Record<string, string> = { g: '#6fae4c', p: '#d8b67e', s: '#b9b4a8', d: '#ead39a', k: '#8d5a34', q: '#a89c88' };
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        const k = plotKey(x, y);
        const lake = scene.waterAt.get(k);
        let col = ground[G[y][x]] ?? ground.g;
        if (G[y][x] === 'w' || (lake && scene.blocked.has(k) && scene.spots.get(k) === 'pond')) col = tint(0x4a90d8, LAKES[lake ?? 'danau'].tint);
        else if (scene.treeTiles.has(k)) col = '#2f6b34';
        else if (scene.blocked.has(k)) col = '#a5623e'; // buildings and props
        if (x >= FIELD.x && x < FIELD.x + FIELD.w && y >= FIELD.y && y < FIELD.y + FIELD.h && col === ground.g) col = '#5b9440';
        ctx.fillStyle = col;
        ctx.fillRect(x * MAP_PX, y * MAP_PX, MAP_PX, MAP_PX);
      }
    tex.refresh();
}
