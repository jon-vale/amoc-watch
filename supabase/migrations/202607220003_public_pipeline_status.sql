create or replace view public.amoc_public_pipeline_status
with (security_barrier = true)
as
select
  run_key,
  environmental_month,
  knowledge_date,
  pipeline_version,
  status,
  completed_at,
  (select count(*)::integer from public.amoc_features feature where feature.run_id = run.id) as feature_count,
  (select count(distinct observation.source_id)::integer from public.amoc_observations observation where observation.run_id = run.id) as source_count
from public.amoc_ingestion_runs run
where status = 'succeeded';

revoke all on public.amoc_public_pipeline_status from anon, authenticated;
grant select on public.amoc_public_pipeline_status to anon, authenticated;

comment on view public.amoc_public_pipeline_status is
  'Sanitized public evidence that real-source feature ingestion completed; excludes errors, raw metadata, and credentials.';
