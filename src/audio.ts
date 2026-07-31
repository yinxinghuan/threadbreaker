const MUTE_KEY = 'threadbreaker_muted';

type Voice = { oscillator?: OscillatorNode; source?: AudioBufferSourceNode; gain: GainNode; stop: () => void };

export class ThreadbreakerAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private voices: Voice[] = [];
  private last: Record<string, number> = {};
  muted = readMuted();

  unlock(): void {
    if (!this.context) {
      try {
        const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) return;
        this.context = new AudioContextCtor();
        this.compressor = this.context.createDynamicsCompressor();
        this.compressor.threshold.value = -24;
        this.compressor.knee.value = 10;
        this.compressor.ratio.value = 10;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.16;
        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : 0.2;
        this.master.connect(this.compressor).connect(this.context.destination);
      } catch { this.context = null; }
    }
    void this.context?.resume().catch(() => undefined);
  }

  setMuted(value: boolean): void {
    this.muted = value;
    try { localStorage.setItem(MUTE_KEY, value ? '1' : '0'); } catch {}
    if (this.master && this.context) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setTargetAtTime(value ? 0 : 0.2, this.context.currentTime, 0.012);
    }
    if (value) this.stopAll();
  }

  shot(): void { this.tone('shot', 760, 610, 0.026, 'square', 0.045, 0.12); }
  hit(combo: number): void { this.tone('hit', 180 + Math.min(4, combo) * 24, 150, 0.042, 'triangle', 0.075, 0.055); }
  split(): void {
    if (!this.allow('split', 0.08)) return;
    this.toneRaw(258, 208, 0.055, 'square', 0.09, 0);
    this.toneRaw(392, 310, 0.05, 'triangle', 0.07, 0.034);
  }
  reverse(): void { this.tone('reverse', 420, 285, 0.062, 'sawtooth', 0.048, 0.12); }
  danger(): void { this.tone('danger', 96, 82, 0.085, 'square', 0.085, 0.42); }
  playerHit(): void {
    this.stopAll();
    this.toneRaw(148, 54, 0.24, 'sawtooth', 0.13, 0);
    this.noise(0.105, 0.1);
  }
  clear(): void {
    this.stopAll();
    this.toneRaw(312, 390, 0.08, 'triangle', 0.075, 0);
    this.toneRaw(468, 590, 0.1, 'triangle', 0.07, 0.075);
    this.toneRaw(624, 702, 0.12, 'sine', 0.065, 0.16);
  }
  returnComplete(): void {
    this.tone('return', 286, 244, 0.052, 'square', 0.052, 0.18);
    this.noise(0.055, 0.045);
  }
  ui(): void { this.tone('ui', 238, 270, 0.035, 'square', 0.035, 0.08); }

  stopAll(): void {
    const voices = this.voices.splice(0);
    for (const voice of voices) voice.stop();
  }

  debug(): { unlocked: boolean; state: string; voices: number; muted: boolean; limiter: boolean } {
    return { unlocked: Boolean(this.context), state: this.context?.state || 'none', voices: this.voices.length, muted: this.muted, limiter: Boolean(this.compressor) };
  }

  private allow(key: string, interval: number): boolean {
    if (!this.context || this.muted || this.context.state !== 'running') return false;
    const now = this.context.currentTime;
    if (now - (this.last[key] ?? -99) < interval) return false;
    this.last[key] = now;
    return true;
  }

  private tone(key: string, from: number, to: number, duration: number, type: OscillatorType, gain: number, interval: number): void {
    if (!this.allow(key, interval)) return;
    this.toneRaw(from, to, duration, type, gain, 0);
  }

  private toneRaw(from: number, to: number, duration: number, type: OscillatorType, gainValue: number, delay: number): void {
    const context = this.context;
    if (!context || !this.master || this.muted || context.state !== 'running') return;
    while (this.voices.length >= 8) this.voices.shift()?.stop();
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, to), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.master);
    const voice: Voice = { oscillator, gain, stop: () => { try { oscillator.stop(); } catch {} try { oscillator.disconnect(); gain.disconnect(); } catch {} } };
    this.voices.push(voice);
    oscillator.onended = () => { this.voices = this.voices.filter((item) => item !== voice); };
    oscillator.start(start); oscillator.stop(start + duration + 0.012);
  }

  private noise(duration: number, gainValue: number): void {
    const context = this.context;
    if (!context || !this.master || this.muted || context.state !== 'running') return;
    while (this.voices.length >= 8) this.voices.shift()?.stop();
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = ((i * 16807) % 127 / 63.5 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 860; filter.Q.value = 0.9;
    const gain = context.createGain(); gain.gain.setValueAtTime(gainValue, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    source.buffer = buffer; source.connect(filter).connect(gain).connect(this.master);
    const voice: Voice = { source, gain, stop: () => { try { source.stop(); } catch {} try { source.disconnect(); filter.disconnect(); gain.disconnect(); } catch {} } };
    this.voices.push(voice); source.onended = () => { this.voices = this.voices.filter((item) => item !== voice); };
    source.start(); source.stop(context.currentTime + duration + 0.01);
  }
}

function readMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}
