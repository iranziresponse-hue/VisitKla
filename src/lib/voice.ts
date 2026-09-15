import * as Speech from "expo-speech";
import type { RouteStep } from "../types";

export type VoiceLanguage = "en" | "lg";

/**
 * Ug-English step text is the source of truth (see seed-data.json). For
 * Luganda we don't store a translation per step — that would double the
 * seed data for little gain in an MVP — instead we speak a short templated
 * Luganda phrase built from the step's position and landmark name.
 */
function buildLugandaPhrase(
  step: RouteStep,
  isFirst: boolean,
  isLast: boolean
): string {
  if (isFirst) return `Tandika wano ku ${step.landmark}`;
  if (isLast) return `Mutuuse ku ${step.landmark}`;
  return `Weetegereze, ${step.landmark} kiri mu maaso`;
}

export function speakStep(
  step: RouteStep,
  options: { isFirst: boolean; isLast: boolean; language: VoiceLanguage }
): void {
  Speech.stop();
  const { isFirst, isLast, language } = options;
  const text =
    language === "lg" ? buildLugandaPhrase(step, isFirst, isLast) : step.text;
  Speech.speak(text, {
    language: language === "lg" ? "lg" : "en-US",
    pitch: 1,
    rate: 0.95,
  });
}

export function stopSpeaking(): void {
  Speech.stop();
}
