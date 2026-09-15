/**
 * Generates supabase/seed.sql from src/data/seed-data.json so the bundled
 * offline app data and the Supabase seed can never drift apart.
 * Run: npm run seed:generate
 */
const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "..", "src", "data", "seed-data.json");
const outPath = path.join(__dirname, "..", "supabase", "seed.sql");

const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

function sqlStr(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlTextArray(arr) {
  if (!arr || arr.length === 0) return "'{}'";
  const items = arr.map(
    (a) => `"${String(a).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
  );
  return `'{${items.join(",")}}'`;
}

function sqlJsonb(obj) {
  return `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`;
}

let out = "";
out += "-- Generated from src/data/seed-data.json by scripts/generate-seed-sql.js\n";
out += "-- Do not edit by hand — edit seed-data.json and re-run: npm run seed:generate\n\n";

out += "delete from routes;\n";
out += "delete from landmarks;\n\n";

out += `-- Landmarks (${data.landmarks.length}, Zone 1: Makerere / Wandegeya / Mulago / Town)\n`;
out += "insert into landmarks (name, alias, lat, lng, photo_url, type) values\n";
out +=
  data.landmarks
    .map(
      (l) =>
        `  (${sqlStr(l.name)}, ${sqlTextArray(l.alias)}, ${l.lat}, ${l.lng}, ${sqlStr(l.photo_url)}, ${sqlStr(l.type)})`
    )
    .join(",\n") + ";\n\n";

out += `-- Routes (${data.routes.length}, hardcoded for Zone 1 — 10 landmark pairs x 2 directions)\n`;
out +=
  "insert into routes (id, start_name, end_name, steps_json, boda_price_min, boda_price_max, panya_tip) values\n";
out +=
  data.routes
    .map(
      (r) =>
        `  (${sqlStr(r.id)}, ${sqlStr(r.start)}, ${sqlStr(r.end)}, ${sqlJsonb(r.steps)}, ${r.boda_price_min}, ${r.boda_price_max}, ${sqlStr(r.panya_tip)})`
    )
    .join(",\n") + ";\n";

fs.writeFileSync(outPath, out, "utf8");
console.log(
  `Wrote ${outPath} (${data.landmarks.length} landmarks, ${data.routes.length} routes)`
);
