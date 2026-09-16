import type { LandmarkType } from "../types";

/**
 * Real nearby places, fetched live from OpenStreetMap's Overpass API ($0,
 * no key) — this is what lets the search drawer's default quick-picks be
 * relevant wherever a user actually is, instead of always showing the
 * same 15 Zone 1 landmarks regardless of whether the user is anywhere
 * near Makerere/Wandegeya/Mulago. Node's own fetch gets a 406 from this
 * host (same story as Nominatim elsewhere in this app) — a real browser's
 * fetch works fine, which is all that matters since this only ever runs
 * client-side.
 */

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const TIMEOUT_MS = 8000;

export interface NearbyPlace {
  name: string;
  lat: number;
  lng: number;
  type: LandmarkType;
}

// OSM amenity/shop tag -> our own landmark type, so a fetched place gets
// the same icon/colour treatment as a curated one (see LandmarkVisual).
const TAG_TO_TYPE: Record<string, LandmarkType> = {
  hospital: "hospital",
  clinic: "hospital",
  fuel: "fuel_station",
  marketplace: "market",
  supermarket: "market",
  police: "landmark",
  university: "landmark",
  college: "landmark",
  school: "landmark",
  place_of_worship: "landmark",
  bus_station: "stage",
};

function overpassQuery(lat: number, lng: number, radiusMeters: number): string {
  const tags = Object.keys(TAG_TO_TYPE);
  const amenityTags = tags.filter((t) => !["supermarket"].includes(t));
  return `[out:json][timeout:${TIMEOUT_MS / 1000}];(
    node["amenity"~"${amenityTags.join("|")}"]["name"](around:${radiusMeters},${lat},${lng});
    node["shop"="supermarket"]["name"](around:${radiusMeters},${lat},${lng});
  );out body ${20};`;
}

/**
 * Real named places within `radiusMeters` of a point, closest first.
 * Empty on any failure (offline, timeout, no results) — this is a "nice to
 * have" enhancement layer, never something the rest of the app depends on.
 */
export async function fetchNearbyPlaces(
  lat: number,
  lng: number,
  radiusMeters = 1200
): Promise<NearbyPlace[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      body: "data=" + encodeURIComponent(overpassQuery(lat, lng, radiusMeters)),
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const elements: any[] = Array.isArray(data.elements) ? data.elements : [];

    const seen = new Set<string>();
    const places: (NearbyPlace & { distance: number })[] = [];
    for (const el of elements) {
      const name = el.tags?.name as string | undefined;
      if (!name || seen.has(name.toLowerCase())) continue;
      const tagKey = el.tags?.amenity ?? el.tags?.shop;
      const type = TAG_TO_TYPE[tagKey] ?? "landmark";
      if (typeof el.lat !== "number" || typeof el.lon !== "number") continue;
      seen.add(name.toLowerCase());
      const dLat = el.lat - lat;
      const dLng = el.lon - lng;
      places.push({ name, lat: el.lat, lng: el.lon, type, distance: dLat * dLat + dLng * dLng });
    }

    return places
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 12)
      .map(({ name, lat: la, lng: ln, type }) => ({ name, lat: la, lng: ln, type }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
