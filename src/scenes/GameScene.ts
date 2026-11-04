import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { PALETTE, TEX, VIRTUAL_H, VIRTUAL_W } from '../config';
import { Mushroom } from '../entities/Mushroom';
import { Rabbit, RabbitKeys, VirtualInput } from '../entities/Rabbit';
import {
  buildBackgroundTextures,
  buildMushroomTextures,
  buildPropTextures,
  buildRabbitTextures,
  buildTileTextures,
} from '../gfx/textures';

/**
 * 关卡数据按 480×270 的旧坐标写，运行时统一乘 S 放大到 640×360。
 * 这样保留原始设计数字，改分辨率只要动一个常量。
 */
const S = VIRTUAL_W / 480;
const s = (n: number) => Math.round(n * S);

/** 关卡总长（480 体系）。原来 1900，现在拉到 2900 */
const WORLD_W = s(2900);
const WORLD_H = s(400);
const GROUND_Y = s(232);
const SPAWN_X = s(48);
const SPAWN_Y = s(200);
const KILL_Y = s(340);

const MAX_LIVES = 3;
/** 受伤后的无敌时间（秒） */
const INVINCIBLE_TIME = 1.2;
/** 蘑菇贴图中心到碰撞体底部的距离（640 体系） */
const MUSHROOM_FOOT_OFFSET = 31;
/** 跑到这个横坐标就算到达舞台 */
const FINISH_X = s(2760);

type TileKind = 'stone' | 'metal' | 'wood' | 'roof';

interface SolidDef {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: TileKind;
}

const TILE_KEY: Record<TileKind, string> = {
  stone: 'tile-stone',
  metal: 'tile-metal',
  wood: 'tile-wood',
  roof: 'tile-roof',
};

/**
 * 关卡布局（480 体系）。
 *
 * 节奏分四段：
 *   A 0–700    热身：台阶 + 浮动平台
 *   B 700–1700 工坊：连续小平台 + 传送带
 *   C 1700–2660 断崖：60px 间隔的连续上下跳，落点小
 *   D 2660–2900 终点舞台
 */
const RAW_SOLIDS: SolidDef[] = [
  // 地图外的一小段地面，彩蛋触发后兔子才能走过来（正常游玩被世界边界挡住）
  { x: -220, y: 232, w: 220, h: 60, kind: 'stone' },

  // ---- 地面，8 段，坑宽 50 / 60 / 70 / 80 ----
  { x: 0, y: 232, w: 340, h: 60, kind: 'stone' },
  { x: 390, y: 232, w: 310, h: 60, kind: 'stone' },
  { x: 760, y: 232, w: 320, h: 60, kind: 'stone' },
  { x: 1150, y: 232, w: 230, h: 60, kind: 'stone' },
  { x: 1450, y: 232, w: 250, h: 60, kind: 'stone' },
  { x: 1768, y: 232, w: 252, h: 60, kind: 'stone' },
  { x: 2088, y: 232, w: 292, h: 60, kind: 'stone' },
  { x: 2440, y: 232, w: 460, h: 60, kind: 'stone' },

  // ---- A 段台阶 ----
  { x: 104, y: 200, w: 72, h: 16, kind: 'roof' },
  { x: 216, y: 172, w: 64, h: 16, kind: 'metal' },
  { x: 320, y: 144, w: 64, h: 16, kind: 'metal' },
  { x: 530, y: 148, w: 70, h: 16, kind: 'metal' },
  { x: 620, y: 180, w: 80, h: 16, kind: 'roof' },

  // ---- B 段 ----
  { x: 740, y: 150, w: 70, h: 16, kind: 'metal' },
  { x: 840, y: 178, w: 90, h: 16, kind: 'roof' },
  { x: 950, y: 142, w: 70, h: 16, kind: 'metal' },
  { x: 1050, y: 170, w: 80, h: 16, kind: 'metal' },
  { x: 1150, y: 138, w: 64, h: 16, kind: 'metal' },
  // 传送带
  { x: 1240, y: 176, w: 160, h: 16, kind: 'metal' },
  { x: 1430, y: 145, w: 70, h: 16, kind: 'metal' },
  { x: 1540, y: 115, w: 64, h: 16, kind: 'metal' },
  { x: 1640, y: 155, w: 80, h: 16, kind: 'roof' },

  // ---- C 段断崖：小落点 + 连续上下，间距 55 ----
  { x: 1740, y: 130, w: 60, h: 16, kind: 'metal' },
  { x: 1855, y: 165, w: 60, h: 16, kind: 'roof' },
  { x: 1970, y: 130, w: 60, h: 16, kind: 'metal' },
  { x: 2085, y: 165, w: 60, h: 16, kind: 'roof' },
  { x: 2200, y: 125, w: 60, h: 16, kind: 'metal' },
  { x: 2315, y: 165, w: 60, h: 16, kind: 'roof' },
  { x: 2430, y: 125, w: 60, h: 16, kind: 'metal' },
  { x: 2545, y: 165, w: 60, h: 16, kind: 'roof' },

  // ---- D 段终点 ----
  { x: 2660, y: 165, w: 240, h: 16, kind: 'wood' },
];

const SOLIDS: SolidDef[] = RAW_SOLIDS.map((d) => ({
  x: s(d.x),
  y: s(d.y),
  w: s(d.w),
  h: s(d.h),
  kind: d.kind,
}));

interface EnemyDef {
  x: number;
  footY: number;
  /** 巡逻范围（480 体系），一般就是所在平台的两端 */
  from: number;
  to: number;
}

const RAW_ENEMIES: EnemyDef[] = [
  // A 段
  { x: 160, footY: 232, from: 8, to: 336 },
  { x: 140, footY: 200, from: 106, to: 174 },
  { x: 248, footY: 172, from: 218, to: 278 },
  { x: 352, footY: 144, from: 322, to: 382 },
  { x: 660, footY: 180, from: 622, to: 698 },
  // B 段
  { x: 885, footY: 178, from: 842, to: 928 },
  { x: 900, footY: 232, from: 768, to: 1076 },
  { x: 1090, footY: 170, from: 1052, to: 1128 },
  { x: 1200, footY: 232, from: 1158, to: 1374 },
  { x: 1320, footY: 176, from: 1242, to: 1398 },
  { x: 1680, footY: 155, from: 1642, to: 1718 },
  // C 段：每两块平台一个敌人，别把落脚点全堵死
  { x: 1770, footY: 130, from: 1742, to: 1798 },
  { x: 2010, footY: 130, from: 1972, to: 2028 },
  { x: 2250, footY: 125, from: 2202, to: 2258 },
  { x: 2480, footY: 125, from: 2432, to: 2488 },
  { x: 2560, footY: 232, from: 2450, to: 2800 },
];

/** 力力币 */
const RAW_COINS: Array<{ x: number; y: number }> = [
  // A 段
  { x: 60, y: 208 },
  { x: 150, y: 172 },
  { x: 250, y: 144 },
  { x: 360, y: 116 },
  { x: 452, y: 88 },
  { x: 570, y: 118 },
  { x: 670, y: 152 },
  // B 段
  { x: 760, y: 122 },
  { x: 870, y: 148 },
  { x: 980, y: 112 },
  { x: 1090, y: 140 },
  { x: 1180, y: 108 },
  { x: 1300, y: 148 },
  { x: 1470, y: 113 },
  { x: 1570, y: 86 },
  { x: 1680, y: 123 },
  // C 段
  { x: 1825, y: 148 },
  { x: 1940, y: 148 },
  { x: 2055, y: 148 },
  { x: 2170, y: 143 },
  { x: 2285, y: 143 },
  { x: 2400, y: 143 },
  { x: 2515, y: 143 },
  { x: 2610, y: 143 },
];

/** 上下浮动的蒸汽平台 */
interface Mover {
  sprite: Phaser.GameObjects.TileSprite;
  baseY: number;
  range: number;
  speed: number;
}

export class GameScene extends Phaser.Scene {
  private rabbit!: Rabbit;
  private solids: Phaser.GameObjects.TileSprite[] = [];
  private movers: Mover[] = [];
  private belt!: Phaser.GameObjects.TileSprite;

  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private coins: Phaser.GameObjects.Image[] = [];

  private bgMain?: Phaser.GameObjects.TileSprite;
  private bgFar?: Phaser.GameObjects.TileSprite;
  private bgMid?: Phaser.GameObjects.TileSprite;
  private bgNear?: Phaser.GameObjects.TileSprite;

  private hearts: Phaser.GameObjects.Image[] = [];
  private coinText!: Phaser.GameObjects.Text;
  private debugText!: Phaser.GameObjects.Text;

  private lives = MAX_LIVES;
  private coinCount = 0;
  private invincible = 0;
  private showDebug = false;
  /** 出生点，可用 URL 参数 ?sx=900 覆盖，方便调试关卡中段 */
  private spawnX = SPAWN_X;

  private finished = false;
  private startedAt = 0;
  private isTouch = false;
  private debugDie = false;
  private keys!: RabbitKeys;
  private virtualState: VirtualInput = { left: false, right: false, jump: false };
  /** 虚拟按键对象，用于「设置」里统一缩放 */
  private touchPads: Array<{ obj: Phaser.GameObjects.Arc; text: Phaser.GameObjects.Text }> = [];

  /** 彩蛋：贴着左墙持续按左的累计时间 */
  private pushTimer = 0;
  private eggRevealed = false;
  private eggCoin?: Phaser.GameObjects.Image;
  private debugEgg = false;

  /** 凤凰金币：回血 + 5 秒跳跃强化 */
  private specialCoin?: Phaser.GameObjects.Image;
  private jumpBoostTimer = 0;
  private boostText?: Phaser.GameObjects.Text;

  /** 弹跳音箱：踩上去把人弹到高处 */
  private springs: Array<{ x1: number; x2: number; top: number; cooldown: number }> = [];
  /** 踩一下就塌的平台 */
  private crumbles: Array<{
    sprite: Phaser.GameObjects.TileSprite;
    x1: number;
    x2: number;
    top: number;
    timer: number;
    respawn: number;
    fallen: boolean;
  }> = [];

  constructor() {
    super('Game');
  }

  /** 正式美术资源。加载不到会自动退回代码生成的占位素材 */
  preload(): void {
    this.load.image('rabbit-sprite', 'assets/rabbit.png');
    this.load.image('mushroom-sprite', 'assets/mushroom.png');
    this.load.image('logo-sprite', 'assets/logo.png');
    this.load.image('coin-sprite', 'assets/coin.png');
    this.load.image('phoenix-coin', 'assets/phoenix-coin.png');
    // 可循环背景：文件不存在时会静默失败，自动退回程序生成的竹林
    this.load.image('bg-loop', 'assets/bg-loop.png');
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, () => undefined);
  }

  create(): void {
    const q = new URLSearchParams(window.location.search);

    // 重启场景时这些状态要归零
    this.lives = MAX_LIVES;
    this.coinCount = 0;
    this.invincible = 0;
    this.solids = [];
    this.movers = [];
    this.coins = [];
    this.hearts = [];
    this.finished = false;
    this.startedAt = this.time.now;
    this.pushTimer = 0;
    this.eggRevealed = false;
    this.eggCoin = undefined;
    this.specialCoin = undefined;
    this.jumpBoostTimer = 0;
    this.springs = [];
    this.crumbles = [];
    this.virtualState = { left: false, right: false, jump: false };
    this.touchPads = [];
    // 判断是否显示虚拟按键：pointer: coarse 表示主输入是手指，鼠标是 fine。
    // 只用主指针类型，避免桌面浏览器（包括无头环境）误报触摸能力。
    const touchPoints = navigator.maxTouchPoints > 0;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    this.isTouch = (touchPoints && coarsePointer) || q.get('touch') === '1';
    this.debugDie = q.get('die') === '1';
    this.spawnX = s(Number(q.get('sx'))) || SPAWN_X;

    if (!this.textures.exists('rabbit-sprite')) {
      buildRabbitTextures(this);
    }

    buildMushroomTextures(this);
    buildPropTextures(this);
    buildBackgroundTextures(this, VIRTUAL_W, VIRTUAL_H);
    buildTileTextures(this);

    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBounds(0, 0, WORLD_W, VIRTUAL_H);

    // 有正式背景图时，代码生成的天空和灯笼都省掉，避免和背景打架
    if (!this.textures.exists('bg-loop')) {
      this.createSky();
      this.createLanterns();
    }
    this.createBackground();

    this.createSolids();
    this.createMover();
    this.createDecor();
    this.createStage();

    this.keys = this.createKeys();
    this.rabbit = new Rabbit(this, this.spawnX, SPAWN_Y, this.keys);
    this.rabbit.onJump = () => sfx.jump();
    this.rabbit.onLand = () => sfx.land();

    // 浏览器要求用户先交互一次才允许出声
    this.input.once('pointerdown', () => sfx.unlock());
    this.input.keyboard?.once('keydown', () => sfx.unlock());

    this.physics.add.collider(this.rabbit, this.solids);
    this.movers.forEach((m) => {
      this.physics.add.collider(this.rabbit, m.sprite);
    });

    // 这两个必须在 rabbit 创建之后，否则 collider 会拿到 undefined
    this.createSprings();
    this.createCrumbles();

    this.createEnemies();
    this.createCoins();
    this.createEggCoin();
    this.createSpecialCoin();

    this.cameras.main.startFollow(this.rabbit, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(s(80), s(50));

    this.createHud();
    this.createDebugOverlay();
    if (this.isTouch) this.createTouchControls();

    // 调试用：?egg=1 触发彩蛋并把兔子送到地图外的金币旁
    this.debugEgg = q.get('egg') === '1';

    this.input.keyboard?.on('keydown-R', () => this.respawn());
    this.input.keyboard?.on('keydown-F1', () => this.toggleDebug());

    // 首帧就绪，通知启动页淡出
    window.dispatchEvent(new Event('game-ready'));
  }

  /* --------------------------------------------------------------- */

  private createSky(): void {
    const g = this.add.graphics().setScrollFactor(0).setDepth(-40);
    const top = Phaser.Display.Color.ValueToColor(PALETTE.nightTop);
    const bottom = Phaser.Display.Color.ValueToColor(PALETTE.nightBottom);

    for (let y = 0; y < VIRTUAL_H; y += 2) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, VIRTUAL_H, y);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, y, VIRTUAL_W, 2);
    }

    const rand = new Phaser.Math.RandomDataGenerator(['realg']);
    for (let i = 0; i < 60; i += 1) {
      const x = rand.between(0, VIRTUAL_W);
      const y = rand.between(0, s(120));
      g.fillStyle(PALETTE.star, rand.realInRange(0.4, 1));
      g.fillRect(x, y, 1, 1);
    }
  }

  private createBackground(): void {
    // 有正式的可循环背景图就直接用，否则退回代码生成的三层竹林
    if (this.textures.exists('bg-loop')) {
      this.bgMain = this.add
        .tileSprite(0, 0, VIRTUAL_W, VIRTUAL_H, 'bg-loop')
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(-20);

      // 压暗一层，让角色和平台从背景里跳出来
      const dim = this.add.graphics().setScrollFactor(0).setDepth(-19);
      dim.fillStyle(0x040b14, 0.42);
      dim.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
      return;
    }

    this.bgFar = this.add
      .tileSprite(0, 0, VIRTUAL_W, VIRTUAL_H, TEX.bambooFar)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-30);

    this.bgMid = this.add
      .tileSprite(0, 0, VIRTUAL_W, VIRTUAL_H, TEX.bambooMid)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-20)
      .setAlpha(0.9);

    this.bgNear = this.add
      .tileSprite(0, 0, VIRTUAL_W, VIRTUAL_H, TEX.bambooNear)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-10)
      .setAlpha(0.7);
  }

  /** 红灯笼：成都的老街氛围，挂在竹林之间 */
  private createLanterns(): void {
    for (let x = s(160); x < WORLD_W; x += s(230)) {
      const y = s(28) + ((x * 7) % s(40));
      const lantern = this.add.image(x, y, 'prop-lantern').setDepth(-5).setAlpha(0.85);
      this.tweens.add({
        targets: lantern,
        angle: { from: -4, to: 4 },
        duration: 1800 + ((x % 5) * 220),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private createSolids(): void {
    this.solids = SOLIDS.map((d) => {
      const ts = this.add
        .tileSprite(d.x + d.w / 2, d.y + d.h / 2, d.w, d.h, TILE_KEY[d.kind])
        .setDepth(5);
      this.physics.add.existing(ts, true);
      return ts;
    });
  }

  private createMover(): void {
    const w = s(56);
    const h = s(16);
    const x = s(424);
    const baseY = s(128);

    const ts = this.add.tileSprite(x + w / 2, baseY, w, h, 'tile-metal').setDepth(5);
    this.physics.add.existing(ts, true);

    this.movers.push({ sprite: ts, baseY, range: s(16), speed: 1.6 });

    const steam = this.add.graphics().setDepth(4);
    steam.fillStyle(PALETTE.porcelain, 0.12);
    steam.fillRect(x + w / 2 - s(4), s(100), s(8), s(160));
  }

  private createDecor(): void {
    this.belt = this.add.tileSprite(s(1240 + 80), s(176 + 8), s(160), s(16), 'tile-metal').setDepth(6);

    const g = this.add.graphics().setDepth(6);
    g.fillStyle(PALETTE.metalLight, 0.9);
    for (let i = 0; i < 10; i += 1) {
      g.fillRect(s(1248) + i * s(16), s(179), s(4), s(2));
    }
  }

  /** 终点：演唱会舞台（桁架 + 大屏 + 音箱 + 台前观众） */
  private createStage(): void {
    const x = s(2700);
    const w = s(200);
    const g = this.add.graphics().setDepth(7);

    // 顶部桁架 + 挂灯
    g.fillStyle(0x222c3a, 1);
    g.fillRect(x, s(56), w, s(8));
    for (let i = 0; i < 8; i += 1) {
      g.fillStyle(0xe8b04a, 0.9);
      g.fillRect(x + s(12) + i * s(24), s(58), s(3), s(3));
    }

    // 大屏
    g.fillStyle(0x0a1522, 1);
    g.fillRect(x + s(6), s(66), w - s(12), s(94));
    g.fillStyle(0x1e4a6e, 0.6);
    g.fillRect(x + s(10), s(70), w - s(20), s(86));
    g.fillStyle(0x5fa8e8, 0.55);
    g.fillRect(x + s(6), s(66), w - s(12), 2);
    g.fillRect(x + s(6), s(158), w - s(12), 2);

    // 舞台台面 + 支撑
    g.fillStyle(0x2a3444, 1);
    g.fillRect(x - s(6), s(174), w + s(12), s(10));
    g.fillStyle(0x46566a, 1);
    g.fillRect(x - s(6), s(174), w + s(12), 2);
    g.fillStyle(0x1c2430, 1);
    g.fillRect(x + s(10), s(166), s(8), s(10));
    g.fillRect(x + w - s(18), s(166), s(8), s(10));

    // 两侧音箱
    g.fillStyle(0x141c26, 1);
    g.fillRect(x - s(18), s(140), s(10), s(38));
    g.fillRect(x + w + s(8), s(140), s(10), s(38));
    g.fillStyle(0x39465a, 1);
    g.fillRect(x - s(16), s(146), s(6), s(6));
    g.fillRect(x + w + s(10), s(146), s(6), s(6));

    if (this.textures.exists('logo-sprite')) {
      this.add.image(x + w / 2, s(110), 'logo-sprite').setDisplaySize(s(160), s(77)).setDepth(8);
    } else {
      this.add
        .text(x + w / 2, s(110), 'REALG', {
          fontFamily: 'monospace',
          fontSize: '28px',
          fontStyle: 'bold',
          color: '#eaf6ff',
        })
        .setOrigin(0.5)
        .setDepth(8);
    }

    this.add
      .text(x + w / 2, s(152), '2027.01.02  成都', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#9fd4f2',
      })
      .setOrigin(0.5)
      .setDepth(8);

    // 台前观众剪影：depth 在角色之下，主角跑过时会挡住他们
    const rand = new Phaser.Math.RandomDataGenerator(['crowd']);
    const crowd = this.add.graphics().setDepth(8);
    for (let i = 0; i < 24; i += 1) {
      const cx = x - s(26) + i * s(10) + rand.between(-2, 2);
      const cy = s(186) + rand.between(-1, 2);
      crowd.fillStyle(0x050b13, 0.95);
      crowd.fillRect(cx + 1, cy - s(10), s(4), s(10));
      crowd.fillRect(cx, cy - s(14), s(5), s(5));
      if (rand.frac() > 0.5) {
        crowd.fillRect(cx - 1, cy - s(19), 2, s(5));
      }
    }
  }

  private createEnemies(): void {
    this.enemyGroup = this.physics.add.group();

    RAW_ENEMIES.forEach((pos) => {
      const m = new Mushroom(
        this,
        s(pos.x),
        s(pos.footY) - MUSHROOM_FOOT_OFFSET,
        s(pos.from) + s(10),
        s(pos.to) - s(10),
      );
      this.enemyGroup.add(m);
    });

    this.physics.add.collider(this.enemyGroup, this.solids);
    this.movers.forEach((m) => {
      this.physics.add.collider(this.enemyGroup, m.sprite);
    });

    this.physics.add.overlap(
      this.rabbit,
      this.enemyGroup,
      this.onTouchEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );
  }

  private createCoins(): void {
    RAW_COINS.forEach((pos) => {
      const coin = this.add.image(s(pos.x), s(pos.y), 'coin-sprite').setDepth(8).setScale(0.85);
      this.tweens.add({
        targets: coin,
        y: s(pos.y) - 7,
        duration: 1100 + (pos.x % 400),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.coins.push(coin);
    });
  }

  /* ---------------- 彩蛋：顶着左墙两秒 ---------------- */

  private createEggCoin(): void {
    // 地图外的那枚力力币，彩蛋触发前不可见也不可吃
    this.eggCoin = this.add
      .image(s(-120), s(192), 'coin-sprite')
      .setDepth(8)
      .setScale(0.85)
      .setVisible(false);

    this.tweens.add({
      targets: this.eggCoin,
      y: s(192) - s(6),
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /* ---------------- 凤凰金币：回血 + 跳跃强化 ---------------- */

  private createSpecialCoin(): void {
    this.specialCoin = this.add
      .image(s(950), s(180), 'phoenix-coin')
      .setDisplaySize(s(39), s(39))
      .setDepth(9);

    this.tweens.add({
      targets: this.specialCoin,
      y: s(180) - s(8),
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private updateSpecialCoin(dt: number): void {
    const coin = this.specialCoin;

    if (coin?.active) {
      const d = Phaser.Math.Distance.Between(coin.x, coin.y, this.rabbit.x, this.rabbit.y);
      if (d < s(36)) this.collectSpecialCoin();
    }

    if (this.jumpBoostTimer <= 0) return;

    this.jumpBoostTimer -= dt;
    if (this.jumpBoostTimer <= 0) {
      this.jumpBoostTimer = 0;
      this.rabbit.setJumpBoost(1);
      this.boostText?.setVisible(false);
    } else {
      this.boostText?.setText(`跳跃强化 ${Math.ceil(this.jumpBoostTimer)}s`).setVisible(true);
    }
  }

  private collectSpecialCoin(): void {
    const coin = this.specialCoin;
    if (!coin || !coin.active) return;
    coin.setActive(false);

    if (this.lives < MAX_LIVES) {
      this.lives += 1;
      this.refreshHearts();
    }

    this.jumpBoostTimer = 5;
    this.rabbit.setJumpBoost(Math.SQRT2);
    this.boostText?.setText('跳跃强化 5s').setVisible(true);

    sfx.win();
    this.cameras.main.shake(s(120), 0.004);

    this.tweens.add({
      targets: coin,
      y: coin.y - s(22),
      scale: 1.5,
      alpha: 0,
      duration: 320,
      ease: 'Quad.easeOut',
      onComplete: () => coin.destroy(),
    });
  }

  /** 判断玩家是不是踩在某个矩形平台顶面上 */
  private isOnTop(x1: number, x2: number, top: number): boolean {
    const rb = this.rabbit.body as Phaser.Physics.Arcade.Body;
    const overlap = rb.right > x1 + 2 && rb.left < x2 - 2;
    const gap = rb.bottom - top;
    return overlap && gap >= -s(4) && gap <= s(8) && rb.velocity.y >= -20;
  }

  /* ---------------- 弹跳音箱 ---------------- */

  private createSprings(): void {
    // 放在 B 段开阔地面上，弹起来正好能吃高处那枚币
    const defs = [{ x: 1000, y: 232 }];

    defs.forEach((d) => {
      const w = s(44);
      const h = s(26);
      const cx = s(d.x);
      const baseY = s(d.y);
      const g = this.add.graphics().setDepth(6);

      // 箱体
      g.fillStyle(0x1f2a38, 1);
      g.fillRect(cx - w / 2, baseY - h, w, h);
      g.fillStyle(0x4a5c72, 1);
      g.fillRect(cx - w / 2, baseY - h, w, 2);
      // 两个喇叭
      g.fillStyle(0x0b131c, 1);
      g.fillCircle(cx - s(7), baseY - h / 2, s(8));
      g.fillStyle(0x5a708c, 1);
      g.fillCircle(cx - s(7), baseY - h / 2, s(4));
      g.fillStyle(0x0b131c, 1);
      g.fillCircle(cx + s(11), baseY - h / 2 + s(3), s(5));

      this.springs.push({
        x1: cx - w / 2,
        x2: cx + w / 2,
        top: baseY - h,
        cooldown: 0,
      });
    });
  }

  private updateSprings(dt: number): void {
    this.springs.forEach((sp) => {
      sp.cooldown = Math.max(0, sp.cooldown - dt);
      if (sp.cooldown > 0) return;
      if (!this.isOnTop(sp.x1, sp.x2, sp.top)) return;

      const rb = this.rabbit.body as Phaser.Physics.Arcade.Body;
      rb.setVelocityY(-s(780));
      sp.cooldown = 0.45;
      sfx.jump();
      this.cameras.main.shake(s(70), 0.003);
    });
  }

  /* ---------------- 一踩就塌的平台 ---------------- */

  private createCrumbles(): void {
    const defs = [
      { x: 2035, y: 150, w: 46 },
      { x: 2395, y: 150, w: 46 },
    ];

    defs.forEach((d) => {
      const ts = this.add
        .tileSprite(s(d.x) + s(d.w) / 2, s(d.y) + s(8), s(d.w), s(16), 'tile-metal')
        .setDepth(5)
        .setTint(0xffb076);

      this.physics.add.existing(ts, true);
      this.physics.add.collider(this.rabbit, ts);

      this.crumbles.push({
        sprite: ts,
        x1: s(d.x),
        x2: s(d.x + d.w),
        top: s(d.y),
        timer: 0,
        respawn: 0,
        fallen: false,
      });
    });
  }

  private updateCrumbles(dt: number): void {
    this.crumbles.forEach((c) => {
      if (c.fallen) {
        c.respawn -= dt;
        if (c.respawn <= 0) {
          c.fallen = false;
          c.timer = 0;
          c.sprite.setAlpha(1);
          (c.sprite.body as Phaser.Physics.Arcade.StaticBody).enable = true;
        }
        return;
      }

      if (this.isOnTop(c.x1, c.x2, c.top) && c.timer === 0) {
        c.timer = 0.7;
      }

      if (c.timer <= 0) return;

      c.timer -= dt;
      // 抖动提示
      c.sprite.setAlpha(0.55 + Math.sin(this.time.now * 0.06) * 0.35);

      if (c.timer <= 0) {
        c.fallen = true;
        c.respawn = 2.6;
        c.sprite.setAlpha(0.12);
        (c.sprite.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      }
    });
  }

  /* ---------------- 传送带 ---------------- */

  private updateConveyor(dt: number): void {
    const top = s(176);
    if (!this.isOnTop(s(1240), s(1400), top)) return;

    // 直接改位置，避免和输入速度互相打架
    this.rabbit.x -= s(95) * dt;
  }

  private updateEasterEgg(dt: number): void {
    if (this.finished || this.eggRevealed) {
      this.updateEggCoin();
      return;
    }

    const body = this.rabbit.body as Phaser.Physics.Arcade.Body;
    const atLeftWall = body.blocked.left || this.rabbit.x <= s(14);
    const pressingLeft = this.virtualState.left || this.keys.left.some((k) => k.isDown);

    if (atLeftWall && pressingLeft) {
      this.pushTimer += dt;
      if (this.pushTimer >= 2) this.revealEasterEgg();
    } else {
      this.pushTimer = 0;
    }
  }

  private revealEasterEgg(): void {
    this.eggRevealed = true;

    const body = this.rabbit.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(false);

    // 相机也放宽到地图左侧，才能看到兔子走出去
    this.cameras.main.setBounds(-s(260), 0, WORLD_W + s(260), VIRTUAL_H);
    this.cameras.main.shake(220, 0.007);

    this.eggCoin?.setVisible(true);
    sfx.win();
  }

  private updateEggCoin(): void {
    const coin = this.eggCoin;
    if (!coin || !coin.visible || !coin.active) return;

    const d = Phaser.Math.Distance.Between(coin.x, coin.y, this.rabbit.x, this.rabbit.y);
    if (d < s(24)) {
      coin.setActive(false);
      sfx.coin();
      this.tweens.add({
        targets: coin,
        y: coin.y - s(16),
        scale: 1.6,
        alpha: 0,
        duration: 260,
        ease: 'Quad.easeOut',
        onComplete: () => coin.destroy(),
      });
      this.showEggPopup();
    }
  }

  private showEggPopup(): void {
    const cx = VIRTUAL_W / 2;
    const cy = VIRTUAL_H / 2 - 20;

    const panel = this.add
      .rectangle(cx, cy, 520, 92, 0x05101a, 0.94)
      .setStrokeStyle(2, 0xf0b955, 0.85)
      .setScrollFactor(0)
      .setDepth(300);

    const label = this.add
      .text(cx, cy, '这都被你发现了，内场第一排非你莫属！', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffe9b0',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(301);

    // 淡入交给 tween 容易受帧率影响，这里直接显示、延时淡出
    this.tweens.add({
      targets: [panel, label],
      alpha: 0,
      delay: 2600,
      duration: 450,
      onComplete: () => {
        panel.destroy();
        label.destroy();
      },
    });

    this.time.delayedCall(3400, () => sfx.win());
  }

  private createKeys(): RabbitKeys {
    const kb = this.input.keyboard;
    if (!kb) throw new Error('键盘插件不可用');
    return {
      left: [kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT), kb.addKey(Phaser.Input.Keyboard.KeyCodes.A)],
      right: [kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT), kb.addKey(Phaser.Input.Keyboard.KeyCodes.D)],
      jump: [
        kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
        kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      ],
    };
  }

  private createHud(): void {
    // 底部信息条：压得够扁，别把地面盖掉
    const bar = this.add.graphics().setScrollFactor(0).setDepth(99);
    bar.fillStyle(0x040c14, 0.72);
    bar.fillRect(0, VIRTUAL_H - 38, VIRTUAL_W, 38);
    bar.fillStyle(0x1e4a35, 0.9);
    bar.fillRect(0, VIRTUAL_H - 38, VIRTUAL_W, 2);

    this.add
      .text(12, 8, '力兔快跑', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#e2f4e6',
      })
      .setScrollFactor(0)
      .setDepth(100);

    // 静音开关
    const muteBtn = this.add
      .text(92, 7, '♪', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#9fd4f2',
      })
      .setScrollFactor(0)
      .setDepth(100)
      .setInteractive({ useHandCursor: true });

    muteBtn.on('pointerdown', () => {
      sfx.setMuted(!sfx.isMuted);
      muteBtn.setAlpha(sfx.isMuted ? 0.28 : 1);
    });

    // 设置（按键大小）
    const gearBtn = this.add
      .text(120, 7, '⚙', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#9fd4f2',
      })
      .setScrollFactor(0)
      .setDepth(100)
      .setInteractive({ useHandCursor: true });

    gearBtn.on('pointerdown', () => {
      document.getElementById('settings-panel')?.classList.add('show');
    });

    // 生命
    for (let i = 0; i < MAX_LIVES; i += 1) {
      const heart = this.add
        .image(VIRTUAL_W - 20 - i * 18, 18, 'hud-heart')
        .setScrollFactor(0)
        .setDepth(100)
        .setScale(2);
      this.hearts.push(heart);
    }

    // 力力币计数
    if (this.textures.exists('coin-sprite')) {
      this.add
        .image(VIRTUAL_W - 74, 38, 'coin-sprite')
        .setScrollFactor(0)
        .setDepth(100)
        .setScale(0.45);
    }

    this.coinText = this.add
      .text(VIRTUAL_W - 12, 30, '0', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#f7d774',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.add
      .text(
        12,
        VIRTUAL_H - 33,
        this.isTouch ? '左侧 移动    右侧 跳跃' : '← → 移动   空格 跳跃   R 重生',
        {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#cfe6d6',
        },
      )
      .setScrollFactor(0)
      .setDepth(100);

    this.add
      .text(12, VIRTUAL_H - 17, '2027.1.2  成都东安湖体育公园主体育场', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#f0b955',
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.refreshHearts();
    this.refreshCoins();

    // 跳跃强化倒计时
    this.boostText = this.add
      .text(VIRTUAL_W / 2, 40, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffe9b0',
        backgroundColor: '#12301f',
        padding: { x: 9, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);
  }

  private createDebugOverlay(): void {
    this.physics.world.createDebugGraphic();
    this.physics.world.debugGraphic.setVisible(false).setDepth(200);

    this.debugText = this.add
      .text(VIRTUAL_W - 12, 56, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#7fd6a0',
        align: 'right',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(this.showDebug);
  }

  private toggleDebug(): void {
    this.showDebug = !this.showDebug;
    this.debugText.setVisible(this.showDebug);
    const w = this.physics.world;
    if (w.debugGraphic) {
      w.drawDebug = this.showDebug;
      w.debugGraphic.setVisible(this.showDebug);
      w.debugGraphic.clear();
    }
  }

  private refreshHearts(): void {
    this.hearts.forEach((h, i) => {
      h.setTexture(i < this.lives ? 'hud-heart' : 'hud-heart-empty');
    });
  }

  private refreshCoins(): void {
    this.coinText.setText(`${this.coinCount}/${RAW_COINS.length}`);
  }

  /* ---------------- 碰撞与伤害 ---------------- */

  private onTouchEnemy(
    _rabbitObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    enemyObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ): void {
    const enemy = enemyObj as unknown as Mushroom;
    if (enemy.isDead) return;

    const rb = this.rabbit.body as Phaser.Physics.Arcade.Body;
    const eb = enemy.body as Phaser.Physics.Arcade.Body;
    const stomping = rb.velocity.y > 55 && rb.bottom < eb.top + s(14);

    if (stomping) {
      enemy.squash();
      rb.setVelocityY(-s(280));
      this.cameras.main.shake(s(90), 0.004);
      sfx.stomp();
    } else {
      this.hurt(enemy.x);
    }
  }

  private hurt(sourceX: number): void {
    if (this.invincible > 0) return;

    this.lives -= 1;
    this.refreshHearts();
    this.invincible = INVINCIBLE_TIME;

    const rb = this.rabbit.body as Phaser.Physics.Arcade.Body;
    const dir = this.rabbit.x < sourceX ? -1 : 1;
    rb.setVelocity(dir * s(180), -s(200));

    this.cameras.main.shake(s(150), 0.008);
    this.cameras.main.flash(120, 120, 24, 24);
    sfx.hurt();

    if (this.lives <= 0) {
      // 延迟一帧再结算，避免在碰撞回调里直接销毁场景
      this.time.delayedCall(140, () => this.finishLevel(false));
    }
  }

  private collectCoin(coin: Phaser.GameObjects.Image): void {
    // 先标记为不可收集，否则收集动画的 240ms 里每帧都会重复计数
    if (!coin.active) return;
    coin.setActive(false);

    this.coinCount += 1;
    this.refreshCoins();
    sfx.coin();

    this.tweens.add({
      targets: coin,
      y: coin.y - s(14),
      scale: 1.4,
      alpha: 0,
      duration: 240,
      ease: 'Quad.easeOut',
      onComplete: () => coin.destroy(),
    });
  }

  private respawn(): void {
    this.rabbit.respawn(this.spawnX, SPAWN_Y);
    this.cameras.main.flash(120, 20, 40, 30);
  }

  /* --------------------------------------------------------------- */

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    // 调试用：?die=1 直接进失败结算
    if (this.debugDie) {
      this.debugDie = false;
      this.finishLevel(false);
      return;
    }

    if (this.debugEgg) {
      this.debugEgg = false;
      this.revealEasterEgg();
      this.rabbit.setPosition(s(-130), s(200));
    }

    this.rabbit.update(dt);
    this.updateEasterEgg(dt);
    this.updateSpecialCoin(dt);
    this.updateSprings(dt);
    this.updateCrumbles(dt);
    this.updateConveyor(dt);
    this.updateMovers(dt);
    this.updateEnemies();
    this.updateCoins();
    this.updateInvincible(dt);
    this.updateParallax();
    this.updateBelt(dt);
    this.updateHud();

    if (this.rabbit.y > KILL_Y) this.respawn();
    if (!this.finished && this.rabbit.x > FINISH_X) this.finishLevel(true);
  }

  /* ---------------- 触摸屏虚拟按键 ---------------- */

  private readPadScale(): number {
    const raw = Number(window.localStorage.getItem('litu-pad-scale'));
    return Number.isFinite(raw) && raw > 0 ? Phaser.Math.Clamp(raw, 0.8, 1.8) : 1;
  }

  private applyPadScale(scale: number): void {
    this.touchPads.forEach((p) => {
      p.obj.setScale(scale);
      p.text.setScale(scale);
    });
  }

  private onPadScaleEvent = (event: Event): void => {
    const detail = (event as CustomEvent<number>).detail;
    if (typeof detail === 'number') this.applyPadScale(detail);
  };

  private createTouchControls(): void {
    const scale = this.readPadScale();

    const pad = (x: number, y: number, r: number, symbol: string): Phaser.GameObjects.Arc => {
      const c = this.add.circle(x, y, r, 0x08131e, 0.42).setScrollFactor(0).setDepth(150);
      c.setStrokeStyle(2, 0x9fd4f2, 0.45);

      const label = this.add
        .text(x, y, symbol, {
          fontFamily: 'monospace',
          fontSize: r > 40 ? '28px' : '24px',
          color: '#d8ecc0',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(151);

      // 整体包围盒当点击区，比精确圆形好按
      c.setInteractive({ useHandCursor: true });
      this.touchPads.push({ obj: c, text: label });
      return c;
    };

    const bind = (target: Phaser.GameObjects.Arc, key: keyof VirtualInput): void => {
      const press = (): void => {
        target.setFillStyle(0x2f6b52, 0.72);
        this.virtualState[key] = true;
        this.rabbit.setVirtualInput({ [key]: true } as Partial<VirtualInput>);
      };
      const release = (): void => {
        target.setFillStyle(0x08131e, 0.42);
        if (!this.virtualState[key]) return;
        this.virtualState[key] = false;
        this.rabbit.setVirtualInput({ [key]: false } as Partial<VirtualInput>);
      };

      // 只处理这颗按钮自己的事件，不要全局清空
      // （全局 pointerup 会让「按住右 + 点跳跃」在松跳跃时把右键也一起放掉）
      target.on('pointerdown', press);
      target.on('pointerup', release);
      target.on('pointerout', release);
      target.on('pointerupoutside', release);
    };

    // 三个键：左移、右移、跳跃。冲刺已移除
    bind(pad(84, 292, 38, '◀'), 'left');
    bind(pad(176, 292, 38, '▶'), 'right');
    bind(pad(556, 270, 46, '跳'), 'jump');

    this.applyPadScale(scale);

    window.addEventListener('litu-pad-scale', this.onPadScaleEvent);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('litu-pad-scale', this.onPadScaleEvent);
    });
  }

  private finishLevel(cleared: boolean): void {
    if (this.finished) return;
    this.finished = true;
    const elapsed = (this.time.now - this.startedAt) / 1000;

    const body = this.rabbit.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);

    if (cleared) sfx.win();
    else sfx.lose();

    // 先关掉可能还挂着的结算页，保证每次都是全新实例（否则按钮会因为复用而缺失）
    this.scene.stop('Result');
    this.scene.launch('Result', {
      coins: this.coinCount,
      total: RAW_COINS.length,
      time: elapsed,
      cleared,
    });
    this.scene.pause();
  }

  private updateEnemies(): void {
    this.enemyGroup.getChildren().forEach((child) => {
      const e = child as Mushroom;
      if (e.active && e.y > KILL_Y) e.destroy();
    });
  }

  private updateCoins(): void {
    this.coins.forEach((coin) => {
      if (!coin.active) return;
      const d = Phaser.Math.Distance.Between(coin.x, coin.y, this.rabbit.x, this.rabbit.y);
      if (d < s(22)) this.collectCoin(coin);
    });
  }

  private updateInvincible(dt: number): void {
    if (this.invincible <= 0) return;

    this.invincible -= dt;
    if (this.invincible <= 0) {
      this.rabbit.setAlpha(1);
      return;
    }
    this.rabbit.setAlpha(Math.sin(this.time.now * 0.03) > 0 ? 1 : 0.35);
  }

  private updateMovers(dt: number): void {
    const t = this.time.now / 1000;

    this.movers.forEach((m) => {
      const y = m.baseY + Math.sin(t * m.speed) * m.range;
      const dy = y - m.sprite.y;
      if (Math.abs(dy) < 0.001) return;

      m.sprite.y = y;
      const body = m.sprite.body as Phaser.Physics.Arcade.StaticBody;
      body.updateFromGameObject();

      if (this.isStandingOn(m.sprite)) {
        this.rabbit.y += dy;
      }
    });
    void dt;
  }

  private isStandingOn(platform: Phaser.GameObjects.TileSprite): boolean {
    const rb = this.rabbit.body as Phaser.Physics.Arcade.Body;
    const pb = platform.body as Phaser.Physics.Arcade.StaticBody;
    const horizontalOverlap = rb.right > pb.left + 1 && rb.left < pb.right - 1;
    const gap = rb.bottom - pb.top;
    return horizontalOverlap && gap >= -3 && gap <= s(8) && rb.velocity.y >= -20;
  }

  private updateParallax(): void {
    const camX = this.cameras.main.scrollX;

    if (this.bgMain) {
      this.bgMain.tilePositionX = camX * 0.5;
      return;
    }

    if (this.bgFar) this.bgFar.tilePositionX = camX * 0.12;
    if (this.bgMid) this.bgMid.tilePositionX = camX * 0.28;
    if (this.bgNear) this.bgNear.tilePositionX = camX * 0.5;
  }

  private updateBelt(dt: number): void {
    this.belt.tilePositionX += dt * s(40);
  }

  private updateHud(): void {
    if (!this.showDebug) return;
    const s2 = this.rabbit.getDebugState();
    this.debugText.setText(
      [
        `vx ${s2.vx.toString().padStart(4)}  vy ${s2.vy.toString().padStart(4)}`,
        `ground ${s2.onGround ? 'Y' : 'n'}  state ${s2.state}`,
        `coyote ${s2.coyote}ms  buffer ${s2.jumpBuffer}ms`,
        `lives ${this.lives}`,
      ].join('\n'),
    );
  }
}
