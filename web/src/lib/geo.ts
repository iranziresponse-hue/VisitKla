export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_METERS = 6371000;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export function metersBetween(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Compass bearing a → b, in degrees clockwise from north. */
export function bearingBetween(a: GeoPoint, b: GeoPoint): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Shortest signed turn from `from` to `to`, in degrees (-180..180]. */
export function bearingDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

export function lerpPoint(a: GeoPoint, b: GeoPoint, t: number): GeoPoint {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}

/**
 * Chaikin corner cutting. Our routes are only 2-5 landmark points, so a raw
 * polyline makes the rider snap through junctions at hard angles. Rounding
 * the corners is what makes the ride read as a vehicle following a road
 * rather than a dot teleporting between pins.
 */
export function smoothPath(points: GeoPoint[], iterations = 2): GeoPoint[] {
  let result = points;
  for (let it = 0; it < iterations; it++) {
    if (result.length < 3) return result;
    const next: GeoPoint[] = [result[0]];
    for (let i = 0; i < result.length - 1; i++) {
      const a = result[i];
      const b = result[i + 1];
      next.push(lerpPoint(a, b, 0.25), lerpPoint(a, b, 0.75));
    }
    next.push(result[result.length - 1]);
    result = next;
  }
  return result;
}

/** Inserts intermediate points so the path can be walked at constant speed. */
export function densify(points: GeoPoint[], spacingMeters = 5): GeoPoint[] {
  if (points.length < 2) return points;
  const out: GeoPoint[] = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const segment = metersBetween(a, b);
    const steps = Math.max(1, Math.ceil(segment / spacingMeters));
    for (let s = 1; s <= steps; s++) out.push(lerpPoint(a, b, s / steps));
  }
  return out;
}

export interface RidePath {
  points: GeoPoint[];
  /** Cumulative distance in meters at each point index. */
  cumulative: number[];
  totalMeters: number;
}

/**
 * `smooth: true` (the default) rounds corners with Chaikin cutting — the
 * right call for our old fallback, a straight line between a handful of
 * landmark points, which otherwise snaps through junctions at hard angles.
 * Real road geometry (see lib/roadRoute.ts) is the opposite case: it's
 * already the actual street shape, so smoothing it would round away real
 * corners and risk cutting across blocks. Pass `smooth: false` for that.
 */
export function buildRidePath(
  waypoints: GeoPoint[],
  opts: { smooth?: boolean } = {}
): RidePath {
  const smooth = opts.smooth ?? true;
  const usable = waypoints.filter(
    (p, i) => i === 0 || metersBetween(waypoints[i - 1], p) > 1
  );
  const smoothed = smooth && usable.length > 2 ? smoothPath(usable, 2) : usable;
  const points = densify(smoothed, 5);

  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + metersBetween(points[i - 1], points[i]));
  }

  return {
    points,
    cumulative,
    totalMeters: cumulative[cumulative.length - 1] ?? 0,
  };
}

export interface PathSample {
  point: GeoPoint;
  index: number;
}

/**
 * Position at `meters` along the path. `hint` lets the animation loop resume
 * scanning from the previous frame's index instead of re-scanning the whole
 * path every frame.
 */
export function sampleAt(
  path: RidePath,
  meters: number,
  hint = 0
): PathSample {
  const { points, cumulative, totalMeters } = path;
  if (points.length === 0) return { point: { lat: 0, lng: 0 }, index: 0 };
  if (meters <= 0) return { point: points[0], index: 0 };
  if (meters >= totalMeters) {
    return { point: points[points.length - 1], index: points.length - 1 };
  }

  let i = Math.min(Math.max(hint, 0), points.length - 2);
  while (i > 0 && cumulative[i] > meters) i--;
  while (i < points.length - 2 && cumulative[i + 1] < meters) i++;

  const span = cumulative[i + 1] - cumulative[i];
  const t = span > 0 ? (meters - cumulative[i]) / span : 0;
  return { point: lerpPoint(points[i], points[i + 1], t), index: i };
}

/** Distance along the path of the point closest to `target`. */
export function distanceAlongFor(path: RidePath, target: GeoPoint): number {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < path.points.length; i++) {
    const d = metersBetween(path.points[i], target);
    if (d < bestDistance) {
      bestDistance = d;
      bestIndex = i;
    }
  }
  return path.cumulative[bestIndex];
}

export function toGeoPoint(step: { lat: number; lng: number }): GeoPoint {
  return { lat: step.lat, lng: step.lng };
}
