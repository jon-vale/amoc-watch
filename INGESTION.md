# Ingestion adapters

The first adapter layer is now implemented without embedding credentials or downloading large scientific arrays inside the website runtime.

## Ready adapters

- **OISST:** creates bounded NOAA/NCEI ERDDAP queries, parses gridded CSV, and emits monthly regional thermal observations with provenance.
- **Argo:** parses the official GDAC global profile index and creates a spatially and temporally filtered download manifest. NetCDF profile reduction remains an offline worker task.
- **EN4:** creates versioned annual archive manifests and identifies the exact monthly analysis member. Production use requires confirmation that the site’s intended use complies with the Met Office licence.
- **ERA5:** creates credential-explicit CDS monthly retrieval requests for heat, precipitation, evaporation, and wind forcing over the North Atlantic.

## Runtime boundary

The public site never requests full NetCDF or GRIB products. Scheduled ingestion workers fetch and verify upstream artifacts, derive compact monthly indices, and publish immutable assessment snapshots. The web runtime reads only those snapshots.

OISST is the only adapter currently capable of completing a compact fetch without credentials. Argo, EN4, and ERA5 are manifest/request ready; their scientific reduction workers require NetCDF tooling and should run outside the edge-hosted site.

## Profile reduction worker

`pipeline/reduce_profiles.py` reads official Argo NetCDF profiles through the optional xarray I/O layer, selects adjusted variables when present, applies Argo quality flags, and emits monthly JSON indices. The pure calculation core is dependency-light and tested independently of NetCDF parsing.

Current outputs include surface density, 0–200 m density stratification, 0–1,000 m freshwater content relative to 35 PSU, mixed-layer depth using a 0.03 kg/m³ density threshold, sampling coverage, provisional-data fraction, and standard errors across profiles.

The engineering fallback uses EOS-80 density at atmospheric pressure. Scientific production must enable TEOS-10/GSW and retain pressure, latitude, and longitude in the conversion to Absolute Salinity and Conservative Temperature before calibration.

## Observational beta snapshot

The first bounded real-data run was completed on 22 July 2026. Nine accepted provisional Argo profiles spanning approximately 46–60°N and 57–39°W were processed with TEOS-10/GSW. Deep-profile coverage was 89%. The sample produced surface density, 0–200 m stratification, and mixed-layer-depth summaries; it was too sparse for a valid 0–1,000 m freshwater aggregate.

A separate NOAA OISST validation snapshot contains seven monthly means for January–July 2026 at 55°N, 35°W. It proves the fetch, parsing, provenance, and publication path but is neither an area-weighted regional index nor a historical anomaly record.

Both sanitized snapshots are returned by the assessment API as `observationalBeta`. They are visible in the interface and deliberately excluded from the headline regime assessment.
