import { NextResponse } from "next/server";

import { createOutlookConnectUrlForOrigin } from "@/lib/priority-inbox-sources";
import { isOutlookConfigured } from "@/lib/outlook";

const OUTLOOK_STATE_COOKIE = "blackhawk_outlook_oauth_state";
const OUTLOOK_NEXT_COOKIE = "blackhawk_outlook_oauth_next";

function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/")) {
    return "/inbox";
  }

  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const nextPath = sanitizeNextPath(requestUrl.searchParams.get("next"));

  if (!isOutlookConfigured()) {
    return NextResponse.redirect(new URL("/inbox?outlook=not_configured", request.url));
  }

  const state = crypto.randomUUID();
  const authorizeUrl = createOutlookConnectUrlForOrigin(requestUrl.origin, state);
  const response = NextResponse.redirect(authorizeUrl);

  response.cookies.set(OUTLOOK_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: requestUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 10
  });
  response.cookies.set(OUTLOOK_NEXT_COOKIE, nextPath, {
    httpOnly: true,
    sameSite: "lax",
    secure: requestUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 10
  });

  return response;
}
