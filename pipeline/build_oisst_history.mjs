#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fetchOisstRegionalMean } from "../science/adapters/oisst.mjs";

const output = process.argv[2] ?? "data-work/oisst-history.json";
const points = [{ latitude: 55, longitude: -35 }];
const results = await Promise.all(points.map((point) => fetchOisstRegionalMean({
  start: "2026-01-01T12:00:00Z", end: "2026-07-05T12:00:00Z",
  south: point.latitude, north: point.latitude, west: point.longitude, east: point.longitude, stride: 1,
})));
const byMonth = new Map();
for (const result of results) for (const observation of result.observations) {
  const bucket = byMonth.get(observation.date) ?? [];
  bucket.push(observation.value);
  byMonth.set(observation.date, bucket);
}
const regionalObservations = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => ({
  date, value: values.reduce((sum, value) => sum + value, 0) / values.length,
  source: "oisst", variable: "subpolar_sst_validation_sample", family: "thermalPattern", units: "degree_C", quality: "final", revision: "v2.1", provisional: false,
}));
const climatology = new Map();
for (const observation of regionalObservations) {
  const calendarMonth = observation.date.slice(5, 7);
  const bucket = climatology.get(calendarMonth) ?? [];
  bucket.push(observation.value);
  climatology.set(calendarMonth, bucket);
}
const baseline = Object.fromEntries([...climatology.entries()].map(([month, values]) => [month, values.reduce((sum, value) => sum + value, 0) / values.length]));
const observations = regionalObservations.map((item) => ({
  ...item, anomaly: item.value - baseline[item.date.slice(5, 7)],
  baseline: "2026 seven-month sample mean by calendar month; anomaly is zero until a longer baseline is processed",
}));
const payload = {
  schema_version: "1.0", generated_at: new Date().toISOString(), source_urls: results.map((result) => result.url),
  region: { points },
  caveat: "Single-point observed thermal snapshot for pipeline validation; not a regional mean or finalized AMOC fingerprint index.",
  observations,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(payload, null, 2) + "\n");
console.log(JSON.stringify({ output, months: observations.length, latest: observations.at(-1) }));
