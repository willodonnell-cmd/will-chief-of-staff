import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  exchangeMicrosoftGraphCodeForTokens,
  fetchMicrosoftGraphProfile,
  MICROSOFT_GRAPH_OAUTH_STATE_COOKIE,
  resolveMicrosoftGraphRedirectUri,
  storeEncryptedMicrosoftGraphConnection,
  verifyMicrosoftGraphOAuthState
} from "@/lib/microsoft-graph/auth";
import { resolveCurrentAppUser } from "@/lib/supabase/current-user";

function redirectWithMicrosoftStatus(requestUrl: URL, status: string) {
  const redirectUrl = new URL("/agent-signals/health", requestUrl.origin);
  redirectUrl.searchParams.set("microsoft", status);
  return redirectUrl;
}

function clearOauthState(response: NextResponse) {
  response.cookies.set(MICROSOFT_GRAPH_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const returnedState = requestUrl.searchParams.get("state");
  const oauthError = requestUrl.searchParams.get("error");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(MICROSOFT_GRAPH_OAUTH_STATE_COOKIE)?.value ?? null;

  if (!code || oauthError || !verifyMicrosoftGraphOAuthState(returnedState, expectedState)) {
    const response = NextResponse.redirect(redirectWithMicrosoftStatus(requestUrl, "error"));
    clearOauthState(response);
    return response;
  }

  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    const response = NextResponse.redirect(redirectWithMicrosoftStatus(requestUrl, "auth_required"));
    clearOauthState(response);
    return response;
  }

  try {
    const redirectUri = resolveMicrosoftGraphRedirectUri(requestUrl.origin);
    const tokens = await exchangeMicrosoftGraphCodeForTokens({ code, redirectUri });
    const profile = await fetchMicrosoftGraphProfile(tokens.accessToken);
    await storeEncryptedMicrosoftGraphConnection({
      userId: resolved.user.id,
      profile,
      tokens
    });

    const response = NextResponse.redirect(redirectWithMicrosoftStatus(requestUrl, "connected"));
    clearOauthState(response);
    return response;
  } catch (error) {
    console.error("[microsoft.callback]", error instanceof Error ? error.message : error);
    const response = NextResponse.redirect(redirectWithMicrosoftStatus(requestUrl, "error"));
    clearOauthState(response);
    return response;
  }
}
