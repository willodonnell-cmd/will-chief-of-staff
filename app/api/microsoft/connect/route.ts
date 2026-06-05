import { NextResponse } from "next/server";

import {
  buildMicrosoftGraphAuthorizationUrl,
  generateMicrosoftGraphOAuthState,
  isMicrosoftGraphConfigured,
  MICROSOFT_GRAPH_OAUTH_STATE_COOKIE,
  resolveMicrosoftGraphRedirectUri
} from "@/lib/microsoft-graph/auth";
import { resolveCurrentAppUser } from "@/lib/supabase/current-user";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return NextResponse.redirect(new URL("/agent-signals/health?microsoft=auth_required", request.url));
  }

  if (!isMicrosoftGraphConfigured()) {
    return NextResponse.redirect(new URL("/agent-signals/health?microsoft=not_configured", request.url));
  }

  const state = generateMicrosoftGraphOAuthState();
  const redirectUri = resolveMicrosoftGraphRedirectUri(requestUrl.origin);
  const authorizeUrl = buildMicrosoftGraphAuthorizationUrl({
    state,
    redirectUri
  });
  const response = NextResponse.redirect(authorizeUrl);

  response.cookies.set(MICROSOFT_GRAPH_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: requestUrl.protocol === "https:",
    path: "/",
    maxAge: 10 * 60
  });

  return response;
}
