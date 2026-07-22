# AMOC Watch data architecture

## Design goal

Produce a versioned monthly assessment without pretending all inputs are equally direct, independent, or current. Every public snapshot contains two dates: the environmental month represented and the knowledge date on which the assessment was computed.

## Pipeline

1. **Acquire** — source-specific adapters download immutable raw files and checksums.
2. **Normalize** — observations become records with source, variable, signal family, month, units, quality, revision, provisional state, retrieval time, and spatial support.
3. **Derive** — reproducible jobs calculate regional indices such as density, freshwater content, mixed-layer depth, overturning transport, and thermal fingerprints.
4. **Standardize** — each index is expressed against a declared baseline. Baselines never silently move.
5. **Assess** — the regime model combines magnitude, six-month persistence, coverage, and agreement across five physical families.
6. **Publish** — an immutable model snapshot is written for the API and the web app. Revised inputs create a new knowledge-state version; they do not rewrite history.

## Storage zones

| Zone | Contents | Format | Retention |
|---|---|---|---|
| Raw | Exact upstream artifacts and checksums | NetCDF, GRIB, HDF5 | Permanent |
| Normalized | Source-aware monthly records | Parquet | Permanent, partitioned by source/year |
| Features | Regional and depth-resolved indices | Parquet/Zarr | Versioned by code and baseline |
| Assessments | Compact model results and explanations | JSON | Immutable by knowledge date |
| Web | Latest plus historical public snapshots | JSON | Permanent |

Large scientific arrays belong in object storage, not the website database. A relational metadata store should hold runs, sources, revisions, lineage, and snapshot pointers.

## Model contract

The first model emits `regime`, `evidence`, `transitionRisk`, `confidence`, and family-level contributions. `transitionRisk` is a diagnostic probability of entering or persisting in a different statistical regime over the declared horizon. It is explicitly not a probability of AMOC collapse.

The current coefficients are placeholders for engineering validation. Before scientific release they must be calibrated through blocked hindcasts, sensitivity analysis across baselines, reanalysis leave-one-out tests, and evaluation against CMIP control and forced experiments.

## Operational safeguards

- Never count two reanalyses as independent observations when they assimilate overlapping inputs.
- Require minimum coverage before publishing a family contribution.
- Keep preliminary and final data versions side by side.
- Record every model version, configuration hash, source revision, and run timestamp.
- Fall back to the last complete assessment when a source is late; expose staleness rather than imputing silently.
- Publish no “possible regime change” state unless multiple physical families agree and the anomaly persists.
