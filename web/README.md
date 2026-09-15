# VisitKla Web (MVP v1)

The web build of VisitKla — same 20 hardcoded Zone 1 routes, same 3-screen
flow (Search → Route Preview → Active Navigation) as the Expo app in the
repo root, but running as a plain browser app: React + TypeScript + Vite,
MapLibre GL JS for the map, the browser Geolocation API for GPS, and the
Web Speech API for voice. $0 stack, no API keys.

This is easier to actually run and test than the React Native app in a
sandbox with no device/emulator — it's just a browser.

## Run it

```bash
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`). Allow
location access when prompted to see live GPS tracking on the Active
Navigation page.

## Build for production

```bash
npm run build   # outputs to dist/
npm run preview # serve the production build locally
```

`dist/` is static HTML/JS/CSS — deploy it free on Netlify, Vercel, GitHub
Pages, or Cloudflare Pages (drag-and-drop `dist/` or connect the repo).

## Data source of truth

`src/data/seed-data.json` here is a **copy** of the canonical file at the
repo root (`../src/data/seed-data.json`), used by the Expo app. If you add
or edit routes/landmarks, edit the root copy and run, from the repo root:

```bash
npm run sync:web
```

(`npm run web:dev` / `npm run web:build` from the repo root do this sync
automatically before starting/building the web app.)

## Supabase (optional)

The app works fully offline with the bundled seed data. To back it with a
real free-tier Supabase project instead:

1. Run `../supabase/schema.sql` then `../supabase/seed.sql` in the
   Supabase SQL editor (same schema/seed as the mobile app — one backend
   serves both).
2. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY`.

## Map provider

Uses [OpenFreeMap](https://openfreemap.org)'s free "liberty" vector style
by default (no key, no signup, no rate limit). If that host is ever
unreachable the map automatically falls back to raw OpenStreetMap raster
tiles — see `src/components/RouteMap.tsx`.

## Real bike marker images (optional)

The rider marker draws a flat SVG bike by default. To use real photoreal
renders instead, drop exactly these two files in:

- `public/assets/boda-top-premium.png` — top-down view, used as the
  rotating map marker (rider + bike nosing "up" the frame).
- `public/assets/boda-side-premium.png` — side-profile view, used as the
  idle-shake "garage" loading visual while a ride is building.

Both are optional: if either file is missing, the app falls back to the
drawn SVG / a plain spinner automatically (see `src/components/cinematic/riderMarker.ts`).

## What's different from the Expo app here

- Map: MapLibre GL JS directly (no native module / dev-client build
  needed — it's just a browser library), instead of
  `@maplibre/maplibre-react-native`.
- GPS: browser Geolocation API instead of `expo-location`.
- Voice: Web Speech API (`speechSynthesis`) instead of `expo-speech`.
- Routing between screens: `react-router-dom` instead of React Navigation.
- Everything else — types, the 20 routes / 16 landmarks, the haversine
  nearest-step math, the forward-only auto-advance logic — is the exact
  same code, copied as-is (see `src/hooks/useNearestStep.ts`,
  `src/lib/distance.ts`, `src/data/`).
