import Phaser from 'phaser';
import { FarmScene } from './scenes/FarmScene';
import { UIScene } from './scenes/UIScene';
import { makeTextures } from './textures';
import { applyKenney, loadKenney } from './kenney';
import { load, resetSave } from './state';
import { UI_SCALE, VIEW, fitViewToWindow } from './ui/theme';

// Open with ?reset to wipe the local save.
if (new URLSearchParams(location.search).has('reset')) {
  resetSave();
  history.replaceState(null, '', location.pathname);
}

class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    loadKenney(this);
  }

  create() {
    makeTextures(this);
    applyKenney(this);
    this.registry.set('state', load());
    this.registry.set('modal', false);
    this.scene.start('farm');
    this.scene.launch('ui');
  }
}

fitViewToWindow();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW.w * UI_SCALE,
  height: VIEW.h * UI_SCALE,
  backgroundColor: '#1d1b2a',
  // smooth text and glass; pixel-art textures opt into nearest filtering in textures.ts
  antialias: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, FarmScene, UIScene],
});

// Follow the window's shape: resize the canvas, then rebuild the HUD for the new width.
let resizeTimer: number | undefined;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    const before = VIEW.w;
    fitViewToWindow();
    if (VIEW.w === before) return;
    game.scale.setGameSize(VIEW.w * UI_SCALE, VIEW.h * UI_SCALE);
    const ui = game.scene.getScene('ui') as UIScene;
    if (ui?.sys.isActive()) {
      ui.closeAll();
      ui.scene.restart();
    }
  }, 150);
});

// handy for debugging and automated play tests
if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
