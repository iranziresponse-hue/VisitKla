import type { LandmarkType } from "../types";

/**
 * Kampala, synthesized. Every sound here is generated live with the Web
 * Audio API — boda engine, jam horns, market chatter, askari whistle — so
 * the ride has a real soundtrack without shipping a single audio file.
 * That keeps the "low-data" promise honest: the whole soundscape costs 0
 * bytes of bandwidth.
 */

export type AudioCue =
  | LandmarkType
  | "arrive"
  | "depart";

// A short trimmed-down real-recording texture, layered quietly under the
// synthesized engine below rather than replacing it — the source clip is a
// superbike, not a single-cylinder boda, and its licensing for shipping is
// unconfirmed, so this stays a low-level "grain" bonus, not the main sound,
// and must be swapped for a properly licensed recording before any real
// deploy. Missing/failing to load just means the synthesized engine plays
// alone, same as before this existed.
const ENGINE_LOOP_SRC = "/assets/boda-engine-loop.mp3";

interface Nodes {
  ctx: AudioContext;
  master: GainNode;
  duckGain: GainNode;
  engineGain: GainNode;
  engineFilter: BiquadFilterNode;
  engineOscA: OscillatorNode;
  engineOscB: OscillatorNode;
  engineOscC: OscillatorNode;
  roadGain: GainNode;
  roadGainHiss: GainNode;
  noiseSource: AudioBufferSourceNode;
  hissSource: AudioBufferSourceNode;
}

export interface RideAudio {
  resume(): void;
  setMuted(muted: boolean): void;
  /** 0 = idling, 1 = full throttle. Drives engine pitch + road noise. */
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

    // --- engine -------------------------------------------------------
    // A previous pass ran this through a tanh waveshaper for "grit" —
    // saturating a sawtooth+square mix like that produces a harsh, buzzy
    // artifact rather than a believable engine, and made it sound worse,
    // not better. Pulled back out: no distortion stage, gentler filtering,
    // pitch-only wobble (no gain modulation, which was compounding the
    // harshness through the now-removed saturator).
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 480;
    engineFilter.Q.value = 2.2;

    const engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineFilter.connect(engineGain).connect(duckGain);

    const engineOscA = ctx.createOscillator();
    engineOscA.type = "sawtooth";
    engineOscA.frequency.value = 88;
    const engineOscB = ctx.createOscillator();
    engineOscB.type = "triangle";
    engineOscB.frequency.value = 44;
    engineOscB.detune.value = 12;
    // A third, subtly detuned copy for a touch of thickness — quiet
    // relative to A/B so it doesn't reintroduce harshness on its own.
    const engineOscC = ctx.createOscillator();
    engineOscC.type = "sawtooth";
    engineOscC.frequency.value = 88.6;
    engineOscC.detune.value = -18;

    const oscMixC = ctx.createGain();
    oscMixC.gain.value = 0.25;
    engineOscA.connect(engineFilter);
    engineOscB.connect(engineFilter);
    engineOscC.connect(oscMixC).connect(engineFilter);

    // Combustion-pulse wobble: pitch vibrato only. Modulating gain through
    // the same path (the previous version) compounded with the saturator
    // to sound noisier, not more like an idling single-cylinder.
    const wobble = ctx.createOscillator();
    wobble.type = "sine";
    wobble.frequency.value = 11;
    const wobbleDepth = ctx.createGain();
    wobbleDepth.gain.value = 14;
    wobble.connect(wobbleDepth).connect(engineOscA.frequency);

    // --- road + city bed ---------------------------------------------
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = makeNoiseBuffer(ctx);
    noiseSource.loop = true;

    const roadFilter = ctx.createBiquadFilter();
    roadFilter.type = "bandpass";
    roadFilter.frequency.value = 780;
    roadFilter.Q.value = 0.7;

    const roadGain = ctx.createGain();
    roadGain.gain.value = 0;
    noiseSource.connect(roadFilter).connect(roadGain).connect(duckGain);

    // A second, higher band for tarmac/gravel hiss under the tyres —
    // layered with the low rumble instead of relying on one noise band
    // to do both jobs.
    const hissSource = ctx.createBufferSource();
    hissSource.buffer = makeNoiseBuffer(ctx, 2);
    hissSource.loop = true;
    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = "highpass";
    hissFilter.frequency.value = 2200;
    const roadGainHiss = ctx.createGain();
    roadGainHiss.gain.value = 0;
    hissSource.connect(hissFilter).connect(roadGainHiss).connect(duckGain);

    engineOscA.start();
    engineOscB.start();
    engineOscC.start();
    wobble.start();
    noiseSource.start();
    hissSource.start();

    nodes = {
      ctx,
      master,
      duckGain,
      engineGain,
      engineFilter,
      engineOscA,
      engineOscB,
      engineOscC,
      roadGain,
      roadGainHiss,
      noiseSource,
      hissSource,
    };
  } catch {
    return null;
  }

  const {
    ctx,
    master,
    duckGain,
    engineGain,
    engineFilter,
    engineOscA,
    roadGain,
    roadGainHiss,
  } = nodes;

  let muted = false;
  let disposed = false;
  let ambienceTimer: number | null = null;

  // Real-recording engine texture (see ENGINE_LOOP_SRC) — loads async and
  // silently stays off if the clip is absent or fails to decode.
  let realEngineSource: AudioBufferSourceNode | null = null;
  let realEngineGain: GainNode | null = null;

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

      realEngineSource = source;
      realEngineGain = gain;
    })
    .catch(() => {
      /* no clip shipped, or it failed to decode — synth engine carries it alone */
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
      // distant city rumble under everything — quieter once a real
      // recording is carrying the engine, same reasoning as setThrottle.
      const hasReal = !!(realEngineGain && realEngineSource);
      roadGain.gain.setTargetAtTime(hasReal ? 0.01 : 0.05, now(), 1.4);
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
      const hasReal = !!(realEngineGain && realEngineSource);

      // Once a real recording has loaded, it's the engine you actually
      // hear — the synthesizer drops to a quiet support layer underneath
      // (filling in the sub-bass/attack the recording's own filtering
      // rolled off) instead of masking it. Previously both sat at similar,
      // both-quiet levels, so swapping the recording never sounded like
      // anything had changed.
      const synthLevel = hasReal ? 0.35 : 1;
      // The road rumble/tarmac hiss beds are literal synthesized noise —
      // layered at full strength alongside a real recording that already
      // carries its own road texture, that's exactly what read as "dirty
      // background noise" once the recording was actually audible. Cut
      // further than the engine oscillators (noise reads as grittier than
      // a tonal hum at the same level).
      const noiseLevel = hasReal ? 0.18 : 1;
      engineGain.gain.setTargetAtTime(0.028 + v * 0.055 * synthLevel, t, 0.25);
      engineFilter.frequency.setTargetAtTime(420 + v * 1250, t, 0.3);
      engineOscA.frequency.setTargetAtTime(78 + v * 86, t, 0.3);
      roadGain.gain.setTargetAtTime((0.04 + v * 0.07) * noiseLevel, t, 0.4);
      roadGainHiss.gain.setTargetAtTime((0.012 + v * 0.03) * noiseLevel, t, 0.4);
      if (hasReal) {
        realEngineGain!.gain.setTargetAtTime(0.22 + v * 0.3, t, 0.3);
        realEngineSource!.playbackRate.setTargetAtTime(0.85 + v * 0.3, t, 0.3);
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
        nodes.engineOscA.stop();
        nodes.engineOscB.stop();
        nodes.engineOscC.stop();
        nodes.noiseSource.stop();
        nodes.hissSource.stop();
        realEngineSource?.stop();
      } catch {
        /* already stopped */
      }
      void ctx.close();
    },
  };
}
