import { useEffect, useRef, useState } from "react";
import type { LatLng } from "../types";

export interface UseUserLocationResult {
  location: LatLng | null;
  errorMsg: string | null;
  permissionDenied: boolean;
}

/**
 * Watches the browser's Geolocation API while mounted. Used on the Active
 * Navigation page to move the user dot and drive step auto-advance; on
 * Search / Route Preview it is used once (watch=false) to guess the
 * nearest hub landmark.
 */
export function useUserLocation(watch: boolean): UseUserLocationResult {
  const [location, setLocation] = useState<LatLng | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setErrorMsg("This browser has no geolocation support.");
      return;
    }

    const onSuccess: PositionCallback = (position) => {
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    };

    const onError: PositionErrorCallback = (err) => {
      if (err.code === err.PERMISSION_DENIED) {
        setPermissionDenied(true);
        setErrorMsg("Location permission denied. Showing route without live GPS.");
      } else {
        setErrorMsg(err.message);
      }
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: false,
      timeout: 8000,
    });

    if (watch) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        onSuccess,
        onError,
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
      );
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [watch]);

  return { location, errorMsg, permissionDenied };
}
