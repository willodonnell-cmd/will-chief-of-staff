import { requestExecutiveBriefRefreshAction } from "@/app/brief/actions";
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
    <div className="rounded-[1.2rem] border border-line/70 bg-white/72 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Slot</p>
          <h3 className="mt-2 text-lg font-semibold tracking-[-0.01em] text-text">{slot.label}</h3>
        </div>
        <span className="rounded-full border border-line/70 bg-white/76 px-3 py-1 text-[0.68rem] uppercase tracking-[0.16em] text-text-subtle">
          {slot.status === "processed" ? "Processed" : "Waiting"}
        </span>
      </div>
      <p className="mt-4 text-sm font-medium text-text">{snapshot?.displayDate ?? `${slot.itemCount} brief snapshots`}</p>
      <p className="mt-1 text-xs text-text-subtle">{formatTimestamp(slot.processedAt)}</p>
      {snapshot ? (
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-text-muted">{snapshot.subject}</p>
      ) : null}
    </div>
  );
}

export function ExecutiveBriefWorkspace({ data }: { data: ExecutiveBriefPageData }) {
  return (
    <div className="space-y-6">
      <section className="rounded-[1.55rem] border border-line/75 bg-white/74 p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Agent-email intake</p>
            <h3 className="mt-2 text-[1.1rem] font-semibold tracking-[-0.01em] text-text">
              Blackhawk Executive Brief surface
            </h3>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              This page is reserved for the latest processed agent-email snapshot. It will stay empty until CloudMailIn
              receives and processes a BLACKHAWK_BRIEF_BUNDLE message.
            </p>
          </div>
          <form action={requestExecutiveBriefRefreshAction}>
            <button
              type="submit"
              className="rounded-full border border-line/85 bg-[rgb(var(--color-shell))] px-4 py-2 text-sm font-medium text-white transition hover:bg-[rgb(var(--color-shell))]"
            >
              Run Agent Refresh
            </button>
          </form>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          {data.slots.map((slot) => (
            <BriefSlotCard key={slot.label} slot={slot} />
          ))}
        </div>
      </section>

      {data.latestSnapshot ? (
        <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Latest processed snapshot</p>
              <h3 className="mt-2 text-[1.2rem] font-semibold leading-snug tracking-[-0.01em] text-text md:text-[1.35rem]">
                {data.latestSnapshot.displayDate ?? data.latestSnapshot.subject}
              </h3>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                Processed {formatTimestamp(data.latestSnapshot.generatedAt ?? data.latestSnapshot.createdAt)} from CloudMailIn.
              </p>
            </div>
            <span className="w-fit rounded-full border border-line/70 bg-white/76 px-3 py-1 text-[0.72rem] uppercase tracking-[0.16em] text-text-subtle">
              {data.latestSnapshot.slot}
            </span>
          </div>

          <div className="mt-5 rounded-[1.25rem] border border-line/70 bg-white/66 px-4 py-4">
            <p className="text-sm font-medium text-text">{data.latestSnapshot.subject}</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-muted">
              {data.latestSnapshot.humanBrief ?? "No human-readable brief section was found in this bundle."}
            </p>
          </div>
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
    </div>
  );
}
