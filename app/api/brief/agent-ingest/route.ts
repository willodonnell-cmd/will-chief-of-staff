import { handleAgentBriefIngestRequest } from "@/lib/sites/agent-brief-ingest-route";

export async function POST(request: Request) {
  return await handleAgentBriefIngestRequest(request);
}
