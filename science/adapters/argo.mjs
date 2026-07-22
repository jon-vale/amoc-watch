export const ARGO_GDAC = "https://data-argo.ifremer.fr";
export const ARGO_PROFILE_INDEX = `${ARGO_GDAC}/ar_index_global_prof.txt`;

export function parseArgoIndex(text, bounds = { south: 45, north: 65, west: -60, east: -10 }) {
  return text.split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => {
    const [file, date, latitude, longitude, ocean, profilerType, institution, dateUpdate] = line.split(",");
    return { file, date, latitude: Number(latitude), longitude: Number(longitude), ocean, profilerType, institution, dateUpdate };
  }).filter((row) => row.latitude >= bounds.south && row.latitude <= bounds.north && row.longitude >= bounds.west && row.longitude <= bounds.east);
}

export function latestArgoManifest(indexText, options = {}) {
  const rows = parseArgoIndex(indexText, options.bounds);
  const since = options.since?.replaceAll("-", "") ?? "00000000";
  return rows.filter((row) => row.date.slice(0, 8) >= since).map((row) => ({ url: `${ARGO_GDAC}/${row.file}`, observedAt: row.date, updatedAt: row.dateUpdate }));
}
