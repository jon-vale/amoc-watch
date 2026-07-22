import { createHash } from "node:crypto";

const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const hash = (value) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");

function monthEnd(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()).padStart(2, "0")}`;
}

export function stableUuid(value) {
  const hex = hash(value).slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const joined = hex.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}

function observationRow({ runId, revisionId, sourceId, variable, family, month, summary, units, coverage, provisional, spatialKey, spatialSupport, quality }) {
  if (!Number.isFinite(summary?.mean ?? summary)) return null;
  const value = summary?.mean ?? summary;
  const uncertainty = summary?.uncertainty ?? null;
  return {
    id: stableUuid([revisionId, variable, month, spatialKey].join(":")),
    run_id: runId,
    source_revision_id: revisionId,
    source_id: sourceId,
    variable,
    family,
    environmental_month: `${month}-01`,
    value,
    units,
    uncertainty,
    coverage: coverage == null ? null : clamp(coverage),
    provisional,
    spatial_key: spatialKey,
    spatial_support: spatialSupport,
    quality,
  };
}

function featureForObservation(runId, observation, methodVersion) {
  return {
    id: stableUuid([runId, observation.variable, observation.environmental_month].join(":")),
    run_id: runId,
    feature_key: observation.variable,
    family: observation.family,
    environmental_month: observation.environmental_month,
    value: observation.value,
    units: observation.units,
    uncertainty: observation.uncertainty,
    coverage: observation.coverage ?? 0,
    baseline_start: null,
    baseline_end: null,
    method_version: methodVersion,
    metadata: {
      source_id: observation.source_id,
      provisional: observation.provisional,
      status: "raw-monthly-feature; not standardized or assessment-eligible",
    },
  };
}

export function buildFeatureBundle({ month, argo, argoManifest, oisst, knowledgeDate = new Date().toISOString(), pipelineVersion = "0.1.0" }) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("month must be YYYY-MM");
  const runKey = `${month}:monthly:${pipelineVersion}`;
  const runId = stableUuid(runKey);
  const argoMonth = argo.months?.find((item) => item.month === month);
  if (!argoMonth) throw new Error(`Argo reduction has no ${month} aggregate`);
  const oisstObservation = oisst.observations?.find((item) => item.date === month);
  if (!oisstObservation) throw new Error(`OISST reduction has no ${month} aggregate`);

  const argoChecksum = hash({ argo, manifest: argoManifest });
  const oisstChecksum = oisst.checksum ?? hash(oisst);
  const oisstRevision = oisst.revision ?? oisstObservation.revision ?? "unknown";
  const oisstQualityState = oisst.quality_state ?? (oisstObservation.provisional ? "preliminary" : "final");
  const argoRevisionId = stableUuid(`argo:${month}:${argoChecksum}`);
  const oisstRevisionId = stableUuid(`oisst:${month}:${oisstChecksum}`);
  const retrievedAt = knowledgeDate;
  const monthStart = `${month}-01`;
  const observedEnd = oisst.observed_end ?? monthEnd(month);
  const spatialSupport = {
    bounds: argoMonth.coverage,
    profile_count: argoMonth.profile_count,
  };
  const samplingCoverage = clamp(argoMonth.coverage?.sampling_fraction ?? 0);
  const deepCoverage = samplingCoverage * clamp(argoMonth.coverage?.deep_profile_fraction ?? 0);
  const provisional = (argoMonth.provisional_fraction ?? 1) > 0;

  const observations = [
    observationRow({ runId, revisionId: argoRevisionId, sourceId: "argo", variable: "argo_surface_density", family: "density", month, summary: argoMonth.surface_density, units: "kg m-3", coverage: samplingCoverage, provisional, spatialKey: "subpolar-north-atlantic", spatialSupport, quality: { thermodynamic_methods: argoMonth.thermodynamic_methods } }),
    observationRow({ runId, revisionId: argoRevisionId, sourceId: "argo", variable: "argo_density_stratification_0_200m", family: "density", month, summary: argoMonth.stratification_0_200m, units: "kg m-3", coverage: samplingCoverage, provisional, spatialKey: "subpolar-north-atlantic", spatialSupport, quality: { thermodynamic_methods: argoMonth.thermodynamic_methods } }),
    observationRow({ runId, revisionId: argoRevisionId, sourceId: "argo", variable: "argo_mixed_layer_depth", family: "convection", month, summary: argoMonth.mixed_layer_depth, units: "dbar", coverage: samplingCoverage, provisional, spatialKey: "subpolar-north-atlantic", spatialSupport, quality: { thermodynamic_methods: argoMonth.thermodynamic_methods } }),
    observationRow({ runId, revisionId: argoRevisionId, sourceId: "argo", variable: "argo_freshwater_0_1000m", family: "freshwater", month, summary: argoMonth.freshwater_0_1000m, units: "m freshwater equivalent", coverage: deepCoverage, provisional, spatialKey: "subpolar-north-atlantic", spatialSupport, quality: { thermodynamic_methods: argoMonth.thermodynamic_methods } }),
    observationRow({ runId, revisionId: oisstRevisionId, sourceId: "oisst", variable: "oisst_subpolar_sst", family: "thermalPattern", month, summary: oisstObservation.value, units: oisstObservation.units ?? "degree_C", coverage: oisst.sampling?.coverage_fraction ?? 0, provisional: oisstQualityState !== "final", spatialKey: "subpolar-north-atlantic-1deg", spatialSupport: { region: oisst.region, sampling: oisst.sampling }, quality: { revision: oisstRevision, quality_state: oisstQualityState } }),
  ].filter(Boolean);
  const features = observations.map((observation) => featureForObservation(runId, observation, observation.source_id === "argo" ? "argo-monthly-v1" : "oisst-regional-mean-v1"));
  const featureObservations = features.map((feature, index) => ({ feature_id: feature.id, observation_id: observations[index].id }));

  return {
    run: {
      id: runId,
      run_key: runKey,
      environmental_month: monthStart,
      knowledge_date: knowledgeDate,
      pipeline_version: pipelineVersion,
      status: "running",
      metadata: { source_count: 2, assessment_eligible: false },
    },
    sourceRevisions: [
      { id: argoRevisionId, source_id: "argo", revision: `gdac-real-time-${month}`, checksum: argoChecksum, quality_state: "preliminary", observed_start: monthStart, observed_end: observedEnd, retrieved_at: retrievedAt, upstream_url: argoManifest.index, metadata: { profile_count: argoMonth.profile_count, manifest: argoManifest } },
      { id: oisstRevisionId, source_id: "oisst", revision: oisstRevision, checksum: oisstChecksum, quality_state: oisstQualityState, observed_start: oisst.observed_start ?? monthStart, observed_end: oisst.observed_end ?? monthEnd(month), retrieved_at: oisst.retrieved_at ?? oisst.generated_at ?? knowledgeDate, upstream_url: oisst.upstream_url ?? oisst.source_urls?.[0] ?? "https://www.ncei.noaa.gov/products/optimum-interpolation-sst", metadata: { region: oisst.region, sampling: oisst.sampling } },
    ],
    observations,
    features,
    featureObservations,
  };
}
