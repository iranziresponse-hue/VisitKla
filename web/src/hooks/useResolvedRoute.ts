import { useLocation } from "react-router-dom";
import type { Route } from "../types";
import type { GeoPoint } from "../lib/geo";
import { getRouteById } from "../data/routes";

interface RouteNavState {
  route?: Route;
  /**
   * The exact road geometry for a specific alternative the user picked
   * (see RouteChoicePage) — without this, re-deriving a path from just
   * start/end coordinates would always fetch OSRM's single best route,
   * silently discarding whichever alternative was actually chosen.
   */
  precomputedPath?: GeoPoint[];
}

export interface ResolvedRoute {
  route: Route | undefined;
  precomputedPath?: GeoPoint[];
}

/**
 * A route reaches Preview/Ride/Navigate one of two ways: one of our 20
 * curated Zone 1 routes (looked up by :routeId), or a route synthesized
 * on the fly for a freely-searched place (see lib/customRoute.ts), which
 * has no entry in the static list and is passed through react-router's
 * navigation state instead. Every page in the pipeline resolves the same
 * way — and forwards both fields in its own `navigate(..., { state })`
 * calls — so a custom route (and its chosen path, if it's not the OSRM
 * default) survives Preview → Ride → Navigate.
 *
 * Custom routes are session-only by design — there's no $0 backend to
 * persist them server-side, so a hard refresh loses the state and falls
 * back to "not found". The 20 curated routes stay bookmarkable/shareable
 * either way.
 */
export function useResolvedRoute(routeId: string): ResolvedRoute {
  const location = useLocation();
  const state = location.state as RouteNavState | null;

  if (state?.route && state.route.id === routeId) {
    return { route: state.route, precomputedPath: state.precomputedPath };
  }
  return { route: getRouteById(routeId) };
}
