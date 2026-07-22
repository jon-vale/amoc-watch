#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { buildFeatureBundle } from "./feature_bundle.mjs";

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const month = argument("--month");
const argoPath = argument("--argo");
const manifestPath = argument("--argo-manifest");
const oisstPath = argument("--oisst");
const outputPath = argument("--output");
const dryRun = process.argv.includes("--dry-run");
if (!month || !argoPath || !manifestPath || !oisstPath) {
  throw new Error("Usage: publish_feature_bundle.mjs --month YYYY-MM --argo FILE --argo-manifest FILE --oisst FILE [--output FILE] [--dry-run]");
}

const [argo, argoManifest, oisst] = await Promise.all([argoPath, manifestPath, oisstPath].map(async (path) => JSON.parse(await readFile(path, "utf8"))));
const bundle = buildFeatureBundle({ month, argo, argoManifest, oisst });
if (outputPath) await writeFile(outputPath, `${JSON.stringify(bundle, null, 2)}\n`);

if (dryRun) {
  console.log(JSON.stringify({ dryRun: true, run: bundle.run.run_key, observations: bundle.observations.length, features: bundle.features.length, output: outputPath }));
  process.exit(0);
}

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

async function rest(path, { method = "POST", body, prefer = "resolution=ignore-duplicates,return=minimal" } = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: prefer,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${method} ${path} failed (${response.status}): ${await response.text()}`);
}

try {
  await rest("amoc_ingestion_runs?on_conflict=id", { body: bundle.run, prefer: "resolution=merge-duplicates,return=minimal" });
  await rest("amoc_source_revisions?on_conflict=id", { body: bundle.sourceRevisions });
  await rest("amoc_observations?on_conflict=id", { body: bundle.observations });
  await rest("amoc_features?on_conflict=id", { body: bundle.features });
  await rest("amoc_feature_observations?on_conflict=feature_id,observation_id", { body: bundle.featureObservations });
  await rest(`amoc_ingestion_runs?id=eq.${bundle.run.id}`, {
    method: "PATCH",
    body: { status: "succeeded", completed_at: new Date().toISOString(), error_summary: null },
  });
  console.log(JSON.stringify({ published: true, run: bundle.run.run_key, observations: bundle.observations.length, features: bundle.features.length }));
} catch (error) {
  await rest(`amoc_ingestion_runs?id=eq.${bundle.run.id}`, {
    method: "PATCH",
    body: { status: "failed", completed_at: new Date().toISOString(), error_summary: String(error).slice(0, 1000) },
  }).catch(() => undefined);
  throw error;
}
