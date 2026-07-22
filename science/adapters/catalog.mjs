export const SOURCE_CATALOG = [
  { id: "osnap", family: "overturning", tier: "direct", cadence: "release", latency: "months", adapter: "planned" },
  { id: "rapid", family: "overturning", tier: "direct", cadence: "release", latency: "months", adapter: "planned" },
  { id: "argo", family: "density", tier: "observed", cadence: "near-real-time", latency: "days", adapter: "planned" },
  { id: "en4", family: "density", tier: "observed", cadence: "monthly", latency: "1–2 months", adapter: "planned" },
  { id: "copernicus-phy", family: "convection", tier: "reanalysis", cadence: "monthly", latency: "product-specific", adapter: "planned" },
  { id: "era5", family: "freshwater", tier: "reanalysis", cadence: "monthly", latency: "~6 days", adapter: "planned" },
  { id: "nsidc-sic", family: "freshwater", tier: "observed", cadence: "daily", latency: "near-real-time", adapter: "planned" },
  { id: "grace-fo", family: "freshwater", tier: "observed", cadence: "monthly", latency: "variable", adapter: "planned" },
  { id: "oisst", family: "thermalPattern", tier: "observed", cadence: "daily", latency: "~1 day", adapter: "planned" },
];
