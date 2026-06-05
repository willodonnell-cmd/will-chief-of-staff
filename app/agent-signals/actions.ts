"use server";

import { revalidatePath } from "next/cache";

import { executeNativeMicrosoft365RunNow } from "@/lib/agent-signals/run-now-route";
import {
  createManualAgentRunRequest,
  createSupabaseAgentRunRequestsRepository
} from "@/lib/agent-run-requests";
import { markMicrosoftGraphConnectionRevoked } from "@/lib/microsoft-graph/auth";
import { resolveCurrentAppUser } from "@/lib/supabase/current-user";

function revalidateAgentSurfaces() {
  revalidatePath("/inbox");
  revalidatePath("/agent-signals/health");
}

export async function requestAgentRunNowAction() {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    throw new Error("No active app user could be resolved.");
  }

  const repository = await createSupabaseAgentRunRequestsRepository(resolved.client);
  await createManualAgentRunRequest(repository, {
    userId: resolved.user.id,
    requestedBy: resolved.user.full_name,
    requestContext: {
      requestedFrom: "blackhawk_ui"
    }
  });

  revalidateAgentSurfaces();
}

export async function runNativeMicrosoft365NowAction() {
  await executeNativeMicrosoft365RunNow();
  revalidateAgentSurfaces();
}

export async function disconnectMicrosoft365Action() {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    throw new Error("No active app user could be resolved.");
  }

  await markMicrosoftGraphConnectionRevoked({
    userId: resolved.user.id
  });

  revalidateAgentSurfaces();
}
