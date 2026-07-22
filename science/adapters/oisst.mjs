import { normalizeObservation } from "./contracts.mjs";

export const OISST_DATASET = "ncdc_oisst_v2_avhrr_by_time_zlev_lat_lon";
export const OISST_ERDDAP = "https://www.ncei.noaa.gov/erddap/griddap";
const snapQuarterGrid = (value) => Number((Math.round((value - 0.125) / 0.25) * 0.25 + 0.125).toFixed(3));

export function buildOisstSubsetUrl({ start, end, south = 45, north = 65, west = -60, east = -10, stride = 4 }) {
  const west360 = snapQuarterGrid(west < 0 ? west + 360 : west);
  const east360 = snapQuarterGrid(east < 0 ? east + 360 : east);
  const southGrid = snapQuarterGrid(south);
  const northGrid = snapQuarterGrid(north);
  if (east360 < west360) throw new Error("OISST regions crossing the prime meridian must be split into two requests");
  const slice = `[(${start}):1:(${end})][(0.0):1:(0.0)][(${southGrid}):${stride}:(${northGrid})][(${west360}):${stride}:(${east360})]`;
  return `${OISST_ERDDAP}/${OISST_DATASET}.csv?${encodeURIComponent(`sst${slice}`)}`;
}

export function parseErddapGridCsv(csv) {
  const rows = csv.trim().split(/\r?\n/);
  if (rows.length < 3) return [];
  const header = rows[0].split(",").map((value) => value.trim());
  return rows.slice(2).map((line) => {
    const values = line.split(",");
    return Object.fromEntries(header.map((key, index) => [key, values[index]]));
  }).filter((row) => Number.isFinite(Number(row.sst)));
}

export function monthlyRegionalMean(rows, retrievedAt = new Date().toISOString()) {
  const months = new Map();
  for (const row of rows) {
    const month = String(row.time).slice(0, 7);
    const bucket = months.get(month) ?? [];
    bucket.push(Number(row.sst));
    months.set(month, bucket);
  }
  return [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => normalizeObservation({
    source: "oisst", variable: "subpolar_sst", family: "thermalPattern", date,
    value: values.reduce((sum, value) => sum + value, 0) / values.length,
    sampleCount: values.length,
    units: "degree_C", quality: "final", revision: "v2.1", provisional: false, retrievedAt,
  }));
}

export async function fetchOisstRegionalMean(options, transport = fetch) {
  const url = buildOisstSubsetUrl(options);
  const response = await transport(url, { headers: { Accept: "text/csv" } });
  if (!response.ok) throw new Error(`OISST request failed: ${response.status}`);
  return { url, observations: monthlyRegionalMean(parseErddapGridCsv(await response.text())) };
}
