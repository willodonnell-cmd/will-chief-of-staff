import { cn } from "@/lib/utils";

type CommitmentDetailCardProps = {
  title: string;
  whyItMatters: string;
  status: string;
  risk: string;
  stakeholders: string;
  nextStep: string;
  linkedContext: string;
  recentHistory: string;
  protectedContext?: boolean;
};

export function CommitmentDetailCard({
  title,
  whyItMatters,
  status,
  risk,
  stakeholders,
  nextStep,
  linkedContext,
  recentHistory,
  protectedContext = false
}: CommitmentDetailCardProps) {
  return (
    <section className="refined-b rounded-[1.9rem] p-5 md:p-7">
      <div className="brief-layout">
        <div className="brief-main">
          <p className="text-[0.72rem] uppercase tracking-[0.24em] text-text-subtle">Commitment detail</p>
          <h2 className="brief-title">{title}</h2>
          <p className="brief-body">{whyItMatters}</p>
        </div>

        <div className="brief-side space-y-3">
          <div className="rounded-[1.35rem] border border-line/75 bg-white/66 px-4 py-4">
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Current status / risk</p>
            <p className="mt-3 text-sm font-medium leading-6 text-text">{status}</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">{risk}</p>
          </div>
          {protectedContext ? (
            <div className="rounded-[1.35rem] border border-accent-red/22 bg-[rgba(125,35,31,0.08)] px-4 py-4">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Protected context</p>
              <p className="mt-3 text-sm leading-6 text-text-muted">
                Private relationship context affects the delivery timing of this commitment.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[1.35rem] border border-line/70 bg-white/62 px-4 py-4">
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Linked people / stakeholder context</p>
          <p className="mt-3 text-sm leading-6 text-text-muted">{stakeholders}</p>
        </div>
        <div className="rounded-[1.35rem] border border-line/70 bg-white/62 px-4 py-4">
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Suggested next step</p>
          <p className="mt-3 text-sm font-medium leading-6 text-text">{nextStep}</p>
        </div>
        <div className="rounded-[1.35rem] border border-line/70 bg-white/62 px-4 py-4">
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Linked meeting / thread / initiative</p>
          <p className="mt-3 text-sm leading-6 text-text-muted">{linkedContext}</p>
        </div>
        <div className={cn("rounded-[1.35rem] border border-line/60 bg-[rgba(255,255,255,0.54)] px-4 py-4")}>
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Recent history / changes</p>
          <p className="mt-3 text-sm leading-6 text-text-muted">{recentHistory}</p>
        </div>
      </div>
    </section>
  );
}
