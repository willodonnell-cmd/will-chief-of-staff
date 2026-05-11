import type { Route } from "next";
import Link from "next/link";

type SupportNoteProps = {
  eyebrow: string;
  title: string;
  body: string;
  href?: string;
};

export function SupportNote({ eyebrow, title, body, href }: SupportNoteProps) {
  return (
    <section className="rounded-[1.75rem] border border-line/75 bg-white/70 p-5 md:p-6">
      <p className="section-label">{eyebrow}</p>
      <h3 className="section-title">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-text-muted">{body}</p>
      {href ? (
        <Link
          href={href as Route}
          className="mt-4 inline-block text-sm font-medium text-text transition hover:text-text-muted"
        >
          View →
        </Link>
      ) : null}
    </section>
  );
}
