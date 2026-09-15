import { useMemo } from "react";
import type { LatLng, RouteStep } from "../types";
import { haversineMeters } from "../lib/distance";

export interface NearestStepResult {
  nearestStep: RouteStep | null;
  nearestIndex: number;
  distanceMeters: number | null;
}

/**
 * Finds the step whose landmark is geographically closest to the user's
 * current GPS position. No routing math beyond that — good enough for the
 * 20 hardcoded Zone 1 routes, where steps are ordered along the walk/ride.
 */
export function useNearestStep(
  userLocation: LatLng | null,
  steps: RouteStep[]
): NearestStepResult {
  return useMemo(() => {
    if (steps.length === 0) {
      return { nearestStep: null, nearestIndex: -1, distanceMeters: null };
    }
    if (!userLocation) {
      return { nearestStep: steps[0], nearestIndex: 0, distanceMeters: null };
    }

    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const d = haversineMeters(
        userLocation.latitude,
        userLocation.longitude,
        step.lat,
        step.lng
      );
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
      }
    }

    return {
      nearestStep: steps[bestIndex],
      nearestIndex: bestIndex,
      distanceMeters: bestDistance,
    };
  }, [userLocation, steps]);
}
