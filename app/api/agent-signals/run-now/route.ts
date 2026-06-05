import { handleNativeMicrosoft365RunNowRequest } from "@/lib/agent-signals/run-now-route";

export async function POST(request: Request) {
  return await handleNativeMicrosoft365RunNowRequest(request);
}
