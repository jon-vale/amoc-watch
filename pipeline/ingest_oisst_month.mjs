#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fetchOisstRegionalMean } from "../science/adapters/oisst.mjs";

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function monthBounds(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("--month must be YYYY-MM");
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    start: `${month}-01T12:00:00Z`,
    end: `${month}-${String(lastDay).padStart(2, "0")}T12:00:00Z`,
    observedStart: `${month}-01`,
    observedEnd: `${month}-${String(lastDay).padStart(2, "0")}`,
    days: lastDay,
  };
}

const month = argument("--month");
const output = argument("--output");
if (!month || !output) throw new Error("Usage: ingest_oisst_month.mjs --month YYYY-MM --output FILE");

const bounds = monthBounds(month);
const region = { south: 45, north: 65, west: -60, east: -10, stride: 4 };
const retrievedAt = new Date().toISOString();
const result = await fetchOisstRegionalMean({ start: bounds.start, end: bounds.end, ...region });
const observations = result.observations.filter((item) => item.date === month);
if (observations.length !== 1) throw new Error(`Expected one OISST monthly observation for ${month}`);

const expectedCells = bounds.days
  * (Math.floor((region.north - region.south) / (region.stride * 0.25)) + 1)
  * (Math.floor((region.east - region.west) / (region.stride * 0.25)) + 1);
const returnedCells = observations[0].sampleCount ?? 0;
const payload = {
  schema_version: "1.0",
  source: "oisst",
  revision: "v2.1-preliminary",
  quality_state: "preliminary",
  retrieved_at: retrievedAt,
  observed_start: bounds.observedStart,
  observed_end: bounds.observedEnd,
  upstream_url: result.url,
  region,
  sampling: {
    returned_cells: returnedCells,
    rectangular_grid_cells: expectedCells,
    coverage_fraction: Math.min(1, returnedCells / expectedCells),
    caveat: "Coverage includes land cells in the requested rectangle and is an engineering ingestion gate, not an uncertainty estimate.",
  },
  observations,
};
payload.checksum = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({ output, month, value: observations[0].value, returnedCells }));
