import type { GeoPoint } from "./geo";

// OSRM's free public demo server — no key, no signup. It's a shared
// best-effort instance (not an SLA), which is exactly why every call here
// is wrapped to fail soft: on a timeout or bad response we return null and
// the caller falls back to the old smoothed straight-line approximation
// rather than the ride breaking.
const OSRM_ENDPOINT = "https://router.project-osrm.org/route/v1/driving";
const TIMEOUT_MS = 6000;

/**
 * Real road-snapped geometry between waypoints, in order. This is what
 * keeps the rider on actual streets instead of cutting a smoothed straight
 * line through blocks and buildings — the "flying like a plane" problem
 * with the geometric fallback.
 */
export async function fetchRoadPath(waypoints: GeoPoint[]): Promise<GeoPoint[] | null> {
  if (waypoints.length < 2) return null;

  const coords = waypoints.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${OSRM_ENDPOINT}/${coords}?geometries=geojson&overview=full`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const coordinates: [number, number][] | undefined =
      data?.code === "Ok" ? data.routes?.[0]?.geometry?.coordinates : undefined;
    if (!coordinates || coordinates.length < 2) return null;
    return coordinates.map(([lng, lat]) => ({ lat, lng }));
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** One real driving maneuver from OSRM's own turn-by-turn breakdown. */
export interface RoadManeuver {
  type: string;
  modifier?: string;
  name: string;
  distanceMeters: number;
  point: GeoPoint;
}

export interface RoadRouteOption {
  points: GeoPoint[];
  distanceMeters: number;
  durationSeconds: number;
  /** Real turn-by-turn steps for this option, in order — see RoadManeuver. */
  maneuvers: RoadManeuver[];
}

/**
 * Multiple road-following options between two points — Kampala junctions
 * genuinely have more than one sane way through them, so a single-path
 * assumption is the wrong model for "go anywhere", even though it's fine
 * for our 20 fixed, already-chosen Zone 1 routes. OSRM only returns
 * alternatives for simple A→B queries (not multi-waypoint), which is
 * exactly the shape a freely-searched trip is.
 */
export async function fetchRoadAlternatives(
  a: GeoPoint,
  b: GeoPoint
): Promise<RoadRouteOption[]> {
  const coords = `${a.lng},${a.lat};${b.lng},${b.lat}`;
  // A numeric alternative count is what actually returns >1 route on this
  // OSRM version — `alternatives=true` came back with only the single
  // best path even for pairs that do have a genuine second option.
  // steps=true is what turns this into real turn-by-turn guidance instead
  // of just "start here, arrive there" — see RoadManeuver.
  const url = `${OSRM_ENDPOINT}/${coords}?geometries=geojson&overview=full&alternatives=3&steps=true`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const data = await res.json();
    if (data?.code !== "Ok" || !Array.isArray(data.routes)) return [];

    return data.routes
      .filter((r: any) => r.geometry?.coordinates?.length >= 2)
      .map((r: any) => ({
        points: r.geometry.coordinates.map(([lng, lat]: [number, number]) => ({
          lat,
          lng,
        })),
        distanceMeters: r.distance,
        durationSeconds: r.duration,
        maneuvers: extractManeuvers(r),
      }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function extractManeuvers(route: any): RoadManeuver[] {
  const legs: any[] = Array.isArray(route.legs) ? route.legs : [];
  const out: RoadManeuver[] = [];
  for (const leg of legs) {
    const steps: any[] = Array.isArray(leg.steps) ? leg.steps : [];
    for (const s of steps) {
      const loc = s.maneuver?.location;
      if (!Array.isArray(loc) || loc.length < 2) continue;
      out.push({
        type: s.maneuver?.type ?? "continue",
        modifier: s.maneuver?.modifier,
        name: typeof s.name === "string" ? s.name : "",
        distanceMeters: typeof s.distance === "number" ? s.distance : 0,
        point: { lng: loc[0], lat: loc[1] },
      });
    }
  }
  return out;
}
