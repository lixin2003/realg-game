import Phaser from 'phaser';
import { PALETTE, RABBIT_FRAMES, TEX } from '../config';

type Ctx = CanvasRenderingContext2D;

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

/** 画一个像素块 */
function px(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** 建一张离屏 canvas 纹理，返回绘制上下文 */
function makeTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: Ctx) => void,
): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) throw new Error(`无法创建纹理: ${key}`);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  tex.refresh();
}

/* ------------------------------------------------------------------ *
 * 兔子（32x32，脚底落在 y = 31）
 * ------------------------------------------------------------------ */

export const RABBIT_SIZE = 32;

const C = {
  fur: hex(PALETTE.rabbitFur),
  furDark: hex(PALETTE.rabbitFurDark),
  furLight: hex(PALETTE.rabbitFurLight),
  ear: hex(PALETTE.rabbitEar),
  cloth: hex(PALETTE.rabbitCloth),
  clothLight: hex(PALETTE.rabbitClothLight),
  eye: hex(PALETTE.rabbitEye),
  nose: hex(PALETTE.rabbitNose),
};

type Pose = 'idle' | 'run' | 'jump' | 'fall' | 'dash';

/**
 * 画一帧兔子，朝右。
 * 结构：长耳朵 + 圆脸 + 深色上衣 + 两条腿，保证缩小后依然一眼能认出是兔子。
 */
function drawRabbit(ctx: Ctx, ox: number, oy: number, pose: Pose, i: number, total: number): void {
  let bodyY = 0;
  let legSwing = 0;
  let earTilt = 0;

  switch (pose) {
    case 'idle':
      bodyY = i % 2 === 0 ? 0 : 1;
      break;
    case 'run': {
      const phase = Math.sin((i / total) * Math.PI * 2);
      bodyY = phase > 0 ? 0 : -1;
      legSwing = Math.round(phase * 2);
      earTilt = phase > 0 ? 1 : 0;
      break;
    }
    case 'jump':
      bodyY = i === 0 ? -1 : -2;
      legSwing = -1;
      earTilt = -1;
      break;
    case 'fall':
      bodyY = 0;
      legSwing = 1;
      earTilt = 1;
      break;
    case 'dash':
      bodyY = 1;
      legSwing = i === 0 ? -2 : 2;
      earTilt = 2;
      break;
  }

  const x = ox;
  const y = oy + bodyY;

  // 尾巴
  px(ctx, x + 6, y + 24, 4, 4, C.furLight);

  // 后腿
  px(ctx, x + 11 + legSwing, y + 27, 4, 5, C.furDark);

  // 身体（深色上衣，和浅色毛形成对比）
  px(ctx, x + 10, y + 22, 11, 7, C.cloth);
  px(ctx, x + 10, y + 22, 11, 1, C.clothLight);

  // 前腿
  px(ctx, x + 16 - legSwing, y + 27, 4, 5, C.fur);

  // 头
  px(ctx, x + 10, y + 10, 13, 13, C.fur);
  px(ctx, x + 10, y + 10, 13, 1, C.furLight);
  px(ctx, x + 10, y + 21, 13, 2, C.furDark);

  // 嘴
  px(ctx, x + 21, y + 19, 2, 1, C.furDark);

  // 眼睛
  px(ctx, x + 18, y + 14, 2, 3, C.eye);

  // 鼻子
  px(ctx, x + 22, y + 17, 2, 2, C.nose);

  // 耳朵：后耳略暗，前耳亮，带内耳粉色
  px(ctx, x + 12 + earTilt, y + 0, 4, 12, C.furDark);
  px(ctx, x + 13 + earTilt, y + 2, 2, 8, C.ear);
  px(ctx, x + 18 + earTilt, y + 1, 4, 12, C.fur);
  px(ctx, x + 19 + earTilt, y + 3, 2, 8, C.ear);
}

/** 生成兔子所有动作帧的纹理 */
export function buildRabbitTextures(scene: Phaser.Scene): void {
  (Object.keys(RABBIT_FRAMES) as Pose[]).forEach((pose) => {
    const total = RABBIT_FRAMES[pose];
    for (let i = 0; i < total; i += 1) {
      makeTexture(scene, `${TEX.rabbit}-${pose}-${i}`, RABBIT_SIZE, RABBIT_SIZE, (ctx) => {
        drawRabbit(ctx, 0, 0, pose, i, total);
      });
    }
  });
}

/* ------------------------------------------------------------------ *
 * 竹林背景（三层视差）
 * ------------------------------------------------------------------ */

/** 确定性伪随机，保证每次刷新背景一致 */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

interface BambooOptions {
  width: number;
  height: number;
  count: number;
  minW: number;
  maxW: number;
  stalk: string;
  stalkDark: string;
  stalkLight: string;
  leaf: string;
  seed: number;
  leafChance: number;
}

/** 画一层竹子，横向可无缝平铺 */
function drawBamboo(ctx: Ctx, o: BambooOptions): void {
  const rand = lcg(o.seed);

  for (let i = 0; i < o.count; i += 1) {
    const w = o.minW + Math.floor(rand() * (o.maxW - o.minW + 1));
    const x = Math.floor(rand() * o.width);
    const top = -24 + Math.floor(rand() * 56);
    const h = o.height - top;

    // 竿身：左亮右暗，做出圆柱感
    px(ctx, x, top, w, h, o.stalk);
    px(ctx, x, top, 1, h, o.stalkLight);
    px(ctx, x + w - 1, top, 1, h, o.stalkDark);

    // 竹节
    let ny = top + 8 + Math.floor(rand() * 8);
    while (ny < o.height) {
      px(ctx, x, ny, w, 1, o.stalkDark);
      ny += 9 + Math.floor(rand() * 7);
    }

    // 叶簇
    if (rand() < o.leafChance) {
      const clusters = 1 + Math.floor(rand() * 2);
      for (let c = 0; c < clusters; c += 1) {
        const ly = top + 14 + Math.floor(rand() * (o.height * 0.6));
        const dir = rand() > 0.5 ? 1 : -1;
        for (let k = 0; k < 4; k += 1) {
          const lw = 6 - k;
          const lx = dir > 0 ? x + w + k : x - lw - k;
          px(ctx, lx, ly + k, lw, 1, o.leaf);
        }
      }
    }
  }
}

export function buildBackgroundTextures(scene: Phaser.Scene, width: number, height: number): void {
  const layers: Array<[string, BambooOptions]> = [
    [
      TEX.bambooFar,
      {
        width,
        height,
        count: 34,
        minW: 1,
        maxW: 2,
        stalk: '#0f2a19',
        stalkDark: '#081a10',
        stalkLight: '#163a22',
        leaf: '#123322',
        seed: 1337,
        leafChance: 0.45,
      },
    ],
    [
      TEX.bambooMid,
      {
        width,
        height,
        count: 19,
        minW: 2,
        maxW: 3,
        stalk: '#1b4a2a',
        stalkDark: '#0f2e1a',
        stalkLight: '#235c33',
        leaf: '#2a6b3a',
        seed: 907,
        leafChance: 0.6,
      },
    ],
    [
      TEX.bambooNear,
      {
        width,
        height,
        count: 10,
        minW: 3,
        maxW: 5,
        stalk: '#2a5e38',
        stalkDark: '#1a3d25',
        stalkLight: '#357346',
        leaf: '#3f8a4f',
        seed: 451,
        leafChance: 0.8,
      },
    ],
  ];

  layers.forEach(([key, opts]) => {
    makeTexture(scene, key, opts.width, opts.height, (ctx) => drawBamboo(ctx, opts));
  });
}

/* ------------------------------------------------------------------ *
 * 蘑菇敌人（成都 / 川剧配色：红伞盖 + 白点 + 米白脸）
 * ------------------------------------------------------------------ */

const MUSHROOM_SIZE = 24;

const M = {
  cap: '#c0392b',
  capDark: '#8e2a20',
  capLight: '#e05a48',
  spot: '#f4efe4',
  face: '#f0e6d2',
  faceShade: '#cdbfa4',
  eye: '#141414',
  foot: '#4a3a2a',
};

function drawMushroom(ctx: Ctx, ox: number, oy: number, frame: number): void {
  const bob = frame % 2 === 0 ? 0 : 1;
  const x = ox;
  const y = oy + bob;

  // 两条小腿（走路时交替）
  const legPhase = frame < 2 ? 0 : 1;
  px(ctx, x + 7, y + 18, 4, 6 - legPhase, M.foot);
  px(ctx, x + 13, y + 18, 4, 5 + legPhase, M.foot);

  // 身体
  px(ctx, x + 7, y + 13, 10, 6, M.face);
  px(ctx, x + 7, y + 18, 10, 1, M.faceShade);

  // 伞盖（台阶式圆顶）
  const capRows = [8, 14, 18, 20, 22, 22, 22, 22];
  capRows.forEach((w, i) => {
    const left = x + Math.round((24 - w) / 2);
    px(ctx, left, y + 1 + i, w, 1, i === 0 ? M.capLight : M.cap);
  });
  px(ctx, x + 1, y + 8, 22, 1, M.capDark);

  // 白点
  px(ctx, x + 5, y + 4, 3, 3, M.spot);
  px(ctx, x + 15, y + 3, 2, 2, M.spot);
  px(ctx, x + 11, y + 6, 2, 2, M.spot);
  px(ctx, x + 18, y + 8, 2, 2, M.spot);

  // 脸
  px(ctx, x + 9, y + 14, 2, 2, M.eye);
  px(ctx, x + 14, y + 14, 2, 2, M.eye);
  px(ctx, x + 11, y + 17, 3, 1, M.faceShade);
}

export function buildMushroomTextures(scene: Phaser.Scene): void {
  for (let i = 0; i < 4; i += 1) {
    makeTexture(scene, `mushroom-walk-${i}`, MUSHROOM_SIZE, MUSHROOM_SIZE, (ctx) => {
      drawMushroom(ctx, 0, 0, i);
    });
  }
}

/* ------------------------------------------------------------------ *
 * 成都道具：盖碗茶、红灯笼、青瓦
 * ------------------------------------------------------------------ */

const PROP = {
  porcelain: hex(PALETTE.porcelain),
  porcelainShade: hex(PALETTE.porcelainShade),
  blue: '#2f6f9e',
  lantern: '#c0392b',
  lanternLight: '#e8604f',
  lanternGold: '#e8b04a',
  tile: '#3a4a5c',
  tileLight: '#4e6176',
  tileDark: '#232f3c',
  leaf: '#3f8a4f',
};

/** 盖碗茶：茶船 + 茶碗 + 茶盖，青花描边 */
export function buildPropTextures(scene: Phaser.Scene): void {
  makeTexture(scene, 'prop-tea', 24, 24, (ctx) => {
    // 茶船（托盘）
    px(ctx, 2, 19, 20, 2, PROP.porcelainShade);
    px(ctx, 3, 21, 18, 1, PROP.blue);

    // 茶碗：上宽下窄的碗形
    for (let i = 0; i < 10; i += 1) {
      const w = 20 - Math.round(i * 0.9);
      px(ctx, (24 - w) / 2, 9 + i, w, 1, PROP.porcelain);
    }
    // 碗口
    px(ctx, 2, 8, 20, 2, PROP.porcelainShade);
    px(ctx, 3, 8, 18, 1, PROP.blue);
    // 青花纹
    px(ctx, 7, 12, 2, 2, PROP.blue);
    px(ctx, 14, 13, 3, 2, PROP.blue);
    px(ctx, 11, 16, 2, 1, PROP.blue);

    // 茶盖：拱形 + 盖钮
    for (let i = 0; i < 3; i += 1) {
      const w = 18 - i * 2;
      px(ctx, (24 - w) / 2, 5 + i, w, 1, PROP.porcelain);
    }
    px(ctx, 10, 2, 4, 3, PROP.porcelainShade);
    px(ctx, 11, 1, 2, 1, PROP.blue);
  });

  makeTexture(scene, 'prop-lantern', 16, 24, (ctx) => {
    px(ctx, 6, 0, 4, 2, PROP.lanternGold);
    px(ctx, 4, 2, 8, 1, PROP.lanternGold);
    // 灯笼身
    for (let r = 0; r < 10; r += 1) {
      const w = 10 + Math.round(Math.sin(((r + 1) / 11) * Math.PI) * 4);
      px(ctx, (16 - w) / 2, 3 + r, w, 1, r < 3 ? PROP.lanternLight : PROP.lantern);
    }
    px(ctx, 3, 3, 1, 10, PROP.lanternLight);
    px(ctx, 12, 3, 1, 10, PROP.lantern);
    px(ctx, 4, 13, 8, 1, PROP.lanternGold);
    // 穗子
    px(ctx, 7, 14, 2, 6, PROP.lanternGold);
    px(ctx, 7, 20, 2, 3, PROP.lantern);
  });

  makeTexture(scene, 'tile-roof', 16, 16, (ctx) => {
    px(ctx, 0, 0, 16, 16, PROP.tile);
    px(ctx, 0, 0, 16, 2, PROP.tileLight);
    px(ctx, 0, 15, 16, 1, PROP.tileDark);
    // 瓦楞
    for (let x = 0; x < 16; x += 4) {
      px(ctx, x, 2, 1, 13, PROP.tileDark);
      px(ctx, x + 1, 2, 1, 13, PROP.tileLight);
    }
  });

  // HUD 生命图标
  const heart = [
    '.##.##.',
    '#######',
    '#######',
    '#######',
    '.###.#.',
    '..###..',
    '...#...',
  ];
  const drawHeart = (ctx: Ctx, color: string) => {
    heart.forEach((row, rowY) => {
      for (let col = 0; col < row.length; col += 1) {
        if (row[col] === '#') px(ctx, col, rowY, 1, 1, color);
      }
    });
  };
  makeTexture(scene, 'hud-heart', 7, 7, (ctx) => drawHeart(ctx, '#e8604f'));
  makeTexture(scene, 'hud-heart-empty', 7, 7, (ctx) => drawHeart(ctx, '#39434f'));
}

/* ------------------------------------------------------------------ *
 * 场景地砖
 * ------------------------------------------------------------------ */

const TILE = 16;

export function buildTileTextures(scene: Phaser.Scene): void {
  const s = TILE;

  // 青石台
  makeTexture(scene, 'tile-stone', s, s, (ctx) => {
    const base = hex(PALETTE.stone);
    const light = hex(PALETTE.stoneLight);
    const dark = hex(PALETTE.stoneDark);
    px(ctx, 0, 0, s, s, base);
    px(ctx, 0, 0, s, 2, light);
    px(ctx, 0, s - 1, s, 1, dark);
    px(ctx, 0, 7, s, 1, dark);
    px(ctx, 7, 0, 1, 7, dark);
    px(ctx, 11, 8, 1, 8, dark);
    px(ctx, 2, 3, 2, 1, light);
    px(ctx, 12, 11, 2, 1, light);
  });

  // 金属管道板
  makeTexture(scene, 'tile-metal', s, s, (ctx) => {
    const base = hex(PALETTE.metal);
    const light = hex(PALETTE.metalLight);
    const dark = hex(PALETTE.metalDark);
    px(ctx, 0, 0, s, s, base);
    px(ctx, 0, 0, s, 2, light);
    px(ctx, 0, s - 2, s, 2, dark);
    px(ctx, 0, 0, 1, s, dark);
    px(ctx, s - 1, 0, 1, s, dark);
    px(ctx, 2, 4, 2, 2, light);
    px(ctx, 12, 4, 2, 2, light);
    px(ctx, 2, 10, 2, 2, light);
    px(ctx, 12, 10, 2, 2, light);
  });

  // 木梁
  makeTexture(scene, 'tile-wood', s, s, (ctx) => {
    const base = hex(PALETTE.wood);
    const dark = hex(PALETTE.woodDark);
    px(ctx, 0, 0, s, s, base);
    px(ctx, 0, 0, s, 1, dark);
    px(ctx, 0, 5, s, 1, dark);
    px(ctx, 0, 11, s, 1, dark);
    px(ctx, 6, 1, 1, 4, dark);
    px(ctx, 9, 6, 1, 5, dark);
  });
}
