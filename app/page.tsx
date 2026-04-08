import { BriefCard } from "@/components/shell/brief-card";
import { GlancePill } from "@/components/shell/glance-pill";
import { HighFocusCard } from "@/components/shell/high-focus-card";
import { PageIntro } from "@/components/shell/page-intro";
import { QuietList } from "@/components/shell/quiet-list";

export default function TodayPage() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="Today"
        title="A highly glanceable operating view."
        description="Today is biased toward low density and fast orientation. One item gets refined B treatment, a few signals stay quiet, and everything else recedes until it is needed."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <GlancePill label="Needs decision" value="1" />
        <GlancePill label="Quietly on track" value="4" tone="moss" />
        <GlancePill label="Protected" value="1 thread" tone="red" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">
        <HighFocusCard
          title="Approve the narrowed hiring brief before the board prep locks the week."
          owner="Chief of staff"
          timing="Decision window closes by 2:30 PM"
          summary="The hiring loop has converged to one scope change. No escalation is needed yet, but the brief should be confirmed today so recruiting and board materials stop drifting apart."
          decision="Confirm the revised role framing"
        />
        <QuietList
          eyebrow="No attention needed now"
          title="Stable background"
          items={[
            { label: "Board prep", detail: "Materials are aligned and waiting on the hiring brief." },
            { label: "Investor follow-ups", detail: "Drafted and ready for release after tomorrow's meeting." },
            { label: "Ops review", detail: "On track with no new blockers since yesterday." }
          ]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <BriefCard
          eyebrow="Priority inbox"
          title="Three items are worth opening. The rest can stay backgrounded."
          body="The shell keeps triage tight: two external requests need a disposition and one internal thread needs a short reply. Nothing else has earned foreground attention."
        />
        <BriefCard
          eyebrow="Pacing"
          title="Flow over contrast."
          body="Today avoids alert styling, left-edge emphasis, and stacked urgency. The highest-focus item gets elevation and clarity, while supporting information stays typographic and calm."
          tone="quiet"
        />
      </div>
    </div>
  );
}
