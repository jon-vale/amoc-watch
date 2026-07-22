export function syntheticHindcastExamples(count = 180) {
  return Array.from({ length: count }, (_, index) => {
    const cycle = Math.sin(index / 14) * 0.18;
    const trend = index / count * 0.55;
    const score = Math.max(0, Math.min(1, 0.08 + cycle + trend));
    const latent = score + Math.sin(index * 2.17) * 0.12;
    return { date: `${2000 + Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`, score, label: latent > 0.53 ? 1 : 0, source: "synthetic-calibration-fixture" };
  });
}
