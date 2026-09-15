import seedData from "./seed-data.json";
import type { Route } from "../types";
import { LANDMARKS } from "./landmarks";

export const ROUTES: Route[] = seedData.routes as Route[];

/** Landmark names that are usable as a start or end point of a hardcoded Zone 1 route. */
export const HUB_LANDMARK_NAMES: string[] = Array.from(
  new Set(ROUTES.flatMap((r) => [r.start, r.end]))
);

export const HUB_LANDMARKS = LANDMARKS.filter((l) =>
  HUB_LANDMARK_NAMES.includes(l.name)
);

export function getRouteById(id: string): Route | undefined {
  return ROUTES.find((r) => r.id === id);
}

/** Find a hardcoded route between two hub landmark names (case-insensitive, either order). */
export function findRoute(
  startName: string,
  endName: string
): Route | undefined {
  const start = startName.trim().toLowerCase();
  const end = endName.trim().toLowerCase();
  return ROUTES.find(
    (r) => r.start.toLowerCase() === start && r.end.toLowerCase() === end
  );
}

/** All routes that end at the given landmark name — used when a user only picks a destination. */
export function getRoutesEndingAt(name: string): Route[] {
  const needle = name.trim().toLowerCase();
  return ROUTES.filter((r) => r.end.toLowerCase() === needle);
}

/** All routes that start at the given landmark name. */
export function getRoutesStartingAt(name: string): Route[] {
  const needle = name.trim().toLowerCase();
  return ROUTES.filter((r) => r.start.toLowerCase() === needle);
}
