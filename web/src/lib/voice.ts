import type { RouteStep } from "../types";

export type VoiceLanguage = "en" | "lg";

/**
 * Ug-English step text is the source of truth (see seed-data.json). For
 * Luganda we don't store a translation per step — that would double the
 * seed data for little gain in an MVP — instead we speak a short templated
 * Luganda phrase built from the step's position and landmark name. Most
 * browsers have no Luganda voice installed and will fall back to a
 * default voice reading the Latin text phonetically, which is still more
 * useful than nothing for MVP testing.
 *
 * Exported (not just used internally) because the on-screen instruction
 * card calls this too — whatever gets spoken has to be exactly what's
 * printed on screen, or the two visibly disagree with each other the
 * moment you switch to LG.
 */
export function getSpokenText(
  step: RouteStep,
  options: { isFirst: boolean; isLast: boolean; language: VoiceLanguage }
): string {
  if (options.language === "en") return step.text;
  if (options.isFirst) return `Tandika wano ku ${step.landmark}`;
  if (options.isLast) return `Mutuuse ku ${step.landmark}`;
  return `Weetegereze, ${step.landmark} kiri mu maaso`;
}

const isSpeechSupported =
  typeof window !== "undefined" && "speechSynthesis" in window;

// getVoices() is frequently empty on the very first call — most engines
// (Chrome especially) load the voice list asynchronously and only fire
// 'voiceschanged' once it's ready. Kicking this off at module load, rather
// than inside speakStep(), gives it the best chance of being populated by
// the time a user actually reaches turn-by-turn navigation.
let cachedVoices: SpeechSynthesisVoice[] = [];
if (isSpeechSupported) {
  cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener("voiceschanged", () => {
    cachedVoices = window.speechSynthesis.getVoices();
  });
}

// Web Speech API voices carry no structured gender field — engines only
// hint at it through the voice's name. This is a best-effort match against
// the names real browsers actually ship (Chrome/Google, Edge/Microsoft,
// Safari/Apple), not a guarantee every platform has one.
const FEMALE_NAME_HINTS = [
  "female", "zira", "aria", "jenny", "samantha", "victoria", "susan",
  "karen", "moira", "tessa", "fiona", "kate", "serena", "ava", "allison",
  "nicky", "salli", "joanna", "ivy", "emma", "amy", "libby", "olivia",
  "hazel", "sonia", "google uk english female", "google us english female",
];
const MALE_NAME_HINTS = [
  "male", "david", "mark", "james", "daniel", "fred", "alex", "arthur",
  "guy", "ryan", "christopher", "eric", "google uk english male",
  "google us english male",
];
// Names/labels that tend to mean "this is a better-than-robotic neural
// voice" on the engine that ships it — worth a strong preference bump
// since it's the only lever available for "sound more real" at $0.
const HIGH_QUALITY_HINTS = ["natural", "neural", "online", "premium", "enhanced"];
// No browser ships a real Luganda voice today; these are the closest
// available accent neighbourhoods (East African English/Swahili) when one
// exists on the device, which reads closer to "Ugandan accent" than the
// generic US/UK default this would otherwise fall back to.
const EAST_AFRICA_LANG_HINTS = ["lg", "sw-ke", "sw-tz", "sw", "en-ke", "en-tz", "en-ug", "en-za"];

function score(voice: SpeechSynthesisVoice, language: VoiceLanguage): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  let s = 0;

  if (language === "lg" && EAST_AFRICA_LANG_HINTS.some((h) => lang.startsWith(h))) {
    s += 100;
  } else if (lang.startsWith("en")) {
    s += 20;
  }

  if (FEMALE_NAME_HINTS.some((h) => name.includes(h))) s += 50;
  if (MALE_NAME_HINTS.some((h) => name.includes(h))) s -= 50;
  if (HIGH_QUALITY_HINTS.some((h) => name.includes(h))) s += 30;
  if (voice.localService) s += 5; // works offline — matters for this app

  return s;
}

function pickVoice(language: VoiceLanguage): SpeechSynthesisVoice | null {
  if (cachedVoices.length === 0) return null;
  return [...cachedVoices].sort((a, b) => score(b, language) - score(a, language))[0] ?? null;
}

/**
 * Every narration surface in the app (turn-by-turn nav, the cinematic ride
 * preview) must sound the same — one place picking the voice/pitch/rate, not
 * each screen rolling its own SpeechSynthesisUtterance defaults, which is
 * exactly how a previous pass silently fixed the voice everywhere except the
 * cinematic ride: that screen had its own hardcoded utterance setup that
 * never called any of this.
 */
export function applyNaturalVoice(
  utterance: SpeechSynthesisUtterance,
  language: VoiceLanguage = "en"
): void {
  utterance.lang = language === "lg" ? "lg-UG" : "en-US";

  const voice = pickVoice(language);
  if (voice) utterance.voice = voice;

  // A flat, identical pitch/rate every single line is a big part of what
  // makes TTS read as obviously synthetic — real speech never repeats
  // itself exactly. Small per-line jitter, not enough to sound erratic.
  utterance.pitch = 1.08 + (Math.random() * 0.1 - 0.05);
  utterance.rate = 0.95 + (Math.random() * 0.08 - 0.04);
}

export function speakStep(
  step: RouteStep,
  options: { isFirst: boolean; isLast: boolean; language: VoiceLanguage }
): void {
  if (!isSpeechSupported) return;
  const text = getSpokenText(step, options);

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  applyNaturalVoice(utterance, options.language);
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (!isSpeechSupported) return;
  window.speechSynthesis.cancel();
}
