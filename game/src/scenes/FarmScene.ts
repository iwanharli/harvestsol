import Phaser from 'phaser';
import {
  isNight,
  WEEKDAYS,
  LATE_WARNINGS,
  NIGHT_DRAIN,
  LOW_STAMINA,
  FIELD,
  GAME_MIN_PER_SEC,
  MAP_H,
  BENGKEL_HOURS,
  CAVE_ROOM,
  CAVE_TREASURE,
  LAKES,
  type Water,
  FISH,
  MARKET_CLOSE,
  MARKET_OPEN,
  MARKET_OWNER,
  SOFA_STAMINA,
  NPC_HOMES,
  TROPHY_BONUS,
  TROPHY_BONUS_MAX,
  WEATHER_INFO,
  furnitureById,
  RUN_MULT,
  isWet,
  needsPurchase,
  NPC_LINES,
  npcById,
  zoneAt,
  MAP_W,
  STAMINA_COST,
  TILE,
  TOOLS,
  AREA_BY_TIER,
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
  restOnSofa,
  checkStaminaRewards,
  requestReady,
  harvestStars,
  roomFor,
  dayOfSeason,
  rollover,
  rest,
  type RestKind,
  type DayReport,
  festivalTheme,
  gainXp,
  isFestivalDay,
  nextFestivalDay,
  plotKey,
  save,
  mineHit,
  tierOf,
  waterMax,
  atForge,
  openCaveTreasure,
  liftFloors,
  seasonOf,
  type GameState,
} from '../state';
import { play, toggleMute, unlockAudio } from '../sfx';
import { duck, setMood, startMusic, toggleMusic } from '../music';
import { UI_SCALE, VIEW } from '../ui/theme';
import { type Dir, DIR_VEC, SPEED, type Spot, ROOM, HOUSE_ROOMS, SHOP, roomAt, inRoom } from './farm/common';
import * as map from './farm/map';
import * as interiors from './farm/interiors';
import * as cave from './farm/cave';
import * as fishing from './farm/fishing';

export class FarmScene extends Phaser.Scene {
  state!: GameState;
  player!: Phaser.GameObjects.Image;
  cursor!: Phaser.GameObjects.Image;
  dir: Dir = 'down';
  walkTime = 0;
  blocked = new Set<string>();
  spots = new Map<string, Spot>();
  soilImgs = new Map<string, Phaser.GameObjects.Image>();
  cropImgs = new Map<string, Phaser.GameObjects.Image>();
  fertImgs = new Map<string, Phaser.GameObjects.Image>();
  propImgs = new Map<string, Phaser.GameObjects.Image>();
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  moveTarget?: { x: number; y: number; act?: [number, number] };
  busy = false;
  waterImgs: Phaser.GameObjects.Image[] = [];
  butterflies: Phaser.GameObjects.Image[] = [];
  fireflies: Phaser.GameObjects.Image[] = [];
  clouds: Phaser.GameObjects.Image[] = [];
  lamps: Phaser.GameObjects.Image[] = [];
  lantern!: Phaser.GameObjects.Image;
  night!: Phaser.GameObjects.Rectangle;
  playerShadow!: Phaser.GameObjects.Image;
  flap = 0;
  boardBubble!: Phaser.GameObjects.Image;
  coopLock!: Phaser.GameObjects.Image;
  bunting!: Phaser.GameObjects.Image;
  coopLockText!: Phaser.GameObjects.Text;
  hens = new Map<number, Phaser.GameObjects.Image>();
  houseOwner = new Map<string, string>();
  villagers = new Map<string, Phaser.GameObjects.Image>();
  zone = '';
  fishing?: {
    stage: 'wait' | 'bite';
    biteAt?: number;
    where: Water;
    bobber: Phaser.GameObjects.Image;
    alert: Phaser.GameObjects.Image;
    timer: Phaser.Time.TimerEvent;
  };
  yard = new Phaser.Geom.Rectangle(25 * TILE, 15 * TILE + 8, 3 * TILE + 8, 2 * TILE + 8);

  constructor() {
    super('farm');
  }

  create() {
    this.state = this.registry.get('state');
    this.buildMap();
    this.buildCave();
    this.refreshCave();
    HOUSE_ROOMS.forEach((R, tier) => this.buildRoom(R, tier));
    this.buildShop();
    this.refreshFurniture();
    this.game.events.on('furniture-changed', this.refreshFurniture, this);
    this.events.once('shutdown', () => this.game.events.off('furniture-changed', this.refreshFurniture, this));

    this.playerShadow = this.shadow(0, 0, 12);
    this.player = this.add.image(5.5 * TILE, 7 * TILE, 'player-down-0').setOrigin(0.5, 1);
    // pick up where the player left off (outside or in the house)
    const pos = this.state.pos;
    if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      this.player.setPosition(pos.x, pos.y);
      this.dir = pos.dir ?? 'down';
      const here = roomAt(Math.floor(pos.x / TILE), Math.floor((pos.y - 4) / TILE));
      const home = HOUSE_ROOMS[this.state.houseTier] ?? ROOM;
      if (here && HOUSE_ROOMS.includes(here.room) && here.room !== home)
        this.player.setPosition((home.x + 2.5) * TILE, (home.y + 4) * TILE - 2);
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
    const onResize = (size: Phaser.Structs.Size) => {
      cam.setSize(size.width, size.height);
      if (this.currentRoom) this.frameRoom(this.currentRoom);
    };
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
    cam.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    cam.startFollow(this.player, true, 0.15, 0.15);
    cam.setRoundPixels(true);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,E,Q,ONE,TWO,THREE,FOUR,FIVE,SIX,SHIFT') as Record<
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

    for (const k of Object.keys(this.state.plots)) {
      this.refreshPlot(k);
    }
  }

  // ---------- map ----------

  buildMap() {
    return map.buildMap(this);
  }

  /** The rocks (and, once found, the ladder down) on the current cave floor. */
  mineImgs = new Map<string, Phaser.GameObjects.Image>();
  caveFloorImgs: Phaser.GameObjects.Image[] = [];
  caveLabel?: Phaser.GameObjects.Text;
  caveDark?: Phaser.GameObjects.Rectangle;
  refreshCave() {
    return cave.refreshCave(this);
  }

  /** The cave interior: rock walls, a floor that changes colour with depth, the ladder up at the bottom. */
  buildCave() {
    return cave.buildCave(this);
  }

  /** Go into the cave at a floor (fresh rocks every time), or one floor deeper. */
  enterCave(floor: number) {
    return cave.enterCave(this, floor);
  }

  /** A small picture of the whole world (MAP_PX per tile) for the map window. */
  paintMinimap(G: string[][]) {
    return map.paintMinimap(this, G);
  }

  // ---------- farmhouse interior ----------

  /** Per house interior: window glass, evening dimming and the lamp over the table. */
  roomViews: { R: typeof ROOM; glass: Phaser.GameObjects.Graphics; windows: number[]; night: Phaser.GameObjects.Rectangle; lamp: Phaser.GameObjects.Image }[] = [];
  indoors = false;
  currentRoom?: { x: number; y: number; w: number; h: number };

  buildRoom(R: typeof ROOM, tier: number) {
    return interiors.buildRoom(this, R, tier);
  }

  bedImgs: { img: Phaser.GameObjects.Image; x: number }[] = [];
  furnitureObjs = new Map<string, { img: Phaser.GameObjects.Image; ph: Phaser.GameObjects.Graphics; spot: Spot | null }[]>();
  /** World tile → furniture id, for furniture slots in the house and display stands in the shop. */
  furnitureTiles = new Map<string, string>();
  /** Which lake each water tile belongs to, and the signposts naming them. */
  waterAt = new Map<string, Water>();
  lakeSigns = new Map<string, Water>();
  treeTiles = new Set<string>();
  /** The smith works by day: hammer and sparks, a lit forge; at night the shed is dark and empty. */
  smithy!: { open: boolean; parts: Phaser.GameObjects.Image[]; fire: Phaser.GameObjects.Image; fireGlow: Phaser.GameObjects.Image };

  /** Show bought furniture and dashed placeholders for the rest. */
  refreshFurniture() {
    return interiors.refreshFurniture(this);
  }

  buildShop() {
    return interiors.buildShop(this);
  }

  enterShop() {
    this.moveTo((SHOP.x + SHOP.w / 2) * TILE, (SHOP.y + SHOP.h - 1) * TILE - 2, 'up');
  }

  /** The radio reads out today's rare fish and tomorrow's weather. */
  radio() {
    const s = this.state;
    const season = seasonOf(s.day);
    const wet = isWet(s.weather);
    const rare = FISH.filter((f) => f.weight <= 14 && (!f.seasons || f.seasons.includes(season)) && (f.rain !== 'only' || wet));
    const list = rare.slice(0, 3).map((f) => `${f.name} (${LAKES[f.where[0]].name} ${f.hours[0]}–${f.hours[1]})`).join(', ');
    play('click');
    this.toast(`Radio Desa: hari ini muncul ${list || 'ikan biasa saja'}. Besok ${WEATHER_INFO[s.forecasts[0]].name.toLowerCase()}.`);
  }

  /** Step through the farmhouse door. */
  enterHouse() {
    const R = HOUSE_ROOMS[this.state.houseTier] ?? ROOM;
    this.moveTo((R.x + R.w / 2) * TILE, (R.y + R.h - 1) * TILE - 2, 'up');
  }

  leaveRoom(exit: { x: number; y: number }) {
    this.moveTo(exit.x, exit.y, 'down');
  }

  /** Fade, move the player, fade back. */
  moveTo(x: number, y: number, dir: Dir, whileDark?: () => void) {
    if (this.busy) return;
    this.busy = true;
    this.moveTarget = undefined;
    const cam = this.cameras.main;
    cam.fadeOut(220, 10, 10, 20);
    cam.once('camerafadeoutcomplete', () => {
      whileDark?.();
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
  updateIndoors() {
    const tx = Math.floor(this.player.x / TILE);
    const ty = Math.floor((this.player.y - 4) / TILE);
    const here = roomAt(tx, ty);
    const inside = !!here;
    if (inside === this.indoors && here?.room === this.currentRoom) return;
    this.indoors = inside;
    this.currentRoom = here?.room;
    const cam = this.cameras.main;
    if (here) {
      this.refreshFurniture(); // always show the latest purchases
      cam.stopFollow();
      cam.removeBounds();
      this.frameRoom(here.room);
    } else {
      cam.setZoom(2 * UI_SCALE);
      cam.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
      cam.startFollow(this.player, true, 0.15, 0.15);
    }
    this.registry.set('indoors', inside);
    this.game.events.emit('indoors', inside);
  }

  /**
   * Fit a room between the HUD (top ~150 layout px) and the toolbar (bottom ~90),
   * zooming out for big rooms and never zooming in past the outdoor scale.
   */
  frameRoom(R: { x: number; y: number; w: number; h: number }) {
    const cam = this.cameras.main;
    if (R === CAVE_ROOM) {
      // the cave is big: keep the outdoor zoom and follow the player inside its walls
      cam.setZoom(2 * UI_SCALE);
      // bounds at least as big as the view, centred on the cave, so a narrow cave sits in the middle
      const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
      const bw = Math.max((R.w + 4) * TILE, vw), bh = Math.max((R.h + 9) * TILE, vh);
      const cx = (R.x + R.w / 2) * TILE, cy = (R.y + R.h / 2 + 0.5) * TILE;
      cam.setBounds(cx - bw / 2, cy - bh / 2, bw, bh);
      cam.startFollow(this.player, true, 0.15, 0.15);
      return;
    }
    const top = 150 * UI_SCALE, bottom = 125 * UI_SCALE; // clear the tool dock and its name pill
    const zoom = Math.min(2 * UI_SCALE, (cam.width * 0.94) / ((R.w + 1) * TILE), (cam.height - top - bottom) / ((R.h + 0.5) * TILE));
    cam.setZoom(zoom);
    // centre the room in the free band, which sits a little below the screen centre
    const shift = (top - bottom) / 2 / zoom;
    cam.centerOn((R.x + R.w / 2) * TILE, (R.y + R.h / 2) * TILE - shift);
  }

  /** Window glass follows the sky; the room dims gently at night while the lamp glows. */
  updateRoomLight(darkness: number) {
    const hr = this.state.minutes / 60;
    const sky = hr < 5 ? 0x1d2a4a : hr < 7 ? 0xf2b07a : hr < 17 ? 0x9fd8f5 : hr < 19.5 ? 0xf0905a : 0x1d2a4a;
    for (const v of this.roomViews) {
      v.glass.clear().fillStyle(sky, 1);
      for (const lx of v.windows) v.glass.fillRect((v.R.x + lx) * TILE - 14, v.R.y * TILE + 6, 28, 18); // the window's glass opening
      v.night.setFillStyle(0x1b1530, darkness * 0.28);
      v.lamp.setTint(darkness > 0.3 ? 0xffffff : 0xd8d0c0);
    }
  }

  /** A 4x4-tile building with its top-left corner at tile (x, y). */
  building(tex: string, x: number, y: number) {
    this.shadow((x + 2) * TILE, (y + 4) * TILE - 1, 70);
    this.add.image(x * TILE, y * TILE, tex).setOrigin(0).setDepth((y + 4) * TILE);
    for (let yy = y; yy <= y + 3; yy++) for (let xx = x; xx <= x + 3; xx++) this.block(xx, yy);
  }

  /** Warm window light for a 4x4 building, shown at night. */
  windowGlow(x: number, y: number) {
    for (const wx of [15, 49]) {
      this.lamps.push(
        this.add.image(x * TILE + wx, y * TILE + 42, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(9600).setAlpha(0),
      );
    }
  }

  deco(key: string, x: number, y: number, shadow = true) {
    if (this.blocked.has(plotKey(x, y))) return;
    if (shadow) this.shadow((x + 0.5) * TILE, (y + 1) * TILE - 2, 14);
    this.add.image((x + 0.5) * TILE, (y + 1) * TILE, key).setOrigin(0.5, 1).setDepth((y + 1) * TILE);
    this.block(x, y);
  }

  shadow(x: number, y: number, w: number) {
    return this.add.image(x, y, 'shadow').setDisplaySize(w, w * 0.32).setAlpha(0.28).setDepth(-6);
  }

  // ---------- atmosphere ----------

  setupAmbient() {
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
  darkness() {
    const hr = this.state.minutes / 60;
    if (hr < 5) return 1; // after midnight it is still deep night
    if (hr < 7) return Math.min(1, 0.35 * (7 - hr));
    if (hr < 17) return 0;
    if (hr < 20) return (hr - 17) / 3;
    return 1;
  }

  updateAmbient(dt: number) {
    const s = this.state;
    this.updateIndoors();
    this.updateRoomLight(this.darkness());
    // stepping onto the doormat leaves the house
    if (this.indoors && !this.busy) {
      const ftx = Math.floor(this.player.x / TILE);
      const fty = Math.floor((this.player.y - 1) / TILE);
      const here = roomAt(ftx, fty);
      if (here) {
        const tx = ftx - here.room.x, ty = fty - here.room.y, mid = here.room.w / 2;
        if (ty >= here.room.h - 1 && (tx === mid - 1 || tx === mid) && this.dir === 'down') this.leaveRoom(here.exit);
      }
    }
    this.boardBubble.setVisible(
      s.level >= FEATURE_LEVEL.board && s.requests.some((r) => requestReady(s, r)),
    );
    this.coopLock.setVisible(s.level < FEATURE_LEVEL.coop);
    const open = s.minutes >= BENGKEL_HOURS[0] * 60 && s.minutes < BENGKEL_HOURS[1] * 60;
    if (open !== this.smithy.open) {
      this.smithy.open = open;
      for (const p of this.smithy.parts) p.setVisible(open);
      this.smithy.fire.setVisible(open);
    }
    this.smithy.fireGlow.setAlpha(open ? 0.6 + this.darkness() * 0.3 : 0);
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
    const home = this.state.minutes >= 20 * 60 || this.state.minutes < 6 * 60 || s.weather === 'badai';
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

  block(x: number, y: number, spot?: Spot) {
    this.blocked.add(plotKey(x, y));
    if (spot) this.spots.set(plotKey(x, y), spot);
  }

  isBlocked(wx: number, wy: number) {
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    const outside = tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H;
    if (outside && !inRoom(tx, ty)) return true;
    return this.blocked.has(plotKey(tx, ty));
  }

  inField(x: number, y: number) {
    return x >= FIELD.x && x < FIELD.x + FIELD.w && y >= FIELD.y && y < FIELD.y + FIELD.h;
  }

  // ---------- input ----------

  modal() {
    return this.registry.get('modal') === true;
  }

  onKey(ev: KeyboardEvent) {
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
    const toolIdx = ['1', '2', '3', '4', '5', '6'].indexOf(k);
    if (toolIdx >= 0) this.setTool(toolIdx);
    else if (k === 'q') this.game.events.emit('cycle-seed');
    else if (k === ' ' || k === 'e' || k === 'enter') this.actionButton();
  }

  /** Space / E / the touch action button. */
  actionButton() {
    if (this.modal() || this.busy) return;
    if (this.fishing) return this.reel();
    const [tx, ty] = this.facingTile();
    this.work(tx, ty);
  }

  setTool(i: number) {
    const tool = TOOLS[i].id;
    if (needsPurchase(tool) && !this.state.ownedTools.includes(tool))
      return this.fail(`Kamu belum punya ${TOOLS[i].name}. Beli di toko (tab Peralatan).`);
    if (atForge(this.state, tool)) return this.fail(`${TOOLS[i].name} sedang ditempa di Bengkel Pandai Besi.`);
    this.state.tool = tool;
    this.game.events.emit('hud');
  }

  onTap(p: Phaser.Input.Pointer) {
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
      this.work(tx, ty);
    } else {
      this.moveTarget = { x: (tx + 0.5) * TILE, y: (ty + 0.9) * TILE, act: [tx, ty] };
    }
  }

  feet(): [number, number] {
    return [this.player.x, this.player.y - 2];
  }

  facingTile(): [number, number] {
    // the tile the player stands on, plus one step in the facing direction
    const [fx, fy] = this.feet();
    const [dx, dy] = DIR_VEC[this.dir];
    return [Math.floor(fx / TILE) + dx, Math.floor((fy - 1) / TILE) + dy];
  }

  faceTowards(x: number, y: number) {
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
    for (const [at, msg] of LATE_WARNINGS)
      if (this.state.minutes >= at && this.lateWarned < at) {
        this.lateWarned = at;
        if (this.state.minutes < at + 30) this.toast(msg); // not when a save loads already past it
      }
    // midnight: a new day starts whether or not you are asleep
    if (this.state.minutes >= 24 * 60) this.midnight();

    // late at night tiredness wears you down; at 0 stamina (from work or the night) you pass out
    const s0 = this.state;
    if (isNight(s0.minutes)) {
      const rate = s0.minutes < 6 * 60 ? NIGHT_DRAIN.afterMidnight : NIGHT_DRAIN.perHour;
      this.drainAcc += (dt * GAME_MIN_PER_SEC * rate) / 60;
      if (this.drainAcc >= 1) {
        const n = Math.floor(this.drainAcc);
        this.drainAcc -= n;
        s0.stamina -= n;
        this.game.events.emit('hud');
      }
    }
    if (s0.stamina <= LOW_STAMINA && !this.lowWarned && s0.stamina > 0) {
      this.lowWarned = true;
      this.toast('Tenaga hampir habis! Makan sesuatu atau pulang tidur.');
    }
    if (s0.stamina <= 0) {
      s0.stamina = 0;
      const home = this.indoors && this.currentRoom !== CAVE_ROOM;
      this.toast(home ? 'Tenagamu habis. Kamu tertidur di lantai rumah...' : 'Tenagamu habis. Kamu pingsan...');
      this.sleep('passout');
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
          this.work(act[0], act[1]);
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

  tryMove(dx: number, dy: number): number {
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

  setPlayerFrame(f: number) {
    const d = this.dir === 'left' || this.dir === 'right' ? 'side' : this.dir;
    this.player.setTexture(`player-${d}-${f}`);
    this.player.setFlipX(this.dir === 'left');
  }

  // ---------- actions ----------

  lastPosSave = 0;

  /** Store where the player stands; called on stop, on sleep, and when the page closes. */
  savePosition = () => {
    if (!this.player || !this.sys.isActive()) return; // never write from a stopped game
    this.state.pos = { x: Math.round(this.player.x), y: Math.round(this.player.y), dir: this.dir };
    this.lastPosSave = this.time.now;
    save(this.state);
  };

  toast(msg: string) {
    this.game.events.emit('toast', msg);
  }

  fail(msg: string) {
    play('error');
    this.toast(msg);
  }

  /** Use the tool on the facing tile; upgraded hoes and watering cans also work the tiles around it. */
  work(tx: number, ty: number) {
    const s = this.state;
    const area = AREA_BY_TIER[s.tool]?.[tierOf(s, s.tool)] ?? 'line1';
    this.act(tx, ty);
    if (area === 'line1') return;
    for (const [x, y] of this.areaTiles(tx, ty, area)) this.act(x, y, true);
  }

  /** The extra tiles an upgraded tool reaches (not the facing tile itself). */
  areaTiles(tx: number, ty: number, area: 'line2' | 'line3' | 'square'): [number, number][] {
    const [dx, dy] = this.dir === 'up' ? [0, -1] : this.dir === 'down' ? [0, 1] : this.dir === 'left' ? [-1, 0] : [1, 0];
    if (area === 'square') {
      const out: [number, number][] = [];
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (ox || oy) out.push([tx + ox, ty + oy]);
      return out;
    }
    const n = area === 'line2' ? 1 : 2;
    return Array.from({ length: n }, (_, i) => [tx + dx * (i + 1), ty + dy * (i + 1)] as [number, number]);
  }

  act(tx: number, ty: number, extra = false) {
    const s = this.state;
    const k = plotKey(tx, ty);
    const spot = this.spots.get(k);
    // extra tiles of an upgraded tool: only plain field work, quietly
    if (extra && (spot || !this.inField(tx, ty) || (s.tool !== 'cangkul' && s.tool !== 'siram'))) return;
    if (spot === 'door') return this.enterHouse();
    if (spot === 'bed') return this.game.events.emit('ask-sleep');
    if (spot === 'stove') {
      if (s.level < FEATURE_LEVEL.kitchen) return this.fail(`Dapur terbuka di Level ${FEATURE_LEVEL.kitchen}.`);
      return this.game.events.emit('open-kitchen');
    }
    if (spot === 'tv') return this.game.events.emit('open-calendar');
    if (spot === 'shelf') return this.game.events.emit('open-fishbook');
    if (spot === 'wardrobe') return this.game.events.emit('open-wardrobe');
    if (spot === 'mebel') return this.enterShop();
    if (spot === 'sofa') {
      const err = restOnSofa(s);
      if (err) return this.fail(err);
      play('sleep');
      this.toast(`Istirahat sebentar di sofa. +${SOFA_STAMINA} tenaga.`);
      return this.changed();
    }
    if (spot === 'counter') return this.game.events.emit('open-mebel');
    if (spot === 'display') return this.game.events.emit('open-mebel', this.furnitureTiles.get(k));
    if (spot === 'fridge') return this.game.events.emit('open-fridge');
    if (spot === 'storage') return this.game.events.emit('open-storage');
    if (spot === 'radio') return this.radio();
    if (spot === 'trophy') {
      const gold = Math.min(TROPHY_BONUS_MAX, s.festival.trophies.emas ?? 0);
      return this.toast(`Lemari Piala: ${gold} piala emas · bonus hadiah festival +${Math.round(gold * TROPHY_BONUS * 100)}%.`);
    }
    if (spot === 'slot') {
      const f = furnitureById(this.furnitureTiles.get(k) ?? '');
      return this.toast(`${f?.name ?? 'Perabot'} bisa dibeli di Toko Mebel (desa sebelah timur).`);
    }
    if (spot === 'shop') return this.game.events.emit('open-shop');
    if (spot === 'bin') return this.ship();
    if (spot === 'board') {
      if (s.level < FEATURE_LEVEL.board) return this.fail(`Papan permintaan terbuka di Level ${FEATURE_LEVEL.board}.`);
      return this.game.events.emit('open-board');
    }
    if (spot === 'stage') return this.visitStage();
    if (spot === 'house') {
      const owner = this.houseOwner.get(k)!;
      const npc = npcById(owner);
      if (owner === MARKET_OWNER) {
        if (s.minutes < MARKET_OPEN || s.minutes >= MARKET_CLOSE) return this.fail('Warung Bahan buka pukul 07:00–20:00.');
        return this.game.events.emit('open-market');
      }
      return this.toast(`Rumah ${npc.name}, ${npc.role}.`);
    }
    if (spot === 'coop') {
      if (s.level < FEATURE_LEVEL.coop) return this.fail(`Kandang ayam terbuka di Level ${FEATURE_LEVEL.coop}.`);
      return this.tendCoop();
    }
    if (spot === 'bengkel') {
      if (!this.smithy.open) return this.fail(`Bengkel tutup. Pandai besi sudah pulang (buka ${BENGKEL_HOURS[0]}:00–${BENGKEL_HOURS[1]}:00).`);
      return this.game.events.emit('open-bengkel');
    }
    if (spot === 'minesign')
      return this.toast(`Gua Tambang Bukit Kapur\nMakin dalam, makin bagus bijihnya. Terdalam: lantai ${s.cave?.deepest ?? 0}. Butuh Beliung (6).`);
    if (spot === 'cave') {
      const floors = liftFloors(s);
      if (floors.length > 1 && s.ownedTools.includes('beliung'))
        return this.game.events.emit('ask-cave-floor', { floors, deepest: s.cave?.deepest ?? 0, onPick: (f: number) => this.enterCave(f) });
      return this.enterCave(1);
    }
    if (spot === 'pillar') return this.fail('Stalaktit sekeras besi, tidak bisa dipecah. Cari jalan memutar.');
    if (spot === 'treasure') {
      const err = openCaveTreasure(s);
      if (err) return this.fail(err);
      play('quest');
      this.toast(`Peti harta Perut Bumi! +${CAVE_TREASURE.coins.toLocaleString('id-ID')} G, 3 Batu Mulia, 5 Bijih Emas.`);
      this.refreshCave();
      save(s);
      return this.changed();
    }
    if (spot === 'descend') {
      const next = (s.cave?.floor ?? 0) + 1;
      play('place');
      return this.enterCave(next);
    }
    if (spot === 'ore') {
      if (s.tool !== 'beliung') {
        if (!s.ownedTools.includes('beliung')) return this.fail('Butuh Beliung untuk menambang. Beli di toko (tab Peralatan).');
        return this.fail('Pakai Beliung (6) untuk memecah batu.');
      }
      const r = mineHit(s, k, Math.random, 1 + tierOf(s, 'beliung'));
      if (r.error) return this.fail(r.error);
      this.swing();
      play('hoe');
      this.splash(tx, ty, 0xb4b4b8);
      const img = this.mineImgs.get(k);
      if (img) this.tweens.add({ targets: img, x: img.x + 1.5, duration: 40, yoyo: true, repeat: 2 });
      if (r.drop) {
        play('coin');
        this.toast(`+${r.drop.qty} ${produceById(r.drop.id).name}`);
        this.xp(r.drop.id === 'batu' ? 1 : 3, tx, ty);
        if (r.ladder) this.toast('Ada tangga ke bawah di balik batu itu!');
        this.refreshCave();
      }
      return this.changed();
    }
    if (spot === 'lakesign') {
      const lake = LAKES[this.lakeSigns.get(k) ?? 'danau'];
      const n = FISH.filter((f) => f.where.includes(this.lakeSigns.get(k) ?? 'danau')).length;
      return this.toast(`${lake.name}\n${lake.desc} (${n} jenis ikan)`);
    }
    if (spot === 'pond') {
      if (s.tool === 'pancing') return this.startFishing(tx, ty);
      if (s.tool !== 'siram') return this.fail('Pakai Penyiram (2) untuk isi air, atau Pancing (5) untuk memancing.');
      s.water = waterMax(s);
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

    switch (s.tool) {
      case 'cangkul': {
        if (plot?.sprinkler) return extra ? undefined : this.fail('Ambil sprinkler dengan Tangan (4).');
        if (plot?.crop?.dead) {
          delete plot.crop;
        } else if (plot?.crop) {
          return extra ? undefined : this.fail('Ada tanaman di sini.');
        } else if (plot?.tilled) {
          return;
        } else {
          s.plots[k] = { tilled: true, watered: false };
        }
        if (!extra) {
          s.stamina -= STAMINA_COST.cangkul;
          this.swing();
          play('hoe');
        }
        this.xp(XP.till, tx, ty);
        this.splash(tx, ty, 0xa8743f);
        break;
      }
      case 'siram': {
        if (!plot?.tilled) return;
        if (s.water <= 0) return extra ? undefined : this.fail('Air habis. Isi di kolam.');
        if (plot.watered) return;
        plot.watered = true;
        s.water--;
        if (!extra) {
          s.stamina -= STAMINA_COST.siram;
          this.swing();
          play('water');
        }
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
          return this.game.events.emit('ask-confirm', {
            title: 'Copot sprinkler?',
            body: 'Sprinkler kembali ke tas. Petak di sekitarnya tidak disiram otomatis lagi besok pagi.',
            ok: 'Copot',
            onOk: () => {
              if (!s.plots[k]?.sprinkler || !canAdd(s, 'seeds', 'sprinkler')) return;
              delete s.plots[k];
              add(s.seeds, 'sprinkler', 1);
              play('place');
              this.toast('Sprinkler diambil.');
              this.changed();
            },
          });
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
  useBagItem(id: string) {
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

  ship() {
    if (!Object.keys(this.state.produce).length && !Object.keys(this.state.shipping).length)
      return this.fail('Tidak ada hasil panen untuk dikirim.');
    this.game.events.emit('open-shipping');
  }


  visitStage() {
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

  startFishing(tx: number, ty: number) {
    return fishing.startFishing(this, tx, ty);
  }

  bite() {
    return fishing.bite(this);
  }

  reel() {
    return fishing.reel(this);
  }

  endFishing(msg: string, failed = false) {
    return fishing.endFishing(this, msg, failed);
  }

  // ---------- villagers ----------

  spawnVillagers() {
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

  villagerAt(tx: number, ty: number) {
    const cx = (tx + 0.5) * TILE;
    const cy = (ty + 0.5) * TILE;
    for (const [id, img] of this.villagers)
      if (img.visible && Phaser.Math.Distance.Between(img.x, img.y - 8, cx, cy) < 14) return id;
    return undefined;
  }

  talk(id: string) {
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

  syncAnimals() {
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
  henAt(tx: number, ty: number) {
    const cx = (tx + 0.5) * TILE;
    const cy = (ty + 0.5) * TILE;
    for (const a of this.state.animals) {
      const img = this.hens.get(a.id);
      if (img?.visible && Phaser.Math.Distance.Between(img.x, img.y - 6, cx, cy) < 13) return a;
    }
    return undefined;
  }

  pet(a: GameState['animals'][number]) {
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

  tendCoop() {
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
  xp(n: number, tx: number, ty: number) {
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

  changed() {
    this.game.events.emit('hud');
    save(this.state);
  }

  /** The last late-night warning shown today (minutes), so each shows once. */
  lateWarned = 0;
  drainAcc = 0; // fractional stamina lost to the night
  lowWarned = false;

  /** A report from a midnight you were awake for, shown the next time you wake up. */
  pendingReport?: DayReport;

  /** The date changes at 00:00 while you play: grow, pay, new requests, a fresh cave. */
  midnight() {
    const report = rollover(this.state);
    this.lateWarned = 0;
    this.redrawAfterRollover();
    this.pendingReport = report;
    const money = report.income ? ` Kiriman terjual +${report.income.toLocaleString('id-ID')} G.` : '';
    this.toast(`Tengah malam: hari baru, ${WEEKDAYS[(this.state.day - 1) % 7]} ${seasonOf(this.state.day)} ${dayOfSeason(this.state.day)}.${money} Tenaga makin cepat berkurang!`);
    save(this.state);
    this.game.events.emit('hud');
  }

  redrawAfterRollover() {
    for (const k of new Set([...this.soilImgs.keys(), ...this.propImgs.keys(), ...Object.keys(this.state.plots)]))
      this.refreshPlot(k);
    this.refreshCave();
    this.time.delayedCall(600, () => this.spraySprinklers());
  }

  /**
   * Sleep in bed until morning (the default), nap for two hours, or pass out where you stand.
   * Time moves on, crossing midnight if it must, and you wake beside your bed.
   */
  sleep(kind: RestKind | boolean = 'bed') {
    if (kind === true) kind = 'passout';
    if (kind === false) kind = 'bed';
    const mode: RestKind = kind;
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
      const outside = mode === 'passout' && (!this.indoors || this.currentRoom === CAVE_ROOM);
      const { report, hours, fine } = rest(this.state, mode, outside);
      this.lateWarned = 0;
      this.lowWarned = false;
      this.drainAcc = 0;
      const home = HOUSE_ROOMS[this.state.houseTier] ?? ROOM;
      this.player.setPosition((home.x + 2.5) * TILE, (home.y + 4) * TILE - 2); // wake up beside the bed
      this.dir = 'down';
      this.state.pos = { x: Math.round(this.player.x), y: Math.round(this.player.y), dir: 'down' };
      if (report) this.redrawAfterRollover();
      save(this.state);
      // a morning report for the day that began while you slept (or one you stayed up for)
      const shown = report ?? this.pendingReport;
      this.pendingReport = undefined;
      if (shown && (mode !== 'nap' || report)) {
        if (!report && mode === 'passout') (shown.passedOut = outside ? 'luar' : 'rumah'), (shown.fine = fine);
        this.game.events.emit('day-report', shown);
      } else {
        const h = Math.round(hours * 10) / 10;
        this.toast(mode === 'nap' ? `Tidur siang ${h} jam. Tenaga ${this.state.stamina}.` : `Bangun setelah ${h} jam. Tenaga ${this.state.stamina}.${fine ? ` Biaya diantar warga ${fine} G.` : ''}`);
      }
      this.game.events.emit('hud');
      cam.fadeIn(500, 10, 10, 30);
      this.busy = false;
    });
  }

  refreshPlot(k: string, pop = false) {
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

  spraySprinklers() {
    for (const [k, p] of Object.entries(this.state.plots)) {
      if (!p.sprinkler) continue;
      const [x, y] = k.split(',').map(Number);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) this.splash(x + dx, y + dy, 0x8fd0f5);
    }
  }

  swing() {
    this.tweens.add({ targets: this.player, y: this.player.y - 2, duration: 70, yoyo: true });
  }

  splash(tx: number, ty: number, color: number) {
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
  starBurst(tx: number, ty: number, q: number) {
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

  flyIcon(tx: number, ty: number, key: string) {
    const icon = this.add.image((tx + 0.5) * TILE, ty * TILE, key).setDepth(9002);
    this.tweens.add({ targets: icon, y: icon.y - 14, alpha: 0, duration: 700, ease: 'Quad.Out', onComplete: () => icon.destroy() });
  }
}
