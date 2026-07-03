import type { ExecutiveItemRegistryEntry } from "@/lib/executive-item-candidate-registry";
import { formatAttentionReason } from "@/lib/executive-item-nomination";

function formatDueAt(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
}

function priorityLabel(priority: ExecutiveItemRegistryEntry["candidate"]["priority"]) {
  return `${priority.slice(0, 1).toUpperCase()}${priority.slice(1)} priority`;
}

export function ExecutiveItemCandidateLane({
  candidates
}: {
  candidates: ExecutiveItemRegistryEntry[];
}) {
  if (candidates.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[1.35rem] border border-line/75 bg-white/72 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="section-label">Executive Items</p>
          <h2 className="mt-2 text-[1.15rem] font-semibold tracking-[-0.01em] text-text">Generated attention claims</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-text-muted">
            Eligible registry candidates only. Normal workflow activity stays in its source module.
          </p>
        </div>
        <span className="chip shrink-0">{candidates.length} active</span>
      </div>

      <div className="mt-4 space-y-3">
        {candidates.map((entry) => {
          const dueAt = formatDueAt(entry.candidate.dueAt);

          return (
            <article key={`${entry.sourceType}:${entry.candidate.id}`} className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-text-subtle">{entry.sourceLabel}</p>
                  <h3 className="mt-1 text-sm font-medium leading-6 text-text">{entry.candidate.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-text-muted">{entry.candidate.summary}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <span className="chip">{priorityLabel(entry.candidate.priority)}</span>
                  {dueAt ? <span className="chip">Due {dueAt}</span> : null}
                </div>
              </div>

              <p className="mt-3 rounded-[0.9rem] bg-[rgba(248,246,240,0.9)] px-3 py-2 text-xs leading-5 text-text-muted">
                Recommended action: {entry.candidate.recommendedAction}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {entry.candidate.attentionReasons.map((reason) => (
                  <span key={reason} className="chip">
                    {formatAttentionReason(reason)}
                  </span>
                ))}
              </div>

              {entry.candidate.evidence.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs leading-5 text-text-subtle">
                  {entry.candidate.evidence.slice(0, 3).map((evidence) => (
                    <span key={`${evidence.label}:${evidence.value}`}>
                      <span className="font-medium text-text-muted">{evidence.label}: </span>
                      {evidence.href ? (
                        <a href={evidence.href} target="_blank" rel="noreferrer" className="underline decoration-line/70 underline-offset-2">
                          {evidence.value}
                        </a>
                      ) : (
                        evidence.value
                      )}
                    </span>
                  ))}
                </div>
              ) : null}

              {entry.candidate.href ? (
                <div className="mt-4">
                  <a
                    href={entry.candidate.href}
                    className="rounded-full border border-line/75 bg-white/84 px-3 py-1.5 text-xs font-medium text-text transition hover:bg-white"
                  >
                    Open Source
                  </a>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
