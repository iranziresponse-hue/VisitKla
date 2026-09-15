# VisitKla — Kampala Story Navigation (MVP v1)

Google Maps tells you "turn in 200m on University Road." Nobody in Kampala
navigates like that. VisitKla tells you *"Ham Towers will be on your
right, boda stage is there"* instead — landmark-by-landmark, like a boda
guy explaining the way — plus a fair boda price for the trip.

This MVP covers **Zone 1 only**: Makerere Main Gate, Wandegeya, Mulago,
and Town (Ham Towers, Wandegeya Total, Wandegeya Market). 20 hardcoded
routes, no routing engine, no video.

There are two apps in this repo, sharing the same 20 routes / 16
landmarks and the same Supabase backend:

- **This directory** — the Expo / React Native mobile app.
- **[web/](web/)** — a browser build (React + Vite + MapLibre GL JS).
  Easier to run and test without a device/emulator — see
  [web/README.md](web/README.md). Run `npm run web:dev` from here to sync
  data and start it.

## What's built

- **3 screens**: Search → Route Preview → Active Navigation
- **2 modes**: Landmark Mode (story steps) and Boda Mode (price card + panya
  shortcut line)
- **20 hardcoded routes / 16 landmarks** for Zone 1, in
  [src/data/seed-data.json](src/data/seed-data.json) — the single source of
  truth for both the bundled offline app data and the Supabase seed
- `<StoryStepCard />` component ([src/components/StoryStepCard.tsx](src/components/StoryStepCard.tsx))
- `useNearestStep(userLocation, steps)` hook ([src/hooks/useNearestStep.ts](src/hooks/useNearestStep.ts))
- Ug-English step text with Luganda voice fallback (`expo-speech`)
- WhatsApp "This is wrong?" report button
- Offline-first: all routes/landmarks ship bundled in the app; Supabase is
  optional and only used to refresh that data if you configure it

## Tech stack ($0)

| Piece | Choice |
|---|---|
| App | Expo + React Native + TypeScript |
| Map | MapLibre (`@maplibre/maplibre-react-native`) over raw OpenStreetMap raster tiles — no Google Maps, no API key |
| Backend | Supabase free tier (`routes`, `landmarks` tables) — optional, app works with zero backend |
| Photos | Placeholder images via picsum.photos for MVP; swap for Mapillary street-level photos or your own compressed (<100kb) landmark shots for production |
| GPS | `expo-location`, nearest-step matching only, no routing algorithm |
| Voice | `expo-speech`, English text + templated Luganda phrases |

## Project layout

```
src/
  data/seed-data.json     20 routes + 16 landmarks — the canonical dataset
  data/routes.ts          typed accessors: getRouteById, findRoute, hubs
  data/landmarks.ts       typed accessors: search, findByName
  types/index.ts           Route, RouteStep, Landmark types
  hooks/useNearestStep.ts  GPS -> nearest step index (no routing math)
  hooks/useUserLocation.ts expo-location wrapper (one-shot + watch mode)
  lib/distance.ts          haversine distance
  lib/voice.ts             expo-speech wrapper, EN/Luganda
  lib/supabase.ts          optional Supabase client + fetch-with-fallback
  components/StoryStepCard.tsx
  components/PriceCard.tsx
  components/LandmarkListItem.tsx
  components/RouteMap.tsx  MapLibre map, degrades to a text fallback if the
                           native module isn't built yet (see below)
  screens/SearchScreen.tsx
  screens/RoutePreviewScreen.tsx
  screens/NavigationScreen.tsx
  navigation/RootNavigator.tsx
supabase/
  schema.sql               run first in the Supabase SQL editor
  seed.sql                 generated — run second
scripts/
  generate-seed-sql.js     regenerates supabase/seed.sql from seed-data.json
```

## Run it — step by step (all free tier)

### 1. Install

```bash
npm install
```

### 2. (Optional) Set up Supabase

The app runs fully offline with the bundled `seed-data.json` — you can skip
this section entirely for a local demo. To back it with a real Supabase
project:

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the SQL editor, paste and run [supabase/schema.sql](supabase/schema.sql).
3. Paste and run [supabase/seed.sql](supabase/seed.sql).
4. In `app.json`, fill in `expo.extra.supabaseUrl` and
   `expo.extra.supabaseAnonKey` from your project's API settings.

If you ever edit `src/data/seed-data.json` (add more routes/landmarks),
regenerate the SQL seed so it stays in sync:

```bash
npm run seed:generate
```

### 3. Run the app

Because the map uses MapLibre (native code) and this needs GPS + speech,
you need a **custom dev client**, not plain Expo Go:

```bash
npx expo prebuild
npx expo run:android   # or: npx expo run:ios (needs a Mac)
```

This builds a free local debug APK/IPA and installs it on a connected
device or emulator. No EAS subscription needed — `expo run:android` builds
with your local Android SDK.

If you just want to iterate on the Search/Route Preview/Navigation logic
without the native map (e.g. `npx expo start` in Expo Go), everything
still works — `RouteMap` detects the missing native module and falls back
to a plain text rendering of the route ("Makerere Main Gate → University
Hospital → Ham Towers → Wandegeya Total") instead of crashing.

### 4. Type-check

```bash
npm run typecheck
```

## Design notes / MVP tradeoffs

- **Search → route matching**: tapping a destination landmark finds the
  nearest "hub" landmark to the user's current GPS as the assumed start
  (falls back to Makerere Main Gate if GPS is unavailable), then looks up
  the matching hardcoded route. Only the 9 landmarks that are ends of one
  of the 20 routes appear in the search list — the other 7 (junctions,
  roundabouts, police post, etc.) are waypoints inside routes only.
- **Auto-advance is forward-only**: `NavigationScreen` never lets GPS snap
  the active step backward — it only advances to a later step, so
  wandering near a passed landmark doesn't rewind the story.
- **Boda Mode** reuses the same route/steps as Landmark Mode, just draws
  the map line dashed green (panya shortcut framing) and surfaces the
  `PriceCard` with the fare range and panya tip up front.
- **Photos**: `picsum.photos` placeholders are wired in so the UI is fully
  functional today. Swap `photo_url` values in `seed-data.json` for real
  Mapillary imagery or Supabase Storage URLs before shipping — keep each
  image under 100kb for the low-data requirement.
- **Luganda voice**: rather than doubling every step's text with a
  translation, `lib/voice.ts` speaks a short templated Luganda phrase
  ("Tandika wano ku …", "Mutuuse ku …") built from the step's position and
  landmark name. Good enough for MVP; revisit if user testing wants full
  translated narration.

## What was intentionally NOT built

- No video / camera / movie mode.
- No paid Google Maps API — MapLibre + raw OSM raster tiles only.
- No general Kampala routing algorithm — exactly 20 hardcoded Zone 1
  routes in `seed-data.json`.

## Verified in this environment

- `seed-data.json` validated: 16 landmarks, 20 routes, zero dangling
  landmark references, zero duplicate route IDs.
- `supabase/seed.sql` generated from that same JSON (`npm run seed:generate`).
- TypeScript compiles (`npm run typecheck`).

This was built and type-checked in a Windows sandbox with no Android/iOS
SDK, emulator, or physical device attached — the native map/GPS/speech
paths are implemented per each library's documented API but have **not**
been visually run on-device. Do that pass (via `expo run:android` /
`expo run:ios` as above) before treating this as demo-ready.
