import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Route, RouteStep, LatLng } from "../../types";
import { buildRideStyle, emptyLine } from "../../lib/rideStyle";
import {
  buildRidePath,
  sampleAt,
  bearingBetween,
  bearingDelta,
  distanceAlongFor,
  toGeoPoint,
  type GeoPoint,
  type RidePath,
} from "../../lib/geo";
import { fetchRoadPath } from "../../lib/roadRoute";
import { scatterTrees, waitForIdle, boundsOf, fitZoomFor } from "../../lib/vegetation";
import { SATELLITE_SOURCE_ID } from "../../lib/rideStyle";
import { findLandmarkByName } from "../../data/landmarks";
import { createRideAudio, type RideAudio } from "../../lib/rideAudio";
import { applyNaturalVoice } from "../../lib/voice";
import { createRiderElement, RIDER_SIDE_IMAGE_SRC } from "./riderMarker";
import "./CinematicRide.css";

const TRAVELLED_SOURCE = "cine-travelled";

const ESTABLISH_MS = 2100;
const OUTRO_MS = 1600;
const ARRIVE_HOLD_MS = 2400;
const CAPTION_HOLD_MS = 3400;

// Ride duration scales with real distance so longer routes don't look
// sped-up — but a flat ms-per-metre rate with a hard cap has its own bug:
// once a route is long enough to hit the cap, EVERY longer route plays in
// that same capped time, so a 6.8km custom trip ends up moving several
// times faster than a 1.7km one — the opposite of the fix. A square-root
// curve keeps duration monotonically increasing with distance (nothing
// longer ever plays faster than something shorter) while still not
// growing linearly forever — a 10x longer trip takes ~3x longer to watch,
// not 10x.
const RIDE_MS_PER_SQRT_METER = 825;
const MIN_RIDE_MS = 10000;
const MAX_RIDE_MS = 75000;

function computeRideMs(totalMeters: number): number {
  return Math.min(
    MAX_RIDE_MS,
    Math.max(MIN_RIDE_MS, RIDE_MS_PER_SQRT_METER * Math.sqrt(totalMeters))
  );
}

// How far ahead the camera looks to decide which way to face. Larger =
// gentler, more anticipated turns; smaller = reacts right at the corner.
const LOOK_AHEAD_METERS = 48;
// Exponential smoothing factor for camera bearing, per frame. Lower = the
// camera eases into a turn over many frames instead of snapping.
const BEARING_SMOOTHING = 0.07;

const SPEED_STEPS = [0.5, 1, 1.5, 2];

type Phase = "preparing" | "establishing" | "riding" | "paused" | "arriving";

interface CinematicRideProps {
  route: Route;
  userLocation: LatLng | null;
  /**
   * A specific alternative the user already picked (see RouteChoicePage) —
   * when present, skips the OSRM fetch entirely and rides exactly that
   * geometry instead of silently re-deriving OSRM's single best path.
   */
  precomputedPath?: GeoPoint[];
  onExit: () => void;
  onStartJourney: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

interface Beat {
  step: RouteStep;
  index: number;
  atMeters: number;
}

function lineFeature(points: GeoPoint[]) {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: points.map((p) => [p.lng, p.lat]),
    },
  } as any;
}

/** Gentle push off the line and a soft landing; constant speed in between. */
function easeRide(p: number): number {
  if (p < 0.12) {
    const t = p / 0.12;
    return 0.12 * t * t * (3 - 2 * t) * 0.85 + 0.12 * t * 0.15;
  }
  if (p > 0.88) {
    const t = (p - 0.88) / 0.12;
    const eased = 1 - (1 - t) * (1 - t);
    return 0.88 + 0.12 * eased;
  }
  return p;
}

function speak(text: string, audio: RideAudio | null) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  applyNaturalVoice(u);
  u.onstart = () => audio?.duck(true);
  u.onend = () => audio?.duck(false);
  u.onerror = () => audio?.duck(false);
  window.speechSynthesis.speak(u);
}

export function CinematicRide({
  route,
  userLocation,
  precomputedPath,
  onExit,
  onStartJourney,
  muted,
  onToggleMute,
}: CinematicRideProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const riderRef = useRef<maplibregl.Marker | null>(null);
  const treeMarkersRef = useRef<maplibregl.Marker[]>([]);
  const rafRef = useRef<number | null>(null);
  const virtualElapsedRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const bearingRef = useRef(0);
  const cursorRef = useRef(0);
  const beatIndexRef = useRef(0);
  const lastTravelUpdateRef = useRef(0);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const mutedRef = useRef(muted);
  const speedRef = useRef(1);
  const audioRef = useRef<RideAudio | null>(null);
  const loopRideRef = useRef<() => void>(() => {});

  const [phase, setPhase] = useState<Phase>("preparing");
  const [caption, setCaption] = useState<Beat | null>(null);
  // Unlike `caption` (a few seconds, then gone), this always names whichever
  // landmark is coming up next — the caption alone left long stretches of
  // the ride with no place name on screen at all, which is exactly how
  // someone loses track of where they actually are.
  const [upcomingIndex, setUpcomingIndex] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [usedRealRoad, setUsedRealRoad] = useState<boolean | null>(null);
  const [garageImgFailed, setGarageImgFailed] = useState(false);

  useEffect(() => {
    mutedRef.current = muted;
    audioRef.current?.setMuted(muted);
    if (muted && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, [muted]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    const audio = createRideAudio();
    audioRef.current = audio;
    audio?.resume();
    audio?.setMuted(mutedRef.current);
    return () => {
      audio?.dispose();
      audioRef.current = null;
    };
  }, []);

  // Real road-snapped geometry (OSRM's free demo server) is what keeps the
  // rider on actual streets instead of a smoothed straight line cutting
  // through blocks — the "flying like a plane" problem. Falls back to the
  // geometric approximation if the network call fails; either way this
  // only runs once per mounted ride.
  const [ridePath, setRidePath] = useState<RidePath | null>(null);
  useEffect(() => {
    let cancelled = false;

    // A specific alternative was already chosen (RouteChoicePage) — ride
    // exactly that geometry. Re-deriving from just start/end would always
    // hand back OSRM's single best path, silently discarding the choice.
    if (precomputedPath && precomputedPath.length > 1) {
      setRidePath(buildRidePath(precomputedPath, { smooth: false }));
      setUsedRealRoad(true);
      return;
    }

    const waypoints: GeoPoint[] = [];
    if (userLocation) {
      waypoints.push({ lat: userLocation.latitude, lng: userLocation.longitude });
    }
    route.steps.forEach((s) => waypoints.push(toGeoPoint(s)));

    (async () => {
      const road = await fetchRoadPath(waypoints);
      if (cancelled) return;
      if (road && road.length > 1) {
        setRidePath(buildRidePath(road, { smooth: false }));
        setUsedRealRoad(true);
      } else {
        setRidePath(buildRidePath(waypoints));
        setUsedRealRoad(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // route/userLocation are fixed for the life of this mounted ride.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rideMs = useMemo(() => {
    if (!ridePath) return MIN_RIDE_MS;
    return computeRideMs(ridePath.totalMeters);
  }, [ridePath]);

  const beats: Beat[] = useMemo(() => {
    if (!ridePath) return [];
    return route.steps.map((step, index) => ({
      step,
      index,
      atMeters: distanceAlongFor(ridePath, toGeoPoint(step)),
    }));
  }, [route, ridePath]);

  const startsFromUser = !!userLocation;

  // ---- the film loop -------------------------------------------------
  const runFrame = useCallback(
    (now: number) => {
      const map = mapRef.current;
      const rider = riderRef.current;
      const path = ridePath;
      if (!map || !rider || !path) return;

      const dt = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;
      virtualElapsedRef.current += dt * speedRef.current;

      const p = Math.min(1, virtualElapsedRef.current / rideMs);
      const travelled = path.totalMeters * easeRide(p);

      const here = sampleAt(path, travelled, cursorRef.current);
      cursorRef.current = here.index;
      const ahead = sampleAt(
        path,
        Math.min(path.totalMeters, travelled + LOOK_AHEAD_METERS),
        here.index
      );

      const targetBearing =
        here.index === ahead.index
          ? bearingRef.current
          : bearingBetween(here.point, ahead.point);
      bearingRef.current +=
        bearingDelta(bearingRef.current, targetBearing) * BEARING_SMOOTHING;

      rider.setLngLat([here.point.lng, here.point.lat]);
      rider.setRotation(bearingRef.current);

      const zoom =
        p < 0.14
          ? 16.5 + (17.35 - 16.5) * (p / 0.14)
          : p > 0.9
            ? 17.35 - (17.35 - 16.9) * ((p - 0.9) / 0.1)
            : 17.35;
      const pitch = p > 0.9 ? 62 - 10 * ((p - 0.9) / 0.1) : 62;

      map.jumpTo({
        center: [ahead.point.lng, ahead.point.lat],
        bearing: bearingRef.current,
        zoom,
        pitch,
      });

      if (now - lastTravelUpdateRef.current > 33) {
        lastTravelUpdateRef.current = now;
        const src = map.getSource(TRAVELLED_SOURCE) as
          | maplibregl.GeoJSONSource
          | undefined;
        src?.setData(
          lineFeature(path.points.slice(0, Math.max(2, here.index + 1)))
        );
      }

      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${p})`;
      }

      const throttle = p < 0.12 ? p / 0.12 : p > 0.88 ? (1 - p) / 0.12 : 1;
      audioRef.current?.setThrottle(throttle);

      const nextBeat = beats[beatIndexRef.current];
      if (nextBeat && travelled >= nextBeat.atMeters - 6) {
        beatIndexRef.current += 1;
        setUpcomingIndex(beatIndexRef.current);
        setCaption(nextBeat);
        const type =
          findLandmarkByName(nextBeat.step.landmark)?.type ?? "landmark";
        audioRef.current?.cue(type);
        if (!mutedRef.current) speak(nextBeat.step.text, audioRef.current);
        window.setTimeout(() => {
          setCaption((c) => (c?.index === nextBeat.index ? null : c));
        }, CAPTION_HOLD_MS);
      }

      if (p >= 1) {
        loopRideRef.current();
        return;
      }
      rafRef.current = requestAnimationFrame(runFrame);
    },
    [ridePath, rideMs, beats]
  );

  const beginRide = useCallback(() => {
    setPhase("riding");
    audioRef.current?.resume();
    audioRef.current?.startAmbience();
    audioRef.current?.cue("depart");
    virtualElapsedRef.current = 0;
    lastFrameTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(runFrame);
  }, [runFrame]);

  // Reaching the destination isn't a dead end — it's a lap. Users want to
  // watch again by default, not hunt for a "watch again" button, and
  // "Start Journey" is always available separately (see the persistent
  // action row) so leaving is a deliberate choice, not something forced by
  // the preview ending.
  const loopRide = useCallback(() => {
    setPhase("arriving");
    setCaption(null);
    audioRef.current?.setThrottle(0);
    audioRef.current?.cue("arrive");
    const map = mapRef.current;
    const path = ridePath;
    if (map && path) {
      const last = path.points[path.points.length - 1];
      map.easeTo({
        center: [last.lng, last.lat],
        zoom: 16.1,
        pitch: 38,
        bearing: bearingRef.current + 22,
        duration: OUTRO_MS,
        essential: true,
      });
    }

    window.setTimeout(() => {
      const p2 = ridePath;
      const m2 = mapRef.current;
      const r2 = riderRef.current;
      if (!p2 || !m2 || !r2) return;

      virtualElapsedRef.current = 0;
      cursorRef.current = 0;
      beatIndexRef.current = 0;
      setUpcomingIndex(0);
      lastFrameTimeRef.current = performance.now();

      const first = p2.points[0];
      const second = p2.points[Math.min(6, p2.points.length - 1)];
      const openingBearing = bearingBetween(first, second);
      bearingRef.current = openingBearing;

      r2.setLngLat([first.lng, first.lat]);
      r2.setRotation(openingBearing);
      m2.jumpTo({
        center: [first.lng, first.lat],
        zoom: 16.2,
        pitch: 58,
        bearing: openingBearing - 26,
      });

      beginRide();
    }, ARRIVE_HOLD_MS);
  }, [ridePath, beginRide]);

  useEffect(() => {
    loopRideRef.current = loopRide;
  }, [loopRide]);

  const togglePause = useCallback(() => {
    setPhase((current) => {
      if (current === "riding") {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        audioRef.current?.setThrottle(0);
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
        return "paused";
      }
      if (current === "paused") {
        lastFrameTimeRef.current = performance.now();
        rafRef.current = requestAnimationFrame(runFrame);
        return "riding";
      }
      return current;
    });
  }, [runFrame]);

  function cycleSpeed() {
    setSpeed((s) => {
      const idx = SPEED_STEPS.indexOf(s);
      return SPEED_STEPS[(idx + 1) % SPEED_STEPS.length];
    });
  }

  // ---- map bootstrap --------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || !ridePath || ridePath.points.length < 2) return;

    let map: maplibregl.Map | null = null;
    let cancelled = false;

    const first = ridePath.points[0];
    const second = ridePath.points[Math.min(6, ridePath.points.length - 1)];
    const openingBearing = bearingBetween(first, second);
    bearingRef.current = openingBearing;

    buildRideStyle({
      routeLine: lineFeature(ridePath.points),
      travelledLine: emptyLine(),
      buildings: true,
      satellite: true,
    }).then((style) => {
      if (cancelled || !containerRef.current) return;

      map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: [first.lng, first.lat],
        zoom: 16.2,
        pitch: 58,
        bearing: openingBearing - 26,
        interactive: false,
        attributionControl: false,
      });
      mapRef.current = map;

      map.on("load", async () => {
        const m = mapRef.current;
        if (!m || cancelled) return;

        route.steps.forEach((step, i) => {
          const el = document.createElement("div");
          el.className = "cine-pin";
          if (i === route.steps.length - 1) el.classList.add("cine-pin--end");
          el.innerHTML = `<span class="cine-pin__ring"></span><span class="cine-pin__dot"></span>`;
          new maplibregl.Marker({ element: el })
            .setLngLat([step.lng, step.lat])
            .addTo(m);
        });

        riderRef.current = new maplibregl.Marker({
          element: createRiderElement(),
          rotationAlignment: "map",
          pitchAlignment: "map",
        })
          .setLngLat([first.lng, first.lat])
          .setRotation(openingBearing)
          .addTo(m);

        const isShortRoute = ridePath.totalMeters < 260;

        if (!isShortRoute) {
          if (m.getLayer(SATELLITE_SOURCE_ID)) {
            m.setLayoutProperty(SATELLITE_SOURCE_ID, "visibility", "none");
          }
          const canvas = m.getCanvas();
          const bounds = boundsOf(ridePath.points, 110);
          m.jumpTo({
            center: [bounds.centerLng, bounds.centerLat],
            zoom: Math.max(13, fitZoomFor(bounds, Math.min(canvas.width, canvas.height)) - 1.5),
            pitch: 0,
            bearing: 0,
          });
          await waitForIdle(m);
          if (cancelled) return;
        } else {
          await waitForIdle(m);
          if (cancelled) return;
        }

        treeMarkersRef.current = scatterTrees(m, ridePath.points, {
          maxTrees: isShortRoute ? 30 : 80,
        });

        if (!isShortRoute) {
          if (m.getLayer(SATELLITE_SOURCE_ID)) {
            m.setLayoutProperty(SATELLITE_SOURCE_ID, "visibility", "visible");
          }
          m.jumpTo({
            center: [first.lng, first.lat],
            zoom: 16.2,
            pitch: 58,
            bearing: openingBearing - 26,
          });
          // Restoring satellite visibility here doesn't mean its tiles for
          // THIS view have loaded yet — they were hidden (and un-fetched)
          // during the whole wide-corridor detour. Without this wait the
          // ride starts over a blank/flat view until they arrive, which is
          // exactly what a long, never-before-visited route showed: no
          // ground texture, no buildings, for the first several seconds.
          await waitForIdle(m);
          if (cancelled) return;
        }

        setMapReady(true);
      });
    });

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      riderRef.current = null;
      treeMarkersRef.current.forEach((t) => t.remove());
      treeMarkersRef.current = [];
      map?.remove();
      mapRef.current = null;
    };
    // Runs once, as soon as ridePath resolves from null -> a real path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ridePath]);

  // ---- establishing orbit, then roll ---------------------------------
  const beginRideRef = useRef(beginRide);
  useEffect(() => {
    beginRideRef.current = beginRide;
  }, [beginRide]);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    setPhase("establishing");
    map.easeTo({
      bearing: bearingRef.current,
      zoom: 16.5,
      pitch: 62,
      duration: ESTABLISH_MS,
      essential: true,
    });

    const t = window.setTimeout(() => beginRideRef.current(), ESTABLISH_MS);
    return () => window.clearTimeout(t);
  }, [mapReady]);

  const skip = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (progressBarRef.current) progressBarRef.current.style.transform = "scaleX(1)";
    loopRideRef.current();
  };

  const landmarkType = caption
    ? (findLandmarkByName(caption.step.landmark)?.type ?? "landmark")
    : null;

  const upcomingStep =
    beats[Math.min(upcomingIndex, Math.max(beats.length - 1, 0))]?.step ?? null;
  const arrivedAtLast = upcomingIndex >= beats.length;

  return (
    <div className={`cine cine--${phase}`}>
      <div ref={containerRef} className="cine__map" />

      <div className="cine__grade" />
      <div className="cine__vignette" />
      <div className="cine__grain" />
      <div className="cine__bar cine__bar--top" />
      <div className="cine__bar cine__bar--bottom" />

      {!mapReady && (
        <div className="cine__boot">
          {garageImgFailed ? (
            <span className="cine__boot-spinner" />
          ) : (
            <div className="cine__boot-garage">
              <div className="cine__boot-beam" />
              <img
                src={RIDER_SIDE_IMAGE_SRC}
                alt=""
                className="cine__boot-bike"
                onError={() => setGarageImgFailed(true)}
              />
            </div>
          )}
          <p className="cine__boot-text">
            {ridePath ? "Building your ride…" : "Finding the real road…"}
          </p>
        </div>
      )}

      <div className="cine__hud">
        <div className="cine__hud-left">
          <span className="cine__kicker">
            VisitKla ride preview
            {usedRealRoad === false && " · approximate path"}
          </span>
        </div>
        <div className="cine__hud-right">
          {(phase === "riding" || phase === "paused") && (
            <>
              <button className="cine__chip" onClick={cycleSpeed}>
                {speed}×
              </button>
              <button className="cine__chip" onClick={togglePause}>
                {phase === "paused" ? "Play" : "Pause"}
              </button>
            </>
          )}
          <button className="cine__chip" onClick={onToggleMute}>
            {muted ? "Unmute" : "Mute"}
          </button>
          <button className="cine__chip" onClick={skip}>
            Skip
          </button>
          <button className="cine__chip cine__chip--ghost" onClick={onExit}>
            ✕
          </button>
        </div>
      </div>

      {(phase === "riding" || phase === "paused") && upcomingStep && (
        <div className="cine__next-banner">
          <span className="cine__next-banner-label">
            {arrivedAtLast ? "Arriving at" : "Next"}
          </span>
          <span className="cine__next-banner-name">{upcomingStep.landmark}</span>
        </div>
      )}

      {phase === "establishing" && (
        <div className="cine__title">
          <span className="cine__title-kicker">
            {startsFromUser ? "From where you are" : "Zone 1 · Kampala"}
          </span>
          <h1 className="cine__title-main">
            {route.start}
            <span className="cine__title-arrow">→</span>
            {route.end}
          </h1>
          <span className="cine__title-sub">{route.steps.length} landmarks</span>
        </div>
      )}

      {caption && (
        <div className="cine__caption" key={caption.index}>
          <div className={`cine__caption-badge cine__caption-badge--${landmarkType}`}>
            {caption.index + 1}
          </div>
          <div className="cine__caption-body">
            <span className="cine__caption-landmark">
              {caption.step.landmark}
            </span>
            <p className="cine__caption-text">{caption.step.text}</p>
          </div>
        </div>
      )}

      {phase !== "preparing" && (
        <div className="cine__actions">
          <button className="cine__action cine__action--journey" onClick={onStartJourney}>
            Start Journey
          </button>
        </div>
      )}

      <div className="cine__timeline">
        <div className="cine__timeline-track">
          <div ref={progressBarRef} className="cine__timeline-fill" />
          {ridePath &&
            beats.map((b) => (
              <span
                key={b.index}
                className="cine__timeline-tick"
                style={{
                  left: `${ridePath.totalMeters ? (b.atMeters / ridePath.totalMeters) * 100 : 0}%`,
                }}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
