import { assessRegime } from "@/science/model.mjs";
import { prototypeInput } from "@/science/fixtures.mjs";
import { SOURCE_CATALOG } from "@/science/adapters/catalog.mjs";
import { evaluateCalibration } from "@/science/calibration.mjs";
import { syntheticHindcastExamples } from "@/science/calibration-fixtures.mjs";
import argoValidation from "@/science/observations/argo-validation.json";
import oisstValidation from "@/science/observations/oisst-validation.json";
import { getPublicAssessmentHistory } from "@/lib/supabase/assessment-repository";
import { getPublicPipelineStatus } from "@/lib/supabase/pipeline-status-repository";

export const dynamic = "force-dynamic";

function fixturePayload() {
  return {
    assessment: assessRegime(prototypeInput),
    validation: evaluateCalibration(syntheticHindcastExamples()),
    observationalBeta: { argo: argoValidation, oisst: oisstValidation },
    sources: SOURCE_CATALOG,
  };
}

type AssessmentPayload = ReturnType<typeof fixturePayload>;
type AssessmentHistoryEntry = {
  id: string;
  environmentalDate: string;
  knowledgeDate: string;
  modelVersion: string;
  publishedAt: string | null;
  payload: AssessmentPayload;
};

export async function GET() {
  let payload = fixturePayload();
  let history: AssessmentHistoryEntry[] = [{
    id: "local-research-fixture",
    environmentalDate: `${payload.assessment.asOf}-01`,
    knowledgeDate: `${payload.assessment.knowledgeDate}T00:00:00.000Z`,
    modelVersion: payload.assessment.modelVersion,
    publishedAt: null,
    payload,
  }];
  let dataState = {
    storage: "fixture-fallback",
    message: "No published Supabase assessment is available; serving the versioned local research fixture.",
    snapshotCount: 1,
  };
  let pipelineStatus: Awaited<ReturnType<typeof getPublicPipelineStatus>> = [];

  try {
    const stored = await getPublicAssessmentHistory<typeof payload>();
    if (stored.length) {
      history = stored;
      payload = stored.at(-1)!.payload;
      dataState = {
        storage: "supabase",
        message: `Published ${stored.length} versioned research snapshot${stored.length === 1 ? "" : "s"}`,
        snapshotCount: stored.length,
      };
    }
  } catch (error) {
    console.error("Unable to read the latest Supabase assessment", error);
  }

  try {
    pipelineStatus = await getPublicPipelineStatus();
  } catch (error) {
    console.error("Unable to read the public pipeline status", error);
  }

  return Response.json({ ...payload, dataState, history, pipelineStatus }, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=60",
    },
  });
}
