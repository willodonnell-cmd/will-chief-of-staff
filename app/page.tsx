import { PageIntro } from "@/components/shell/page-intro";
import { GlanceChip } from "@/components/today/glance-chip";
import { HighFocusItem } from "@/components/today/high-focus-item";
import { QuietPanel } from "@/components/today/quiet-panel";
import { SupportNote } from "@/components/today/support-note";

export default function TodayPage() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="Today"
        title="A calm operating view for the day."
        description="Today is intentionally low-density: one high-focus item, a few quiet signals, and clear permission for everything else to stay out of sight."
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <GlanceChip label="Needs decision" value="1" />
        <GlanceChip label="Quietly on track" value="4" tone="quiet" />
        <GlanceChip label="Protected" value="1 thread" tone="protected" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.88fr]">
        <HighFocusItem
          title="Approve the narrowed hiring brief before board prep hardens around the wrong scope."
          summary="The search is converging, but the role framing shifted late. Confirming the narrower brief today keeps recruiting, board materials, and internal expectations aligned without creating a second loop."
          owner="Chief of staff"
          timing="Decision window closes by 2:30 PM"
          decision="Confirm the revised role framing"
        />

        <QuietPanel
          eyebrow="No attention needed now"
          title="Stable background"
          items={[
            {
              label: "Board prep",
              detail: "Narrative is aligned and waiting only on the hiring brief."
            },
            {
              label: "Investor follow-ups",
              detail: "Drafted and ready to send after tomorrow's conversation."
            },
            {
              label: "Ops review",
              detail: "No new blockers surfaced since yesterday."
            }
          ]}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.96fr_1.04fr]">
        <SupportNote
          eyebrow="Priority inbox"
          title="Three threads have earned foreground attention."
          body="Two external requests need disposition and one internal thread needs a short answer. Everything else can stay suppressed until the high-focus item is cleared."
        />
        <SupportNote
          eyebrow="Pacing"
          title="Flow over contrast."
          body="The screen avoids alert styling, stacked urgency, and dashboard density. The refined B card carries the primary gravity, while supporting context stays typographic and calm."
        />
      </section>
    </div>
  );
}
