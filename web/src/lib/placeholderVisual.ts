import type { LandmarkType } from "../types";

/**
 * Landmark photos in seed-data.json point at picsum.photos placeholders —
 * fine for a data model, bad for a first render: random stock photos of a
 * deer or a bridge for "Wandegeya Total" look wrong, and picsum's redirect
 * chain takes 5-8s to resolve for a batch of images, leaving blank grey
 * boxes on first load. Until real Mapillary/on-site photos are wired in
 * (see README), every landmark gets an instant, zero-network, deterministic
 * gradient + icon instead — same landmark always renders the same way.
 */

interface Palette {
  from: string;
  to: string;
}

const PALETTES: Palette[] = [
  { from: "#ff7a3d", to: "#e6541f" }, // terracotta
  { from: "#2fa66b", to: "#1c7a4d" }, // savanna green
  { from: "#3f8fd6", to: "#245f9c" }, // sky blue
  { from: "#e5b23d", to: "#b8841f" }, // earth gold
  { from: "#c8553d", to: "#8f3624" }, // red earth
  { from: "#5b7fbd", to: "#37548c" }, // dusk blue
];

const ICON_PATHS: Record<LandmarkType, string> = {
  // Archway: a gate you pass through.
  gate: "M5 21V11a7 7 0 0 1 14 0v10M5 21h14M9 21v-7M15 21v-7",
  // Cross in a rounded square: universally reads as medical.
  hospital: "M5 5h14v14H5z M12 8v8M8 12h8",
  junction: "M12 3v6m0 0l-6 6m6-6l6 6m-6 6v-6",
  // Waiting shelter: a roof over a bench, distinct from the gate archway.
  stage: "M4 10l8-6 8 6M5 10v10h14V10M9 20v-6h6v6",
  fuel_station: "M6 20V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14M6 20h8m2-11h1.5A1.5 1.5 0 0 1 19 10.5V17a2 2 0 1 1-4 0v-3",
  landmark: "M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z",
  market: "M4 8l1.5-4h13L20 8M4 8h16M4 8v11h16V8M9 12v4m6-4v4",
  roundabout: "M12 5a7 7 0 1 0 0.001 0M12 2v3m0-3l-2 2m2-2l2 2",
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getLandmarkVisual(name: string, type: LandmarkType) {
  const palette = PALETTES[hashString(name) % PALETTES.length];
  const icon = ICON_PATHS[type] ?? ICON_PATHS.landmark;
  return { ...palette, icon };
}
