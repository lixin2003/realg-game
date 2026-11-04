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
  scene: [GameScene, ResultScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
