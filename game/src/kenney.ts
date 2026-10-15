import Phaser from 'phaser';
import farmSheet from '../assets/kenney/tiny-farm/Tilemap/tilemap_packed.png';

// Art from Kenney's Tiny Farm (CC0) where it fits our crops, plus our own crops drawn
// in the same style (dark outline, bright flat colours, chunky shapes).

const SHEET = 'kenney-farm';
const COLS = 12;
const OUTLINE = '#3b2027';

/** Queue the sheet in a scene's preload(). */
export function loadKenney(scene: Phaser.Scene) {
  scene.load.image(SHEET, farmSheet);
}

/** Crops that use Kenney frames: growth stages 1-3 and the bag icon. Stage 0 (seeds) stays ours. */
const KENNEY_CROPS: Record<string, { stages: [number, number, number]; icon: number; bag: number }> = {
  jagung: { stages: [28, 29, 30], icon: 32, bag: 33 },
  tomat: { stages: [40, 41, 42], icon: 44, bag: 45 },
  padi: { stages: [64, 65, 66], icon: 68, bag: 69 },
  ubi: { stages: [16, 17, 18], icon: 20, bag: 21 },
};

/** Seed bags for our own crops: Kenney's bag with a 4x4 emblem painted on its label (at 6,8). */
const BAG = 9;
const LABEL = '#fdd6b4';
const EMBLEM: Record<string, string[]> = {
  kangkung: ['.G.G', 'GgGg', '.gg.', '.g..'],
  timun: ['..cC', '.cC.', 'cC..', 'c...'],
  terong: ['.g..', 'PPp.', 'PPp.', '.p..'],
  cabai: ['.g.g', 'RrRr', 'RrRr', '.r.r'],
  singkong: ['...t', '.tt.', 'tT..', 'T...'],
  kedelai: ['.yY.', 'yYYy', 'yYYy', '.yy.'],
  semangka: ['DmDm', 'mDmD', 'DmDm', '.DD.'],
  sawit: ['.gg.', 'OOOo', 'OoOo', '.oo.'],
};

const PAL: Record<string, string> = {
  G: '#7cc95a', g: '#3f9a3f', D: '#2d6b2d', S: '#8b5a2b', s: '#6b4224',
  C: '#8fcf5a', c: '#4f8f3a', P: '#9b4fc4', p: '#6c2c8a', R: '#e04040', r: '#a82828', O: '#e8762e', o: '#a84a1a',
  Y: '#e2cf6a', y: '#a8963f', t: '#b8875a', T: '#efe2c4', m: '#7cc95a', W: '#ffffff', k: '#2b2b2b',
};

/** Letters that are fruit, tubers or flowers: removed for the "young plant" stage. */
const FRUIT = /[CcPpRrYytTmWk]/g;

const ART: Record<string, { mature: string[]; icon: string[] }> = {
  kangkung: {
    mature: [
      '................',
      '..G.........G...',
      '..gG.......Gg...',
      '...gG..G..Gg....',
      '...gG.GgG.Gg....',
      'G...gGGgGGg...G.',
      'gG...gGgGg...Gg.',
      '.gGG.gGgGg.GGg..',
      '..ggGGgGgGGgg...',
      '....ggGgGgg.....',
      '......gGg.......',
      '......gGg.......',
      '......gGg.......',
      '.....ggggg......',
    ],
    icon: [
      '................',
      '...G..G..G......',
      '...GG.G.GG..G...',
      '....GgGgG..GG...',
      '..G.GgGgGGgG....',
      '..GGgGgGgGg.....',
      '...ggGgGgg......',
      '.....gGg........',
      '.....RRR........',
      '.....gGg........',
      '.....gGg........',
      '....ggGgg.......',
      '....g.g.g.......',
    ],
  },
  timun: {
    mature: [
      '.......S........',
      '......gSg.......',
      '.....gGSGg......',
      '....gGgSgGg.....',
      '.....g.SCc......',
      '...CC..SCc......',
      '..cCC.gSCc......',
      '..cCC.gSGg.gg...',
      '..cCCgGSgGgGg...',
      '...cc.gSg.gg....',
      '.....gGSGg......',
      '......gSg.......',
      '.......S........',
      '.......S........',
      '......sSs.......',
    ],
    icon: [
      '................',
      '................',
      '.........cc.....',
      '........cCCc....',
      '.......cCWCc....',
      '......cCCCc.....',
      '.....cCCCc......',
      '....cCCCc.......',
      '...cCCCc........',
      '..cCCCc.........',
      '..cCCc..........',
      '...cc...........',
    ],
  },
  terong: {
    mature: [
      '................',
      '.....gGGg.......',
      '...gGGgGGGg.....',
      '..gGgGGgGgGg....',
      '..gGGgGGGgGg....',
      '...gg.gSg.gg....',
      '....P..S..P.....',
      '...PP..S.pP.....',
      '...PPp.S.PPp....',
      '...PWp.S.PWp....',
      '...PPp.S.PPp....',
      '....pp.S..pp....',
      '.......S........',
      '......sSs.......',
    ],
    icon: [
      '................',
      '.......gg.......',
      '......gGGg......',
      '......PgGP......',
      '.....PPPPPp.....',
      '.....PPPPPp.....',
      '....PWPPPPp.....',
      '....PPPPPPp.....',
      '....PPPPPPp.....',
      '....PPPPPPp.....',
      '.....PPPPp......',
      '......ppp.......',
    ],
  },
  cabai: {
    mature: [
      '................',
      '................',
      '......gGg.......',
      '....gGGgGGg.....',
      '...gGgGGgGgG....',
      '...gGGRgGRGg....',
      '....gRRgGRRg....',
      '....RR.gG.RR....',
      '...RR..S..RR....',
      '...R..RS.R.R....',
      '.....RR.S.RR....',
      '.....R..S..R....',
      '........S.......',
      '.......sSs......',
    ],
    icon: [
      '................',
      '....gg....gg....',
      '....gR....gR....',
      '....RR....RR....',
      '...RRR...RRR....',
      '...RWR...RWR....',
      '...RRR...RRR....',
      '...RRR...RRR....',
      '....RRr...RRr...',
      '....RRr...RRr...',
      '.....Rr....Rr...',
      '......r.....r...',
    ],
  },
  singkong: {
    mature: [
      '...g...g...g....',
      '....g..g..g.....',
      '.g...g.g.g...g..',
      '..gg..ggg..gg...',
      '....gggGggg.....',
      '..ggg..G..ggg...',
      '.g.....S.....g..',
      '.......S........',
      '.......S........',
      '.......S........',
      '.......S........',
      '.......S........',
      '....tt.S.tt.....',
      '...tTt.S.tTt....',
      '....tt.ss.tt....',
    ],
    icon: [
      '................',
      '................',
      '............tt..',
      '..........ttTt..',
      '........ttTtt...',
      '......ttTtt.....',
      '....ttTtt.......',
      '...tTtt.........',
      '..TTtt..........',
      '..TTt...........',
      '...T............',
    ],
  },
  kedelai: {
    mature: [
      '................',
      '................',
      '................',
      '................',
      '......gGg.......',
      '....gGgGgGg.....',
      '...gGYgGgYGg....',
      '..gGYYgGgYYGg...',
      '..gGgYGgGYgGg...',
      '...gYYgGgYYg....',
      '...gGYgGgYGg....',
      '....gggGggg.....',
      '......gSg.......',
      '......sSs.......',
    ],
    icon: [
      '................',
      '................',
      '.....yYY........',
      '....yYYYy.......',
      '....yYgYy..yY...',
      '.....yYYy.yYYy..',
      '......yy.yYgYy..',
      '...yYY...yYYy...',
      '..yYYYy...yy....',
      '..yYgYy.........',
      '...yYYy.........',
      '....yy..........',
    ],
  },
  semangka: {
    mature: [
      '................',
      '................',
      '................',
      '..gG..........g.',
      '.gGGg......gGGg.',
      '..gg.g....g.gg..',
      '......g..g......',
      '....DDDDDDDD....',
      '...DWDmDmDmDD...',
      '..DmDmDmDmDmDD..',
      '..mDmDmDmDmDmD..',
      '..DmDmDmDmDmDD..',
      '...DmDmDmDmDD...',
      '....DDDDDDDD....',
    ],
    icon: [
      '................',
      '................',
      '................',
      '................',
      '..DDDDDDDDDDDD..',
      '..mWWWWWWWWWWm..',
      '..RRRRRRRRRRRR..',
      '...RRkRRRRkRR...',
      '....RRRRkRRR....',
      '.....RkRRRR.....',
      '......RRRR......',
      '.......RR.......',
    ],
  },
};

type Ctx = CanvasRenderingContext2D;

/** Replace a texture with one drawn on a fresh 16x16 canvas (nearest filtering). */
function redraw(scene: Phaser.Scene, key: string, draw: (c: Ctx) => void, outline = true) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, 16, 16);
  if (!tex) return;
  const c = tex.getContext();
  c.imageSmoothingEnabled = false;
  draw(c);
  if (outline) outlinePixels(c);
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function outlinePixels(c: Ctx) {
  const img = c.getImageData(0, 0, 16, 16);
  const a = (x: number, y: number) => (x < 0 || y < 0 || x > 15 || y > 15 ? 0 : img.data[(y * 16 + x) * 4 + 3]);
  c.fillStyle = OUTLINE;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++)
      if (a(x, y) < 40 && (a(x - 1, y) > 120 || a(x + 1, y) > 120 || a(x, y - 1) > 120 || a(x, y + 1) > 120)) c.fillRect(x, y, 1, 1);
}

/** Bottom-align ASCII art in a 16x16 tile and paint it. */
function paint(c: Ctx, rows: string[]) {
  const top = 16 - rows.length - 1;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = PAL[row[x]];
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(x, top + y, 1, 1);
    }
  });
}

/** Swap in Kenney frames and our Kenney-style crops. Call after makeTextures(). */
export function applyKenney(scene: Phaser.Scene) {
  const src = scene.textures.get(SHEET).getSourceImage() as HTMLImageElement;
  const frame = (key: string, i: number) =>
    redraw(scene, key, (c) => c.drawImage(src, (i % COLS) * 16, Math.floor(i / COLS) * 16, 16, 16, 0, 0, 16, 16), false);

  for (const [id, f] of Object.entries(KENNEY_CROPS)) {
    f.stages.forEach((i, n) => frame(`crop-${id}-${n + 1}`, i));
    frame(`icon-${id}`, f.icon);
    frame(`seed-${id}`, f.bag);
  }
  for (const [id, rows] of Object.entries(EMBLEM)) {
    redraw(scene, `seed-${id}`, (c) => {
      c.drawImage(src, (BAG % COLS) * 16, Math.floor(BAG / COLS) * 16, 16, 16, 0, 0, 16, 16);
      c.fillStyle = LABEL;
      c.fillRect(6, 8, 4, 4); // blank the label, then paint this crop's emblem
      rows.forEach((row, y) => {
        for (let x = 0; x < 4; x++) {
          const col = PAL[row[x]];
          if (!col) continue;
          c.fillStyle = col;
          c.fillRect(6 + x, 8 + y, 1, 1);
        }
      });
    }, false);
  }

  for (const [id, art] of Object.entries(ART)) {
    const young = art.mature.map((r) => r.replace(FRUIT, '.')).slice(3); // leaves only, a little shorter
    redraw(scene, `crop-${id}-1`, (c) => c.drawImage(src, (40 % COLS) * 16, Math.floor(40 / COLS) * 16, 16, 16, 0, 0, 16, 16), false);
    redraw(scene, `crop-${id}-2`, (c) => paint(c, young));
    redraw(scene, `crop-${id}-3`, (c) => paint(c, art.mature));
    redraw(scene, `icon-${id}`, (c) => paint(c, art.icon));
  }

  // Kenney's chicken for the coop (a 1px bob for the walk frame)
  const hen = 122;
  frame('hen0', hen);
  redraw(scene, 'hen1', (c) => c.drawImage(src, (hen % COLS) * 16, Math.floor(hen / COLS) * 16, 16, 16, 0, -1, 16, 16), false);
  frame('icon-ayam', hen);
}

