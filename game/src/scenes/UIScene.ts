import Phaser from 'phaser';
import {
  BAG_MAX_SLOTS,
  DISHES,
  XP_COOK,
  dishById,
  BAG_TIERS,
  BUYABLE_TOOLS,
  CHICKEN_PRICE,
  FEATURE_LEVEL,
  FEED_PRICE,
  FESTIVAL_MAX_ITEMS,
  FESTIVAL_THEME_MULT,
  FESTIVAL_VARIETY_BONUS,
  ITEMS,
  MAX_CHICKENS,
  STACK_MAX,
  STAMINA_MAX,
  TOOLS,
  WATER_CAN_MAX,
  XP,
  cropById,
  itemName,
  needsPurchase,
  npcById,
  produceById,
  unlocksAt,
  xpToNext,
} from '../data';
import { play, unlockAudio } from '../sfx';
import { startMusic } from '../music';
import {
  add,
  bagCapacity,
  canAdd,
  cook,
  deliverRequest,
  eat,
  enterFestival,
  festivalScore,
  festivalTheme,
  isFestivalDay,
  type FestivalResult,
  gainXp,
  dayOfSeason,
  save,
  seasonOf,
  shopStock,
  slotsUsed,
  upgradeBag,
  yearOf,
  type DayReport,
  type GameState,
} from '../state';
import type { FarmScene } from './FarmScene';

type ShopTab = 'benih' | 'alat' | 'ternak';
type InvTab = 'semua' | 'panen' | 'benih' | 'ternak';

const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';
const INK = '#3b2a1a';
const PAPER = 0xf6e7c1;
const WOOD = 0x8a5a2e;
const WOOD_DARK = 0x5a3a22;

const txt = (size: number, color = INK, bold = true): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: FONT,
  fontSize: `${size}px`,
  color,
  fontStyle: bold ? 'bold' : 'normal',
});

export class UIScene extends Phaser.Scene {
  private state!: GameState;
  private dateText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private bars!: Phaser.GameObjects.Graphics;
  private bagText!: Phaser.GameObjects.Text;
  private bagMini!: Phaser.GameObjects.Container;
  private bagTitle!: Phaser.GameObjects.Text;
  private invSel?: { bag: 'produce' | 'seeds' | 'other'; id: string };
  private slots: { frame: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; icon: Phaser.GameObjects.Image }[] = [];
  private seedIcon!: Phaser.GameObjects.Image;
  private toastText!: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;
  private modalLayer?: Phaser.GameObjects.Container;
  private pendingLevels: number[] = [];
  private modalKind = '';
  private levelText!: Phaser.GameObjects.Text;
  private lastMinute = -1;

  constructor() {
    super('ui');
  }

  private get farm() {
    return this.scene.get('farm') as FarmScene;
  }

  create() {
    this.state = this.registry.get('state');
    const { width: W, height: H } = this.scale;

    // top-left: date, time, coins, bars
    this.panel(12, 12, 250, 132);
    this.dateText = this.add.text(28, 22, '', txt(17));
    this.levelText = this.add.text(246, 23, '', txt(15, '#6b3fa0')).setOrigin(1, 0);
    this.timeText = this.add.text(28, 46, '', txt(26, '#7a3e12'));
    this.coinText = this.add.text(150, 52, '', txt(18, '#8a6a10'));
    this.bars = this.add.graphics();

    // top-right: bag
    this.panel(W - 232, 12, 220, 112);
    this.bagTitle = this.add.text(W - 216, 22, 'Tas', txt(16));
    this.add.text(W - 28, 24, '[I] buka', txt(12, '#8a7a60', false)).setOrigin(1, 0);
    this.bagMini = this.add.container(0, 0);
    this.bagText = this.add.text(W - 216, 96, '', txt(11, '#6b5030', false));
    const bagHit = this.add.zone(W - 232, 12, 220, 112).setOrigin(0).setInteractive({ useHandCursor: true });
    bagHit.on('pointerdown', () => {
      if (this.registry.get('modal')) return;
      play('click');
      this.openInventory();
    });

    // toolbar
    const slotW = 64;
    const startX = W / 2 - (TOOLS.length * (slotW + 10) - 10) / 2;
    TOOLS.forEach((t, i) => {
      const x = startX + i * (slotW + 10);
      const y = H - slotW - 14;
      const frame = this.add.graphics();
      const icon = this.add.image(x + slotW / 2, y + 26, `tool-${t.id}`).setScale(2.5);
      this.add.text(x + 5, y + 2, t.key, txt(12, '#7a5a3a'));
      const label = this.add.text(x + slotW / 2, y + slotW - 6, t.name, txt(11)).setOrigin(0.5, 1);
      const hit = this.add.zone(x, y, slotW, slotW).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        if (this.registry.get('modal')) return;
        if (t.id === 'benih' && this.state.tool === 'benih') this.cycleSeed();
        else this.farm.setTool(i);
      });
      this.slots.push({ frame, label, icon });
      if (t.id === 'benih') this.seedIcon = this.add.image(x + slotW - 12, y + 12, 'icon-lobak').setScale(1.2);
    });

    this.toastText = this.add
      .text(W / 2, H - 100, '', { ...txt(16, '#ffffff'), stroke: '#2b1a0c', strokeThickness: 4, align: 'center' })
      .setOrigin(0.5, 1)
      .setAlpha(0)
      .setDepth(200);

    const ev = this.game.events;
    const handlers: [string, (...a: never[]) => void][] = [
      ['hud', () => this.refresh()],
      ['toast', (m: string) => this.toast(m)],
      ['cycle-seed', () => this.cycleSeed()],
      ['open-shop', () => this.openShop()],
      ['open-board', () => this.openBoard()],
      ['open-festival', () => this.openFestival()],
      ['open-house', () => this.openHouse()],
      ['area', (name: string) => this.areaBanner(name)],
      ['level-up', (lv: number[]) => this.queueLevelUp(lv)],
      ['ask-sleep', () => this.askSleep()],
      ['day-report', (r: DayReport) => this.showReport(r)],
    ];
    for (const [e, h] of handlers) ev.on(e, h, this);
    this.events.once('shutdown', () => handlers.forEach(([e, h]) => ev.off(e, h, this)));

    this.input.keyboard!.on('keydown-ESC', () => this.closeModal());
    this.input.keyboard!.on('keydown-I', () => {
      if (this.modalLayer && this.modalKind === 'inventory') return this.closeModal();
      if (!this.registry.get('modal')) this.openInventory();
    });

    const touch = this.sys.game.device.input.touch || new URLSearchParams(location.search).has('touch');
    this.registry.set('touch', touch);
    if (touch) this.buildTouchControls();

    this.refresh();
    if (this.state.day === 1 && this.state.stats.harvested === 0) this.showWelcome();
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
    const g = this.add.graphics();
    g.fillStyle(WOOD_DARK, 1).fillRoundedRect(x, y + 3, w, h, 10);
    g.fillStyle(WOOD, 1).fillRoundedRect(x, y, w, h, 10);
    g.fillStyle(PAPER, 1).fillRoundedRect(x + 5, y + 5, w - 10, h - 10, 7);
    return g;
  }

  private refreshClock() {
    const s = this.state;
    const h = Math.floor(s.minutes / 60);
    const mm = Math.floor((s.minutes % 60) / 10) * 10;
    this.timeText.setText(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }

  refresh() {
    const s = this.state;
    this.dateText.setText(`Tahun ${yearOf(s.day)} · ${seasonOf(s.day)} ${dayOfSeason(s.day)}${isFestivalDay(s.day) ? ' 🎉' : ''}`);
    this.coinText.setText(`${s.coins.toLocaleString('id-ID')} G`);
    this.refreshClock();

    const g = this.bars.clear();
    const bar = (y: number, frac: number, color: number, label: string) => {
      g.fillStyle(0x5a3a22, 1).fillRoundedRect(84, y, 160, 12, 4);
      g.fillStyle(color, 1).fillRoundedRect(86, y + 2, Math.max(0, 156 * frac), 8, 3);
      this.children.getByName(label)?.destroy();
      this.add.text(28, y - 3, label, txt(13)).setName(label);
    };
    bar(84, s.stamina / STAMINA_MAX, 0xe8a33c, 'Tenaga');
    bar(102, s.water / WATER_CAN_MAX, 0x4aa3df, 'Air');
    bar(120, s.xp / xpToNext(s.level), 0x9b6bd6, 'XP');
    this.levelText.setText(`Lv ${s.level}`);

    // HUD bag: a row of mini slots plus one status line
    const W = this.scale.width;
    this.bagMini.removeAll(true);
    const used = slotsUsed(s), cap = bagCapacity(s);
    this.bagTitle.setText(`Tas ${used}/${cap}`).setColor(used >= cap ? '#c0392b' : INK);
    const produce = Object.entries(s.produce);
    if (!produce.length) this.bagMini.add(this.add.text(W - 216, 54, 'Hasil panen kosong', txt(13, '#8a7a60', false)));
    produce.slice(0, 5).forEach(([id, q], i) => {
      const sx = W - 216 + i * 38;
      const g = this.add.graphics();
      g.fillStyle(0xf3e4bd, 1).fillRoundedRect(sx, 46, 34, 34, 6);
      g.lineStyle(1.5, 0xd9c08c, 1).strokeRoundedRect(sx, 46, 34, 34, 6);
      this.bagMini.add([g, this.add.image(sx + 17, 63, `icon-${id}`).setScale(1.6), this.add.text(sx + 33, 80, `${q}`, txt(11)).setOrigin(1, 1)]);
    });
    if (produce.length > 5) this.bagMini.add(this.add.text(W - 26, 63, `+${produce.length - 5}`, txt(12, '#8a7a60')).setOrigin(1, 0.5));
    const status: string[] = [];
    const ship = Object.values(s.shipping).reduce((a, b) => a + b, 0);
    if (ship) status.push(`Kirim: ${ship}`);
    const ready = s.requests.filter((r) => (s.produce[r.crop] ?? 0) >= r.qty).length;
    if (ready) status.push(`Permintaan siap: ${ready}`);
    if (s.animals.length) status.push(`Pakan: ${s.feed}`);
    this.bagText.setText(status.join(' · '));

    TOOLS.forEach((t, i) => {
      const { frame, label, icon } = this.slots[i];
      const locked = needsPurchase(t.id) && !s.ownedTools.includes(t.id);
      icon.setTint(locked ? 0x8a8070 : 0xffffff).setAlpha(locked ? 0.45 : 1);
      label.setText(locked ? '🔒 Toko' : t.name);
      const x = this.scale.width / 2 - (TOOLS.length * 74 - 10) / 2 + i * 74;
      const y = this.scale.height - 78;
      const on = s.tool === t.id;
      frame.clear();
      frame.fillStyle(WOOD_DARK, 1).fillRoundedRect(x, y + 3, 64, 64, 9);
      frame.fillStyle(on ? 0xf2c94c : WOOD, 1).fillRoundedRect(x, y, 64, 64, 9);
      frame.fillStyle(PAPER, 1).fillRoundedRect(x + 4, y + 4, 56, 56, 7);
      if (t.id === 'benih') {
        // an empty selection jumps to something still in the bag, or shows an empty sack
        if (!s.seeds[s.seed] && Object.keys(s.seeds).length) s.seed = Object.keys(s.seeds)[0];
        const empty = !s.seeds[s.seed];
        icon.setTint(empty ? 0x8a8070 : 0xffffff).setAlpha(empty ? 0.45 : 1);
        label.setText(empty ? 'Kosong' : `${itemName(s.seed).replace('Pupuk Cepat', 'Pupuk')} ${s.seeds[s.seed]}`);
        this.seedIcon.setVisible(!empty);
        if (!empty) this.seedIcon.setTexture(`icon-${s.seed}`);
      }
    });
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
    this.toastTimer?.remove();
    this.toastTimer = this.time.delayedCall(2200, () =>
      this.tweens.add({ targets: this.toastText, alpha: 0, duration: 300 }),
    );
  }

  // ---------- modals ----------

  /** Messages sit just below an open window (or above it when there is no room), never over its buttons. */
  private modalBox?: { top: number; bottom: number };

  private placeToast() {
    const H = this.scale.height;
    const m = this.modalLayer ? this.modalBox : undefined;
    if (!m) this.toastText.setY(H - 100);
    else if (m.bottom + 30 <= H) this.toastText.setY(m.bottom + 28);
    else this.toastText.setY(Math.max(26, m.top - 4));
  }

  private openModal(w: number, h: number, title: string, kind = '') {
    this.modalKind = kind;
    this.closeModal(false);
    this.registry.set('modal', true);
    this.touchLayer?.setVisible(false);
    const { width: W, height: H } = this.scale;
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.45).setOrigin(0).setInteractive();
    c.add(dim);
    const x = (W - w) / 2;
    const y = (H - h) / 2;
    this.modalBox = { top: y, bottom: y + h + 4 };
    const bg = this.add.graphics();
    bg.fillStyle(WOOD_DARK, 1).fillRoundedRect(x, y + 4, w, h, 12);
    bg.fillStyle(WOOD, 1).fillRoundedRect(x, y, w, h, 12);
    bg.fillStyle(PAPER, 1).fillRoundedRect(x + 6, y + 6, w - 12, h - 12, 9);
    c.add(bg);
    c.add(this.add.text(W / 2, y + 18, title, txt(22)).setOrigin(0.5, 0));
    this.modalLayer = c;
    return { c, x, y };
  }

  private closeModal(showPending = true) {
    if (!this.modalLayer) return;
    this.modalLayer.destroy();
    this.modalLayer = undefined;
    this.registry.set('modal', false);
    this.touchLayer?.setVisible(true);
    this.refresh();
    if (showPending && this.pendingLevels.length) this.showLevelUp();
  }

  private queueLevelUp(levels: number[]) {
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
    c.add(this.add.text(x + 210, y + 56, lines.length ? 'Sekarang terbuka:' : 'Terus bertani untuk membuka fitur baru.', txt(15, '#6b3fa0')).setOrigin(0.5, 0));
    lines.forEach((l, i) => c.add(this.add.text(x + 210, y + 86 + i * 22, `★ ${l}`, txt(15, INK, false)).setOrigin(0.5, 0)));
    this.button(c, x + 150, y + h - 52, 'Hore!', () => this.closeModal(), 120);
  }

  private button(c: Phaser.GameObjects.Container, x: number, y: number, label: string, onClick: () => void, w = 110, locked = false) {
    const g = this.add.graphics();
    const draw = (hover: boolean) => {
      g.clear();
      g.fillStyle(WOOD_DARK, 1).fillRoundedRect(x, y + 3, w, 34, 8);
      g.fillStyle(locked ? (hover ? 0xd8cfbb : 0xcfc4ad) : hover ? 0xf2c94c : 0xe0b24a, 1).fillRoundedRect(x, y, w, 34, 8);
    };
    draw(false);
    const t = this.add.text(x + w / 2, y + 17, label, txt(15, locked ? '#7a6a55' : INK)).setOrigin(0.5);
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

  private showWelcome() {
    const { c, x, y } = this.openModal(580, 370, 'Selamat datang di CropFarm');
    const body = [
      'Kakek mewariskan ladang ini padamu. Saatnya bertani!',
      '',
      'Gerak: WASD / panah, atau klik/tap tujuan',
      'Aksi: Spasi / E, atau klik petak di dekatmu',
      'Alat: 1 Cangkul · 2 Penyiram · 3 Benih · 4 Tangan · 5 Pancing',
      'Lari: tahan Shift  ·  Tas: I  ·  Musik: N',
      'Ganti benih: Q  ·  Semua suara: M  ·  Tutup jendela: Esc',
      '',
      'Cangkul → tanam → siram setiap hari → panen.',
      'Kirim panen di kotak kayu, tidur di pintu rumah.',
      'Cek papan permintaan warga untuk hadiah ekstra.',
    ];
    c.add(this.add.text(x + 34, y + 62, body.join('\n'), { ...txt(15, INK, false), lineSpacing: 4 }));
    this.button(c, x + 580 / 2 - 60, y + 370 - 52, 'Mulai', () => this.closeModal(), 120);
  }

  private askSleep() {
    const { c, x, y } = this.openModal(380, 170, 'Tidur dan akhiri hari?');
    c.add(this.add.text(x + 190, y + 62, 'Tanaman yang disiram akan tumbuh.', txt(14, INK, false)).setOrigin(0.5, 0));
    this.button(c, x + 60, y + 108, 'Tidur', () => {
      this.closeModal();
      this.game.events.emit('do-sleep');
    });
    this.button(c, x + 210, y + 108, 'Belum', () => this.closeModal());
  }

  private showReport(r: DayReport) {
    const s = this.state;
    this.refresh();
    const lines: string[] = [];
    if (r.sold.length) {
      for (const it of r.sold) lines.push(`${it.name} ×${it.qty}  →  ${it.total} G`);
      lines.push('', `Total pendapatan: ${r.income} G`);
    } else lines.push('Tidak ada kiriman kemarin.');
    lines.push('', `${r.grown} tanaman tumbuh semalam.`);
    if (r.withered) lines.push(`${r.withered} tanaman layu karena ganti musim.`);
    if (isFestivalDay(s.day)) lines.push(`🎉 Hari ini Festival! Tema ${festivalTheme(s.day).name} ×2, 09:00–18:00.`);
    else if (isFestivalDay(s.day + 1)) lines.push(`Besok festival. Siapkan ${festivalTheme(s.day + 1).name}!`);
    if (r.eggs) lines.push(`Ayam bertelur ${r.eggs} butir. Ambil di kandang.`);
    if (r.hungry) lines.push(`${r.hungry} ayam kelaparan semalam (keakraban turun).`);
    if (r.sprinkled) lines.push(`Sprinkler menyiram ${r.sprinkled} petak pagi ini.`);
    const h = 170 + lines.length * 20;
    const { c, x, y } = this.openModal(420, h, `${seasonOf(s.day)} ${dayOfSeason(s.day)} · Pagi`);
    c.add(this.add.text(x + 36, y + 62, lines.join('\n'), { ...txt(15, INK, false), lineSpacing: 2 }));
    this.button(c, x + 150, y + h - 54, 'Lanjut', () => this.closeModal(), 120);
  }

  private shopTab: ShopTab = 'benih';

  private openShop() {
    const s = this.state;
    type Entry = { id: string; name: string; price: number; level: number; info: string; owned: () => string; buy: (n: number) => string | null; unique?: () => boolean };
    const bag = (id: string) => (n: number) => {
      if (!canAdd(s, 'seeds', id, n)) return 'Tas penuh! Upgrade tas atau kosongkan slot.';
      add(s.seeds, id, n);
      if (!s.seeds[s.seed]) s.seed = id;
      return null;
    };
    const tabs: { id: ShopTab; name: string; items: Entry[] }[] = [
      {
        id: 'benih',
        name: 'Benih',
        items: shopStock(s).map((d) => ({
          id: d.id, name: d.name, price: d.seedPrice, level: d.level,
          info: `${d.days} hari · jual ${d.sellPrice}`,
          owned: () => `${s.seeds[d.id] ?? 0}`,
          buy: bag(d.id),
        })),
      },
      {
        id: 'alat',
        name: 'Peralatan',
        items: [
          ...(() => {
            const next = BAG_TIERS[s.bagTier + 1];
            const top = BAG_TIERS[s.bagTier];
            return [
              {
                id: 'tas',
                name: next ? next.name : top.name,
                price: next ? next.price : 0,
                level: next ? next.level : 1,
                info: next ? `tas ${top.slots} → ${next.slots} slot` : `${top.slots} slot (maksimal)`,
                owned: () => '',
                unique: () => !BAG_TIERS[s.bagTier + 1],
                buy: () => {
                  if (!BAG_TIERS[s.bagTier + 1]) return 'Tas sudah paling besar.';
                  s.bagTier++;
                  this.toast(`Tas sekarang ${bagCapacity(s)} slot!`);
                  return null;
                },
              },
            ];
          })(),
          ...BUYABLE_TOOLS.map((t) => ({
            id: t.id, name: t.name, price: t.price, level: t.level, info: t.desc,
            owned: () => '',
            unique: () => s.ownedTools.includes(t.id),
            buy: () => {
              if (s.ownedTools.includes(t.id)) return `Kamu sudah punya ${t.name}.`;
              s.ownedTools.push(t.id);
              this.toast(`${t.name} terpasang di slot ${TOOLS.findIndex((x) => x.id === t.id) + 1}.`);
              return null;
            },
          })),
          ...ITEMS.map((i) => ({
            id: i.id, name: i.name, price: i.price, level: i.level, info: i.desc,
            owned: () => `${s.seeds[i.id] ?? 0}`,
            buy: bag(i.id),
          })),
        ],
      },
      {
        id: 'ternak',
        name: 'Ternak',
        items: [
          {
            id: 'ayam', name: 'Ayam', price: CHICKEN_PRICE, level: FEATURE_LEVEL.coop, info: 'bertelur tiap hari',
            owned: () => `${s.animals.length}/${MAX_CHICKENS}`,
            buy: (n) => {
              if (s.animals.length + n > MAX_CHICKENS) return `Kandang muat ${MAX_CHICKENS} ayam.`;
              for (let i = 0; i < n; i++) {
                const id = s.nextAnimalId++;
                s.animals.push({ id, name: `Ayam ${id}`, affection: 0, fed: false, petted: false });
              }
              this.game.events.emit('animals-changed');
              return null;
            },
          },
          {
            id: 'pakan', name: 'Pakan', price: FEED_PRICE, level: FEATURE_LEVEL.coop, info: '1 per ayam per hari',
            owned: () => `${s.feed}`,
            buy: (n) => {
              s.feed += n;
              return null;
            },
          },
        ],
      },
    ];
    const tab = tabs.find((t) => t.id === this.shopTab)!;

    const W = 620, H = 360;
    const { c, x, y } = this.openModal(W, H, `Toko · musim ${seasonOf(s.day)}`);
    const coin = this.add.text(x + W - 28, y + 24, '', txt(16, '#8a6a10')).setOrigin(1, 0);
    c.add(coin);

    // tabs
    tabs.forEach((t, i) => {
      const tx = x + 28 + i * 124;
      const on = t.id === this.shopTab;
      const g = this.add.graphics();
      g.fillStyle(on ? WOOD : 0xe6d3a6, 1).fillRoundedRect(tx, y + 56, 116, 30, { tl: 8, tr: 8, bl: 0, br: 0 });
      c.add(g);
      c.add(this.add.text(tx + 58, y + 71, t.name, txt(14, on ? '#fff6dc' : '#6b5030')).setOrigin(0.5));
      const z = this.add.zone(tx, y + 56, 116, 30).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => {
        play('click');
        this.shopTab = t.id;
        this.openShop();
      });
      c.add(z);
    });
    const shelf = this.add.graphics();
    shelf.fillStyle(WOOD, 1).fillRect(x + 28, y + 86, W - 56, 3);
    c.add(shelf);

    // card grid
    const cols = 4, cw = 134, ch = 176, gap = 10;
    const gx = x + (W - (cols * cw + (cols - 1) * gap)) / 2;
    const refresh: (() => void)[] = [() => coin.setText(`${s.coins} G`), () => this.refresh()];
    if (!tab.items.length) c.add(this.add.text(x + W / 2, y + 170, 'Tidak ada benih untuk musim ini.', txt(15, INK, false)).setOrigin(0.5));
    tab.items.forEach((it, i) => {
      const cx = gx + (i % cols) * (cw + gap);
      const cy = y + 100;
      const locked = it.level > s.level;
      const g = this.add.graphics();
      g.fillStyle(WOOD_DARK, 1).fillRoundedRect(cx, cy + 3, cw, ch, 9);
      g.fillStyle(locked ? 0xe2dccd : 0xfffaea, 1).fillRoundedRect(cx, cy, cw, ch, 9);
      g.lineStyle(2, locked ? 0xb9ad94 : 0xd9c08c, 1).strokeRoundedRect(cx, cy, cw, ch, 9);
      g.fillStyle(locked ? 0xd2c9b4 : 0xf3e4bd, 1).fillCircle(cx + cw / 2, cy + 36, 26);
      c.add(g);
      const icon = this.add.image(cx + cw / 2, cy + 36, `icon-${it.id}`).setScale(3);
      if (locked) icon.setTint(0x8a8070).setAlpha(0.6);
      c.add(icon);
      c.add(this.add.text(cx + cw / 2, cy + 70, it.name, txt(15, locked ? '#7a6a55' : INK)).setOrigin(0.5, 0));
      c.add(this.add.text(cx + cw / 2, cy + 90, it.info, { ...txt(11, '#6b5030', false), align: 'center', wordWrap: { width: cw - 12 } }).setOrigin(0.5, 0));
      if (locked) {
        c.add(this.add.text(cx + cw / 2, cy + 130, `🔒 Level ${it.level}`, txt(14, '#7a6a55')).setOrigin(0.5));
        const z = this.add.zone(cx, cy, cw, ch).setOrigin(0).setInteractive();
        z.on('pointerdown', () => {
          play('error');
          this.toast(`${it.name} terbuka di Level ${it.level}.`);
        });
        c.add(z);
        return;
      }
      const owned = this.add.text(cx + cw - 8, cy + 6, '', txt(11, '#6b5030')).setOrigin(1, 0);
      c.add(owned);
      refresh.push(() => owned.setText(it.owned() ? `punya ${it.owned()}` : ''));
      c.add(this.add.text(cx + cw / 2, cy + 118, `${it.price} G`, txt(14, '#8a6a10')).setOrigin(0.5, 0));
      const buttons: [number, number, number][] = it.unique ? [[1, 8, cw - 16]] : [[1, 8, cw / 2 - 10], [5, cw / 2 + 2, cw / 2 - 10]];
      for (const [n, bx, bw] of buttons) {
        const have = it.unique?.() ?? false;
        const label = it.unique ? (have ? 'Sudah punya' : 'Beli') : `+${n}`;
        this.button(c, cx + bx, cy + ch - 40, label, () => {
          const cost = it.price * n;
          if (s.coins < cost) {
            play('error');
            return this.toast(`Uang tidak cukup (butuh ${cost} G).`);
          }
          const err = it.buy(n);
          if (err) {
            play('error');
            return this.toast(err);
          }
          s.coins -= cost;
          play('coin');
          save(s);
          refresh.forEach((f) => f());
          if (it.unique) this.openShop(); // redraw the card as owned
        }, bw, have);
      }
    });
    refresh.forEach((f) => f());
    this.button(c, x + W / 2 - 60, y + H - 50 + 6, 'Tutup', () => this.closeModal(), 120);
  }

  private openBoard() {
    const s = this.state;
    const cardH = 74;
    const h = 120 + Math.max(1, s.requests.length) * (cardH + 10);
    const { c, x, y } = this.openModal(600, h, 'Papan Permintaan Warga');
    if (!s.requests.length) {
      c.add(this.add.text(x + 300, y + 74, 'Belum ada permintaan. Cek lagi besok pagi.', txt(15, INK, false)).setOrigin(0.5, 0));
    }
    s.requests.forEach((r, i) => {
      const cy = y + 60 + i * (cardH + 10);
      const npc = npcById(r.npc);
      const crop = cropById(r.crop);
      const have = s.produce[r.crop] ?? 0;
      const ok = have >= r.qty;
      const left = r.until - s.day + 1;
      const g = this.add.graphics();
      g.fillStyle(ok ? 0xe4f2c9 : 0xfbf3dc, 1).fillRoundedRect(x + 24, cy, 552, cardH, 8);
      g.lineStyle(2, ok ? 0x6aa84f : 0xd9c08c, 1).strokeRoundedRect(x + 24, cy, 552, cardH, 8);
      c.add(g);
      c.add(this.add.image(x + 58, cy + 37, `icon-${crop.id}`).setScale(2.5));
      const hearts = '♥'.repeat(Math.min(5, s.friendship[r.npc] ?? 0)) + '♡'.repeat(Math.max(0, 5 - (s.friendship[r.npc] ?? 0)));
      c.add(this.add.text(x + 92, cy + 8, `${npc.name}`, txt(16)));
      c.add(this.add.text(x + 92 + npc.name.length * 9 + 10, cy + 10, hearts, txt(13, '#d9503f')));
      c.add(this.add.text(x + 92, cy + 30, `Butuh ${r.qty} ${crop.name} (punya ${have})`, txt(14, INK, false)));
      c.add(this.add.text(x + 92, cy + 50, `Hadiah ${r.reward} G · sisa ${left} hari · ${npc.role}`, txt(12, '#6b5030', false)));
      this.button(c, x + 440, cy + 20, ok ? 'Serahkan' : 'Belum cukup', () => {
        if (!deliverRequest(s, r.id)) {
          play('error');
          return this.toast(`Kurang ${r.qty - (s.produce[r.crop] ?? 0)} ${crop.name}.`);
        }
        play('quest');
        const reached = gainXp(s, XP.request);
        save(s);
        this.toast(`${npc.name} senang! +${r.reward} G · +${XP.request} XP`);
        this.openBoard();
        if (reached.length) this.queueLevelUp(reached);
      }, 120, !ok);
    });
    this.button(c, x + 240, y + h - 50, 'Tutup', () => this.closeModal(), 120);
  }

  private festivalPick: string[] = [];

  private openFestival() {
    const s = this.state;
    const theme = festivalTheme(s.day);
    const W = 600, H = 400;
    const { c, x, y } = this.openModal(W, H, `Festival Panen · tema ${theme.name} ×${FESTIVAL_THEME_MULT}`);
    // keep the selection valid against what is actually in the bag
    const left = { ...s.produce };
    this.festivalPick = this.festivalPick.filter((id) => (left[id] ?? 0) > 0 && (left[id]--, true));

    c.add(this.add.text(x + W / 2, y + 52, `Pilih sampai ${FESTIVAL_MAX_ITEMS} hasil panen. ${theme.name} dihitung ×${FESTIVAL_THEME_MULT}, +${FESTIVAL_VARIETY_BONUS} per jenis berbeda.`, txt(13, '#6b5030', false)).setOrigin(0.5, 0));

    // entry slots
    for (let i = 0; i < FESTIVAL_MAX_ITEMS; i++) {
      const sx = x + W / 2 - (FESTIVAL_MAX_ITEMS * 64 - 10) / 2 + i * 64;
      const sy = y + 84;
      const g = this.add.graphics();
      g.fillStyle(0xf3e4bd, 1).fillRoundedRect(sx, sy, 54, 54, 8);
      g.lineStyle(2, 0xd9c08c, 1).strokeRoundedRect(sx, sy, 54, 54, 8);
      c.add(g);
      const id = this.festivalPick[i];
      if (!id) continue;
      c.add(this.add.image(sx + 27, sy + 27, `icon-${id}`).setScale(2.5));
      if (id === theme.id) c.add(this.add.text(sx + 50, sy + 4, '×2', txt(11, '#c0392b')).setOrigin(1, 0));
      const z = this.add.zone(sx, sy, 54, 54).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => {
        play('click');
        this.festivalPick.splice(i, 1);
        this.openFestival();
      });
      c.add(z);
    }
    const score = festivalScore(this.festivalPick, theme.id);
    c.add(this.add.text(x + W / 2, y + 150, `Skor kamu: ${score}`, txt(18, '#6b3fa0')).setOrigin(0.5, 0));

    // produce to choose from
    c.add(this.add.text(x + 32, y + 184, 'Tas kamu (klik untuk menambah):', txt(13)));
    const avail = Object.entries(s.produce)
      .map(([id, q]) => [id, q - this.festivalPick.filter((p) => p === id).length] as const)
      .filter(([, q]) => q > 0);
    if (!avail.length && !this.festivalPick.length)
      c.add(this.add.text(x + W / 2, y + 240, 'Belum ada hasil panen. Panen dulu, lalu kembali sebelum 18:00.', txt(14, INK, false)).setOrigin(0.5, 0));
    avail.forEach(([id, q], i) => {
      const cx = x + 32 + (i % 8) * 68;
      const cy = y + 206 + Math.floor(i / 8) * 64;
      const g = this.add.graphics();
      g.fillStyle(id === theme.id ? 0xfde7c2 : 0xfffaea, 1).fillRoundedRect(cx, cy, 60, 56, 8);
      g.lineStyle(2, id === theme.id ? 0xe88a2d : 0xd9c08c, 1).strokeRoundedRect(cx, cy, 60, 56, 8);
      c.add(g);
      c.add(this.add.image(cx + 30, cy + 24, `icon-${id}`).setScale(2.2));
      c.add(this.add.text(cx + 56, cy + 52, `${q}`, txt(12)).setOrigin(1, 1));
      const z = this.add.zone(cx, cy, 60, 56).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => {
        if (this.festivalPick.length >= FESTIVAL_MAX_ITEMS) {
          play('error');
          return this.toast(`Maksimal ${FESTIVAL_MAX_ITEMS} barang.`);
        }
        play('click');
        this.festivalPick.push(id);
        this.openFestival();
      });
      c.add(z);
    });

    const ready = this.festivalPick.length > 0;
    this.button(c, x + W / 2 - 130, y + H - 52, 'Ikut Lomba', () => {
      if (!ready) {
        play('error');
        return this.toast('Pilih minimal 1 hasil panen.');
      }
      const result = enterFestival(s, this.festivalPick);
      this.festivalPick = [];
      save(s);
      this.showFestivalResult(result);
    }, 130, !ready);
    this.button(c, x + W / 2 + 10, y + H - 52, 'Nanti', () => this.closeModal(), 120);
  }

  private showFestivalResult(r: FestivalResult) {
    const s = this.state;
    const title = r.place === 0 ? 'Juara 1! 🏆' : r.place < 3 ? `Juara ${r.place + 1}!` : `Peringkat ${r.place + 1}`;
    const h = 210 + r.ranking.length * 24 + 60;
    const { c, x, y } = this.openModal(420, h, title);
    play(r.place < 3 ? 'quest' : 'click');
    r.ranking.forEach((e, i) => {
      const ry = y + 60 + i * 24;
      const col = e.you ? '#6b3fa0' : INK;
      c.add(this.add.text(x + 60, ry, `${i + 1}. ${e.name}`, txt(15, col, e.you)));
      c.add(this.add.text(x + 360, ry, `${e.score}`, txt(15, col, e.you)).setOrigin(1, 0));
    });
    const rewards = [
      r.reward.coins ? `+${r.reward.coins} G` : '',
      `+${r.reward.xp} XP`,
      r.reward.points ? `+${r.reward.points} Poin Festival` : '',
      r.reward.trophy ? `Piala ${r.reward.trophy}` : '',
    ].filter(Boolean);
    const ry = y + 60 + r.ranking.length * 24 + 14;
    c.add(this.add.text(x + 210, ry, rewards.join(' · '), txt(15, '#8a6a10')).setOrigin(0.5, 0));
    c.add(this.add.text(x + 210, ry + 26, `Total Poin Festival: ${s.festival.points}`, txt(13, '#6b5030', false)).setOrigin(0.5, 0));
    c.add(this.add.text(x + 210, ry + 46, 'Poin ini nanti menentukan bagian pool hadiah.', txt(12, '#8a7a60', false)).setOrigin(0.5, 0));
    this.button(c, x + 150, y + h - 52, 'Mantap!', () => this.closeModal(), 120);
    if (r.levels.length) this.queueLevelUp(r.levels);
  }

  // ---------- inventory ----------

  private invTab: InvTab = 'semua';

  private openInventory() {
    const s = this.state;
    const W = 700, H = 480;
    const cap = bagCapacity(s);
    const used = slotsUsed(s);
    const { c, x, y } = this.openModal(W, H, `Tas · ${BAG_TIERS[s.bagTier].name}`, 'inventory');
    const full = used >= cap;
    c.add(this.add.text(x + W - 28, y + 24, `${used}/${cap} slot`, txt(15, full ? '#c0392b' : '#6b5030')).setOrigin(1, 0));

    type Slot = { bag: 'produce' | 'seeds' | 'other'; id: string; icon: string; qty: number | string };
    // one slot per stack of up to STACK_MAX
    const stacksOf = (bag: 'produce' | 'seeds', rec: Record<string, number>) =>
      Object.entries(rec).flatMap(([id, q]) => {
        const out: Slot[] = [];
        for (let left = q; left > 0; left -= STACK_MAX) out.push({ bag, id, icon: `icon-${id}`, qty: Math.min(STACK_MAX, left) });
        return out;
      });
    const produce = stacksOf('produce', s.produce);
    const seeds = stacksOf('seeds', s.seeds);
    const eggs = Object.values(s.coopEggs).reduce((a, b) => a + b, 0);
    const livestock: Slot[] =
      s.level >= FEATURE_LEVEL.coop
        ? [
            { bag: 'other', id: 'ayam', icon: 'icon-ayam', qty: `${s.animals.length}/${MAX_CHICKENS}` },
            { bag: 'other', id: 'pakan', icon: 'icon-pakan', qty: s.feed },
            ...(eggs ? [{ bag: 'other' as const, id: 'kandang', icon: 'icon-telur', qty: eggs }] : []),
          ]
        : [];

    // tabs
    const tabs: { id: InvTab; name: string }[] = [
      { id: 'semua', name: 'Semua' },
      { id: 'panen', name: 'Hasil Panen' },
      { id: 'benih', name: 'Benih & Alat' },
      ...(livestock.length ? [{ id: 'ternak' as const, name: 'Ternak' }] : []),
    ];
    if (!tabs.some((t) => t.id === this.invTab)) this.invTab = 'semua';
    tabs.forEach((t, i) => {
      const tx = x + 24 + i * 112;
      const on = t.id === this.invTab;
      const g = this.add.graphics();
      g.fillStyle(on ? WOOD : 0xe6d3a6, 1).fillRoundedRect(tx, y + 54, 106, 28, { tl: 8, tr: 8, bl: 0, br: 0 });
      c.add(g);
      c.add(this.add.text(tx + 53, y + 68, t.name, txt(13, on ? '#fff6dc' : '#6b5030')).setOrigin(0.5));
      const z = this.add.zone(tx, y + 54, 106, 28).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => {
        play('click');
        this.invTab = t.id;
        this.openInventory();
      });
      c.add(z);
    });
    const rule = this.add.graphics();
    rule.fillStyle(WOOD, 1).fillRect(x + 24, y + 82, W - 48, 3);
    c.add(rule);

    // which slots to draw: "Semua" shows the whole bag, including empty and locked slots
    type Cell = Slot | 'empty' | 'locked';
    let cells: Cell[];
    if (this.invTab === 'semua') {
      const items: Cell[] = [...produce, ...seeds];
      cells = [...items];
      for (let i = items.length; i < BAG_MAX_SLOTS; i++) cells.push(i < cap ? 'empty' : 'locked');
    } else cells = this.invTab === 'panen' ? produce : this.invTab === 'benih' ? seeds : livestock;

    const all = [...produce, ...seeds, ...livestock];
    if (!this.invSel || !all.some((sl) => sl.bag === this.invSel!.bag && sl.id === this.invSel!.id)) {
      const first = cells.find((cl): cl is Slot => typeof cl !== 'string');
      this.invSel = first ? { bag: first.bag, id: first.id } : undefined;
    }

    const SZ = 50, GAP = 8, COLS = 6;
    const gx = x + 28, gy = y + 98;
    if (!cells.length) c.add(this.add.text(gx, gy + 6, 'Kosong.', txt(14, '#8a7a60', false)));
    cells.forEach((cl, i) => {
      const sx = gx + (i % COLS) * (SZ + GAP);
      const sy = gy + Math.floor(i / COLS) * (SZ + GAP);
      const g = this.add.graphics();
      c.add(g);
      if (cl === 'locked') {
        g.fillStyle(0xd6ccb5, 1).fillRoundedRect(sx, sy, SZ, SZ, 8);
        g.lineStyle(1.5, 0xbfb398, 1).strokeRoundedRect(sx, sy, SZ, SZ, 8);
        c.add(this.add.text(sx + SZ / 2, sy + SZ / 2, '🔒', txt(16, '#8a7a60', false)).setOrigin(0.5).setAlpha(0.6));
        return;
      }
      if (cl === 'empty') {
        g.fillStyle(0xf8edd2, 1).fillRoundedRect(sx, sy, SZ, SZ, 8);
        g.lineStyle(1.5, 0xe2d2ab, 1).strokeRoundedRect(sx, sy, SZ, SZ, 8);
        return;
      }
      const on = this.invSel?.bag === cl.bag && this.invSel.id === cl.id;
      const active = cl.bag === 'seeds' && s.seed === cl.id;
      g.fillStyle(WOOD_DARK, 1).fillRoundedRect(sx, sy + 2, SZ, SZ, 8);
      g.fillStyle(on ? 0xfff3c4 : 0xf3e4bd, 1).fillRoundedRect(sx, sy, SZ, SZ, 8);
      g.lineStyle(on ? 3 : 1.5, on ? 0xe0a030 : 0xd9c08c, 1).strokeRoundedRect(sx, sy, SZ, SZ, 8);
      c.add(this.add.image(sx + SZ / 2, sy + SZ / 2 - 2, cl.icon).setScale(2.2));
      c.add(this.add.text(sx + SZ - 4, sy + SZ - 2, `${cl.qty}`, { ...txt(12), stroke: '#fffaea', strokeThickness: 3 }).setOrigin(1, 1));
      if (active) c.add(this.add.text(sx + 4, sy + 2, '★', txt(12, '#c0392b')));
      const z = this.add.zone(sx, sy, SZ, SZ).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => {
        play('click');
        this.invSel = { bag: cl.bag, id: cl.id };
        this.openInventory();
      });
      c.add(z);
    });

    // right: detail card
    const dx = x + W - 250, dy = y + 98, dw = 222, dh = 284;
    const g = this.add.graphics();
    g.fillStyle(0xfffaea, 1).fillRoundedRect(dx, dy, dw, dh, 10);
    g.lineStyle(2, 0xd9c08c, 1).strokeRoundedRect(dx, dy, dw, dh, 10);
    g.fillStyle(0xf3e4bd, 1).fillCircle(dx + dw / 2, dy + 50, 36);
    c.add(g);
    const sel = this.invSel;
    if (!sel) {
      c.add(this.add.text(dx + dw / 2, dy + 130, 'Pilih slot untuk\nmelihat detail', { ...txt(14, '#8a7a60', false), align: 'center' }).setOrigin(0.5));
    } else {
      const d = this.describe(sel.bag, sel.id);
      c.add(this.add.image(dx + dw / 2, dy + 50, d.icon).setScale(4));
      c.add(this.add.text(dx + dw / 2, dy + 94, d.name, txt(17)).setOrigin(0.5, 0));
      c.add(this.add.text(dx + 14, dy + 122, d.lines.join('\n'), { ...txt(13, INK, false), lineSpacing: 4, wordWrap: { width: dw - 28 } }));
      const dish = sel.bag === 'produce' ? dishById(sel.id) : undefined;
      if (dish) {
        this.button(c, dx + 22, dy + dh - 48, `Makan (+${dish.stamina} tenaga)`, () => {
          const err = eat(s, dish.id);
          if (err) {
            play('error');
            return this.toast(err);
          }
          play('plant');
          save(s);
          this.toast(`Nyam! ${dish.name}, tenaga ${s.stamina}/${STAMINA_MAX}.`);
          this.openInventory();
        }, dw - 44, s.stamina >= STAMINA_MAX);
      }
      if (sel.bag === 'seeds') {
        const active = s.seed === sel.id;
        this.button(c, dx + 22, dy + dh - 48, active ? 'Sedang dipakai' : 'Pakai (slot 3)', () => {
          s.seed = sel.id;
          s.tool = 'benih';
          save(s);
          this.toast(`Slot 3: ${itemName(sel.id)}`);
          this.openInventory();
        }, dw - 44, active);
      }
    }

    // footer: wallet, collection, upgrade
    const value = Object.entries(s.produce).reduce((a, [id, q]) => a + produceById(id).sellPrice * q, 0);
    const t = s.festival.trophies;
    const fy = y + 386;
    const fg = this.add.graphics();
    fg.fillStyle(0xf3e4bd, 1).fillRoundedRect(x + 24, fy, W - 48, 30, 8);
    c.add(fg);
    const footer = [
      `${s.coins.toLocaleString('id-ID')} G`,
      `Nilai panen ${value.toLocaleString('id-ID')} G`,
      `Poin Festival ${s.festival.points}`,
      `Piala 🥇${t.emas ?? 0} 🥈${t.perak ?? 0} 🥉${t.perunggu ?? 0}`,
    ].join('   ·   ');
    c.add(this.add.text(x + W / 2, fy + 15, footer, txt(13, '#6b5030')).setOrigin(0.5));

    const next = BAG_TIERS[s.bagTier + 1];
    const by = y + H - 52;
    if (next) {
      const blocked = s.level < next.level || s.coins < next.price;
      const label = s.level < next.level ? `🔒 ${next.name} · Level ${next.level}` : `Upgrade → ${next.slots} slot · ${next.price.toLocaleString('id-ID')} G`;
      this.button(c, x + 24, by, label, () => {
        const err = upgradeBag(s);
        if (err) {
          play('error');
          return this.toast(err);
        }
        play('quest');
        save(s);
        this.toast(`${BAG_TIERS[s.bagTier].name}! Tas sekarang ${bagCapacity(s)} slot.`);
        this.openInventory();
      }, 300, blocked);
    } else c.add(this.add.text(x + 24, by + 10, 'Tas sudah ukuran maksimal.', txt(13, '#6b5030', false)));
    this.button(c, x + W - 144, by, 'Tutup', () => this.closeModal(), 120);
  }

  /** Display info for an inventory entry. */
  private describe(bag: 'produce' | 'seeds' | 'other', id: string): { name: string; icon: string; lines: string[] } {
    const s = this.state;
    if (bag === 'other') {
      if (id === 'ayam') {
        const lines = s.animals.length
          ? s.animals.map((a) => `${a.name}: ♥${a.affection}${a.fed ? ' · sudah makan' : ' · lapar'}`)
          : ['Belum punya ayam.'];
        return { name: 'Ayam', icon: 'icon-ayam', lines };
      }
      if (id === 'pakan') return { name: 'Pakan', icon: 'icon-pakan', lines: [`Punya ${s.feed}.`, '1 pakan per ayam per hari.', 'Beri di kandang.'] };
      const eggs = Object.entries(s.coopEggs).map(([e, q]) => `${produceById(e).name} ×${q}`);
      return { name: 'Telur di kandang', icon: 'icon-telur', lines: [...eggs, 'Ambil di kandang.'] };
    }
    if (bag === 'produce') {
      const p = produceById(id);
      const qty = s.produce[id] ?? 0;
      const lines = [`Jumlah: ${qty}`, `Jual: ${p.sellPrice} G / buah`, `Total: ${(p.sellPrice * qty).toLocaleString('id-ID')} G`];
      const dishInfo = dishById(id);
      if (dishInfo) lines.push(`Makan: +${dishInfo.stamina} tenaga`);
      const want = s.requests.filter((r) => r.crop === id);
      if (want.length) lines.push(`Diminta: ${want.map((r) => `${npcById(r.npc).name} (${r.qty})`).join(', ')}`);
      if (isFestivalDay(s.day) && festivalTheme(s.day).id === id) lines.push('Tema festival hari ini ×2!');
      return { name: p.name, icon: `icon-${id}`, lines };
    }
    const item = ITEMS.find((i) => i.id === id);
    if (item) return { name: item.name, icon: `icon-${id}`, lines: [`Jumlah: ${s.seeds[id] ?? 0}`, `${item.desc[0].toUpperCase()}${item.desc.slice(1)}.`] };
    const crop = cropById(id);
    const inSeason = crop.seasons.includes(seasonOf(s.day));
    return {
      name: `Benih ${crop.name}`,
      icon: `icon-${id}`,
      lines: [
        `Jumlah: ${s.seeds[id] ?? 0}`,
        `Musim: ${crop.seasons.join(', ')}${inSeason ? '' : ' (bukan musimnya!)'}`,
        `Panen setelah ${crop.days} hari disiram`,
        `Hasil dijual ${crop.sellPrice} G`,
      ],
    };
  }

  private banner?: Phaser.GameObjects.Text;

  private areaBanner(name: string) {
    this.banner?.destroy(); // a newer area replaces the old banner
    const t = this.add
      .text(this.scale.width / 2, 150, name, { ...txt(26, '#fffbe6'), stroke: '#3b2a1a', strokeThickness: 6 })
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
    const { width: W, height: H } = this.scale;
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
      const dx = p.x - jx, dy = p.y - jy;
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
      if (Math.hypot(p.x - jx, p.y - jy) < R * 1.5) {
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

  // ---------- house & kitchen ----------

  private openHouse() {
    const { c, x, y } = this.openModal(380, 190, 'Rumah');
    c.add(this.add.text(x + 190, y + 56, 'Mau apa di rumah?', txt(14, INK, false)).setOrigin(0.5, 0));
    this.button(c, x + 24, y + 96, 'Tidur', () => this.askSleep(), 100);
    this.button(c, x + 140, y + 96, 'Dapur', () => this.openKitchen(), 100);
    this.button(c, x + 256, y + 96, 'Batal', () => this.closeModal(), 100);
  }

  private openKitchen() {
    const s = this.state;
    const W = 700, H = 490;
    const { c, x, y } = this.openModal(W, H, 'Dapur');
    c.add(this.add.text(x + W - 28, y + 24, `Tenaga ${s.stamina}/${STAMINA_MAX}`, txt(14, '#6b5030')).setOrigin(1, 0));
    const cw = 212, ch = 118, gap = 10;
    DISHES.forEach((d, i) => {
      const cx = x + 20 + (i % 3) * (cw + gap);
      const cy = y + 58 + Math.floor(i / 3) * (ch + 8);
      const ready = Object.entries(d.ingredients).every(([id, n]) => (s.produce[id] ?? 0) >= n);
      const g = this.add.graphics();
      g.fillStyle(WOOD_DARK, 1).fillRoundedRect(cx, cy + 2, cw, ch, 9);
      g.fillStyle(ready ? 0xfffaea : 0xf3ead6, 1).fillRoundedRect(cx, cy, cw, ch, 9);
      g.lineStyle(2, ready ? 0x6aa84f : 0xd9c08c, 1).strokeRoundedRect(cx, cy, cw, ch, 9);
      g.fillStyle(0xf3e4bd, 1).fillCircle(cx + 32, cy + 38, 24);
      c.add(g);
      c.add(this.add.image(cx + 32, cy + 38, `icon-${d.id}`).setScale(2.4));
      c.add(this.add.text(cx + 62, cy + 8, d.name, txt(14)));
      Object.entries(d.ingredients).forEach(([id, n], j) => {
        const have = s.produce[id] ?? 0;
        c.add(
          this.add.text(cx + 62, cy + 28 + j * 15, `${produceById(id).name} ${Math.min(have, n)}/${n}`, txt(12, have >= n ? '#3a7a36' : '#c0392b', false)),
        );
      });
      c.add(this.add.text(cx + 12, cy + ch - 26, `${d.sellPrice} G · +${d.stamina}⚡`, txt(12, '#8a6a10')));
      this.button(c, cx + cw - 96, cy + ch - 42, 'Masak', () => {
        const err = cook(s, d.id);
        if (err) {
          play('error');
          return this.toast(err);
        }
        play('harvest');
        const reached = gainXp(s, XP_COOK);
        save(s);
        this.toast(`${d.name} jadi! +${XP_COOK} XP`);
        this.openKitchen();
        if (reached.length) this.queueLevelUp(reached);
      }, 84, !ready);
    });
    this.button(c, x + W / 2 - 60, y + H - 46, 'Tutup', () => this.closeModal(), 120);
  }
}
