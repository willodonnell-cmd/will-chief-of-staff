import type { ForwardedEmailAttachment, ForwardedEmailInboundInput } from "@/lib/priority-inbox-forwarded";

type CloudMailinEnvelope = {
  to?: string | string[] | null;
  recipients?: string[] | null;
  from?: string | null;
  helo_domain?: string | null;
  remote_ip?: string | null;
  spf?: string | null;
};

type CloudMailinJsonPayload = {
  envelope?: CloudMailinEnvelope | null;
  headers?: Record<string, unknown> | null;
  plain?: string | null;
  html?: string | null;
  reply_plain?: string | null;
  attachments?: unknown;
};

type CloudMailinParseResult =
  | {
      ok: true;
      input: ForwardedEmailInboundInput;
      metadata: {
        contentType: string;
        envelopeTo: string | null;
        envelopeFrom: string | null;
      };
    }
  | {
      ok: false;
      status: number;
      error: string;
      contentType?: string;
    };

function firstString(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return value.find((entry) => typeof entry === "string" && entry.trim())?.trim() ?? null;
  }

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeHeaderName(value: string) {
  return value.toLowerCase().replace(/_/g, "-");
}

function normalizeHeaderValue(value: unknown): string | string[] | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }

  if (value && typeof value === "object") {
    const objectValues = Object.values(value);
    const strings = objectValues.filter((entry): entry is string => typeof entry === "string");
    if (strings.length > 0) {
      return strings;
    }
  }

  return null;
}

function extractEmailAddress(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.toLowerCase() ?? null;
}

function toStringMap(value: Record<string, unknown> | null | undefined) {
  const headers: Record<string, string | string[] | null> = {};
  if (!value) {
    return headers;
  }

  for (const [key, entry] of Object.entries(value)) {
    headers[normalizeHeaderName(key)] = normalizeHeaderValue(entry);
  }

  return headers;
}

function formDataEntriesToObject(formData: FormData) {
  const root: Record<string, unknown> = {};

  function assignPath(target: Record<string, unknown>, path: string[], value: unknown) {
    let current: Record<string, unknown> | unknown[] = target;

    for (let index = 0; index < path.length; index += 1) {
      const segment = path[index];
      const isLast = index === path.length - 1;
      const nextSegment = path[index + 1];
      const wantsArray = nextSegment === "";

      if (segment === "") {
        if (!Array.isArray(current)) {
          return;
        }

        if (isLast) {
          current.push(value);
          return;
        }

        const nextContainer =
          nextSegment === "" ? [] : wantsArray ? [] : {};
        current.push(nextContainer);
        current = nextContainer as Record<string, unknown> | unknown[];
        continue;
      }

      if (Array.isArray(current)) {
        const last = current[current.length - 1];
        if (!last || typeof last !== "object" || Array.isArray(last)) {
          current.push({});
        }
        current = current[current.length - 1] as Record<string, unknown>;
      }

      if (isLast) {
        const existing = (current as Record<string, unknown>)[segment];
        if (existing === undefined) {
          (current as Record<string, unknown>)[segment] = value;
        } else if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          (current as Record<string, unknown>)[segment] = [existing, value];
        }
        return;
      }

      const existing = (current as Record<string, unknown>)[segment];
      if (existing === undefined) {
        (current as Record<string, unknown>)[segment] = wantsArray ? [] : {};
      }

      current = (current as Record<string, unknown>)[segment] as Record<string, unknown> | unknown[];
    }
  }

  for (const [key, rawValue] of formData.entries()) {
    const path = key.split(/\[|\]/).filter((segment, index, all) => segment !== "" || index < all.length - 1);
    const value =
      rawValue instanceof File
        ? {
            filename: rawValue.name,
            contentType: rawValue.type || null,
            size: rawValue.size
          }
        : rawValue;

    assignPath(root, path, value);
  }

  return root;
}

function normalizeAttachments(value: unknown): ForwardedEmailAttachment[] | null {
  if (!value) {
    return null;
  }

  const entries = Array.isArray(value) ? value : [value];
  const attachments: ForwardedEmailAttachment[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const attachment = entry as Record<string, unknown>;
    const filename =
      typeof attachment.file_name === "string"
        ? attachment.file_name
        : typeof attachment.filename === "string"
          ? attachment.filename
          : null;

    const contentType =
      typeof attachment.content_type === "string"
        ? attachment.content_type
        : typeof attachment.contentType === "string"
          ? attachment.contentType
          : null;

    const size =
      typeof attachment.size === "number"
        ? attachment.size
        : typeof attachment.size === "string" && attachment.size.trim()
          ? Number(attachment.size)
          : null;

    attachments.push({
      filename,
      contentType,
      size: Number.isFinite(size ?? Number.NaN) ? size : null
    });
  }

  return attachments.length > 0 ? attachments : null;
}

function payloadToForwardedInput(
  payload: CloudMailinJsonPayload,
  contentType: string
): CloudMailinParseResult {
  const headers = toStringMap(
    payload.headers && typeof payload.headers === "object" && !Array.isArray(payload.headers)
      ? (payload.headers as Record<string, unknown>)
      : null
  );
  const envelope =
    payload.envelope && typeof payload.envelope === "object" && !Array.isArray(payload.envelope)
      ? payload.envelope
      : null;
  const destinationAddress = extractEmailAddress(firstString(envelope?.to) ?? firstString(headers["to"] as string | string[] | null));
  const rawText =
    (typeof payload.reply_plain === "string" && payload.reply_plain.trim()) ||
    (typeof payload.plain === "string" && payload.plain.trim()) ||
    "";

  if (!destinationAddress || !rawText) {
    return {
      ok: false,
      status: 422,
      error: "CloudMailin payload is missing the destination address or plain-text body.",
      contentType
    };
  }

  const envelopeFrom = extractEmailAddress(firstString(envelope?.from));
  const normalizedHeaders: Record<string, string | string[] | null> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders[key] = value;
  }

  return {
    ok: true,
    input: {
      destinationAddress,
      rawText,
      subject: firstString(normalizedHeaders["subject"] as string | string[] | null),
      forwardedAt: firstString(normalizedHeaders["date"] as string | string[] | null),
      forwardedByEmail: envelopeFrom,
      forwardedByName: firstString(normalizedHeaders["from"] as string | string[] | null),
      headers: normalizedHeaders,
      attachments: normalizeAttachments(payload.attachments),
      nativeSourceLink: null
    },
    metadata: {
      contentType,
      envelopeTo: destinationAddress,
      envelopeFrom
    }
  };
}

export async function parseCloudMailinRequest(request: Request): Promise<CloudMailinParseResult> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await request.json().catch(() => null)) as CloudMailinJsonPayload | null;
    if (!payload || typeof payload !== "object") {
      return {
        ok: false,
        status: 422,
        error: "CloudMailin JSON payload could not be parsed.",
        contentType
      };
    }

    return payloadToForwardedInput(payload, contentType);
  }

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return {
        ok: false,
        status: 422,
        error: "CloudMailin multipart payload could not be parsed.",
        contentType
      };
    }

    const payload = formDataEntriesToObject(formData) as CloudMailinJsonPayload;
    return payloadToForwardedInput(payload, contentType);
  }

  return {
    ok: false,
    status: 415,
    error: "CloudMailin payload must be multipart/form-data or application/json.",
    contentType
  };
}

export function parseBasicAuthHeader(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (!authorization.toLowerCase().startsWith("basic ")) {
    return null;
  }

  try {
    const encoded = authorization.slice("basic ".length).trim();
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1)
    };
  } catch {
    return null;
  }
}
