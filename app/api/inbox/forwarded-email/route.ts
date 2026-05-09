import { NextResponse } from "next/server";

import { normalizePriorityInboxStorageError } from "@/lib/priority-inbox-errors";
import { parseForwardedEmail, type ForwardedEmailInboundInput } from "@/lib/priority-inbox-forwarded";
import { resolveForwardingUserByDestination } from "@/lib/priority-inbox-forwarding";
import { ingestForwardedPriorityInboxItem } from "@/lib/priority-inbox-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function logForwardedEmail(message: string, details?: Record<string, unknown>) {
  console.info("[priority-inbox.forwarded-email]", message, details ?? {});
}

function unauthorized() {
  return NextResponse.json(
    {
      ok: false,
      error: "Forwarded-email ingestion is not authorized."
    },
    { status: 401 }
  );
}

function isAuthorized(request: Request) {
  const expectedToken = process.env.BLACKHAWK_FORWARDING_INGEST_TOKEN?.trim();
  if (!expectedToken) {
    return false;
  }

  const providedToken = request.headers.get("x-blackhawk-ingest-token")?.trim();
  return providedToken === expectedToken;
}

function sanitizeInboundPayload(value: unknown): ForwardedEmailInboundInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const destinationAddress = typeof payload.destinationAddress === "string" ? payload.destinationAddress.trim() : "";
  const rawText = typeof payload.rawText === "string" ? payload.rawText.trim() : "";

  if (!destinationAddress || !rawText) {
    return null;
  }

  return {
    destinationAddress,
    rawText,
    subject: typeof payload.subject === "string" ? payload.subject : null,
    forwardedAt: typeof payload.forwardedAt === "string" ? payload.forwardedAt : null,
    forwardedByName: typeof payload.forwardedByName === "string" ? payload.forwardedByName : null,
    forwardedByEmail: typeof payload.forwardedByEmail === "string" ? payload.forwardedByEmail : null,
    nativeSourceLink: typeof payload.nativeSourceLink === "string" ? payload.nativeSourceLink : null,
    headers:
      payload.headers && typeof payload.headers === "object" && !Array.isArray(payload.headers)
        ? (payload.headers as ForwardedEmailInboundInput["headers"])
        : null,
    attachments: Array.isArray(payload.attachments)
      ? payload.attachments
          .filter((entry) => entry && typeof entry === "object")
          .map((entry) => {
            const attachment = entry as Record<string, unknown>;
            return {
              filename: typeof attachment.filename === "string" ? attachment.filename : null,
              contentType: typeof attachment.contentType === "string" ? attachment.contentType : null,
              size: typeof attachment.size === "number" ? attachment.size : null
            };
          })
      : null
  };
}

export async function POST(request: Request) {
  if (!process.env.BLACKHAWK_FORWARDING_INGEST_TOKEN?.trim()) {
    logForwardedEmail("Rejected generic forwarded-email request because auth is not configured.");
    return NextResponse.json(
      {
        ok: false,
        error: "Forwarded-email auth is not configured."
      },
      { status: 503 }
    );
  }

  if (!isAuthorized(request)) {
    logForwardedEmail("Rejected generic forwarded-email request because auth failed.", {
      contentType: request.headers.get("content-type") ?? null
    });
    return unauthorized();
  }

  const payload = sanitizeInboundPayload(await request.json().catch(() => null));
  if (!payload) {
    logForwardedEmail("Rejected generic forwarded-email request because payload validation failed.", {
      contentType: request.headers.get("content-type") ?? null
    });
    return NextResponse.json(
      {
        ok: false,
        error: "A destination address and raw forwarded text are required."
      },
      { status: 400 }
    );
  }

  try {
    const forwardingConfig = await resolveForwardingUserByDestination(payload.destinationAddress);
    if (!forwardingConfig) {
      logForwardedEmail("Rejected generic forwarded-email request because destination was not configured.", {
        destinationAddress: payload.destinationAddress
      });
      return NextResponse.json(
        {
          ok: false,
          error: "No Priority Inbox forwarding destination matches that address."
        },
        { status: 404 }
      );
    }

    const client = createSupabaseAdminClient();
    if (!client) {
      return NextResponse.json(
        {
          ok: false,
          error: "SUPABASE_SERVICE_ROLE_KEY is required for forwarded-email ingestion."
        },
        { status: 500 }
      );
    }

    const parsed = parseForwardedEmail(payload);
    const result = await ingestForwardedPriorityInboxItem({
      client,
      userId: forwardingConfig.user_id,
      destinationAddress: forwardingConfig.destination_address,
      parsed,
      provider: "generic"
    });

    return NextResponse.json({
      ok: true,
      itemId: result.item.id,
      threadTitle: result.item.threadTitle,
      openMode: result.item.sourceLink ? "native" : "detail",
      deduplicated: result.deduplicated
    });
  } catch (error) {
    const normalizedError = normalizePriorityInboxStorageError(error, "Forwarded email could not be ingested.");
    logForwardedEmail("Generic forwarded-email request failed during ingest.", {
      error: normalizedError
    });
    return NextResponse.json(
      {
        ok: false,
        error: normalizedError
      },
      { status: 500 }
    );
  }
}
