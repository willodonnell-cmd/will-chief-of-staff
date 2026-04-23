import type { Route } from "next";
import Link from "next/link";

import { cn } from "@/lib/utils";

type CommitmentRowProps = {
  title: string;
  summary: string;
  href: string;
  stateLabel: string;
  dueLabel: string;
  activityLabel: string;
  priorityLabel?: string | null;
  actionLabel?: string;
  tone?: "overdue" | "soon" | "active" | "quiet";
};

export function CommitmentRow({
  title,
  summary,
  href,
  stateLabel,
  dueLabel,
  activityLabel,
  priorityLabel,
  actionLabel = "Open detail",
  tone = "active"
}: CommitmentRowProps) {
  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-[1.4rem] border px-4 py-4 md:flex-row md:items-center md:justify-between",
        tone === "overdue"
          ? "border-accent-red/20 bg-[rgba(125,35,31,0.06)]"
          : tone === "soon"
            ? "border-line/70 bg-[rgba(255,255,255,0.72)]"
            : tone === "quiet"
              ? "border-line/60 bg-[rgba(255,255,255,0.54)]"
              : "border-line/70 bg-[rgba(255,255,255,0.64)]"
      )}
    >
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-sm font-medium text-text">{title}</p>
          <span className="text-[0.72rem] uppercase tracking-[0.16em] text-text-subtle">{stateLabel}</span>
          {priorityLabel ? (
            <span className="text-[0.72rem] uppercase tracking-[0.16em] text-text-subtle">{priorityLabel}</span>
          ) : null}
        </div>
        <p className="mt-2 text-sm leading-6 text-text-muted">{summary}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.72rem] uppercase tracking-[0.16em] text-text-subtle">
          <span>{dueLabel}</span>
          <span>{activityLabel}</span>
        </div>
      </div>

      <Link
        href={href as Route}
        className="rounded-full border border-line/75 bg-white/78 px-4 py-2 text-sm font-medium text-text transition-colors duration-200 hover:bg-white"
      >
        {actionLabel}
      </Link>
    </article>
  );
}
