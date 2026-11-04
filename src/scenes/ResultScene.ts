import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { VIRTUAL_H, VIRTUAL_W } from '../config';
import { createResultImage } from '../gfx/resultImage';

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

    this.makeButton(cx - 142, 306, 128, 42, '再玩一次', 0x1e4a35, () => {
      this.scene.stop('Game');
      this.scene.start('Game');
    });

    this.makeButton(cx, 306, 128, 42, '保存截图', 0x5a3f1c, () => {
      void this.saveImage(data);
    });

    this.makeButton(cx + 142, 306, 128, 42, '分享战绩', 0x2b3f6e, () => {
      void this.share(data);
    });

    // 调试用：?shot=1 直接生成图并铺满页面，方便检查排版
    if (new URLSearchParams(window.location.search).get('shot') === '1') {
      void this.saveImage(data);
    }
  }

  /** 生成一张竖版战绩图，手机上走系统分享，桌面上直接下载 */
  private async saveImage(data: ResultData): Promise<void> {
    this.toast('正在生成…');

    const blob = await createResultImage({
      coins: data.coins,
      total: data.total,
      time: data.time,
      cleared: data.cleared,
      rank: rank(data.coins, data.total, data.cleared),
    });

    if (!blob) {
      this.toast('生成失败，换个浏览器试试');
      return;
    }

    // 调试用：把生成的图直接铺在页面上
    if (new URLSearchParams(window.location.search).get('shot') === '1') {
      const preview = new Image();
      preview.src = URL.createObjectURL(blob);
      preview.style.cssText =
        'position:fixed;inset:0;width:100%;height:100%;object-fit:contain;background:#000;z-index:9999';
      document.body.appendChild(preview);
      return;
    }

    // 文件名用英文，避免部分系统解压/下载时中文乱码
    const fileName = `litu-run-${data.coins}of${data.total}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    // 手机优先调系统分享，可以直接存相册 / 发微信
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: '力兔快跑 · 战绩' });
        return;
      } catch {
        // 用户取消分享，继续走下载
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);

    this.toast('已保存，去下载或相册里看看');
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
