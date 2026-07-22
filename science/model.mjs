import { MODEL_CONFIG } from "./config.mjs";

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const logistic = (value) => 1 / (1 + Math.exp(-value));
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const sd = (values) => {
  if (values.length < 2) return 1;
  const center = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1)) || 1;
};

const monthNumber = (date) => Number(date.slice(5, 7));
const monthIndex = (date) => Number(date.slice(0, 4)) * 12 + monthNumber(date) - 1;
const monthKey = (index) => `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`;

export function standardizeSeries(series, options = {}) {
  const legacyBaselineEnd = typeof options === "string" ? options : null;
  const baselineStart = legacyBaselineEnd ? null : (options.baselineStart ?? MODEL_CONFIG.baselineStart);
  const baselineEnd = legacyBaselineEnd ?? options.baselineEnd ?? MODEL_CONFIG.baselineEnd;
  const baselinePoints = series.filter((point) =>
    (!baselineStart || point.date >= baselineStart)
    && point.date <= baselineEnd
    && Number.isFinite(point.value),
  );
  const baseline = baselinePoints.map((point) => point.value);
  if (baseline.length < 12) throw new Error("A signal needs at least 12 valid baseline months");
  const fallback = { center: mean(baseline), spread: sd(baseline) };
  const seasonal = new Map();
  for (let calendarMonth = 1; calendarMonth <= 12; calendarMonth += 1) {
    const values = baselinePoints.filter((point) => monthNumber(point.date) === calendarMonth).map((point) => point.value);
    if (values.length >= 2) seasonal.set(calendarMonth, { center: mean(values), spread: sd(values) });
  }
  return series.map((point) => {
    if (!Number.isFinite(point.value)) return { ...point, z: null, baselineMethod: "calendar-month-zscore" };
    const stats = seasonal.get(monthNumber(point.date)) ?? fallback;
    return { ...point, z: (point.value - stats.center) / stats.spread, baselineMethod: "calendar-month-zscore" };
  });
}

export function persistenceScore(points, direction, months = MODEL_CONFIG.persistenceMonths) {
  const ordered = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const latestMonth = ordered.length ? monthIndex(ordered.at(-1).date) : null;
  if (latestMonth === null) return { score: 0, coverage: 0 };
  const byMonth = new Map(ordered.map((point) => [point.date, point]));
  const recent = Array.from({ length: months }, (_, offset) => byMonth.get(monthKey(latestMonth - months + 1 + offset)))
    .filter((point) => point?.z !== null && Number.isFinite(point?.z));
  if (!recent.length) return { score: 0, coverage: 0 };
  const adverse = recent.map((point) => clamp((point.z * direction - 0.5) / 2.5));
  const magnitude = mean(adverse);
  const agreement = adverse.filter((value) => value > 0).length / recent.length;
  return { score: clamp(magnitude * (0.55 + 0.45 * agreement)), coverage: recent.length / months };
}

export function classifyRegime(evidence) {
  if (evidence < 0.24) return "Within recent range";
  if (evidence < 0.45) return "Unusual";
  if (evidence < 0.68) return "Persistent anomaly";
  return "Possible regime change";
}

export function assessRegime(input, config = MODEL_CONFIG) {
  const familyResults = Object.entries(config.families).map(([family, spec]) => {
    const raw = input.signals[family];
    if (!raw) return { family, available: false, weight: spec.weight, score: 0, coverage: 0 };
    const series = standardizeSeries(raw, { baselineStart: config.baselineStart, baselineEnd: config.baselineEnd });
    const persistence = persistenceScore(series, spec.adverseDirection, config.persistenceMonths);
    const latest = [...series].reverse().find((point) => point.z !== null);
    return { family, available: true, weight: spec.weight, score: persistence.score, coverage: persistence.coverage, latestZ: latest?.z ?? null };
  });

  const availableFamilies = familyResults.filter((item) => item.available);
  const availableWeight = availableFamilies.reduce((sum, item) => sum + item.weight, 0);
  const weightedEvidence = availableWeight ? familyResults.reduce((sum, item) => sum + item.score * item.weight, 0) / availableWeight : 0;
  const coverage = familyResults.reduce((sum, item) => sum + item.coverage * item.weight, 0);
  const familyAgreement = familyResults.filter((item) => item.available && item.score >= 0.35).length / Math.max(1, availableFamilies.length);
  const dataCoherence = clamp(coverage * (0.55 + 0.45 * familyAgreement));
  const dataSufficient = coverage >= config.minCoverage && availableFamilies.length >= config.minFamilies;

  // This diagnostic is retained for model development only. It is not exposed as
  // transition probability until the coefficients pass the calibration gate.
  const researchTransitionDiagnostic = clamp(logistic(-3.1 + 4.2 * weightedEvidence + 0.8 * familyAgreement) * dataCoherence);
  const transitionRisk = config.transitionModelStatus === "calibrated" && dataSufficient
    ? researchTransitionDiagnostic
    : null;
  const operationalEligible = dataSufficient
    && config.transitionModelStatus === "calibrated"
    && input.datasetMode === "operational-observations";
  return {
    asOf: input.asOf,
    knowledgeDate: input.knowledgeDate,
    modelVersion: config.modelVersion,
    datasetMode: input.datasetMode,
    regime: dataSufficient ? classifyRegime(weightedEvidence) : "Insufficient data",
    evidence: Number(weightedEvidence.toFixed(3)),
    transitionRisk: transitionRisk === null ? null : Number(transitionRisk.toFixed(3)),
    researchTransitionDiagnostic: Number(researchTransitionDiagnostic.toFixed(3)),
    transitionHorizonMonths: config.transitionHorizonMonths,
    dataCoherence: Number(dataCoherence.toFixed(3)),
    operationalEligible,
    dataSufficiency: {
      sufficient: dataSufficient,
      coverage: Number(coverage.toFixed(3)),
      availableFamilies: availableFamilies.length,
      requiredFamilies: config.minFamilies,
    },
    families: familyResults.map((item) => ({ ...item, score: Number(item.score.toFixed(3)), latestZ: item.latestZ == null ? null : Number(item.latestZ.toFixed(2)) })),
    caveat: "Research prototype. Transition probability is withheld until observational and model hindcasts pass the calibration gate.",
  };
}
