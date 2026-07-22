function monthlySeries(family, slope, seasonal = 0.16) {
  const points = [];
  for (let year = 2004; year <= 2026; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      if (year === 2026 && month > 6) break;
      const t = (year - 2004) * 12 + month - 1;
      const recent = Math.max(0, t - 204);
      const noise = Math.sin(t * 1.71 + family.length) * 0.11 + Math.cos(t * 0.37) * 0.07;
      points.push({ date: `${year}-${String(month).padStart(2, "0")}`, value: seasonal * Math.sin((month / 12) * Math.PI * 2) + noise + slope * recent });
    }
  }
  return points;
}

export const prototypeInput = {
  asOf: "2026-06",
  knowledgeDate: "2026-07-15",
  datasetMode: "illustrative-fixture",
  signals: {
    overturning: monthlySeries("overturning", -0.006),
    density: monthlySeries("density", -0.009),
    convection: monthlySeries("convection", -0.005),
    freshwater: monthlySeries("freshwater", 0.008),
    thermalPattern: monthlySeries("thermal", 0.007),
  },
};
