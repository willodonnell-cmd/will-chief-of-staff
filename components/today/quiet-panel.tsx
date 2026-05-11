import type { Route } from "next";
import Link from "next/link";

type QuietPanelItem = {
  label: string;
  detail: string;
  href?: string;
};

type QuietPanelProps = {
  title: string;
  eyebrow: string;
  items: QuietPanelItem[];
};

export function QuietPanel({ title, eyebrow, items }: QuietPanelProps) {
  return (
    <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
      <p className="section-label">{eyebrow}</p>
      <h3 className="section-title">{title}</h3>

      <div className="mt-5 space-y-4">
        {items.map((item) =>
          item.href ? (
            <Link
              key={item.label}
              href={item.href as Route}
              className="block border-t border-line/55 pt-4 transition-opacity first:border-t-0 first:pt-0 hover:opacity-75"
            >
              <p className="text-sm font-medium text-text">{item.label}</p>
              <p className="mt-1 text-sm leading-6 text-text-muted">{item.detail}</p>
            </Link>
          ) : (
            <div key={item.label} className="border-t border-line/55 pt-4 first:border-t-0 first:pt-0">
              <p className="text-sm font-medium text-text">{item.label}</p>
              <p className="mt-1 text-sm leading-6 text-text-muted">{item.detail}</p>
            </div>
          )
        )}
      </div>
    </section>
  );
}
