import { handleGetPendingAgentRunRequests } from "@/lib/agent-run-requests-route";

export async function GET(request: Request) {
  return await handleGetPendingAgentRunRequests(request);
}
