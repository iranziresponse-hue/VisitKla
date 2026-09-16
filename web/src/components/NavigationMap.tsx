import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RouteStep, LatLng } from "../types";
import { buildRideStyle, emptyLine, APPROACH_SOURCE_ID } from "../lib/rideStyle";
import {
  bearingBetween,
  bearingDelta,
  metersBetween,
  buildRidePath,
  toGeoPoint,
  type GeoPoint,
} from "../lib/geo";
import { fetchRoadPath } from "../lib/roadRoute";
import { createRiderElement } from "./cinematic/riderMarker";
import { waitForIdle, boundsOf, fitZoomFor } from "../lib/vegetation";
import { SATELLITE_SOURCE_ID } from "../lib/rideStyle";
import "./NavigationMap.css";

interface NavigationMapProps {
  steps: RouteStep[];
  userLocation: LatLng | null;
  activeIndex: number;
  showShortcut?: boolean;
  /** Dashed "you're not on the route yet" line, during the approach phase. */
  approachTarget?: RouteStep | null;
  /** A specific alternative the user already picked — see RouteChoicePage. */
  precomputedPath?: GeoPoint[];
}

/**
 * Live turn-by-turn map: pitched, heading-up, and glued to the user's puck —
 * the same world the cinematic ride showed, now driven by real GPS instead
 * of an animation clock.
 */
export function NavigationMap({
  steps,
  userLocation,
  activeIndex,
  showShortcut,
  approachTarget,
  precomputedPath,
}: NavigationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const puckRef = useRef<maplibregl.Marker | null>(null);
  const stepMarkersRef = useRef<maplibregl.Marker[]>([]);
  const headingRef = useRef(0);
  const lastFixRef = useRef<GeoPoint | null>(null);
  const [ready, setReady] = useState(false);
  const [following, setFollowing] = useState(true);

  useEffect(() => {
    if (!containerRef.current || steps.length === 0) return;

    let map: maplibregl.Map | null = null;
    let cancelled = false;

    (async () => {
      // Real road-snapped geometry (OSRM's free demo server) keeps the
      // puck's route line on actual streets instead of a smoothed straight
      // line cutting through blocks. Falls back to the geometric
      // approximation if the network call fails. A specific alternative
      // the user already picked (RouteChoicePage) is used as-is, since
      // re-deriving from steps would silently discard that choice.
      //
      // Only the real start and end are forced through OSRM — forcing
      // every intermediate landmark as a hard via-point meant one
      // imprecise coordinate (snapping to a dead-end/compound lane
      // instead of the real through-road) could corrupt the whole route
      // with a long out-and-back detour. Step markers below still use the
      // full landmark list regardless of the road geometry.
      const waypoints = steps.map(toGeoPoint);
      let path;
      if (precomputedPath && precomputedPath.length > 1) {
        path = buildRidePath(precomputedPath, { smooth: false });
      } else {
        const endpoints = [waypoints[0], waypoints[waypoints.length - 1]];
        const road = await fetchRoadPath(endpoints);
        if (cancelled) return;
        path =
          road && road.length > 1
            ? buildRidePath(road, { smooth: false })
            : buildRidePath(waypoints);
      }
      const first = path.points[0];

      const style = await buildRideStyle({
        routeLine: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: path.points.map((p) => [p.lng, p.lat]),
          },
        },
        travelledLine: emptyLine(),
        shortcut: showShortcut,
        buildings: true,
        satellite: true,
        withApproach: true,
      });
      if (cancelled || !containerRef.current) return;

      map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: [first.lng, first.lat],
        zoom: 16.6,
        pitch: 55,
        attributionControl: false,
      });
      mapRef.current = map;
      // Only a real user gesture should hand control away from the
      // follow-cam — easeTo() below fires these same 'rotate'/'pitch'
      // events on every GPS tick (it changes bearing/pitch itself), so
      // without the e.originalEvent check the auto-follow would cancel
      // itself out on its very first frame.
      map.on("dragstart", () => setFollowing(false));
      map.on("rotatestart", (e) => {
        if (e.originalEvent) setFollowing(false);
      });
      map.on("pitchstart", (e) => {
        if (e.originalEvent) setFollowing(false);
      });
      map.on("zoomstart", (e) => {
        if (e.originalEvent) setFollowing(false);
      });

      map.on("load", async () => {
        const m = mapRef.current;
        if (!m || cancelled) return;

        stepMarkersRef.current = steps.map((s, i) => {
          const el = document.createElement("div");
          el.className = "nav-pin";
          if (i === steps.length - 1) el.classList.add("nav-pin--end");
          el.innerHTML = `<span class="nav-pin__ring"></span><span class="nav-pin__dot">${i + 1}</span>`;
          return new maplibregl.Marker({ element: el })
            .setLngLat([s.lng, s.lat])
            .addTo(m);
        });

        puckRef.current = new maplibregl.Marker({
          element: createRiderElement(),
          rotationAlignment: "map",
          pitchAlignment: "map",
        })
          .setLngLat([first.lng, first.lat])
          .addTo(m);

        // Same trick as the cinematic ride: briefly frame the whole route
        // corridor to force those tiles to load, sample real green-space
        // geometry for tree placement, then jump back to the live view.
        // Satellite hidden for this hop — only the vector data matters for
        // the query, and skipping the raster fetch here keeps this fast.
        // Short routes skip the detour entirely: the opening view already
        // covers the whole corridor.
        const isShortRoute = path.totalMeters < 260;

        if (!isShortRoute) {
          if (m.getLayer(SATELLITE_SOURCE_ID)) {
            m.setLayoutProperty(SATELLITE_SOURCE_ID, "visibility", "none");
          }
          const canvas = m.getCanvas();
          const bounds = boundsOf(path.points, 110);
          m.jumpTo({
            center: [bounds.centerLng, bounds.centerLat],
            zoom: Math.max(13, fitZoomFor(bounds, Math.min(canvas.width, canvas.height)) - 1.5),
            pitch: 0,
            bearing: 0,
          });
        }
        await waitForIdle(m);
        if (cancelled) return;

        if (!isShortRoute) {
          if (m.getLayer(SATELLITE_SOURCE_ID)) {
            m.setLayoutProperty(SATELLITE_SOURCE_ID, "visibility", "visible");
          }
          m.jumpTo({
            center: [first.lng, first.lat],
            zoom: 16.6,
            pitch: 55,
            bearing: 0,
          });
          // Same fix as the cinematic ride: satellite tiles for this exact
          // view weren't fetched during the wide-corridor detour (it was
          // hidden then), so wait for them here instead of showing a
          // blank/flat view for the first few seconds of real navigation.
          await waitForIdle(m);
          if (cancelled) return;
        }

        setReady(true);
      });
    })();

    return () => {
      cancelled = true;
      stepMarkersRef.current.forEach((mk) => mk.remove());
      stepMarkersRef.current = [];
      puckRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Highlight whichever landmark you're heading for right now.
  useEffect(() => {
    stepMarkersRef.current.forEach((marker, i) => {
      marker.getElement().classList.toggle("nav-pin--active", i === activeIndex);
    });
  }, [activeIndex, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const puck = puckRef.current;
    if (!map || !puck || !userLocation || !ready) return;

    const here: GeoPoint = {
      lat: userLocation.latitude,
      lng: userLocation.longitude,
    };

    // Heading comes from actual movement; standing still keeps the last one
    // rather than spinning the world around randomly.
    const prev = lastFixRef.current;
    if (prev && metersBetween(prev, here) > 3) {
      const target = bearingBetween(prev, here);
      headingRef.current += bearingDelta(headingRef.current, target) * 0.45;
    }
    lastFixRef.current = here;

    puck.setLngLat([here.lng, here.lat]);
    puck.setRotation(headingRef.current);

    const approachSource = map.getSource(APPROACH_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    approachSource?.setData(
      approachTarget
        ? ({
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [
                [here.lng, here.lat],
                [approachTarget.lng, approachTarget.lat],
              ],
            },
          } as any)
        : (emptyLine() as any)
    );

    if (following) {
      map.easeTo({
        center: [here.lng, here.lat],
        bearing: headingRef.current,
        pitch: 55,
        zoom: 17,
        duration: 900,
        essential: true,
      });
    }
  }, [userLocation, following, approachTarget, ready]);

  return (
    <div className="nav-map">
      <div ref={containerRef} className="nav-map__canvas" />
      {!ready && (
        <div className="nav-map__loading">
          <span className="nav-map__spinner" />
        </div>
      )}
      {!following && (
        <button className="nav-map__recenter" onClick={() => setFollowing(true)}>
          Re-centre
        </button>
      )}
    </div>
  );
}
