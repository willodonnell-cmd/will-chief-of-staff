import type { OutlookMessage, OutlookParticipant } from "@/lib/microsoft/outlook-mail";
import type { WorkSignal, WorkSignalParticipant, WorkSignalUrgency } from "@/lib/work-signals/types";

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "hotmail.com",
  "icloud.com",
  "me.com",
  "msn.com",
  "outlook.com",
  "live.com",
  "yahoo.com"
]);

function compactWhitespace(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function toParticipant(participant: OutlookParticipant): WorkSignalParticipant | null {
  const name = compactWhitespace(participant?.emailAddress?.name);
  const email = compactWhitespace(participant?.emailAddress?.address).toLowerCase();

  if (!name && !email) {
    return null;
  }

  return {
    name: name || email || "Unknown participant",
    email: email || null
  };
}

function dedupeParticipants(participants: WorkSignalParticipant[]) {
  const seen = new Set<string>();
  const deduped: WorkSignalParticipant[] = [];

  for (const participant of participants) {
    const key = participant.email || participant.name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(participant);
  }

  return deduped;
}

function extractParticipants(message: OutlookMessage) {
  return dedupeParticipants(
    [
      toParticipant(message.from ?? null),
      ...(message.toRecipients ?? []).map((participant) => toParticipant(participant)),
      ...(message.ccRecipients ?? []).map((participant) => toParticipant(participant))
    ].filter((participant): participant is WorkSignalParticipant => Boolean(participant))
  );
}

function titleCaseToken(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function extractCompanies(participants: WorkSignalParticipant[]) {
  const companies = new Set<string>();

  for (const participant of participants) {
    const domain = participant.email?.split("@")[1]?.toLowerCase();
    if (!domain || PERSONAL_EMAIL_DOMAINS.has(domain)) {
      continue;
    }

    const organization = domain.split(".")[0];
    if (organization) {
      companies.add(titleCaseToken(organization));
    }
  }

  return [...companies];
}

function extractBracketTags(subject: string) {
  return [...subject.matchAll(/\[([^[\]]{2,40})\]/g)].map((match) => compactWhitespace(match[1]));
}

function extractProjects(subject: string, summary: string) {
  const projectTokens = new Set<string>();

  for (const token of [...extractBracketTags(subject), ...extractBracketTags(summary)]) {
    projectTokens.add(token);
  }

  for (const match of `${subject} ${summary}`.matchAll(/#([a-z0-9][a-z0-9-_]{1,30})/gi)) {
    projectTokens.add(match[1] ?? "");
  }

  return [...projectTokens].filter(Boolean);
}

function extractActions(subject: string, summary: string) {
  const haystack = `${subject}. ${summary}`;
  const matches = [
    ...haystack.matchAll(/\b(?:please|can you|could you|need you to)\s+([^.!?;]+)/gi),
    ...haystack.matchAll(/\bfollow up on\s+([^.!?;]+)/gi),
    ...haystack.matchAll(/\blet me know\s+([^.!?;]+)/gi)
  ];

  return [...new Set(matches.map((match) => compactWhitespace(match[1])).filter(Boolean))];
}

function extractDecisions(subject: string, summary: string) {
  const haystack = `${subject}. ${summary}`;
  const matches = [
    ...haystack.matchAll(/\b(?:decided|decision|approved|agreed|confirmed)\b([^.!?;]*)/gi)
  ];

  return [...new Set(matches.map((match) => compactWhitespace(`${match[0]}`)).filter(Boolean))];
}

function extractDueDate(subject: string, summary: string) {
  const match = `${subject} ${summary}`.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return match?.[1] ?? null;
}

function inferUrgency(message: OutlookMessage, extractedActions: string[], dueDate: string | null): WorkSignalUrgency {
  if (message.importance === "high" || message.flag?.flagStatus === "flagged") {
    return "high";
  }

  if (extractedActions.length > 0 || dueDate || message.isRead === false) {
    return "medium";
  }

  return "low";
}

function inferTopicTags(message: OutlookMessage, projects: string[]) {
  const tags = new Set<string>(message.categories?.filter(Boolean) ?? []);

  if (message.inferenceClassification === "focused") {
    tags.add("focused-inbox");
  }

  if (message.hasAttachments) {
    tags.add("attachment");
  }

  for (const project of projects) {
    tags.add(project);
  }

  return [...tags];
}

function inferConfidence(message: OutlookMessage, participants: WorkSignalParticipant[], extractedActions: string[]) {
  let confidence = 0.45;

  if (message.subject?.trim()) {
    confidence += 0.15;
  }

  if (message.bodyPreview?.trim()) {
    confidence += 0.15;
  }

  if (message.receivedDateTime) {
    confidence += 0.1;
  }

  if (participants.length > 0) {
    confidence += 0.1;
  }

  if (extractedActions.length > 0) {
    confidence += 0.05;
  }

  return Math.min(0.95, Number(confidence.toFixed(2)));
}

export function normalizeOutlookMessageToWorkSignal(message: OutlookMessage): WorkSignal {
  const title = compactWhitespace(message.subject) || "Untitled Outlook thread";
  const bodyOrSummary = compactWhitespace(message.bodyPreview) || "Open in Outlook to review the message body.";
  const participants = extractParticipants(message);
  const sender = toParticipant(message.from ?? null);
  const companies = extractCompanies(participants);
  const projects = extractProjects(title, bodyOrSummary);
  const extractedActions = extractActions(title, bodyOrSummary);
  const extractedDecisions = extractDecisions(title, bodyOrSummary);
  const dueDate = extractDueDate(title, bodyOrSummary);
  const topicTags = inferTopicTags(message, projects);
  const followUpRequired =
    extractedActions.length > 0 || message.flag?.flagStatus === "flagged" || message.isRead === false;

  return {
    id: `outlook:${message.id}`,
    source: "outlook",
    sourceId: message.id,
    sourceUrl: compactWhitespace(message.webLink) || null,
    title,
    bodyOrSummary,
    senderOrOwner: sender?.name ?? "Unknown sender",
    recipientsOrParticipants: participants,
    timestamp: message.receivedDateTime?.trim() || null,
    importance: message.importance ?? "normal",
    urgency: inferUrgency(message, extractedActions, dueDate),
    topicTags,
    people: participants,
    companies,
    projects,
    extractedActions,
    extractedDecisions,
    followUpRequired,
    dueDate,
    confidence: inferConfidence(message, participants, extractedActions),
    rawMetadata: {
      conversationId: message.conversationId ?? null,
      internetMessageId: message.internetMessageId ?? null,
      outlook: {
        inferenceClassification: message.inferenceClassification ?? null,
        isRead: message.isRead ?? null,
        hasAttachments: message.hasAttachments ?? false,
        lastModifiedDateTime: message.lastModifiedDateTime ?? null,
        flagStatus: message.flag?.flagStatus ?? null,
        categories: message.categories ?? []
      }
    }
  };
}

