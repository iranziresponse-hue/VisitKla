import type { PlacePick } from "../components/SearchDrawer";

const STORAGE_KEY = "visitkla:recent-searches";
const MAX_RECENTS = 6;

function readAll(): PlacePick[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Private browsing, disabled storage, or corrupt JSON — an empty recent
    // list is the right fallback, not a crash.
    return [];
  }
}

export function getRecentSearches(): PlacePick[] {
  return readAll();
}

/** Most-recent-first, de-duplicated by name — searching the same place again just bumps it to the top. */
export function addRecentSearch(pick: PlacePick): void {
  try {
    const existing = readAll().filter(
      (p) => p.name.toLowerCase() !== pick.name.toLowerCase()
    );
    const next = [pick, ...existing].slice(0, MAX_RECENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — searching still works, it just won't be remembered */
  }
}
