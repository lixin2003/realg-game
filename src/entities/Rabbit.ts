import Phaser from 'phaser';
import { TEX, TUNING } from '../config';

/** 每个动作都支持多个物理按键 */
export interface RabbitKeys {
  left: Phaser.Input.Keyboard.Key[];
  right: Phaser.Input.Keyboard.Key[];
  jump: Phaser.Input.Keyboard.Key[];
}

/** 触摸屏虚拟按键的状态 */
export interface VirtualInput {
  left: boolean;
  right: boolean;
  jump: boolean;
}

function anyDown(keys: Phaser.Input.Keyboard.Key[]): boolean {
  return keys.some((k) => k.isDown);
}

/** 注意：要遍历全部按键再返回，保证每个键的 JustDown 状态都被消费掉 */
function anyJustDown(keys: Phaser.Input.Keyboard.Key[]): boolean {
  let pressed = false;
  for (const k of keys) {
    if (Phaser.Input.Keyboard.JustDown(k)) pressed = true;
  }
  return pressed;
}

export interface RabbitDebugState {
  vx: number;
  vy: number;
  onGround: boolean;
  coyote: number;
  jumpBuffer: number;
  state: string;
}

/**
 * 玩家角色：兔子。
 *
 * 手感四件套：土狼时间、跳跃缓冲、固定跳跃高度、下落加重。
 * 方向、跳跃各自独立处理，按住方向同时点跳跃不会互相干扰。
 */
export class Rabbit extends Phaser.Physics.Arcade.Sprite {
  private keys: RabbitKeys;
  private realArt = false;

  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private facing = 1;

  private wasOnGround = true;
  private prevVelocityY = 0;
  private currentState = 'idle';
  /** 跳跃力倍率，吃到强化道具时临时调高 */
  private jumpMultiplier = 1;

  /** 由场景挂上的音效钩子 */
  onJump?: () => void;
  onLand?: () => void;

  /** 触摸屏输入，和键盘并行生效 */
  private virtual: VirtualInput = { left: false, right: false, jump: false };
  private virtualJumpJust = false;

  constructor(scene: Phaser.Scene, x: number, y: number, keys: RabbitKeys) {
    const hasRealArt = scene.textures.exists('rabbit-sprite');
    super(scene, x, y, hasRealArt ? 'rabbit-sprite' : `${TEX.rabbit}-idle-0`);

    this.keys = keys;
    this.realArt = hasRealArt;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 0.5);
    this.setDepth(10);

    const body = this.body as Phaser.Physics.Arcade.Body;
    if (hasRealArt) {
      // 44x64 的正式图，脚底贴着画布底边
      body.setSize(22, 56);
      body.setOffset(11, 8);
    } else {
      body.setSize(16, 28);
      body.setOffset(7, 4);
    }
    body.setMaxVelocity(TUNING.maxRunSpeed * 2, TUNING.maxFallSpeed);
    body.setCollideWorldBounds(true);

    if (!hasRealArt) {
      this.createAnimations(scene);
      this.anims.play(`${TEX.rabbit}-idle`, true);
    }
  }

  private createAnimations(scene: Phaser.Scene): void {
    const build = (pose: string, count: number, frameRate: number, repeat: number) => {
      const key = `${TEX.rabbit}-${pose}`;
      if (scene.anims.exists(key)) return;
      scene.anims.create({
        key,
        frames: Array.from({ length: count }, (_, i) => ({ key: `${TEX.rabbit}-${pose}-${i}` })),
        frameRate,
        repeat,
      });
    };

    build('idle', 4, 4, -1);
    build('run', 6, 12, -1);
    build('jump', 2, 8, 0);
    build('fall', 2, 6, 0);
  }

  /** 由场景在虚拟按键按下/抬起时调用 */
  setVirtualInput(next: Partial<VirtualInput>): void {
    if (next.jump === true && !this.virtual.jump) this.virtualJumpJust = true;
    Object.assign(this.virtual, next);
  }

  /** 临时改变跳跃力倍率（跳跃高度按倍率的平方走） */
  setJumpBoost(multiplier: number): void {
    this.jumpMultiplier = multiplier;
  }

  private doJump(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityY(TUNING.jumpVelocity * this.jumpMultiplier);
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.onJump?.();

    if (!this.realArt) {
      this.scene.tweens.add({
        targets: this,
        scaleX: 0.82,
        scaleY: 1.2,
        duration: 70,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    }
  }

  private playState(state: string): void {
    if (this.currentState === state) return;
    this.currentState = state;
    if (!this.realArt) this.anims.play(`${TEX.rabbit}-${state}`, true);
  }

  /** 单帧美术的替代动画：用缩放和轻微倾斜做出跑、跳、落的动感 */
  private applyProceduralAnim(): void {
    const t = this.scene.time.now * 0.018;
    let sx = 1;
    let sy = 1;
    let angle = 0;

    switch (this.currentState) {
      case 'run': {
        const bob = Math.sin(t * 2);
        sx = 1 - bob * 0.03;
        sy = 1 + bob * 0.03;
        angle = Math.sin(t) * 3 * this.facing;
        break;
      }
      case 'jump':
        sx = 0.9;
        sy = 1.1;
        angle = this.facing * 5;
        break;
      case 'fall':
        sx = 1.04;
        sy = 0.98;
        angle = this.facing * -3;
        break;
      default:
        sy = 1 + Math.sin(t * 0.7) * 0.02;
        break;
    }

    this.setScale(
      Phaser.Math.Linear(this.scaleX, sx, 0.25),
      Phaser.Math.Linear(this.scaleY, sy, 0.25),
    );
    this.setAngle(Phaser.Math.Linear(this.angle, angle, 0.2));
  }

  update(deltaSeconds: number): void {
    const dt = Math.min(deltaSeconds, 1 / 30);
    const body = this.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;

    // ---- 计时器 ----
    if (onGround) {
      if (!this.wasOnGround && this.prevVelocityY > 140) {
        this.onLand?.();
        if (!this.realArt) {
          this.scene.tweens.add({
            targets: this,
            scaleX: 1.22,
            scaleY: 0.8,
            duration: 70,
            yoyo: true,
            ease: 'Quad.easeOut',
          });
        }
      }
      this.coyoteTimer = TUNING.coyoteTime;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    if (anyJustDown(this.keys.jump) || this.virtualJumpJust) {
      this.jumpBufferTimer = TUNING.jumpBuffer;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }
    this.virtualJumpJust = false;

    // ---- 方向控制 ----
    let dir = 0;
    if (anyDown(this.keys.left) || this.virtual.left) dir -= 1;
    if (anyDown(this.keys.right) || this.virtual.right) dir += 1;

    if (dir !== 0) {
      this.facing = dir;
      this.setFlipX(dir < 0);

      const target = dir * TUNING.maxRunSpeed;
      const accel = (onGround ? TUNING.groundAccel : TUNING.airAccel) * dt;
      if (body.velocity.x < target) {
        body.velocity.x = Math.min(target, body.velocity.x + accel);
      } else {
        body.velocity.x = Math.max(target, body.velocity.x - accel);
      }
    } else {
      // 松开方向键就靠摩擦停下来
      const friction = (onGround ? TUNING.groundFriction : TUNING.airFriction) * dt;
      const speed = Math.abs(body.velocity.x);
      body.velocity.x =
        speed <= friction ? 0 : body.velocity.x - Math.sign(body.velocity.x) * friction;
    }

    // 下落时加重，手感更干脆
    body.setGravityY(body.velocity.y > 0 ? TUNING.gravity * (TUNING.fallMultiplier - 1) : 0);

    // 起跳：按一下就是固定高度，不再看松手时机
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.doJump();
    }

    // ---- 动画状态 ----
    if (!onGround) {
      this.playState(body.velocity.y < 0 ? 'jump' : 'fall');
    } else if (Math.abs(body.velocity.x) > 20) {
      this.playState('run');
      this.anims.timeScale = Phaser.Math.Clamp(Math.abs(body.velocity.x) / TUNING.maxRunSpeed, 0.6, 1.6);
    } else {
      this.playState('idle');
      this.anims.timeScale = 1;
    }

    if (this.realArt) this.applyProceduralAnim();

    this.wasOnGround = onGround;
    this.prevVelocityY = body.velocity.y;
  }

  /** 重置到出生点 */
  respawn(x: number, y: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.setPosition(x, y);
    body.setVelocity(0, 0);
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
  }

  getDebugState(): RabbitDebugState {
    const body = this.body as Phaser.Physics.Arcade.Body;
    return {
      vx: Math.round(body.velocity.x),
      vy: Math.round(body.velocity.y),
      onGround: body.blocked.down || body.touching.down,
      coyote: Math.round(this.coyoteTimer * 1000),
      jumpBuffer: Math.round(this.jumpBufferTimer * 1000),
      state: this.currentState,
    };
  }
}
