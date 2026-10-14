import Phaser from 'phaser';
import { FarmScene } from './scenes/FarmScene';
import { UIScene } from './scenes/UIScene';
import { makeTextures } from './textures';
import { load, resetSave } from './state';

// Open with ?reset to wipe the local save.
if (new URLSearchParams(location.search).has('reset')) {
  resetSave();
  history.replaceState(null, '', location.pathname);
}

class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create() {
    makeTextures(this);
    this.registry.set('state', load());
    this.registry.set('modal', false);
    this.scene.start('farm');
    this.scene.launch('ui');
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#1d1b2a',
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, FarmScene, UIScene],
});

// handy for debugging and automated play tests
if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
