import Phaser from 'phaser';
import {
  LAKES,
  isWet,
  fishStars,
  fishXp,
  rollFish,
  STAMINA_COST,
  TILE,
  BITE_WINDOW_MS,
  produceById,
  qualityKey,
} from '../../data';
import { add, canAdd, checkStaminaRewards, plotKey, tierOf, seasonOf } from '../../state';
import { play } from '../../sfx';
import type { FarmScene } from '../FarmScene';

export function startFishing(scene: FarmScene, tx: number, ty: number) {
    const s = scene.state;
    s.stamina -= STAMINA_COST.pancing;
    const where = scene.waterAt.get(plotKey(tx, ty)) ?? 'danau';
    const bobber = scene.add.image((tx + 0.5) * TILE, (ty + 0.5) * TILE, 'bobber').setDepth(9001);
    scene.tweens.add({ targets: bobber, y: bobber.y + 1, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const alert = scene.add.image(scene.player.x, scene.player.y - 22, 'bubble').setDepth(9200).setVisible(false);
    scene.swing();
    play('water');
    scene.splash(tx, ty, 0x8fd0f5);
    scene.toast(`${LAKES[where].name} · menunggu ikan menggigit...`);
    const timer = scene.time.delayedCall(Phaser.Math.Between(1500, 4500) * (1 - 0.15 * tierOf(scene.state, 'pancing')), () => scene.bite());
    scene.fishing = { stage: 'wait', where, bobber, alert, timer };
    scene.changed();
}

export function bite(scene: FarmScene) {
    const f = scene.fishing;
    if (!f) return;
    f.stage = 'bite';
    f.biteAt = scene.time.now;
    f.alert.setVisible(true);
    scene.tweens.add({ targets: f.bobber, y: f.bobber.y + 3, duration: 90, yoyo: true, repeat: 3 });
    play('click');
    // a short window to react
    f.timer = scene.time.delayedCall(BITE_WINDOW_MS[tierOf(scene.state, 'pancing')], () => scene.endFishing('Ikannya lepas... Coba lagi.', true));
}

export function reel(scene: FarmScene) {
    const f = scene.fishing;
    if (!f) return;
    if (f.stage === 'wait') return scene.endFishing('Terlalu cepat! Ikannya kabur.', true);
    const s = scene.state;
    const id = rollFish(f.where, seasonOf(s.day), s.minutes / 60, isWet(s.weather), Math.random, tierOf(s, 'pancing') >= 3 ? 1.5 : 1);
    // quicker reaction to the bite = better quality
    const q = fishStars(scene.time.now - (f.biteAt ?? scene.time.now), s.level);
    const key = qualityKey(id, q);
    const fish = produceById(key);
    if (!canAdd(s, 'produce', key)) return scene.endFishing(`Tas penuh! ${fish.name} dilepas lagi.`, true);
    add(s.produce, key, 1);
    const first = !s.fishCaught[id];
    s.fishCaught[id] = Math.max(s.fishCaught[id] ?? 0, q);
    const fishReward = checkStaminaRewards(s)[0]; // completing the Fish Book
    const [tx, ty] = [Math.floor(f.bobber.x / TILE), Math.floor(f.bobber.y / TILE)];
    scene.flyIcon(tx, ty, `icon-${id}`);
    scene.starBurst(tx, ty, q);
    play(q >= 4 || first ? 'quest' : 'harvest');
    scene.xp(fishXp(id), tx, ty);
    scene.endFishing(fishReward ?? `${first ? 'Ikan baru! ' : ''}Dapat ${fish.name} (${fish.sellPrice} G)`);
}

export function endFishing(scene: FarmScene, msg: string, failed = false) {
    const f = scene.fishing;
    if (!f) return;
    f.timer.remove();
    f.bobber.destroy();
    f.alert.destroy();
    scene.fishing = undefined;
    if (failed) scene.fail(msg);
    else scene.toast(msg);
    scene.changed();
}
