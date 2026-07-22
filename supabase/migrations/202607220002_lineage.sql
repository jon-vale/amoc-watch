create table if not exists public.amoc_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  environmental_month date not null,
  knowledge_date timestamptz not null,
  pipeline_version text not null,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.amoc_source_revisions (
  id uuid primary key,
  source_id text not null,
  revision text not null,
  checksum text not null,
  quality_state text not null
    check (quality_state in ('preliminary', 'final', 'revised')),
  observed_start date not null,
  observed_end date not null,
  retrieved_at timestamptz not null,
  upstream_url text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_id, revision, checksum)
);

create table if not exists public.amoc_observations (
  id uuid primary key,
  run_id uuid not null references public.amoc_ingestion_runs(id),
  source_revision_id uuid not null references public.amoc_source_revisions(id),
  source_id text not null,
  variable text not null,
  family text not null,
  environmental_month date not null,
  value double precision not null,
  units text not null,
  uncertainty double precision,
  coverage double precision check (coverage is null or (coverage >= 0 and coverage <= 1)),
  provisional boolean not null,
  spatial_key text not null,
  spatial_support jsonb not null,
  quality jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_revision_id, variable, environmental_month, spatial_key)
);

create table if not exists public.amoc_features (
  id uuid primary key,
  run_id uuid not null references public.amoc_ingestion_runs(id),
  feature_key text not null,
  family text not null,
  environmental_month date not null,
  value double precision not null,
  units text not null,
  uncertainty double precision,
  coverage double precision not null check (coverage >= 0 and coverage <= 1),
  baseline_start date,
  baseline_end date,
  method_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, feature_key, environmental_month)
);

create table if not exists public.amoc_feature_observations (
  feature_id uuid not null references public.amoc_features(id),
  observation_id uuid not null references public.amoc_observations(id),
  primary key (feature_id, observation_id)
);

create table if not exists public.amoc_assessment_inputs (
  assessment_id uuid not null references public.amoc_assessment_snapshots(id),
  feature_id uuid not null references public.amoc_features(id),
  contribution double precision,
  primary key (assessment_id, feature_id)
);

create index if not exists amoc_ingestion_runs_month_idx
  on public.amoc_ingestion_runs (environmental_month desc, knowledge_date desc);
create index if not exists amoc_source_revisions_source_idx
  on public.amoc_source_revisions (source_id, retrieved_at desc);
create index if not exists amoc_observations_family_month_idx
  on public.amoc_observations (family, environmental_month desc);
create index if not exists amoc_features_family_month_idx
  on public.amoc_features (family, environmental_month desc);

alter table public.amoc_ingestion_runs enable row level security;
alter table public.amoc_source_revisions enable row level security;
alter table public.amoc_observations enable row level security;
alter table public.amoc_features enable row level security;
alter table public.amoc_feature_observations enable row level security;
alter table public.amoc_assessment_inputs enable row level security;

revoke all on public.amoc_ingestion_runs from anon, authenticated;
revoke all on public.amoc_source_revisions from anon, authenticated;
revoke all on public.amoc_observations from anon, authenticated;
revoke all on public.amoc_features from anon, authenticated;
revoke all on public.amoc_feature_observations from anon, authenticated;
revoke all on public.amoc_assessment_inputs from anon, authenticated;

grant select, insert, update on public.amoc_ingestion_runs to service_role;
grant select, insert on public.amoc_source_revisions to service_role;
grant select, insert on public.amoc_observations to service_role;
grant select, insert on public.amoc_features to service_role;
grant select, insert on public.amoc_feature_observations to service_role;
grant select, insert on public.amoc_assessment_inputs to service_role;

comment on table public.amoc_ingestion_runs is
  'Auditable executions of the separately scheduled scientific data pipeline.';
comment on table public.amoc_source_revisions is
  'Immutable upstream source identities, checksums, quality states, and retrieval metadata.';
comment on table public.amoc_observations is
  'Normalized monthly observations derived from versioned source revisions.';
comment on table public.amoc_features is
  'Versioned model-ready features that remain quarantined from assessments until publication gates pass.';
