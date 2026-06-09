import type { Route } from "next";
import Link from "next/link";

type CompactExecutiveListItem = {
  id: string;
  title: string;
  summary?: string | null;
  href?: string | null;
  actionLabel?: string | null;
  meta?: string[];
};

type CompactExecutiveListProps = {
  items: CompactExecutiveListItem[];
  emptyState: string;
};

function CompactExecutiveListRow({ item }: { item: CompactExecutiveListItem }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-medium leading-6 text-text">{item.title}</p>
        {item.actionLabel ? <span className="chip shrink-0">{item.actionLabel}</span> : null}
      </div>

      {item.summary ? (
        <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-text-muted">{item.summary}</p>
      ) : null}

      {item.meta && item.meta.length > 0 ? (
        <p className="mt-3 text-[12px] leading-5 text-text-subtle">
          {item.meta.join(" · ")}
        </p>
      ) : null}
    </>
  );

  if (item.href?.startsWith("http")) {
    return (
      <a
        href={item.href}
        className="block rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.62)] px-4 py-4 transition hover:bg-white/78"
      >
        {content}
      </a>
    );
  }

  if (item.href) {
    return (
      <Link
        href={item.href as Route}
        className="block rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.62)] px-4 py-4 transition hover:bg-white/78"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.62)] px-4 py-4">
      {content}
    </div>
  );
}

export function CompactExecutiveList({ items, emptyState }: CompactExecutiveListProps) {
  if (items.length === 0) {
    return <p className="text-sm leading-6 text-text-muted">{emptyState}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <CompactExecutiveListRow key={item.id} item={item} />
      ))}
    </div>
  );
}

export type { CompactExecutiveListItem };
