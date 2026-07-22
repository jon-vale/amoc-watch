create extension if not exists pgcrypto;

create table if not exists public.amoc_assessment_snapshots (
  id uuid primary key default gen_random_uuid(),
  environmental_month date not null,
  knowledge_date timestamptz not null,
  model_version text not null,
  config_hash text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'withdrawn')),
  provisional boolean not null default true,
  payload jsonb not null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (environmental_month, knowledge_date, model_version, config_hash)
);

create index if not exists amoc_assessment_latest_public_idx
  on public.amoc_assessment_snapshots (knowledge_date desc, published_at desc)
  where status = 'published';

alter table public.amoc_assessment_snapshots enable row level security;

revoke all on public.amoc_assessment_snapshots from anon, authenticated;
grant select on public.amoc_assessment_snapshots to anon, authenticated;
grant select, insert on public.amoc_assessment_snapshots to service_role;

drop policy if exists "Public assessments are readable" on public.amoc_assessment_snapshots;
create policy "Public assessments are readable"
  on public.amoc_assessment_snapshots
  for select
  to anon, authenticated
  using (status = 'published');

comment on table public.amoc_assessment_snapshots is
  'Immutable, versioned AMOC Watch model outputs. Writes use a server-only service role; public clients may read published rows.';
