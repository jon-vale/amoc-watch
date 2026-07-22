type StoredAssessment<T> = {
  id: string;
  payload: T;
  environmentalDate: string;
  knowledgeDate: string;
  modelVersion: string;
  publishedAt: string;
};

type AssessmentRow<T> = {
  id: string;
  payload: T;
  environmental_month: string;
  knowledge_date: string;
  model_version: string;
  published_at: string;
};

function readConfiguration() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;
  return { url: url.replace(/\/$/, ""), anonKey };
}

export async function getLatestPublicAssessment<T>(): Promise<StoredAssessment<T> | null> {
  const history = await getPublicAssessmentHistory<T>(1, true);
  return history[0] ?? null;
}

export async function getPublicAssessmentHistory<T>(limit = 120, latestFirst = false): Promise<StoredAssessment<T>[]> {
  const configuration = readConfiguration();
  if (!configuration) return [];

  const query = new URL(`${configuration.url}/rest/v1/amoc_assessment_snapshots`);
  query.searchParams.set(
    "select",
    "id,payload,environmental_month,knowledge_date,model_version,published_at",
  );
  query.searchParams.set("status", "eq.published");
  query.searchParams.set(
    "order",
    latestFirst
      ? "environmental_month.desc,knowledge_date.desc,published_at.desc"
      : "environmental_month.asc,knowledge_date.asc,published_at.asc",
  );
  query.searchParams.set("limit", String(limit));

  const response = await fetch(query, {
    headers: {
      apikey: configuration.anonKey,
      Authorization: `Bearer ${configuration.anonKey}`,
    },
    // A missing publication is a valid transient state during deployment.
    // Do not let Next's persistent Data Cache preserve that empty result.
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Supabase assessment query failed with ${response.status}`);
  }

  const rows = (await response.json()) as AssessmentRow<T>[];
  return rows.map((row) => ({
    id: row.id,
    payload: row.payload,
    environmentalDate: row.environmental_month,
    knowledgeDate: row.knowledge_date,
    modelVersion: row.model_version,
    publishedAt: row.published_at,
  }));
}
