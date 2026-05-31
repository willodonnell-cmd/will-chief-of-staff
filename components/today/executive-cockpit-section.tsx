import { cn } from "@/lib/utils";

type ExecutiveCockpitSectionProps = {
  eyebrow: string;
  title: string;
  description?: string;
  statusNote?: string;
  count?: number | string;
  children: React.ReactNode;
  className?: string;
};

export function ExecutiveCockpitSection({
  eyebrow,
  title,
  description,
  statusNote,
  count,
  children,
  className
}: ExecutiveCockpitSectionProps) {
  return (
    <section className={cn("rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6", className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
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
          <span className="shrink-0 rounded-full border border-line/70 bg-white/70 px-3 py-1 text-[0.72rem] uppercase tracking-[0.18em] text-text-subtle">
            {count}
          </span>
        ) : null}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}
