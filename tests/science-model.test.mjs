import assert from "node:assert/strict";
import test from "node:test";
import { assessRegime, classifyRegime, standardizeSeries } from "../science/model.mjs";
import { prototypeInput } from "../science/fixtures.mjs";
import { normalizeObservation } from "../science/adapters/contracts.mjs";

test("standardization uses the historical baseline", () => {
  const series = Array.from({ length: 24 }, (_, i) => ({ date: `2019-${String((i % 12) + 1).padStart(2, "0")}`, value: i }));
  const result = standardizeSeries(series, "2020-12");
  assert.ok(Math.abs(result.reduce((sum, point) => sum + point.z, 0)) < 1e-10);
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
