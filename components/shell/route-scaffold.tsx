import { PageIntro } from "@/components/shell/page-intro";

type RouteScaffoldProps = {
  eyebrow: string;
  title: string;
  description: string;
  note?: string;
};

export function RouteScaffold({ eyebrow, title, description, note }: RouteScaffoldProps) {
  return (
    <div className="space-y-6">
      <PageIntro eyebrow={eyebrow} title={title} description={description} />

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
          <p className="section-label">Layout foundation</p>
          <div className="mt-5 rounded-[1.5rem] border border-dashed border-line/80 bg-[rgba(255,255,255,0.55)] px-5 py-16">
            <p className="text-sm text-text-muted">Primary content region reserved for the next implementation pass.</p>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-line/75 bg-white/68 p-5 md:p-6">
          <p className="section-label">Shell note</p>
          <p className="mt-4 text-sm leading-6 text-text-muted">
            {note ?? "This route currently establishes structure only: shell, navigation, spacing, and responsive layout behavior."}
          </p>
        </div>
      </section>
    </div>
  );
}

