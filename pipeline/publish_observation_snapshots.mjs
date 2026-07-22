#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";

const argo = JSON.parse(await readFile("data-work/argo-sample/monthly.json", "utf8"));
const oisst = JSON.parse(await readFile("data-work/oisst-history.json", "utf8"));
await mkdir("science/observations", { recursive: true });
await writeFile("science/observations/argo-validation.json", JSON.stringify({
  schema_version: argo.schema_version, source: "Argo GDAC weekly profile index",
  dataset_mode: "bounded-real-observation-sample", accepted_profiles: argo.accepted_profiles,
  rejected_profile_count: argo.rejected_profiles.length,
  caveat: "Small provisional sample for pipeline validation; excluded from headline regime assessment.",
  months: argo.months,
}, null, 2) + "\n");
await writeFile("science/observations/oisst-validation.json", JSON.stringify({
  ...oisst, dataset_mode: "bounded-real-observation-sample",
}, null, 2) + "\n");
console.log(JSON.stringify({ argoMonths: argo.months.length, oisstMonths: oisst.observations.length }));
