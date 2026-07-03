import Link from "next/link";

import { PageIntro } from "@/components/shell/page-intro";
import { buildStructuredBriefSourceLanes } from "@/lib/brief/source-lanes";
import { getLatestExecutiveBriefForUser } from "@/lib/brief/load-executive-brief-page-data";
import { buildExecutiveItemCandidateAuditViewModel } from "@/lib/executive-item-candidate-audit";
import {
  sortExecutiveItemCandidates
} from "@/lib/executive-item-candidate-registry";
import {
  createSupabaseExecutiveItemCandidateInteractionsRepository
} from "@/lib/executive-item-candidate-interactions";
import {
  formatAttentionReason,
  formatSuppressionReason
} from "@/lib/executive-item-nomination";
import {
  buildInvestmentCommitteeCandidateRegistryEntries,
  getInvestmentCommitteePageData
} from "@/lib/investment-committee";
import { buildMeetingCandidateRegistryEntries } from "@/lib/meeting-executive-item-candidates";
import {
  createSupabaseMeetingRecordsRepository,
  isMeetingRecordsSchemaUnavailableError,
  listMeetingRecordsForCalendarEventLookups,
  meetingCalendarEventIdFromBriefItemId
} from "@/lib/meetings/meeting-records";
import { resolveCurrentAppUser } from "@/lib/supabase/current-user";

function formatBoolean(value: boolean) {
  return value ? "Yes" : "No";
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "None";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
}

async function loadMeetingCandidateEntries(userId: string, client: NonNullable<Awaited<ReturnType<typeof resolveCurrentAppUser>>>["client"]) {
  const snapshot = await getLatestExecutiveBriefForUser().catch(() => null);
  const structuredBrief = snapshot?.structuredBrief ?? null;
  if (!structuredBrief) {
    return [];
  }

  const lookups = buildStructuredBriefSourceLanes({ structuredBrief })
    .flatMap((lane) => lane.entries)
    .filter((entry) => entry.section === "meetingPrep")
    .map((entry) => ({
      calendarEventId: entry.item.calendarEventId ?? meetingCalendarEventIdFromBriefItemId(entry.id),
      calendarSourceSystemId: entry.item.calendarSourceSystemId ?? "executive_brief"
    }));

  if (lookups.length === 0) {
    return [];
  }

  try {
    const repository = createSupabaseMeetingRecordsRepository(client);
    const records = await listMeetingRecordsForCalendarEventLookups(repository, {
      userId,
      lookups
    });
    return buildMeetingCandidateRegistryEntries(records);
  } catch (error) {
    if (!isMeetingRecordsSchemaUnavailableError(error)) {
      console.error("[admin.executive-item-candidates] Failed to load meeting candidate records.", error);
    }
    return [];
  }
}

export default async function ExecutiveItemCandidatesPreviewPage() {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return (
      <div className="space-y-6 lg:space-y-8">
        <PageIntro
          eyebrow="Admin"
          title="Executive Item Candidates"
          description="Candidate audit is unavailable because no active app user could be resolved."
        />

        <section className="rounded-[1.25rem] border border-line/75 bg-white/72 px-5 py-5">
          <p className="text-sm leading-6 text-text-muted">No active user. Candidate interactions are scoped server-side by app user.</p>
        </section>
      </div>
    );
  }

  const investmentCommitteeData = await getInvestmentCommitteePageData();
  const [meetingCandidateEntries, interactions] = await Promise.all([
    loadMeetingCandidateEntries(resolved.user.id, resolved.client),
    createSupabaseExecutiveItemCandidateInteractionsRepository(resolved.client)
      .listForUser({ userId: resolved.user.id })
      .catch((error) => {
        console.error("[admin.executive-item-candidates] Failed to load candidate interactions.", error);
        return [];
      })
  ]);
  const registryEntries = sortExecutiveItemCandidates([
    ...buildInvestmentCommitteeCandidateRegistryEntries(investmentCommitteeData?.board ?? null),
    ...meetingCandidateEntries
  ]);
  const audit = buildExecutiveItemCandidateAuditViewModel(registryEntries, interactions);
  const summary = audit.summary;

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="Admin"
        title="Executive Item Candidates"
        description="Read-only audit of workflow-nominated attention candidates, Today eligibility, source metadata, and candidate interactions."
      />

      <section className="rounded-[1.35rem] border border-line/75 bg-white/72 p-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-3">
            <p className="section-label">Total</p>
            <p className="mt-2 text-lg font-semibold text-text">{summary.total}</p>
          </div>
          <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-3">
            <p className="section-label">Eligible Today</p>
            <p className="mt-2 text-lg font-semibold text-text">{summary.eligible}</p>
          </div>
          <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-3">
            <p className="section-label">Suppressed</p>
            <p className="mt-2 text-lg font-semibold text-text">{summary.suppressedByInteraction}</p>
          </div>
          <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-3">
            <p className="section-label">Dismissed</p>
            <p className="mt-2 text-lg font-semibold text-text">{summary.byAction.dismissed}</p>
          </div>
          <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-3">
            <p className="section-label">Snoozed</p>
            <p className="mt-2 text-lg font-semibold text-text">{summary.byAction.snoozed}</p>
          </div>
          <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-3">
            <p className="section-label">Reviewed</p>
            <p className="mt-2 text-lg font-semibold text-text">{summary.byAction.reviewed}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          {Object.entries(summary.bySourceType).map(([sourceType, count]) => (
            <div key={sourceType} className="rounded-[0.85rem] border border-line/65 bg-white/55 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-text-subtle">{sourceType}</p>
              <p className="mt-1 text-sm font-semibold text-text">{count}</p>
            </div>
          ))}
          <div className="rounded-[0.85rem] border border-line/65 bg-white/55 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-text-subtle">Active</p>
            <p className="mt-1 text-sm font-semibold text-text">{summary.active}</p>
          </div>
          <div className="rounded-[0.85rem] border border-line/65 bg-white/55 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-text-subtle">Ineligible</p>
            <p className="mt-1 text-sm font-semibold text-text">{summary.ineligible}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-label">Registry Entries</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {summary.eligible} candidate{summary.eligible === 1 ? "" : "s"} are eligible before interaction suppression.
            </p>
          </div>
          <Link href="/admin" className="rounded-full border border-line/75 bg-white/84 px-4 py-2 text-sm font-medium text-text transition hover:bg-white">
            Back to Admin
          </Link>
        </div>

        {audit.entries.length > 0 ? (
          audit.entries.map((entry) => (
            <article key={`${entry.sourceType}:${entry.candidateId}`} className="rounded-[1.25rem] border border-line/75 bg-white/72 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="section-label">{entry.sourceLabel}</p>
                  <h2 className="mt-2 text-[1.08rem] font-semibold text-text">{entry.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-text-muted">{entry.recommendedAction}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="chip">{entry.sourceType}</span>
                  <span className="chip">{entry.priority}</span>
                  <span className="chip">Eligible: {formatBoolean(entry.eligibleForToday)}</span>
                  <span className="chip">Suppressed: {formatBoolean(entry.suppressedByInteraction)}</span>
                  <span className="chip">Interaction: {entry.interactionAction ?? "none"}</span>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-4">
                  <p className="section-label">Interaction</p>
                  <p className="mt-2 text-sm leading-6 text-text-muted">{entry.interactionAction ?? "No interaction recorded"}</p>
                  <p className="mt-2 text-xs text-text-subtle">Snoozed until: {formatDateTime(entry.snoozedUntil)}</p>
                </div>
                <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-4">
                  <p className="section-label">Eligibility</p>
                  <p className="mt-2 text-sm leading-6 text-text-muted">{entry.eligibilityReason}</p>
                  <p className="mt-2 text-xs text-text-subtle">Rank {entry.displayRank}</p>
                </div>
                <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-4">
                  <p className="section-label">Generated</p>
                  <p className="mt-2 text-sm leading-6 text-text-muted">{formatDateTime(entry.generatedAt)}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {entry.attentionReasons.map((reason) => (
                  <span key={reason} className="chip">{formatAttentionReason(reason)}</span>
                ))}
                {entry.suppressionReasons.map((reason) => (
                  <span key={reason} className="chip">{formatSuppressionReason(reason)}</span>
                ))}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-3">
                  <p className="section-label">Interaction key</p>
                  <p className="mt-2 break-all font-mono text-xs leading-5 text-text-subtle">{entry.interactionKey}</p>
                </div>
                <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-3">
                  <p className="section-label">Source ID</p>
                  <p className="mt-2 break-all font-mono text-xs leading-5 text-text-subtle">{entry.sourceId}</p>
                </div>
              </div>
            </article>
          ))
        ) : (
          <section className="rounded-[1.25rem] border border-line/75 bg-white/72 px-5 py-5">
            <p className="text-sm leading-6 text-text-muted">No Executive Item candidates are registered from current workflow data.</p>
          </section>
        )}
      </section>
    </div>
  );
}
