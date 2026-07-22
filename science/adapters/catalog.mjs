export const SOURCE_CATALOG = [
  { id: "osnap", family: "overturning", tier: "direct", cadence: "release", latency: "months", adapter: "planned" },
  { id: "rapid", family: "overturning", tier: "direct", cadence: "release", latency: "months", adapter: "planned" },
  { id: "argo", family: "density", tier: "observed", cadence: "near-real-time", latency: "12–24 hours", adapter: "manifest-ready" },
  { id: "en4", family: "density", tier: "observed", cadence: "monthly", latency: "1–2 months", adapter: "manifest-ready", accessNote: "Non-commercial licence review required" },
  { id: "copernicus-phy", family: "convection", tier: "reanalysis", cadence: "monthly", latency: "product-specific", adapter: "planned" },
  { id: "era5", family: "freshwater", tier: "reanalysis", cadence: "monthly", latency: "~6 days", adapter: "request-ready", accessNote: "CDS_API_KEY required for ingestion worker" },
  { id: "nsidc-sic", family: "freshwater", tier: "observed", cadence: "daily", latency: "near-real-time", adapter: "planned" },
  { id: "grace-fo", family: "freshwater", tier: "observed", cadence: "monthly", latency: "variable", adapter: "planned" },
  { id: "oisst", family: "thermalPattern", tier: "observed", cadence: "daily", latency: "~1 day", adapter: "fetch-ready" },
];
