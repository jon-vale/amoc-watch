export type PublicPipelineStatus = {
  runKey: string;
  environmentalMonth: string;
  knowledgeDate: string;
  pipelineVersion: string;
  status: string;
  completedAt: string | null;
  featureCount: number;
  sourceCount: number;
};

type PipelineStatusRow = {
  run_key: string;
  environmental_month: string;
  knowledge_date: string;
  pipeline_version: string;
  status: string;
  completed_at: string | null;
  feature_count: number;
  source_count: number;
};

export async function getPublicPipelineStatus(limit = 12): Promise<PublicPipelineStatus[]> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return [];

  const query = new URL(`${url}/rest/v1/amoc_public_pipeline_status`);
  query.searchParams.set("select", "run_key,environmental_month,knowledge_date,pipeline_version,status,completed_at,feature_count,source_count");
  query.searchParams.set("order", "environmental_month.desc,knowledge_date.desc");
  query.searchParams.set("limit", String(limit));
  const response = await fetch(query, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase pipeline-status query failed with ${response.status}`);
  const rows = (await response.json()) as PipelineStatusRow[];
  return rows.map((row) => ({
    runKey: row.run_key,
    environmentalMonth: row.environmental_month,
    knowledgeDate: row.knowledge_date,
    pipelineVersion: row.pipeline_version,
    status: row.status,
    completedAt: row.completed_at,
    featureCount: row.feature_count,
    sourceCount: row.source_count,
  }));
}
