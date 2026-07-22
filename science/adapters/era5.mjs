export const ERA5_DATASET = "reanalysis-era5-single-levels-monthly-means";
export const ERA5_VARIABLES = ["mean_surface_latent_heat_flux", "mean_surface_sensible_heat_flux", "total_precipitation", "evaporation", "10m_u_component_of_wind", "10m_v_component_of_wind"];

export function buildEra5Request(year, month) {
  return {
    product_type: ["monthly_averaged_reanalysis"], variable: ERA5_VARIABLES,
    year: [String(year)], month: [String(month).padStart(2, "0")], time: ["00:00"],
    area: [70, -70, 40, 10], data_format: "netcdf", download_format: "unarchived",
  };
}

export function era5RetrievalPlan(startYear, endYear) {
  return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index).flatMap((year) =>
    Array.from({ length: 12 }, (_, month) => ({ dataset: ERA5_DATASET, request: buildEra5Request(year, month + 1), requiresCredential: "CDS_API_KEY" })),
  );
}
