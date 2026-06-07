import { cn } from "@/lib/utils";

type ExecutiveCockpitSectionProps = {
  eyebrow: string;
  title: string;
  description?: string;
  statusNote?: string;
  count?: number | string;
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
};

export function ExecutiveCockpitSection({
  eyebrow,
  title,
  description,
  statusNote,
  count,
  children,
  className,
  compact = false
}: ExecutiveCockpitSectionProps) {
  return (
    <section
      className={cn(
        "rounded-[1.75rem] border border-line/75 bg-white/72",
        compact ? "p-4 md:p-5" : "p-5 md:p-6",
        className
      )}
    >
      <div className={cn("flex flex-col md:flex-row md:items-start md:justify-between", compact ? "gap-2.5" : "gap-3")}>
        <div className="min-w-0">
          <p className="section-label">{eyebrow}</p>
          <h3 className="section-title mt-0">{title}</h3>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">{description}</p>
          ) : null}
          {statusNote ? (
            <p className="mt-2 text-sm leading-6 text-text-muted">{statusNote}</p>
          ) : null}
        </div>

        {count !== undefined ? (
          <span
            className={cn(
              "shrink-0 rounded-full border border-line/70 bg-white/70 uppercase tracking-[0.18em] text-text-subtle",
              compact ? "px-2.5 py-1 text-[0.68rem]" : "px-3 py-1 text-[0.72rem]"
            )}
          >
            {count}
          </span>
        ) : null}
      </div>

      <div className={cn(compact ? "mt-3" : "mt-5")}>{children}</div>
    </section>
  );
}
