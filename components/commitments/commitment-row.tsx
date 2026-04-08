import { cn } from "@/lib/utils";

type CommitmentRowProps = {
  title: string;
  summary: string;
  due: string;
  owner: "you" | "others";
  action?: string;
  atRisk?: boolean;
};

export function CommitmentRow({
  title,
  summary,
  due,
  owner,
  action = "Open",
  atRisk = false
}: CommitmentRowProps) {
  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-[1.4rem] border px-4 py-4 md:flex-row md:items-center md:justify-between",
        atRisk ? "border-accent-red/20 bg-[rgba(125,35,31,0.06)]" : "border-line/70 bg-[rgba(255,255,255,0.64)]"
      )}
    >
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-sm font-medium text-text">{title}</p>
          <span className="text-[0.72rem] uppercase tracking-[0.16em] text-text-subtle">{due}</span>
          <span className="text-[0.72rem] uppercase tracking-[0.16em] text-text-subtle">
            {owner === "you" ? "You owe" : "Others owe"}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-text-muted">{summary}</p>
      </div>

      <button
        type="button"
        className="rounded-full border border-line/75 bg-white/78 px-4 py-2 text-sm font-medium text-text transition-colors duration-200 hover:bg-white"
      >
        {action}
      </button>
    </article>
  );
}

