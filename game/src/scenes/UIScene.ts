import Phaser from 'phaser';
import { npcById, produceById } from '../data';
import {
  WEEKDAYS,
  WEATHER_INFO,
  isWet,
  baseId,
  starsOf,
  TOOLS,
  itemName,
  needsPurchase,
  TOOL_TIERS,
  TIER_COLORS,
  unlocksAt,
  xpToNext,
  seedIcon,
} from '../data';
import { play, setRain, unlockAudio } from '../sfx';
import { startMusic } from '../music';
import { C, HEX, UI_SCALE, VIEW, bar as drawBar, card, glass, txt } from '../ui/theme';
import {
  bagCapacity,
  requestReady,
  waterMax,
  tierOf,
  atForge,
  isFestivalDay,
  dayOfSeason,
  seasonOf,
  slotsUsed,
  yearOf,
  type DayReport,
  type GameState,
  maxStamina,
  reqItems,
  countFor,
} from '../state';
import type { FarmScene } from './FarmScene';
import { openShop } from '../ui/windows/shop';
import { openInventory } from '../ui/windows/bag';
import { openKitchen } from '../ui/windows/house';
import { openWardrobe } from '../ui/windows/wardrobe';
import { openMebel } from '../ui/windows/mebel';
import { openFridge, openStorage } from '../ui/windows/fridge';
import { openWorldMap } from '../ui/windows/worldmap';
import { askCaveFloor, type CaveAsk } from '../ui/windows/cave';
import { openBengkel } from '../ui/windows/bengkel';
import { openMarket } from '../ui/windows/market';
import { openShipping } from '../ui/windows/shipping';
import { openBoard } from '../ui/windows/board';
import { openFestival } from '../ui/windows/festival';
import { openCalendar } from '../ui/windows/calendar';
import { openFishBook } from '../ui/windows/fishbook';
import { showReport, showWelcome, askSleep, askConfirm, type Confirm } from '../ui/windows/report';

const INK = C.ink;
const SLOT = 54, SLOT_GAP = 6, DOCK_PAD = 7;

/** Buttons that dismiss or postpone get the quiet secondary style. */
const SECONDARY = new Set(['Tutup', 'Batal', 'Nanti', 'Belum']);

export class UIScene extends Phaser.Scene {
  state!: GameState;
  private dateText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private bars!: Phaser.GameObjects.Graphics;
  private bagText!: Phaser.GameObjects.Text;
  private bagMini!: Phaser.GameObjects.Container;
  private bagTitle!: Phaser.GameObjects.Text;
  private slots: {
    frame: Phaser.GameObjects.Graphics;
    label: Phaser.GameObjects.Text;
    icon: Phaser.GameObjects.Image;
    key: Phaser.GameObjects.Text;
    count?: Phaser.GameObjects.Text;
  }[] = [];
  private dock!: Phaser.GameObjects.Graphics;
  private toolPill!: Phaser.GameObjects.Graphics;
  private toolName!: Phaser.GameObjects.Text;
  private seedIcon!: Phaser.GameObjects.Image;
  private toastText!: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;
  private toastBg!: Phaser.GameObjects.Graphics;
  private modalLayer?: Phaser.GameObjects.Container;
  private pendingLevels: number[] = [];
  private modalKind = '';
  private levelText!: Phaser.GameObjects.Text;
  private xpLine!: Phaser.GameObjects.Graphics;
  private clockIcon!: Phaser.GameObjects.Image;
  private clockDay!: Phaser.GameObjects.Text;
  private clockSub!: Phaser.GameObjects.Text;
  private lastMinute = -1;

  constructor() {
    super('ui');
  }

  private get farm() {
    return this.scene.get('farm') as FarmScene;
  }

  create() {
    this.state = this.registry.get('state');
    // the scene is rebuilt when the window is resized: start every per-build collection fresh
    this.slots = [];
    this.hiddenHud = [];
    this.modalLayer = undefined;
    this.worldBlur = undefined;
    this.shownWeather = '';
    this.cameras.main.setZoom(UI_SCALE).centerOn(VIEW.w / 2, VIEW.h / 2);
    const { w: W, h: H } = VIEW;

    this.buildWeather();

    // top-left: date, time, coins, bars
    this.panel(12, 12, 250, 84);
    this.dateText = this.add.text(28, 22, '', txt(14, INK));
    this.levelText = this.add.text(246, 22, '', txt(14, C.purple)).setOrigin(1, 0);
    this.bars = this.add.graphics();
    this.xpLine = this.add.graphics();
    this.buildClock();

    // top-right: bag
    // map button under the stats panel
    const mapBtn = this.panel(12, 104, 92, 30);
    mapBtn.fillStyle(0x34a853, 1).fillRoundedRect(22, 113, 12, 12, 3); // a tiny map glyph
    mapBtn.fillStyle(0x4a90d8, 1).fillRoundedRect(22, 119, 7, 6, { tl: 0, tr: 3, bl: 3, br: 0 });
    // no keyboard on a phone: drop the shortcut hint there
    const hasTouch = this.sys.game.device.input.touch || new URLSearchParams(location.search).has('touch');
    this.add.text(42, 119, hasTouch ? 'Peta' : 'Peta · P', txt(12)).setOrigin(0, 0.5);
    this.add.zone(12, 104, 92, 30).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (this.registry.get('modal')) return;
      play('click');
      openWorldMap(this);
    });

    // quest button: the requests marked on the board, so they are not forgotten
    this.panel(12, 142, 92, 30);
    this.questLabel = this.add.text(58, 157, '', txt(12)).setOrigin(0.5);
    this.add.zone(12, 142, 92, 30).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (this.registry.get('modal')) return;
      play('click');
      this.questOpen = !this.questOpen;
      this.refresh();
    });
    this.questList = this.add.container(0, 0);

    this.panel(W - 232, 12, 220, 112);
    this.bagTitle = this.add.text(W - 216, 22, 'Tas', txt(16));
    this.coinText = this.add.text(W - 28, 22, '', txt(16, C.orange)).setOrigin(1, 0);
    this.bagMini = this.add.container(0, 0);
    this.bagText = this.add.text(W - 216, 96, '', txt(11, INK, false));
    const bagHit = this.add.zone(W - 232, 12, 220, 112).setOrigin(0).setInteractive({ useHandCursor: true });
    bagHit.on('pointerdown', () => {
      if (this.registry.get('modal')) return;
      play('click');
      openInventory(this);
    });

    // toolbar: one glass dock, the active tool lifts out of it
    this.dock = this.add.graphics();
    TOOLS.forEach((t, i) => {
      const { x, y } = UIScene.slotPos(i);
      const frame = this.add.graphics();
      const icon = this.add.image(x + SLOT / 2, y + SLOT / 2, `tool-${t.id}`).setScale(2.2);
      const key = this.add.text(x + 6, y + 4, t.key, txt(9, C.tertiary));
      const label = this.add.text(0, 0, '', txt(1)).setVisible(false); // the name shows in the pill above the dock
      const hit = this.add.zone(x, y, SLOT, SLOT).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        if (this.registry.get('modal')) return;
        if (t.id === 'benih' && this.state.tool === 'benih') this.cycleSeed();
        else this.farm.setTool(i);
      });
      const slot: (typeof this.slots)[number] = { frame, label, icon, key };
      if (t.id === 'benih') {
        this.seedIcon = this.add.image(x + SLOT - 12, y + 12, 'seed-kangkung').setScale(0.9);
        slot.count = this.add.text(0, 0, '', txt(9, C.white)).setOrigin(0.5);
      }
      this.slots.push(slot);
    });

    this.toolPill = this.add.graphics();
    this.toolName = this.add.text(0, 0, '', txt(12)).setOrigin(0.5);

    this.toastBg = this.add.graphics().setDepth(199).setAlpha(0);
    this.toastText = this.add
      .text(W / 2, H - 128, '', { ...txt(14, C.white), align: 'center', wordWrap: { width: 640 } })
      .setOrigin(0.5, 1)
      .setAlpha(0)
      .setDepth(200);

    const ev = this.game.events;
    const handlers: [string, (...a: never[]) => void][] = [
      ['hud', () => this.refresh()],
      ['toast', (m: string) => this.toast(m)],
      ['cycle-seed', () => this.cycleSeed()],
      ['open-shop', () => openShop(this)],
      ['open-board', () => openBoard(this)],
      ['open-festival', () => openFestival(this)],
      ['open-kitchen', () => openKitchen(this)],
      ['open-calendar', () => openCalendar(this)],
      ['open-fishbook', () => openFishBook(this)],
      ['open-wardrobe', () => openWardrobe(this)],
      ['open-mebel', (id?: string) => openMebel(this, id)],
      ['open-fridge', () => openFridge(this)],
      ['open-map', () => openWorldMap(this)],
      ['ask-cave-floor', (q: CaveAsk) => askCaveFloor(this, q)],
      ['open-bengkel', () => openBengkel(this)],
      ['open-storage', () => openStorage(this)],
      ['open-market', () => openMarket(this)],
      ['open-shipping', () => openShipping(this)],
      ['indoors', (inside: boolean) => this.applyIndoors(inside)],
      ['area', (name: string) => this.areaBanner(name)],
      ['level-up', (lv: number[]) => this.queueLevelUp(lv)],
      ['ask-sleep', () => askSleep(this)],
      ['ask-confirm', (q: Confirm) => askConfirm(this, q)],
      ['day-report', (r: DayReport) => showReport(this, r)],
    ];
    for (const [e, h] of handlers) ev.on(e, h, this);
    this.events.once('shutdown', () => handlers.forEach(([e, h]) => ev.off(e, h, this)));

    this.input.keyboard!.on('keydown-ESC', () => this.closeModal());
    this.input.keyboard!.on('keydown-J', () => {
      if (this.modalLayer && this.modalKind === 'fishbook') return this.closeModal();
      if (!this.registry.get('modal')) openFishBook(this);
    });
    this.input.keyboard!.on('keydown-K', () => {
      if (this.modalLayer && this.modalKind === 'calendar') return this.closeModal();
      if (!this.registry.get('modal')) openCalendar(this);
    });
    this.input.keyboard!.on('keydown-P', () => {
      if (this.modalLayer && this.modalKind === 'worldmap') return this.closeModal();
      if (!this.registry.get('modal')) openWorldMap(this);
    });
    this.input.keyboard!.on('keydown-I', () => {
      if (this.modalLayer && this.modalKind === 'inventory') return this.closeModal();
      if (!this.registry.get('modal')) openInventory(this);
    });

    const touch = this.sys.game.device.input.touch || new URLSearchParams(location.search).has('touch');
    this.registry.set('touch', touch);
    if (touch) this.buildTouchControls();

    this.refresh();
    if (this.registry.get('indoors')) this.applyIndoors(true);
    // once per session: a resize rebuilds this scene and must not greet again
    if (this.state.day === 1 && this.state.stats.harvested === 0 && !this.registry.get('welcomed')) {
      this.registry.set('welcomed', true);
      showWelcome(this);
    }
  }

  update() {
    const m = Math.floor(this.state.minutes);
    if (m !== this.lastMinute) {
      this.lastMinute = m;
      this.refreshClock();
    }
  }

  // ---------- HUD ----------

  private panel(x: number, y: number, w: number, h: number) {
    return glass(this.add.graphics(), x, y, w, h, 16, { alpha: 0.76, shadow: 3, sheen: false });
  }

  private refreshClock() {
    const s = this.state;
    const h = Math.floor(s.minutes / 60) % 24;
    const mm = Math.floor(s.minutes % 60);
    this.timeText.setText(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
    // late: orange once tiredness sets in at 22:00, red after midnight when it drains faster
    this.timeText.setColor(s.minutes < 6 * 60 ? C.red : s.minutes >= 22 * 60 ? C.orange : C.ink);
  }

  refresh() {
    const s = this.state;
    this.dateText.setText(`Tahun ${yearOf(s.day)}`);
    this.coinText.setText(`${s.coins.toLocaleString('id-ID')} G`);
    this.refreshClockPill();
    this.applyWeather();
    this.refreshClock();
    this.refreshQuests();

    const g = this.bars.clear();
    const bar = (y: number, value: number, max: number, color: number, label: string) => {
      drawBar(g, 82, y + 3, 104, value / max, color);
      // label and value are created once, then only their text changes
      if (!this.children.getByName(label)) this.add.text(28, y - 1, label, txt(12, INK)).setName(label);
      const key = `${label}-val`;
      const v = (this.children.getByName(key) as Phaser.GameObjects.Text | null) ?? this.add.text(246, y - 1, '', txt(12, INK)).setOrigin(1, 0).setName(key);
      v.setText(`${Math.floor(value)}/${max}`);
    };
    bar(46, s.stamina, maxStamina(s), HEX.orange, 'Tenaga');
    bar(66, s.water, waterMax(s), HEX.blue, 'Air');

    // XP: a thin full-width progress line along the top edge
    const need = xpToNext(s.level);
    const frac = Math.min(1, s.xp / need);
    this.xpLine.clear();
    this.xpLine.fillStyle(0x000000, 0.22).fillRect(0, 0, VIEW.w, 4);
    if (frac > 0) {
      this.xpLine.fillStyle(HEX.purple, 0.35).fillRect(0, 0, VIEW.w * frac, 6); // soft glow
      this.xpLine.fillStyle(HEX.purple, 1).fillRect(0, 0, VIEW.w * frac, 4);
    }
    this.levelText.setText(`Lv ${s.level} · ${(frac * 100).toFixed(2)}%`);

    // HUD bag: a row of mini slots plus one status line
    const W = VIEW.w;
    this.bagMini.removeAll(true);
    const used = slotsUsed(s), cap = bagCapacity(s);
    this.bagTitle.setText(`Tas ${used}/${cap}`).setColor(used >= cap ? C.red : INK);
    const produce = Object.entries(s.produce);
    if (!produce.length) this.bagMini.add(this.add.text(W - 216, 54, 'Hasil panen kosong', txt(13, C.secondary, false)));
    produce.slice(0, 5).forEach(([id, q], i) => {
      const sx = W - 216 + i * 38;
      const g = this.add.graphics();
      card(g, sx, 46, 34, 34, 'muted', 9);
      this.bagMini.add([g, this.add.image(sx + 17, 63, `icon-${baseId(id)}`).setScale(1.5), this.add.text(sx + 33, 80, `${q}`, txt(11)).setOrigin(1, 1)]);
      const badge = this.starBadge(sx + 2, 47, id, 9);
      if (badge) this.bagMini.add(badge);
    });
    if (produce.length > 5) this.bagMini.add(this.add.text(W - 26, 63, `+${produce.length - 5}`, txt(12, C.secondary)).setOrigin(1, 0.5));
    const status: string[] = [];
    const ship = Object.values(s.shipping).reduce((a, b) => a + b, 0);
    if (ship) status.push(`Kirim: ${ship}`);
    const ready = s.requests.filter((r) => requestReady(s, r)).length;
    if (ready) status.push(`Permintaan siap: ${ready}`);
    if (s.animals.length) status.push(`Pakan: ${s.feed}`);
    this.bagText.setText(status.join(' · '));

    // the dock behind all tools: each tool sits in its own slot
    const first = UIScene.slotPos(0), last = UIScene.slotPos(TOOLS.length - 1);
    const dockW = last.x + SLOT - first.x + DOCK_PAD * 2;
    this.dock.clear();
    glass(this.dock, first.x - DOCK_PAD, first.y - DOCK_PAD, dockW, SLOT + DOCK_PAD * 2, 20, { alpha: 0.76, shadow: 3, sheen: false });

    let activeName = '';
    TOOLS.forEach((t, i) => {
      const { frame, icon, key, count } = this.slots[i];
      const locked = needsPurchase(t.id) && !s.ownedTools.includes(t.id);
      const on = s.tool === t.id;
      const { x, y } = UIScene.slotPos(i);
      frame.clear();
      if (on) {
        frame.fillStyle(0xffffff, 1).fillRoundedRect(x, y, SLOT, SLOT, 14);
        frame.lineStyle(2, HEX.blue, 1).strokeRoundedRect(x, y, SLOT, SLOT, 14);
      } else frame.fillStyle(0x767680, 0.1).fillRoundedRect(x, y, SLOT, SLOT, 14);
      icon.setScale(on ? 2.4 : 2.1);
      icon.setTint(locked ? 0x8a8070 : 0xffffff).setAlpha(locked ? 0.4 : on ? 1 : 0.85);
      key.setColor(on ? C.blue : C.tertiary);
      const tier = tierOf(s, t.id), away = atForge(s, t.id);
      let name = locked ? `${t.name} · beli di Toko` : tier ? `${t.name} ${TOOL_TIERS[tier]}` : t.name;
      if (away) {
        name = `${t.name} · sedang di Bengkel`;
        icon.setAlpha(0.3);
      }
      if (tier && !locked) frame.fillStyle(TIER_COLORS[tier], 1).fillCircle(x + 9, y + SLOT - 9, 4).lineStyle(1, 0xffffff, 1).strokeCircle(x + 9, y + SLOT - 9, 4);
      if (t.id === 'benih' && count) {
        // an empty selection jumps to something still in the bag, or shows an empty sack
        if (!s.seeds[s.seed] && Object.keys(s.seeds).length) s.seed = Object.keys(s.seeds)[0];
        const empty = !s.seeds[s.seed];
        icon.setTint(empty ? 0x8a8070 : 0xffffff).setAlpha(empty ? 0.4 : on ? 1 : 0.85);
        name = empty ? 'Benih · kosong' : `${itemName(s.seed)} ×${s.seeds[s.seed]}`;
        this.seedIcon.setVisible(!empty);
        if (!empty) this.seedIcon.setTexture(seedIcon(s.seed));
        count.setVisible(!empty).setText(`${s.seeds[s.seed] ?? 0}`).setPosition(x + SLOT - 9, y + SLOT - 9);
        if (!empty) {
          const w = Math.max(16, count.width + 8);
          frame.fillStyle(on ? HEX.blue : 0x8e8e93, 1).fillRoundedRect(count.x - w / 2, count.y - 7, w, 14, 7);
        }
      }
      if (on) activeName = name;
    });

    // the active tool's name, in a small pill above the dock
    this.toolName.setText(activeName).setPosition(VIEW.w / 2, first.y - DOCK_PAD - 16);
    this.toolPill.clear();
    if (activeName) {
      const w = this.toolName.width + 24;
      glass(this.toolPill, VIEW.w / 2 - w / 2, this.toolName.y - 12, w, 24, 12, { alpha: 0.6, shadow: 2, sheen: false });
    }
    this.toolName.setVisible(!!activeName);
  }

  /** Top-left corner of a toolbar slot (UI coordinates). */
  private static slotPos(i: number) {
    const total = TOOLS.length * SLOT + (TOOLS.length - 1) * SLOT_GAP;
    return { x: VIEW.w / 2 - total / 2 + i * (SLOT + SLOT_GAP), y: VIEW.h - SLOT - DOCK_PAD - 12 };
  }

  private cycleSeed() {
    const s = this.state;
    const owned = Object.keys(s.seeds);
    if (!owned.length) return this.toast('Kamu tidak punya benih. Beli di toko.');
    const i = owned.indexOf(s.seed);
    s.seed = owned[(i + 1) % owned.length];
    s.tool = 'benih';
    this.refresh();
    this.toast(`Dipilih: ${itemName(s.seed)}`);
  }

  toast(msg: string) {
    this.placeToast();
    this.toastText.setText(msg).setAlpha(1);
    // dark rounded pill behind the message
    const w = this.toastText.width + 36;
    const h = this.toastText.height + 18;
    const x = this.toastText.x - w / 2;
    const y = this.toastText.y - this.toastText.height - 9;
    this.toastBg.clear();
    this.toastBg.fillStyle(0x000000, 0.12).fillRoundedRect(x, y + 3, w, h, Math.min(h / 2, 20));
    this.toastBg.fillStyle(0x1d1d1f, 0.86).fillRoundedRect(x, y, w, h, Math.min(h / 2, 20));
    this.toastBg.setAlpha(1);
    this.toastTimer?.remove();
    this.toastTimer = this.time.delayedCall(2200, () =>
      this.tweens.add({ targets: [this.toastText, this.toastBg], alpha: 0, duration: 300 }),
    );
  }

  // ---------- modals ----------

  /** Messages sit just below an open window (or above it when there is no room), never over its buttons. */
  private modalBox?: { top: number; bottom: number };

  private placeToast() {
    const H = VIEW.h;
    const m = this.modalLayer ? this.modalBox : undefined;
    if (!m) this.toastText.setY(H - 128); // above the tool name pill
    else if (m.bottom + 30 <= H) this.toastText.setY(m.bottom + 28);
    else this.toastText.setY(Math.max(26, m.top - 4));
  }

  openModal(w: number, h: number, title: string, kind = '') {
    this.modalKind = kind;
    this.closeModal(false);
    this.banner?.destroy(); // an area banner never stays over a window
    this.registry.set('modal', true);
    this.touchLayer?.setVisible(false);
    const { w: W, h: H } = VIEW;
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(0, 0, W, H, 0x101418, 0.25).setOrigin(0).setInteractive();
    c.add(dim);
    this.blurWorld(true);
    this.hideHud(true);
    const x = (W - w) / 2;
    const y = (H - h) / 2;
    this.modalBox = { top: y, bottom: y + h + 4 };
    c.add(glass(this.add.graphics(), x, y, w, h, 24, { alpha: 0.9, shadow: 28 }));
    c.add(this.add.text(W / 2, y + 20, title, txt(20)).setOrigin(0.5, 0));
    this.modalLayer = c;
    return { c, x, y };
  }

  /** Close any open window (used before the HUD is rebuilt on resize). */
  /** The open window's container (for windows that build their own rows before the buttons). */
  modalLayerOrThrow() {
    if (!this.modalLayer) throw new Error('no window open');
    return this.modalLayer;
  }

  closeAll() {
    this.closeModal(false);
  }

  closeModal(showPending = true) {
    if (!this.modalLayer) return;
    this.modalLayer.destroy();
    this.modalLayer = undefined;
    this.blurWorld(false);
    this.hideHud(false);
    this.registry.set('modal', false);
    this.touchLayer?.setVisible(true);
    this.refresh();
    if (showPending && this.pendingLevels.length) this.showLevelUp();
  }

  private hiddenHud: Phaser.GameObjects.GameObject[] = [];
  private questLabel!: Phaser.GameObjects.Text;
  private questList!: Phaser.GameObjects.Container;
  private questOpen = true;

  /** The marked requests under the quest button: who, what, how many you have, days left. */
  private refreshQuests() {
    const s = this.state;
    const marked = s.requests.filter((r) => r.marked);
    this.questLabel.setText(`Quest ${marked.length}`).setColor(C.ink);
    this.questList.removeAll(true);
    if (!this.questOpen || !marked.length) return; // nothing marked: just the button, no empty box
    const rows: { text: string; color: string; icon?: string }[] = [];
    for (const r of marked) {
      const left = r.until - s.day + 1;
      const ready = requestReady(s, r);
      rows.push({ text: `${npcById(r.npc).name} · ${left <= 1 ? 'hari ini' : `${left} hari`}${ready ? ' · siap ✓' : ''}`, color: ready ? C.green : left <= 1 ? C.red : C.ink });
      for (const it of reqItems(r)) {
        const have = Math.min(countFor(s, it), it.qty);
        rows.push({ icon: `icon-${it.id}`, text: `${produceById(it.id).name} ${have}/${it.qty}${it.minStars > 1 ? ` ★${it.minStars}+` : ''}`, color: have >= it.qty ? C.green : C.secondary });
      }
    }
    const h = 16 + rows.length * 18;
    this.questList.add(this.panel(12, 180, 210, h));
    rows.forEach((row, i) => {
      const ry = 188 + i * 18 + 8;
      if (row.icon) this.questList.add(this.add.image(36, ry, row.icon).setScale(0.9));
      this.questList.add(this.add.text(row.icon ? 48 : 24, ry, row.text, txt(11, row.color, !row.icon)).setOrigin(0, 0.5));
    });
  }

  /** While a window is open the HUD steps back so the window is the only thing in focus. */
  private hideHud(hide: boolean) {
    if (hide) {
      if (this.hiddenHud.length) return;
      const keep = new Set<unknown>([this.gloom, this.rain, this.snow, this.flash, this.toastText, this.toastBg, this.modalLayer]);
      for (const o of this.children.list) {
        const v = o as unknown as { visible?: boolean; setVisible?: (b: boolean) => void };
        if (!keep.has(o) && v.visible && v.setVisible && (o as unknown as { depth: number }).depth < 100) {
          v.setVisible(false);
          this.hiddenHud.push(o);
        }
      }
    } else {
      for (const o of this.hiddenHud) (o as unknown as { setVisible: (b: boolean) => void }).setVisible(true);
      this.hiddenHud = [];
    }
  }

  private worldBlur?: Phaser.Filters.Blur;

  /** Frosted-glass effect: blur the farm camera while a window is open. */
  private blurWorld(on: boolean) {
    const filters = this.farm.cameras.main.filters;
    if (!filters) return; // canvas renderer: no filters, the dim layer still works
    if (on && !this.worldBlur) this.worldBlur = filters.external.addBlur(1, 2, 2, 1.4);
    else if (!on && this.worldBlur) {
      filters.external.remove(this.worldBlur);
      this.worldBlur = undefined;
    }
  }

  queueLevelUp(levels: number[]) {
    this.pendingLevels.push(...levels);
    this.refresh();
    if (!this.modalLayer) this.showLevelUp();
  }

  private showLevelUp() {
    const levels = this.pendingLevels.splice(0);
    const top = levels[levels.length - 1];
    const lines = levels.flatMap((l) => unlocksAt(l));
    const h = 190 + Math.max(1, lines.length) * 22;
    const { c, x, y } = this.openModal(420, h, `Naik ke Level ${top}!`);
    play('quest');
    c.add(this.add.text(x + 210, y + 56, lines.length ? 'Sekarang terbuka:' : 'Terus bertani untuk membuka fitur baru.', txt(14, C.purple)).setOrigin(0.5, 0));
    lines.forEach((l, i) => c.add(this.add.text(x + 210, y + 86 + i * 22, l, txt(15, INK, false)).setOrigin(0.5, 0)));
    this.button(c, x + 150, y + h - 52, 'Hore!', () => this.closeModal(), 120);
  }

  button(c: Phaser.GameObjects.Container, x: number, y: number, label: string, onClick: () => void, w = 110, locked = false, quiet = false) {
    const g = this.add.graphics();
    const secondary = quiet || SECONDARY.has(label);
    const draw = (hover: boolean) => {
      g.clear();
      if (locked) g.fillStyle(0x767680, 0.12).fillRoundedRect(x, y, w, 34, 17);
      else if (secondary) g.fillStyle(0x767680, hover ? 0.2 : 0.12).fillRoundedRect(x, y, w, 34, 17);
      else {
        g.fillStyle(HEX.blue, 0.25).fillRoundedRect(x, y + 2, w, 34, 17);
        g.fillStyle(hover ? 0x0077ed : HEX.blue, 1).fillRoundedRect(x, y, w, 34, 17);
      }
    };
    draw(false);
    const t = this.add.text(x + w / 2, y + 17, label, txt(14, locked ? C.disabled : secondary ? C.ink : C.white)).setOrigin(0.5);
    const z = this.add.zone(x, y, w, 34).setOrigin(0).setInteractive({ useHandCursor: true });
    z.on('pointerover', () => draw(true));
    z.on('pointerout', () => draw(false));
    z.on('pointerdown', () => {
      unlockAudio();
      startMusic();
      play('click');
      onClick();
    });
    c.add([g, t, z]);
  }

  // ---------- inventory ----------

  private banner?: Phaser.GameObjects.Text;

  private areaBanner(name: string) {
    if (this.registry.get('modal')) return; // never over an open window
    this.banner?.destroy(); // a newer area replaces the old banner
    const t = this.add
      .text(VIEW.w / 2, 150, name, { ...txt(26, C.white), shadow: { offsetX: 0, offsetY: 2, color: 'rgba(0,0,0,0.45)', blur: 8, fill: true } })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(150);
    this.tweens.chain({
      targets: t,
      tweens: [
        { alpha: 1, y: 140, duration: 400 },
        { alpha: 1, duration: 1200 },
        { alpha: 0, y: 130, duration: 500 },
      ],
      onComplete: () => t.destroy(),
    });
    this.banner = t;
  }

  // ---------- touch controls ----------

  private touchLayer?: Phaser.GameObjects.Container;

  private buildTouchControls() {
    const { w: W, h: H } = VIEW;
    this.input.addPointer(2); // joystick and action button at the same time
    const layer = this.add.container(0, 0).setDepth(50);
    this.touchLayer = layer;

    // joystick (bottom-left)
    const jx = 120, jy = H - 120, R = 64;
    const base = this.add.circle(jx, jy, R, 0x3b2a1a, 0.28).setStrokeStyle(3, 0xfffbe6, 0.5);
    const knob = this.add.circle(jx, jy, 28, 0xfffbe6, 0.75).setStrokeStyle(3, 0x8a5a2e, 0.9);
    layer.add([base, knob]);
    let pid = -1;
    const move = (p: Phaser.Input.Pointer) => {
      const dx = p.x / UI_SCALE - jx, dy = p.y / UI_SCALE - jy;
      const d = Math.min(R, Math.hypot(dx, dy));
      const a = Math.atan2(dy, dx);
      knob.setPosition(jx + Math.cos(a) * d, jy + Math.sin(a) * d);
      this.registry.set('joy', { x: Math.cos(a), y: Math.sin(a), mag: d / R });
    };
    const release = () => {
      pid = -1;
      knob.setPosition(jx, jy);
      this.registry.set('joy', { x: 0, y: 0, mag: 0 });
    };
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.registry.get('modal')) return;
      if (Math.hypot(p.x / UI_SCALE - jx, p.y / UI_SCALE - jy) < R * 1.5) {
        pid = p.id;
        move(p);
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => p.id === pid && move(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => p.id === pid && release());

    // action button (bottom-right)
    const ax = W - 110, ay = H - 120;
    const btn = this.add.circle(ax, ay, 46, 0xe0b24a, 0.9).setStrokeStyle(4, 0x5a3a22, 1);
    const lbl = this.add.text(ax, ay, 'Aksi', txt(18)).setOrigin(0.5);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => {
      if (this.registry.get('modal')) return;
      btn.setScale(0.9);
      this.game.events.emit('touch-action');
    });
    btn.on('pointerup', () => btn.setScale(1));
    btn.on('pointerout', () => btn.setScale(1));
    layer.add([btn, lbl]);
  }

  /** Small gold "★3" badge for quality produce; null for plain (1-star) items. */
  starBadge(x: number, y: number, key: string, size: number) {
    const q = starsOf(key);
    if (q <= 1) return null;
    return this.add.text(x, y, `★${q}`, { ...txt(size, '#d99a00'), stroke: '#ffffff', strokeThickness: 3 });
  }

  // ---------- house & kitchen ----------

  // ---------- weather ----------

  private rain?: Phaser.GameObjects.Particles.ParticleEmitter;
  private snow?: Phaser.GameObjects.Particles.ParticleEmitter;
  private gloom?: Phaser.GameObjects.Rectangle;
  private flash?: Phaser.GameObjects.Rectangle;
  private lightning?: Phaser.Time.TimerEvent;
  private shownWeather = '';

  private buildWeather() {
    const { w: W, h: H } = VIEW;
    this.gloom = this.add.rectangle(0, 0, W, H, 0x24304a, 0).setOrigin(0);
    this.rain = this.add.particles(0, 0, 'raindrop', {
      x: { min: -60, max: W + 240 },
      y: -20,
      lifespan: 1100,
      speedY: { min: 560, max: 660 },
      speedX: { min: -190, max: -150 },
      rotate: 17,
      scale: { min: 1, max: 1.6 },
      quantity: 3,
      frequency: 16,
      emitting: false,
    });
    this.snow = this.add.particles(0, 0, 'snowflake', {
      x: { min: 0, max: W },
      y: -10,
      lifespan: 16000,
      speedY: { min: 14, max: 34 },
      speedX: { min: 10, max: 40 },
      scale: { min: 1, max: 2.2 },
      alpha: { min: 0.45, max: 0.85 },
      tint: [0x6a6560, 0x8a8580, 0x4f4a45],
      quantity: 1,
      frequency: 45,
      emitting: false,
    });
    this.flash = this.add.rectangle(0, 0, W, H, 0xffffff, 0).setOrigin(0);
  }

  /** Switch rain, snow, gloom and lightning to match today's weather. */
  private applyIndoors(inside: boolean) {
    for (const o of [this.rain, this.snow, this.gloom, this.flash]) o?.setVisible(!inside);
    const w = this.state.weather;
    setRain(inside ? 0 : w === 'badai' ? 2 : isWet(w) ? 1 : 0);
  }

  private applyWeather() {
    const w = this.state.weather;
    if (w === this.shownWeather) return;
    this.shownWeather = w;
    const wet = isWet(w);
    this.rain!.emitting = wet;
    this.rain!.frequency = w === 'badai' ? 8 : 16;
    this.snow!.emitting = w === 'kabut'; // drifting ash from land fires
    if (w === 'kabut') this.snow!.fastForward(9000); // start with ash already filling the screen
    if (wet) this.rain!.fastForward(1000);
    if (w === 'kabut') this.gloom!.setFillStyle(0x9a7040, 0.45); // thick brownish haze
    else this.gloom!.setFillStyle(0x24304a, w === 'badai' ? 0.3 : wet ? 0.16 : 0);
    setRain(w === 'badai' ? 2 : wet ? 1 : 0);
    if (this.registry.get('indoors')) this.applyIndoors(true); // the house keeps the weather out
    this.lightning?.remove();
    this.lightning = undefined;
    if (w === 'badai') {
      const strike = () => {
        this.flash!.setAlpha(0.6);
        this.tweens.chain({
          targets: this.flash,
          tweens: [
            { alpha: 0, duration: 90 },
            { alpha: 0.45, duration: 40 },
            { alpha: 0, duration: 220 },
          ],
        });
        this.time.delayedCall(350, () => play('thunder'));
        this.lightning = this.time.delayedCall(Phaser.Math.Between(5000, 12000), strike);
      };
      this.lightning = this.time.delayedCall(2500, strike);
    }
  }

  // ---------- clock pill & calendar ----------

  /** Compact pill at the top centre: weather, time, day. Click (or K) for the calendar. */
  private buildClock() {
    const W = VIEW.w;
    const w = 248, h = 46, x = W / 2 - w / 2;
    const y = W - 2 * 250 < w + 24 ? 132 : 10; // too narrow for three across → below the panels
    const g = this.add.graphics();
    glass(g, x, y, w, h, h / 2, { alpha: 0.76, shadow: 3, sheen: false });
    g.fillStyle(HEX.hairline, 0.1).fillRect(x + 132, y + 12, 1, h - 24);
    this.clockIcon = this.add.image(x + 30, y + h / 2, 'wx-cerah').setScale(2);
    this.timeText = this.add.text(x + 52, y + h / 2, '', txt(24, C.ink)).setOrigin(0, 0.5);
    this.clockDay = this.add.text(x + 146, y + 9, '', txt(14));
    this.clockSub = this.add.text(x + 146, y + 27, '', txt(11, INK, false));
    const z = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    z.on('pointerdown', () => {
      if (this.registry.get('modal')) return;
      play('click');
      openCalendar(this);
    });
  }

  private refreshClockPill() {
    const s = this.state;
    this.clockIcon.setTexture(`wx-${s.weather}`);
    this.clockDay.setText(`${seasonOf(s.day)} ${dayOfSeason(s.day)}`);
    const festival = isFestivalDay(s.day);
    this.clockSub
      .setText(`${WEEKDAYS[(s.day - 1) % 7]} · ${festival ? 'Festival!' : WEATHER_INFO[s.weather].name}`)
      .setColor(festival ? C.red : C.secondary);
  }

  // ---------- fish book ----------

}
