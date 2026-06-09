import { loadSitesD1Health } from "@/lib/sites/sites-d1-health";

export async function GET() {
  return Response.json(await loadSitesD1Health());
}
