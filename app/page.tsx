import { PageIntro } from "@/components/shell/page-intro";
import { GlanceChip } from "@/components/today/glance-chip";
import { HighFocusItem } from "@/components/today/high-focus-item";
import { QuietPanel } from "@/components/today/quiet-panel";
import { SupportNote } from "@/components/today/support-note";
import { TaskRadar } from "@/components/today/task-radar";
import { getTodayPageData } from "@/lib/today";

export default async function TodayPage() {
  const todayData = await getTodayPageData();

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="Today"
        title="A calm operating view for the day."
        description="Today is intentionally low-density: one high-focus item, a few quiet signals, and clear permission for everything else to stay out of sight."
      />

      <section className="grid gap-3 sm:grid-cols-3">
        {(todayData?.glanceItems ?? [
          { label: "Needs decision", value: "1", tone: "default" as const },
          { label: "Quietly on track", value: "4", tone: "quiet" as const },
          { label: "Protected", value: "1 thread", tone: "protected" as const }
        ]).map((item) => (
          <GlanceChip
            key={item.label}
            label={item.label}
            value={item.value}
            tone={item.tone}
            href={
              item.tone === "quiet" ? "/initiatives" : "/inbox"
            }
          />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.88fr]">
        <HighFocusItem
          title={
            todayData?.highFocus?.title ?? "Approve the narrowed hiring brief before board prep hardens around the wrong scope."
          }
          summary={
            todayData?.highFocus?.summary ??
            "The search is converging, but the role framing shifted late. Confirming the narrower brief today keeps recruiting, board materials, and internal expectations aligned without creating a second loop."
          }
          owner={todayData?.highFocus?.owner ?? "Chief of staff"}
          timing={todayData?.highFocus?.timing ?? "Decision window closes by 2:30 PM"}
          decision={todayData?.highFocus?.decision ?? "Confirm the revised role framing"}
        />

        <div className="space-y-4">
          <QuietPanel
            eyebrow={todayData?.quietPanel?.eyebrow ?? "No attention needed now"}
            title={todayData?.quietPanel?.title ?? "Stable background"}
            items={
              todayData?.quietPanel?.items ?? [
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
              ]
            }
          />

          <TaskRadar
            overdue={todayData?.taskSections.overdue ?? []}
            dueSoon={todayData?.taskSections.dueSoon ?? []}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.96fr_1.04fr]">
        {(todayData?.supportNotes ?? [
          {
            eyebrow: "Priority inbox",
            title: "Three threads have earned foreground attention.",
            body: "Two external requests need disposition and one internal thread needs a short answer. Everything else can stay suppressed until the high-focus item is cleared."
          },
          {
            eyebrow: "Pacing",
            title: "Flow over contrast.",
            body: "The screen avoids alert styling, stacked urgency, and dashboard density. The refined B card carries the primary gravity, while supporting context stays typographic and calm."
          }
        ]).map((note) => (
          <SupportNote key={`${note.eyebrow}-${note.title}`} eyebrow={note.eyebrow} title={note.title} body={note.body} />
        ))}
      </section>
    </div>
  );
}
