import { assessRegime } from "@/science/model.mjs";
import { prototypeInput } from "@/science/fixtures.mjs";
import { SOURCE_CATALOG } from "@/science/adapters/catalog.mjs";
import { evaluateCalibration } from "@/science/calibration.mjs";
import { syntheticHindcastExamples } from "@/science/calibration-fixtures.mjs";
import argoValidation from "@/science/observations/argo-validation.json";
import oisstValidation from "@/science/observations/oisst-validation.json";

export async function GET() {
  return Response.json({ assessment: assessRegime(prototypeInput), validation: evaluateCalibration(syntheticHindcastExamples()), observationalBeta: { argo: argoValidation, oisst: oisstValidation }, sources: SOURCE_CATALOG }, {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
  });
}
