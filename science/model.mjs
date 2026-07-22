import { MODEL_CONFIG } from "./config.mjs";

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const logistic = (value) => 1 / (1 + Math.exp(-value));
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const sd = (values) => {
  if (values.length < 2) return 1;
  const center = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1)) || 1;
};

export function standardizeSeries(series, baselineEnd = MODEL_CONFIG.baselineEnd) {
  const baseline = series.filter((point) => point.date <= baselineEnd && Number.isFinite(point.value)).map((point) => point.value);
  if (baseline.length < 12) throw new Error("A signal needs at least 12 valid baseline months");
  const center = mean(baseline);
  const spread = sd(baseline);
  return series.map((point) => ({ ...point, z: Number.isFinite(point.value) ? (point.value - center) / spread : null }));
}

export function persistenceScore(points, direction, months = MODEL_CONFIG.persistenceMonths) {
  const recent = points.slice(-months).filter((point) => point.z !== null);
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
    const series = standardizeSeries(raw);
    const persistence = persistenceScore(series, spec.adverseDirection, config.persistenceMonths);
    const latest = [...series].reverse().find((point) => point.z !== null);
    return { family, available: true, weight: spec.weight, score: persistence.score, coverage: persistence.coverage, latestZ: latest?.z ?? null };
  });

  const availableWeight = familyResults.filter((item) => item.available).reduce((sum, item) => sum + item.weight, 0);
  const weightedEvidence = availableWeight ? familyResults.reduce((sum, item) => sum + item.score * item.weight, 0) / availableWeight : 0;
  const coverage = familyResults.reduce((sum, item) => sum + item.coverage * item.weight, 0);
  const familyAgreement = familyResults.filter((item) => item.available && item.score >= 0.35).length / Math.max(1, familyResults.filter((item) => item.available).length);
  const confidence = clamp(coverage * (0.55 + 0.45 * familyAgreement));

  // A calibrated placeholder link function. Replace coefficients only after hindcast calibration.
  const transitionRisk = clamp(logistic(-3.1 + 4.2 * weightedEvidence + 0.8 * familyAgreement) * confidence);
  return {
    asOf: input.asOf,
    knowledgeDate: input.knowledgeDate,
    modelVersion: config.modelVersion,
    datasetMode: input.datasetMode,
    regime: classifyRegime(weightedEvidence),
    evidence: Number(weightedEvidence.toFixed(3)),
    transitionRisk: Number(transitionRisk.toFixed(3)),
    transitionHorizonMonths: config.transitionHorizonMonths,
    confidence: Number(confidence.toFixed(3)),
    families: familyResults.map((item) => ({ ...item, score: Number(item.score.toFixed(3)), latestZ: item.latestZ === null ? null : Number(item.latestZ.toFixed(2)) })),
    caveat: "Research prototype. Transition risk is a model diagnostic, not a probability of AMOC collapse.",
  };
}
