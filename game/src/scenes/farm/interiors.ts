import Phaser from 'phaser';
import { FURNITURE, TILE } from '../../data';
import { plotKey } from '../../state';
import { type Spot, ROOM, SHOP, dashed } from './common';
import type { FarmScene } from '../FarmScene';

export function buildRoom(scene: FarmScene, R: typeof ROOM, tier: number) {
    const X = (lx: number) => (R.x + lx) * TILE;
    const Y = (ly: number) => (R.y + ly) * TILE;
    const spot = (lx: number, ly: number, what: Spot | null) => {
      scene.blocked.add(plotKey(R.x + lx, R.y + ly));
      if (what) scene.spots.set(plotKey(R.x + lx, R.y + ly), what);
    };
    const mid = R.w / 2;
    // floor, wallpapered back wall (two tiles tall), side walls, front wall with the door gap
    for (let ly = 2; ly < R.h; ly++) for (let lx = 0; lx < R.w; lx++) scene.add.image(X(lx), Y(ly), 'in-floor').setOrigin(0).setDepth(-10);
    for (let lx = 0; lx < R.w; lx++) {
      scene.add.image(X(lx), Y(0), 'in-wall').setOrigin(0).setDepth(-9);
      spot(lx, 0, null);
      spot(lx, 1, null);
    }
    for (let ly = 0; ly < R.h; ly++) {
      scene.add.image(X(0) - 4, Y(ly), 'in-wall-side').setOrigin(0).setDepth(Y(R.h));
      scene.add.image(X(R.w), Y(ly), 'in-wall-side').setOrigin(0).setDepth(Y(R.h));
    }
    scene.add.rectangle(X(0) - 4, Y(R.h), X(mid - 1) - X(0) + 4, 4, 0x5a3a22).setOrigin(0).setDepth(Y(R.h));
    scene.add.rectangle(X(mid + 1), Y(R.h), X(R.w) - X(mid + 1) + 4, 4, 0x5a3a22).setOrigin(0).setDepth(Y(R.h));

    // windows with glass that follows the sky, a calendar between the first two
    const windows = [4.5, 12.5, ...(tier >= 1 ? [21.5] : []), ...(tier >= 2 ? [28.5] : [])];
    const glass = scene.add.graphics().setDepth(-8.6);
    for (const lx of windows) scene.add.image(X(lx), Y(0) + 4, 'in-window').setOrigin(0.5, 0).setDepth(-8.5);
    scene.add.image(X(8.5), Y(0) + 6, 'in-calendar').setOrigin(0.5, 0).setDepth(-8.5);

    // furniture along the back wall, with room to walk between the pieces
    // (the same in every tier, so nothing moves when you renovate)
    const put = (key: string, lx: number, lyBottom: number, origin = 0.5) =>
      scene.add.image(X(lx), Y(lyBottom), key).setOrigin(origin, 1).setDepth(Y(lyBottom));
    scene.bedImgs.push({ img: put('in-bed', 1, 5), x: R.x });
    for (const [lx, ly] of [[0, 2], [1, 2], [0, 3], [1, 3], [0, 4], [1, 4]]) spot(lx, ly, 'bed');
    put('in-tv', 6, 4);
    for (const lx of [5, 6]) spot(lx, 2, 'tv'), spot(lx, 3, 'tv');
    put('in-shelf', 9, 4);
    for (const lx of [8, 9]) spot(lx, 2, 'shelf'), spot(lx, 3, 'shelf');
    put('in-stove', 13.5, 4);
    for (const lx of [12, 13, 14]) spot(lx, 2, 'stove'), spot(lx, 3, 'stove');
    put('in-wardrobe', 19, 5);
    for (const [lx, ly] of [[18, 2], [19, 2], [18, 3], [19, 3], [18, 4], [19, 4]]) spot(lx, ly, 'wardrobe');

    // furniture slots, filled from the Toko Mebel (dashed outline until bought)
    const slot = (id: string, x: number, y: number, w: number, h: number, key: string, tiles: [number, number][], spotKind: Spot | null) => {
      const ph = scene.add.graphics().setDepth(-8.4);
      dashed(ph, x, y, w, h);
      const img = scene.add.image(x + w / 2, y + h, key).setOrigin(0.5, 1).setDepth(y + h);
      for (const [lx, ly] of tiles) {
        const k = plotKey(R.x + lx, R.y + ly);
        if (spotKind) scene.blocked.add(k);
        scene.furnitureTiles.set(k, id);
      }
      const list = scene.furnitureObjs.get(id) ?? [];
      list.push({ img, ph, spot: spotKind });
      scene.furnitureObjs.set(id, list);
    };
    slot('kulkas', X(15), Y(2) - 16, TILE, 32, 'in-fridge', [[15, 2], [15, 3]], 'fridge');
    slot('radio', X(3), Y(2), TILE, TILE, 'in-radio', [[3, 2]], 'radio');
    slot('peti', X(0), Y(7), TILE, TILE, 'in-chest', [[0, 7]], 'storage');
    slot('jam', X(16.5) - 7, Y(0) + 6, 14, 14, 'in-clock', [], null);
    slot('piala', X(18), Y(7) - 8, 32, 40, 'in-trophy', [[18, 7], [19, 7], [18, 8], [19, 8]], 'trophy');

    // dining corner on a rug, in the middle of the room
    scene.add.image(X(10), Y(8), 'in-rug').setOrigin(0.5, 0.5).setDepth(-9);
    put('in-table', 10, 8);
    spot(9, 7, null);
    spot(10, 7, null);
    put('in-chair', 8.5, 8);
    spot(8, 7, null);
    put('in-chair', 11.5, 8).setFlipX(true);
    spot(11, 7, null);

    // Rumah Sedang: a living room with a sofa (rest once a day)
    if (tier >= 1) {
      scene.add.image(X(23.5), Y(6.5), 'in-rug2').setOrigin(0.5, 0.5).setDepth(-9);
      put('in-sofa', 23.5, 6);
      for (const lx of [22, 23, 24]) spot(lx, 5, 'sofa');
      put('in-coffee', 23.5, 8);
      spot(23, 7, null);
      put('in-floorlamp', 21, 6);
      spot(20, 5, null);
      scene.lamps.push(scene.add.image(X(21), Y(4), 'glow').setScale(1.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(9600).setAlpha(0));
    }
    // Rumah Besar: a reading corner with an aquarium, a second shelf and an armchair
    if (tier >= 2) {
      put('in-aquarium', 27.5, 5);
      for (const lx of [26, 27, 28]) spot(lx, 3, null), spot(lx, 4, null);
      put('in-shelf', 30.5, 4);
      for (const lx of [30, 31]) spot(lx, 2, 'shelf'), spot(lx, 3, 'shelf');
      put('in-armchair', 29.5, 9);
      spot(29, 8, null);
      put('in-floorlamp', 31, 9);
      spot(30, 8, null);
      scene.lamps.push(scene.add.image(X(31), Y(7), 'glow').setScale(1.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(9600).setAlpha(0));
    }

    // plants in the front corners, doormat in the middle
    for (const lx of [0, R.w - 1]) {
      put('in-plant', lx + 0.5, R.h);
      spot(lx, R.h - 1, null);
    }
    scene.add.image(X(mid), Y(R.h) - 1, 'in-mat').setOrigin(0.5, 1).setDepth(-8.5);

    // lighting: a hanging lamp over the table, and evening dimming
    const lamp = scene.add.image(X(10), Y(5) + 4, 'in-lamp').setOrigin(0.5, 0).setDepth(Y(R.h) + 1);
    const night = scene.add.rectangle(X(0) - 8, Y(0), X(R.w) - X(0) + 16, Y(R.h) - Y(0) + 8, 0x1b1530, 0).setOrigin(0).setDepth(9500);
    scene.lamps.push(scene.add.image(X(10), Y(6) + 2, 'glow').setScale(2.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(9600).setAlpha(0));
    scene.roomViews.push({ R, glass, windows, night, lamp });
}

export function refreshFurniture(scene: FarmScene) {
    const owned = scene.state.furniture;
    for (const [id, list] of scene.furnitureObjs)
      for (const o of list) {
        o.img.setVisible(!!owned[id]);
        o.ph.setVisible(!owned[id]);
      }
    for (const [k, id] of scene.furnitureTiles) {
      if (scene.spots.get(k) === 'display') continue; // shop stands stay stands
      const o = scene.furnitureObjs.get(id)?.[0];
      if (!o?.spot) continue;
      scene.spots.set(k, owned[id] ? o.spot : 'slot');
    }
    // the big bed replaces the old one
    for (const b of scene.bedImgs) b.img.setTexture(owned.kasur ? 'in-bigbed' : 'in-bed').setX((b.x + (owned.kasur ? 1.2 : 1)) * TILE);
}

export function buildShop(scene: FarmScene) {
    const R = SHOP;
    const X = (lx: number) => (R.x + lx) * TILE;
    const Y = (ly: number) => (R.y + ly) * TILE;
    const spot = (lx: number, ly: number, what: Spot | null) => {
      scene.blocked.add(plotKey(R.x + lx, R.y + ly));
      if (what) scene.spots.set(plotKey(R.x + lx, R.y + ly), what);
    };
    for (let ly = 2; ly < R.h; ly++) for (let lx = 0; lx < R.w; lx++) scene.add.image(X(lx), Y(ly), 'shop-floor').setOrigin(0).setDepth(-10);
    for (let lx = 0; lx < R.w; lx++) {
      scene.add.image(X(lx), Y(0), 'shop-wall').setOrigin(0).setDepth(-9);
      spot(lx, 0, null);
      spot(lx, 1, null);
    }
    for (let ly = 0; ly < R.h; ly++) {
      scene.add.image(X(0) - 4, Y(ly), 'in-wall-side').setOrigin(0).setDepth(Y(R.h));
      scene.add.image(X(R.w), Y(ly), 'in-wall-side').setOrigin(0).setDepth(Y(R.h));
    }
    const mid = R.w / 2;
    scene.add.rectangle(X(0) - 4, Y(R.h), X(mid - 1) - X(0) + 4, 4, 0x1a5a56).setOrigin(0).setDepth(Y(R.h));
    scene.add.rectangle(X(mid + 1), Y(R.h), X(R.w) - X(mid + 1) + 4, 4, 0x1a5a56).setOrigin(0).setDepth(Y(R.h));

    // back wall: shelves of goods and the counter with the shopkeeper
    for (const lx of [1.5, R.w - 1.5]) {
      scene.add.image(X(lx), Y(4), 'in-shelf').setOrigin(0.5, 1).setDepth(Y(4));
      spot(Math.floor(lx - 0.5), 2, null), spot(Math.floor(lx + 0.5), 2, null), spot(Math.floor(lx - 0.5), 3, null), spot(Math.floor(lx + 0.5), 3, null);
    }
    scene.add.image(X(mid) + 1, Y(3) - 1, 'npc-mebel-0').setOrigin(0.5, 1).setDepth(Y(3));
    scene.add.image(X(mid), Y(4), 'counter').setOrigin(0.5, 1).setDepth(Y(4));
    for (let lx = mid - 2; lx < mid + 2; lx++) spot(lx, 2, null), spot(lx, 3, 'counter');
    scene.add.image(X(mid), Y(0) + 4, 'sign-mebel').setOrigin(0.5, 0).setDepth(-8.5);
    scene.add
      .text(X(mid), Y(0) + 10, 'MEBEL', { fontFamily: 'monospace', fontSize: '8px', color: '#1a5a56', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setResolution(4)
      .setDepth(-8.4);

    // display stands, each showing one piece of furniture and its price
    FURNITURE.forEach((f, i) => {
      const lx = 1 + i * 2;
      const cx = X(lx + 1);
      scene.add.image(cx, Y(7) - 2, 'pedestal').setOrigin(0.5, 1).setDepth(Y(7) - 3);
      const key = { jam: 'in-clock', radio: 'in-radio', piala: 'in-trophy', kulkas: 'in-fridge', kasur: 'in-bigbed', peti: 'in-chest' }[f.id] ?? 'in-radio';
      const img = scene.add.image(cx, Y(7) - 10, key).setOrigin(0.5, 1).setDepth(Y(7) - 2);
      if (img.height > 34) img.setScale(34 / img.height);
      scene.add
        .text(cx, Y(7) + 1, `${f.price.toLocaleString('id-ID')}`, { fontFamily: 'monospace', fontSize: '7px', color: '#fffbe6', stroke: '#2a1d17', strokeThickness: 2 })
        .setOrigin(0.5, 0)
        .setResolution(4)
        .setDepth(Y(8));
      for (const ly of [5, 6]) {
        spot(lx, ly, 'display');
        spot(lx + 1, ly, 'display');
        scene.furnitureTiles.set(plotKey(R.x + lx, R.y + ly), f.id);
        scene.furnitureTiles.set(plotKey(R.x + lx + 1, R.y + ly), f.id);
      }
    });
    for (const [lx, ly] of [[0, 8], [R.w - 1, 8]]) {
      scene.add.image(X(lx + 0.5), Y(ly + 1), 'in-plant').setOrigin(0.5, 1).setDepth(Y(ly + 1));
      spot(lx, ly, null);
    }
    scene.add.image(X(mid), Y(R.h) - 1, 'in-mat').setOrigin(0.5, 1).setDepth(-8.5);
}
