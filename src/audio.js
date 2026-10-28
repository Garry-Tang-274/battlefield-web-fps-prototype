import { clamp } from "./core.js?rev=20261028-r3";

// Original, layered Web Audio synthesis. No samples or network requests.
export class BattlefieldAudio {
  constructor() {
    this.ctx = null;
    this.volume = 0.65;
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
    this.voices = 0;
    this.active = false;
  }
  async unlock() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      this.ctx = new AudioContext();
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = this.volume;
      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -14;
      limiter.knee.value = 12;
      limiter.ratio.value = 5;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.16;
      this.master.connect(limiter);
      this.analyser = c.createAnalyser();
      this.analyser.fftSize = 256;
      this.meterData = new Float32Array(256);
      limiter.connect(this.analyser);
      this.analyser.connect(c.destination);
      this.peak = 0;
      this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const data = this.noise.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = white * 0.7 + last * 3;
      }
      this.ambience = c.createGain();
      this.ambience.gain.value = 0.045;
      this.ambience.connect(this.master);
      const wind = c.createBufferSource();
      wind.buffer = this.noise;
      wind.loop = true;
      const low = c.createBiquadFilter();
      low.type = "lowpass";
      low.frequency.value = 380;
      wind.connect(low);
      low.connect(this.ambience);
      wind.start();
      this.engine = c.createOscillator();
      this.engine.type = "sawtooth";
      this.engine.frequency.value = 35;
      this.engineGain = c.createGain();
      this.engineGain.gain.value = 0;
      const engineLow = c.createBiquadFilter();
      engineLow.type = "lowpass";
      engineLow.frequency.value = 230;
      this.engine.connect(engineLow);
      engineLow.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engine.start();
    }
    try {
      await this.ctx.resume();
      this.active = true;
      return true;
    } catch {
      return false;
    }
  }
  setVolume(value) {
    this.volume = clamp(value, 0, 1);
    if (this.master)
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
  }
  meter() {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.meterData);
    const peak = this.meterData.reduce((a, b) => Math.max(a, Math.abs(b)), 0);
    this.peak = Math.max(peak, (this.peak || 0) * 0.98);
    return this.peak;
  }
  pause() {
    if (this.ctx?.state === "running") this.ctx.suspend();
    this.active = false;
  }
  setListener(p, yaw) {
    Object.assign(this.listener, { x: p.x, y: p.y, z: p.z, yaw });
  }
  engineSpeed(speed, on) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.engine.frequency.setTargetAtTime(32 + Math.abs(speed) * 3, now, 0.12);
    this.engineGain.gain.setTargetAtTime(
      on ? 0.025 + Math.abs(speed) * 0.002 : 0,
      now,
      0.15,
    );
  }
  bus(position, volume = 1) {
    if (!this.ctx || this.ctx.state !== "running" || this.voices > 52)
      return null;
    const c = this.ctx,
      gain = c.createGain(),
      low = c.createBiquadFilter(),
      pan = c.createStereoPanner();
    low.type = "lowpass";
    let attenuation = 1,
      stereo = 0,
      d = 0;
    if (position) {
      const dx = position.x - this.listener.x,
        dz = position.z - this.listener.z;
      d = Math.hypot(dx, dz);
      attenuation = 1 / (1 + d * 0.045 + d * d * 0.0007);
      stereo = clamp(
        (dx * Math.cos(this.listener.yaw) - dz * Math.sin(this.listener.yaw)) /
          Math.max(6, d),
        -0.95,
        0.95,
      );
    }
    low.frequency.value = position
      ? clamp(14000 / (1 + d * 0.05), 900, 14000)
      : 16000;
    gain.gain.value = volume * attenuation;
    pan.pan.value = stereo;
    gain.connect(low);
    low.connect(pan);
    pan.connect(this.master);
    this.voices++;
    return {
      input: gain,
      close: () => {
        gain.disconnect();
        low.disconnect();
        pan.disconnect();
        this.voices--;
      },
    };
  }
  noiseBurst(
    bus,
    start,
    duration,
    gain,
    filter = 1800,
    type = "lowpass",
    rate = 1,
  ) {
    const c = this.ctx,
      source = c.createBufferSource(),
      f = c.createBiquadFilter(),
      env = c.createGain();
    source.buffer = this.noise;
    source.playbackRate.value = rate;
    f.type = type;
    f.frequency.value = filter;
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(gain, start + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(f);
    f.connect(env);
    env.connect(bus.input);
    source.start(start, Math.random());
    source.stop(start + duration + 0.02);
    source.onended = () => {
      source.disconnect();
      f.disconnect();
      env.disconnect();
    };
    return source;
  }
  tone(bus, start, duration, freq, end, gain, type = "sine") {
    const c = this.ctx,
      o = c.createOscillator(),
      env = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(20, end),
      start + duration,
    );
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(gain, start + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    o.connect(env);
    env.connect(bus.input);
    o.start(start);
    o.stop(start + duration + 0.02);
    o.onended = () => {
      o.disconnect();
      env.disconnect();
    };
    return o;
  }
  finish(bus, source) {
    source.addEventListener("ended", bus.close, { once: true });
  }
  gun(kind, position = null) {
    const bus = this.bus(position, position ? 0.7 : 0.8);
    if (!bus) return;
    const now = this.ctx.currentTime;
    const k = {
      rifle: [0.24, 150, 1.05, 3000],
      smg: [0.17, 180, 0.78, 3600],
      shotgun: [0.45, 100, 1.4, 1900],
      sniper: [0.5, 85, 1.35, 2400],
      pistol: [0.22, 190, 0.85, 4000],
      turret: [0.3, 110, 1.05, 2400],
    }[kind] || [0.24, 150, 1, 3000];
    this.noiseBurst(bus, now, 0.032, k[2] * 0.75, 8500, "highpass");
    this.tone(bus, now, k[0] * 0.7, k[1], 35, k[2] * 0.75, "triangle");
    this.noiseBurst(
      bus,
      now,
      k[0],
      k[2],
      k[3],
      "lowpass",
      0.92 + Math.random() * 0.16,
    );
    this.noiseBurst(bus, now + 0.055, k[0] * 0.9, k[2] * 0.17, 900, "bandpass");
    const tail = this.noiseBurst(bus, now + 0.1, k[0] * 1.6, k[2] * 0.11, 750);
    this.finish(bus, tail);
  }
  step(surface = "sand", sprint = false, position = null) {
    const bus = this.bus(position, sprint ? 0.19 : 0.13);
    if (!bus) return;
    const t = this.ctx.currentTime;
    this.tone(bus, t, 0.065, surface === "metal" ? 180 : 95, 45, 0.45);
    this.finish(
      bus,
      this.noiseBurst(
        bus,
        t,
        0.12,
        surface === "sand" ? 0.7 : 0.5,
        surface === "sand" ? 1600 : 3800,
        "lowpass",
        0.9 + Math.random() * 0.2,
      ),
    );
  }
  reload(stage = 0) {
    const b = this.bus(null, 0.22);
    if (!b) return;
    const t = this.ctx.currentTime;
    this.tone(b, t, 0.06, stage ? 1100 : 650, 200, 0.12, "square");
    this.finish(b, this.noiseBurst(b, t, 0.12, 0.75, 2300, "highpass"));
  }
  impact(surface, position) {
    const b = this.bus(position, 0.18);
    if (!b) return;
    const t = this.ctx.currentTime;
    if (surface === "metal") this.tone(b, t, 0.18, 1400, 520, 0.25, "triangle");
    this.finish(
      b,
      this.noiseBurst(
        b,
        t,
        0.16,
        surface === "sand" ? 0.35 : 0.8,
        surface === "metal" ? 6500 : 2200,
        "highpass",
      ),
    );
  }
  explosion(position) {
    const b = this.bus(position, 1.1);
    if (!b) return;
    const t = this.ctx.currentTime;
    this.tone(b, t, 0.8, 90, 24, 1.3);
    this.noiseBurst(b, t, 0.7, 1.5, 1600);
    this.finish(b, this.noiseBurst(b, t + 0.05, 1.8, 0.55, 420));
  }
  confirm(kill = false, head = false) {
    const b = this.bus(null, 0.22);
    if (!b) return;
    const t = this.ctx.currentTime;
    this.tone(
      b,
      t,
      0.06,
      head ? 1700 : 1100,
      head ? 1100 : 900,
      0.3,
      "triangle",
    );
    this.finish(
      b,
      this.tone(
        b,
        t + 0.025,
        kill ? 0.17 : 0.07,
        kill ? 1400 : 850,
        kill ? 600 : 650,
        0.24,
        "sine",
      ),
    );
  }
  ui(kind = "select") {
    const b = this.bus(null, 0.16);
    if (!b) return;
    const t = this.ctx.currentTime;
    this.finish(
      b,
      this.tone(
        b,
        t,
        kind === "capture" ? 0.45 : 0.1,
        kind === "capture" ? 660 : 440,
        kind === "capture" ? 990 : 620,
        0.35,
        "sine",
      ),
    );
  }
  hurt() {
    const b = this.bus(null, 0.25);
    if (!b) return;
    const t = this.ctx.currentTime;
    this.finish(b, this.noiseBurst(b, t, 0.23, 0.7, 550));
  }
  jump(land = false) {
    const b = this.bus(null, land ? 0.24 : 0.1);
    if (!b) return;
    const t = this.ctx.currentTime;
    this.tone(b, t, 0.12, land ? 85 : 150, 40, 0.6);
    this.finish(b, this.noiseBurst(b, t, 0.16, 0.5, 900));
  }
  empty() {
    const b = this.bus(null, 0.16);
    if (!b) return;
    const t = this.ctx.currentTime;
    this.finish(b, this.noiseBurst(b, t, 0.045, 0.9, 3800, "bandpass"));
  }
}
