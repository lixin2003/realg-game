/**
 * 8-bit 音效合成器。
 *
 * 全部用 Web Audio 现场合成，不加载任何音频文件，所以体积是 0。
 * 音色刻意做成 FC 时代那种方波 / 三角波 / 噪声。
 */

type Wave = OscillatorType;

interface ToneOptions {
  freq: number;
  /** 滑音终点频率 */
  to?: number;
  dur: number;
  wave?: Wave;
  gain?: number;
  delay?: number;
}

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  private ensure(): { ctx: AudioContext; master: GainNode } | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;

      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      // 整体音量压低，避免刺耳
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
    }

    // 浏览器要求用户交互后才能出声
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return { ctx: this.ctx, master: this.master as GainNode };
  }

  /** 在第一次点击 / 按键时调用，解锁音频上下文 */
  unlock(): void {
    this.ensure();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  private tone(o: ToneOptions): void {
    if (this.muted) return;
    const audio = this.ensure();
    if (!audio) return;

    const { ctx, master } = audio;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = o.wave ?? 'square';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to && o.to > 0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.dur);
    }

    const peak = o.gain ?? 0.12;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);

    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.02);
  }

  /** 白噪声，用于打击和冲刺 */
  private noise(dur: number, gain = 0.06, delay = 0): void {
    if (this.muted) return;
    const audio = this.ensure();
    if (!audio) return;

    const { ctx, master } = audio;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(master);
    src.start(ctx.currentTime + delay);
  }

  /* ---------------- 游戏动作 ---------------- */

  jump(): void {
    this.tone({ freq: 330, to: 760, dur: 0.13, wave: 'square', gain: 0.09 });
  }

  land(): void {
    this.tone({ freq: 190, to: 90, dur: 0.07, wave: 'triangle', gain: 0.06 });
  }

  dash(): void {
    this.noise(0.13, 0.045);
    this.tone({ freq: 540, to: 170, dur: 0.13, wave: 'sawtooth', gain: 0.045 });
  }

  coin(): void {
    this.tone({ freq: 988, dur: 0.06, wave: 'square', gain: 0.07 });
    this.tone({ freq: 1319, dur: 0.1, wave: 'square', gain: 0.07, delay: 0.055 });
  }

  stomp(): void {
    this.tone({ freq: 280, to: 70, dur: 0.12, wave: 'square', gain: 0.1 });
    this.noise(0.07, 0.045);
  }

  hurt(): void {
    this.tone({ freq: 320, to: 85, dur: 0.28, wave: 'sawtooth', gain: 0.085 });
  }

  win(): void {
    [523, 659, 784, 1047].forEach((f, i) => {
      this.tone({ freq: f, dur: 0.16, wave: 'square', gain: 0.075, delay: i * 0.1 });
    });
  }

  lose(): void {
    [392, 330, 262].forEach((f, i) => {
      this.tone({ freq: f, dur: 0.22, wave: 'triangle', gain: 0.085, delay: i * 0.14 });
    });
  }

  click(): void {
    this.tone({ freq: 720, dur: 0.05, wave: 'square', gain: 0.055 });
  }
}

export const sfx = new Sfx();
