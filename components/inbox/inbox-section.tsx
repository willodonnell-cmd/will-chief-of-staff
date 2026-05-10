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
          <p className="section-label">{eyebrow}</p>
          <h3 className="section-title">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-text-muted">{description}</p>
        </div>
        <div className="chip">
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
