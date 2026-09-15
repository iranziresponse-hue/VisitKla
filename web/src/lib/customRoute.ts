import type { Route } from "../types";
import type { GeoPoint } from "./geo";

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

/**
 * Builds a minimal Route object for any two points — not one of our 20
 * curated Zone 1 routes, so no hand-written landmark narration exists for
 * it. This is what lets "move anywhere" work: the whole Preview → Ride →
 * Navigate pipeline only needs a Route shape, and this is the honest
 * version of one for a place we don't have a story for yet.
 */
export function synthesizeRoute(
  start: NamedPoint,
  end: NamedPoint,
  distanceMeters: number
): Route {
  counter += 1;
  const { min: priceMin, max: priceMax } = estimateBodaPrice(distanceMeters);

  return {
    id: `custom-${Date.now()}-${counter}`,
    start: start.name,
    end: end.name,
    steps: [
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
    ],
    boda_price_min: priceMin,
    boda_price_max: priceMax,
    panya_tip:
      "No boda shortcut on file for this trip yet — ask your rider, they usually know a faster back way.",
  };
}

export function toNamedPoint(name: string, p: GeoPoint): NamedPoint {
  return { name, lat: p.lat, lng: p.lng };
}
