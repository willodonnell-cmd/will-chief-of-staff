import { NextResponse } from "next/server";

import { parseBasicAuthHeader, parseCloudMailinRequest } from "@/lib/priority-inbox-cloudmailin";
import { parseForwardedEmail } from "@/lib/priority-inbox-forwarded";
import { resolveForwardingUserByDestination } from "@/lib/priority-inbox-forwarding";
import { ingestForwardedPriorityInboxItem } from "@/lib/priority-inbox-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function logCloudMailinInbound(message: string, details?: Record<string, unknown>) {
  const safeDetails = details ?? {};
  console.info("[priority-inbox.cloudmailin]", message, safeDetails);
}

function textResponse(status: number, body: string) {
  return new NextResponse(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8"
    }
  });
}

function isCloudMailinAuthorized(request: Request) {
  const expectedUsername = process.env.CLOUDMAILIN_BASIC_AUTH_USERNAME?.trim();
  const expectedPassword = process.env.CLOUDMAILIN_BASIC_AUTH_PASSWORD?.trim();

  if (expectedUsername && expectedPassword) {
    const basicAuth = parseBasicAuthHeader(request);
    return basicAuth?.username === expectedUsername && basicAuth?.password === expectedPassword;
  }

  const expectedToken = process.env.BLACKHAWK_FORWARDING_INGEST_TOKEN?.trim();
  const providedToken = request.headers.get("x-blackhawk-ingest-token")?.trim();
  return Boolean(expectedToken) && providedToken === expectedToken;
}

function isCloudMailinAuthConfigured() {
  return (
    Boolean(process.env.CLOUDMAILIN_BASIC_AUTH_USERNAME?.trim() && process.env.CLOUDMAILIN_BASIC_AUTH_PASSWORD?.trim()) ||
    Boolean(process.env.BLACKHAWK_FORWARDING_INGEST_TOKEN?.trim())
  );
}

export async function POST(request: Request) {
  if (!isCloudMailinAuthConfigured()) {
    logCloudMailinInbound("Rejected CloudMailin request because auth is not configured.");
    return textResponse(503, "CloudMailin auth is not configured.");
  }

  if (!isCloudMailinAuthorized(request)) {
    logCloudMailinInbound("Rejected CloudMailin request because auth failed.", {
      contentType: request.headers.get("content-type") ?? null
    });
    return textResponse(401, "CloudMailin request was not authorized.");
  }

  const parsedRequest = await parseCloudMailinRequest(request);
  if (!parsedRequest.ok) {
    logCloudMailinInbound("Rejected CloudMailin request because payload validation failed.", {
      status: parsedRequest.status,
      contentType: parsedRequest.contentType ?? null,
      reason: parsedRequest.error
    });
    return textResponse(parsedRequest.status, parsedRequest.error);
  }

  try {
    const forwardingConfig = await resolveForwardingUserByDestination(parsedRequest.input.destinationAddress);
    if (!forwardingConfig) {
      logCloudMailinInbound("Rejected CloudMailin request because destination was not configured in Blackhawk.", {
        destinationAddress: parsedRequest.input.destinationAddress
      });
      return textResponse(422, "No Priority Inbox forwarding destination matches that address.");
    }

    const client = createSupabaseAdminClient();
    if (!client) {
      logCloudMailinInbound("CloudMailin request could not be processed because service-role access is unavailable.");
      return textResponse(503, "SUPABASE_SERVICE_ROLE_KEY is required for CloudMailin ingestion.");
    }

    const parsedEmail = parseForwardedEmail(parsedRequest.input);
    const result = await ingestForwardedPriorityInboxItem({
      client,
      userId: forwardingConfig.user_id,
      destinationAddress: forwardingConfig.destination_address,
      parsed: parsedEmail,
      provider: "cloudmailin",
      providerMetadata: parsedRequest.metadata
    });

    return NextResponse.json({
      ok: true,
      itemId: result.item.id,
      threadTitle: result.item.threadTitle,
      openMode: result.item.sourceLink ? "native" : "detail",
      deduplicated: result.deduplicated
    });
  } catch (error) {
    logCloudMailinInbound("CloudMailin request failed during ingest.", {
      error: error instanceof Error ? error.message : "Unknown ingest error."
    });
    return textResponse(500, "CloudMailin email could not be processed.");
  }
}
