export class FarmAudio {
  private ctx: AudioContext | null = null;
  private engine: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  muted = false;

  unlock() {
    if (this.muted) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!this.ctx) this.ctx = new AudioCtx();
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  engineAt(speed: number) {
    if (!this.ctx || this.muted) return;
    const level = Math.min(1, Math.abs(speed) / 9);
    if (level < 0.05) {
      this.stopEngine();
      return;
    }
    if (!this.engine) {
      this.engine = this.ctx.createOscillator();
      this.gain = this.ctx.createGain();
      this.engine.type = "sawtooth";
      this.engine.connect(this.gain);
      this.gain.connect(this.ctx.destination);
      this.gain.gain.value = 0.0001;
      this.engine.start();
    }
    this.engine.frequency.setTargetAtTime(48 + level * 36, this.ctx.currentTime, 0.05);
    this.gain?.gain.setTargetAtTime(0.015 + level * 0.02, this.ctx.currentTime, 0.05);
  }

  stopEngine() {
    if (!this.engine || !this.ctx) return;
    const osc = this.engine;
    const gain = this.gain;
    this.engine = null;
    this.gain = null;
    gain?.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
    window.setTimeout(() => osc.stop(), 120);
  }

  blip(kind: "sell" | "harvest" | "buy" | "ripe" | "done") {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = kind === "harvest" || kind === "sell" ? "triangle" : "square";
    const base = kind === "sell" ? 520 : kind === "harvest" ? 180 : kind === "ripe" ? 640 : 300;
    o.frequency.value = base;
    g.gain.value = 0.04;
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.18);
    o.stop(this.ctx.currentTime + 0.2);
  }
}
