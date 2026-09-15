import { FREE_VECTOR_STYLE_URL, OSM_RASTER_STYLE } from "./mapStyle";

export interface RideStyleOptions {
  /** Omit for a route-less "world view" — just the photoreal basemap. */
  routeLine?: unknown;
  travelledLine?: unknown;
  /** Boda mode: green + dashed instead of orange. */
  shortcut?: boolean;
  buildings?: boolean;
  /** Free, no-key aerial imagery as ground texture instead of flat vector fills. */
  satellite?: boolean;
  /** Include the dashed "you're not on the route yet" tether source. */
  withApproach?: boolean;
}

export const APPROACH_SOURCE_ID = "cine-approach";
export const SATELLITE_SOURCE_ID = "visitkla-satellite";

// OpenFreeMap's "Liberty" style is OpenMapTiles-schema — these ids come from
// reading that style directly (see the fetch below), not guessed:
// - landcover_*/landuse_* fill layers are the flat cartoon ground colors we
//   replace with real aerial imagery.
// - `park`/`landcover_grass`/`landcover_wood` are exactly where we sample
//   candidate points for scattered trees (see lib/vegetation.ts).
// - poi_r7/poi_r20 are the low-importance shop/cafe icon clutter; poi_r1 and
//   poi_transit are higher-importance (more likely a hall/hospital/college)
//   and stay. Place labels (suburbs like "Zone 6a") are a separate layer and
//   were never touched by the old blanket POI filter.
const GROUND_FILL_SOURCE_LAYERS = new Set(["landcover", "landuse"]);
const MINOR_POI_LAYER_IDS = new Set(["poi_r7", "poi_r20"]);
export const VEGETATION_QUERY_LAYERS = ["park", "landcover_grass", "landcover_wood"];
const BUILDING_LAYER_ID = "building-3d";

/**
 * Builds the map style with our route layers already baked in.
 *
 * Adding sources with `addSource()` after the map has loaded turned out to
 * be unreliable while the camera is animating every frame — the new source
 * would sit there with data and never get tiled, so the route simply never
 * drew. Shipping the layers as part of the initial style means they're
 * tiled during the normal style load, before a single frame animates.
 */
export async function buildRideStyle(
  options: RideStyleOptions
): Promise<any> {
  let style: any;

  try {
    const res = await fetch(FREE_VECTOR_STYLE_URL);
    if (!res.ok) throw new Error(String(res.status));
    style = await res.json();
  } catch {
    // Vector host unreachable — fall back to raw OSM raster, still $0.
    style = JSON.parse(JSON.stringify(OSM_RASTER_STYLE));
  }

  style.sources = style.sources ?? {};
  style.layers = style.layers ?? [];

  // Drop only the low-importance commercial pin spam. Real landmark labels
  // (halls, hospitals, "Zone 6a"-style neighbourhood names) stay.
  style.layers = style.layers.filter((l: any) => !MINOR_POI_LAYER_IDS.has(l.id));

  if (options.satellite) {
    style.sources[SATELLITE_SOURCE_ID] = {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Imagery: Esri, Maxar, Earthstar Geographics",
    };

    // Flatten the cartoon ground fills to invisible — but keep them in the
    // style (fill-opacity 0, not visibility:none) so their geometry is still
    // queryable for tree placement. Water and parks keep a faint tint so
    // they still read against the imagery.
    for (const layer of style.layers) {
      if (layer.type !== "fill") continue;
      if (GROUND_FILL_SOURCE_LAYERS.has(layer["source-layer"])) {
        layer.paint = { ...layer.paint, "fill-opacity": 0 };
      } else if (layer.id === "park") {
        layer.paint = { ...layer.paint, "fill-opacity": 0.12 };
      }
    }

    const backgroundIndex = style.layers.findIndex(
      (l: any) => l.type === "background"
    );
    style.layers.splice(backgroundIndex + 1, 0, {
      id: SATELLITE_SOURCE_ID,
      type: "raster",
      source: SATELLITE_SOURCE_ID,
      paint: { "raster-opacity": 1, "raster-fade-duration": 0 },
    });

    // Road/place labels were styled for a flat cartoon background — a
    // thin grey halo-width-1 label barely holds up against a busy aerial
    // photo, which is exactly why they were unreadable. A thicker, crisp
    // white plate behind near-black text reads across the wildly varying
    // brightness of real imagery in a way the original subtle halo can't.
    for (const layer of style.layers) {
      if (layer.type !== "symbol") continue;
      if (!layer.paint || !("text-color" in layer.paint || "text-halo-width" in layer.paint)) {
        continue;
      }
      layer.paint = {
        ...layer.paint,
        "text-color": "#141210",
        "text-halo-color": "rgba(255,255,255,0.95)",
        "text-halo-width": 1.8,
        "text-halo-blur": 0.2,
      };
    }
  }

  if (options.buildings) {
    const building = style.layers.find((l: any) => l.id === BUILDING_LAYER_ID);
    if (building) {
      building.paint = {
        ...building.paint,
        // A single flat colour for every roof — what the real ground
        // texture beside it made obvious was wrong: real Kampala rooftops
        // are a mix of rusty corrugated iron, weathered brown, terracotta
        // and concrete grey, not one uniform beige box. There's no way to
        // drape the actual satellite pixels onto a 3D extrusion's roof in
        // MapLibre, so this hashes each building's id into one of six real
        // rooftop tones instead — mismatched with reality per-building,
        // but the right palette and enough variety to read as a real
        // rooftop mosaic instead of a lego set.
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["%", ["coalesce", ["id"], 0], 601],
          0,
          "#a8542e",
          100,
          "#8a6a4a",
          200,
          "#c2793f",
          300,
          "#9c9086",
          400,
          "#7a5030",
          500,
          "#b56b3a",
          600,
          "#8f7a5a",
        ],
        "fill-extrusion-opacity": 0.96,
        "fill-extrusion-vertical-gradient": true,
      };
    }
    // A warm, low, late-afternoon sun — this is what actually shades the
    // extrusions (a lit face and a darker face per building), not a filter.
    style.light = {
      anchor: "map",
      color: "#fff3df",
      intensity: 0.55,
      position: [1.4, 205, 68],
    };
  }

  if (options.routeLine) {
    style.sources["cine-route"] = { type: "geojson", data: options.routeLine };
    style.sources["cine-travelled"] = {
      type: "geojson",
      data: options.travelledLine ?? options.routeLine,
    };

    const accent = options.shortcut ? "#16a34a" : "#ff6b00";
    const accentGlow = options.shortcut ? "#38d07f" : "#ffb067";

    style.layers.push(
      {
        id: "cine-route-glow",
        type: "line",
        source: "cine-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": accentGlow,
          "line-width": 22,
          "line-opacity": 0.2,
          "line-blur": 12,
        },
      },
      {
        id: "cine-route-base",
        type: "line",
        source: "cine-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#232b3a",
          "line-width": 11,
          "line-opacity": 0.88,
        },
      },
      {
        id: "cine-route-centre",
        type: "line",
        source: "cine-route",
        layout: { "line-cap": "butt", "line-join": "round" },
        paint: {
          "line-color": "#f6efe4",
          "line-width": 2,
          "line-opacity": 0.5,
          "line-dasharray": [2.5, 3],
        },
      },
      {
        id: "cine-travelled-glow",
        type: "line",
        source: "cine-travelled",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": accentGlow,
          "line-width": 18,
          "line-opacity": 0.32,
          "line-blur": 10,
        },
      },
      {
        id: "cine-travelled",
        type: "line",
        source: "cine-travelled",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": accent,
          "line-width": 7,
          ...(options.shortcut ? { "line-dasharray": [2, 1.2] } : {}),
        },
      }
    );
  }

  if (options.withApproach) {
    style.sources[APPROACH_SOURCE_ID] = { type: "geojson", data: emptyLine() };
    style.layers.push({
      id: "cine-approach-line",
      type: "line",
      source: APPROACH_SOURCE_ID,
      paint: {
        "line-color": "#6b7280",
        "line-width": 3,
        "line-dasharray": [0.6, 1.6],
      },
    });
  }

  return style;
}

/** An empty line, for the "nothing travelled yet" starting state. */
export function emptyLine() {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: [] },
  };
}
