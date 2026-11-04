/**
 * 生成战绩分享图（1080×1440 竖版）。
 *
 * 用独立的 Canvas 2D 画，不截游戏画面——这样构图可控，
 * 手机上直接存相册 / 发朋友圈都是这张。
 */

export interface ResultImageData {
  coins: number;
  total: number;
  /** 用时（秒） */
  time: number;
  cleared: boolean;
  rank: string;
}

const W = 1080;
const H = 1440;
const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function createResultImage(data: ResultImageData): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // ---- 背景 ----
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0c2233');
  sky.addColorStop(0.55, '#081521');
  sky.addColorStop(1, '#04080e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const bg = await loadImage('assets/bg-loop.png');
  if (bg) {
    ctx.globalAlpha = 0.55;
    // 等比铺满，超出裁掉
    const scale = Math.max(W / bg.width, H / bg.height);
    const bw = bg.width * scale;
    const bh = bg.height * scale;
    ctx.drawImage(bg, (W - bw) / 2, (H - bh) / 2, bw, bh);
    ctx.globalAlpha = 1;
  }

  // 压暗，保证文字可读
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(4,10,18,0.72)');
  shade.addColorStop(0.5, 'rgba(4,10,18,0.88)');
  shade.addColorStop(1, 'rgba(4,10,18,0.96)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  // ---- 边框 ----
  ctx.strokeStyle = 'rgba(240,185,85,0.45)';
  ctx.lineWidth = 3;
  roundRect(ctx, 40, 40, W - 80, H - 80, 28);
  ctx.stroke();

  // ---- logo ----
  const logo = await loadImage('assets/logo.png');
  if (logo) {
    const lw = 460;
    const lh = (lw * logo.height) / logo.width;
    ctx.drawImage(logo, (W - lw) / 2, 120, lw, lh);
  }

  ctx.textAlign = 'center';

  // ---- 标题 ----
  ctx.fillStyle = '#eef7ff';
  ctx.font = `bold 62px ${FONT}`;
  ctx.fillText(data.cleared ? '到达舞台' : '倒在半路', W / 2, 540);

  // ---- 称号 ----
  ctx.fillStyle = '#f0b955';
  ctx.font = `bold 54px ${FONT}`;
  ctx.fillText(data.rank, W / 2, 640);

  // ---- 力力币 ----
  const coin = await loadImage('assets/coin.png');
  const coinSize = 92;
  const coinY = 730;
  if (coin) {
    ctx.drawImage(coin, W / 2 - 190, coinY, coinSize, coinSize);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#f7d774';
  ctx.font = `bold 58px ${FONT}`;
  ctx.fillText(`${data.coins} / ${data.total}`, W / 2 - 70, coinY + 68);

  // ---- 用时 ----
  const mm = Math.floor(data.time / 60);
  const ss = Math.floor(data.time % 60);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9fd4f2';
  ctx.font = `34px ${FONT}`;
  ctx.fillText(`用时 ${mm}:${ss.toString().padStart(2, '0')}`, W / 2, 900);

  // ---- 分隔线 ----
  ctx.strokeStyle = 'rgba(120,170,200,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 220, 970);
  ctx.lineTo(W / 2 + 220, 970);
  ctx.stroke();

  // ---- 演出信息 ----
  ctx.fillStyle = '#f0b955';
  ctx.font = `bold 40px ${FONT}`;
  ctx.fillText('2027.1.2', W / 2, 1050);

  ctx.fillStyle = '#deebf5';
  ctx.font = `34px ${FONT}`;
  ctx.fillText('成都东安湖体育公园主体育场', W / 2, 1110);

  ctx.fillStyle = '#8fa8bc';
  ctx.font = `30px ${FONT}`;
  ctx.fillText('GAI 周延 Real G 成都站', W / 2, 1170);

  // ---- 底部标识 ----
  ctx.fillStyle = '#5f7488';
  ctx.font = `30px ${FONT}`;
  ctx.fillText('力兔快跑 · gai781.top', W / 2, 1310);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}
