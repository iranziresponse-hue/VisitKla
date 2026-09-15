import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import type { LatLng } from "../types";

export interface UseUserLocationResult {
  location: LatLng | null;
  errorMsg: string | null;
  permissionDenied: boolean;
}

/**
 * Watches the device GPS while mounted. Used on the Active Navigation
 * screen to move the user dot and drive step auto-advance; on Search /
 * Route Preview it is used once to guess the nearest hub landmark.
 */
export function useUserLocation(watch: boolean): UseUserLocationResult {
  const [location, setLocation] = useState<LatLng | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function start() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        if (isMounted) {
          setPermissionDenied(true);
          setErrorMsg("Location permission denied. Showing route without live GPS.");
        }
        return;
      }

      try {
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (isMounted) {
          setLocation({
            latitude: initial.coords.latitude,
            longitude: initial.coords.longitude,
          });
        }
      } catch {
        // fall through to watchPositionAsync below
      }

      if (!watch) return;

      subscriptionRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 5 },
        (update) => {
          if (!isMounted) return;
          setLocation({
            latitude: update.coords.latitude,
            longitude: update.coords.longitude,
          });
        }
      );
    }

    start();

    return () => {
      isMounted = false;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [watch]);

  return { location, errorMsg, permissionDenied };
}
