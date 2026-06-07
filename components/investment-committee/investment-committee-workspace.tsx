import { saveInvestmentCommitteeWillNotesAction } from "@/app/investment-committee/actions";
import type { InvestmentCommitteePageData } from "@/lib/investment-committee";

type InvestmentCommitteeWorkspaceProps = {
  data: InvestmentCommitteePageData;
  notice?: string;
  error?: string;
};

function sanitizeFlashMessage(value?: string) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/-/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
}

function threadKindLabel(kind: "question" | "answer" | "package" | "general") {
  switch (kind) {
    case "question":
      return "Question";
    case "answer":
      return "Q&A answer";
    case "package":
      return "Package";
    case "general":
    default:
      return "Thread";
  }
}

export function InvestmentCommitteeWorkspace({ data, notice, error }: InvestmentCommitteeWorkspaceProps) {
  const successMessage = sanitizeFlashMessage(notice);
  const errorMessage = sanitizeFlashMessage(error);
  const board = data.board;

  return (
    <div className="space-y-6 lg:space-y-8">
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

      {!board ? (
        <section className="refined-b rounded-[1.9rem] p-6 md:p-7">
          <p className="section-label">{data.emptyState?.title ?? "No current Investment Committee cycle found."}</p>
          <p className="brief-body mt-3 max-w-2xl">{data.emptyState?.detail ?? "Current week data is not available."}</p>
        </section>
      ) : (
        <>
          <section className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
            <span className="chip">{`Week of ${formatDate(board.weekOf)}`}</span>
            {board.meetingDate ? <span className="chip">{`Meeting ${formatDateTime(board.meetingDate)}`}</span> : null}
            {board.questionsDueAt ? <span className="chip">{`Questions due ${formatDateTime(board.questionsDueAt)}`}</span> : null}
            {board.boxFolderUrl ? (
              <a
                href={board.boxFolderUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-line/75 bg-white/84 px-4 py-2 text-sm font-medium text-text transition hover:bg-white"
              >
                Open Box folder
              </a>
            ) : null}
            {board.packageEmailUrl ? (
              <a
                href={board.packageEmailUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-line/75 bg-white/84 px-4 py-2 text-sm font-medium text-text transition hover:bg-white"
              >
                Open Susan package
              </a>
            ) : null}
          </section>

          <section className="space-y-4">
            {board.deals.length > 0 ? (
              board.deals.map((deal) => (
                <article key={deal.id} className="rounded-[1.65rem] border border-line/75 bg-white/72 p-5 md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="section-label">Deal</p>
                      <h3 className="mt-2 text-[1.15rem] font-semibold tracking-[-0.02em] text-text">{deal.title}</h3>
                    </div>

                    {deal.memoUrl ? (
                      <a
                        href={deal.memoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-line/75 bg-white/82 px-3.5 py-2 text-sm font-medium text-text transition hover:bg-white"
                      >
                        Open memo
                      </a>
                    ) : null}
                  </div>

                  {(deal.peerQuestionSummary || deal.answerSummary) ? (
                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      {deal.peerQuestionSummary ? (
                        <div className="rounded-[1.15rem] border border-line/65 bg-white/66 px-4 py-4">
                          <p className="section-label">EC questions</p>
                          <p className="mt-2 text-sm leading-6 text-text-muted">{deal.peerQuestionSummary}</p>
                        </div>
                      ) : null}

                      {deal.answerSummary ? (
                        <div className="rounded-[1.15rem] border border-line/65 bg-white/66 px-4 py-4">
                          <p className="section-label">Weekend Q&amp;A</p>
                          <p className="mt-2 text-sm leading-6 text-text-muted">{deal.answerSummary}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-[1.15rem] border border-line/65 bg-white/66 px-4 py-4">
                    <form action={saveInvestmentCommitteeWillNotesAction} className="space-y-3">
                      <input type="hidden" name="weekOf" value={board.weekOf} />
                      <input type="hidden" name="title" value={deal.title} />
                      <input type="hidden" name="memoUrl" value={deal.memoUrl ?? ""} />
                      <input type="hidden" name="boxFolderUrl" value={board.boxFolderUrl ?? ""} />
                      <input type="hidden" name="meetingDate" value={board.meetingDate ?? ""} />
                      <input type="hidden" name="questionsDueAt" value={board.questionsDueAt ?? ""} />

                      <div className="flex items-center justify-between gap-3">
                        <p className="section-label">Will&apos;s notes / final questions</p>
                        <button
                          type="submit"
                          className="rounded-full border border-line/75 bg-white/84 px-3.5 py-2 text-sm font-medium text-text transition hover:bg-white"
                        >
                          Save notes
                        </button>
                      </div>

                      <textarea
                        name="note"
                        rows={3}
                        defaultValue={deal.willNotes}
                        placeholder="Add Will's final notes or questions for this deal."
                        className="min-h-[6.25rem] w-full rounded-[1rem] border border-line/75 bg-white px-3.5 py-3 text-sm leading-6 text-text shadow-none outline-none transition focus:border-line focus:ring-0"
                      />
                    </form>
                  </div>

                  {deal.threads.length > 0 ? (
                    <details className="mt-4 rounded-[1.15rem] border border-line/65 bg-white/66 px-4 py-4">
                      <summary className="cursor-pointer list-none text-sm font-medium text-text">
                        <span className="inline-flex items-center gap-2">
                          <span>Related IC threads</span>
                          <span className="chip">{deal.threads.length}</span>
                        </span>
                      </summary>

                      <div className="mt-4 space-y-3">
                        {deal.threads.map((thread) => (
                          <div key={thread.id} className="rounded-[1rem] border border-line/60 bg-white/76 px-3 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-text">{thread.subject}</p>
                              <span className="chip">{threadKindLabel(thread.kind)}</span>
                              {thread.mentionsWill ? <span className="chip">Will mentioned</span> : null}
                            </div>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-text-subtle">{thread.sender}</p>
                            <p className="mt-2 text-sm leading-6 text-text-muted">{thread.summary}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-subtle">
                              <span>{formatDateTime(thread.occurredAt)}</span>
                              {thread.sourceUrl ? (
                                <a
                                  href={thread.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-medium text-text-muted underline decoration-line/70 underline-offset-2 transition hover:text-text"
                                >
                                  Open thread
                                </a>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </article>
              ))
            ) : (
              <section className="rounded-[1.65rem] border border-line/75 bg-white/72 px-5 py-5">
                <p className="text-sm leading-6 text-text-muted">
                  No deals were listed in the current weekly payload.
                </p>
              </section>
            )}
          </section>
        </>
      )}
    </div>
  );
}
