import { handleAgentSignalsImportRequest } from "@/lib/agent-signals/import-route";

export async function POST(request: Request) {
  return await handleAgentSignalsImportRequest(request);
}
