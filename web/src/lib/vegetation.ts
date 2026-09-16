import type maplibregl from "maplibre-gl";
import type { GeoPoint } from "./geo";

const METERS_PER_DEGREE_LAT = 111320;

interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  centerLat: number;
  centerLng: number;
}

function boundsOf(points: GeoPoint[], padMeters: number): Bounds {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  const centerLat = (minLat + maxLat) / 2;
  const padLat = padMeters / METERS_PER_DEGREE_LAT;
  const padLng =
    padMeters / (METERS_PER_DEGREE_LAT * Math.cos((centerLat * Math.PI) / 180));
  return {
    minLat: minLat - padLat,
    maxLat: maxLat + padLat,
    minLng: minLng - padLng,
    maxLng: maxLng + padLng,
    centerLat,
    centerLng: (minLng + maxLng) / 2,
  };
}

/** Zoom that comfortably fits a lat/lng span in a viewport of the given size. */
export function fitZoomFor(bounds: Bounds, viewportPx: number): number {
  const spanMeters = Math.max(
    (bounds.maxLat - bounds.minLat) * METERS_PER_DEGREE_LAT,
    (bounds.maxLng - bounds.minLng) *
      METERS_PER_DEGREE_LAT *
      Math.cos((bounds.centerLat * Math.PI) / 180)
  );
  if (spanMeters <= 0) return 16;
  // Web-mercator: metersPerPixel at zoom z, latitude φ ≈ 156543 * cos(φ) / 2^z
  const metersPerPixelNeeded = spanMeters / (viewportPx * 0.82);
  const z =
    Math.log2(
      (156543 * Math.cos((bounds.centerLat * Math.PI) / 180)) /
        metersPerPixelNeeded
    );
  return Math.min(17.5, Math.max(13, z));
}

export { boundsOf };

/** Resolves on the map's next idle frame — tiles for the current view loaded. */
export function waitForIdle(map: maplibregl.Map): Promise<void> {
  return new Promise((resolve) => {
    map.once("idle", () => resolve());
  });
}
