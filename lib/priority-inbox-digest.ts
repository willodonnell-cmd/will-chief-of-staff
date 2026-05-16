import {
  getResolvedVisibleState,
  isDeferredDue,
  matchesPriorityInboxSourceFilter,
  type PriorityInboxItem,
  type PriorityInboxSourceFilter
} from "@/lib/priority-inbox";

/** Matches Executive Priority Brief `---COS_DIGEST_JSON---` appendix (`schema_version` 1). */
export const PRIORITY_INBOX_DIGEST_SCHEMA_VERSION = 1 as const;
export const PRIORITY_INBOX_DIGEST_TIMEZONE = "America/Los_Angeles" as const;
export const PRIORITY_INBOX_DIGEST_JSON_DELIMITER = "---COS_DIGEST_JSON---" as const;

export type DigestJsonLane = "priority" | "watch";

export type DigestJsonClassification =
  | "explicit_ask"
  | "implied_follow_up"
  | "strategic_fyi"
  | "decision_needed"
  | "people_waiting"
  | "delegation_candidate"
  | "ignore_noise";

export type PriorityInboxDigestJsonItem = {
  rank: number;
  lane: DigestJsonLane;
  title: string;
  ask: string;
  why_it_matters: string;
  action: string;
  classification: DigestJsonClassification;
  source: "outlook" | "teams";
  item_id: string | null;
  thread_id: string | null;
  sender: string | null;
  subject_or_context: string | null;
  received_at: string | null;
  tier_guess: "1" | "2" | "3" | "unknown";
  confidence: number;
  why_surfaced: string;
  owner_next_step: "Will" | "delegate" | "unknown";
  link_or_path: string | null;
};

export type PriorityInboxDigestPayload = {
  schema_version: typeof PRIORITY_INBOX_DIGEST_SCHEMA_VERSION;
  timezone: typeof PRIORITY_INBOX_DIGEST_TIMEZONE;
  window: { label: string; start: string; end: string };
  assumption: string | null;
  priorities: string[];
  watch: string[];
  suppressed_summary: string;
  items: PriorityInboxDigestJsonItem[];
};

function sourceForDigest(item: PriorityInboxItem): "outlook" | "teams" {
  if (item.source === "teams") return "teams";
  return "outlook";
}

function classificationForDigest(item: PriorityInboxItem): DigestJsonClassification {
  switch (item.recommendedAction) {
    case "create_task":
    case "add_commitment":
      return "explicit_ask";
    case "defer":
      return "implied_follow_up";
    case "save_reference":
      return "strategic_fyi";
    case "mark_handled":
      return "ignore_noise";
    default:
      return "decision_needed";
  }
}

function laneForDigest(item: PriorityInboxItem, now: number): DigestJsonLane {
  const resolved = getResolvedVisibleState(item, now);
  if (resolved === "high_priority") return "priority";
  if (resolved === "needs_review") return "watch";
  if (item.visibleState === "deferred" && isDeferredDue(item, now)) return "priority";
  return "watch";
}

function actionLine(item: PriorityInboxItem): string {
  switch (item.recommendedAction) {
    case "create_task":
      return "Recommended: create task from this thread.";
    case "add_commitment":
      return "Recommended: add commitment / open loop.";
    case "save_reference":
      return "Recommended: save reference.";
    case "mark_handled":
      return "Recommended: mark handled.";
    case "defer":
      return "Recommended: defer to a calmer time.";
    default:
      return "Review routing in Priority Inbox.";
  }
}

function formatPacificWindowLabel(startMs: number, endMs: number): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: PRIORITY_INBOX_DIGEST_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short"
  });
  return `${fmt.format(new Date(startMs))} – ${fmt.format(new Date(endMs))} Pacific`;
}

/** Active-layer items: High Priority, Needs Review, and deferred items that are due back. */
export function selectPriorityInboxDigestItems(
  items: PriorityInboxItem[],
  sourceFilter: PriorityInboxSourceFilter,
  now: number
): PriorityInboxItem[] {
  const filtered = items.filter((item) => matchesPriorityInboxSourceFilter(item, sourceFilter));
  return filtered.filter((item) => {
    const resolved = getResolvedVisibleState(item, now);
    if (resolved === "high_priority" || resolved === "needs_review") return true;
    return item.visibleState === "deferred" && isDeferredDue(item, now);
  });
}

function sortDigestItems(items: PriorityInboxItem[], now: number): PriorityInboxItem[] {
  const rank = (item: PriorityInboxItem) => {
    const r = getResolvedVisibleState(item, now);
    if (r === "high_priority") return 0;
    if (item.visibleState === "deferred" && isDeferredDue(item, now)) return 1;
    return 2;
  };
  return [...items].sort((a, b) => {
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    const ta = a.receivedAt ? Date.parse(a.receivedAt) : 0;
    const tb = b.receivedAt ? Date.parse(b.receivedAt) : 0;
    return tb - ta;
  });
}

export function buildPriorityInboxDigestPayload(
  items: PriorityInboxItem[],
  now: number
): PriorityInboxDigestPayload {
  const endMs = now;
  const startMs = endMs - 24 * 60 * 60 * 1000;
  const sorted = sortDigestItems(items, now);

  const jsonItems: PriorityInboxDigestJsonItem[] = sorted.map((item, index) => {
    const lane = laneForDigest(item, now);
    const title = item.threadTitle?.trim() || item.primaryLine?.trim() || "Untitled thread";
    return {
      rank: index + 1,
      lane,
      title,
      ask: item.primaryLine ?? "",
      why_it_matters: item.summary?.trim() ? item.summary.slice(0, 500) : item.whySurfaced,
      action: actionLine(item),
      classification: classificationForDigest(item),
      source: sourceForDigest(item),
      item_id: item.id,
      thread_id: item.conversationId ?? item.externalMessageId ?? null,
      sender: item.sender ?? null,
      subject_or_context: item.threadTitle ?? null,
      received_at: item.receivedAt ?? null,
      tier_guess: "unknown",
      confidence: 0.55,
      why_surfaced: item.whySurfaced,
      owner_next_step: "Will",
      link_or_path: item.sourceLink
    };
  });

  const priorities = jsonItems.filter((j) => j.lane === "priority").map((j) => j.title);
  const watch = jsonItems.filter((j) => j.lane === "watch").map((j) => j.title);

  return {
    schema_version: PRIORITY_INBOX_DIGEST_SCHEMA_VERSION,
    timezone: PRIORITY_INBOX_DIGEST_TIMEZONE,
    window: {
      label: formatPacificWindowLabel(startMs, endMs),
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString()
    },
    assumption:
      "Snapshot export from Blackhawk Priority Inbox; not tied to a prior Executive Priority Brief run.",
    priorities,
    watch,
    suppressed_summary:
      "Excluded handled, dismissed, and deferred items not yet due. Export respects the current source filter (All / Email / Teams).",
    items: jsonItems
  };
}

export function buildPriorityInboxDigestMarkdownHuman(payload: PriorityInboxDigestPayload): string {
  const lines: string[] = [
    "# Blackhawk Priority Inbox digest (export)",
    "",
    `**Timezone:** ${payload.timezone}`,
    `**Window:** ${payload.window.label}`,
    `**Window (ISO):** ${payload.window.start} → ${payload.window.end}`,
    ""
  ];
  if (payload.assumption) {
    lines.push(`**Assumption:** ${payload.assumption}`, "");
  }
  lines.push(
    "## Context",
    "This bundle is **input context** for the Executive Priority Brief skill (or any triage workflow). It lists the current **active layer** of Priority Inbox as shown in Blackhawk, not a full mailbox dump.",
    "",
    "## Items",
    ""
  );

  for (const row of payload.items) {
    lines.push(
      `### ${row.rank}. [${row.lane}] ${row.title}`,
      `- **Source:** ${row.source} · ${row.sender ?? "Unknown sender"}`,
      `- **Time:** ${row.received_at ?? "unknown"}`,
      `- **Ask / primary line:** ${row.ask}`,
      `- **Why surfaced:** ${row.why_surfaced}`,
      `- **Summary:** ${row.why_it_matters}`,
      `- **Suggested action:** ${row.action}`
    );
    if (row.link_or_path) {
      lines.push(`- **Link:** ${row.link_or_path}`);
    }
    lines.push(`- **CoS item id:** \`${row.item_id}\``, "");
  }

  lines.push("## Suppressed / not included", "", payload.suppressed_summary, "");

  return lines.join("\n");
}

/** Full document: Markdown body + machine appendix for ChatGPT / paste-back. */
export function buildPriorityInboxDigestDocument(items: PriorityInboxItem[], now: number): string {
  const payload = buildPriorityInboxDigestPayload(items, now);
  const human = buildPriorityInboxDigestMarkdownHuman(payload);
  const json = JSON.stringify(payload, null, 2);
  return `${human.trimEnd()}\n\n${PRIORITY_INBOX_DIGEST_JSON_DELIMITER}\n${json}\n`;
}

export function priorityInboxDigestFilename(nowMs: number): string {
  const d = new Date(nowMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `priority-inbox-digest-${y}${m}${day}-${h}${min}z.md`;
}
