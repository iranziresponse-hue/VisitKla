import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CinematicRide } from "../components/cinematic/CinematicRide";
import { useUserLocation } from "../hooks/useUserLocation";
import { useResolvedRoute } from "../hooks/useResolvedRoute";
import "./RidePage.css";

// How long we'll wait for a GPS fix before starting the film from the
// route's own first landmark instead of from the viewer.
const LOCATION_GRACE_MS = 2600;

export function RidePage() {
  const { routeId = "", mode = "landmark" } = useParams();
  const navigate = useNavigate();
  const { route, precomputedPath } = useResolvedRoute(routeId);
  const { location } = useUserLocation(false);

  const [muted, setMuted] = useState(false);
  const [graceOver, setGraceOver] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setGraceOver(true), LOCATION_GRACE_MS);
    return () => window.clearTimeout(t);
  }, []);

  // The film only mounts once we have a fix (or gave up waiting), so the
  // path it draws can't shift underneath the animation mid-ride.
  const ready = !!location || graceOver;

  const handleToggleMute = useCallback(() => setMuted((m) => !m), []);
  const handleExit = useCallback(() => {
    navigate(`/route/${routeId}`, { state: { route, precomputedPath } });
  }, [navigate, routeId, route, precomputedPath]);
  const handleStartJourney = useCallback(() => {
    navigate(`/route/${routeId}/navigate/${mode}`, { state: { route, precomputedPath } });
  }, [navigate, routeId, mode, route, precomputedPath]);

  if (!route) {
    return (
      <div className="ride-page__missing">
        <p>Route not found.</p>
        <button onClick={() => navigate("/")}>Back to search</button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="ride-page__prep">
        <span className="ride-page__prep-spinner" />
        <p className="ride-page__prep-title">Finding you…</p>
        <p className="ride-page__prep-sub">
          So the ride can start from where you actually are
        </p>
      </div>
    );
  }

  return (
    <CinematicRide
      route={route}
      userLocation={location}
      precomputedPath={precomputedPath}
      muted={muted}
      onToggleMute={handleToggleMute}
      onExit={handleExit}
      onStartJourney={handleStartJourney}
    />
  );
}
