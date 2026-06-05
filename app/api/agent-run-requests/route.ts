import { handleCreateAgentRunRequest } from "@/lib/agent-run-requests-route";

export async function POST(request: Request) {
  return await handleCreateAgentRunRequest(request);
}
