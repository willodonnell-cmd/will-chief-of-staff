import { NextResponse } from "next/server";

import { markMicrosoftGraphConnectionRevoked } from "@/lib/microsoft-graph/auth";
import { resolveCurrentAppUser } from "@/lib/supabase/current-user";

export async function POST(request: Request) {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return NextResponse.json(
      {
        code: "auth_required",
        message: "No active app user could be resolved."
      },
      { status: 401 }
    );
  }

  await markMicrosoftGraphConnectionRevoked({
    userId: resolved.user.id
  });

  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("application/json")) {
    return NextResponse.json({ disconnected: true });
  }

  return NextResponse.redirect(new URL("/agent-signals/health?microsoft=disconnected", request.url), 303);
}
