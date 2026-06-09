import type { JsonValue, MeetingRecordStatusSummary } from "@/lib/meetings/meeting-records";

type JsonRecord = Record<string, JsonValue>;

function compactText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function asRecord(value: JsonValue | null | undefined): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function asArray(value: JsonValue | null | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function textField(record: JsonRecord | null, key: string) {
  return compactText(typeof record?.[key] === "string" ? record[key] : null) || null;
}

function humanizeSourceType(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .replace("Web News", "Web/news");
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles"
  }).format(parsed);
}

function summaryItemText(value: JsonValue, primaryKey: string, secondaryKey: string) {
  const record = asRecord(value);
  if (!record) {
    return typeof value === "string" ? compactText(value) : null;
  }

  const primary = textField(record, primaryKey);
  const secondary = textField(record, secondaryKey);
  return [primary, secondary].filter(Boolean).join(": ") || null;
}

function linkText(value: JsonValue) {
  const record = asRecord(value);
  if (!record) {
    return typeof value === "string" ? compactText(value) : null;
  }

  const label = textField(record, "label") ?? textField(record, "title") ?? textField(record, "url");
  const url = textField(record, "url");
  if (label && url && label !== url) {
    return `${label} (${url})`;
  }

  return label ?? url;
}

function coverageRows(summary: JsonRecord | null) {
  return asArray(summary?.sourceCoverage)
    .map((value) => {
      const record = asRecord(value);
      const sourceType = textField(record, "sourceType");
      if (!record || !sourceType) {
        return null;
      }

      const used = record.used === true;
      const itemCount = typeof record.itemCount === "number" ? record.itemCount : 0;
      const reason = textField(record, "internalOnlyReason");

      return {
        sourceType,
        label: humanizeSourceType(sourceType),
        used,
        itemCount,
        reason
      };
    })
    .filter((value): value is { sourceType: string; label: string; used: boolean; itemCount: number; reason: string | null } =>
      Boolean(value)
    );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((item) => (
        <li key={item} className="text-xs leading-5 text-text-muted">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function MeetingResearchSummaryPanel({ status }: { status: MeetingRecordStatusSummary | null }) {
  if (!status || (status.researchStatus !== "researched" && status.researchStatus !== "failed")) {
    return null;
  }

  const summary = asRecord(status.researchSummary);
  const completedAt = formatTimestamp(status.researchCompletedAt);
  const highLevelContext = textField(summary, "highLevelContext");
  const situationRead = asRecord(summary?.situationRead);
  const situationSummary = textField(situationRead, "summary");
  const error = textField(summary, "error");
  const priorities = asArray(summary?.keyPriorities)
    .map((value) => summaryItemText(value, "title", "reason"))
    .filter((value): value is string => Boolean(value));
  const questions = asArray(summary?.suggestedQuestions)
    .map((value) => summaryItemText(value, "question", "reason"))
    .filter((value): value is string => Boolean(value));
  const activity = asArray(summary?.recentRelevantActivity)
    .map((value) => summaryItemText(value, "title", "summary"))
    .filter((value): value is string => Boolean(value));
  const links = asArray(summary?.relevantLinks)
    .map(linkText)
    .filter((value): value is string => Boolean(value));
  const coverage = coverageRows(summary);
  const usedCoverage = coverage
    .filter((entry) => entry.used)
    .map((entry) => `${entry.label}${entry.itemCount > 0 ? ` (${entry.itemCount})` : ""}`);
  const unavailableCoverage = coverage
    .filter((entry) => !entry.used && entry.reason)
    .map((entry) => `${entry.label}: ${entry.reason}`);

  return (
    <section className="mt-4 rounded-[1rem] border border-line/65 bg-white/56 px-3 py-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[0.68rem] uppercase tracking-[0.18em] text-text-subtle">Research Context</p>
        <p className="text-[0.68rem] uppercase tracking-[0.14em] text-text-subtle">
          {status.researchStatus}
          {completedAt ? ` · ${completedAt}` : ""}
        </p>
      </div>

      {error ? (
        <p className="mt-2 text-xs leading-5 text-[rgb(125,35,31)]">Research failed cleanly: {error}.</p>
      ) : null}
      {highLevelContext ? <p className="mt-2 text-sm leading-6 text-text-muted">{highLevelContext}</p> : null}
      {situationSummary ? (
        <div className="mt-3">
          <p className="text-[0.62rem] uppercase tracking-[0.16em] text-text-subtle">Situation Read</p>
          <p className="mt-1 text-xs leading-5 text-text-muted">{situationSummary}</p>
        </div>
      ) : null}
      {activity.length > 0 ? (
        <div className="mt-3">
          <p className="text-[0.62rem] uppercase tracking-[0.16em] text-text-subtle">Recent Activity</p>
          <BulletList items={activity} />
        </div>
      ) : null}
      {priorities.length > 0 ? (
        <div className="mt-3">
          <p className="text-[0.62rem] uppercase tracking-[0.16em] text-text-subtle">Key Priorities</p>
          <BulletList items={priorities} />
        </div>
      ) : null}
      {questions.length > 0 ? (
        <div className="mt-3">
          <p className="text-[0.62rem] uppercase tracking-[0.16em] text-text-subtle">Suggested Questions</p>
          <BulletList items={questions} />
        </div>
      ) : null}
      {links.length > 0 ? (
        <div className="mt-3">
          <p className="text-[0.62rem] uppercase tracking-[0.16em] text-text-subtle">Relevant Links</p>
          <BulletList items={links} />
        </div>
      ) : null}
      {usedCoverage.length > 0 || unavailableCoverage.length > 0 ? (
        <div className="mt-3 rounded-[0.85rem] border border-line/50 bg-white/50 px-3 py-2">
          {usedCoverage.length > 0 ? (
            <p className="text-xs leading-5 text-text-muted">Used sources: {usedCoverage.join(", ")}.</p>
          ) : null}
          {unavailableCoverage.length > 0 ? (
            <p className="mt-1 text-xs leading-5 text-text-subtle">
              Unavailable adapters: {unavailableCoverage.join(" ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
