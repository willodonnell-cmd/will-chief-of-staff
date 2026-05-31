import type { Route } from "next";
import Link from "next/link";

import { sanitizeDisplayText } from "@/lib/agent-signal-brief";
import type { TopNextBestAction } from "@/lib/today-executive-leverage";
import { cn } from "@/lib/utils";

type TopNextActionCardProps = {
  item: TopNextBestAction;
  rank: number;
  featured?: boolean;
};

function formatDueLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function priorityPillClass(priority: TopNextBestAction["priority"]) {
  if (priority === "high") {
    return "pill pill-priority";
  }

  if (priority === "medium") {
    return "pill pill-actionable";
  }

  return "pill pill-signal";
}

function actionPillClass(rank: number) {
  return rank === 1 ? "pill pill-decision" : "pill pill-pressure";
}

function condenseWhyShown(item: TopNextBestAction) {
  const whyShown = sanitizeDisplayText(item.why_shown);
  const parts = whyShown
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      const normalized = part.toLowerCase();

      if (item.priority && normalized === `${item.priority} priority`) {
        return false;
      }

      if (
        (item.work_type === "decision" && normalized === "decision work") ||
        (item.work_type === "opportunity" && normalized === "opportunity motion") ||
        (item.work_type === "strategic_initiative" && normalized === "initiative movement") ||
        (item.work_type === "delegation" && normalized === "follow-through needed") ||
        (item.work_type === "meeting" && normalized === "meeting prep")
      ) {
        return false;
      }

      return true;
    });

  if (parts.length === 0) {
    return null;
  }

  return parts.join(" · ");
}

function TopNextActionCardBody({
  item,
  rank,
  featured = false
}: TopNextActionCardProps) {
  const dueLabel = formatDueLabel(item.due_at);
  const whyShown = condenseWhyShown(item);
  const relationshipContext = [
    ...item.related_people,
    ...item.related_companies,
    ...item.related_initiatives
  ]
    .map((value) => sanitizeDisplayText(value))
    .slice(0, 3);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="section-label">Now #{rank}</span>
          <span className="chip">{item.work_type_label}</span>
          {item.priority ? <span className={priorityPillClass(item.priority)}>{item.priority}</span> : null}
        </div>

        <span className={actionPillClass(rank)}>{item.recommended_action_label}</span>
      </div>

      <h3
        className={cn(
          "mt-4 font-semibold leading-snug tracking-[-0.02em] text-text",
          featured ? "text-[1.45rem] md:text-[1.7rem]" : "text-[1.15rem] md:text-[1.25rem]"
        )}
      >
        {item.title}
      </h3>

      {whyShown ? (
        <p className="mt-2 text-sm font-medium leading-6 text-text">
          {whyShown}
        </p>
      ) : null}

      <p
        className={cn(
          whyShown ? "mt-2" : "mt-3",
          "text-sm leading-6 text-text-muted",
          featured ? "line-clamp-4 max-w-3xl" : "line-clamp-3"
        )}
      >
        {sanitizeDisplayText(item.summary)}
      </p>

      {relationshipContext.length > 0 ? (
        <p className="mt-4 line-clamp-2 text-sm leading-6 text-text-muted">
          {relationshipContext.join(" · ")}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line/60 pt-4 text-sm text-text-muted">
        {dueLabel ? <span>Due {dueLabel}</span> : null}
        {item.source_label ? <span>{item.source_label}</span> : null}
        {item.href ? <span className="font-medium text-text">Open →</span> : null}
      </div>
    </>
  );
}

export function TopNextActionCard(props: TopNextActionCardProps) {
  const { item, featured = false } = props;
  const className = cn(
    "block rounded-[1.9rem] p-5 transition-colors md:p-6",
    featured
      ? "refined-b hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(245,242,236,0.98))]"
      : "border border-line/75 bg-white/74 hover:bg-white/84"
  );

  if (item.href) {
    return (
      <Link href={item.href as Route} className={className}>
        <TopNextActionCardBody {...props} />
      </Link>
    );
  }

  return (
    <section className={className}>
      <TopNextActionCardBody {...props} />
    </section>
  );
}
