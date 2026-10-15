import Phaser from 'phaser';
import { CROPS, DISHES, FISH, TILE } from './data';

type Ctx = CanvasRenderingContext2D;

const OUTLINE = '#2a1d17';

/** Seeded RNG so procedural art looks the same on every load. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** Add a 1px dark outline around every opaque pixel (the classic pixel-art finish). */
function outline(c: Ctx, w: number, h: number, color = OUTLINE) {
  const img = c.getImageData(0, 0, w, h);
  const a = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : img.data[(y * w + x) * 4 + 3]);
  c.fillStyle = color;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (a(x, y) < 40 && (a(x - 1, y) > 120 || a(x + 1, y) > 120 || a(x, y - 1) > 120 || a(x, y + 1) > 120))
        c.fillRect(x, y, 1, 1);
}

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void, line = false) {
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  if (line) outline(ctx, w, h);
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST); // crisp pixels even though the game antialiases
}

const px = (c: Ctx, x: number, y: number, color: string, w = 1, h = 1) => {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
};

/** Filled pixel disc with simple top-left lighting. */
function disc(c: Ctx, cx: number, cy: number, r: number, base: string, light: string, dark: string) {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (d > r * r) continue;
      const lit = x + y < -r * 0.6 ? light : x + y > r * 0.7 ? dark : base;
      px(c, cx + x, cy + y, lit);
    }
}

/** Draw ASCII pixel art: each char maps to a palette colour, '.' is transparent. */
function art(c: Ctx, rows: string[], pal: Record<string, string>, ox = 0, oy = 0) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]];
      if (col) px(c, ox + x, oy + y, col);
    }
  });
}

const PLAYER_PAL: Record<string, string> = {
  y: '#b8902f', Y: '#ecc761', L: '#f7df8e', r: '#c0392b', H: '#6b3e26', h: '#8a5232',
  S: '#f5c896', s: '#dba273', E: '#2b2b2b', C: '#3f7fbf', c: '#2f5f95', l: '#5f9bd6',
  P: '#4a4a6a', p: '#38384f', B: '#5a3a22',
};

// 16x16 frames. Feet rows are swapped per walk frame.
const HEAD_DOWN = [
  '................',
  '.....yYYYYy.....',
  '....yYLLYYYy....',
  '..yyrrrrrrrryy..',
  '.....HhSSSH.....',
  '.....SESSES.....',
  '.....sSSSSs.....',
  '......ssss......',
];
const HEAD_UP = [
  '................',
  '.....yYYYYy.....',
  '....yYLLYYYy....',
  '..yyrrrrrrrryy..',
  '.....HHhHHH.....',
  '.....HhHHhH.....',
  '.....HHHHHH.....',
  '......HHHH......',
];
const HEAD_SIDE = [
  '................',
  '.....yYYYYy.....',
  '....yYLLYYYy....',
  '...yrrrrrrrryy..',
  '.....HHSSSS.....',
  '.....HhSSES.....',
  '.....HSSSSSs....',
  '......ssss......',
];
const BODY_FRONT = [
  '....cCClCCCc....',
  '...SCCClCCCCS...',
  '...scCCCCCCcs...',
  '.....PPPPPP.....',
  '.....PPppPP.....',
];
const BODY_SIDE = [
  '.....cClCCc.....',
  '.....CClCSS.....',
  '.....cCCCCc.....',
  '.....PPPPPP.....',
  '.....PPPpPP.....',
];
const LEGS = [
  ['.....PP..PP.....', '.....BB..BB.....', '................'],
  ['.....PP...PP....', '....BB....BB....', '................'],
];

/** Hand-drawn 16x16 fish, facing left. o outline, b body, l belly, d marking, e eye, w white, r red. */
const FISH_ART: Record<string, string[]> = {
  'ikan-nila': ['', '', '......o.o.o.....', '.....ododod.....', '....obbbbbbo....', '...obbdbdbdbo.oo', '..oebdbdbdbdbodo', '.obbbdbdbdbdbdo.', '.olbbdbdbdbdbdo.', '..olldldldldlodo', '...ollllllllo.oo', '....oooooooo....', '.....o....o.....'],
  'ikan-mas': ['', '', '', '.....oooooo.....', '....obbbbbbo....', '...obdbdbdbbo.oo', '..oebbdbdbdbbodo', '.obbdbdbdbdbbdo.', 'oolbbdbdbdbdbdo.', '..olllllllllodo.', '...olllllllo.oo.', '....ooooooo.....', '......o...o.....'],
  'ikan-betok': ['', '', '', '', '.....o.o.o.o....', '....obobobobo...', '...obbbbbbbbo.o.', '..oebbbbbbdeboo.', '..obbbbbbbbbbdo.', '...olllllllo.oo.', '....ooooooo.....', '......o.o.......'],
  'ikan-lele': ['', '', '', '', '', '.......ooooooo..', '...ooobbbbbbboo.', 'd.obebbbbbbbbbdo', '.dobbbbbbbbbbbbo', 'd.ollllllllllldo', '.d.oooooooooo.oo', 'd...............'],
  'ikan-gabus': ['', '', '', '', '....oooooooooo..', '...odddddddddo..', '.oobbdbbdbbdbboo', 'oebbdbbbdbbbdbdo', 'obbbbdbbbdbbbbdo', '.olllllllllllloo', '..oddddddddddo..', '...oooooooooo...'],
  'ikan-patin': ['', '', '.......o........', '......odo.......', '.....oddo.....o.', '...ooobbbooo.odo', '.oobbbbbbbbbood.', 'oebbbbbbbbbbbo..', 'obllllllllllod..', '.ooollllllloood.', '....ooo.ooo..odo', '..............o.'],
  'ikan-gurame': ['', '.....ooooo......', '....obbbbbo.....', '...obbdbbbbo....', '..obbbbdbbbbo...', '..obdbbbbdbbbo.o', '.obbbbdbbbbbbood', 'oebbdbbbbdbbbodo', 'obbbbbbdbbbbbod.', '.olllllllllllodo', '..olllllllllo.oo', '...olllllllo....', '....ooooooo.....', '....o...........', '...o............'],
  'ikan-bawal': ['', '', '......ooooo.....', '....oobbbbbo....', '...obbbbbbbbo...', '..obbbbbbbbbbo.o', '.oebbbbbbbbbbodo', '.obbbbbbbbbbbod.', '.obrrrrrrrrrrod.', '..orrrrrrrrrrodo', '...orrrrrrrro..o', '....oorrrroo....', '......oooo......'],
  'ikan-koi': ['', '', '', '......oooo......', '.....owwwwo.....', '...oowwrrwwwo..o', '..oewwrrrwwrrowo', '.owwwwrwwwrrrwwo', '.owwwwwwwwwwwowo', '..owwwwwwwwwwo.o', '...oowwwwwoo....', '....ow..ow......', '.....o...o......'],
  'ikan-emas': ['', '', '', '......ooo.......', '.....obbbo......', '...oobbbbbo..oo.', '..oebbbbbbbooddo', '.obbbbbbbbbobddo', '.obllllbbbbobdo.', '..ollllbbbbobddo', '...oollllbooodo', '.....ooooo...oo.'],
  'ikan-arwana': ['', '', '', '', '', '....ooooooooo...', '..oobbdbbdbbdo.o', '.oebbbbbbbbbbbod', 'obbbdbbdbbdbbdo.', '.olllllllllllodo', '..ooooooooooooo.', '.d..............', 'd...............'],
};

/** Darken a #rrggbb colour by factor k. */
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(v * k).toString(16).padStart(2, '0');
  return `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

export function makeTextures(scene: Phaser.Scene) {
  // ---------- ground ----------
  for (let v = 0; v < 4; v++) {
    canvas(scene, `grass${v}`, TILE, TILE, (c) => {
      const r = rng(11 + v * 31);
      px(c, 0, 0, '#6ec04d', TILE, TILE);
      for (let i = 0; i < 26; i++) px(c, Math.floor(r() * 16), Math.floor(r() * 16), r() < 0.55 ? '#62b043' : '#7fd05a');
      // little grass blades
      for (let i = 0; i < 3; i++) {
        const x = 1 + Math.floor(r() * 13);
        const y = 3 + Math.floor(r() * 11);
        px(c, x, y, '#4f9a35');
        px(c, x + 1, y - 1, '#4f9a35');
        px(c, x + 2, y, '#4f9a35');
      }
      if (v === 2) {
        // white daisies
        for (const [x, y] of [[4, 4], [11, 10]]) {
          px(c, x, y - 1, '#ffffff'); px(c, x - 1, y, '#ffffff'); px(c, x + 1, y, '#ffffff'); px(c, x, y + 1, '#ffffff');
          px(c, x, y, '#f2c94c');
        }
      }
      if (v === 3) {
        // pink flowers
        for (const [x, y] of [[9, 4], [4, 11]]) {
          px(c, x, y - 1, '#f28bb3'); px(c, x - 1, y, '#f28bb3'); px(c, x + 1, y, '#f28bb3'); px(c, x, y + 1, '#f28bb3');
          px(c, x, y, '#fff2a8');
        }
      }
    });
  }
  canvas(scene, 'path', TILE, TILE, (c) => {
    const r = rng(5);
    px(c, 0, 0, '#dcbd82', TILE, TILE);
    for (let i = 0; i < 20; i++) px(c, Math.floor(r() * 16), Math.floor(r() * 16), r() < 0.5 ? '#cba970' : '#ead09a');
    for (let i = 0; i < 2; i++) {
      const x = Math.floor(r() * 13) + 1;
      const y = Math.floor(r() * 13) + 1;
      px(c, x, y, '#b8a080', 2, 1);
      px(c, x, y + 1, '#9c8466', 2, 1);
    }
  });
  const soil = (key: string, base: string, dark: string, light: string, edge: string) =>
    canvas(scene, key, TILE, TILE, (c) => {
      px(c, 0, 0, base, TILE, TILE);
      for (let y = 1; y < 16; y += 4) {
        px(c, 1, y, light, 14, 1);
        px(c, 1, y + 2, dark, 14, 1);
      }
      px(c, 0, 0, edge, TILE, 1);
      px(c, 0, 0, edge, 1, TILE);
      px(c, 0, 15, light, TILE, 1);
      px(c, 15, 0, light, 1, TILE);
    });
  soil('soil', '#a8743f', '#87592d', '#c08d55', '#6e4724');
  soil('soil-wet', '#6a4628', '#52361e', '#7d5634', '#3f2915');
  for (let f = 0; f < 3; f++) {
    canvas(scene, `water${f}`, TILE, TILE, (c) => {
      px(c, 0, 0, '#4aa3df', TILE, TILE);
      const r = rng(77);
      for (let i = 0; i < 10; i++) px(c, Math.floor(r() * 16), Math.floor(r() * 16), '#5bb2ea');
      const o = f * 2;
      px(c, (2 + o) % 16, 4, '#a9defa', 4, 1);
      px(c, (9 + o) % 16, 9, '#a9defa', 3, 1);
      px(c, (5 + o) % 16, 13, '#8fd0f5', 4, 1);
    });
  }
  canvas(scene, 'lily', TILE, TILE, (c) => {
    disc(c, 8, 8, 4, '#4f9a3f', '#6fbf55', '#3a7a2e');
    px(c, 8, 4, '#4aa3df', 1, 4);
    px(c, 10, 6, '#f6c1d8', 2, 2);
    px(c, 10, 6, '#ffffff');
  }, true);

  // ---------- soft shapes (shadows, glows, clouds) ----------
  canvas(scene, 'shadow', 32, 12, (c) => {
    c.fillStyle = 'rgba(20,30,10,1)';
    c.beginPath();
    c.ellipse(16, 6, 15, 5, 0, 0, Math.PI * 2);
    c.fill();
  });
  canvas(scene, 'glow', 64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,214,140,1)');
    g.addColorStop(0.35, 'rgba(255,190,100,0.45)');
    g.addColorStop(1, 'rgba(255,170,80,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });
  canvas(scene, 'cloud', 128, 64, (c) => {
    for (const [x, y, r] of [[40, 34, 26], [70, 28, 30], [96, 36, 22], [60, 42, 24]]) {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(0,0,20,0.9)');
      g.addColorStop(1, 'rgba(0,0,20,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 64);
    }
  });
  canvas(scene, 'dot', 4, 4, (c) => px(c, 0, 0, '#ffffff', 4, 4));
  // weather icons for the HUD and calendar
  const cloud = (c: Ctx, base: string, light: string, dark: string, oy = 0) => {
    disc(c, 6, 7 + oy, 4, base, light, dark);
    disc(c, 10, 6 + oy, 4, base, light, dark);
    px(c, 2, 8 + oy, base, 13, 3);
    px(c, 3, 10 + oy, dark, 11, 1);
  };
  canvas(scene, 'wx-cerah', TILE, TILE, (c) => {
    for (const [x, y, w, h] of [[7, 0, 2, 2], [7, 14, 2, 2], [0, 7, 2, 2], [14, 7, 2, 2], [2, 2, 2, 2], [12, 2, 2, 2], [2, 12, 2, 2], [12, 12, 2, 2]])
      px(c, x, y, '#f2b53c', w, h);
    disc(c, 8, 8, 4, '#f7c948', '#fff3a8', '#e09a2a');
  }, true);
  canvas(scene, 'wx-hujan', TILE, TILE, (c) => {
    cloud(c, '#b8c4d0', '#e2e8ee', '#8a98a8', -1);
    for (const x of [4, 8, 12]) px(c, x, 12, '#4aa3df', 1, 3);
    for (const x of [6, 10]) px(c, x, 13, '#4aa3df', 1, 3);
  }, true);
  canvas(scene, 'wx-badai', TILE, TILE, (c) => {
    cloud(c, '#6a7484', '#8f99a8', '#4a5260', -1);
    px(c, 8, 10, '#f2c94c', 2, 2);
    px(c, 7, 12, '#f2c94c', 2, 2);
    px(c, 8, 13, '#f2c94c', 1, 3);
    px(c, 4, 12, '#4aa3df', 1, 3);
    px(c, 12, 12, '#4aa3df', 1, 3);
  }, true);
  canvas(scene, 'wx-kabut', TILE, TILE, (c) => {
    disc(c, 8, 6, 3, '#e8b84a', '#f7d97a', '#c99a2e'); // a dull sun behind the smoke
    for (const [y, x0, w, col] of [[8, 1, 13, '#9a8a78'], [10, 3, 12, '#b8a894'], [12, 0, 12, '#8a7a68'], [14, 4, 10, '#a89884']] as const)
      px(c, x0, y, col, w, 2);
  }, true);
  canvas(scene, 'raindrop', 2, 14, (c) => {
    px(c, 0, 0, 'rgba(200,225,255,0.25)', 2, 6);
    px(c, 0, 6, 'rgba(210,232,255,0.6)', 2, 8);
  });
  canvas(scene, 'snowflake', 4, 4, (c) => {
    px(c, 1, 0, '#ffffff', 2, 4);
    px(c, 0, 1, '#ffffff', 4, 2);
  });
  canvas(scene, 'firefly', 8, 8, (c) => {
    const g = c.createRadialGradient(4, 4, 0, 4, 4, 4);
    g.addColorStop(0, 'rgba(240,255,170,1)');
    g.addColorStop(1, 'rgba(200,255,120,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 8, 8);
  });
  for (let f = 0; f < 2; f++) {
    canvas(scene, `butterfly${f}`, 8, 8, (c) => {
      const w = f === 0 ? 3 : 1;
      px(c, 4 - w, 2, '#ffffff', w, 3);
      px(c, 5, 2, '#ffffff', w, 3);
      px(c, 4 - w, 3, '#f7b2d0', w, 1);
      px(c, 5, 3, '#f7b2d0', w, 1);
      px(c, 4, 1, '#3b2a1a', 1, 5);
    });
  }

  // ---------- trees & decorations ----------
  canvas(scene, 'tree', 32, 40, (c) => {
    px(c, 13, 26, '#6b4224', 6, 14);
    px(c, 14, 26, '#8d5a34', 2, 14);
    px(c, 12, 38, '#6b4224', 8, 2);
    disc(c, 16, 16, 12, '#3a8c3f', '#57b257', '#2a6b30');
    disc(c, 9, 20, 7, '#3a8c3f', '#57b257', '#2a6b30');
    disc(c, 23, 20, 7, '#3a8c3f', '#4ea24e', '#2a6b30');
    disc(c, 14, 11, 7, '#4ea24e', '#6cc76a', '#3a8c3f');
    const r = rng(3);
    for (let i = 0; i < 14; i++) px(c, 7 + Math.floor(r() * 18), 6 + Math.floor(r() * 10), '#7fd67a');
  }, true);
  canvas(scene, 'tree-fruit', 32, 40, (c) => {
    px(c, 13, 26, '#6b4224', 6, 14);
    px(c, 14, 26, '#8d5a34', 2, 14);
    disc(c, 16, 16, 12, '#2f7d3a', '#4ea24e', '#225e2b');
    disc(c, 10, 21, 7, '#2f7d3a', '#4ea24e', '#225e2b');
    disc(c, 22, 21, 7, '#2f7d3a', '#43944a', '#225e2b');
    for (const [x, y] of [[9, 13], [19, 9], [22, 18], [13, 22], [17, 15]]) {
      px(c, x, y, '#e2434b', 2, 2);
      px(c, x, y, '#ff8a8a');
    }
  }, true);
  canvas(scene, 'bush', 16, 16, (c) => {
    disc(c, 8, 9, 6, '#3f9a45', '#5cbc5c', '#2c7434');
    px(c, 5, 7, '#f28bb3'); px(c, 10, 6, '#f28bb3'); px(c, 8, 11, '#f28bb3');
  }, true);
  canvas(scene, 'rock', 16, 16, (c) => {
    disc(c, 8, 10, 5, '#9aa0a6', '#c3c8cc', '#6f757b');
    px(c, 4, 13, '#6f757b', 9, 1);
  }, true);
  canvas(scene, 'stump', 16, 16, (c) => {
    px(c, 4, 7, '#7a4b2a', 8, 7);
    px(c, 4, 5, '#c49a6c', 8, 3);
    px(c, 6, 6, '#9c7048', 4, 1);
    px(c, 3, 13, '#6b4224', 10, 1);
  }, true);

  // ---------- buildings & props ----------
  // houses share one drawing with different roof / wall palettes
  const houses: Record<string, { roof: [string, string, string, string]; wall: [string, string, string] }> = {
    house: { roof: ['#b3402f', '#cf5a43', '#8f2f23', '#7d281e'], wall: ['#efe0bd', '#ddc99f', '#c9b386'] },
    'house-sari': { roof: ['#d9822b', '#efa04a', '#a85f1a', '#8a4d15'], wall: ['#f4e6c8', '#e2d0aa', '#cdb88c'] },
    'house-darto': { roof: ['#3f6fb0', '#5a8fd0', '#2f5590', '#264577'], wall: ['#eae4d6', '#d8d0bd', '#c2b9a2'] },
    'house-rani': { roof: ['#4f9a4a', '#6cbf62', '#3a7a36', '#2f652c'], wall: ['#f4ead2', '#e2d6b6', '#cdbf99'] },
    'house-joyo': { roof: ['#7a5a3a', '#9c7a52', '#5f452c', '#4c3723'], wall: ['#e6d8bc', '#d4c3a2', '#bfac88'] },
    'house-mebel': { roof: ['#2f8f8a', '#4fb3ad', '#21706b', '#1a5a56'], wall: ['#f4ead2', '#e2d6b6', '#cdbf99'] },
    'house-dina': { roof: ['#b05a8f', '#d07ab0', '#8a4570', '#71385c'], wall: ['#fbeee2', '#ebdac8', '#d6c2ac'] },
  };
  for (const [key, { roof, wall }] of Object.entries(houses)) {
    canvas(scene, key, 64, 64, (c) => {
      const [rBase, rLight, rDark, rEdge] = roof;
      const [wBase, wLine, wShade] = wall;
      // walls (planks)
      px(c, 4, 26, wBase, 56, 38);
      for (let y = 28; y < 64; y += 5) px(c, 4, y, wLine, 56, 1);
      px(c, 4, 26, wShade, 56, 2);
      px(c, 4, 26, wShade, 2, 38);
      px(c, 58, 26, wLine, 2, 38);
      // roof with shingles and light from the left
      for (let i = 0; i < 26; i++) {
        const x0 = 26 - i;
        const w = 12 + i * 2;
        px(c, x0, i, rBase, w, 1);
        px(c, x0, i, rLight, Math.floor(w / 2), 1);
      }
      for (let y = 4; y < 24; y += 4) for (let x = 28 - y; x < 36 + y; x += 4) px(c, x + ((y / 4) % 2) * 2, y, rDark, 1, 2);
      px(c, 0, 24, rEdge, 64, 4);
      px(c, 0, 24, rDark, 64, 1);
      // chimney
      px(c, 44, 2, '#7d6a5a', 7, 14);
      px(c, 43, 1, '#5f5046', 9, 2);
      // door
      px(c, 25, 43, '#5a3a22', 14, 21);
      px(c, 26, 44, '#8d5a34', 12, 20);
      px(c, 26, 44, '#a36c40', 6, 20);
      px(c, 35, 54, '#f2c94c', 2, 2);
      // windows with flower boxes
      for (const wx of [9, 43]) {
        px(c, wx, 35, '#5a3a22', 13, 13);
        px(c, wx + 1, 36, '#9fd8f5', 11, 11);
        px(c, wx + 1, 36, '#c9ecfb', 4, 3);
        px(c, wx + 6, 36, '#5a3a22', 1, 11);
        px(c, wx + 1, 41, '#5a3a22', 11, 1);
        px(c, wx - 1, 48, '#8d5a34', 15, 3);
        for (let i = 0; i < 4; i++) px(c, wx + 1 + i * 3, 46, i % 2 ? '#f28bb3' : '#f2c94c', 2, 2);
      }
    }, true);
  }

  // ---------- farmhouse interior ----------
  canvas(scene, 'in-floor', TILE, TILE, (c) => {
    px(c, 0, 0, '#c08a55', TILE, TILE);
    for (let y = 0; y < 16; y += 4) {
      px(c, 0, y, '#a87442', 16, 1);
      px(c, 0, y + 1, '#d39d66', 16, 1);
    }
    px(c, (0 * 5) % 16, 0, '#a87442', 1, 4);
    px(c, 9, 4, '#a87442', 1, 4);
    px(c, 4, 8, '#a87442', 1, 4);
    px(c, 12, 12, '#a87442', 1, 4);
    px(c, 6, 2, '#b5804c');
    px(c, 13, 10, '#b5804c');
  });
  canvas(scene, 'in-wall', TILE, TILE * 2, (c) => {
    // wallpaper with soft stripes, then a wooden wainscot and skirting
    px(c, 0, 0, '#efe2c4', TILE, 20);
    for (let x = 1; x < 16; x += 4) px(c, x, 0, '#e4d3ae', 2, 20);
    px(c, 0, 20, '#8d5a34', TILE, 2);
    px(c, 0, 22, '#a36c40', TILE, 8);
    for (let x = 3; x < 16; x += 8) px(c, x, 23, '#8d5a34', 1, 6);
    px(c, 0, 30, '#5a3a22', TILE, 2);
  });
  canvas(scene, 'in-wall-side', 4, TILE, (c) => {
    px(c, 0, 0, '#5a3a22', 4, TILE);
    px(c, 1, 0, '#7a4b2a', 2, TILE);
  });
  canvas(scene, 'in-window', 32, 24, (c) => {
    px(c, 0, 0, '#6b4224', 32, 24);
    c.clearRect(2, 2, 28, 18); // clear glass: the sky colour is drawn behind it in the scene
    px(c, 3, 3, 'rgba(255,255,255,0.35)', 6, 3); // a glint
    px(c, 15, 2, '#6b4224', 2, 18);
    px(c, 2, 10, '#6b4224', 28, 2);
    px(c, 0, 20, '#8d5a34', 32, 4);
    px(c, 2, 21, '#f28bb3', 3, 2); px(c, 8, 21, '#f2c94c', 3, 2); px(c, 21, 21, '#5fb04a', 3, 2); px(c, 27, 21, '#f28bb3', 3, 2);
  }, true);
  canvas(scene, 'in-bed', 32, 44, (c) => {
    px(c, 1, 0, '#6b4224', 30, 10); // headboard
    px(c, 2, 1, '#8d5a34', 28, 8);
    px(c, 2, 8, '#f4f1e8', 28, 32); // sheet
    px(c, 4, 10, '#ffffff', 11, 7); // pillows
    px(c, 17, 10, '#ffffff', 11, 7);
    px(c, 2, 20, '#3f7fbf', 28, 20); // blanket
    px(c, 2, 20, '#5a9ad6', 28, 3);
    for (let x = 4; x < 30; x += 6) px(c, x, 26, '#2f5f95', 3, 3);
    px(c, 1, 40, '#6b4224', 30, 4);
  }, true);
  canvas(scene, 'in-stove', 48, 32, (c) => {
    px(c, 0, 6, '#b8b0a0', 48, 26); // counter
    px(c, 0, 4, '#d8d0c0', 48, 4);
    px(c, 2, 12, '#8d5a34', 14, 18); // cupboard doors
    px(c, 3, 13, '#a36c40', 12, 16);
    px(c, 13, 20, '#f2c94c', 1, 2);
    px(c, 18, 8, '#3a3a46', 14, 22); // stove
    px(c, 20, 10, '#1d1d24', 10, 3);
    px(c, 21, 15, '#5a5a66', 8, 12);
    px(c, 22, 5, '#2b2b2b', 4, 2); px(c, 27, 5, '#2b2b2b', 4, 2);
    px(c, 34, 12, '#8d5a34', 12, 18);
    px(c, 35, 13, '#a36c40', 10, 16);
    px(c, 36, 0, '#b3402f', 8, 5); // a pot
    px(c, 37, 0, '#cf5a43', 3, 2);
  }, true);
  canvas(scene, 'in-table', 32, 24, (c) => {
    px(c, 0, 4, '#8d5a34', 32, 10);
    px(c, 0, 4, '#a36c40', 32, 3);
    px(c, 2, 14, '#6b4224', 3, 10); px(c, 27, 14, '#6b4224', 3, 10);
    px(c, 11, 0, '#f4f1e8', 10, 5); // a bowl of fruit
    px(c, 12, 0, '#e2434b', 3, 3); px(c, 16, 0, '#f2c94c', 3, 3);
  }, true);
  canvas(scene, 'in-chair', TILE, TILE, (c) => {
    px(c, 3, 0, '#8d5a34', 10, 8);
    px(c, 4, 1, '#a36c40', 8, 6);
    px(c, 3, 8, '#a36c40', 10, 3);
    px(c, 3, 11, '#6b4224', 2, 5); px(c, 11, 11, '#6b4224', 2, 5);
  }, true);
  canvas(scene, 'in-rug', 64, 40, (c) => {
    px(c, 0, 0, '#b3402f', 64, 40);
    px(c, 3, 3, '#cf5a43', 58, 34);
    px(c, 6, 6, '#e8c35a', 52, 28);
    px(c, 8, 8, '#cf5a43', 48, 24);
    for (let x = 12; x < 52; x += 8) px(c, x, 18, '#e8c35a', 4, 4);
  });
  canvas(scene, 'in-shelf', 32, 40, (c) => {
    px(c, 0, 0, '#6b4224', 32, 40);
    px(c, 2, 2, '#8d5a34', 28, 36);
    const cols = ['#3f7fbf', '#e2434b', '#5fb04a', '#f2c94c', '#6b3fa0', '#e88a2d'];
    for (const y of [4, 16, 28]) {
      for (let x = 3, i = 0; x < 28; x += 4, i++) px(c, x, y, cols[(i + y) % cols.length], 3, 9);
      px(c, 2, y + 9, '#6b4224', 28, 2);
    }
  }, true);
  canvas(scene, 'in-tv', 32, 32, (c) => {
    px(c, 2, 18, '#6b4224', 28, 14); // cabinet
    px(c, 3, 19, '#8d5a34', 26, 12);
    px(c, 15, 24, '#f2c94c', 2, 2);
    px(c, 4, 2, '#2b2b2b', 24, 16); // CRT
    px(c, 6, 4, '#4aa3df', 20, 12);
    px(c, 7, 5, '#8fd0f5', 8, 3);
    px(c, 10, 0, '#2b2b2b', 1, 2); px(c, 21, 0, '#2b2b2b', 1, 2);
  }, true);
  canvas(scene, 'in-wardrobe', 32, 44, (c) => {
    px(c, 0, 0, '#6b4224', 32, 44);
    px(c, 2, 2, '#8d5a34', 13, 40);
    px(c, 17, 2, '#8d5a34', 13, 40);
    px(c, 3, 3, '#a36c40', 11, 38);
    px(c, 18, 3, '#a36c40', 11, 38);
    px(c, 13, 20, '#f2c94c', 1, 3); px(c, 18, 20, '#f2c94c', 1, 3);
  }, true);
  canvas(scene, 'in-plant', TILE, 24, (c) => {
    px(c, 4, 16, '#b3402f', 8, 8);
    px(c, 4, 16, '#cf5a43', 8, 2);
    disc(c, 8, 9, 6, '#3f9a45', '#5cbc5c', '#2c7434');
    px(c, 7, 2, '#5cbc5c', 2, 4);
  }, true);
  canvas(scene, 'in-mat', 32, 14, (c) => {
    px(c, 0, 0, '#8a6a45', 32, 14);
    px(c, 2, 2, '#b8955f', 28, 10);
    for (let x = 4; x < 28; x += 3) px(c, x, 4, '#8a6a45', 1, 6);
  });
  canvas(scene, 'in-calendar', 14, 16, (c) => {
    px(c, 0, 0, '#ffffff', 14, 16);
    px(c, 0, 0, '#e2434b', 14, 4);
    for (let y = 6; y < 15; y += 3) for (let x = 2; x < 13; x += 3) px(c, x, y, '#b8b0a0', 2, 2);
  }, true);
  canvas(scene, 'in-lamp', TILE, 20, (c) => {
    px(c, 7, 0, '#3a3a46', 2, 8);
    px(c, 3, 8, '#e8c35a', 10, 6);
    px(c, 4, 8, '#f7df8e', 4, 6);
    px(c, 5, 14, '#fff3c4', 6, 2);
  }, true);

  // ---------- furniture ----------
  canvas(scene, 'in-fridge', TILE, 32, (c) => {
    px(c, 1, 0, '#dfe6ee', 14, 32);
    px(c, 2, 1, '#f4f7fa', 12, 30);
    px(c, 1, 11, '#b8c4d0', 14, 1);
    px(c, 12, 4, '#8a949e', 1, 5);
    px(c, 12, 14, '#8a949e', 1, 8);
    px(c, 3, 3, '#e2434b', 2, 2); // a magnet
  }, true);
  canvas(scene, 'in-chest', TILE, TILE, (c) => {
    px(c, 1, 4, '#5a3a22', 14, 11);
    px(c, 2, 5, '#a36c40', 12, 4);
    px(c, 2, 10, '#8d5a34', 12, 4);
    px(c, 1, 9, '#5a3a22', 14, 1);
    px(c, 2, 5, '#c08552', 12, 1);
    px(c, 3, 7, '#8d5a34', 10, 1);
    px(c, 3, 12, '#6f4528', 10, 1);
    px(c, 7, 8, '#f2c94c', 2, 3); // brass latch
    px(c, 2, 4, '#3b2a1a', 1, 11);
    px(c, 13, 4, '#3b2a1a', 1, 11);
  }, true);
  canvas(scene, 'in-radio', TILE, TILE, (c) => {
    px(c, 1, 5, '#8d5a34', 14, 10);
    px(c, 2, 6, '#a36c40', 12, 8);
    px(c, 3, 7, '#3a3a46', 6, 6);
    for (let y = 8; y < 13; y += 2) px(c, 3, y, '#5a5a66', 6, 1);
    px(c, 11, 8, '#f2c94c', 2, 2);
    px(c, 11, 11, '#e2434b', 2, 2);
    px(c, 12, 0, '#3a3a46', 1, 5);
  }, true);
  canvas(scene, 'in-clock', 14, 14, (c) => {
    disc(c, 7, 7, 6, '#8d5a34', '#a36c40', '#6b4224');
    disc(c, 7, 7, 4, '#fffaea', '#ffffff', '#efe2c4');
    px(c, 7, 4, '#2b2b2b', 1, 4);
    px(c, 7, 7, '#2b2b2b', 3, 1);
  }, true);
  canvas(scene, 'in-trophy', 32, 40, (c) => {
    px(c, 0, 0, '#6b4224', 32, 40);
    px(c, 2, 2, '#c9ecfb', 28, 34); // glass
    px(c, 2, 18, '#6b4224', 28, 2);
    for (const [x, y, col] of [[6, 6, '#f2c94c'], [14, 6, '#c3c8cc'], [22, 6, '#c98a4a'], [10, 22, '#f2c94c'], [18, 22, '#f2c94c']] as const) {
      px(c, x, y, col, 5, 5);
      px(c, x + 1, y + 5, col, 3, 2);
      px(c, x, y + 7, col, 5, 2);
    }
    px(c, 3, 3, '#ffffff', 2, 10);
  }, true);
  canvas(scene, 'in-bigbed', 40, 46, (c) => {
    px(c, 1, 0, '#4a2f1a', 38, 12);
    px(c, 2, 1, '#6b4224', 36, 10);
    for (let x = 6; x < 36; x += 6) px(c, x, 3, '#8d5a34', 2, 6);
    px(c, 2, 10, '#fffaea', 36, 32);
    px(c, 4, 12, '#ffffff', 15, 8);
    px(c, 21, 12, '#ffffff', 15, 8);
    px(c, 2, 22, '#8a3a5a', 36, 20);
    px(c, 2, 22, '#a84d72', 36, 3);
    for (let x = 5; x < 38; x += 7) px(c, x, 29, '#f2c94c', 2, 2);
    px(c, 1, 42, '#4a2f1a', 38, 4);
  }, true);

  // ---------- living room & reading room (house renovations) ----------
  canvas(scene, 'in-sofa', 48, 28, (c) => {
    px(c, 2, 0, '#2f6f8f', 44, 12); // back
    px(c, 3, 1, '#4f8faf', 42, 4);
    px(c, 0, 8, '#2f6f8f', 6, 16); // arms
    px(c, 42, 8, '#2f6f8f', 6, 16);
    px(c, 5, 12, '#3f7f9f', 38, 10); // seat
    px(c, 5, 12, '#5f9fbf', 38, 2);
    px(c, 23, 12, '#2f6f8f', 1, 10);
    px(c, 8, 4, '#f2c94c', 8, 7); // cushions
    px(c, 32, 4, '#e2434b', 8, 7);
    px(c, 2, 24, '#5a3a22', 3, 4); px(c, 43, 24, '#5a3a22', 3, 4);
  }, true);
  canvas(scene, 'in-coffee', 32, 16, (c) => {
    px(c, 0, 2, '#6b4224', 32, 8);
    px(c, 0, 2, '#8d5a34', 32, 3);
    px(c, 2, 10, '#5a3a22', 3, 6); px(c, 27, 10, '#5a3a22', 3, 6);
    px(c, 10, 0, '#f4f1e8', 6, 3); // a cup
    px(c, 20, 0, '#3f7fbf', 7, 3); // a book
  }, true);
  canvas(scene, 'in-floorlamp', TILE, 36, (c) => {
    px(c, 7, 10, '#3a3a46', 2, 24);
    px(c, 4, 33, '#3a3a46', 8, 3);
    px(c, 2, 0, '#f2dc94', 12, 10);
    px(c, 3, 1, '#fff3c4', 5, 8);
  }, true);
  canvas(scene, 'in-aquarium', 40, 40, (c) => {
    px(c, 2, 22, '#6b4224', 36, 18); // stand
    px(c, 3, 23, '#8d5a34', 34, 16);
    px(c, 0, 0, '#5f6f7d', 40, 24); // tank
    px(c, 2, 2, '#4aa3df', 36, 20);
    px(c, 2, 2, '#8fd0f5', 36, 3);
    px(c, 2, 18, '#e6cf9a', 36, 4); // sand
    px(c, 8, 12, '#4f9a3f', 2, 6); px(c, 30, 10, '#4f9a3f', 2, 8);
    px(c, 14, 9, '#e88a2d', 5, 3); px(c, 19, 10, '#e88a2d', 1, 1); // fish
    px(c, 24, 14, '#f2c94c', 4, 2);
  }, true);
  canvas(scene, 'in-armchair', 24, 24, (c) => {
    px(c, 2, 0, '#8a3a5a', 20, 10);
    px(c, 0, 6, '#8a3a5a', 5, 14); px(c, 19, 6, '#8a3a5a', 5, 14);
    px(c, 4, 10, '#a84d72', 16, 8);
    px(c, 2, 20, '#5a3a22', 3, 4); px(c, 19, 20, '#5a3a22', 3, 4);
  }, true);
  canvas(scene, 'in-rug2', 72, 48, (c) => {
    px(c, 0, 0, '#2f6f8f', 72, 48);
    px(c, 3, 3, '#e8e2d0', 66, 42);
    px(c, 7, 7, '#4f8faf', 58, 34);
    for (let x = 12; x < 62; x += 10) for (let y = 12; y < 38; y += 10) px(c, x, y, '#e8e2d0', 3, 3);
  });

  // ---------- Toko Mebel interior ----------
  canvas(scene, 'shop-floor', TILE, TILE, (c) => {
    px(c, 0, 0, '#8d5a34', TILE, TILE);
    px(c, 0, 0, '#7a4b2a', 8, 8);
    px(c, 8, 8, '#7a4b2a', 8, 8);
    px(c, 0, 0, '#6b4224', TILE, 1);
    px(c, 0, 0, '#6b4224', 1, TILE);
  });
  canvas(scene, 'shop-wall', TILE, TILE * 2, (c) => {
    px(c, 0, 0, '#dfe9e4', TILE, 20);
    for (let y = 3; y < 20; y += 5) px(c, 0, y, '#cddcd5', TILE, 1);
    px(c, 0, 20, '#2f8f8a', TILE, 2);
    px(c, 0, 22, '#4fb3ad', TILE, 8);
    px(c, 0, 30, '#1a5a56', TILE, 2);
  });
  canvas(scene, 'pedestal', 32, 12, (c) => {
    px(c, 0, 2, '#efe2c4', 32, 8);
    px(c, 0, 0, '#ffffff', 32, 3);
    px(c, 0, 10, '#b8a888', 32, 2);
  }, true);
  canvas(scene, 'counter', 64, 28, (c) => {
    px(c, 0, 0, '#a36c40', 64, 6);
    px(c, 0, 0, '#c08a55', 64, 2);
    px(c, 0, 6, '#8d5a34', 64, 22);
    for (let x = 4; x < 64; x += 12) px(c, x, 9, '#6b4224', 8, 16);
    px(c, 46, -0, '#3a3a46', 10, 5); // cash register
    px(c, 48, 0, '#5fb04a', 6, 2);
  }, true);
  canvas(scene, 'sign-mebel', 40, 12, (c) => {
    px(c, 0, 0, '#6b4224', 40, 12);
    px(c, 1, 1, '#f4ead2', 38, 10);
  }, true);

  // ---------- village & lake ----------
  canvas(scene, 'stone', TILE, TILE, (c) => {
    px(c, 0, 0, '#b9b3a6', TILE, TILE);
    const r = rng(41);
    for (let i = 0; i < 18; i++) px(c, Math.floor(r() * 16), Math.floor(r() * 16), r() < 0.5 ? '#aaa395' : '#c8c2b5');
    px(c, 0, 7, '#9c9588', 16, 1);
    px(c, 0, 15, '#9c9588', 16, 1);
    px(c, 7, 0, '#9c9588', 1, 7);
    px(c, 3, 8, '#9c9588', 1, 7);
    px(c, 12, 8, '#9c9588', 1, 7);
    px(c, 0, 8, '#d3cdc1', 16, 1);
  });
  canvas(scene, 'sand', TILE, TILE, (c) => {
    px(c, 0, 0, '#ecd9a5', TILE, TILE);
    const r = rng(23);
    for (let i = 0; i < 20; i++) px(c, Math.floor(r() * 16), Math.floor(r() * 16), r() < 0.5 ? '#dfc98f' : '#f6e7bd');
  });
  canvas(scene, 'plank', TILE, TILE, (c) => {
    px(c, 0, 0, '#a36c40', TILE, TILE);
    for (let y = 0; y < 16; y += 4) {
      px(c, 0, y, '#7a4b2a', 16, 1);
      px(c, 0, y + 1, '#b9824f', 16, 1);
    }
    px(c, 0, 0, '#5a3a22', 1, 16);
    px(c, 15, 0, '#5a3a22', 1, 16);
    px(c, 2, 2, '#4a3020'); px(c, 13, 6, '#4a3020'); px(c, 2, 10, '#4a3020'); px(c, 13, 14, '#4a3020');
  });
  canvas(scene, 'shore', TILE, 4, (c) => {
    px(c, 0, 0, '#d8f0fb', TILE, 1);
    px(c, 0, 1, '#a9defa', TILE, 2);
    px(c, 2, 1, '#ffffff', 3, 1);
    px(c, 10, 2, '#ffffff', 2, 1);
  });
  canvas(scene, 'reeds', TILE, TILE, (c) => {
    for (const [x, h] of [[3, 10], [6, 13], [9, 9], [12, 12]]) {
      px(c, x, 16 - h, '#4f8f3a', 1, h);
      px(c, x - 1, 16 - h, '#8a5a34', 2, 3);
    }
    px(c, 5, 8, '#6aa84f', 1, 4);
    px(c, 11, 7, '#6aa84f', 1, 5);
  }, true);
  canvas(scene, 'fountain', 48, 48, (c) => {
    // basin
    for (let y = 0; y < 48; y++)
      for (let x = 0; x < 48; x++) {
        const d = Math.hypot(x - 23.5, (y - 30) * 1.25);
        if (d < 22) px(c, x, y, d > 18 ? '#9aa0a6' : d > 16 ? '#c3c8cc' : '#4aa3df');
      }
    for (let i = 0; i < 10; i++) px(c, 12 + Math.round(i * 2.5), 28 + (i % 3), '#8fd0f5');
    // pillar and top bowl
    px(c, 21, 10, '#c3c8cc', 6, 22);
    px(c, 22, 10, '#e2e6e9', 2, 22);
    px(c, 15, 8, '#9aa0a6', 18, 4);
    px(c, 16, 7, '#c3c8cc', 16, 2);
    // spray
    px(c, 23, 0, '#a9defa', 2, 7);
    px(c, 19, 3, '#a9defa', 2, 4);
    px(c, 27, 3, '#a9defa', 2, 4);
    px(c, 23, 0, '#ffffff', 1, 3);
  }, true);
  canvas(scene, 'lamp', TILE, 32, (c) => {
    px(c, 7, 10, '#3a3a46', 2, 21);
    px(c, 5, 30, '#3a3a46', 6, 2);
    px(c, 4, 2, '#3a3a46', 8, 2);
    px(c, 5, 4, '#f7e3a1', 6, 6);
    px(c, 5, 4, '#fff3c4', 2, 6);
    px(c, 4, 10, '#3a3a46', 8, 1);
    px(c, 7, 0, '#3a3a46', 2, 2);
  }, true);
  canvas(scene, 'bench', 32, 16, (c) => {
    px(c, 1, 4, '#a36c40', 30, 3);
    px(c, 1, 8, '#b9824f', 30, 3);
    px(c, 1, 4, '#c49a6c', 30, 1);
    px(c, 3, 11, '#5a3a22', 2, 5);
    px(c, 27, 11, '#5a3a22', 2, 5);
  }, true);
  canvas(scene, 'flowerbed', TILE, TILE, (c) => {
    px(c, 1, 6, '#6b4224', 14, 9);
    px(c, 2, 7, '#5a3a22', 12, 7);
    const cols = ['#f28bb3', '#f2c94c', '#ffffff', '#e2434b'];
    for (let i = 0; i < 6; i++) {
      const x = 3 + (i % 3) * 4;
      const y = 4 + Math.floor(i / 3) * 4;
      px(c, x, y + 1, '#4f9a35', 1, 3);
      px(c, x - 1, y, cols[i % 4], 3, 2);
    }
  }, true);
  canvas(scene, 'well', 32, 32, (c) => {
    disc(c, 16, 22, 10, '#9aa0a6', '#c3c8cc', '#6f757b');
    disc(c, 16, 21, 6, '#2c3e50', '#2c3e50', '#2c3e50');
    px(c, 5, 6, '#6b4224', 2, 16);
    px(c, 25, 6, '#6b4224', 2, 16);
    px(c, 3, 3, '#b3402f', 26, 4);
    px(c, 3, 3, '#cf5a43', 13, 2);
    px(c, 15, 7, '#8a949e', 2, 8);
  }, true);
  canvas(scene, 'shop', 32, 32, (c) => {
    px(c, 2, 15, '#8d5a34', 28, 17);
    px(c, 3, 16, '#b07a48', 26, 8);
    for (let x = 0; x < 32; x += 6) {
      px(c, x, 5, '#f4efe2', 3, 9);
      px(c, x + 3, 5, '#d9503f', 3, 9);
    }
    for (let x = 0; x < 32; x += 6) px(c, x + 1, 14, '#d9503f', 4, 1);
    px(c, 3, 2, '#6b4224', 2, 13);
    px(c, 27, 2, '#6b4224', 2, 13);
    px(c, 0, 1, '#c0392b', 32, 4);
    const goods = ['#e2434b', '#f2cf3c', '#5fb04a', '#e88a2d', '#a0527d'];
    goods.forEach((g, i) => {
      px(c, 5 + i * 5, 19, g, 3, 3);
      px(c, 5 + i * 5, 19, 'rgba(255,255,255,0.5)');
    });
    px(c, 2, 24, '#6b4224', 28, 2);
    px(c, 10, 27, '#efe0bd', 12, 4);
    px(c, 12, 28, '#6b4224', 8, 1);
  }, true);
  canvas(scene, 'board', 24, 28, (c) => {
    px(c, 3, 14, '#6b4224', 3, 14);
    px(c, 18, 14, '#6b4224', 3, 14);
    px(c, 1, 2, '#6b4224', 22, 15);
    px(c, 2, 3, '#a36c40', 20, 13);
    px(c, 1, 1, '#8d5a34', 22, 2);
    // pinned notes
    px(c, 4, 5, '#f6ecd0', 5, 6);
    px(c, 11, 4, '#fff6dc', 5, 7);
    px(c, 17, 6, '#f2e2b8', 4, 5);
    px(c, 6, 5, '#d9503f');
    px(c, 13, 4, '#3f7fbf');
    px(c, 18, 6, '#5fb04a');
    for (const x of [5, 12, 17]) px(c, x, 8, '#b8a080', 3, 1);
  }, true);
  canvas(scene, 'coop', 48, 40, (c) => {
    // walls
    px(c, 4, 16, '#c0533f', 40, 24);
    for (let x = 6; x < 44; x += 4) px(c, x, 16, '#a8443a', 1, 24);
    px(c, 4, 16, '#d9705a', 2, 24);
    // roof
    for (let i = 0; i < 14; i++) px(c, 14 - i, 2 + i, '#6b4224', 20 + i * 2, 1);
    px(c, 0, 15, '#5a3a22', 48, 3);
    for (let i = 0; i < 14; i++) px(c, 14 - i, 2 + i, '#8d5a34', 10 + i, 1);
    // white trim and door
    px(c, 17, 24, '#f4efe2', 14, 16);
    px(c, 19, 26, '#7a4b2a', 10, 14);
    px(c, 19, 26, '#f4efe2', 10, 1);
    px(c, 19, 26, '#f4efe2', 1, 14);
    px(c, 28, 26, '#f4efe2', 1, 14);
    for (let i = 0; i < 10; i++) px(c, 19 + i, 26 + Math.round(i * 1.4), '#f4efe2');
    // round window
    px(c, 22, 8, '#f4efe2', 4, 4);
    px(c, 23, 9, '#3a2a20', 2, 2);
    // hay
    px(c, 6, 34, '#e8c35a', 9, 6);
    px(c, 7, 33, '#f2d77a', 7, 2);
  }, true);
  canvas(scene, 'stage', 48, 36, (c) => {
    // wooden stage
    px(c, 2, 24, '#8d5a34', 44, 10);
    px(c, 2, 24, '#b07a48', 44, 2);
    for (let x = 4; x < 46; x += 6) px(c, x, 27, '#6b4224', 1, 7);
    // posts and striped canopy
    px(c, 4, 6, '#6b4224', 3, 18);
    px(c, 41, 6, '#6b4224', 3, 18);
    for (let x = 0; x < 48; x += 6) {
      px(c, x, 2, '#f2c94c', 3, 8);
      px(c, x + 3, 2, '#3f7fbf', 3, 8);
    }
    for (let x = 0; x < 48; x += 6) {
      px(c, x + 1, 10, '#f2c94c', 2, 2);
      px(c, x + 4, 10, '#3f7fbf', 2, 2);
    }
    px(c, 0, 0, '#c0392b', 48, 3);
    // trophy on display
    px(c, 21, 15, '#f2c94c', 6, 5);
    px(c, 19, 15, '#f2c94c', 2, 2);
    px(c, 27, 15, '#f2c94c', 2, 2);
    px(c, 23, 20, '#c99a2e', 2, 2);
    px(c, 21, 22, '#c99a2e', 6, 2);
    px(c, 22, 16, '#fff3a8', 1, 2);
  }, true);
  canvas(scene, 'bunting', 64, 10, (c) => {
    px(c, 0, 1, '#6b4224', 64, 1);
    const cols = ['#e2434b', '#f2c94c', '#5fb04a', '#3f7fbf', '#f28bb3'];
    for (let i = 0; i < 9; i++) {
      const x = 2 + i * 7;
      const col = cols[i % cols.length];
      for (let r = 0; r < 6; r++) px(c, x + Math.floor(r / 2), 2 + r, col, 5 - r, 1);
    }
  });
  canvas(scene, 'signpost', 16, 22, (c) => {
    px(c, 7, 9, '#5a3a22', 2, 13); // post
    px(c, 1, 2, '#5a3a22', 14, 9); // board outline
    px(c, 2, 3, '#c08552', 12, 7);
    px(c, 2, 3, '#d9a06a', 12, 1);
    px(c, 4, 5, '#5a3a22', 8, 1); // carved letters
    px(c, 4, 7, '#5a3a22', 6, 1);
    px(c, 12, 4, '#3b6fd0', 1, 4); // a little blue wave mark
  }, true);
  canvas(scene, 'sign-lock', 16, 20, (c) => {
    px(c, 7, 10, '#6b4224', 2, 10);
    px(c, 1, 1, '#a36c40', 14, 10);
    px(c, 1, 1, '#c49a6c', 14, 1);
    // padlock
    px(c, 6, 3, '#8a949e', 4, 1);
    px(c, 5, 4, '#8a949e', 1, 2);
    px(c, 10, 4, '#8a949e', 1, 2);
    px(c, 4, 6, '#f2c94c', 8, 4);
    px(c, 7, 7, '#5a3a22', 2, 2);
  }, true);
  canvas(scene, 'bubble', 10, 12, (c) => {
    px(c, 1, 0, '#fffbe6', 8, 9);
    px(c, 0, 1, '#fffbe6', 10, 7);
    px(c, 4, 9, '#fffbe6', 2, 2);
    px(c, 4, 2, '#d9503f', 2, 4);
    px(c, 4, 7, '#d9503f', 2, 1);
  }, true);
  canvas(scene, 'bin', TILE, TILE, (c) => {
    px(c, 1, 5, '#6b4224', 14, 11);
    px(c, 2, 6, '#b07a48', 12, 9);
    px(c, 2, 10, '#8d5a34', 12, 1);
    px(c, 0, 2, '#5a3a22', 16, 4);
    px(c, 0, 2, '#7a4b2a', 16, 1);
    px(c, 7, 12, '#f2c94c', 2, 2);
  }, true);
  canvas(scene, 'fence', TILE, TILE, (c) => {
    px(c, 2, 3, '#c49a6c', 3, 13);
    px(c, 11, 3, '#c49a6c', 3, 13);
    px(c, 2, 3, '#e0bd8e', 1, 13);
    px(c, 11, 3, '#e0bd8e', 1, 13);
    px(c, 0, 6, '#a77a4c', 16, 2);
    px(c, 0, 11, '#a77a4c', 16, 2);
  }, true);
  canvas(scene, 'cursor', TILE, TILE, (c) => {
    const w = '#fffbe6';
    for (const [x, y, dx, dy] of [[0, 0, 1, 1], [15, 0, -1, 1], [0, 15, 1, -1], [15, 15, -1, -1]]) {
      px(c, x, y, w);
      px(c, x + dx, y, w);
      px(c, x + dx * 2, y, w);
      px(c, x, y + dy, w);
      px(c, x, y + dy * 2, w);
    }
  });

  // ---------- player ----------
  const dirs: Record<string, [string[], string[]]> = {
    down: [HEAD_DOWN, BODY_FRONT],
    up: [HEAD_UP, BODY_FRONT],
    side: [HEAD_SIDE, BODY_SIDE],
  };
  for (const [dir, [head, body]] of Object.entries(dirs)) {
    LEGS.forEach((legs, f) => {
      canvas(scene, `player-${dir}-${f}`, TILE, TILE, (c) => art(c, [...head, ...body, ...legs].slice(0, 16), PLAYER_PAL), true);
    });
  }

  // ---------- villagers: same body, own hair and clothes ----------
  const NPC_HEAD = [
    '................',
    '.....HHHHHH.....',
    '....HHHHHHHH....',
    '....HHhHHHHH....',
    '....HSSSSSSH....',
    '.....SESSES.....',
    '.....sSSSSs.....',
    '......ssss......',
  ];
  const npcLooks: Record<string, Record<string, string>> = {
    sari: { H: '#3b2a20', h: '#5a4030', C: '#e88a2d', c: '#c0701e', l: '#f4b66a', P: '#7a4b2a', p: '#5a3a22' },
    darto: { H: '#d8d8d8', h: '#ffffff', C: '#2f5590', c: '#264577', l: '#5a8fd0', P: '#3a3a46', p: '#2a2a33' },
    rani: { H: '#1f1b2e', h: '#3a3352', C: '#f4f1e8', c: '#d8d2c2', l: '#ffffff', P: '#4f9a4a', p: '#3a7a36' },
    joyo: { H: '#bdbdbd', h: '#e6e6e6', C: '#6b8f71', c: '#4f6f55', l: '#8fb595', P: '#5f452c', p: '#4c3723', S: '#e0b07e', s: '#c08e5e' },
    mebel: { H: '#2b2b2b', h: '#4a4a4a', C: '#2f8f8a', c: '#21706b', l: '#4fb3ad', P: '#5a4a3a', p: '#40342a' }, // shopkeeper in a work apron
    dina: { H: '#3a3a3a', h: '#6a6a6a', C: '#7a5a3a', c: '#5f452c', l: '#b08a52', P: '#2a2a33', p: '#1f1f26' }, // batik shirt
  };
  for (const [id, look] of Object.entries(npcLooks)) {
    LEGS.forEach((legs, f) => {
      canvas(scene, `npc-${id}-${f}`, TILE, TILE, (c) => art(c, [...NPC_HEAD, ...BODY_FRONT, ...legs].slice(0, 16), { ...PLAYER_PAL, ...look }), true);
    });
  }

  // ---------- crops: 4 growth stages + withered ----------
  for (const crop of CROPS) {
    if (crop.id === 'sawit') continue; // drawn below as a tall palm
    for (let st = 0; st < 4; st++) {
      canvas(scene, `crop-${crop.id}-${st}`, TILE, TILE, (c) => {
        const L = crop.leaf;
        const LL = Phaser.Display.Color.HexStringToColor(L).lighten(18).rgba;
        if (st === 0) {
          px(c, 5, 10, '#e8d4a0', 2, 2);
          px(c, 9, 8, '#e8d4a0', 2, 2);
          px(c, 8, 12, '#e8d4a0', 2, 2);
        } else if (st === 1) {
          px(c, 7, 9, L, 2, 5);
          px(c, 5, 8, LL, 2, 2);
          px(c, 9, 7, L, 2, 2);
        } else if (st === 2) {
          px(c, 7, 6, L, 2, 8);
          px(c, 4, 6, LL, 3, 3);
          px(c, 9, 4, L, 3, 3);
          px(c, 3, 10, LL, 4, 2);
          px(c, 9, 9, L, 4, 2);
        } else {
          px(c, 7, 3, L, 2, 11);
          px(c, 3, 4, LL, 4, 3);
          px(c, 9, 2, L, 4, 3);
          px(c, 2, 8, LL, 5, 2);
          px(c, 9, 7, L, 5, 2);
          const P = crop.color;
          disc(c, 6, 11, 2, P, '#ffffff', P);
          disc(c, 11, 12, 2, P, '#ffffff', P);
          disc(c, 8, 7, 1, P, P, P);
        }
      }, st > 0);
    }
    canvas(scene, `icon-${crop.id}`, TILE, TILE, (c) => {
      px(c, 7, 1, crop.leaf, 2, 4);
      px(c, 4, 2, crop.leaf, 3, 2);
      disc(c, 8, 9, 5, crop.color, '#ffffff', crop.color);
      px(c, 6, 7, crop.color, 2, 1);
    }, true);
  }
  // oil palm: sprout → young palm → palm → palm with orange fruit bunches (16x32, overhangs the tile above)
  const frond = (c: Ctx, cx: number, cy: number, len: number, col: string, dark: string) => {
    for (let i = 0; i < len; i++) {
      px(c, cx - 1 - i, cy + Math.floor(i / 2), col);
      px(c, cx + 1 + i, cy + Math.floor(i / 2), col);
      px(c, cx - 1 - i, cy + Math.floor(i / 2) + 1, dark);
      px(c, cx + 1 + i, cy + Math.floor(i / 2) + 1, dark);
    }
    px(c, cx - 1, cy - 3, col, 2, 3);
  };
  for (let st = 0; st < 4; st++) {
    canvas(scene, `crop-sawit-${st}`, TILE, 32, (c) => {
      if (st === 0) {
        px(c, 7, 26, '#5fb04a', 2, 4);
        px(c, 5, 25, '#7cc95a', 2, 2);
        px(c, 9, 24, '#5fb04a', 2, 2);
        return;
      }
      const top = st === 1 ? 20 : st === 2 ? 12 : 8;
      px(c, 7, top + 2, '#7a5a3a', 2, 30 - top);
      for (let y = top + 4; y < 30; y += 3) px(c, 6, y, '#5f452c', 4, 1); // trunk rings
      frond(c, 8, top, st === 1 ? 4 : 7, '#3f9a45', '#2a6b30');
      frond(c, 8, top + 2, st === 1 ? 3 : 6, '#57b257', '#2f7d3a');
      if (st === 3) {
        for (const [x, y] of [[4, top + 5], [10, top + 5], [7, top + 6]]) {
          px(c, x, y, '#d9541e', 3, 3);
          px(c, x, y, '#f08a3a');
        }
      }
    }, true);
  }
  canvas(scene, 'icon-sawit', TILE, TILE, (c) => {
    // a fruit bunch
    for (const [x, y] of [[4, 5], [8, 4], [10, 7], [6, 8], [9, 10], [5, 11], [7, 6]]) {
      disc(c, x, y, 2, '#d9541e', '#f08a3a', '#9a3a14');
    }
    px(c, 7, 1, '#5f452c', 2, 3);
  }, true);

  canvas(scene, 'crop-dead', TILE, TILE, (c) => {
    px(c, 7, 6, '#7a5a3a', 2, 8);
    px(c, 4, 9, '#8a6a45', 3, 2);
    px(c, 9, 8, '#8a6a45', 3, 2);
  }, true);

  // ---------- livestock ----------
  const HEN_PAL: Record<string, string> = {
    W: '#fbf8f0', w: '#ddd6c6', R: '#d9503f', Y: '#f2b53c', E: '#2b2b2b', L: '#e8a33c',
  };
  const HEN = [
    '................',
    '................',
    '..........RR....',
    '.........RWWR...',
    '.........WWEWY..',
    '.........WWWWYY.',
    '..w......WWWW...',
    '.wWw....WWWW....',
    '.wWWWWWWWWWW....',
    '..wWWWWWWWWW....',
    '..wwWWWWWWw.....',
    '...wwwwwwww.....',
    '.....L...L......',
  ];
  for (let f = 0; f < 2; f++) {
    canvas(scene, `hen${f}`, TILE, TILE, (c) => {
      const legs = f === 0 ? HEN : [...HEN.slice(0, 12), '....L.....L.....'];
      art(c, legs, HEN_PAL, 0, 2);
    }, true);
  }
  canvas(scene, 'icon-ayam', TILE, TILE, (c) => art(c, HEN, HEN_PAL, 0, 2), true);
  canvas(scene, 'icon-telur', TILE, TILE, (c) => {
    disc(c, 8, 9, 4, '#f4ead6', '#ffffff', '#d9cdb2');
    px(c, 6, 4, '#f4ead6', 4, 2);
  }, true);
  canvas(scene, 'icon-telur-emas', TILE, TILE, (c) => {
    disc(c, 8, 9, 4, '#f2c94c', '#fff3a8', '#c99a2e');
    px(c, 6, 4, '#f2c94c', 4, 2);
    px(c, 12, 3, '#ffffff');
    px(c, 3, 6, '#ffffff');
  }, true);
  canvas(scene, 'icon-pakan', TILE, TILE, (c) => {
    px(c, 3, 5, '#d9c08c', 10, 10);
    px(c, 4, 3, '#c9ad75', 8, 3);
    px(c, 3, 5, '#e6d3a6', 3, 10);
    px(c, 6, 8, '#e8c35a', 1, 1); px(c, 9, 9, '#e8c35a', 1, 1); px(c, 7, 11, '#e8c35a', 1, 1); px(c, 10, 12, '#e8c35a', 1, 1);
    px(c, 5, 2, '#8a6a45', 6, 1);
  }, true);
  canvas(scene, 'heart', 8, 8, (c) => {
    px(c, 1, 1, '#e2434b', 2, 1); px(c, 5, 1, '#e2434b', 2, 1);
    px(c, 0, 2, '#e2434b', 8, 2);
    px(c, 1, 4, '#e2434b', 6, 1);
    px(c, 2, 5, '#e2434b', 4, 1);
    px(c, 3, 6, '#e2434b', 2, 1);
    px(c, 1, 2, '#ff9aa0');
  });

  // ---------- items ----------
  canvas(scene, 'icon-pupuk', TILE, TILE, (c) => {
    px(c, 3, 5, '#8fbf5a', 10, 10);
    px(c, 4, 3, '#6f9a45', 8, 3);
    px(c, 3, 5, '#a8d470', 4, 10);
    px(c, 6, 8, '#f2e27a', 4, 4);
    px(c, 7, 7, '#fff6c0', 2, 6);
    px(c, 5, 9, '#fff6c0', 6, 2);
  }, true);
  canvas(scene, 'icon-sprinkler', TILE, TILE, (c) => {
    px(c, 4, 11, '#8a949e', 8, 4);
    px(c, 5, 12, '#c9d2da', 6, 2);
    px(c, 7, 5, '#8a949e', 2, 6);
    px(c, 5, 4, '#c9d2da', 6, 2);
    px(c, 3, 3, '#6fb7e8', 2, 1);
    px(c, 11, 3, '#6fb7e8', 2, 1);
    px(c, 7, 1, '#6fb7e8', 2, 1);
  }, true);
  canvas(scene, 'soil-fert', TILE, TILE, (c) => {
    for (const [x, y] of [[3, 3], [11, 4], [6, 9], [13, 12], [2, 13], [9, 14]]) {
      px(c, x, y, '#d8f5a0');
      px(c, x + 1, y, '#a8d470');
    }
  });

  canvas(scene, 'icon-tas', TILE, TILE, (c) => {
    px(c, 3, 4, '#a36c40', 10, 11);
    px(c, 4, 5, '#c08a55', 8, 4);
    px(c, 5, 2, '#7a4b2a', 6, 3);
    px(c, 6, 3, '#f3e4bd', 4, 1);
    px(c, 4, 10, '#8d5a34', 8, 4);
    px(c, 7, 11, '#f2c94c', 2, 2);
    px(c, 3, 4, '#c08a55', 1, 11);
  }, true);

  // ---------- dishes: food on a plate ----------
  for (const d of DISHES) {
    canvas(scene, `icon-${d.id}`, TILE, TILE, (c) => {
      // plate
      for (let x = 1; x < 15; x++) px(c, x, 11, '#d8dde2');
      px(c, 2, 12, '#b9c0c7', 12, 1);
      px(c, 3, 10, '#f4f6f8', 10, 1);
      // food mound with a highlight
      const light = Phaser.Display.Color.HexStringToColor(d.color).lighten(20).rgba;
      const dark = Phaser.Display.Color.HexStringToColor(d.color).darken(18).rgba;
      disc(c, 8, 8, 4, d.color, light, dark);
      px(c, 4, 9, d.color, 8, 2);
      // steam
      px(c, 6, 1, '#ffffff', 1, 2);
      px(c, 9, 0, '#ffffff', 1, 2);
      px(c, 7, 3, '#ffffff');
    }, true);
  }

  // ---------- small UI glyphs ----------
  canvas(scene, 'ic-coin', TILE, TILE, (c) => {
    disc(c, 8, 8, 6, '#f2c94c', '#fff3a8', '#c99a2e');
    px(c, 7, 4, '#c99a2e', 2, 8);
    px(c, 6, 5, '#c99a2e', 4, 1);
    px(c, 6, 10, '#c99a2e', 4, 1);
  }, true);
  canvas(scene, 'ic-sprout', TILE, TILE, (c) => {
    px(c, 7, 7, '#4f9a35', 2, 7);
    disc(c, 5, 6, 3, '#5fb04a', '#8fd06a', '#3f8a3a');
    disc(c, 11, 5, 3, '#5fb04a', '#8fd06a', '#3f8a3a');
    px(c, 4, 13, '#8a5a34', 8, 2);
  }, true);
  canvas(scene, 'ic-warn', TILE, TILE, (c) => {
    for (let i = 0; i < 7; i++) px(c, 7 - i, 2 + i * 2, '#ff9f0a', 2 + i * 2, 2);
    px(c, 7, 6, '#1d1d1f', 2, 4);
    px(c, 7, 11, '#1d1d1f', 2, 2);
  }, true);

  // ---------- fish & fishing ----------
  for (const f of FISH) {
    const [body, light, dark] = f.colors;
    canvas(scene, `icon-${f.id}`, TILE, TILE, (c) => {
      if (f.shape === 'eel') {
        // long wavy body
        for (let x = 1; x < 15; x++) {
          const y = 8 + Math.round(Math.sin(x / 2.2) * 2);
          px(c, x, y - 1, body, 1, 3);
          px(c, x, y - 1, light, 1, 1);
        }
        px(c, 2, 6, '#2b2b2b');
        return;
      }
      if (f.shape === 'shrimp') {
        // curled body with feelers
        for (let i = 0; i < 9; i++) {
          const a = Math.PI * (0.15 + i / 10);
          px(c, 8 + Math.round(Math.cos(a) * 5), 8 + Math.round(Math.sin(a) * 4), body, 2, 2);
        }
        px(c, 12, 5, light, 2, 2);
        px(c, 13, 2, dark, 1, 3);
        px(c, 11, 1, dark, 1, 3);
        px(c, 3, 11, dark, 2, 2);
        px(c, 12, 6, '#2b2b2b');
        return;
      }
      const art = FISH_ART[f.art ?? f.id];
      if (art) {
        const pal: Record<string, string> = { o: shade(dark, 0.55), b: body, l: light, d: dark, e: '#1b1b1b', w: '#fbf6ee', r: '#e2434b' };
        art.forEach((row, y) => [...row].forEach((ch, x) => pal[ch] && px(c, x, y + 1, pal[ch])));
        if (f.id === 'ikan-emas' || f.id === 'ikan-arwana') {
          px(c, 6, 6, '#ffffff');
          px(c, 10, 9, '#ffffff');
        }
        return;
      }
      const long = f.shape === 'long';
      const x0 = long ? 1 : 2, x1 = long ? 13 : 12, h = long ? 3 : 4;
      for (let x = x0; x < x1; x++) {
        const hh = Math.round(Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * h);
        px(c, x, 8 - hh, body, 1, hh * 2 + 1);
        px(c, x, 8 - hh, light, 1, 1);
        px(c, x, 8 + hh, dark, 1, 1);
      }
      px(c, x1, 5, dark, 1, 7);
      px(c, x1 + 1, 4, dark, 2, 3);
      px(c, x1 + 1, 10, dark, 2, 3);
      px(c, x0 + 2, 7, '#2b2b2b');
      if (f.id === 'ikan-lele') {
        px(c, 1, 9, dark, 2, 1);
        px(c, 0, 10, dark, 1, 1);
      }
      if (f.id === 'ikan-koi') {
        px(c, 6, 6, '#e2434b', 3, 2);
        px(c, 9, 9, '#f2b53c', 2, 2);
      }
      if (f.id === 'ikan-emas' || f.id === 'ikan-arwana') {
        px(c, 7, 3, '#ffffff');
        px(c, 10, 12, '#ffffff');
      }
    }, true);
  }
  canvas(scene, 'bobber', 8, 8, (c) => {
    px(c, 2, 1, '#e2434b', 4, 3);
    px(c, 2, 4, '#ffffff', 4, 2);
    px(c, 3, 0, '#3b2a1a', 2, 1);
  }, true);
  // ---------- mining ----------
  for (const key of ['tool-beliung', 'icon-beliung']) canvas(scene, key, TILE, TILE, (c) => {
    for (let i = 0; i < 11; i++) px(c, 3 + i, 14 - i, i < 4 ? '#5a3a22' : '#a36c40'); // handle
    // the curved iron head across the top of the handle
    px(c, 4, 3, '#5f6f7d', 3, 2);
    px(c, 6, 2, '#8a9aa8', 5, 2);
    px(c, 10, 2, '#8a9aa8', 2, 3);
    px(c, 11, 4, '#5f6f7d', 2, 2);
    px(c, 12, 6, '#5f6f7d', 2, 3);
    px(c, 7, 2, '#c8d2dc', 3, 1);
    px(c, 2, 5, '#5f6f7d', 2, 2);
  }, true);
  canvas(scene, 'gravel', TILE, TILE, (c) => {
    px(c, 0, 0, '#a89c88', 16, 16);
    const dots: [number, number, string][] = [[2, 3, '#8f8370'], [9, 1, '#c2b8a4'], [12, 7, '#8f8370'], [5, 10, '#c2b8a4'], [1, 13, '#8f8370'], [13, 13, '#c2b8a4'], [7, 6, '#958a76']];
    for (const [x, y, col] of dots) px(c, x, y, col, 2, 2);
  });
  // ---------- the cave ----------
  canvas(scene, 'cave-mouth', 48, 40, (c) => {
    // a rocky hill with a dark arch in the middle
    px(c, 4, 6, '#6e6a62', 40, 34);
    px(c, 0, 14, '#6e6a62', 48, 26);
    px(c, 8, 2, '#7e7a72', 32, 6);
    px(c, 2, 12, '#8a867e', 10, 4);
    px(c, 34, 8, '#8a867e', 10, 4);
    px(c, 18, 4, '#9a968e', 12, 3);
    px(c, 0, 36, '#4e4a44', 48, 4);
    px(c, 14, 18, '#3a3630', 20, 22); // arch frame
    px(c, 16, 16, '#3a3630', 16, 2);
    px(c, 16, 20, '#0e0c0a', 16, 20); // the dark inside
    px(c, 18, 18, '#0e0c0a', 12, 2);
    px(c, 13, 16, '#8d5a34', 2, 24); // timber posts and beam
    px(c, 33, 16, '#8d5a34', 2, 24);
    px(c, 12, 14, '#a36c40', 24, 3);
    px(c, 22, 24, '#f2c94c', 4, 3); // a lantern glow deep inside
  }, true);
  canvas(scene, 'cave-wall', TILE, TILE, (c) => {
    px(c, 0, 0, '#3e3a34', 16, 16);
    px(c, 1, 2, '#4e4a44', 6, 4);
    px(c, 9, 7, '#4e4a44', 5, 5);
    px(c, 3, 11, '#4a463f', 5, 3);
    px(c, 2, 2, '#5e5a52', 3, 1);
    px(c, 10, 7, '#5e5a52', 3, 1);
  });
  canvas(scene, 'cave-floor', TILE, TILE, (c) => {
    px(c, 0, 0, '#6e5a46', 16, 16);
    const dots: [number, number, string][] = [[2, 3, '#5e4c3a'], [10, 2, '#7e6a54'], [13, 9, '#5e4c3a'], [5, 11, '#7e6a54'], [8, 7, '#64503e']];
    for (const [x, y, col] of dots) px(c, x, y, col, 2, 2);
  });
  canvas(scene, 'ladder-down', TILE, TILE, (c) => {
    px(c, 1, 1, '#1a1410', 14, 14); // the hole
    px(c, 2, 2, '#0a0806', 12, 12);
    px(c, 4, 2, '#a36c40', 1, 12); // ladder rails and rungs
    px(c, 11, 2, '#a36c40', 1, 12);
    for (let y = 4; y < 14; y += 3) px(c, 4, y, '#c08552', 8, 1);
  }, true);
  canvas(scene, 'ladder-up', 32, 16, (c) => {
    px(c, 6, 0, '#a36c40', 2, 16);
    px(c, 24, 0, '#a36c40', 2, 16);
    for (let y = 2; y < 16; y += 4) px(c, 6, y, '#c08552', 20, 2);
  }, true);

  const ORE_LOOK: Record<string, [string, string, string]> = {
    batu: ['#8a8a8e', '#b4b4b8', '#5e5e62'],
    'bijih-tembaga': ['#8a8a8e', '#e08a4a', '#5e5e62'],
    'bijih-besi': ['#7a7e86', '#c8d2e0', '#4e525a'],
    'bijih-emas': ['#86827a', '#f2c94c', '#5a564e'],
  };
  for (const [id, [body, fleck, dark]] of Object.entries(ORE_LOOK)) {
    // the rock you swing at in the quarry
    canvas(scene, `rock-${id}`, TILE, TILE, (c) => {
      px(c, 2, 6, dark, 12, 9);
      px(c, 3, 4, dark, 10, 2);
      px(c, 3, 5, body, 10, 9);
      px(c, 4, 4, body, 8, 1);
      px(c, 4, 5, '#d0d0d4', 4, 1); // light on top
      if (id !== 'batu') for (const [x, y] of [[5, 8], [9, 7], [7, 11], [11, 10]]) px(c, x, y, fleck, 2, 2);
    }, true);
    // the item in the bag
    canvas(scene, `icon-${id}`, TILE, TILE, (c) => {
      px(c, 3, 5, dark, 10, 8);
      px(c, 4, 4, dark, 8, 1);
      px(c, 4, 5, body, 8, 7);
      px(c, 5, 5, '#d0d0d4', 3, 1);
      if (id !== 'batu') for (const [x, y] of [[5, 7], [9, 6], [8, 9]]) px(c, x, y, fleck, 2, 2);
    }, true);
  }

  for (const key of ['tool-pancing', 'icon-pancing']) canvas(scene, key, TILE, TILE, (c) => {
    for (let i = 0; i < 12; i++) px(c, 2 + i, 14 - i, i < 4 ? '#5a3a22' : '#a36c40');
    px(c, 13, 2, '#dcdcdc', 1, 9);
    px(c, 12, 11, '#e2434b', 3, 2);
    px(c, 3, 11, '#8a949e', 2, 2);
  }, true);

  // ---------- tool icons ----------
  canvas(scene, 'tool-cangkul', TILE, TILE, (c) => {
    for (let i = 0; i < 10; i++) px(c, 3 + i, 13 - i, '#a36c40', 2, 2);
    px(c, 10, 1, '#c9d2da', 5, 3);
    px(c, 12, 4, '#8a949e', 3, 2);
  }, true);
  canvas(scene, 'tool-siram', TILE, TILE, (c) => {
    px(c, 3, 6, '#5b8fb9', 9, 8);
    px(c, 4, 7, '#8fc1e6', 7, 2);
    px(c, 12, 7, '#5b8fb9', 3, 2);
    px(c, 14, 5, '#5b8fb9', 2, 3);
    px(c, 5, 3, '#3f6f99', 5, 2);
  }, true);
  canvas(scene, 'tool-benih', TILE, TILE, (c) => {
    px(c, 3, 5, '#e0c690', 10, 10);
    px(c, 4, 3, '#c9ad75', 8, 3);
    px(c, 6, 2, '#8a6a45', 4, 2);
    px(c, 6, 9, '#5fb04a', 4, 3);
  }, true);
  canvas(scene, 'tool-tangan', TILE, TILE, (c) => {
    px(c, 4, 6, '#f5c896', 8, 8);
    for (let i = 0; i < 4; i++) px(c, 4 + i * 2, 2 + (i === 0 ? 2 : 0), '#f5c896', 2, 5);
    px(c, 12, 8, '#f5c896', 2, 3);
    px(c, 4, 13, '#dba273', 8, 1);
  }, true);
}
