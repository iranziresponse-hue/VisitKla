import type { Route, RouteStep } from "../types";
import type { GeoPoint } from "./geo";
import type { RoadManeuver } from "./roadRoute";
import { formatDistance } from "./distance";

export interface NamedPoint {
  name: string;
  lat: number;
  lng: number;
}

let counter = 0;

export function estimateBodaPrice(distanceMeters: number): {
  min: number;
  max: number;
} {
  const min = Math.max(1000, Math.round((1200 + distanceMeters * 2.1) / 500) * 500);
  const max = Math.round((min * 1.45) / 500) * 500;
  return { min, max };
}

/** Turns one real OSRM maneuver into a plain-English instruction — or null for ones not worth narrating (arrival is its own dedicated final step; tiny sub-15m segments just add noise). */
function describeManeuver(m: RoadManeuver): string | null {
  const road = m.name.trim() || null;
  const mod = m.modifier;
  const distanceSuffix = m.distanceMeters > 150 ? ` for ${formatDistance(m.distanceMeters)}` : "";

  switch (m.type) {
    case "depart":
      return road ? `Head out onto ${road}${distanceSuffix}.` : `Head out${distanceSuffix}.`;
    case "arrive":
      return null;
    case "turn":
      // OSRM's "turn" maneuvers include modifier "straight" for a road
      // that just carries on through a junction — "turn straight" isn't
      // real English, that's a "continue".
      if (mod === "straight") {
        return road ? `Continue onto ${road}${distanceSuffix}.` : `Continue straight${distanceSuffix}.`;
      }
      if (mod) return road ? `Turn ${mod} onto ${road}${distanceSuffix}.` : `Turn ${mod}${distanceSuffix}.`;
      return road ? `Continue onto ${road}${distanceSuffix}.` : `Continue straight${distanceSuffix}.`;
    case "new name":
      return road ? `Keep straight. The road becomes ${road}${distanceSuffix}.` : `Keep straight${distanceSuffix}.`;
    case "continue":
      if (mod) return road ? `Continue ${mod} onto ${road}${distanceSuffix}.` : `Continue ${mod}${distanceSuffix}.`;
      return road ? `Continue on ${road}${distanceSuffix}.` : `Continue straight${distanceSuffix}.`;
    case "merge":
      return road ? `Merge onto ${road}${distanceSuffix}.` : `Merge onto the main road${distanceSuffix}.`;
    case "fork":
      return mod ? `At the fork, keep ${mod}${distanceSuffix}.` : `At the fork, stay on the main road${distanceSuffix}.`;
    case "roundabout":
    case "rotary":
      return mod ? `At the roundabout, go ${mod}.` : "Go through the roundabout.";
    case "exit roundabout":
    case "exit rotary":
      return road ? `Leave the roundabout onto ${road}${distanceSuffix}.` : "Leave the roundabout.";
    case "on ramp":
      return road ? `Take the ramp onto ${road}${distanceSuffix}.` : `Take the ramp${distanceSuffix}.`;
    case "off ramp":
      return road ? `Take the exit onto ${road}${distanceSuffix}.` : `Take the exit${distanceSuffix}.`;
    case "end of road":
      if (mod) return road ? `At the end of the road, turn ${mod} onto ${road}${distanceSuffix}.` : `At the end of the road, turn ${mod}${distanceSuffix}.`;
      return road ? `Continue onto ${road}${distanceSuffix}.` : `Continue straight${distanceSuffix}.`;
    case "notification":
      return null;
    default:
      return road ? `Continue on ${road}${distanceSuffix}.` : `Continue straight${distanceSuffix}.`;
  }
}

/**
 * Real turn-by-turn steps from OSRM's own maneuver breakdown, not just a
 * "start here, arrive there" bookend — a searched trip of any real length
 * used to give zero guidance for everything in between, which is exactly
 * why it didn't actually direct anyone anywhere.
 */
function stepsFromManeuvers(
  maneuvers: RoadManeuver[],
  start: NamedPoint,
  end: NamedPoint
): RouteStep[] {
  const steps: RouteStep[] = [
    {
      order: 1,
      text: `Start at ${start.name}.`,
      landmark: start.name,
      lat: start.lat,
      lng: start.lng,
      photo_url: "",
    },
  ];

  for (const m of maneuvers) {
    if (m.distanceMeters > 0 && m.distanceMeters < 15 && m.type !== "depart") continue;
    const text = describeManeuver(m);
    if (!text) continue;
    steps.push({
      order: steps.length + 1,
      text,
      landmark: m.name.trim() || "the road",
      lat: m.point.lat,
      lng: m.point.lng,
      photo_url: "",
    });
  }

  steps.push({
    order: steps.length + 1,
    text: `You have arrived at ${end.name}.`,
    landmark: end.name,
    lat: end.lat,
    lng: end.lng,
    photo_url: "",
  });

  return steps;
}

/**
 * Builds a minimal Route object for any two points — not one of our 20
 * curated Zone 1 routes, so no hand-written landmark narration exists for
 * it. This is what lets "move anywhere" work: the whole Preview → Ride →
 * Navigate pipeline only needs a Route shape, and this is the honest
 * version of one for a place we don't have a story for yet. Real
 * turn-by-turn steps (see stepsFromManeuvers) are used whenever OSRM
 * actually returned a maneuver breakdown for the chosen option; the plain
 * two-step bookend is the fallback for when it didn't (offline, or the
 * "continue anyway" haversine-line path).
 */
export function synthesizeRoute(
  start: NamedPoint,
  end: NamedPoint,
  distanceMeters: number,
  maneuvers?: RoadManeuver[]
): Route {
  counter += 1;
  const { min: priceMin, max: priceMax } = estimateBodaPrice(distanceMeters);

  const steps =
    maneuvers && maneuvers.length > 0
      ? stepsFromManeuvers(maneuvers, start, end)
      : [
          {
            order: 1,
            text: `Start at ${start.name}.`,
            landmark: start.name,
            lat: start.lat,
            lng: start.lng,
            photo_url: "",
          },
          {
            order: 2,
            text: `You have arrived at ${end.name}.`,
            landmark: end.name,
            lat: end.lat,
            lng: end.lng,
            photo_url: "",
          },
        ];

  return {
    id: `custom-${Date.now()}-${counter}`,
    start: start.name,
    end: end.name,
    steps,
    boda_price_min: priceMin,
    boda_price_max: priceMax,
    panya_tip:
      "No boda shortcut on file for this trip yet. Ask your rider, they usually know a faster back way.",
  };
}

export function toNamedPoint(name: string, p: GeoPoint): NamedPoint {
  return { name, lat: p.lat, lng: p.lng };
}
