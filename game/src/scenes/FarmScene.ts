import Phaser from 'phaser';
import {
  DAY_END_MIN,
  FIELD,
  GAME_MIN_PER_SEC,
  MAP_H,
  NPC_HOMES,
  RUN_MULT,
  isWet,
  fishStars,
  fishXp,
  needsPurchase,
  rollFish,
  NPC_LINES,
  npcById,
  zoneAt,
  MAP_W,
  STAMINA_COST,
  TILE,
  TOOLS,
  WATER_CAN_MAX,
  AFFECTION_MAX,
  FEATURE_LEVEL,
  FESTIVAL_CLOSE,
  FESTIVAL_OPEN,
  XP,
  XP_ANIMAL,
  cropById,
  itemName,
  produceById,
  qualityKey,
  stars,
} from '../data';
import {
  add,
  canAdd,
  checkStaminaRewards,
  countBase,
  harvestStars,
  roomFor,
  dayOfSeason,
  endDay,
  festivalTheme,
  gainXp,
  isFestivalDay,
  nextFestivalDay,
  plotKey,
  save,
  seasonOf,
  type GameState,
} from '../state';
import { play, toggleMute, unlockAudio } from '../sfx';
import { duck, setMood, startMusic, toggleMusic } from '../music';
import { UI_SCALE, VIEW } from '../ui/theme';

type Dir = 'down' | 'up' | 'left' | 'right';
const DIR_VEC: Record<Dir, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
const SPEED = 62; // world px per second

type Spot = 'door' | 'shop' | 'bin' | 'pond' | 'board' | 'coop' | 'stage' | 'house' | 'bed' | 'stove' | 'tv' | 'shelf' | 'wardrobe';

/** The farmhouse interior lives in empty world space east of the map (tiles), so all systems just work inside. */
const ROOM = { x: 100, y: 4, w: 14, h: 10 };
const inRoom = (tx: number, ty: number) => tx >= ROOM.x && tx < ROOM.x + ROOM.w && ty >= ROOM.y && ty < ROOM.y + ROOM.h;

export class FarmScene extends Phaser.Scene {
  private state!: GameState;
  private player!: Phaser.GameObjects.Image;
  private cursor!: Phaser.GameObjects.Image;
  private dir: Dir = 'down';
  private walkTime = 0;
  private blocked = new Set<string>();
  private spots = new Map<string, Spot>();
  private soilImgs = new Map<string, Phaser.GameObjects.Image>();
  private cropImgs = new Map<string, Phaser.GameObjects.Image>();
  private fertImgs = new Map<string, Phaser.GameObjects.Image>();
  private propImgs = new Map<string, Phaser.GameObjects.Image>();
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private moveTarget?: { x: number; y: number; act?: [number, number] };
  private busy = false;
  private waterImgs: Phaser.GameObjects.Image[] = [];
  private butterflies: Phaser.GameObjects.Image[] = [];
  private fireflies: Phaser.GameObjects.Image[] = [];
  private clouds: Phaser.GameObjects.Image[] = [];
  private lamps: Phaser.GameObjects.Image[] = [];
  private lantern!: Phaser.GameObjects.Image;
  private night!: Phaser.GameObjects.Rectangle;
  private playerShadow!: Phaser.GameObjects.Image;
  private flap = 0;
  private boardBubble!: Phaser.GameObjects.Image;
  private coopLock!: Phaser.GameObjects.Image;
  private bunting!: Phaser.GameObjects.Image;
  private coopLockText!: Phaser.GameObjects.Text;
  private hens = new Map<number, Phaser.GameObjects.Image>();
  private houseOwner = new Map<string, string>();
  private villagers = new Map<string, Phaser.GameObjects.Image>();
  private zone = '';
  private fishing?: {
    stage: 'wait' | 'bite';
    biteAt?: number;
    where: 'kolam' | 'danau';
    bobber: Phaser.GameObjects.Image;
    alert: Phaser.GameObjects.Image;
    timer: Phaser.Time.TimerEvent;
  };
  private yard = new Phaser.Geom.Rectangle(25 * TILE, 15 * TILE + 8, 3 * TILE + 8, 2 * TILE + 8);

  constructor() {
    super('farm');
  }

  create() {
    this.state = this.registry.get('state');
    this.buildMap();
    this.buildRoom();

    this.playerShadow = this.shadow(0, 0, 12);
    this.player = this.add.image(5.5 * TILE, 7 * TILE, 'player-down-0').setOrigin(0.5, 1);
    // pick up where the player left off (outside or in the house)
    const pos = this.state.pos;
    if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      this.player.setPosition(pos.x, pos.y);
      this.dir = pos.dir ?? 'down';
    }
    window.addEventListener('beforeunload', this.savePosition);
    const unhook = () => window.removeEventListener('beforeunload', this.savePosition);
    this.events.once('shutdown', unhook);
    this.events.once('destroy', unhook);
    this.setupAmbient();
    this.syncAnimals();
    this.spawnVillagers();
    this.game.events.on('animals-changed', this.syncAnimals, this);
    this.events.once('shutdown', () => this.game.events.off('animals-changed', this.syncAnimals, this));
    this.cursor = this.add.image(0, 0, 'cursor').setOrigin(0).setDepth(9000).setAlpha(0.85);
    this.tweens.add({ targets: this.cursor, alpha: 0.45, duration: 600, yoyo: true, repeat: -1 });

    const cam = this.cameras.main;
    cam.setZoom(2 * UI_SCALE);
    // the canvas follows the window's aspect ratio; keep the camera covering all of it
    const onResize = (size: Phaser.Structs.Size) => cam.setSize(size.width, size.height);
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
    cam.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    cam.startFollow(this.player, true, 0.15, 0.15);
    cam.setRoundPixels(true);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,E,Q,ONE,TWO,THREE,FOUR,FIVE,SHIFT') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    kb.on('keydown', (ev: KeyboardEvent) => this.onKey(ev));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
    this.game.events.on('touch-action', this.actionButton, this);
    this.game.events.on('select-tool', this.setTool, this);
    this.events.once('shutdown', () => {
      this.game.events.off('touch-action', this.actionButton, this);
      this.game.events.off('select-tool', this.setTool, this);
    });

    this.game.events.on('do-sleep', this.sleep, this);
    this.events.once('shutdown', () => this.game.events.off('do-sleep', this.sleep, this));

    for (const [k, p] of Object.entries(this.state.plots)) {
      if (p.sprinkler) this.blocked.add(k);
      this.refreshPlot(k);
    }
  }

  // ---------- map ----------

  private buildMap() {
    const r = new Phaser.Math.RandomDataGenerator(['cropfarm']);

    // ---- ground plan: g grass, p path, s stone, d sand, w water, k dock ----
    const G: string[][] = Array.from({ length: MAP_H }, () => Array<string>(MAP_W).fill('g'));
    const set = (x: number, y: number, t: string) => {
      if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) G[y][x] = t;
    };
    const rect = (x0: number, y0: number, x1: number, y1: number, t: string) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t);
    };

    // lake: two overlapping ellipses, ringed with sand
    for (let y = 22; y < MAP_H - 1; y++)
      for (let x = 2; x < 44; x++) {
        const a = ((x - 24) / 13) ** 2 + ((y - 31) / 5.2) ** 2;
        const b = ((x - 34) / 7) ** 2 + ((y - 33.5) / 3.6) ** 2;
        if (a < 1 || b < 1) set(x, y, 'w');
      }
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
    rect(40, 22, 54, 22, 'p');
    rect(42, 7, 52, 14, 's'); // village plaza
    for (let y = 26; y <= 29; y++) set(24, y, 'k'); // dock

    // forest clearing with flowers
    const clearing = { x: 54, y: 32, r: 3.2 };

    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        const t = G[y][x];
        const X = x * TILE, Y = y * TILE;
        if (t === 'w') {
          this.waterImgs.push(this.add.image(X, Y, 'water0').setOrigin(0).setDepth(-9));
          if (y > 0 && G[y - 1][x] !== 'w' && G[y - 1][x] !== 'k') this.add.image(X, Y, 'shore').setOrigin(0).setDepth(-8.8);
          this.block(x, y, 'pond');
          continue;
        }
        let key = 'grass0';
        if (t === 'p') key = 'path';
        else if (t === 's') key = 'stone';
        else if (t === 'd') key = 'sand';
        else if (t === 'k') key = 'plank';
        else {
          const inClearing = Math.hypot(x - clearing.x, y - clearing.y) < clearing.r;
          const n = r.frac();
          key = inClearing ? (n < 0.5 ? 'grass2' : 'grass3') : n < 0.06 ? 'grass2' : n < 0.12 ? 'grass3' : n < 0.38 ? 'grass1' : 'grass0';
        }
        this.add.image(X, Y, key).setOrigin(0).setDepth(-10);
      }

    // field area: slightly darker grass so players know where they can till
    this.add
      .rectangle(FIELD.x * TILE, FIELD.y * TILE, FIELD.w * TILE, FIELD.h * TILE, 0x3f7a2a, 0.2)
      .setOrigin(0)
      .setDepth(-9);

    // farm pond with a sandy rim and lily pads
    const pond = { x: 25, y: 11, w: 3, h: 4 };
    this.add
      .rectangle(pond.x * TILE - 2, pond.y * TILE - 2, pond.w * TILE + 4, pond.h * TILE + 4, 0xe6cf9a)
      .setOrigin(0)
      .setDepth(-9.5);
    for (let y = pond.y; y < pond.y + pond.h; y++)
      for (let x = pond.x; x < pond.x + pond.w; x++) {
        this.waterImgs.push(this.add.image(x * TILE, y * TILE, 'water0').setOrigin(0).setDepth(-9));
        this.block(x, y, 'pond');
      }
    this.add.rectangle(pond.x * TILE, pond.y * TILE, pond.w * TILE, 2, 0x2f7fb8).setOrigin(0).setDepth(-8.9);
    this.add.image(25.6 * TILE, 12.4 * TILE, 'lily').setDepth(-8.5);
    this.add.image(27.2 * TILE, 14.1 * TILE, 'lily').setDepth(-8.5).setFlipX(true);

    // lake dressing: lily pads, reeds on the sand
    for (const [x, y] of [[15, 29], [19, 33], [30, 28], [36, 33], [27, 34], [12, 31]]) {
      if (G[y][x] === 'w') this.add.image((x + 0.5) * TILE, (y + 0.5) * TILE, 'lily').setDepth(-8.5).setFlipX(x % 2 === 0);
    }
    for (let y = 22; y < MAP_H - 1; y++)
      for (let x = 2; x < 44; x++)
        if (G[y][x] === 'd' && (x * 7 + y * 13) % 5 === 0)
          this.add.image((x + 0.5) * TILE, (y + 1) * TILE, 'reeds').setOrigin(0.5, 1).setDepth((y + 1) * TILE - 2);

    // farmhouse (4x4 tiles), door on bottom row
    this.building('house', 3, 2);
    this.spots.set(plotKey(4, 5), 'door').set(plotKey(5, 5), 'door');
    this.windowGlow(3, 2);

    // villager houses
    for (const h of NPC_HOMES) {
      this.building(h.tex, h.x, h.y);
      this.spots.set(plotKey(h.x + 1, h.y + 3), 'house').set(plotKey(h.x + 2, h.y + 3), 'house');
      this.houseOwner.set(plotKey(h.x + 1, h.y + 3), h.npc).set(plotKey(h.x + 2, h.y + 3), h.npc);
      this.windowGlow(h.x, h.y);
    }

    // plaza: shop, board, stage, fountain, lamps, benches, flowers
    this.shadow(47 * TILE, 7 * TILE - 1, 36);
    this.add.image(46 * TILE, 5 * TILE, 'shop').setOrigin(0).setDepth(7 * TILE);
    for (let y = 5; y <= 6; y++) for (let x = 46; x <= 47; x++) this.block(x, y, 'shop');

    this.shadow(44 * TILE, 7 * TILE - 1, 22);
    this.add.image(44 * TILE, 7 * TILE, 'board').setOrigin(0.5, 1).setDepth(7 * TILE);
    this.block(43, 6, 'board');
    this.block(44, 6, 'board');
    this.boardBubble = this.add.image(44 * TILE, 7 * TILE - 34, 'bubble').setDepth(9200).setVisible(false);
    this.tweens.add({ targets: this.boardBubble, y: this.boardBubble.y - 3, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.shadow(50.5 * TILE, 7 * TILE - 1, 50);
    this.add.image(50.5 * TILE, 7 * TILE, 'stage').setOrigin(0.5, 1).setDepth(7 * TILE);
    for (let y = 5; y <= 6; y++) for (let x = 49; x <= 51; x++) this.block(x, y, 'stage');
    this.bunting = this.add.image(50.5 * TILE, 4 * TILE + 6, 'bunting').setDepth(7 * TILE + 1);

    this.add.image(47.5 * TILE, 13 * TILE, 'fountain').setOrigin(0.5, 1).setDepth(13 * TILE);
    for (let y = 11; y <= 12; y++) for (let x = 46; x <= 48; x++) this.block(x, y);

    for (const [x, y] of [[42, 8], [52, 8], [42, 14], [52, 14], [40, 22], [54, 22], [24, 24]]) {
      this.add.image((x + 0.5) * TILE, (y + 1) * TILE, 'lamp').setOrigin(0.5, 1).setDepth((y + 1) * TILE);
      this.block(x, y);
      this.lamps.push(this.add.image((x + 0.5) * TILE, y * TILE - 8, 'glow').setScale(0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(9600).setAlpha(0));
    }
    for (const [x, y] of [[44, 13], [49, 13]]) {
      this.add.image((x + 1) * TILE, (y + 1) * TILE, 'bench').setOrigin(0.5, 1).setDepth((y + 1) * TILE);
      this.block(x, y);
      this.block(x + 1, y);
    }
    for (const [x, y] of [[43, 9], [51, 9], [43, 10], [51, 10]]) this.deco('flowerbed', x, y, false);
    this.add.image(39 * TILE, 12 * TILE, 'well').setOrigin(0.5, 1).setDepth(12 * TILE);
    this.block(38, 11);
    this.block(39, 11);

    // chicken coop (locked until FEATURE_LEVEL.coop)
    this.shadow(25.5 * TILE, 10 * TILE - 1, 50);
    this.add.image(24 * TILE, 10 * TILE, 'coop').setOrigin(0, 1).setDepth(10 * TILE);
    for (let y = 8; y <= 9; y++) for (let x = 24; x <= 26; x++) this.block(x, y, 'coop');
    this.coopLock = this.add.image(27.5 * TILE, 10 * TILE, 'sign-lock').setOrigin(0.5, 1).setDepth(10 * TILE + 1);
    this.coopLockText = this.add
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
    this.shadow(8.5 * TILE, 7 * TILE - 1, 18);
    this.add.image(8 * TILE, 6 * TILE, 'bin').setOrigin(0).setDepth(7 * TILE);
    this.block(8, 6, 'bin');

    // fence below the field
    for (let x = FIELD.x - 1; x <= FIELD.x + FIELD.w; x++) {
      this.add.image(x * TILE, (FIELD.y + FIELD.h) * TILE, 'fence').setOrigin(0).setDepth((FIELD.y + FIELD.h + 1) * TILE);
      this.block(x, FIELD.y + FIELD.h);
    }

    // trees: world border, farm, village, and a forest in the south-east
    const free = (x: number, y: number) => G[y]?.[x] === 'g' && !this.blocked.has(plotKey(x, y));
    const tree = (x: number, y: number, fruit = false) => {
      if (!free(x, y)) return;
      this.shadow((x + 0.5) * TILE, (y + 1) * TILE - 2, 26);
      this.add.image((x + 0.5) * TILE, (y + 1) * TILE, fruit ? 'tree-fruit' : 'tree').setOrigin(0.5, 1).setDepth((y + 1) * TILE);
      this.block(x, y);
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
    for (let y = 24; y < MAP_H - 1; y++)
      for (let x = 45; x < MAP_W - 1; x++) {
        if (Math.hypot(x - clearing.x, y - clearing.y) < clearing.r + 1) continue;
        if ((x + y) % 2 === 0 && r.frac() < 0.62) tree(x, y, r.frac() < 0.1);
      }

    // small decorations
    for (const [x, y] of [[2, 8], [3, 11], [6, 13], [22, 5], [2, 5], [34, 6], [58, 7], [39, 19], [27, 20], [9, 21], [46, 24]]) this.deco('bush', x, y);
    for (const [x, y] of [[6, 10], [19, 2], [11, 25], [38, 27], [50, 27], [61, 10]]) this.deco('rock', x, y);
    for (const [x, y] of [[12, 5], [21, 18], [52, 34], [56, 30]]) this.deco('stump', x, y);
  }

  // ---------- farmhouse interior ----------

  private roomGlass!: Phaser.GameObjects.Graphics;
  private roomNight!: Phaser.GameObjects.Rectangle;
  private roomLamp!: Phaser.GameObjects.Image;
  private indoors = false;

  private buildRoom() {
    const X = (lx: number) => (ROOM.x + lx) * TILE;
    const Y = (ly: number) => (ROOM.y + ly) * TILE;
    const spot = (lx: number, ly: number, what: Spot | null) => {
      this.blocked.add(plotKey(ROOM.x + lx, ROOM.y + ly));
      if (what) this.spots.set(plotKey(ROOM.x + lx, ROOM.y + ly), what);
    };
    // floor, wallpapered back wall (two tiles tall), side walls
    for (let ly = 2; ly < ROOM.h; ly++) for (let lx = 0; lx < ROOM.w; lx++) this.add.image(X(lx), Y(ly), 'in-floor').setOrigin(0).setDepth(-10);
    for (let lx = 0; lx < ROOM.w; lx++) {
      this.add.image(X(lx), Y(0), 'in-wall').setOrigin(0).setDepth(-9);
      spot(lx, 0, null);
      spot(lx, 1, null);
    }
    for (let ly = 0; ly < ROOM.h; ly++) {
      this.add.image(X(0) - 4, Y(ly), 'in-wall-side').setOrigin(0).setDepth(Y(ROOM.h));
      this.add.image(X(ROOM.w), Y(ly), 'in-wall-side').setOrigin(0).setDepth(Y(ROOM.h));
    }
    this.add.rectangle(X(0) - 4, Y(ROOM.h), X(6) - X(0) + 4, 4, 0x5a3a22).setOrigin(0).setDepth(Y(ROOM.h)); // front wall, left of the door
    this.add.rectangle(X(8), Y(ROOM.h), X(ROOM.w) - X(8) + 4, 4, 0x5a3a22).setOrigin(0).setDepth(Y(ROOM.h)); // and right of it

    // windows with glass that follows the sky, a calendar between them
    this.roomGlass = this.add.graphics().setDepth(-8.6);
    for (const lx of [3.5, 9.5]) this.add.image(X(lx), Y(0) + 4, 'in-window').setOrigin(0.5, 0).setDepth(-8.5);
    this.add.image(X(6.5), Y(0) + 6, 'in-calendar').setOrigin(0.5, 0).setDepth(-8.5);

    // furniture along the back wall
    const put = (key: string, lx: number, lyBottom: number, origin = 0.5) =>
      this.add.image(X(lx), Y(lyBottom), key).setOrigin(origin, 1).setDepth(Y(lyBottom));
    put('in-bed', 1, 5);
    for (const [lx, ly] of [[0, 2], [1, 2], [0, 3], [1, 3], [0, 4], [1, 4]]) spot(lx, ly, 'bed');
    put('in-tv', 4, 4);
    for (const lx of [3, 4]) spot(lx, 2, 'tv'), spot(lx, 3, 'tv');
    put('in-shelf', 6, 4);
    for (const lx of [5, 6]) spot(lx, 2, 'shelf'), spot(lx, 3, 'shelf');
    put('in-stove', 9.5, 4);
    for (const lx of [8, 9, 10]) spot(lx, 2, 'stove'), spot(lx, 3, 'stove');
    put('in-wardrobe', 13, 5);
    for (const [lx, ly] of [[12, 2], [13, 2], [12, 3], [13, 3], [12, 4], [13, 4]]) spot(lx, ly, 'wardrobe');

    // dining corner on a rug, plants, doormat
    this.add.image(X(7), Y(7), 'in-rug').setOrigin(0.5, 0.5).setDepth(-9);
    put('in-table', 7, 7);
    spot(6, 6, null);
    spot(7, 6, null);
    put('in-chair', 5.5, 7);
    spot(5, 6, null);
    put('in-chair', 8.5, 7).setFlipX(true);
    spot(8, 6, null);
    for (const [lx, ly] of [[0, 9], [13, 9]]) {
      put('in-plant', lx + 0.5, ly + 1);
      spot(lx, ly, null);
    }
    this.add.image(X(7), Y(ROOM.h) - 1, 'in-mat').setOrigin(0.5, 1).setDepth(-8.5);

    // lighting: a hanging lamp over the table, and evening dimming
    this.roomLamp = this.add.image(X(7), Y(4) + 4, 'in-lamp').setOrigin(0.5, 0).setDepth(Y(ROOM.h) + 1);
    this.roomNight = this.add.rectangle(X(0) - 8, Y(0), X(ROOM.w) - X(0) + 16, Y(ROOM.h) - Y(0) + 8, 0x1b1530, 0).setOrigin(0).setDepth(9500);
    this.lamps.push(this.add.image(X(7), Y(5) + 2, 'glow').setScale(2.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(9600).setAlpha(0));
  }

  /** Step through the farmhouse door. */
  private enterHouse() {
    this.moveTo((ROOM.x + 7) * TILE, (ROOM.y + 9) * TILE - 2, 'up');
  }

  private leaveHouse() {
    this.moveTo(4.5 * TILE + 8, 7 * TILE - 2, 'down');
  }

  /** Fade, move the player, fade back. */
  private moveTo(x: number, y: number, dir: Dir) {
    if (this.busy) return;
    this.busy = true;
    this.moveTarget = undefined;
    const cam = this.cameras.main;
    cam.fadeOut(220, 10, 10, 20);
    cam.once('camerafadeoutcomplete', () => {
      this.player.setPosition(x, y);
      this.dir = dir;
      this.setPlayerFrame(0);
      this.updateIndoors();
      this.savePosition(); // entering or leaving the house
      cam.fadeIn(260, 10, 10, 20);
      this.busy = false;
    });
  }

  /** Inside, the camera frames the room; outside, it follows the player across the map. */
  private updateIndoors() {
    const tx = Math.floor(this.player.x / TILE);
    const ty = Math.floor((this.player.y - 4) / TILE);
    const inside = inRoom(tx, ty);
    if (inside === this.indoors) return;
    this.indoors = inside;
    const cam = this.cameras.main;
    if (inside) {
      cam.stopFollow();
      cam.removeBounds();
      cam.centerOn((ROOM.x + ROOM.w / 2) * TILE, (ROOM.y + ROOM.h / 2) * TILE + 6);
    } else {
      cam.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
      cam.startFollow(this.player, true, 0.15, 0.15);
    }
    this.registry.set('indoors', inside);
    this.game.events.emit('indoors', inside);
  }

  /** Window glass follows the sky; the room dims gently at night while the lamp glows. */
  private updateRoomLight(darkness: number) {
    const hr = this.state.minutes / 60;
    const sky = hr < 7 ? 0xf2b07a : hr < 17 ? 0x9fd8f5 : hr < 19.5 ? 0xf0905a : 0x1d2a4a;
    this.roomGlass.clear().fillStyle(sky, 1);
    for (const lx of [3.5, 9.5]) {
      const cx = (ROOM.x + lx) * TILE;
      this.roomGlass.fillRect(cx - 14, ROOM.y * TILE + 6, 28, 18); // matches the window's glass opening
    }
    this.roomNight.setFillStyle(0x1b1530, darkness * 0.28);
    this.roomLamp.setTint(darkness > 0.3 ? 0xffffff : 0xd8d0c0);
  }

  /** A 4x4-tile building with its top-left corner at tile (x, y). */
  private building(tex: string, x: number, y: number) {
    this.shadow((x + 2) * TILE, (y + 4) * TILE - 1, 70);
    this.add.image(x * TILE, y * TILE, tex).setOrigin(0).setDepth((y + 4) * TILE);
    for (let yy = y; yy <= y + 3; yy++) for (let xx = x; xx <= x + 3; xx++) this.block(xx, yy);
  }

  /** Warm window light for a 4x4 building, shown at night. */
  private windowGlow(x: number, y: number) {
    for (const wx of [15, 49]) {
      this.lamps.push(
        this.add.image(x * TILE + wx, y * TILE + 42, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(9600).setAlpha(0),
      );
    }
  }

  private deco(key: string, x: number, y: number, shadow = true) {
    if (this.blocked.has(plotKey(x, y))) return;
    if (shadow) this.shadow((x + 0.5) * TILE, (y + 1) * TILE - 2, 14);
    this.add.image((x + 0.5) * TILE, (y + 1) * TILE, key).setOrigin(0.5, 1).setDepth((y + 1) * TILE);
    this.block(x, y);
  }

  private shadow(x: number, y: number, w: number) {
    return this.add.image(x, y, 'shadow').setDisplaySize(w, w * 0.32).setAlpha(0.28).setDepth(-6);
  }

  // ---------- atmosphere ----------

  private setupAmbient() {
    // animated water
    let wf = 0;
    this.time.addEvent({
      delay: 450,
      loop: true,
      callback: () => {
        wf = (wf + 1) % 3;
        for (const w of this.waterImgs) w.setTexture(`water${wf}`);
      },
    });

    // chimney smoke
    this.time.addEvent({
      delay: 700,
      loop: true,
      callback: () => {
        const puff = this.add
          .image(3 * TILE + 47 + Phaser.Math.Between(-1, 1), 2 * TILE, 'dot')
          .setTint(0xdedede)
          .setAlpha(0.7)
          .setScale(0.6)
          .setDepth(9300);
        this.tweens.add({
          targets: puff,
          y: puff.y - 26,
          x: puff.x + Phaser.Math.Between(4, 12),
          scale: 1.8,
          alpha: 0,
          duration: 2600,
          onComplete: () => puff.destroy(),
        });
      },
    });

    // butterflies (day) and fireflies (night) wander around
    const wander = (obj: Phaser.GameObjects.Image, area: Phaser.Geom.Rectangle, speed: number) => {
      const go = () => {
        const tx = Phaser.Math.Between(area.left, area.right);
        const ty = Phaser.Math.Between(area.top, area.bottom);
        const d = Phaser.Math.Distance.Between(obj.x, obj.y, tx, ty);
        obj.setFlipX(tx < obj.x);
        this.tweens.add({ targets: obj, x: tx, y: ty, duration: (d / speed) * 1000, ease: 'Sine.InOut', onComplete: go });
      };
      go();
    };
    const meadow = new Phaser.Geom.Rectangle(2 * TILE, 8 * TILE, 40 * TILE, 15 * TILE);
    const tints = [0xffffff, 0xfff1a8, 0xbfe3ff];
    for (let i = 0; i < 4; i++) {
      const b = this.add
        .image(Phaser.Math.Between(meadow.left, meadow.right), Phaser.Math.Between(meadow.top, meadow.bottom), 'butterfly0')
        .setTint(tints[i % 3])
        .setDepth(9100);
      this.butterflies.push(b);
      wander(b, meadow, 18);
    }
    this.time.addEvent({
      delay: 140,
      loop: true,
      callback: () => {
        this.flap = 1 - this.flap;
        for (const b of this.butterflies) b.setTexture(`butterfly${this.flap}`);
      },
    });
    const lakeside = new Phaser.Geom.Rectangle(6 * TILE, 20 * TILE, 52 * TILE, 18 * TILE);
    for (let i = 0; i < 24; i++) {
      const f = this.add
        .image(Phaser.Math.Between(meadow.left, meadow.right), Phaser.Math.Between(meadow.top, meadow.bottom), 'firefly')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(9700)
        .setAlpha(0);
      this.fireflies.push(f);
      wander(f, i % 2 ? lakeside : meadow, 8);
      this.tweens.add({ targets: f, scale: 0.5, duration: Phaser.Math.Between(500, 1100), yoyo: true, repeat: -1 });
    }

    // drifting cloud shadows
    for (let i = 0; i < 7; i++) {
      const c = this.add
        .image(Phaser.Math.Between(-100, MAP_W * TILE), Phaser.Math.Between(20, MAP_H * TILE - 40), 'cloud')
        .setScale(2)
        .setAlpha(0.1)
        .setDepth(9400);
      this.clouds.push(c);
    }

    // lighting: night overlay in world space so lamps can glow on top of it
    this.night = this.add.rectangle(-200, -200, MAP_W * TILE + 400, MAP_H * TILE + 400, 0x0b0b35, 0).setOrigin(0).setDepth(9500);
    this.lantern = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(1.4).setDepth(9600).setAlpha(0);

    try {
      this.cameras.main.filters?.external.addVignette(0.5, 0.5, 0.9, 0.3);
    } catch {
      // filters need WebGL; canvas renderer simply skips the vignette
    }
  }

  /** 0 = full day, 1 = deep night. */
  private darkness() {
    const hr = this.state.minutes / 60;
    if (hr < 7) return 0.35 * (7 - hr);
    if (hr < 17) return 0;
    if (hr < 20) return (hr - 17) / 3;
    return 1;
  }

  private updateAmbient(dt: number) {
    const s = this.state;
    this.updateIndoors();
    this.updateRoomLight(this.darkness());
    // stepping onto the doormat leaves the house
    if (this.indoors && !this.busy) {
      const tx = Math.floor(this.player.x / TILE) - ROOM.x;
      const ty = Math.floor((this.player.y - 1) / TILE) - ROOM.y;
      if (ty >= ROOM.h - 1 && (tx === 6 || tx === 7) && this.dir === 'down') this.leaveHouse();
    }
    this.boardBubble.setVisible(
      s.level >= FEATURE_LEVEL.board && s.requests.some((r) => countBase(s, r.crop) >= r.qty),
    );
    this.coopLock.setVisible(s.level < FEATURE_LEVEL.coop);
    this.bunting.setVisible(isFestivalDay(s.day));
    this.coopLockText.setVisible(s.level < FEATURE_LEVEL.coop);
    const d = this.darkness();
    const hr = this.state.minutes / 60;
    const dusk = hr >= 17 && hr < 19.5;
    this.night.setFillStyle(dusk ? 0x40204f : 0x0b0b35, d * 0.5);
    for (const l of this.lamps) l.setAlpha(d * 0.85);
    this.lantern.setPosition(this.player.x, this.player.y - 6).setAlpha(d * 0.35);
    for (const f of this.fireflies) f.setAlpha(d > 0.6 ? (d - 0.6) * 2.2 : 0);
    for (const b of this.butterflies) b.setAlpha(s.weather === 'cerah' ? 1 - Math.min(1, d * 2) : 0);
    const hour = this.state.minutes / 60;
    setMood(seasonOf(s.day), hour >= 19 || hour < 6, isFestivalDay(s.day), isWet(s.weather));
    const home = this.state.minutes >= 20 * 60 || s.weather === 'badai';
    const sheltered = s.weather !== 'cerah'; // chickens stay in the coop
    for (const h of this.hens.values()) h.setVisible(!sheltered);
    for (const v of this.villagers.values()) v.setVisible(!home);
    const z = zoneAt(Math.floor(this.player.x / TILE), Math.floor((this.player.y - 4) / TILE));
    if (z && z !== this.zone) {
      if (this.zone) this.game.events.emit('area', z);
      this.zone = z;
    }
    for (const c of this.clouds) {
      c.x += 6 * dt;
      if (c.x > MAP_W * TILE + 140) c.x = -140;
    }
  }

  private block(x: number, y: number, spot?: Spot) {
    this.blocked.add(plotKey(x, y));
    if (spot) this.spots.set(plotKey(x, y), spot);
  }

  private isBlocked(wx: number, wy: number) {
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    const outside = tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H;
    if (outside && !inRoom(tx, ty)) return true;
    return this.blocked.has(plotKey(tx, ty));
  }

  private inField(x: number, y: number) {
    return x >= FIELD.x && x < FIELD.x + FIELD.w && y >= FIELD.y && y < FIELD.y + FIELD.h;
  }

  // ---------- input ----------

  private modal() {
    return this.registry.get('modal') === true;
  }

  private onKey(ev: KeyboardEvent) {
    unlockAudio();
    startMusic();
    const k = ev.key.toLowerCase();
    if (k === 'm') return this.toast(toggleMute() ? 'Semua suara dimatikan (M)' : 'Suara dinyalakan (M)');
    if (k === 'n') return this.toast(toggleMusic() ? 'Musik dinyalakan (N)' : 'Musik dimatikan (N)');
    if (this.modal()) return;
    if (this.fishing) {
      if (k === ' ' || k === 'e' || k === 'enter') this.reel();
      else if (k === 'escape' || 'wasd'.includes(k) || k.startsWith('arrow')) this.endFishing('Batal memancing.');
      return;
    }
    const toolIdx = ['1', '2', '3', '4', '5'].indexOf(k);
    if (toolIdx >= 0) this.setTool(toolIdx);
    else if (k === 'q') this.game.events.emit('cycle-seed');
    else if (k === ' ' || k === 'e' || k === 'enter') this.actionButton();
  }

  /** Space / E / the touch action button. */
  actionButton() {
    if (this.modal() || this.busy) return;
    if (this.fishing) return this.reel();
    const [tx, ty] = this.facingTile();
    this.act(tx, ty);
  }

  setTool(i: number) {
    const tool = TOOLS[i].id;
    if (needsPurchase(tool) && !this.state.ownedTools.includes(tool))
      return this.fail(`Kamu belum punya ${TOOLS[i].name}. Beli di toko (tab Peralatan).`);
    this.state.tool = tool;
    this.game.events.emit('hud');
  }

  private onTap(p: Phaser.Input.Pointer) {
    unlockAudio();
    startMusic();
    if (this.fishing) return this.reel();
    // pointer position in the 960x540 layout space the HUD is designed in
    const sx = p.x / UI_SCALE;
    const sy = p.y / UI_SCALE;
    if (this.registry.get('touch')) {
      // the joystick and action button live in the bottom corners
      const { w: W, h: H } = VIEW;
      if ((sx < 240 && sy > H - 240) || (sx > W - 220 && sy > H - 220)) return;
    }
    if (this.modal() || sy > VIEW.h - 80) return; // bottom bar belongs to the HUD
    const tx = Math.floor(p.worldX / TILE);
    const ty = Math.floor(p.worldY / TILE);
    const [px, py] = this.feet();
    const dist = Phaser.Math.Distance.Between(px, py - 4, (tx + 0.5) * TILE, (ty + 0.5) * TILE);
    if (dist < TILE * 1.6) {
      this.faceTowards((tx + 0.5) * TILE, (ty + 0.5) * TILE);
      this.act(tx, ty);
    } else {
      this.moveTarget = { x: (tx + 0.5) * TILE, y: (ty + 0.9) * TILE, act: [tx, ty] };
    }
  }

  private feet(): [number, number] {
    return [this.player.x, this.player.y - 2];
  }

  private facingTile(): [number, number] {
    // the tile the player stands on, plus one step in the facing direction
    const [fx, fy] = this.feet();
    const [dx, dy] = DIR_VEC[this.dir];
    return [Math.floor(fx / TILE) + dx, Math.floor((fy - 1) / TILE) + dy];
  }

  private faceTowards(x: number, y: number) {
    const [fx, fy] = this.feet();
    const dx = x - fx;
    const dy = y - (fy - 4);
    this.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    this.setPlayerFrame(0);
  }

  // ---------- loop ----------

  update(_t: number, delta: number) {
    this.updateAmbient(delta / 1000);
    this.playerShadow.setPosition(this.player.x, this.player.y - 1);
    if (this.modal() || this.busy) {
      this.setPlayerFrame(0);
      return;
    }
    const dt = delta / 1000;

    // clock
    this.state.minutes += dt * GAME_MIN_PER_SEC;
    if (this.state.minutes >= DAY_END_MIN) {
      this.game.events.emit('toast', 'Kamu pingsan karena kelelahan...');
      this.sleep(true);
      return;
    }

    // movement
    let vx = 0;
    let vy = 0;
    const K = this.keys;
    if (this.fishing) {
      this.setPlayerFrame(0);
      return;
    }
    let run = K.SHIFT.isDown;
    if (K.A.isDown || K.LEFT.isDown) vx -= 1;
    if (K.D.isDown || K.RIGHT.isDown) vx += 1;
    if (K.W.isDown || K.UP.isDown) vy -= 1;
    if (K.S.isDown || K.DOWN.isDown) vy += 1;

    const joy = this.registry.get('joy') as { x: number; y: number; mag: number } | undefined;
    if (!vx && !vy && joy && joy.mag > 0.2) {
      vx = joy.x;
      vy = joy.y;
      run = joy.mag > 0.92;
    }
    if (vx || vy) this.moveTarget = undefined;
    else if (this.moveTarget) {
      const [fx, fy] = this.feet();
      const dx = this.moveTarget.x - fx;
      const dy = this.moveTarget.y - fy;
      const [ax, ay] = this.moveTarget.act ?? [-99, -99];
      const near =
        this.moveTarget.act &&
        Phaser.Math.Distance.Between(fx, fy - 4, (ax + 0.5) * TILE, (ay + 0.5) * TILE) < TILE * 1.1;
      if (near || Math.hypot(dx, dy) < 2) {
        const act = this.moveTarget.act;
        this.moveTarget = undefined;
        if (act) {
          this.faceTowards((act[0] + 0.5) * TILE, (act[1] + 0.5) * TILE);
          this.act(act[0], act[1]);
        }
      } else {
        vx = Math.abs(dx) > 1 ? Math.sign(dx) : 0;
        vy = Math.abs(dy) > 1 ? Math.sign(dy) : 0;
      }
    }

    if (vx || vy) {
      const len = Math.hypot(vx, vy);
      const speed = SPEED * (run ? RUN_MULT : 1);
      const sx = (vx / len) * speed * dt;
      const sy = (vy / len) * speed * dt;
      const moved = this.tryMove(sx, 0) | this.tryMove(0, sy);
      if (!moved && this.moveTarget) this.moveTarget = undefined; // stuck: give up
      this.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : vy > 0 ? 'down' : 'up';
      this.walkTime += delta;
      this.setPlayerFrame(Math.floor(this.walkTime / (run ? 110 : 160)) % 2);
    } else {
      this.walkTime = 0;
      this.setPlayerFrame(0);
    }

    this.player.setDepth(this.player.y);
    // remember the position once the player stops moving (cheap: at most once per second)
    if (!vx && !vy && this.time.now - this.lastPosSave > 1000) {
      const p = this.state.pos;
      if (!p || p.x !== this.player.x || p.y !== this.player.y || p.dir !== this.dir) this.savePosition();
    }
    const [cx, cy] = this.facingTile();
    this.cursor.setPosition(cx * TILE, cy * TILE);
  }

  private tryMove(dx: number, dy: number): number {
    if (!dx && !dy) return 0;
    const nx = this.player.x + dx;
    const ny = this.player.y + dy;
    // feet hitbox: 10 x 5 px
    const pts: [number, number][] = [
      [nx - 5, ny - 5], [nx + 4, ny - 5], [nx - 5, ny - 1], [nx + 4, ny - 1],
    ];
    if (pts.some(([x, y]) => this.isBlocked(x, y))) return 0;
    this.player.setPosition(nx, ny);
    return 1;
  }

  private setPlayerFrame(f: number) {
    const d = this.dir === 'left' || this.dir === 'right' ? 'side' : this.dir;
    this.player.setTexture(`player-${d}-${f}`);
    this.player.setFlipX(this.dir === 'left');
  }

  // ---------- actions ----------

  private lastPosSave = 0;

  /** Store where the player stands; called on stop, on sleep, and when the page closes. */
  private savePosition = () => {
    if (!this.player || !this.sys.isActive()) return; // never write from a stopped game
    this.state.pos = { x: Math.round(this.player.x), y: Math.round(this.player.y), dir: this.dir };
    this.lastPosSave = this.time.now;
    save(this.state);
  };

  private toast(msg: string) {
    this.game.events.emit('toast', msg);
  }

  private fail(msg: string) {
    play('error');
    this.toast(msg);
  }

  private act(tx: number, ty: number) {
    const s = this.state;
    const k = plotKey(tx, ty);
    const spot = this.spots.get(k);
    if (spot === 'door') return this.enterHouse();
    if (spot === 'bed') return this.game.events.emit('ask-sleep');
    if (spot === 'stove') {
      if (s.level < FEATURE_LEVEL.kitchen) return this.fail(`Dapur terbuka di Level ${FEATURE_LEVEL.kitchen}.`);
      return this.game.events.emit('open-kitchen');
    }
    if (spot === 'tv') return this.game.events.emit('open-calendar');
    if (spot === 'shelf') return this.game.events.emit('open-fishbook');
    if (spot === 'wardrobe') return this.game.events.emit('open-wardrobe');
    if (spot === 'shop') return this.game.events.emit('open-shop');
    if (spot === 'bin') return this.ship();
    if (spot === 'board') {
      if (s.level < FEATURE_LEVEL.board) return this.fail(`Papan permintaan terbuka di Level ${FEATURE_LEVEL.board}.`);
      return this.game.events.emit('open-board');
    }
    if (spot === 'stage') return this.visitStage();
    if (spot === 'house') {
      const npc = npcById(this.houseOwner.get(k)!);
      return this.toast(`Rumah ${npc.name}, ${npc.role}.`);
    }
    if (spot === 'coop') {
      if (s.level < FEATURE_LEVEL.coop) return this.fail(`Kandang ayam terbuka di Level ${FEATURE_LEVEL.coop}.`);
      return this.tendCoop();
    }
    if (spot === 'pond') {
      if (s.tool === 'pancing') return this.startFishing(tx, ty);
      if (s.tool !== 'siram') return this.fail('Pakai Penyiram (2) untuk isi air, atau Pancing (5) untuk memancing.');
      s.water = WATER_CAN_MAX;
      play('water');
      this.splash(tx, ty, 0x8fd0f5);
      this.toast('Penyiram terisi penuh.');
      return this.changed();
    }
    const villager = this.villagerAt(tx, ty);
    if (villager) return this.talk(villager);
    const hen = this.henAt(tx, ty);
    if (hen) return this.pet(hen);
    if (!this.inField(tx, ty)) return;

    const plot = s.plots[k];
    if (s.stamina < STAMINA_COST[s.tool]) return this.fail('Terlalu lelah. Istirahat dulu di rumah.');

    switch (s.tool) {
      case 'cangkul': {
        if (plot?.sprinkler) return this.fail('Ambil sprinkler dengan Tangan (4).');
        if (plot?.crop?.dead) {
          delete plot.crop;
        } else if (plot?.crop) {
          return this.fail('Ada tanaman di sini.');
        } else if (plot?.tilled) {
          return;
        } else {
          s.plots[k] = { tilled: true, watered: false };
        }
        s.stamina -= STAMINA_COST.cangkul;
        this.swing();
        play('hoe');
        this.xp(XP.till, tx, ty);
        this.splash(tx, ty, 0xa8743f);
        break;
      }
      case 'siram': {
        if (!plot?.tilled) return;
        if (s.water <= 0) return this.fail('Air habis. Isi di kolam.');
        if (plot.watered) return;
        plot.watered = true;
        s.water--;
        s.stamina -= STAMINA_COST.siram;
        this.swing();
        play('water');
        this.xp(XP.water, tx, ty);
        this.splash(tx, ty, 0x6fb7e8);
        break;
      }
      case 'benih': {
        if (!s.seeds[s.seed]) return this.fail(`${itemName(s.seed)} habis. Beli di toko.`);
        if (s.seed === 'sprinkler') {
          if (plot?.crop || plot?.sprinkler) return this.fail('Petak ini sudah terisi.');
          const [fx, fy] = this.feet();
          if (Math.floor(fx / TILE) === tx && Math.floor((fy - 2) / TILE) === ty) return;
          s.plots[k] = { tilled: false, watered: false, sprinkler: true };
          this.blocked.add(k);
          this.toast('Sprinkler dipasang. Menyiram 8 petak di sekitarnya tiap pagi.');
          this.useBagItem('sprinkler');
          this.swing();
          play('place');
          break;
        }
        if (!plot?.tilled) return this.fail('Cangkul tanahnya dulu.');
        if (s.seed === 'pupuk') {
          if (plot.fertilized) return this.fail('Petak ini sudah diberi pupuk.');
          plot.fertilized = true;
          this.useBagItem('pupuk');
          this.splash(tx, ty, 0xd8f5a0);
          this.swing();
          play('plant');
          break;
        }
        if (plot.crop) return;
        const def = cropById(s.seed);
        if (!s.seeds[s.seed]) return this.fail(`Benih ${def.name} habis. Beli di toko.`);
        if (!def.seasons.includes(seasonOf(s.day)))
          return this.fail(`${def.name} tidak tumbuh di musim ${seasonOf(s.day)}.`);
        plot.crop = { id: s.seed, growth: 0 };
        this.useBagItem(s.seed);
        this.swing();
        play('plant');
        this.xp(XP.plant, tx, ty);
        break;
      }
      case 'tangan': {
        if (plot?.sprinkler) {
          if (!canAdd(s, 'seeds', 'sprinkler')) return this.fail('Tas penuh! Kosongkan slot dulu (tekan I).');
          delete s.plots[k];
          this.blocked.delete(k);
          add(s.seeds, 'sprinkler', 1);
          play('place');
          this.toast('Sprinkler diambil.');
          break;
        }
        const crop = plot?.crop;
        if (!crop || crop.dead) return;
        const def = cropById(crop.id);
        if (crop.growth < def.days) return this.fail(`${def.name} belum siap (${crop.growth}/${def.days} hari).`);
        const q = harvestStars(s, crop, !!plot.fertilized);
        const key = qualityKey(def.id, q);
        if (!canAdd(s, 'produce', key)) return this.fail('Tas penuh! Kirim atau jual hasil panen dulu.');
        if (def.regrow) {
          // perennial (sawit): the plant stays and fruits again after `regrow` watered days
          crop.growth = def.days - def.regrow;
          crop.missed = 0;
        } else {
          delete plot.crop;
          delete plot.fertilized;
        }
        add(s.produce, key, 1);
        s.stats.harvested++;
        this.flyIcon(tx, ty, `icon-${def.id}`);
        this.starBurst(tx, ty, q);
        if (q >= 3) this.toast(`${def.name} ${stars(q)}! Dijual ${produceById(key).sellPrice} G`);
        play(q >= 4 ? 'quest' : 'harvest');
        this.xp(XP.harvestPerDay * def.days, tx, ty);
        break;
      }
    }
    this.refreshPlot(k, true);
    this.changed();
  }

  /** Consume one bag item; when it runs out, select the next item the player still owns. */
  private useBagItem(id: string) {
    const s = this.state;
    add(s.seeds, id, -1);
    if (!s.seeds[id]) {
      const next = Object.keys(s.seeds)[0];
      if (next) {
        s.seed = next;
        this.toast(`${itemName(id)} habis. Beralih ke ${itemName(next)}.`);
      }
    }
  }

  private ship() {
    const s = this.state;
    const n = Object.values(s.produce).reduce((a, b) => a + b, 0);
    if (!n) return this.fail('Tidak ada hasil panen untuk dikirim.');
    for (const [id, q] of Object.entries(s.produce)) add(s.shipping, id, q);
    s.produce = {};
    play('place');
    this.toast(`${n} hasil panen masuk kotak kirim. Dibayar besok pagi.`);
    this.changed();
  }

  private visitStage() {
    const s = this.state;
    if (!isFestivalDay(s.day)) {
      const d = nextFestivalDay(s.day);
      const theme = festivalTheme(d);
      return this.toast(
        `Festival berikutnya: ${seasonOf(d)} ${dayOfSeason(d)} (${d - s.day} hari lagi) · tema ${theme.name} ×2.`,
      );
    }
    if (s.festival.enteredDay === s.day) return this.toast('Kamu sudah ikut lomba hari ini. Sampai minggu depan!');
    if (s.minutes < FESTIVAL_OPEN) return this.toast('Festival dibuka pukul 09:00.');
    if (s.minutes >= FESTIVAL_CLOSE) return this.fail('Festival sudah tutup (18:00).');
    this.game.events.emit('open-festival');
  }

  // ---------- fishing ----------

  private startFishing(tx: number, ty: number) {
    const s = this.state;
    if (s.stamina < STAMINA_COST.pancing) return this.fail('Terlalu lelah untuk memancing.');
    s.stamina -= STAMINA_COST.pancing;
    const where = tx >= 25 && tx <= 27 && ty >= 11 && ty <= 14 ? 'kolam' : 'danau';
    const bobber = this.add.image((tx + 0.5) * TILE, (ty + 0.5) * TILE, 'bobber').setDepth(9001);
    this.tweens.add({ targets: bobber, y: bobber.y + 1, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const alert = this.add.image(this.player.x, this.player.y - 22, 'bubble').setDepth(9200).setVisible(false);
    this.swing();
    play('water');
    this.splash(tx, ty, 0x8fd0f5);
    this.toast('Menunggu ikan menggigit...');
    const timer = this.time.delayedCall(Phaser.Math.Between(1500, 4500), () => this.bite());
    this.fishing = { stage: 'wait', where, bobber, alert, timer };
    this.changed();
  }

  private bite() {
    const f = this.fishing;
    if (!f) return;
    f.stage = 'bite';
    f.biteAt = this.time.now;
    f.alert.setVisible(true);
    this.tweens.add({ targets: f.bobber, y: f.bobber.y + 3, duration: 90, yoyo: true, repeat: 3 });
    play('click');
    // a short window to react
    f.timer = this.time.delayedCall(850, () => this.endFishing('Ikannya lepas... Coba lagi.', true));
  }

  private reel() {
    const f = this.fishing;
    if (!f) return;
    if (f.stage === 'wait') return this.endFishing('Terlalu cepat! Ikannya kabur.', true);
    const s = this.state;
    const id = rollFish(f.where, seasonOf(s.day), s.minutes / 60, isWet(s.weather));
    // quicker reaction to the bite = better quality
    const q = fishStars(this.time.now - (f.biteAt ?? this.time.now), s.level);
    const key = qualityKey(id, q);
    const fish = produceById(key);
    if (!canAdd(s, 'produce', key)) return this.endFishing(`Tas penuh! ${fish.name} dilepas lagi.`, true);
    add(s.produce, key, 1);
    const first = !s.fishCaught[id];
    s.fishCaught[id] = Math.max(s.fishCaught[id] ?? 0, q);
    const fishReward = checkStaminaRewards(s)[0]; // completing the Fish Book
    const [tx, ty] = [Math.floor(f.bobber.x / TILE), Math.floor(f.bobber.y / TILE)];
    this.flyIcon(tx, ty, `icon-${id}`);
    this.starBurst(tx, ty, q);
    play(q >= 4 || first ? 'quest' : 'harvest');
    this.xp(fishXp(id), tx, ty);
    this.endFishing(fishReward ?? `${first ? 'Ikan baru! ' : ''}Dapat ${fish.name} (${fish.sellPrice} G)`);
  }

  private endFishing(msg: string, failed = false) {
    const f = this.fishing;
    if (!f) return;
    f.timer.remove();
    f.bobber.destroy();
    f.alert.destroy();
    this.fishing = undefined;
    if (failed) this.fail(msg);
    else this.toast(msg);
    this.changed();
  }

  // ---------- villagers ----------

  private spawnVillagers() {
    for (const h of NPC_HOMES) {
      // they potter about on the path in front of their door
      const area = new Phaser.Geom.Rectangle((h.x + 0.6) * TILE, (h.y + 4.85) * TILE, 2.8 * TILE, 0.3 * TILE);
      const img = this.add.image(area.centerX, area.bottom, `npc-${h.npc}-0`).setOrigin(0.5, 1);
      this.villagers.set(h.npc, img);
      const step = () => {
        const tx = Phaser.Math.Between(area.left, area.right);
        const ty = Phaser.Math.Between(area.top, area.bottom);
        img.setFlipX(tx < img.x);
        this.tweens.add({
          targets: img,
          x: tx,
          y: ty,
          duration: (Math.abs(tx - img.x) / 14) * 1000 + 200,
          delay: Phaser.Math.Between(1500, 5000),
          onUpdate: () => img.setTexture(`npc-${h.npc}-${Math.floor(this.time.now / 200) % 2}`).setDepth(img.y),
          onComplete: () => {
            img.setTexture(`npc-${h.npc}-0`);
            step();
          },
        });
      };
      img.setDepth(img.y);
      step();
    }
  }

  private villagerAt(tx: number, ty: number) {
    const cx = (tx + 0.5) * TILE;
    const cy = (ty + 0.5) * TILE;
    for (const [id, img] of this.villagers)
      if (img.visible && Phaser.Math.Distance.Between(img.x, img.y - 8, cx, cy) < 14) return id;
    return undefined;
  }

  private talk(id: string) {
    const s = this.state;
    const npc = npcById(id);
    const img = this.villagers.get(id)!;
    const lines = NPC_LINES[id];
    const line = lines[(s.day + (s.friendship[id] ?? 0)) % lines.length];
    play('click');
    this.toast(`${npc.name}: "${line}"`);
    if (s.talkedDay[id] !== s.day) {
      s.talkedDay[id] = s.day;
      s.friendship[id] = (s.friendship[id] ?? 0) + 1;
      for (const msg of checkStaminaRewards(s)) this.time.delayedCall(1500, () => (play('quest'), this.toast(msg))); // Jamu Kuat
      const h = this.add.image(img.x, img.y - 18, 'heart').setDepth(9003);
      this.tweens.add({ targets: h, y: h.y - 10, alpha: 0, duration: 900, onComplete: () => h.destroy() });
      this.xp(2, Math.floor(img.x / TILE), Math.floor((img.y - 8) / TILE));
      this.changed();
    }
  }

  // ---------- livestock ----------

  private syncAnimals() {
    const alive = new Set(this.state.animals.map((a) => a.id));
    for (const [id, img] of this.hens) if (!alive.has(id)) (img.destroy(), this.hens.delete(id));
    for (const a of this.state.animals) {
      if (this.hens.has(a.id)) continue;
      const img = this.add
        .image(Phaser.Math.Between(this.yard.left, this.yard.right), Phaser.Math.Between(this.yard.top, this.yard.bottom), 'hen0')
        .setOrigin(0.5, 1);
      this.hens.set(a.id, img);
      const step = () => {
        if (!img.active) return;
        const tx = Phaser.Math.Between(this.yard.left, this.yard.right);
        const ty = Phaser.Math.Between(this.yard.top, this.yard.bottom);
        img.setFlipX(tx < img.x);
        const d = Phaser.Math.Distance.Between(img.x, img.y, tx, ty);
        this.tweens.add({
          targets: img,
          x: tx,
          y: ty,
          duration: (d / 12) * 1000,
          delay: Phaser.Math.Between(400, 2600), // pecking pause between walks
          onUpdate: () => img.setTexture(`hen${Math.floor(this.time.now / 180) % 2}`).setDepth(img.y),
          onComplete: () => {
            img.setTexture('hen0');
            step();
          },
        });
      };
      step();
    }
  }

  /** The chicken closest to the centre of a tile, if one stands there. */
  private henAt(tx: number, ty: number) {
    const cx = (tx + 0.5) * TILE;
    const cy = (ty + 0.5) * TILE;
    for (const a of this.state.animals) {
      const img = this.hens.get(a.id);
      if (img?.visible && Phaser.Math.Distance.Between(img.x, img.y - 6, cx, cy) < 13) return a;
    }
    return undefined;
  }

  private pet(a: GameState['animals'][number]) {
    const img = this.hens.get(a.id)!;
    play('cluck');
    if (a.petted) return this.toast(`${a.name} sudah dielus hari ini (♥ ${a.affection}/${AFFECTION_MAX}).`);
    a.petted = true;
    a.affection = Math.min(AFFECTION_MAX, a.affection + 1);
    const h = this.add.image(img.x, img.y - 16, 'heart').setDepth(9003);
    this.tweens.add({ targets: h, y: h.y - 10, alpha: 0, duration: 900, onComplete: () => h.destroy() });
    this.toast(`${a.name} senang dielus! ♥ ${a.affection}/${AFFECTION_MAX}`);
    this.xp(XP_ANIMAL.pet, Math.floor(img.x / TILE), Math.floor((img.y - 8) / TILE));
    this.changed();
  }

  private tendCoop() {
    const s = this.state;
    if (!s.animals.length) return this.toast('Kandang masih kosong. Beli ayam di toko (tab Ternak).');
    const msgs: string[] = [];
    let eggs = 0;
    let golden = 0;
    for (const [id, q] of Object.entries(s.coopEggs)) {
      const n = Math.min(q, roomFor(s, 'produce', id)); // leave the rest in the coop if the bag is full
      if (!n) continue;
      add(s.produce, id, n);
      add(s.coopEggs, id, -n);
      eggs += n;
      if (id === 'telur-emas') golden += n;
    }
    if (Object.keys(s.coopEggs).length) msgs.push('tas penuh, sisa telur tetap di kandang');
    if (eggs) {
      msgs.push(`Ambil ${eggs} telur${golden ? ` (${golden} emas!)` : ''}`);
      this.flyIcon(25, 8, golden ? 'icon-telur-emas' : 'icon-telur');
      play('harvest');
      this.xp(XP_ANIMAL.egg * eggs, 25, 8);
    }
    const hungry = s.animals.filter((a) => !a.fed);
    const n = Math.min(s.feed, hungry.length);
    hungry.slice(0, n).forEach((a) => (a.fed = true));
    s.feed -= n;
    if (n) {
      msgs.push(`beri pakan ${n} ayam`);
      play('cluck');
      this.xp(XP_ANIMAL.feed * n, 25, 8);
    }
    if (hungry.length > n) msgs.push(`${hungry.length - n} ayam belum makan, pakan habis`);
    if (!msgs.length) msgs.push('Semua ayam sudah makan. Telur muncul besok pagi');
    const text = msgs.join(' · ');
    this.toast(text.charAt(0).toUpperCase() + text.slice(1) + '.');
    this.changed();
  }

  /** Award XP with a small floating number; announces level-ups. */
  private xp(n: number, tx: number, ty: number) {
    const reached = gainXp(this.state, n);
    const t = this.add
      .text((tx + 0.5) * TILE, ty * TILE, `+${n} XP`, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#fff3a8',
        stroke: '#2a1d17',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 1)
      .setDepth(9003)
      .setResolution(4);
    this.tweens.add({ targets: t, y: t.y - 12, alpha: 0, duration: 900, ease: 'Quad.Out', onComplete: () => t.destroy() });
    if (reached.length) this.game.events.emit('level-up', reached);
  }

  private changed() {
    this.game.events.emit('hud');
    save(this.state);
  }

  sleep(passedOut = false) {
    if (this.busy) return;
    if (this.fishing) {
      this.fishing.timer.remove();
      this.fishing.bobber.destroy();
      this.fishing.alert.destroy();
      this.fishing = undefined;
    }
    this.busy = true;
    this.moveTarget = undefined;
    const cam = this.cameras.main;
    play('sleep');
    duck(2200);
    cam.fadeOut(500, 10, 10, 30);
    cam.once('camerafadeoutcomplete', () => {
      const report = endDay(this.state, passedOut === true);
      this.player.setPosition((ROOM.x + 2.5) * TILE, (ROOM.y + 4) * TILE - 2); // wake up beside the bed
      this.dir = 'down';
      this.state.pos = { x: Math.round(this.player.x), y: Math.round(this.player.y), dir: 'down' };
      // refresh drawn plots (some may have reverted to grass) and all current ones
      for (const k of new Set([...this.soilImgs.keys(), ...this.propImgs.keys(), ...Object.keys(this.state.plots)]))
        this.refreshPlot(k);
      save(this.state);
      this.game.events.emit('day-report', report);
      cam.fadeIn(500, 10, 10, 30);
      this.busy = false;
      this.time.delayedCall(600, () => this.spraySprinklers());
    });
  }

  private refreshPlot(k: string, pop = false) {
    const p = this.state.plots[k];
    const [x, y] = k.split(',').map(Number);
    let soil = this.soilImgs.get(k);
    let crop = this.cropImgs.get(k);
    const fert = this.fertImgs.get(k);
    const prop = this.propImgs.get(k);

    if (p?.sprinkler && !prop) {
      const img = this.add.image((x + 0.5) * TILE, (y + 1) * TILE, 'icon-sprinkler').setOrigin(0.5, 1).setDepth((y + 1) * TILE);
      this.propImgs.set(k, img);
      if (pop) {
        img.setScale(0.6);
        this.tweens.add({ targets: img, scale: 1, duration: 220, ease: 'Back.Out' });
      }
    } else if (!p?.sprinkler && prop) {
      prop.destroy();
      this.propImgs.delete(k);
    }

    if (p?.fertilized && !fert) {
      this.fertImgs.set(k, this.add.image(x * TILE, y * TILE, 'soil-fert').setOrigin(0).setDepth(-4.9));
    } else if (!p?.fertilized && fert) {
      fert.destroy();
      this.fertImgs.delete(k);
    }

    if (!p?.tilled) {
      soil?.destroy();
      crop?.destroy();
      this.soilImgs.delete(k);
      this.cropImgs.delete(k);
      return;
    }
    if (!soil) {
      soil = this.add.image(x * TILE, y * TILE, 'soil').setOrigin(0).setDepth(-5);
      this.soilImgs.set(k, soil);
    }
    soil.setTexture(p.watered ? 'soil-wet' : 'soil');

    if (!p.crop) {
      crop?.destroy();
      this.cropImgs.delete(k);
      return;
    }
    const def = cropById(p.crop.id);
    const g = p.crop.growth;
    const stage = g >= def.days ? 3 : g === 0 ? 0 : g / def.days < 0.5 ? 1 : 2;
    const tex = p.crop.dead ? 'crop-dead' : `crop-${def.id}-${stage}`;
    if (!crop) {
      crop = this.add.image((x + 0.5) * TILE, (y + 1) * TILE, tex).setOrigin(0.5, 1).setDepth((y + 1) * TILE - 1);
      this.cropImgs.set(k, crop);
    } else crop.setTexture(tex);
    if (pop) {
      crop.setScale(0.6);
      this.tweens.add({ targets: crop, scale: 1, duration: 220, ease: 'Back.Out' });
    }
  }

  // ---------- juice ----------

  private spraySprinklers() {
    for (const [k, p] of Object.entries(this.state.plots)) {
      if (!p.sprinkler) continue;
      const [x, y] = k.split(',').map(Number);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) this.splash(x + dx, y + dy, 0x8fd0f5);
    }
  }

  private swing() {
    this.tweens.add({ targets: this.player, y: this.player.y - 2, duration: 70, yoyo: true });
  }

  private splash(tx: number, ty: number, color: number) {
    for (let i = 0; i < 6; i++) {
      const d = this.add.rectangle((tx + 0.5) * TILE, (ty + 0.6) * TILE, 2, 2, color).setDepth(9001);
      this.tweens.add({
        targets: d,
        x: d.x + Phaser.Math.Between(-7, 7),
        y: d.y - Phaser.Math.Between(3, 9),
        alpha: 0,
        duration: 350,
        onComplete: () => d.destroy(),
      });
    }
  }

  /** Little gold stars popping out of a quality harvest. */
  private starBurst(tx: number, ty: number, q: number) {
    for (let i = 0; i < q; i++) {
      const t = this.add
        .text((tx + 0.5) * TILE, ty * TILE + 4, '★', { fontFamily: 'monospace', fontSize: '9px', color: '#f2c94c', stroke: '#5a3a22', strokeThickness: 2 })
        .setOrigin(0.5)
        .setResolution(4)
        .setDepth(9004);
      const a = -Math.PI / 2 + (i - (q - 1) / 2) * 0.45;
      this.tweens.add({
        targets: t,
        x: t.x + Math.cos(a) * 14,
        y: t.y + Math.sin(a) * 14,
        alpha: 0,
        duration: 800,
        ease: 'Quad.Out',
        onComplete: () => t.destroy(),
      });
    }
  }

  private flyIcon(tx: number, ty: number, key: string) {
    const icon = this.add.image((tx + 0.5) * TILE, ty * TILE, key).setDepth(9002);
    this.tweens.add({ targets: icon, y: icon.y - 14, alpha: 0, duration: 700, ease: 'Quad.Out', onComplete: () => icon.destroy() });
  }
}
