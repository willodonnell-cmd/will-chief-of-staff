import { saveInvestmentCommitteeWillNotesAction } from "@/app/investment-committee/actions";
import { formatAttentionReason } from "@/lib/executive-item-nomination";
import type { InvestmentCommitteeBoardDeal, InvestmentCommitteePageData } from "@/lib/investment-committee";

type InvestmentCommitteeWorkspaceProps = {
  data: InvestmentCommitteePageData;
  notice?: string;
  error?: string;
};

function sanitizeFlashMessage(value?: string) {
  if (!value) return null;
  const normalized = value.replace(/-/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
}

function formatDateTime(value: string | null) {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";

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
      return "Peer question";
    case "answer":
      return "Team response";
    case "package":
      return "Package";
    case "general":
    default:
      return "Thread";
  }
}

function stateLabel(state: "waiting" | "in_progress" | "done" | "needs_attention") {
  switch (state) {
    case "done":
      return "Done";
    case "in_progress":
      return "In progress";
    case "needs_attention":
      return "Needs attention";
    case "waiting":
    default:
      return "Waiting";
  }
}

function stateClassName(state: "waiting" | "in_progress" | "done" | "needs_attention") {
  switch (state) {
    case "done":
      return "border-[rgba(36,92,62,0.18)] bg-[rgba(36,92,62,0.08)] text-[rgb(36,92,62)]";
    case "needs_attention":
      return "border-[rgba(125,35,31,0.18)] bg-[rgba(125,35,31,0.08)] text-[rgb(125,35,31)]";
    case "in_progress":
      return "border-[rgba(120,84,38,0.18)] bg-[rgba(120,84,38,0.08)] text-[rgb(120,84,38)]";
    case "waiting":
    default:
      return "border-line/70 bg-white/78 text-text-muted";
  }
}

function DealCard({ deal, board }: { deal: InvestmentCommitteeBoardDeal; board: NonNullable<InvestmentCommitteePageData["board"]> }) {
  const peerThreads = deal.threads.filter((thread) => thread.kind === "question");
  const answerThreads = deal.threads.filter((thread) => thread.kind === "answer");

  return (
    <article className="rounded-[1.25rem] border border-line/75 bg-white/72 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[1.05rem] font-semibold text-text">{deal.title}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {deal.attentionReasons.map((reason) => (
              <span key={reason} className="chip">{formatAttentionReason(reason)}</span>
            ))}
            {deal.willQuestionsSent ? <span className="chip">Will questions sent</span> : null}
          </div>
        </div>
        {deal.memoUrl ? (
          <a href={deal.memoUrl} target="_blank" rel="noreferrer" className="rounded-full border border-line/75 bg-white/84 px-3.5 py-2 text-sm font-medium text-text transition hover:bg-white">
            Open memo
          </a>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-4">
          <p className="section-label">Peer questions</p>
          <p className="mt-2 text-sm leading-6 text-text-muted">{deal.peerQuestionSummary ?? "No peer-question summary found yet."}</p>
          {peerThreads.length > 0 ? <p className="mt-2 text-xs text-text-subtle">{peerThreads.length} related question thread{peerThreads.length === 1 ? "" : "s"}</p> : null}
        </div>
        <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-4">
          <p className="section-label">Team responses</p>
          <p className="mt-2 text-sm leading-6 text-text-muted">{deal.answerSummary ?? "No team-response summary found yet."}</p>
          {answerThreads.length > 0 ? <p className="mt-2 text-xs text-text-subtle">{answerThreads.length} related response thread{answerThreads.length === 1 ? "" : "s"}</p> : null}
        </div>
      </div>

      <div className="mt-4 rounded-[1rem] border border-line/65 bg-white/66 px-4 py-4">
        <form action={saveInvestmentCommitteeWillNotesAction} className="space-y-3">
          <input type="hidden" name="weekOf" value={board.weekOf} />
          <input type="hidden" name="title" value={deal.title} />
          <input type="hidden" name="memoUrl" value={deal.memoUrl ?? ""} />
          <input type="hidden" name="boxFolderUrl" value={board.boxFolderUrl ?? ""} />
          <input type="hidden" name="meetingDate" value={board.meetingDate ?? ""} />
          <input type="hidden" name="questionsDueAt" value={board.questionsDueAt ?? ""} />
          <div className="flex items-center justify-between gap-3">
            <p className="section-label">Will questions</p>
            <button type="submit" className="rounded-full border border-line/75 bg-white/84 px-3.5 py-2 text-sm font-medium text-text transition hover:bg-white">
              Save notes
            </button>
          </div>
          <textarea
            name="note"
            rows={3}
            defaultValue={deal.willNotes}
            placeholder="Draft Will's questions for this deal."
            className="min-h-[6.25rem] w-full rounded-[1rem] border border-line/75 bg-white px-3.5 py-3 text-sm leading-6 text-text shadow-none outline-none transition focus:border-line focus:ring-0"
          />
        </form>
      </div>

      {deal.threads.length > 0 ? (
        <details className="mt-4 rounded-[1rem] border border-line/65 bg-white/66 px-4 py-4">
          <summary className="cursor-pointer list-none text-sm font-medium text-text">
            Related IC threads <span className="chip ml-2">{deal.threads.length}</span>
          </summary>
          <div className="mt-4 space-y-3">
            {deal.threads.map((thread) => (
              <div key={thread.id} className="rounded-[0.9rem] border border-line/60 bg-white/76 px-3 py-3">
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
                    <a href={thread.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-text-muted underline decoration-line/70 underline-offset-2 transition hover:text-text">
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
  );
}

export function InvestmentCommitteeWorkspace({ data, notice, error }: InvestmentCommitteeWorkspaceProps) {
  const successMessage = sanitizeFlashMessage(notice);
  const errorMessage = sanitizeFlashMessage(error);
  const board = data.board;

  return (
    <div className="space-y-6 lg:space-y-8">
      {successMessage || errorMessage ? (
        <section className={`rounded-[1.35rem] border px-4 py-3 text-sm ${errorMessage ? "border-[rgba(125,35,31,0.18)] bg-[rgba(125,35,31,0.08)] text-[rgb(125,35,31)]" : "border-[rgba(36,92,62,0.18)] bg-[rgba(36,92,62,0.08)] text-[rgb(36,92,62)]"}`}>
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
          {board.statusNotice ? <p className="text-sm leading-6 text-text-muted">{board.statusNotice}</p> : null}

          <section className="rounded-[1.35rem] border border-line/75 bg-white/72 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="section-label">This Week&apos;s Package</p>
                <h2 className="mt-2 text-[1.2rem] font-semibold text-text">Week of {formatDate(board.weekOf)}</h2>
                <p className="mt-2 text-sm leading-6 text-text-muted">{board.packageEmailSubject}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {board.boxFolderUrl ? <a href={board.boxFolderUrl} target="_blank" rel="noreferrer" className="rounded-full border border-line/75 bg-white/84 px-4 py-2 text-sm font-medium text-text transition hover:bg-white">Open Box folder</a> : null}
                {board.packageEmailUrl ? <a href={board.packageEmailUrl} target="_blank" rel="noreferrer" className="rounded-full border border-line/75 bg-white/84 px-4 py-2 text-sm font-medium text-text transition hover:bg-white">Open Susan package</a> : null}
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-3"><p className="section-label">Package</p><p className="mt-2 text-sm text-text">{board.packageReceived ? "Received" : "Not received"}</p></div>
              <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-3"><p className="section-label">Deals</p><p className="mt-2 text-sm text-text">{board.dealCount}</p></div>
              <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-3"><p className="section-label">Questions due</p><p className="mt-2 text-sm text-text">{formatDateTime(board.questionsDueAt)}</p></div>
              <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-3"><p className="section-label">Monday meeting</p><p className="mt-2 text-sm text-text">{formatDateTime(board.meetingDate)}</p></div>
            </div>
          </section>

          <section className="rounded-[1.35rem] border border-line/75 bg-white/72 p-5">
            <p className="section-label">Will&apos;s Workflow</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {board.workflowSteps.map((step) => (
                <div key={step.key} className={`rounded-[1rem] border px-4 py-4 ${stateClassName(step.state)}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{step.label}</p>
                    <span className="text-xs font-medium">{stateLabel(step.state)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 opacity-80">{step.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <p className="section-label">Deals Requiring Attention</p>
              <p className="mt-2 text-sm leading-6 text-text-muted">Only deals with a current attention trigger are pulled forward.</p>
            </div>
            {board.dealsRequiringAttention.length > 0 ? (
              board.dealsRequiringAttention.map((deal) => <DealCard key={deal.id} deal={deal} board={board} />)
            ) : (
              <section className="rounded-[1.25rem] border border-line/75 bg-white/72 px-5 py-5">
                <p className="text-sm leading-6 text-text-muted">No IC exceptions or Will-specific attention triggers found.</p>
              </section>
            )}
          </section>

          <section className="space-y-4">
            <p className="section-label">All Deals</p>
            {board.deals.length > 0 ? (
              board.deals.map((deal) => <DealCard key={deal.id} deal={deal} board={board} />)
            ) : (
              <section className="rounded-[1.25rem] border border-line/75 bg-white/72 px-5 py-5">
                <p className="text-sm leading-6 text-text-muted">No deals were listed in the current weekly payload.</p>
              </section>
            )}
          </section>

          <section className="rounded-[1.35rem] border border-line/75 bg-white/72 p-5">
            <p className="section-label">Suppressed / Closed</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">Normal Susan approval emails stay out of active IC work unless they contain an exception.</p>
            <details className="mt-4 rounded-[1rem] border border-line/65 bg-white/66 px-4 py-4">
              <summary className="cursor-pointer list-none text-sm font-medium text-text">
                Suppressed approval items <span className="chip ml-2">{board.suppressedApprovalItems.length}</span>
              </summary>
              <div className="mt-4 space-y-3">
                {board.suppressedApprovalItems.length > 0 ? board.suppressedApprovalItems.map((thread) => (
                  <div key={thread.id} className="rounded-[0.9rem] border border-line/60 bg-white/76 px-3 py-3">
                    <p className="text-sm font-medium text-text">{thread.subject}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-text-subtle">{thread.sender}</p>
                    <p className="mt-2 text-sm leading-6 text-text-muted">{thread.summary}</p>
                  </div>
                )) : <p className="text-sm leading-6 text-text-muted">No routine approval traffic is suppressed in this package.</p>}
              </div>
            </details>
          </section>
        </>
      )}
    </div>
  );
}
