import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Landmark } from "../types";
import {
  HUB_LANDMARKS,
  findRoute,
  getRoutesEndingAt,
  getRoutesStartingAt,
} from "../data/routes";
import { WorldMap } from "../components/WorldMap";
import { SearchDrawer, type PlacePick } from "../components/SearchDrawer";
import { useUserLocation } from "../hooks/useUserLocation";
import { haversineMeters } from "../lib/distance";
import "./WorldPage.css";

const DEFAULT_START = "Makerere Main Gate";
// Beyond this, VisitKla's fixed Zone 1 hubs aren't a believable stand-in
// for "where you are" any more — say so instead of quietly guessing.
const OUTSIDE_ZONE1_METERS = 1500;

function nearestHubLandmark(
  userLat: number,
  userLng: number,
  exclude?: string
): { landmark: Landmark; distanceMeters: number } {
  let best = HUB_LANDMARKS[0];
  let bestDist = Infinity;
  for (const l of HUB_LANDMARKS) {
    if (l.name === exclude) continue;
    const d = haversineMeters(userLat, userLng, l.lat, l.lng);
    if (d < bestDist) {
      bestDist = d;
      best = l;
    }
  }
  return { landmark: best, distanceMeters: bestDist };
}

function landmarkToPick(l: Landmark): PlacePick {
  return { name: l.name, lat: l.lat, lng: l.lng, isHub: true };
}

/**
 * The app's default screen: a persistent, tour-able 3D map of Zone 1 you
 * land straight into — the "game" — with search demoted to an on-demand
 * side panel instead of being the first thing you see.
 */
export function WorldPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fromPick, setFromPick] = useState<PlacePick | null>(null);
  const { location } = useUserLocation(false);
  const navigate = useNavigate();

  const nearestStart = useMemo(() => {
    if (!location) return null;
    return nearestHubLandmark(location.latitude, location.longitude);
  }, [location]);

  function resolveFrom(excludeName?: string): PlacePick {
    if (fromPick) return fromPick;
    if (location) {
      const nearest = nearestHubLandmark(
        location.latitude,
        location.longitude,
        excludeName
      );
      return landmarkToPick(nearest.landmark);
    }
    const gate = HUB_LANDMARKS.find((l) => l.name === DEFAULT_START)!;
    return landmarkToPick(gate);
  }

  function handlePickTo(to: PlacePick) {
    const from = resolveFrom(to.name);

    // Fast path: both ends are one of our 15 curated Zone 1 landmarks and
    // a hand-written, landmark-narrated route already exists for them —
    // use that instead of a generic "head to X" synthetic one.
    if (from.isHub && to.isHub) {
      const route =
        findRoute(from.name, to.name) ??
        getRoutesEndingAt(to.name)[0] ??
        getRoutesStartingAt(to.name)[0];
      if (route) {
        setDrawerOpen(false);
        navigate(`/route/${route.id}`);
        return;
      }
    }

    // Anywhere else: let the user choose from real road-routed
    // alternatives before committing (see RouteChoicePage).
    setDrawerOpen(false);
    navigate("/plan", { state: { from, to } });
  }

  return (
    <div className="world-page">
      <WorldMap
        landmarks={HUB_LANDMARKS}
        userLocation={location}
        onSelect={(landmark) => handlePickTo(landmarkToPick(landmark))}
      />

      {!drawerOpen && (
        <button
          className="world-page__search-fab"
          onClick={() => setDrawerOpen(true)}
          aria-label="Search for a place"
        >
          ⌕
        </button>
      )}

      <SearchDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        hubLandmarks={HUB_LANDMARKS}
        nearestStart={nearestStart}
        outsideZoneMeters={OUTSIDE_ZONE1_METERS}
        userLocation={location}
        fromPick={fromPick}
        onPickFrom={setFromPick}
        onPickTo={handlePickTo}
      />
    </div>
  );
}
