import type { D1Database } from "@/lib/d1/types";
import { handleAgentBriefIngestRequest, type AgentBriefIngestEnv } from "@/lib/sites/agent-brief-ingest-route";
import { loadSitesD1Health, type SitesD1HealthEnv } from "@/lib/sites/sites-d1-health";

type PublicBriefIngestEnv = AgentBriefIngestEnv &
  SitesD1HealthEnv & {
    DB?: D1Database;
  };

function jsonResponse(body: Record<string, unknown>, init?: ResponseInit) {
  return Response.json(body, {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init?.headers
    }
  });
}

export default {
  async fetch(request: Request, env: PublicBriefIngestEnv) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json(await loadSitesD1Health({ db: env.DB ?? null, env }));
    }

    if (request.method === "POST" && url.pathname === "/api/brief/agent-ingest") {
      return await handleAgentBriefIngestRequest(request, {
        db: env.DB,
        env
      });
    }

    return jsonResponse({ error: "not_found" }, { status: 404 });
  }
};
