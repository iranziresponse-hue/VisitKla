/**
 * Copies the canonical src/data/seed-data.json (used by the Expo app) into
 * web/src/data/seed-data.json (used by the web app) so both apps always
 * ship the same 20 Zone 1 routes / 16 landmarks.
 * Run: npm run sync:web
 */
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "src", "data", "seed-data.json");
const dest = path.join(__dirname, "..", "web", "src", "data", "seed-data.json");

fs.copyFileSync(src, dest);
console.log(`Synced ${src} -> ${dest}`);
