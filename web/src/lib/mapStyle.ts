import maplibregl from "maplibre-gl";

// Free vector basemap, no API key, no signup: https://openfreemap.org
export const FREE_VECTOR_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

// If that host is ever unreachable, fall back to raw OpenStreetMap raster
// tiles — still $0, still no API key.
export const OSM_RASTER_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
} as const;

/**
 * Wires the raster fallback for a vector style that never loads.
 *
 * Only errors raised *before* the style is up trigger the downgrade — once
 * the map is live, a single failed tile (or a layer we add ourselves) must
 * not tear the whole basemap down to raster.
 */
export function attachStyleFallback(
  map: maplibregl.Map,
  onFallback: () => void
) {
  let fellBack = false;
  let styleReady = false;

  map.on("load", () => {
    styleReady = true;
  });

  map.on("error", () => {
    if (fellBack || styleReady) return;
    fellBack = true;
    map.setStyle(OSM_RASTER_STYLE as any);
    map.once("styledata", () => {
      styleReady = true;
      onFallback();
    });
  });
}

/**
 * The world map, cinematic ride, and live-navigation maps (see
 * lib/rideStyle.ts) build their own style up front — including 3D
 * buildings, ground satellite imagery, and label filtering — because
 * adding those after the map has already loaded turned out to be
 * unreliable mid-animation. RouteMap (the Route Preview screen's simpler
 * map) doesn't need any of that, just this fallback.
 */
