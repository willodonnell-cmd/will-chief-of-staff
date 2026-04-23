import { CommitmentRow } from "@/components/commitments/commitment-row";

type CommitmentItem = {
  id: string;
  title: string;
  summary: string;
  href: string;
  stateLabel: string;
  dueLabel: string;
  activityLabel: string;
  priorityLabel: string | null;
  tone: "overdue" | "soon" | "active" | "quiet";
};

type CommitmentSectionProps = {
  eyebrow: string;
  title: string;
  description: string;
  items: readonly CommitmentItem[];
  emptyMessage?: string;
};

export function CommitmentSection({
  eyebrow,
  title,
  description,
  items,
  emptyMessage = "No items are currently surfaced in this section."
}: CommitmentSectionProps) {
  return (
    <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">{eyebrow}</p>
          <h3 className="section-title">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-text-muted">{description}</p>
        </div>
        <div className="rounded-full border border-line/75 bg-white/65 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-text-subtle">
          {items.length} items
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {items.length > 0 ? (
          items.map((item) => <CommitmentRow key={item.id} {...item} />)
        ) : (
          <div className="rounded-[1.35rem] border border-line/65 bg-[rgba(255,255,255,0.48)] px-4 py-4 text-sm leading-6 text-text-muted">
            {emptyMessage}
          </div>
        )}
      </div>
    </section>
  );
}
