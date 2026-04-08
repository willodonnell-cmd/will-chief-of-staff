type QuietListProps = {
  eyebrow: string;
  title: string;
  items: Array<{
    label: string;
    detail: string;
  }>;
};

export function QuietList({ eyebrow, title, items }: QuietListProps) {
  return (
    <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
      <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">{eyebrow}</p>
      <h3 className="mt-3 text-xl font-medium tracking-[-0.02em] text-text">{title}</h3>
      <div className="mt-5 space-y-4">
        {items.map((item) => (
          <div key={item.label} className="flex items-start justify-between gap-4 border-t border-line/55 pt-4 first:border-t-0 first:pt-0">
            <p className="text-sm font-medium text-text">{item.label}</p>
            <p className="max-w-[14rem] text-right text-sm leading-6 text-text-muted">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

