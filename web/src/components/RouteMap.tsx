import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RouteStep, LatLng } from "../types";
import { FREE_VECTOR_STYLE_URL, attachStyleFallback } from "../lib/mapStyle";
import "./RouteMap.css";

const ROUTE_SOURCE_ID = "visitkla-route";
const ROUTE_LAYER_ID = "visitkla-route-line";
const APPROACH_SOURCE_ID = "visitkla-approach";
const APPROACH_LAYER_ID = "visitkla-approach-line";

interface RouteMapProps {
  steps: RouteStep[];
  userLocation?: LatLng | null;
  /** Boda mode draws the panya shortcut line dashed + green instead of solid orange. */
  showShortcut?: boolean;
  /**
   * When set (and userLocation is known), draws a dashed grey line from the
   * user's real GPS dot to this step — the honest "you are here, the fixed
   * route starts over there" gap. Pass null/undefined once real turn-by-turn
   * has begun so it doesn't keep pointing at a landmark already behind you.
   */
  approachTarget?: RouteStep | null;
}

function routeGeoJSON(steps: RouteStep[]) {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: steps.map((s) => [s.lng, s.lat]),
    },
  };
}

function addOrUpdateRoute(
  map: maplibregl.Map,
  steps: RouteStep[],
  shortcut: boolean,
  markersRef: { current: maplibregl.Marker[] }
) {
  const geojson = routeGeoJSON(steps) as any;
  const source = map.getSource(ROUTE_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined;

  if (source) {
    source.setData(geojson);
  } else {
    map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data: geojson });
  }

  if (!map.getLayer(ROUTE_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_LAYER_ID,
      type: "line",
      source: ROUTE_SOURCE_ID,
      paint: {
        "line-color": shortcut ? "#16a34a" : "#ff6b00",
        "line-width": 4,
        "line-dasharray": shortcut ? [2, 1.5] : [1, 0],
      },
    });
  } else {
    map.setPaintProperty(
      ROUTE_LAYER_ID,
      "line-color",
      shortcut ? "#16a34a" : "#ff6b00"
    );
    map.setPaintProperty(
      ROUTE_LAYER_ID,
      "line-dasharray",
      shortcut ? [2, 1.5] : [1, 0]
    );
  }

  markersRef.current.forEach((m) => m.remove());
  markersRef.current = steps.map((s, i) => {
    const el = document.createElement("div");
    el.className = "visitkla-step-dot";
    if (i === 0) el.classList.add("visitkla-step-dot--start");
    if (i === steps.length - 1) el.classList.add("visitkla-step-dot--end");
    return new maplibregl.Marker({ element: el })
      .setLngLat([s.lng, s.lat])
      .addTo(map);
  });
}

/**
 * VisitKla only covers 20 fixed Zone 1 routes — it can't draw a real path
 * from wherever the user happens to be standing. This dashed grey line is
 * how we stay honest about that gap: it visibly connects the user's real
 * GPS dot to the fixed route's actual start, instead of pretending the
 * route begins exactly where they are.
 */
function updateApproachLine(
  map: maplibregl.Map,
  userLocation: LatLng | null | undefined,
  target: RouteStep | null | undefined
) {
  if (!userLocation || !target) {
    if (map.getLayer(APPROACH_LAYER_ID)) {
      map.setLayoutProperty(APPROACH_LAYER_ID, "visibility", "none");
    }
    return;
  }

  const geojson = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: [
        [userLocation.longitude, userLocation.latitude],
        [target.lng, target.lat],
      ],
    },
  } as any;

  const source = map.getSource(APPROACH_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined;

  if (source) {
    source.setData(geojson);
    if (map.getLayer(APPROACH_LAYER_ID)) {
      map.setLayoutProperty(APPROACH_LAYER_ID, "visibility", "visible");
    }
  } else {
    map.addSource(APPROACH_SOURCE_ID, { type: "geojson", data: geojson });
    map.addLayer({
      id: APPROACH_LAYER_ID,
      type: "line",
      source: APPROACH_SOURCE_ID,
      paint: {
        "line-color": "#6b7280",
        "line-width": 2.5,
        "line-dasharray": [0.5, 1.5],
      },
    });
  }
}

function fitToSteps(
  map: maplibregl.Map,
  steps: RouteStep[],
  userLocation?: LatLng | null
) {
  if (steps.length === 0) return;
  const first = steps[0];
  const bounds = steps.reduce(
    (b, s) => b.extend([s.lng, s.lat]),
    new maplibregl.LngLatBounds([first.lng, first.lat], [first.lng, first.lat])
  );
  if (userLocation) {
    bounds.extend([userLocation.longitude, userLocation.latitude]);
  }
  map.fitBounds(bounds, { padding: 56, maxZoom: 16, duration: 300 });
}

export function RouteMap({
  steps,
  userLocation,
  showShortcut,
  approachTarget,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const stepMarkersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const hasFitUserRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || steps.length === 0) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: FREE_VECTOR_STYLE_URL,
      center: [steps[0].lng, steps[0].lat],
      zoom: 15,
    });
    mapRef.current = map;

    attachStyleFallback(map, () => {
      addOrUpdateRoute(map, steps, !!showShortcut, stepMarkersRef);
      fitToSteps(map, steps, userLocation);
      setReady(true);
    });

    map.on("load", () => {
      addOrUpdateRoute(map, steps, !!showShortcut, stepMarkersRef);
      fitToSteps(map, steps, userLocation);
      setReady(true);
    });

    return () => {
      stepMarkersRef.current.forEach((m) => m.remove());
      stepMarkersRef.current = [];
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // Route identity is stable per page instance (React Router remounts
    // this component when routeId changes), so this only needs to run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () =>
      addOrUpdateRoute(map, steps, !!showShortcut, stepMarkersRef);
    if (map.isStyleLoaded()) update();
    else map.once("load", update);
  }, [steps, showShortcut]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function apply(m: maplibregl.Map) {
      if (!userLocation) {
        userMarkerRef.current?.remove();
        userMarkerRef.current = null;
        updateApproachLine(m, null, approachTarget);
        return;
      }

      const lngLat: [number, number] = [
        userLocation.longitude,
        userLocation.latitude,
      ];

      if (!userMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "visitkla-user-dot";
        userMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(m);
      } else {
        userMarkerRef.current.setLngLat(lngLat);
      }

      updateApproachLine(m, userLocation, approachTarget);

      // Widen the view once, the first time we learn where the user
      // actually is, so both the user's dot and the fixed route are
      // visible together. Don't keep re-centering on every GPS tick
      // during live navigation — that would be disorienting.
      if (!hasFitUserRef.current) {
        hasFitUserRef.current = true;
        fitToSteps(m, steps, userLocation);
      }
    }

    if (map.isStyleLoaded()) apply(map);
    else map.once("load", () => apply(map));
  }, [userLocation, steps, approachTarget]);

  if (steps.length === 0) {
    return <div className="route-map route-map--empty">No route</div>;
  }

  return (
    <div className="route-map">
      <div ref={containerRef} className="route-map__canvas" />
      {!ready && (
        <div className="route-map__loading">
          <span className="route-map__spinner" />
        </div>
      )}
    </div>
  );
}
