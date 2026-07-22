export const MODEL_CONFIG = Object.freeze({
  modelVersion: "0.2.0",
  baselineStart: "2004-01",
  baselineEnd: "2020-12",
  minCoverage: 0.6,
  minFamilies: 3,
  persistenceMonths: 6,
  transitionHorizonMonths: 60,
  transitionModelStatus: "placeholder",
  families: {
    overturning: { weight: 0.28, adverseDirection: -1 },
    density: { weight: 0.22, adverseDirection: -1 },
    convection: { weight: 0.18, adverseDirection: -1 },
    freshwater: { weight: 0.17, adverseDirection: 1 },
    thermalPattern: { weight: 0.15, adverseDirection: 1 },
  },
});
