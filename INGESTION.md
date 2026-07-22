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
