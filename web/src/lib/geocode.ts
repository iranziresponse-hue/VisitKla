/**
 * Real place search via Nominatim (OpenStreetMap's free geocoder) — the
 * same $0, no-key service we used to verify Zone 1's coordinates. This is
 * what makes search work "like Google Maps" for any place, not just our
 * 20 hardcoded routes' hub landmarks.
 *
 * Note for a production deploy: Nominatim's usage policy wants requests
 * throttled to ~1/sec and identified by a Referer or User-Agent (browsers
 * won't let JS set the latter). For low personal/demo traffic calling it
 * straight from the client — as this MVP does — that's fine; anything
 * beyond that should proxy through a small backend that sets a proper
 * User-Agent and shares one rate limit across all users instead of one
 * per browser tab.
 */

export interface GeocodeResult {
  id: string;
  /** Short label for lists — usually just the venue/road name. */
  name: string;
  /** Full "Name, Area, City, Country" for disambiguation. */
  fullLabel: string;
  lat: number;
  lng: number;
  type: string;
}

const ENDPOINT = "https://nominatim.openstreetmap.org/search";

// Nominatim's display_name is built for a geocoder, not a person — a real
// result looks like "Ham Towers, Bombo Road, Wandegeya, Kawempe Division,
// Kampala, Central Region, 256, Uganda". Since every result here is already
// inside Uganda (countrycodes=ug above), the country name is dead weight,
// and a bare admin-boundary/postcode segment is noise no one reads out loud
// when giving directions — so only the first couple of segments that
// actually help you tell two same-named places apart survive.
const LABEL_NOISE = new Set(["uganda", "central region", "eastern region", "northern region", "western region"]);

export function formatPlaceLabel(displayName: string): string {
  const segments = displayName
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(1); // first segment is already shown as the result's name

  const kept = segments.filter((s) => !LABEL_NOISE.has(s.toLowerCase()) && !/^\d+$/.test(s));
  return kept.slice(0, 2).join(", ");
}

export async function searchPlaces(
  query: string,
  opts: { limit?: number; signal?: AbortSignal } = {}
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({
    q: trimmed,
    format: "jsonv2",
    limit: String(opts.limit ?? 6),
    countrycodes: "ug",
    addressdetails: "0",
  });

  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      signal: opts.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data: any[] = await res.json();
    return data.map((d) => ({
      id: String(d.place_id),
      name: (d.display_name as string).split(",")[0].trim(),
      fullLabel: d.display_name as string,
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
      type: d.type ?? d.class ?? "place",
    }));
  } catch {
    // Aborted (superseded by a newer keystroke) or offline — either way,
    // an empty result list is the right thing to show, not an error.
    return [];
  }
}
