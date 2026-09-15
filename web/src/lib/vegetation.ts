import maplibregl from "maplibre-gl";
import { metersBetween, type GeoPoint } from "./geo";
import { VEGETATION_QUERY_LAYERS } from "./rideStyle";
import { createTreeElement } from "../components/cinematic/riderMarker";

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

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export { boundsOf };

/**
 * Samples real green-space polygons (parks, grass, wood — see
 * VEGETATION_QUERY_LAYERS) along the route corridor and drops a tree sprite
 * wherever a candidate point actually lands inside one.
 *
 * This only works for tiles currently loaded in view — callers are expected
 * to have already framed the map over the whole corridor and waited for
 * 'idle' before calling this (see CinematicRide / NavigationMap bootstrap).
 */
export function scatterTrees(
  map: maplibregl.Map,
  routePoints: GeoPoint[],
  opts: { spacingMeters?: number; maxTrees?: number; minDistanceFromRouteMeters?: number } = {}
): maplibregl.Marker[] {
  if (routePoints.length === 0) return [];
  const spacing = opts.spacingMeters ?? 24;
  const maxTrees = opts.maxTrees ?? 80;
  const minDist = opts.minDistanceFromRouteMeters ?? 8;

  const bounds = boundsOf(routePoints, 110);
  const latStep = spacing / METERS_PER_DEGREE_LAT;
  const lngStep =
    spacing / (METERS_PER_DEGREE_LAT * Math.cos((bounds.centerLat * Math.PI) / 180));

  const candidates: GeoPoint[] = [];
  for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += latStep) {
    for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += lngStep) {
      candidates.push({
        lat: lat + (Math.random() - 0.5) * latStep * 0.7,
        lng: lng + (Math.random() - 0.5) * lngStep * 0.7,
      });
    }
  }

  const canvas = map.getCanvas();
  const markers: maplibregl.Marker[] = [];

  for (const point of shuffle(candidates)) {
    if (markers.length >= maxTrees) break;

    let tooClose = false;
    for (const p of routePoints) {
      if (metersBetween(p, point) < minDist) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const pixel = map.project([point.lng, point.lat]);
    if (pixel.x < 0 || pixel.y < 0 || pixel.x > canvas.width || pixel.y > canvas.height) {
      continue;
    }

    const hits = map.queryRenderedFeatures(pixel, {
      layers: VEGETATION_QUERY_LAYERS,
    });
    if (hits.length === 0) continue;

    const scale = 0.8 + Math.random() * 0.5;
    const marker = new maplibregl.Marker({
      element: createTreeElement(scale),
      anchor: "bottom",
    })
      .setLngLat([point.lng, point.lat])
      .addTo(map);
    markers.push(marker);
  }

  return markers;
}

/** Resolves on the map's next idle frame — tiles for the current view loaded. */
export function waitForIdle(map: maplibregl.Map): Promise<void> {
  return new Promise((resolve) => {
    map.once("idle", () => resolve());
  });
}
