"use server";

import { revalidatePath } from "next/cache";

import {
  createManualAgentRunRequest,
  createSupabaseAgentRunRequestsRepository
} from "@/lib/agent-run-requests";
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
