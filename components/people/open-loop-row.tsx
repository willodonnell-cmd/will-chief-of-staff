import { cn } from "@/lib/utils";

type OpenLoopRowProps = {
  title: string;
  owner: string;
  due: string;
  note: string;
  quiet?: boolean;
};

export function OpenLoopRow({ title, owner, due, note, quiet = false }: OpenLoopRowProps) {
  return (
    <article
      className={cn(
        "rounded-[1.4rem] border px-4 py-4",
        quiet ? "border-accent-moss/18 bg-[rgba(104,118,86,0.08)]" : "border-line/70 bg-[rgba(255,255,255,0.64)]"
      )}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="text-sm font-medium text-text">{title}</p>
        <div className="flex flex-wrap items-center gap-2 text-[0.72rem] uppercase tracking-[0.16em] text-text-subtle">
          <span>{owner}</span>
          <span>{due}</span>
        </div>
      </div>
      <p className="mt-2 text-sm leading-6 text-text-muted">{note}</p>
    </article>
  );
}

