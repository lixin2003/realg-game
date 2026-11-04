/**
 * 全局配置：虚拟分辨率、调色板、手感参数。
 *
 * 分辨率按手机横屏选型：640×360 在 844×390 的手机上大约是 1.08 倍，
 * 文字几乎 1:1 渲染，不会因为放大而糊掉。
 * 桌面 1280×720 正好是整数 2 倍。
 */

/** 虚拟画面尺寸：所有逻辑坐标都在这套尺寸下 */
export const VIRTUAL_W = 640;
export const VIRTUAL_H = 360;

/** 像素风调色板，取自海报 */
export const PALETTE = {
  nightTop: 0x0d2233,
  nightBottom: 0x081320,
  star: 0x2a4a63,

  bambooFar: 0x143a22,
  bambooMid: 0x1b4a2a,
  bambooNear: 0x2e6b3e,
  bambooLeaf: 0x3f8a4f,

  stone: 0x4e5c52,
  stoneLight: 0x76897a,
  stoneDark: 0x2e3a33,

  metal: 0x46525c,
  metalLight: 0x8492a0,
  metalDark: 0x2b333c,

  wood: 0x6b4a2f,
  woodDark: 0x3f2a1a,

  porcelain: 0xf2f2f0,
  porcelainShade: 0xc9cfd4,

  soupRed: 0xc0392b,
  soupWhite: 0xf5e6c8,
  fire: 0xf39c12,

  rabbitFur: 0xd9c3a5,
  rabbitFurDark: 0xb89a78,
  rabbitFurLight: 0xefe4d0,
  rabbitEar: 0xe0a99b,
  rabbitCloth: 0x2f3440,
  rabbitClothLight: 0x454b5a,
  rabbitEye: 0x141414,
  rabbitNose: 0xc97a7a,
} as const;

/**
 * 手感参数（单位：像素 / 秒）。
 * 数值是按 640×360 分辨率标定的，改分辨率时这些要同比缩放。
 */
export const TUNING = {
  gravity: 2000,
  /** 下落时的额外重力倍率，让下坠更干脆 */
  fallMultiplier: 1.45,
  maxFallSpeed: 693,

  maxRunSpeed: 193,
  groundAccel: 1600,
  airAccel: 1040,
  groundFriction: 2000,
  airFriction: 347,

  jumpVelocity: -533,
  /** 松开跳跃键后竖直速度乘以这个系数，实现「短跳」 */
  jumpCutMultiplier: 0.42,
  /** 土狼时间：离开平台后仍可起跳的宽限（秒） */
  coyoteTime: 0.1,
  /** 跳跃缓冲：落地前提前按跳，落地瞬间自动起跳（秒） */
  jumpBuffer: 0.12,

  dashSpeed: 453,
  dashTime: 0.13,
  dashCooldown: 0.42,
} as const;

/** 纹理 key 前缀，避免手写字符串出错 */
export const TEX = {
  rabbit: 'rabbit',
  bambooFar: 'bamboo-far',
  bambooMid: 'bamboo-mid',
  bambooNear: 'bamboo-near',
} as const;

/** 兔子各种动作的帧数（占位素材用） */
export const RABBIT_FRAMES = {
  idle: 4,
  run: 6,
  jump: 2,
  fall: 2,
  dash: 2,
} as const;
