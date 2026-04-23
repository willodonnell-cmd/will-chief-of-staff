import type { Route } from "next";
import Link from "next/link";

type TaskRadarItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
};

type TaskRadarProps = {
  overdue: TaskRadarItem[];
  dueSoon: TaskRadarItem[];
};

function TaskSection({
  title,
  items
}: {
  title: string;
  items: TaskRadarItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">{title}</p>
        <p className="text-xs text-text-muted">{items.length}</p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href as Route}
            className="block rounded-[1.2rem] border border-line/70 bg-[rgba(255,255,255,0.56)] px-4 py-4 transition hover:bg-white/75"
          >
            <p className="text-sm font-medium leading-6 text-text">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-text-muted">{item.detail}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function TaskRadar({ overdue, dueSoon }: TaskRadarProps) {
  if (overdue.length === 0 && dueSoon.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Task system</p>
          <h3 className="section-title">Operational tasks worth foreground attention.</h3>
        </div>

        <Link href="/library/tasks" className="text-sm text-text-muted transition hover:text-text">
          Open tasks
        </Link>
      </div>

      <div className="mt-5 space-y-5">
        <TaskSection title="Overdue" items={overdue} />
        <TaskSection title="Due soon" items={dueSoon} />
      </div>
    </section>
  );
}
