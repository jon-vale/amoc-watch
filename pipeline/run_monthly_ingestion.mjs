#!/usr/bin/env node
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

function previousMonth() {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastDay(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()).padStart(2, "0")}`;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

const month = process.env.AMOC_TARGET_MONTH || previousMonth();
if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("AMOC_TARGET_MONTH must be YYYY-MM");
const work = join("data-work", "monthly", month);
const argoWork = join(work, "argo");
const oisstPath = join(work, "oisst.json");
const argoPath = join(work, "argo-monthly.json");
const bundlePath = join(work, "feature-bundle.json");
await mkdir(work, { recursive: true });

await run("node", ["pipeline/ingest_oisst_month.mjs", "--month", month, "--output", oisstPath]);
await run("python3", ["pipeline/sample_argo.py", "--since", `${month}-01`, "--until", lastDay(month), "--limit", process.env.ARGO_PROFILE_LIMIT ?? "300", "--output", argoWork]);
const rawDirectory = join(argoWork, "raw");
const profiles = (await readdir(rawDirectory)).filter((name) => name.endsWith(".nc")).map((name) => join(rawDirectory, name));
if (!profiles.length) throw new Error(`No Argo profiles downloaded for ${month}`);
await run("python3", ["pipeline/reduce_profiles.py", ...profiles, "--output", argoPath]);
await run("node", ["pipeline/publish_feature_bundle.mjs", "--month", month, "--argo", argoPath, "--argo-manifest", join(argoWork, "manifest.json"), "--oisst", oisstPath, "--output", bundlePath]);
console.log(JSON.stringify({ completed: true, month, bundle: bundlePath }));
