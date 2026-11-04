import Phaser from 'phaser';
import { TUNING, VIRTUAL_H, VIRTUAL_W } from './config';
import { GameScene } from './scenes/GameScene';
import { ResultScene } from './scenes/ResultScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: VIRTUAL_W,
  height: VIRTUAL_H,
  backgroundColor: '#050a11',
  pixelArt: true,
  roundPixels: true,
  scale: {
    // 手机优先：铺满可视区域。640×360 在手机上接近 1:1，放大倍数很小，
    // 文字不会被拉糊；桌面 1280×720 正好是整数 2 倍。
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: TUNING.gravity },
      debug: false,
    },
  },
  input: {
    // 多点触控：按住方向键的同时还能按跳跃/冲刺
    activePointers: 3,
  },
  scene: [GameScene, ResultScene],
};

const game = new Phaser.Game(config);

// 首帧时 #game 的尺寸可能还没稳定（尤其按需加载时），强制刷新一次缩放
window.setTimeout(() => game.scale.refresh(), 120);
window.addEventListener('resize', () => game.scale.refresh());
window.addEventListener('orientationchange', () => {
  window.setTimeout(() => game.scale.refresh(), 150);
});
