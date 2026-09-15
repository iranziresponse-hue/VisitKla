import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoPoint } from "../lib/geo";
import type { RoadRouteOption } from "../lib/roadRoute";
import { FREE_VECTOR_STYLE_URL, attachStyleFallback } from "../lib/mapStyle";
import "./RouteAlternativesMap.css";

const ALL_SOURCE = "alt-all";
const ACTIVE_SOURCE = "alt-active";

interface RouteAlternativesMapProps {
  from: GeoPoint;
  to: GeoPoint;
  options: RoadRouteOption[];
  activeIndex: number;
}

function lineFeature(points: GeoPoint[]) {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: points.map((p) => [p.lng, p.lat]) },
  } as any;
}

function allLinesFeatureCollection(options: RoadRouteOption[]) {
  return {
    type: "FeatureCollection",
    features: options.map((o) => lineFeature(o.points)),
  } as any;
}

/**
 * Every alternative traced faintly at once, with whichever one is currently
 * highlighted (hover/selection) drawn bold on top — so choosing a route
 * means actually seeing the roads it takes, not just comparing numbers in a
 * list.
 */
export function RouteAlternativesMap({ from, to, options, activeIndex }: RouteAlternativesMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || options.length === 0) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: FREE_VECTOR_STYLE_URL,
      center: [(from.lng + to.lng) / 2, (from.lat + to.lat) / 2],
      zoom: 13,
      attributionControl: false,
    });
    mapRef.current = map;

    function setup() {
      map.addSource(ALL_SOURCE, { type: "geojson", data: allLinesFeatureCollection(options) });
      map.addSource(ACTIVE_SOURCE, { type: "geojson", data: lineFeature(options[activeIndex]?.points ?? []) });

      map.addLayer({
        id: "alt-all-line",
        type: "line",
        source: ALL_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#9a948c", "line-width": 3, "line-opacity": 0.55 },
      });
      map.addLayer({
        id: "alt-active-line",
        type: "line",
        source: ACTIVE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ff6b00", "line-width": 5 },
      });

      const startEl = document.createElement("div");
      startEl.className = "alt-map-dot alt-map-dot--start";
      new maplibregl.Marker({ element: startEl }).setLngLat([from.lng, from.lat]).addTo(map);

      const endEl = document.createElement("div");
      endEl.className = "alt-map-dot alt-map-dot--end";
      new maplibregl.Marker({ element: endEl }).setLngLat([to.lng, to.lat]).addTo(map);

      const bounds = options
        .flatMap((o) => o.points)
        .reduce(
          (b, p) => b.extend([p.lng, p.lat]),
          new maplibregl.LngLatBounds([from.lng, from.lat], [to.lng, to.lat])
        );
      map.fitBounds(bounds, { padding: 40, duration: 0 });
      setReady(true);
    }

    attachStyleFallback(map, setup);
    map.on("load", setup);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource(ACTIVE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    source?.setData(lineFeature(options[activeIndex]?.points ?? []));
  }, [activeIndex, options]);

  return (
    <div className="alt-map">
      <div ref={containerRef} className="alt-map__canvas" />
      {!ready && (
        <div className="alt-map__loading">
          <span className="alt-map__spinner" />
        </div>
      )}
    </div>
  );
}
