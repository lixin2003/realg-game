import Phaser from 'phaser';

/** 巡逻速度，单位像素/秒 */
const WALK_SPEED = 34;

/**
 * 蘑菇敌人。
 * 行为：在自己那段平台上左右巡逻，到边界或撞墙就转身，
 * 不会走下平台掉进虚空；被踩则压扁消失。
 *
 * 有正式美术（纹理 `mushroom-sprite`）时用单帧图 + 轻微弹跳模拟走路；
 * 否则退回代码生成的逐帧占位蘑菇。
 */
export class Mushroom extends Phaser.Physics.Arcade.Sprite {
  private dir = -1;
  private dead = false;
  private realArt = false;
  /** 巡逻范围，由关卡在生成时指定，防止走进坑里 */
  private patrolLeft: number;
  private patrolRight: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    patrolLeft = Number.NEGATIVE_INFINITY,
    patrolRight = Number.POSITIVE_INFINITY,
  ) {
    const hasRealArt = scene.textures.exists('mushroom-sprite');
    super(scene, x, y, hasRealArt ? 'mushroom-sprite' : 'mushroom-walk-0');

    this.realArt = hasRealArt;
    this.patrolLeft = patrolLeft;
    this.patrolRight = patrolRight;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(9);

    const body = this.body as Phaser.Physics.Arcade.Body;
    if (hasRealArt) {
      // 54x62 的正式图，脚底贴着画布底边
      body.setSize(26, 48);
      body.setOffset(14, 14);
    } else {
      body.setSize(18, 18);
      body.setOffset(3, 5);
    }
    body.setBounce(0);
    body.setVelocityX(this.dir * WALK_SPEED);

    if (!hasRealArt) {
      if (!scene.anims.exists('mushroom-walk')) {
        scene.anims.create({
          key: 'mushroom-walk',
          frames: [0, 1, 2, 3].map((i) => ({ key: `mushroom-walk-${i}` })),
          frameRate: 6,
          repeat: -1,
        });
      }
      this.anims.play('mushroom-walk');
    }
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.dead) return;

    const body = this.body as Phaser.Physics.Arcade.Body;

    // 到巡逻边界就转身，避免走进坑里
    if (this.x <= this.patrolLeft) this.dir = 1;
    else if (this.x >= this.patrolRight) this.dir = -1;

    // 撞墙也转身
    if (body.blocked.left) this.dir = 1;
    else if (body.blocked.right) this.dir = -1;

    body.setVelocityX(this.dir * WALK_SPEED);

    if (this.realArt) {
      // 只有一张图，用轻微上下压扁模拟走路
      this.setScale(1, 1 + Math.sin(time * 0.012) * 0.035);
    }
  }

  /** 被踩：压扁后消失 */
  squash(): void {
    if (this.dead) return;
    this.dead = true;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    this.anims.stop();

    this.scene.tweens.add({
      targets: this,
      scaleX: 1.3,
      scaleY: 0.2,
      alpha: 0,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => this.destroy(),
    });
  }

  get isDead(): boolean {
    return this.dead;
  }
}
