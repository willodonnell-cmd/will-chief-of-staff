import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import {
  isExecutiveBriefBundleSubject,
  parseExecutiveBriefBundleEmail,
  upsertExecutiveBriefSnapshot
} from "@/lib/brief/executive-brief-snapshots";
import {
  isInvestmentCommitteeBundleSubject,
  parseInvestmentCommitteeBundleEmail
} from "@/lib/investment-committee-agent";
import { upsertInvestmentCommitteeAgentBundle } from "@/lib/investment-committee";
import { parseBasicAuthHeader, parseCloudMailinRequest } from "@/lib/priority-inbox-cloudmailin";
import { parseForwardedEmail } from "@/lib/priority-inbox-forwarded";
import { resolveForwardingUserByDestination } from "@/lib/priority-inbox-forwarding";
import { ingestForwardedPriorityInboxItem } from "@/lib/priority-inbox-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function logCloudMailinInbound(message: string, details?: Record<string, unknown>) {
  const safeDetails = details ?? {};
  console.info("[priority-inbox.cloudmailin]", message, safeDetails);
}

function getHeaderValue(
  headers: Record<string, string | string[] | null | undefined> | null | undefined,
  name: string
) {
  if (!headers) {
    return null;
  }

  const requestedName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== requestedName) {
      continue;
    }

    if (Array.isArray(value)) {
      return value.find((entry) => entry.trim()) ?? null;
    }

    return value ?? null;
  }

  return null;
}

function emailDiagnostics(input: {
  subject?: string | null;
  forwardedByEmail?: string | null;
  forwardedByName?: string | null;
  headers?: Record<string, string | string[] | null | undefined> | null;
}) {
  return {
    subject: input.subject,
    sender: input.forwardedByEmail ?? input.forwardedByName ?? null,
    messageId: getHeaderValue(input.headers, "message-id")
  };
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

    if (isExecutiveBriefBundleSubject(parsedRequest.input.subject)) {
      const parsedBrief = parseExecutiveBriefBundleEmail(parsedRequest.input);
      const parsedBriefDiagnostics = {
        ...emailDiagnostics(parsedRequest.input),
        kind: "executive_brief",
        jsonBundleParsed: Boolean(parsedBrief.jsonBundle),
        validationWarnings: parsedBrief.validationWarnings,
        slot: parsedBrief.slot,
        generatedAt: parsedBrief.generatedAt
      };
      logCloudMailinInbound("Received Executive Brief bundle from CloudMailin.", parsedBriefDiagnostics);
      const snapshot = await upsertExecutiveBriefSnapshot({
        client,
        userId: forwardingConfig.user_id,
        parsed: parsedBrief
      });

      logCloudMailinInbound("Persisted Executive Brief snapshot from CloudMailin.", {
        ...parsedBriefDiagnostics,
        d1SnapshotWriteSucceeded: true,
        snapshotId: snapshot.id,
        slot: snapshot.slot,
        sourceMessageId: snapshot.sourceMessageId
      });
      revalidatePath("/brief");
      revalidatePath("/agent-signal-brief");

      return NextResponse.json({
        ok: true,
        kind: "executive_brief",
        snapshotId: snapshot.id,
        slot: snapshot.slot,
        generatedAt: snapshot.generatedAt
      });
    }

    if (isInvestmentCommitteeBundleSubject(parsedRequest.input.subject)) {
      logCloudMailinInbound("Received Investment Committee bundle from CloudMailin.", {
        ...emailDiagnostics(parsedRequest.input),
        kind: "investment_committee"
      });
      const parsedBundle = parseInvestmentCommitteeBundleEmail(parsedRequest.input);
      const bundle = await upsertInvestmentCommitteeAgentBundle({
        client,
        userId: forwardingConfig.user_id,
        parsed: parsedBundle
      });

      logCloudMailinInbound("Persisted Investment Committee bundle from CloudMailIn.", {
        bundleId: bundle.id,
        weekOf: bundle.week_of,
        sourceMessageId: bundle.source_message_id
      });
      revalidatePath("/investment-committee");

      return NextResponse.json({
        ok: true,
        kind: "investment_committee",
        bundleId: bundle.id,
        weekOf: bundle.week_of,
        producedAt: bundle.produced_at
      });
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
      subject: parsedRequest.ok ? parsedRequest.input.subject : null,
      sender: parsedRequest.ok
        ? parsedRequest.input.forwardedByEmail ?? parsedRequest.input.forwardedByName ?? null
        : null,
      error: error instanceof Error ? error.message : "Unknown ingest error."
    });
    return textResponse(500, "CloudMailin email could not be processed.");
  }
}
