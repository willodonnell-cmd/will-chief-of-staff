import { createHash } from "node:crypto";

import type {
  PriorityInboxCanonicalCommitmentInput,
  PriorityInboxCommitmentPrefill,
  PriorityInboxRecommendedAction,
  PriorityInboxReferencePrefill,
  PriorityInboxTaskPrefill
} from "@/lib/priority-inbox";

export const FORWARDED_EMAIL_RAW_LIMIT = 20_000;
const FORWARDED_EMAIL_SNIPPET_LIMIT = 420;
const FORWARDED_EMAIL_BODY_LIMIT = 6_000;

export type ForwardedEmailAttachment = {
  filename?: string | null;
  contentType?: string | null;
  size?: number | null;
};

export type ForwardedEmailInboundInput = {
  destinationAddress: string;
  rawText: string;
  subject?: string | null;
  forwardedAt?: string | null;
  forwardedByName?: string | null;
  forwardedByEmail?: string | null;
  headers?: Record<string, string | string[] | null | undefined> | null;
  attachments?: ForwardedEmailAttachment[] | null;
  nativeSourceLink?: string | null;
};

export type ParsedForwardedEmail = {
  externalMessageId: string;
  conversationId: string | null;
  sender: string;
  senderRole: string | null;
  subject: string;
  primaryLine: string;
  snippet: string;
  receivedAt: string | null;
  whySurfaced: string;
  supportingSignals: string[];
  recommendedAction: PriorityInboxRecommendedAction;
  attachmentCue: string | null;
  taskPrefill: PriorityInboxTaskPrefill;
  commitmentPrefill: PriorityInboxCommitmentPrefill;
  canonicalCommitment: PriorityInboxCanonicalCommitmentInput;
  referencePrefill: PriorityInboxReferencePrefill;
  sourceLink: string | null;
  sourceMetadata: Record<string, unknown>;
  rawContent: string;
  detailBody: string;
  forwardedByName: string | null;
  forwardedByEmail: string | null;
  originalSenderName: string | null;
  originalSenderEmail: string | null;
  originalReceivedAt: string | null;
  forwardedAt: string | null;
  providerHint: "outlook" | "gmail" | null;
  parsedHeaders: Record<string, string | null>;
  attachmentNames: string[];
  rawContentTruncated: boolean;
};

type ParsedMailbox = {
  name: string | null;
  email: string | null;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n");
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function takeWithLimit(value: string, limit: number) {
  const trimmed = value.trim();
  if (trimmed.length <= limit) {
    return {
      text: trimmed,
      truncated: false
    };
  }

  return {
    text: `${trimmed.slice(0, Math.max(0, limit - 1)).trimEnd()}…`,
    truncated: true
  };
}

function firstHeaderValue(
  headers: ForwardedEmailInboundInput["headers"],
  names: string[]
): string | null {
  if (!headers) {
    return null;
  }

  for (const [headerName, rawValue] of Object.entries(headers)) {
    if (!names.includes(headerName.toLowerCase())) {
      continue;
    }

    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function stripForwardPrefix(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.replace(/^(fw|fwd)\s*:\s*/i, "").trim();
}

function parseMailbox(value: string | null | undefined): ParsedMailbox {
  if (!value) {
    return { name: null, email: null };
  }

  const trimmed = value.trim();
  const emailMatch = trimmed.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const email = emailMatch?.[0]?.trim() ?? null;

  if (!email) {
    return {
      name: trimmed || null,
      email: null
    };
  }

  const withoutEmail = trimmed
    .replace(email, "")
    .replace(/[<>"]/g, "")
    .replace(/\((.*?)\)/g, "$1")
    .trim()
    .replace(/\s+/g, " ");

  return {
    name: withoutEmail || email,
    email
  };
}

function parseDateValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
}

function detectProviderHint(rawText: string, sourceLink: string | null) {
  if (sourceLink?.includes("outlook")) {
    return "outlook" as const;
  }

  if (sourceLink?.includes("mail.google.com")) {
    return "gmail" as const;
  }

  if (/----------\s*Forwarded message\s*---------/i.test(rawText) || /^On .+ wrote:$/im.test(rawText)) {
    return "gmail" as const;
  }

  if (/^from:\s.+$/im.test(rawText) && /^sent:\s.+$/im.test(rawText)) {
    return "outlook" as const;
  }

  return null;
}

function extractNativeSourceLink(rawText: string, providedLink: string | null | undefined) {
  const candidate = providedLink?.trim();
  if (candidate) {
    return candidate;
  }

  const matches = rawText.match(/https?:\/\/[^\s)>]+/gi) ?? [];
  for (const match of matches) {
    const normalized = match.replace(/[),.;]+$/, "");
    if (
      normalized.includes("outlook.office.com") ||
      normalized.includes("outlook.live.com") ||
      normalized.includes("mail.google.com")
    ) {
      return normalized;
    }
  }

  return null;
}

function parseForwardedHeaderBlock(rawText: string) {
  const normalized = normalizeWhitespace(rawText);
  const lines = normalized.split("\n");

  const forwardedMarkerIndex = lines.findIndex((line) =>
    /forwarded message|begin forwarded message|original message/i.test(line)
  );

  const searchStart = forwardedMarkerIndex >= 0 ? forwardedMarkerIndex + 1 : 0;
  const headerLines: string[] = [];
  let blankLineIndex = -1;

  for (let index = searchStart; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      blankLineIndex = index;
      if (headerLines.length > 0) {
        break;
      }
      continue;
    }

    if (/^(from|sent|date|subject|to|cc|reply-to|attachments?)\s*:/i.test(line)) {
      headerLines.push(line);
      continue;
    }

    if (headerLines.length > 0) {
      if (/^\s+/.test(line)) {
        headerLines[headerLines.length - 1] = `${headerLines[headerLines.length - 1]} ${line.trim()}`;
        continue;
      }

      blankLineIndex = index - 1;
      break;
    }
  }

  const headers = new Map<string, string>();
  for (const line of headerLines) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    const name = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (!headers.has(name) && value) {
      headers.set(name, value);
    }
  }

  const bodyLines =
    headerLines.length > 0
      ? lines.slice(blankLineIndex >= 0 ? blankLineIndex + 1 : searchStart + headerLines.length)
      : lines;

  return {
    headers,
    bodyText: bodyLines.join("\n").trim()
  };
}

function stripQuotedReplyContent(value: string) {
  const lines = normalizeWhitespace(value).split("\n");
  const kept: string[] = [];

  for (const line of lines) {
    if (/^on .+ wrote:$/i.test(line.trim())) {
      break;
    }

    if (line.trim() === "-----Original Message-----") {
      break;
    }

    if (line.trim().startsWith(">")) {
      continue;
    }

    kept.push(line);
  }

  return kept.join("\n").trim();
}

function extractAttachmentNames(
  attachments: ForwardedEmailAttachment[] | null | undefined,
  headerValue: string | null | undefined
) {
  const names = new Set<string>();

  for (const attachment of attachments ?? []) {
    const filename = attachment.filename?.trim();
    if (filename) {
      names.add(filename);
    }
  }

  if (headerValue) {
    for (const part of headerValue.split(/[,;]+/)) {
      const value = part.trim();
      if (value) {
        names.add(value);
      }
    }
  }

  return [...names];
}

function attachmentCueForNames(attachmentNames: string[], text: string) {
  if (attachmentNames.length === 1) {
    return `Includes attachment: ${attachmentNames[0]}`;
  }

  if (attachmentNames.length > 1) {
    return `Includes ${attachmentNames.length} attachments`;
  }

  if (/\b(pdf|deck|slides|attachment|attached|docx?|xlsx?)\b/i.test(text)) {
    return "Includes document cue";
  }

  return null;
}

function inferRecommendedAction(bodyText: string, attachmentCue: string | null): PriorityInboxRecommendedAction {
  if (/\b(approve|decision|decide|confirm|reply|respond|deadline|today|tomorrow|urgent|need you)\b/i.test(bodyText)) {
    return "create_task";
  }

  if (/\b(follow up|close the loop|owe|promised|committed)\b/i.test(bodyText)) {
    return "add_commitment";
  }

  if (attachmentCue) {
    return "save_reference";
  }

  return "defer";
}

function whySurfacedForContent(bodyText: string, attachmentCue: string | null) {
  if (/\b(approve|decision|decide|confirm|reply|respond|deadline|today|tomorrow|urgent)\b/i.test(bodyText)) {
    return "Forwarded email appears to contain a direct ask, deadline, or reply obligation.";
  }

  if (/\b(follow up|close the loop|promised|committed)\b/i.test(bodyText)) {
    return "Forwarded email appears to carry a follow-up or commitment signal.";
  }

  if (attachmentCue) {
    return "Forwarded email includes attachment or document cues worth triage.";
  }

  return "Forwarded email arrived for Priority Inbox review.";
}

function supportingSignalsForContent(params: {
  providerHint: "outlook" | "gmail" | null;
  attachmentCue: string | null;
  hasNativeLink: boolean;
  recoveredSender: boolean;
  weakStructure: boolean;
}) {
  const signals = ["Forwarded to Blackhawk"];

  if (params.providerHint === "outlook") {
    signals.push("Outlook-style forward");
  } else if (params.providerHint === "gmail") {
    signals.push("Gmail-style forward");
  }

  if (params.recoveredSender) {
    signals.push("Original sender recovered");
  }

  if (params.attachmentCue) {
    signals.push(params.attachmentCue);
  }

  if (params.hasNativeLink) {
    signals.push("Native source link preserved");
  }

  if (params.weakStructure) {
    signals.push("Raw forwarded content retained");
  }

  return signals.slice(0, 4);
}

function buildExternalMessageId(input: {
  rawText: string;
  destinationAddress: string;
  subject: string;
  forwardedAt: string | null;
  originalReceivedAt: string | null;
  originalSenderEmail: string | null;
}) {
  const digest = createHash("sha256")
    .update(
      [
        input.destinationAddress.toLowerCase(),
        input.subject,
        input.forwardedAt ?? "",
        input.originalReceivedAt ?? "",
        input.originalSenderEmail ?? "",
        normalizeWhitespace(input.rawText)
      ].join("\n")
    )
    .digest("hex");

  return `fwd-${digest.slice(0, 24)}`;
}

function buildReferencePrefill(subject: string, snippet: string): PriorityInboxReferencePrefill {
  return {
    title: subject,
    summary: snippet
  };
}

export function parseForwardedEmail(input: ForwardedEmailInboundInput): ParsedForwardedEmail {
  const normalizedRaw = normalizeWhitespace(input.rawText);
  const rawLimited = takeWithLimit(normalizedRaw, FORWARDED_EMAIL_RAW_LIMIT);
  const parsed = parseForwardedHeaderBlock(rawLimited.text);
  const headerFrom = parsed.headers.get("from") ?? firstHeaderValue(input.headers, ["from"]);
  const headerSubject = parsed.headers.get("subject");
  const headerSent = parsed.headers.get("sent") ?? parsed.headers.get("date");
  const headerAttachments = parsed.headers.get("attachments");
  const headerMessageId =
    parsed.headers.get("message-id") ?? firstHeaderValue(input.headers, ["message-id", "x-message-id"]);
  const headerReferences = parsed.headers.get("references") ?? firstHeaderValue(input.headers, ["references"]);
  const fallbackForwardedAt = parseDateValue(
    input.forwardedAt ?? firstHeaderValue(input.headers, ["date", "received"])
  );
  const originalReceivedAt = parseDateValue(headerSent);
  const nativeSourceLink = extractNativeSourceLink(rawLimited.text, input.nativeSourceLink);
  const providerHint = detectProviderHint(rawLimited.text, nativeSourceLink);
  const originalSender = parseMailbox(headerFrom);
  const forwardedBy = {
    name: input.forwardedByName?.trim() || null,
    email: input.forwardedByEmail?.trim() || null
  };
  const cleanedBody = stripQuotedReplyContent(parsed.bodyText || rawLimited.text);
  const bodyLimited = takeWithLimit(cleanedBody || rawLimited.text, FORWARDED_EMAIL_BODY_LIMIT);
  const snippet = takeWithLimit(compactText(bodyLimited.text), FORWARDED_EMAIL_SNIPPET_LIMIT).text || "Forwarded email body retained for review.";
  const attachmentNames = extractAttachmentNames(input.attachments, headerAttachments);
  const attachmentCue = attachmentCueForNames(attachmentNames, `${bodyLimited.text}\n${headerAttachments ?? ""}`);
  const subject =
    stripForwardPrefix(headerSubject) ||
    stripForwardPrefix(input.subject) ||
    "Untitled forwarded email";
  const sender = originalSender.name ?? originalSender.email ?? forwardedBy.name ?? forwardedBy.email ?? "Unknown sender";
  const senderRole = originalSender.email ?? null;
  const weakStructure = !originalSender.email || !headerSubject || !parsed.bodyText;
  const recommendedAction = inferRecommendedAction(bodyLimited.text, attachmentCue);
  const whySurfaced = whySurfacedForContent(bodyLimited.text, attachmentCue);
  const supportingSignals = supportingSignalsForContent({
    providerHint,
    attachmentCue,
    hasNativeLink: Boolean(nativeSourceLink),
    recoveredSender: Boolean(originalSender.email || originalSender.name),
    weakStructure
  });
  const effectiveReceivedAt = originalReceivedAt ?? fallbackForwardedAt;
  const primaryLine = `Review forwarded email "${subject}" from ${sender}.`;
  const associatedWith = `${sender} · Forwarded email`;

  const canonicalCommitment: PriorityInboxCanonicalCommitmentInput = {
    statement: `Close the loop on "${subject}".`,
    owedTo: sender,
    dueAt: effectiveReceivedAt,
    dueLabel: effectiveReceivedAt ? "Based on forwarded timing" : null,
    contextNote: snippet
  };

  const externalMessageId = headerMessageId
    ? `fwd-${createHash("sha256").update(headerMessageId).digest("hex").slice(0, 24)}`
    : buildExternalMessageId({
        rawText: rawLimited.text,
        destinationAddress: input.destinationAddress,
        subject,
        forwardedAt: fallbackForwardedAt,
        originalReceivedAt,
        originalSenderEmail: originalSender.email
      });

  return {
    externalMessageId,
    conversationId: headerReferences ? createHash("sha256").update(headerReferences).digest("hex").slice(0, 24) : null,
    sender,
    senderRole,
    subject,
    primaryLine,
    snippet,
    receivedAt: effectiveReceivedAt,
    whySurfaced,
    supportingSignals,
    recommendedAction,
    attachmentCue,
    taskPrefill: {
      description: `Review forwarded email: ${subject}`,
      nextStep: snippet,
      desiredOutcome: "Turn the forwarded thread into a clear next move.",
      priority: recommendedAction === "create_task" ? "high" : attachmentCue ? "medium" : "low",
      categoryName: attachmentCue ? "Agenda" : "Waiting For",
      associatedWith
    },
    commitmentPrefill: {
      statement: canonicalCommitment.statement,
      owedTo: sender,
      dueLabel: effectiveReceivedAt ? "Soon" : "No date yet",
      contextNote: snippet,
      associatedWith
    },
    canonicalCommitment,
    referencePrefill: buildReferencePrefill(subject, snippet),
    sourceLink: nativeSourceLink,
    sourceMetadata: {
      ingestionMode: "forwarded",
      providerHint,
      forwardedByName: forwardedBy.name,
      forwardedByEmail: forwardedBy.email,
      originalSenderName: originalSender.name,
      originalSenderEmail: originalSender.email,
      originalReceivedAt,
      forwardedAt: fallbackForwardedAt,
      attachmentNames,
      rawContentTruncated: rawLimited.truncated,
      weakStructure,
      parsedHeaders: {
        from: headerFrom ?? null,
        subject: headerSubject ?? null,
        sent: headerSent ?? null,
        attachments: headerAttachments ?? null
      }
    },
    rawContent: rawLimited.text,
    detailBody: bodyLimited.text,
    forwardedByName: forwardedBy.name,
    forwardedByEmail: forwardedBy.email,
    originalSenderName: originalSender.name,
    originalSenderEmail: originalSender.email,
    originalReceivedAt,
    forwardedAt: fallbackForwardedAt,
    providerHint,
    parsedHeaders: {
      from: headerFrom ?? null,
      subject: headerSubject ?? null,
      sent: headerSent ?? null,
      attachments: headerAttachments ?? null
    },
    attachmentNames,
    rawContentTruncated: rawLimited.truncated
  };
}

export const forwardedEmailFixtures: Record<string, ForwardedEmailInboundInput> = {
  parsable_sender_subject_body: {
    destinationAddress: "priority@blackhawk.test",
    subject: "Fwd: Board packet scope changed after hiring-brief revision",
    forwardedByName: "Will O'Donnell",
    forwardedByEmail: "will@example.com",
    forwardedAt: "2026-04-28T09:42:00-07:00",
    rawText: `From: Amelia Hart <amelia@exec.example>
Sent: Tuesday, April 28, 2026 8:58 AM
To: Will O'Donnell <will@example.com>
Subject: Board packet scope changed after hiring-brief revision

Can you confirm today whether the board packet should follow the narrowed hiring brief?

Finance has the numbers aligned, but the narrative still assumes the broader role. A short decision today should unblock the rest of the thread.`,
    nativeSourceLink: "https://outlook.office.com/mail/deeplink/read/example"
  },
  weak_ambiguous_structure: {
    destinationAddress: "priority@blackhawk.test",
    subject: "Fwd: Quick thought",
    forwardedByName: "Will O'Donnell",
    forwardedByEmail: "will@example.com",
    forwardedAt: "2026-04-28T10:15:00-07:00",
    rawText: `FYI below.

Need to think about whether this actually matters this week.

---------- Forwarded message ---------
Quick thought from Mina. Maybe follow up later if it keeps coming up.`
  },
  attachment_document_cues: {
    destinationAddress: "priority@blackhawk.test",
    subject: "Fwd: Updated launch checklist and deck",
    forwardedByName: "Will O'Donnell",
    forwardedByEmail: "will@example.com",
    forwardedAt: "2026-04-28T11:10:00-07:00",
    rawText: `---------- Forwarded message ---------
From: Priya Shah <priya@customer.example>
Date: Tue, Apr 28, 2026 at 10:31 AM
Subject: Updated launch checklist and deck
Attachments: northstar-launch-checklist.xlsx, launch-deck.pdf

Sharing the latest checklist and deck before tomorrow's launch call. Nothing urgent right now, but the files should stay easy to retrieve.`,
    attachments: [
      {
        filename: "northstar-launch-checklist.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      },
      {
        filename: "launch-deck.pdf",
        contentType: "application/pdf"
      }
    ]
  }
};
