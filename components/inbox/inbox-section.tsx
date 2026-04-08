import { InboxRow } from "@/components/inbox/inbox-row";

type InboxItem = {
  sender: string;
  subject: string;
  preview: string;
  received: string;
  action?: string;
  elevated?: boolean;
  protectedThread?: boolean;
};

type InboxSectionProps = {
  title: string;
  eyebrow: string;
  description: string;
  items: readonly InboxItem[];
};

export function InboxSection({ title, eyebrow, description, items }: InboxSectionProps) {
  return (
    <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">{eyebrow}</p>
          <h3 className="mt-3 text-xl font-medium tracking-[-0.02em] text-text">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-text-muted">{description}</p>
        </div>
        <div className="rounded-full border border-line/75 bg-white/65 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-text-subtle">
          {items.length} items
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <InboxRow key={`${item.sender}-${item.subject}`} {...item} />
        ))}
      </div>
    </section>
  );
}
