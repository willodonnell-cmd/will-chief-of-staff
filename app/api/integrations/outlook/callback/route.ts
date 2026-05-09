import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { completeOutlookConnection } from "@/lib/priority-inbox-sources";

const OUTLOOK_STATE_COOKIE = "blackhawk_outlook_oauth_state";
const OUTLOOK_NEXT_COOKIE = "blackhawk_outlook_oauth_next";

function redirectWithStatus(requestUrl: URL, nextPath: string, status: "connected" | "error", message?: string) {
  const redirectUrl = new URL(nextPath, requestUrl.origin);
  redirectUrl.searchParams.set("outlook", status);

  if (status === "error" && message) {
    redirectUrl.searchParams.set("outlook_message", message.slice(0, 240));
  }

  return redirectUrl;
}

function clearOauthCookies(response: NextResponse) {
  response.cookies.set(OUTLOOK_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  response.cookies.set(OUTLOOK_NEXT_COOKIE, "", {
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
  const expectedState = cookieStore.get(OUTLOOK_STATE_COOKIE)?.value;
  const nextPath = cookieStore.get(OUTLOOK_NEXT_COOKIE)?.value || "/inbox";

  if (!code || oauthError || !returnedState || !expectedState || returnedState !== expectedState) {
    const response = NextResponse.redirect(
      redirectWithStatus(
        requestUrl,
        nextPath,
        "error",
        oauthError ? `Microsoft sign-in returned ${oauthError}.` : "Outlook connection could not be verified."
      )
    );
    clearOauthCookies(response);
    return response;
  }

  const result = await completeOutlookConnection({
    origin: requestUrl.origin,
    code
  });

  const response = NextResponse.redirect(
    result.ok
      ? redirectWithStatus(requestUrl, nextPath, "connected")
      : redirectWithStatus(requestUrl, nextPath, "error", result.error)
  );
  clearOauthCookies(response);

  return response;
}
