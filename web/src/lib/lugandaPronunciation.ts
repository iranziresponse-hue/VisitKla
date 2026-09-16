/**
 * Best-effort phonetic respelling so the browser's English-trained TTS
 * voice comes closer to correct Luganda pronunciation of Uganda place
 * names. Applied to the SPOKEN text only, right before it's handed to
 * speechSynthesis — whatever's shown on screen (captions, instruction
 * cards) still uses the real spelling; only the audio is affected.
 *
 * Two documented Luganda sound rules drive every entry below:
 * - "g" is always a hard /g/ (as in "go") in Luganda, never the soft "j"
 *   sound English defaults to before e/i (as in "gem", "giant"). Fixed the
 *   same way English itself forces a hard g in "gherkin" or "ghost": add a
 *   silent h. "Wandegeya" -> "Wandegheya".
 * - "ky"/"gy" are palatalized in Luganda — closer to an English "ch"/"j"
 *   than a literal k+y. "Kyambogo" -> "Chambogo".
 *
 * Real limitation, stated plainly: this can't be verified by ear in this
 * environment (no audio playback here), and no browser ships an actual
 * Luganda voice — this is the closest approximation achievable by
 * respelling text for an English voice, not a guaranteed-correct
 * pronunciation. Add to the table as more places come up.
 */

interface Entry {
  /** The real name, as it appears in route/landmark data and search results. */
  match: string;
  /** Respelled purely for speech. */
  speak: string;
}

const PLACE_NAMES: Entry[] = [
  { match: "Wandegeya", speak: "Wandegheya" },
  { match: "Muyenga", speak: "Muyengha" },
  { match: "Kyambogo", speak: "Chambogo" },
  { match: "Kyebando", speak: "Chebando" },
  { match: "Kyanja", speak: "Chanja" },
  { match: "Kyadondo", speak: "Chadondo" },
  { match: "Kyengera", speak: "Chengera" },
  { match: "Kyanamukaaka", speak: "Chanamukaaka" },
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function respellForSpeech(text: string): string {
  let out = text;
  for (const { match, speak } of PLACE_NAMES) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(match)}\\b`, "gi"), speak);
  }
  return out;
}
