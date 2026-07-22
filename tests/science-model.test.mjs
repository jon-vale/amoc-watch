import assert from "node:assert/strict";
import test from "node:test";
import { assessRegime, classifyRegime, persistenceScore, standardizeSeries } from "../science/model.mjs";
import { prototypeInput } from "../science/fixtures.mjs";
import { normalizeObservation } from "../science/adapters/contracts.mjs";
import { buildOisstSubsetUrl, monthlyRegionalMean, parseErddapGridCsv } from "../science/adapters/oisst.mjs";
import { latestArgoManifest } from "../science/adapters/argo.mjs";
import { buildEra5Request } from "../science/adapters/era5.mjs";
import { brierScore, blockedSplits, evaluateCalibration, fitLogisticCalibration, leaveOneFamilyOut } from "../science/calibration.mjs";
import { syntheticHindcastExamples } from "../science/calibration-fixtures.mjs";
import { buildFeatureBundle, stableUuid } from "../pipeline/feature_bundle.mjs";

test("standardization uses the historical baseline", () => {
  const series = Array.from({ length: 24 }, (_, i) => ({ date: `2019-${String((i % 12) + 1).padStart(2, "0")}`, value: i }));
  const result = standardizeSeries(series, "2020-12");
  assert.ok(Math.abs(result.reduce((sum, point) => sum + point.z, 0)) < 1e-10);
});

test("standardization removes the calendar-month baseline", () => {
  const series = Array.from({ length: 24 }, (_, index) => {
    const year = 2019 + Math.floor(index / 12);
    const month = index % 12 + 1;
    return { date: `${year}-${String(month).padStart(2, "0")}`, value: month * 100 + (year - 2019) * 2 };
  });
  const result = standardizeSeries(series, { baselineStart: "2019-01", baselineEnd: "2020-12" });
  for (let month = 1; month <= 12; month += 1) {
    const members = result.filter((point) => Number(point.date.slice(5, 7)) === month);
    assert.ok(Math.abs(members.reduce((sum, point) => sum + point.z, 0)) < 1e-10);
  }
});

test("persistence coverage detects missing calendar months", () => {
  const result = persistenceScore([
    { date: "2026-01", z: 1 }, { date: "2026-02", z: 1 },
    { date: "2026-04", z: 1 }, { date: "2026-05", z: 1 }, { date: "2026-06", z: 1 },
  ], 1, 6);
  assert.equal(result.coverage, 5 / 6);
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
  assert.equal(result.transitionRisk, null);
  assert.ok(result.researchTransitionDiagnostic >= 0 && result.researchTransitionDiagnostic <= 1);
  assert.ok(result.dataCoherence >= 0 && result.dataCoherence <= 1);
  assert.equal(result.operationalEligible, false);
  assert.equal(result.families.length, 5);
  assert.equal(result.datasetMode, "illustrative-fixture");
});

test("regime publication is gated when too few physical families are available", () => {
  const result = assessRegime({
    ...prototypeInput,
    signals: { overturning: prototypeInput.signals.overturning },
  });
  assert.equal(result.regime, "Insufficient data");
  assert.equal(result.dataSufficiency.sufficient, false);
  assert.equal(result.dataSufficiency.availableFamilies, 1);
  assert.equal(result.transitionRisk, null);
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

test("feature bundles are deterministic, bounded, and assessment-quarantined", () => {
  const argo = { months: [{
    month: "2026-06", profile_count: 60, provisional_fraction: .5,
    thermodynamic_methods: ["TEOS-10/GSW"],
    surface_density: { mean: 1027.1, uncertainty: .02, count: 60 },
    stratification_0_200m: { mean: .18, uncertainty: .01, count: 58 },
    freshwater_0_1000m: { mean: 1.3, uncertainty: .1, count: 50 },
    mixed_layer_depth: { mean: 74, uncertainty: 4, count: 60 },
    coverage: { sampling_fraction: .82, deep_profile_fraction: .84, latitude_min: 45, latitude_max: 65, longitude_min: -60, longitude_max: -10 },
  }] };
  const argoManifest = { index: "https://data-argo.ifremer.fr/ar_index_global_prof.txt", profiles: [{ file: "dac/example.nc" }] };
  const oisst = {
    checksum: "a".repeat(64), revision: "v2.1-preliminary", quality_state: "preliminary",
    retrieved_at: "2026-07-08T00:00:00Z", observed_start: "2026-06-01", observed_end: "2026-06-30",
    upstream_url: "https://www.ncei.noaa.gov/erddap/griddap/example.csv", region: { south: 45, north: 65, west: -60, east: -10 },
    sampling: { coverage_fraction: .76 }, observations: [{ date: "2026-06", value: 8.7, units: "degree_C" }],
  };
  const options = { month: "2026-06", argo, argoManifest, oisst, knowledgeDate: "2026-07-08T00:00:00Z" };
  const first = buildFeatureBundle(options);
  const second = buildFeatureBundle(options);
  assert.equal(first.run.id, second.run.id);
  assert.equal(stableUuid("same"), stableUuid("same"));
  assert.equal(first.observations.length, 5);
  assert.equal(first.features.length, 5);
  assert.equal(first.featureObservations.length, 5);
  assert.equal(first.run.metadata.assessment_eligible, false);
  assert.ok(first.features.every((feature) => feature.coverage >= 0 && feature.coverage <= 1));
});
