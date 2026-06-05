import { handleGetLatestAgentRunRequest } from "@/lib/agent-run-requests-route";

export async function GET(request: Request) {
  return await handleGetLatestAgentRunRequest(request);
}
