export type LandmarkType =
  | "gate"
  | "hospital"
  | "junction"
  | "stage"
  | "fuel_station"
  | "landmark"
  | "market"
  | "roundabout";

export interface Landmark {
  id: string;
  name: string;
  alias: string[];
  lat: number;
  lng: number;
  photo_url: string;
  type: LandmarkType;
}

export interface RouteStep {
  order: number;
  text: string;
  landmark: string;
  lat: number;
  lng: number;
  photo_url: string;
}

export interface Route {
  id: string;
  start: string;
  end: string;
  steps: RouteStep[];
  boda_price_min: number;
  boda_price_max: number;
  panya_tip: string;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export type NavMode = "landmark" | "boda";
