export const EN4_VERSION = "EN.4.2.2";
export const EN4_ROOT = "https://www.metoffice.gov.uk/hadobs/en4/data/en4-2-2";

export function en4AnalysisUrl(year, month, correction = "g10") {
  const ym = `${year}${String(month).padStart(2, "0")}`;
  return `${EN4_ROOT}/${EN4_VERSION}.analyses.${correction}.${year}.zip#${EN4_VERSION}.f.analysis.${correction}.${ym}.nc`;
}

export function en4Manifest(startYear, endYear, correction = "g10") {
  return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index).map((year) => ({
    source: "en4", year, correction, archive: `${EN4_ROOT}/${EN4_VERSION}.analyses.${correction}.${year}.zip`,
    license: "non-commercial-government-licence-review-required",
  }));
}
