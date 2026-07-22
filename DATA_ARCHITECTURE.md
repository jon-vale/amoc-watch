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

The first hosted implementation uses Supabase Postgres for compact immutable
assessment snapshots and Vercel for the Next.js API/web runtime. The API reads
with a server-only anonymous key protected by row-level security. Scheduled or
operator-run publishing uses the Supabase service role outside the web client.
Raw NetCDF, GRIB, HDF5, Parquet, and Zarr products remain outside Postgres.

The lineage schema now records ingestion runs, immutable source revisions,
normalized monthly observations, model-ready features, observation-to-feature
links, and assessment-to-feature links. A sanitized public view exposes only
successful run dates and source/feature counts; errors and upstream metadata
remain pipeline-only. The first live quarantined run contains two real sources
and four features but contributes nothing to the research classification.

## Model contract

Model v0.2 emits `regime`, `evidence`, `dataCoherence`, `dataSufficiency`, and family-level contributions. `dataCoherence` describes coverage and cross-family agreement; it is not model confidence. The research transition diagnostic remains internal and `transitionRisk` stays null until the calibration gate passes.

The current coefficients are placeholders for engineering validation. Before scientific release they must be calibrated through blocked hindcasts, sensitivity analysis across baselines, reanalysis leave-one-out tests, and evaluation against CMIP control and forced experiments. The public interface withholds the five-year probability while that gate is closed.

## Calibration gate

The implementation now supports time-blocked logistic calibration, Brier scoring, reliability bins, and leave-one-family-out influence tests. Training folds always precede validation folds to prevent future leakage. The API publishes validation status separately from the current assessment.

Synthetic labels exercise the machinery but can never make a model production-eligible. Operational transition-risk claims remain blocked until documented CMIP experiments and observational hindcasts replace the fixtures, OSNAP/RAPID validation is complete, and TEOS-10 profile processing is enabled.

## Operational safeguards

- Never count two reanalyses as independent observations when they assimilate overlapping inputs.
- Require minimum coverage before publishing a family contribution.
- Keep preliminary and final data versions side by side.
- Record every model version, configuration hash, source revision, and run timestamp.
- Fall back to the last complete assessment when a source is late; expose staleness rather than imputing silently.
- Publish no “possible regime change” state unless multiple physical families agree and the anomaly persists.
- Standardize monthly signals against calendar-month baselines and require contiguous recent coverage.
