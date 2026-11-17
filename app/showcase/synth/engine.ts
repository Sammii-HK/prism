/**
 * A small polyphonic Web Audio synthesiser.
 *
 *   voice (2 detuned oscillators + optional sub) -> amp envelope
 *     -> shared low-pass filter -> master gain -> limiter -> analyser -> out
 *
 * Nothing touches the audio hardware until `ensure()` is called from a user
 * gesture. Every parameter change is ramped (setTargetAtTime) so dragging a
 * control never clicks or zips.
 */

export type Wave = "sine" | "triangle" | "sawtooth" | "square";

export type SynthParams = {
  wave: Wave;
  /** Seconds. */
  attack: number;
  decay: number;
  /** 0 to 1. */
  sustain: number;
  release: number;
  /** Filter cutoff in Hz. */
  cutoff: number;
  /** Filter Q. */
  resonance: number;
  /** Spread between the two oscillators, in cents. */
  detune: number;
  /** Add a sine one octave down. */
  sub: boolean;
  /** 0 to 1, mapped to a gentle curve. */
  volume: number;
};

export type EngineStatus = "off" | "running" | "suspended";

export type EngineSnapshot = {
  status: EngineStatus;
  /** Notes being held (by a finger, a key or the hold latch). */
  held: number[];
  /** Voices still making sound, including release tails. */
  voices: number;
};

export const MAX_VOICES = 8;

/** Rough loudness matching so switching waveform doesn't jump in level. */
const WAVE_LEVEL: Record<Wave, number> = { sine: 0.3, triangle: 0.28, sawtooth: 0.15, square: 0.12 };

/** Ramp time constant for live parameter changes, in seconds. */
const SMOOTH = 0.02;

type Voice = {
  midi: number;
  osc1: OscillatorNode;
  osc2: OscillatorNode;
  sub: OscillatorNode;
  mix: GainNode;
  subGain: GainNode;
  amp: GainNode;
  /** How many sources (pointer, key, focus) are holding this note. */
  holders: number;
  /** Kept sounding by the hold latch after every source let go. */
  latched: boolean;
  released: boolean;
  startedAt: number;
};

export const midiToHz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

const volumeGain = (v: number) => v * v * 1.4;

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

const SERVER_SNAPSHOT: EngineSnapshot = { status: "off", held: [], voices: 0 };

export class SynthEngine {
  params: SynthParams;

  private ctx: AudioContext | null = null;
  private filter: BiquadFilterNode | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private voices: Voice[] = [];
  private hold = false;
  private listeners = new Set<() => void>();
  private snapshot: EngineSnapshot = SERVER_SNAPSHOT;
  private buf: Float32Array<ArrayBuffer> | null = null;
  private levelCache = { at: -1, value: 0 };

  constructor(params: SynthParams) {
    this.params = { ...params };
  }

  // --- React store plumbing (useSyncExternalStore) -------------------------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  static serverSnapshot = () => SERVER_SNAPSHOT;

  private emit() {
    const state = this.ctx?.state;
    this.snapshot = {
      status: !this.ctx || state === "closed" ? "off" : state === "running" ? "running" : "suspended",
      held: this.voices.filter((v) => !v.released).map((v) => v.midi).sort((a, b) => a - b),
      voices: this.voices.length,
    };
    this.listeners.forEach((l) => l());
  }

  // --- Lifecycle ------------------------------------------------------------

  /**
   * Create or resume the AudioContext. Call from inside a user gesture
   * (pointerdown, keydown, click): browsers refuse to start audio otherwise.
   */
  ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor({ latencyHint: "interactive" });

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = this.params.cutoff;
      filter.Q.value = this.params.resonance;

      const master = ctx.createGain();
      master.gain.value = volumeGain(this.params.volume);

      // A fast, hard compressor as a safety limiter: resonant squares across
      // eight voices should never reach the speakers at full scale.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.6;

      filter.connect(master);
      master.connect(limiter);
      limiter.connect(analyser);
      analyser.connect(ctx.destination);

      ctx.onstatechange = () => this.emit();

      this.ctx = ctx;
      this.filter = filter;
      this.master = master;
      this.analyser = analyser;
      this.buf = new Float32Array(analyser.fftSize);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.emit();
    return this.ctx;
  }

  dispose() {
    this.voices = [];
    const ctx = this.ctx;
    this.ctx = null;
    this.filter = null;
    this.master = null;
    this.analyser = null;
    if (ctx && ctx.state !== "closed") void ctx.close();
    this.emit();
  }

  // --- Notes ----------------------------------------------------------------

  noteOn(midi: number) {
    const ctx = this.ensure();
    if (!ctx || !this.filter) return;

    // Another source already holds this note: share the voice, don't stack.
    const existing = this.voices.find((v) => v.midi === midi && !v.released);
    if (existing) {
      existing.holders += 1;
      existing.latched = false;
      return;
    }

    // Out of voices: steal the oldest, with a fade short enough to be inaudible
    // but long enough not to click.
    while (this.voices.length >= MAX_VOICES) {
      const oldest = this.voices.reduce((a, b) => (a.released === b.released ? (a.startedAt <= b.startedAt ? a : b) : a.released ? a : b));
      this.kill(oldest, 0.008);
      this.voices = this.voices.filter((v) => v !== oldest);
    }

    const p = this.params;
    const now = ctx.currentTime;
    const hz = midiToHz(midi);

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = p.wave;
    osc2.type = p.wave;
    osc1.frequency.value = hz;
    osc2.frequency.value = hz;
    osc1.detune.value = -p.detune / 2;
    osc2.detune.value = p.detune / 2;

    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = hz / 2;

    const mix = ctx.createGain();
    mix.gain.value = WAVE_LEVEL[p.wave] * 0.55;
    const subGain = ctx.createGain();
    subGain.gain.value = p.sub ? 0.22 : 0;

    const amp = ctx.createGain();
    const g = amp.gain;
    g.setValueAtTime(0, now);
    const attack = Math.max(0.003, p.attack);
    g.linearRampToValueAtTime(1, now + attack);
    g.setTargetAtTime(Math.max(0.0001, p.sustain), now + attack, Math.max(0.005, p.decay / 4));

    osc1.connect(mix);
    osc2.connect(mix);
    mix.connect(amp);
    sub.connect(subGain);
    subGain.connect(amp);
    amp.connect(this.filter);

    osc1.start(now);
    osc2.start(now);
    sub.start(now);

    const voice: Voice = { midi, osc1, osc2, sub, mix, subGain, amp, holders: 1, latched: false, released: false, startedAt: now };
    osc1.onended = () => {
      [osc1, osc2, sub, mix, subGain, amp].forEach((n) => n.disconnect());
      this.voices = this.voices.filter((v) => v !== voice);
      this.emit();
    };
    this.voices.push(voice);
    this.emit();
  }

  noteOff(midi: number) {
    const voice = this.voices.find((v) => v.midi === midi && !v.released);
    if (!voice) return;
    voice.holders = Math.max(0, voice.holders - 1);
    if (voice.holders > 0) return;
    if (this.hold) {
      voice.latched = true;
      return;
    }
    this.release(voice);
  }

  /** Latch notes after release, like a sustain pedal. */
  setHold(on: boolean) {
    this.hold = on;
    if (!on) this.voices.filter((v) => v.latched && !v.released).forEach((v) => this.release(v));
  }

  /** Stop everything, quickly but without a click. */
  panic() {
    this.voices.forEach((v) => {
      v.holders = 0;
      v.latched = false;
      if (!v.released) this.kill(v, 0.03);
    });
    this.emit();
  }

  private release(voice: Voice) {
    if (!this.ctx) return;
    voice.released = true;
    const release = Math.max(0.02, this.params.release);
    this.fadeOut(voice, release / 5, release + 0.15);
    this.emit();
  }

  private kill(voice: Voice, tau: number) {
    voice.released = true;
    this.fadeOut(voice, tau, tau * 6 + 0.02);
  }

  private fadeOut(voice: Voice, tau: number, stopAfter: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const g = voice.amp.gain;
    // Hold wherever the envelope is right now, then fall from there.
    if (typeof g.cancelAndHoldAtTime === "function") {
      g.cancelAndHoldAtTime(now);
    } else {
      const current = g.value;
      g.cancelScheduledValues(now);
      g.setValueAtTime(current, now);
    }
    g.setTargetAtTime(0, now, tau);
    const stopAt = now + stopAfter;
    for (const o of [voice.osc1, voice.osc2, voice.sub]) {
      try {
        o.stop(stopAt);
      } catch {
        // Already scheduled to stop earlier; that's fine.
      }
    }
  }

  // --- Parameters -------------------------------------------------------------

  setParams(patch: Partial<SynthParams>) {
    this.params = { ...this.params, ...patch };
    const ctx = this.ctx;
    if (!ctx || !this.filter || !this.master) return;
    const now = ctx.currentTime;
    const p = this.params;

    if (patch.cutoff !== undefined) this.filter.frequency.setTargetAtTime(p.cutoff, now, SMOOTH);
    if (patch.resonance !== undefined) this.filter.Q.setTargetAtTime(p.resonance, now, SMOOTH);
    if (patch.volume !== undefined) this.master.gain.setTargetAtTime(volumeGain(p.volume), now, 0.03);

    for (const v of this.voices) {
      if (patch.wave !== undefined) {
        v.osc1.type = p.wave;
        v.osc2.type = p.wave;
        v.mix.gain.setTargetAtTime(WAVE_LEVEL[p.wave] * 0.55, now, SMOOTH);
      }
      if (patch.detune !== undefined) {
        v.osc1.detune.setTargetAtTime(-p.detune / 2, now, SMOOTH);
        v.osc2.detune.setTargetAtTime(p.detune / 2, now, SMOOTH);
      }
      if (patch.sub !== undefined) v.subGain.gain.setTargetAtTime(p.sub ? 0.22 : 0, now, SMOOTH);
    }
  }

  // --- Metering ---------------------------------------------------------------

  /** Fill `out` with the latest output samples. Returns false before audio starts. */
  readWaveform(out: Float32Array<ArrayBuffer>): boolean {
    if (!this.analyser) return false;
    this.analyser.getFloatTimeDomainData(out);
    return true;
  }

  get bufferSize() {
    return this.analyser?.fftSize ?? 2048;
  }

  /** RMS output level, 0 to ~1. Cached per frame so several readers share one read. */
  level(): number {
    const now = performance.now();
    if (now - this.levelCache.at < 12) return this.levelCache.value;
    let value = 0;
    if (this.analyser && this.buf && this.voices.length > 0) {
      this.analyser.getFloatTimeDomainData(this.buf);
      let sum = 0;
      for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
      value = Math.sqrt(sum / this.buf.length);
    }
    this.levelCache = { at: now, value };
    return value;
  }
}
