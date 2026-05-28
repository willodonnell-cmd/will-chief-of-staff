import { PageIntro } from "@/components/shell/page-intro";

export default function InvestmentAgentPage() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="Investment Agent"
        title="Separate public-markets work stays outside the Chief of Staff cockpit."
        description="This route is only a boundary marker in Phase 1. Venture-related work remains in Chief of Staff for now, while any future public-markets investing agent stays separate."
      />

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <h2 className="section-title">No mixed routing here.</h2>
        <p className="mt-3 max-w-[48rem] text-sm leading-6 text-text-muted">
          The Chief of Staff dashboard may link here, but it should not mix public-markets items into Today&apos;s Priorities, Decisions Needed, Meeting Prep, Suggested Follow-ups, or Waiting On.
        </p>
      </section>
    </div>
  );
}
