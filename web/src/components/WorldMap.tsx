import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Landmark, LatLng } from "../types";
import { buildRideStyle } from "../lib/rideStyle";
import { scatterTrees, waitForIdle, boundsOf, fitZoomFor } from "../lib/vegetation";
import { createUserPuckElement } from "./cinematic/riderMarker";
import "./WorldMap.css";

interface WorldMapProps {
  landmarks: Landmark[];
  userLocation: LatLng | null;
  onSelect: (landmark: Landmark) => void;
}

/**
 * The default landing view — a persistent, tour-able photoreal map of all
 * Zone 1 hub landmarks, on the same satellite+3D-buildings+trees world the
 * cinematic ride and live navigation use. This is the "game", not a form;
 * search (see SearchDrawer) is how you tell it where to take you.
 */
export function WorldMap({ landmarks, userLocation, onSelect }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const puckRef = useRef<maplibregl.Marker | null>(null);
  const pinMarkersRef = useRef<maplibregl.Marker[]>([]);
  const treeMarkersRef = useRef<maplibregl.Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!containerRef.current || landmarks.length === 0) return;

    let map: maplibregl.Map | null = null;
    let cancelled = false;

    const points = landmarks.map((l) => ({ lat: l.lat, lng: l.lng }));
    const bounds = boundsOf(points, 220);

    buildRideStyle({ buildings: true, satellite: true }).then((style) => {
      if (cancelled || !containerRef.current) return;

      const canvas0 = { width: containerRef.current.clientWidth || 400, height: containerRef.current.clientHeight || 700 };
      map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: [bounds.centerLng, bounds.centerLat],
        zoom: fitZoomFor(bounds, Math.min(canvas0.width, canvas0.height)),
        pitch: 55,
        bearing: -12,
        attributionControl: false,
      });
      mapRef.current = map;

      map.on("load", async () => {
        const m = mapRef.current;
        if (!m || cancelled) return;

        pinMarkersRef.current = landmarks.map((landmark) => {
          const el = document.createElement("div");
          el.className = "world-pin";
          el.innerHTML = `<span class="world-pin__ring"></span><span class="world-pin__dot"></span><span class="world-pin__label">${landmark.name}</span>`;
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            onSelectRef.current(landmark);
          });
          return new maplibregl.Marker({ element: el, anchor: "bottom" })
            .setLngLat([landmark.lng, landmark.lat])
            .addTo(m);
        });

        if (userLocation) {
          puckRef.current = new maplibregl.Marker({
            element: createUserPuckElement(),
            rotationAlignment: "map",
            pitchAlignment: "map",
          })
            .setLngLat([userLocation.longitude, userLocation.latitude])
            .addTo(m);
        }

        await waitForIdle(m);
        if (cancelled) return;
        treeMarkersRef.current = scatterTrees(m, points, { maxTrees: 70 });

        setReady(true);
      });
    });

    return () => {
      cancelled = true;
      pinMarkersRef.current.forEach((mk) => mk.remove());
      pinMarkersRef.current = [];
      treeMarkersRef.current.forEach((t) => t.remove());
      treeMarkersRef.current = [];
      puckRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
    // Landmark set is static for the app's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the "you are here" puck in sync if a location fix arrives late.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !userLocation) return;
    const lngLat: [number, number] = [userLocation.longitude, userLocation.latitude];
    if (!puckRef.current) {
      puckRef.current = new maplibregl.Marker({
        element: createUserPuckElement(),
        rotationAlignment: "map",
        pitchAlignment: "map",
      })
        .setLngLat(lngLat)
        .addTo(map);
    } else {
      puckRef.current.setLngLat(lngLat);
    }
  }, [userLocation, ready]);

  return (
    <div className="world-map">
      <div ref={containerRef} className="world-map__canvas" />
      {!ready && (
        <div className="world-map__loading">
          <span className="world-map__spinner" />
          <p className="world-map__loading-text">Loading Zone 1…</p>
        </div>
      )}
    </div>
  );
}
