import { createTaskFromBriefCandidateAction, requestExecutiveBriefRefreshAction } from "@/app/brief/actions";
import type { StructuredExecutiveBriefItem } from "@/lib/brief/executive-brief-snapshots";
import type { ExecutiveBriefPageData, ExecutiveBriefSlot } from "@/lib/brief/load-executive-brief-page-data";

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "Waiting";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Waiting";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles"
  }).format(parsed);
}

function BriefSlotCard({ slot }: { slot: ExecutiveBriefSlot }) {
  const snapshot = slot.snapshot;

  return (
    <div className="rounded-[1rem] border border-line/70 bg-white/62 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.62rem] uppercase tracking-[0.2em] text-text-subtle">Slot</p>
          <h3 className="mt-1 text-sm font-semibold tracking-[-0.01em] text-text">{slot.label}</h3>
        </div>
        <span className="rounded-full border border-line/70 bg-white/76 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.14em] text-text-subtle">
          {slot.status === "processed" ? "Processed" : "Waiting"}
        </span>
      </div>
      <p className="mt-3 text-xs font-medium text-text">{snapshot?.displayDate ?? `${slot.itemCount} brief snapshots`}</p>
      <p className="mt-1 text-xs text-text-subtle">{formatTimestamp(slot.processedAt)}</p>
      {snapshot ? (
        <p className="mt-2 line-clamp-1 text-xs leading-5 text-text-muted">{snapshot.subject}</p>
      ) : null}
    </div>
  );
}

function sanitizeFlashMessage(value?: string) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/-/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function StructuredItemCard({ item, taskCandidate = false }: { item: StructuredExecutiveBriefItem; taskCandidate?: boolean }) {
  return (
    <article className="rounded-[1.15rem] border border-line/70 bg-white/66 px-4 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold leading-5 text-text">{item.title}</h4>
          {item.summary ? <p className="mt-2 text-sm leading-6 text-text-muted">{item.summary}</p> : null}
        </div>
        {item.priority ? (
          <span className="w-fit rounded-full border border-line/70 bg-white/76 px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.16em] text-text-subtle">
            {item.priority}
          </span>
        ) : null}
      </div>

      {item.recommendedAction ? (
        <p className="mt-3 rounded-[0.9rem] bg-[rgba(248,246,240,0.9)] px-3 py-2 text-xs leading-5 text-text-muted">
          Action: {item.recommendedAction}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 text-[0.68rem] uppercase tracking-[0.16em] text-text-subtle">
        {item.source ? <span>{item.source}</span> : null}
        {item.dueAt ? <span>Due {formatTimestamp(item.dueAt)}</span> : null}
      </div>

      {taskCandidate ? (
        <form action={createTaskFromBriefCandidateAction} className="mt-4">
          <input type="hidden" name="description" value={item.title} />
          <input type="hidden" name="nextStep" value={item.recommendedAction ?? ""} />
          <input type="hidden" name="desiredOutcome" value={item.summary ?? ""} />
          <input type="hidden" name="priority" value={item.priority ?? "medium"} />
          <input type="hidden" name="source" value={item.source ?? "Executive Brief"} />
          <input type="hidden" name="dueAt" value={item.dueAt ?? ""} />
          <button
            type="submit"
            className="rounded-full border border-line/75 bg-white/84 px-3.5 py-2 text-sm font-medium text-text transition hover:bg-white"
          >
            Create task
          </button>
        </form>
      ) : null}
    </article>
  );
}

function StructuredSection({
  title,
  eyebrow,
  items,
  taskCandidate = false
}: {
  title: string;
  eyebrow: string;
  items: StructuredExecutiveBriefItem[];
  taskCandidate?: boolean;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div>
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">{eyebrow}</p>
        <h3 className="mt-1 text-[1rem] font-semibold tracking-[-0.01em] text-text">{title}</h3>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <StructuredItemCard key={item.id} item={item} taskCandidate={taskCandidate} />
        ))}
      </div>
    </section>
  );
}

export function ExecutiveBriefWorkspace({
  data,
  notice,
  error
}: {
  data: ExecutiveBriefPageData;
  notice?: string;
  error?: string;
}) {
  const latest = data.latestSnapshot;
  const structuredBrief = latest?.structuredBrief ?? null;
  const successMessage = sanitizeFlashMessage(notice);
  const errorMessage = sanitizeFlashMessage(error);

  return (
    <div className="space-y-6">
      {(successMessage || errorMessage) ? (
        <section
          className={`rounded-[1.35rem] border px-4 py-3 text-sm ${
            errorMessage
              ? "border-[rgba(125,35,31,0.18)] bg-[rgba(125,35,31,0.08)] text-[rgb(125,35,31)]"
              : "border-[rgba(36,92,62,0.18)] bg-[rgba(36,92,62,0.08)] text-[rgb(36,92,62)]"
          }`}
        >
          {errorMessage ?? successMessage}
        </section>
      ) : null}

      {latest ? (
        <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Latest processed snapshot</p>
              <h3 className="mt-2 text-[1.2rem] font-semibold leading-snug tracking-[-0.01em] text-text md:text-[1.35rem]">
                {latest.displayDate ?? latest.subject}
              </h3>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                Processed {formatTimestamp(latest.generatedAt ?? latest.createdAt)} from CloudMailIn.
              </p>
            </div>
            <span className="w-fit rounded-full border border-line/70 bg-white/76 px-3 py-1 text-[0.72rem] uppercase tracking-[0.16em] text-text-subtle">
              {latest.slot}
            </span>
          </div>

          {structuredBrief ? (
            <div className="mt-5 space-y-6">
              {latest.humanBrief ? (
                <section className="rounded-[1.25rem] border border-line/70 bg-white/66 px-4 py-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Summary</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-muted">{latest.humanBrief}</p>
                </section>
              ) : null}

              {structuredBrief.commandSummary.length > 0 ? (
                <section className="rounded-[1.25rem] border border-line/70 bg-white/66 px-4 py-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Command summary</p>
                  <ul className="mt-3 space-y-2">
                    {structuredBrief.commandSummary.map((summary) => (
                      <li key={summary} className="text-sm leading-6 text-text-muted">
                        {summary}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <StructuredSection eyebrow="Top 3" title="Executive moves" items={structuredBrief.topMoves} />
              <StructuredSection eyebrow="Decisions" title="Needs Will" items={structuredBrief.decisionsNeeded} />
              <StructuredSection eyebrow="Calendar" title="Meeting prep" items={structuredBrief.meetingPrep} />
              <StructuredSection eyebrow="Memory" title="Carry forward" items={structuredBrief.carryForward} />
              <StructuredSection
                eyebrow="Tasks"
                title="Task candidates"
                items={structuredBrief.taskCandidates}
                taskCandidate
              />
            </div>
          ) : (
            <div className="mt-5 rounded-[1.25rem] border border-line/70 bg-white/66 px-4 py-4">
              <p className="text-sm font-medium text-text">{latest.subject}</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-muted">
                {latest.humanBrief ?? "No human-readable brief section was found in this bundle."}
              </p>
            </div>
          )}

          {latest.validationWarnings.length > 0 ? (
            <div className="mt-4 rounded-[1.1rem] border border-[rgba(170,102,31,0.35)] bg-[rgba(255,250,236,0.82)] px-4 py-3">
              <p className="text-sm leading-6 text-text-muted">{latest.validationWarnings.join(" ")}</p>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="rounded-[1.75rem] border border-dashed border-line/80 bg-white/60 px-5 py-12 text-center md:px-8">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Empty state</p>
          <h3 className="mx-auto mt-3 max-w-2xl text-[1.35rem] font-semibold leading-snug tracking-[-0.02em] text-text">
            {data.emptyState.title}
          </h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-text-muted">{data.emptyState.detail}</p>
        </section>
      )}

      <details className="rounded-[1.25rem] border border-line/70 bg-white/58 px-4 py-4">
        <summary className="cursor-pointer list-none">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Agent-email intake</p>
              <h3 className="mt-1 text-sm font-semibold tracking-[-0.01em] text-text">
                Blackhawk Executive Brief surface
              </h3>
            </div>
            <span className="w-fit rounded-full border border-line/70 bg-white/76 px-3 py-1 text-[0.68rem] uppercase tracking-[0.16em] text-text-subtle">
              Expand status
            </span>
          </div>
        </summary>

        <div className="mt-4 border-t border-line/60 pt-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <p className="max-w-3xl text-sm leading-6 text-text-muted">
              This compact status area tracks processed CloudMailIn brief slots and manual refreshes. The primary page
              content above stays focused on the latest actionable Executive Brief.
            </p>
            <form action={requestExecutiveBriefRefreshAction}>
              <button
                type="submit"
                className="rounded-full border border-line/85 bg-[rgb(var(--color-shell))] px-4 py-2 text-sm font-medium text-white transition hover:bg-[rgb(var(--color-shell))]"
              >
                Run Agent Refresh
              </button>
            </form>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-7">
            {data.slots.map((slot) => (
              <BriefSlotCard key={slot.label} slot={slot} />
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
