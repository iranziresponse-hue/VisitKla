import type { LandmarkType } from "../types";

/**
 * Kampala, mostly synthesized — horns, market chatter, askari whistle, an
 * arrival jingle, all generated live with the Web Audio API so the ride has
 * a soundtrack without shipping audio files for them. The engine itself is
 * the one exception: a real recorded motorcycle clip, not a synthesized
 * substitute — see ENGINE_LOOP_SRC.
 */

export type AudioCue =
  | LandmarkType
  | "arrive"
  | "depart";

// The engine sound, full stop — no synthesized oscillator/noise bed mixed
// underneath it any more. There was one before (for the gap before this
// clip finishes loading, and layered quietly under it afterward as
// "texture"), but once a real recording is actually audible, any
// synthesized engine/road noise running alongside it just reads as dirty
// background noise competing with it, not texture. Missing/failing to load
// just means silence where the engine would be until it's back — an
// honest gap, not a fake stand-in playing instead.
const ENGINE_LOOP_SRC = "/assets/boda-engine-loop.mp3";

interface Nodes {
  ctx: AudioContext;
  master: GainNode;
  duckGain: GainNode;
}

export interface RideAudio {
  resume(): void;
  setMuted(muted: boolean): void;
  /** 0 = idling, 1 = full throttle. Drives engine pitch + volume. */
  setThrottle(value: number): void;
  cue(type: AudioCue): void;
  /** Pull the ambience down while the narrator speaks. */
  duck(on: boolean): void;
  startAmbience(): void;
  dispose(): void;
}

function makeNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    // Brown-ish noise: smoother, more "city rumble" than white.
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.2;
  }
  return buffer;
}

export function createRideAudio(): RideAudio | null {
  const Ctor =
    typeof window !== "undefined"
      ? window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      : undefined;
  if (!Ctor) return null;

  let nodes: Nodes;
  try {
    const ctx = new Ctor();

    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    const duckGain = ctx.createGain();
    duckGain.gain.value = 1;
    duckGain.connect(master);

    nodes = { ctx, master, duckGain };
  } catch {
    return null;
  }

  const { ctx, master, duckGain } = nodes;

  let muted = false;
  let disposed = false;
  let ambienceTimer: number | null = null;

  // The real engine recording (see ENGINE_LOOP_SRC) — loads async; until it
  // does, and if it fails entirely, the engine is simply silent rather than
  // falling back to a synthesized stand-in.
  let engineSource: AudioBufferSourceNode | null = null;
  let engineGain: GainNode | null = null;

  fetch(ENGINE_LOOP_SRC)
    .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(res.status)))
    .then((buf) => ctx.decodeAudioData(buf))
    .then((audioBuffer) => {
      if (disposed) return;
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;
      source.playbackRate.value = 0.85;

      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain).connect(duckGain);
      source.start();

      engineSource = source;
      engineGain = gain;
    })
    .catch(() => {
      /* no clip shipped, or it failed to decode — engine stays silent */
    });

  const now = () => ctx.currentTime;

  function blip(
    freq: number,
    type: OscillatorType,
    duration: number,
    peak: number,
    pan = 0,
    startOffset = 0
  ) {
    if (disposed) return;
    const t = now() + startOffset;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    let tail: AudioNode = gain;
    if (typeof ctx.createStereoPanner === "function") {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      gain.connect(panner);
      tail = panner;
    }

    osc.connect(gain);
    tail.connect(duckGain);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  function noiseBurst(
    centerFreq: number,
    q: number,
    duration: number,
    peak: number,
    startOffset = 0
  ) {
    if (disposed) return;
    const t = now() + startOffset;
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, Math.max(0.4, duration + 0.2));

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = centerFreq;
    filter.Q.value = q;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + duration * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    src.connect(filter).connect(gain).connect(duckGain);
    src.start(t);
    src.stop(t + duration + 0.05);
  }

  /** Two-tone matatu/boda horn — a major third, like the real thing. */
  function honk(base = 430, duration = 0.34, peak = 0.12, pan = 0, offset = 0) {
    blip(base, "square", duration, peak, pan, offset);
    blip(base * 1.26, "square", duration, peak * 0.8, pan, offset);
  }

  function hornCluster() {
    honk(415, 0.3, 0.1, -0.4, 0);
    honk(505, 0.22, 0.085, 0.45, 0.26);
    honk(360, 0.44, 0.075, 0.1, 0.52);
  }

  function whistle() {
    blip(2100, "triangle", 0.16, 0.09, 0, 0);
    blip(2450, "triangle", 0.2, 0.08, 0, 0.19);
  }

  function scheduleAmbientHonk() {
    if (disposed) return;
    const delay = 1400 + Math.random() * 3400;
    ambienceTimer = window.setTimeout(() => {
      if (disposed) return;
      honk(
        330 + Math.random() * 190,
        0.18 + Math.random() * 0.22,
        0.035 + Math.random() * 0.03,
        Math.random() * 1.6 - 0.8
      );
      scheduleAmbientHonk();
    }, delay);
  }

  return {
    resume() {
      if (ctx.state === "suspended") void ctx.resume();
    },

    startAmbience() {
      if (disposed) return;
      scheduleAmbientHonk();
    },

    setMuted(next: boolean) {
      muted = next;
      master.gain.setTargetAtTime(next ? 0 : 0.9, now(), 0.08);
    },

    setThrottle(value: number) {
      if (disposed) return;
      const v = Math.min(1, Math.max(0, value));
      const t = now();
      if (engineGain && engineSource) {
        engineGain.gain.setTargetAtTime(0.22 + v * 0.3, t, 0.3);
        engineSource.playbackRate.setTargetAtTime(0.85 + v * 0.3, t, 0.3);
      }
    },

    duck(on: boolean) {
      duckGain.gain.setTargetAtTime(on ? 0.32 : 1, now(), 0.12);
    },

    cue(type: AudioCue) {
      if (disposed || muted) return;
      switch (type) {
        case "roundabout":
        case "junction":
          hornCluster();
          break;
        case "stage":
          honk(470, 0.2, 0.1, -0.3);
          honk(390, 0.26, 0.09, 0.35, 0.18);
          whistle();
          break;
        case "market":
          noiseBurst(1250, 1.1, 1.5, 0.05);
          blip(880, "triangle", 0.2, 0.05, 0.3, 0.1);
          blip(660, "triangle", 0.24, 0.045, -0.3, 0.35);
          break;
        case "fuel_station":
          blip(1180, "sine", 0.22, 0.09);
          blip(1180, "sine", 0.22, 0.08, 0, 0.24);
          break;
        case "hospital":
          blip(680, "sine", 0.45, 0.05, -0.2);
          blip(840, "sine", 0.45, 0.05, 0.2, 0.42);
          break;
        case "gate":
          whistle();
          break;
        case "depart":
          honk(430, 0.22, 0.11);
          break;
        case "arrive":
          blip(523.25, "sine", 0.5, 0.11, -0.15);
          blip(659.25, "sine", 0.55, 0.1, 0.1, 0.11);
          blip(783.99, "sine", 0.85, 0.1, 0, 0.22);
          break;
        default:
          blip(760, "sine", 0.32, 0.07);
      }
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      if (ambienceTimer !== null) window.clearTimeout(ambienceTimer);
      try {
        engineSource?.stop();
      } catch {
        /* already stopped */
      }
      void ctx.close();
    },
  };
}
