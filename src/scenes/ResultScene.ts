import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { VIRTUAL_H, VIRTUAL_W } from '../config';

export interface ResultData {
  coins: number;
  total: number;
  /** 用时（秒） */
  time: number;
  /** 是否跑到了终点 */
  cleared: boolean;
}

/** 按收集率给个称号 */
function rank(coins: number, total: number, cleared: boolean): string {
  if (!cleared) return '你这手速能抢到票吗';
  const rate = total > 0 ? coins / total : 0;
  if (rate >= 1) return '究极盖孝子';
  if (rate >= 0.8) return '力兔狂热粉';
  return '沙琪玛';
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create(data: ResultData): void {
    const cx = VIRTUAL_W / 2;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x03070d, 0.94);
    overlay.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

    if (this.textures.exists('logo-sprite')) {
      this.add.image(cx, 64, 'logo-sprite').setDisplaySize(200, 96);
    }

    this.add
      .text(cx, 128, data.cleared ? '到达舞台' : '倒在半路', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: data.cleared ? '#eaf6ff' : '#e8a0a0',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 156, rank(data.coins, data.total, data.cleared), {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#f0b955',
      })
      .setOrigin(0.5);

    // 力力币
    if (this.textures.exists('coin-sprite')) {
      this.add.image(cx - 58, 190, 'coin-sprite').setScale(0.7);
    }
    this.add
      .text(cx + 8, 190, `${data.coins} / ${data.total}`, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#f7d774',
      })
      .setOrigin(0.5);

    const mm = Math.floor(data.time / 60);
    const ss = Math.floor(data.time % 60);
    this.add
      .text(cx, 216, `用时 ${mm}:${ss.toString().padStart(2, '0')}`, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#9fd4f2',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 244, '2027.1.2  成都东安湖体育公园主场', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#f0b955',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 264, 'GAI 周延 Real G 成都站', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#7f9fb5',
      })
      .setOrigin(0.5);

    this.makeButton(cx - 80, 306, 140, 42, '再玩一次', 0x1e4a35, () => {
      this.scene.stop('Game');
      this.scene.start('Game');
    });

    this.makeButton(cx + 80, 306, 140, 42, '分享战绩', 0x2b3f6e, () => {
      void this.share(data);
    });
  }

  private makeButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    color: number,
    onClick: () => void,
  ): void {
    const rect = this.add
      .rectangle(x, y, w, h, color, 0.95)
      .setStrokeStyle(2, 0x9fd4f2, 0.45)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(x, y, label, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#e6f4ff',
      })
      .setOrigin(0.5);

    rect.on('pointerover', () => rect.setFillStyle(color, 1));
    rect.on('pointerout', () => rect.setFillStyle(color, 0.95));
    rect.on('pointerdown', () => {
      sfx.click();
      onClick();
    });
  }

  private async share(data: ResultData): Promise<void> {
    const text = data.cleared
      ? `我在《力兔快跑》里收集了 ${data.coins}/${data.total} 枚力力币，冲到了舞台。2027.1.2 成都见`
      : `我在《力兔快跑》里翻车了，只摸到 ${data.coins}/${data.total} 枚力力币。2027.1.2 成都见`;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: '力兔快跑 · REALG', text, url });
        return;
      } catch {
        // 用户取消，继续走复制
      }
    }

    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
    } catch {
      // 剪贴板不可用就静默失败
    }
    this.toast('战绩已复制，去粘贴给朋友');
  }

  private toast(message: string): void {
    const t = this.add
      .text(VIRTUAL_W / 2, VIRTUAL_H - 26, message, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#cfe6d6',
        backgroundColor: '#12303f',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({
      targets: t,
      alpha: 1,
      duration: 150,
      yoyo: true,
      hold: 1400,
      onComplete: () => t.destroy(),
    });
  }
}
