import { handleCompleteAgentRunRequest } from "@/lib/agent-run-requests-route";

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const { id } = await context.params;
  return await handleCompleteAgentRunRequest(request, id);
}
