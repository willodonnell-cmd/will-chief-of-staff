import type { Route } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";

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

const ANYWHERE_TEXT_STYLE: CSSProperties = {
  overflowWrap: "anywhere",
  wordBreak: "break-word"
};

const CLAMP_3_TEXT_STYLE: CSSProperties = {
  ...ANYWHERE_TEXT_STYLE,
  display: "-webkit-box",
  overflow: "hidden",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 3
};

const CLAMP_4_TEXT_STYLE: CSSProperties = {
  ...ANYWHERE_TEXT_STYLE,
  display: "-webkit-box",
  overflow: "hidden",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 4
};

export function QuietPanel({ title, eyebrow, items }: QuietPanelProps) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
      <p className="section-label">{eyebrow}</p>
      <h3 className="section-title mt-0 min-w-0" style={ANYWHERE_TEXT_STYLE}>
        {title}
      </h3>

      <div className="mt-5 space-y-4">
        {items.map((item) =>
          item.href ? (
            <Link
              key={item.label}
              href={item.href as Route}
              className="block min-w-0 border-t border-line/55 pt-4 transition-opacity first:border-t-0 first:pt-0 hover:opacity-75"
            >
              <p className="text-sm font-medium text-text" style={CLAMP_3_TEXT_STYLE}>
                {item.label}
              </p>
              <p className="mt-1 text-sm leading-6 text-text-muted" style={CLAMP_4_TEXT_STYLE}>
                {item.detail}
              </p>
            </Link>
          ) : (
            <div key={item.label} className="min-w-0 border-t border-line/55 pt-4 first:border-t-0 first:pt-0">
              <p className="text-sm font-medium text-text" style={CLAMP_3_TEXT_STYLE}>
                {item.label}
              </p>
              <p className="mt-1 text-sm leading-6 text-text-muted" style={CLAMP_4_TEXT_STYLE}>
                {item.detail}
              </p>
            </div>
          )
        )}
      </div>
    </section>
  );
}
