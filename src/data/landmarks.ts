import seedData from "./seed-data.json";
import type { Landmark } from "../types";

export const LANDMARKS: Landmark[] = seedData.landmarks as Landmark[];

export function findLandmarkByName(name: string): Landmark | undefined {
  const needle = name.trim().toLowerCase();
  return LANDMARKS.find(
    (l) =>
      l.name.toLowerCase() === needle ||
      l.alias.some((a) => a.toLowerCase() === needle)
  );
}

export function searchLandmarks(query: string): Landmark[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return LANDMARKS;
  return LANDMARKS.filter(
    (l) =>
      l.name.toLowerCase().includes(needle) ||
      l.alias.some((a) => a.toLowerCase().includes(needle))
  );
}
