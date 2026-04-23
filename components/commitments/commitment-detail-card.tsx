import type { Route } from "next";
import Link from "next/link";

import { cn } from "@/lib/utils";

type CommitmentDetailCardProps = {
  title: string;
  summary: string;
  href: string;
  stateLabel: string;
  timingLabel: string;
  activityLabel: string;
  priorityLabel: string;
  posture: string;
  sourceNote: string;
  metrics: Array<{
    label: string;
    value: string;
    tone: "default" | "quiet" | "alert";
  }>;
};

export function CommitmentDetailCard({
  title,
  summary,
  href,
  stateLabel,
  timingLabel,
  activityLabel,
  priorityLabel,
  posture,
  sourceNote,
  metrics
}: CommitmentDetailCardProps) {
  return (
    <section className="refined-b rounded-[1.9rem] p-5 md:p-7">
      <div className="brief-layout">
        <div className="brief-main">
          <p className="text-[0.72rem] uppercase tracking-[0.24em] text-text-subtle">Commitments brief</p>
          <h2 className="brief-title">{title}</h2>
          <p className="brief-body">{summary}</p>
        </div>

        <div className="brief-side space-y-3">
          <div className="rounded-[1.35rem] border border-line/75 bg-white/66 px-4 py-4">
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Lead obligation</p>
            <p className="mt-3 text-sm font-medium leading-6 text-text">{stateLabel}</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">{timingLabel}</p>
          </div>
          <Link
            href={href as Route}
            className="block rounded-[1.35rem] border border-line/75 bg-white/66 px-4 py-4 text-sm font-medium text-text transition hover:bg-white/76"
          >
            Open canonical detail
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[1.35rem] border border-line/70 bg-white/62 px-4 py-4">
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Operational posture</p>
          <p className="mt-3 text-sm leading-6 text-text-muted">{posture}</p>
        </div>
        <div className="rounded-[1.35rem] border border-line/70 bg-white/62 px-4 py-4">
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Activity state</p>
          <p className="mt-3 text-sm leading-6 text-text-muted">{activityLabel}</p>
        </div>
        <div className="rounded-[1.35rem] border border-line/70 bg-white/62 px-4 py-4">
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Priority</p>
          <p className="mt-3 text-sm font-medium leading-6 text-text">{priorityLabel}</p>
        </div>
        <div className={cn("rounded-[1.35rem] border border-line/60 bg-[rgba(255,255,255,0.54)] px-4 py-4")}>
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Canonical source</p>
          <p className="mt-3 text-sm leading-6 text-text-muted">{sourceNote}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className={cn(
              "rounded-[1.2rem] border px-4 py-4",
              metric.tone === "alert"
                ? "border-accent-red/20 bg-[rgba(125,35,31,0.07)]"
                : metric.tone === "quiet"
                  ? "border-line/60 bg-[rgba(255,255,255,0.5)]"
                  : "border-line/70 bg-white/62"
            )}
          >
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">{metric.label}</p>
            <p className="mt-2 text-lg font-medium text-text">{metric.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
