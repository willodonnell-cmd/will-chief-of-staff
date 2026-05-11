import Link from "next/link";
import { notFound } from "next/navigation";

import { BOOTSTRAP_PEOPLE } from "@/lib/people-search";
import { PageIntro } from "@/components/shell/page-intro";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PersonPage({ params }: Props) {
  const { id } = await params;
  const person = BOOTSTRAP_PEOPLE.find((p) => p.id === id);

  if (!person) notFound();

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex items-start justify-between gap-4">
        <PageIntro
          eyebrow={person.organization}
          title={person.name}
          description={person.title ?? ""}
        />
        <Link
          href="/people"
          className="mt-1 shrink-0 text-sm text-text-muted transition hover:text-text"
        >
          ← All people
        </Link>
      </div>

      <section className="refined-b rounded-[1.9rem] p-5 md:p-7">
        <p className="text-[0.72rem] uppercase tracking-[0.24em] text-text-subtle">1. Current read</p>
        <h2 className="brief-title mt-2">No relationship brief is available yet.</h2>
        <p className="brief-body mt-3">
          This person was added from the bootstrap index. Seed a relationship brief in Supabase
          to populate this view with current read, quiet state, and protected context.
        </p>
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">2. Next interaction</p>
        <p className="mt-3 text-sm text-text-muted">
          No next interaction needs foreground placement.
        </p>
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">3. Open loops / commitments</p>
        <p className="mt-3 text-sm text-text-muted">No open loops.</p>
      </section>
    </div>
  );
}
