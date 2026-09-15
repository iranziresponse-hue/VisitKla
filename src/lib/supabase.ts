import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import type { Route, Landmark } from "../types";
import { ROUTES } from "../data/routes";
import { LANDMARKS } from "../data/landmarks";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const isConfigured =
  !!extra.supabaseUrl &&
  !!extra.supabaseAnonKey &&
  !extra.supabaseUrl.includes("YOUR-PROJECT") &&
  !extra.supabaseAnonKey.includes("YOUR-ANON-KEY");

export const supabase = isConfigured
  ? createClient(extra.supabaseUrl as string, extra.supabaseAnonKey as string)
  : null;

/**
 * VisitKla is offline-first: the 20 Zone 1 routes and 16 landmarks ship
 * bundled in the app (src/data/seed-data.json) so search, previews and
 * navigation all work with zero network calls. If a Supabase project is
 * configured (see app.json "extra"), we opportunistically refresh from
 * there and fall back to the bundled copy on any failure.
 */
export async function fetchRoutes(): Promise<Route[]> {
  if (!supabase) return ROUTES;
  try {
    const { data, error } = await supabase.from("routes").select("*");
    if (error || !data || data.length === 0) return ROUTES;
    return data.map((row: any) => ({
      id: row.id,
      start: row.start_name,
      end: row.end_name,
      steps: row.steps_json,
      boda_price_min: row.boda_price_min,
      boda_price_max: row.boda_price_max,
      panya_tip: row.panya_tip,
    }));
  } catch {
    return ROUTES;
  }
}

export async function fetchLandmarks(): Promise<Landmark[]> {
  if (!supabase) return LANDMARKS;
  try {
    const { data, error } = await supabase.from("landmarks").select("*");
    if (error || !data || data.length === 0) return LANDMARKS;
    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      alias: row.alias ?? [],
      lat: row.lat,
      lng: row.lng,
      photo_url: row.photo_url,
      type: row.type,
    }));
  } catch {
    return LANDMARKS;
  }
}
