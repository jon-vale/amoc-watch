#!/usr/bin/env node
import { createHash } from "node:crypto";
import { assessRegime } from "../science/model.mjs";
import { prototypeInput } from "../science/fixtures.mjs";
import { SOURCE_CATALOG } from "../science/adapters/catalog.mjs";
import { evaluateCalibration } from "../science/calibration.mjs";
import { syntheticHindcastExamples } from "../science/calibration-fixtures.mjs";
import argo from "../science/observations/argo-validation.json" with { type: "json" };
import oisst from "../science/observations/oisst-validation.json" with { type: "json" };

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.log(JSON.stringify({
    published: false,
    skipped: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured",
  }));
  process.exit(0);
}

const payload = {
  assessment: assessRegime(prototypeInput),
  validation: evaluateCalibration(syntheticHindcastExamples()),
  observationalBeta: { argo, oisst },
  sources: SOURCE_CATALOG,
};
const environmentalMonth = `${payload.assessment.asOf}-01`;
const knowledgeDate = new Date(`${payload.assessment.knowledgeDate}T00:00:00.000Z`).toISOString();
const configHash = createHash("sha256")
  .update(JSON.stringify(prototypeInput))
  .digest("hex");

const endpoint = new URL(`${url}/rest/v1/amoc_assessment_snapshots`);
endpoint.searchParams.set(
  "on_conflict",
  "environmental_month,knowledge_date,model_version,config_hash",
);

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation,resolution=ignore-duplicates",
  },
  body: JSON.stringify({
    environmental_month: environmentalMonth,
    knowledge_date: knowledgeDate,
    model_version: payload.assessment.modelVersion,
    config_hash: configHash,
    status: "published",
    provisional: true,
    payload,
  }),
});

if (!response.ok) {
  throw new Error(`Supabase publish failed (${response.status}): ${await response.text()}`);
}

const rows = await response.json();
console.log(JSON.stringify({ published: rows.length === 1, snapshot: rows[0]?.id ?? null }));
