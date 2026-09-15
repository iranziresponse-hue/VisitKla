import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { RouteStep, LatLng } from "../types";

// @maplibre/maplibre-react-native ships native code, so it only works in a
// custom dev client (expo prebuild + expo run:android/ios), not plain Expo
// Go. We require() defensively so Search + Route Preview text/list content
// still work even before that native build exists — see README.
let MapLibreGL: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  MapLibreGL = require("@maplibre/maplibre-react-native");
  MapLibreGL = MapLibreGL.default ?? MapLibreGL;
} catch {
  MapLibreGL = null;
}

const OSM_RASTER_STYLE = JSON.stringify({
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
});

interface RouteMapProps {
  steps: RouteStep[];
  userLocation?: LatLng | null;
  /** Boda mode draws the panya shortcut line dashed + green instead of solid orange. */
  showShortcut?: boolean;
}

export function RouteMap({ steps, userLocation, showShortcut }: RouteMapProps) {
  if (!MapLibreGL || steps.length === 0) {
    return <MapFallback steps={steps} />;
  }

  const {
    MapView,
    Camera,
    ShapeSource,
    LineLayer,
    PointAnnotation,
  } = MapLibreGL;

  const coordinates = steps.map((s) => [s.lng, s.lat]);
  const centerLng =
    coordinates.reduce((sum, c) => sum + c[0], 0) / coordinates.length;
  const centerLat =
    coordinates.reduce((sum, c) => sum + c[1], 0) / coordinates.length;

  const routeGeoJSON = {
    type: "Feature",
    geometry: { type: "LineString", coordinates },
    properties: {},
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        styleJSON={OSM_RASTER_STYLE}
        logoEnabled={false}
        attributionEnabled
      >
        <Camera zoomLevel={15} centerCoordinate={[centerLng, centerLat]} />

        <ShapeSource id="routeLine" shape={routeGeoJSON}>
          <LineLayer
            id="routeLineLayer"
            style={{
              lineColor: showShortcut ? "#16a34a" : "#ff6b00",
              lineWidth: 4,
              lineDasharray: showShortcut ? [2, 1.5] : undefined,
            }}
          />
        </ShapeSource>

        {steps.map((s, i) => (
          <PointAnnotation
            key={`${s.landmark}-${i}`}
            id={`step-${i}`}
            coordinate={[s.lng, s.lat]}
          >
            <View style={styles.stepDot} />
          </PointAnnotation>
        ))}

        {userLocation && (
          <PointAnnotation
            id="user"
            coordinate={[userLocation.longitude, userLocation.latitude]}
          >
            <View style={styles.userDot} />
          </PointAnnotation>
        )}
      </MapView>
    </View>
  );
}

function MapFallback({ steps }: { steps: RouteStep[] }) {
  return (
    <View style={[styles.container, styles.fallback]}>
      <Text style={styles.fallbackTitle}>Map preview needs a dev build</Text>
      <Text style={styles.fallbackSubtitle}>
        This route in landmark order:
      </Text>
      <Text style={styles.fallbackRoute}>
        {steps.map((s) => s.landmark).join("  →  ")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", height: "100%", backgroundColor: "#e5e5e5" },
  map: { flex: 1 },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ff6b00",
    borderWidth: 2,
    borderColor: "#fff",
  },
  userDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    borderWidth: 3,
    borderColor: "#fff",
  },
  fallback: { alignItems: "center", justifyContent: "center", padding: 20 },
  fallbackTitle: {
    fontWeight: "700",
    fontSize: 14,
    color: "#555",
    marginBottom: 6,
  },
  fallbackSubtitle: {
    fontSize: 12,
    color: "#777",
    textAlign: "center",
    marginBottom: 8,
  },
  fallbackRoute: {
    fontSize: 13,
    color: "#333",
    textAlign: "center",
    fontWeight: "600",
  },
});
