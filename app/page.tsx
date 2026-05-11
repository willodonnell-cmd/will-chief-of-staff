import { PageIntro } from "@/components/shell/page-intro";
import { GlanceChip } from "@/components/today/glance-chip";
import { HighFocusItem } from "@/components/today/high-focus-item";
import { QuietPanel } from "@/components/today/quiet-panel";
import { SupportNote } from "@/components/today/support-note";
import { TaskRadar } from "@/components/today/task-radar";
import { getTodayPageData } from "@/lib/today";

export default async function TodayPage() {
  const todayData = await getTodayPageData();

  if (!todayData) {
    return (
      <div className="space-y-6 lg:space-y-8">
        <PageIntro
          eyebrow="Today"
          title="A calm operating view for the day."
          description="Sign in to see your priority items, active initiatives, and tasks."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="Today"
        title="A calm operating view for the day."
        description="Today is intentionally low-density: one high-focus item, a few quiet signals, and clear permission for everything else to stay out of sight."
      />

      <section className="grid gap-3 sm:grid-cols-3">
        {todayData.glanceItems.map((item) => (
          <GlanceChip
            key={item.label}
            label={item.label}
            value={item.value}
            tone={item.tone}
            href={item.href}
          />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.88fr]">
        {todayData.highFocus ? (
          <HighFocusItem
            title={todayData.highFocus.title}
            summary={todayData.highFocus.summary}
            owner={todayData.highFocus.owner}
            timing={todayData.highFocus.timing}
            decision={todayData.highFocus.decision}
            href={todayData.highFocus.href}
          />
        ) : (
          <section className="refined-b rounded-[1.9rem] p-5 md:p-7">
            <p className="section-label">High focus</p>
            <p className="mt-3 text-[1.08rem] font-medium text-text">Nothing in high priority right now.</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              Priority Inbox will surface items here when they need foreground attention.
            </p>
          </section>
        )}

        <div className="space-y-4">
          {todayData.quietPanel ? (
            <QuietPanel
              eyebrow={todayData.quietPanel.eyebrow}
              title={todayData.quietPanel.title}
              items={todayData.quietPanel.items}
            />
          ) : null}

          <TaskRadar
            overdue={todayData.taskSections.overdue}
            dueSoon={todayData.taskSections.dueSoon}
          />
        </div>
      </section>

      {todayData.inboxSummary ? (
        <SupportNote
          eyebrow="Priority inbox"
          title={`${todayData.inboxSummary.highPriority} high priority · ${todayData.inboxSummary.needsReview} needs review`}
          body="Open Priority Inbox to triage, route, or defer these items."
          href="/inbox"
        />
      ) : null}
    </div>
  );
}
