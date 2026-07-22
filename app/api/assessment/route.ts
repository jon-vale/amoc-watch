import { assessRegime } from "@/science/model.mjs";
import { prototypeInput } from "@/science/fixtures.mjs";
import { SOURCE_CATALOG } from "@/science/adapters/catalog.mjs";

export async function GET() {
  return Response.json({ assessment: assessRegime(prototypeInput), sources: SOURCE_CATALOG }, {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
  });
}
