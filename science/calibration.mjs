const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const sigmoid = (value) => 1 / (1 + Math.exp(-value));

export function fitLogisticCalibration(examples, { iterations = 2500, learningRate = 0.08, l2 = 0.02 } = {}) {
  if (examples.length < 20) throw new Error("Calibration requires at least 20 labeled examples");
  let intercept = 0;
  let slope = 1;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let gradientIntercept = 0;
    let gradientSlope = 0;
    for (const example of examples) {
      const probability = sigmoid(intercept + slope * example.score);
      const error = probability - example.label;
      gradientIntercept += error;
      gradientSlope += error * example.score;
    }
    intercept -= learningRate * gradientIntercept / examples.length;
    slope -= learningRate * (gradientSlope / examples.length + l2 * slope);
  }
  return { intercept, slope };
}

export function calibratedProbability(score, coefficients) {
  return clamp(sigmoid(coefficients.intercept + coefficients.slope * score));
}

export function brierScore(predictions) {
  if (!predictions.length) throw new Error("Brier score requires predictions");
  return predictions.reduce((sum, item) => sum + (item.probability - item.label) ** 2, 0) / predictions.length;
}

export function reliabilityBins(predictions, bins = 5) {
  return Array.from({ length: bins }, (_, index) => {
    const lower = index / bins;
    const upper = (index + 1) / bins;
    const members = predictions.filter((item) => item.probability >= lower && (index === bins - 1 ? item.probability <= upper : item.probability < upper));
    return {
      lower, upper, count: members.length,
      predicted: members.length ? members.reduce((sum, item) => sum + item.probability, 0) / members.length : null,
      observed: members.length ? members.reduce((sum, item) => sum + item.label, 0) / members.length : null,
    };
  });
}

export function blockedSplits(examples, folds = 5) {
  const ordered = [...examples].sort((a, b) => a.date.localeCompare(b.date));
  const blockSize = Math.ceil(ordered.length / folds);
  return Array.from({ length: folds }, (_, index) => {
    const start = index * blockSize;
    const validation = ordered.slice(start, start + blockSize);
    const train = ordered.slice(0, start);
    return { train, validation };
  }).filter((split) => split.train.length >= 20 && split.validation.length);
}

export function leaveOneFamilyOut(familyScores, combine) {
  const families = Object.keys(familyScores);
  const full = combine(familyScores);
  return families.map((family) => {
    const reduced = Object.fromEntries(Object.entries(familyScores).filter(([key]) => key !== family));
    const estimate = combine(reduced);
    return { family, estimate, delta: estimate - full };
  });
}

export function evaluateCalibration(examples, options = {}) {
  const folds = blockedSplits(examples, options.folds ?? 5);
  const predictions = folds.flatMap(({ train, validation }) => {
    const coefficients = fitLogisticCalibration(train, options);
    return validation.map((example) => ({ ...example, probability: calibratedProbability(example.score, coefficients) }));
  });
  return {
    status: predictions.length >= 20 ? "research-calibrated" : "insufficient-hindcast-data",
    brier: predictions.length ? brierScore(predictions) : null,
    reliability: predictions.length ? reliabilityBins(predictions) : [],
    examples: examples.length, outOfSamplePredictions: predictions.length,
    productionEligible: false,
    blockers: ["Replace synthetic transition labels with documented CMIP and observed hindcasts", "Validate against OSNAP and RAPID releases", "Complete TEOS-10 profile processing"],
  };
}
