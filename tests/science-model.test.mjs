import assert from "node:assert/strict";
import test from "node:test";
import { assessRegime, classifyRegime, standardizeSeries } from "../science/model.mjs";
import { prototypeInput } from "../science/fixtures.mjs";
import { normalizeObservation } from "../science/adapters/contracts.mjs";
import { buildOisstSubsetUrl, monthlyRegionalMean, parseErddapGridCsv } from "../science/adapters/oisst.mjs";
import { latestArgoManifest } from "../science/adapters/argo.mjs";
import { buildEra5Request } from "../science/adapters/era5.mjs";
import { brierScore, blockedSplits, evaluateCalibration, fitLogisticCalibration, leaveOneFamilyOut } from "../science/calibration.mjs";
import { syntheticHindcastExamples } from "../science/calibration-fixtures.mjs";

test("standardization uses the historical baseline", () => {
  const series = Array.from({ length: 24 }, (_, i) => ({ date: `2019-${String((i % 12) + 1).padStart(2, "0")}`, value: i }));
  const result = standardizeSeries(series, "2020-12");
  assert.ok(Math.abs(result.reduce((sum, point) => sum + point.z, 0)) < 1e-10);
});

test("blocked calibration never trains on future examples", () => {
  const splits = blockedSplits(syntheticHindcastExamples());
  for (const split of splits) assert.ok(split.train.at(-1).date < split.validation[0].date);
});

test("logistic calibration produces bounded, useful hindcast diagnostics", () => {
  const examples = syntheticHindcastExamples();
  const coefficients = fitLogisticCalibration(examples.slice(0, 120));
  assert.ok(coefficients.slope > 0);
  const report = evaluateCalibration(examples);
  assert.equal(report.productionEligible, false);
  assert.ok(report.brier >= 0 && report.brier <= 1);
  assert.ok(report.outOfSamplePredictions > 0);
});

test("Brier score rewards accurate probability forecasts", () => {
  assert.ok(brierScore([{ probability: .9, label: 1 }, { probability: .1, label: 0 }]) < brierScore([{ probability: .1, label: 1 }, { probability: .9, label: 0 }]));
});

test("leave-one-family-out reports influence without mutating inputs", () => {
  const inputs = { overturning: .8, density: .6, freshwater: .5 };
  const combine = (values) => Object.values(values).reduce((sum, value) => sum + value, 0) / Object.keys(values).length;
  const result = leaveOneFamilyOut(inputs, combine);
  assert.equal(result.length, 3);
  assert.equal(Object.keys(inputs).length, 3);
});

test("OISST adapter builds a bounded query and aggregates monthly rows", () => {
  const url = buildOisstSubsetUrl({ start: "2026-06-01T12:00:00Z", end: "2026-06-02T12:00:00Z" });
  assert.match(url, /ncdc_oisst_v2_avhrr_by_time_zlev_lat_lon\.csv/);
  assert.match(decodeURIComponent(url), /\[\(300\.125\):4:\(350\.125\)\]/);
  const rows = parseErddapGridCsv("time,zlev,latitude,longitude,sst\nUTC,m,degrees_north,degrees_east,degree_C\n2026-06-01T12:00:00Z,0,50,-40,10\n2026-06-02T12:00:00Z,0,50,-40,12");
  assert.equal(monthlyRegionalMean(rows)[0].value, 11);
});

test("Argo adapter filters the GDAC profile index in space and time", () => {
  const index = "# comment\naoml/1901/profiles/R1901_001.nc,20260601120000,55,-35,A,846,AO,20260602120000\naoml/1902/profiles/R1902_001.nc,20260601120000,20,-35,A,846,AO,20260602120000";
  const manifest = latestArgoManifest(index, { since: "2026-06-01" });
  assert.equal(manifest.length, 1);
  assert.match(manifest[0].url, /R1901_001\.nc$/);
});

test("ERA5 request is credential-explicit and region-bounded", () => {
  const request = buildEra5Request(2026, 6);
  assert.deepEqual(request.area, [70, -70, 40, 10]);
  assert.ok(request.variable.includes("total_precipitation"));
});

test("prototype assessment is bounded and fully attributed", () => {
  const result = assessRegime(prototypeInput);
  assert.ok(result.evidence >= 0 && result.evidence <= 1);
  assert.ok(result.transitionRisk >= 0 && result.transitionRisk <= 1);
  assert.equal(result.families.length, 5);
  assert.equal(result.datasetMode, "illustrative-fixture");
});

test("regime labels increase monotonically", () => {
  assert.deepEqual([0, .3, .5, .8].map(classifyRegime), ["Within recent range", "Unusual", "Persistent anomaly", "Possible regime change"]);
});

test("adapter contract retains provenance", () => {
  const record = normalizeObservation({ source: "argo", variable: "salinity", family: "density", date: "2026-06", value: 34.8, units: "psu", quality: "adjusted" });
  assert.equal(record.source, "argo");
  assert.equal(record.provisional, false);
  assert.ok(record.retrievedAt);
});
