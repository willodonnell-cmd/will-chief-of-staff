import Link from "next/link";

import { PageIntro } from "@/components/shell/page-intro";
import {
  filterEligibleTodayCandidates,
  sortExecutiveItemCandidates,
  summarizeExecutiveItemCandidates
} from "@/lib/executive-item-candidate-registry";
import {
  formatAttentionReason,
  formatSuppressionReason
} from "@/lib/executive-item-nomination";
import {
  buildInvestmentCommitteeCandidateRegistryEntries,
  getInvestmentCommitteePageData
} from "@/lib/investment-committee";

function formatBoolean(value: boolean) {
  return value ? "Yes" : "No";
}

export default async function ExecutiveItemCandidatesPreviewPage() {
  const investmentCommitteeData = await getInvestmentCommitteePageData();
  const registryEntries = sortExecutiveItemCandidates(
    buildInvestmentCommitteeCandidateRegistryEntries(investmentCommitteeData?.board ?? null)
  );
  const eligibleEntries = filterEligibleTodayCandidates(registryEntries);
  const summary = summarizeExecutiveItemCandidates(registryEntries);

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="Admin"
        title="Executive Item Candidates"
        description="A preview of workflow-nominated attention candidates before Today or Executive Brief renders anything."
      />

      <section className="rounded-[1.35rem] border border-line/75 bg-white/72 p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-3">
            <p className="section-label">Total</p>
            <p className="mt-2 text-lg font-semibold text-text">{summary.total}</p>
          </div>
          <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-3">
            <p className="section-label">Eligible Today</p>
            <p className="mt-2 text-lg font-semibold text-text">{summary.eligible}</p>
          </div>
          <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-3">
            <p className="section-label">Ineligible</p>
            <p className="mt-2 text-lg font-semibold text-text">{summary.ineligible}</p>
          </div>
          <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-3">
            <p className="section-label">IC Source</p>
            <p className="mt-2 text-lg font-semibold text-text">{summary.bySourceType.investment_committee}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-label">Registry Entries</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {eligibleEntries.length} candidate{eligibleEntries.length === 1 ? "" : "s"} would be eligible for Today.
            </p>
          </div>
          <Link href="/admin" className="rounded-full border border-line/75 bg-white/84 px-4 py-2 text-sm font-medium text-text transition hover:bg-white">
            Back to Admin
          </Link>
        </div>

        {registryEntries.length > 0 ? (
          registryEntries.map((entry) => (
            <article key={`${entry.sourceType}:${entry.candidate.id}`} className="rounded-[1.25rem] border border-line/75 bg-white/72 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="section-label">{entry.sourceLabel}</p>
                  <h2 className="mt-2 text-[1.08rem] font-semibold text-text">{entry.candidate.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-text-muted">{entry.candidate.summary}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="chip">{entry.sourceType}</span>
                  <span className="chip">{entry.candidate.priority}</span>
                  <span className="chip">Eligible: {formatBoolean(entry.eligibleForToday)}</span>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-4">
                  <p className="section-label">Recommended action</p>
                  <p className="mt-2 text-sm leading-6 text-text-muted">{entry.candidate.recommendedAction}</p>
                </div>
                <div className="rounded-[1rem] border border-line/65 bg-white/66 px-4 py-4">
                  <p className="section-label">Eligibility</p>
                  <p className="mt-2 text-sm leading-6 text-text-muted">{entry.eligibilityReason}</p>
                  <p className="mt-2 text-xs text-text-subtle">Rank {entry.displayRank} · {entry.freshness}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {entry.candidate.attentionReasons.map((reason) => (
                  <span key={reason} className="chip">{formatAttentionReason(reason)}</span>
                ))}
                {entry.candidate.suppressionReasons.map((reason) => (
                  <span key={reason} className="chip">{formatSuppressionReason(reason)}</span>
                ))}
              </div>

              {entry.candidate.evidence.length > 0 ? (
                <div className="mt-4 rounded-[1rem] border border-line/65 bg-white/66 px-4 py-4">
                  <p className="section-label">Evidence</p>
                  <div className="mt-3 space-y-2">
                    {entry.candidate.evidence.map((evidence) => (
                      <p key={`${evidence.label}:${evidence.value}`} className="text-sm leading-6 text-text-muted">
                        <span className="font-medium text-text">{evidence.label}: </span>
                        {evidence.href ? (
                          <a href={evidence.href} target="_blank" rel="noreferrer" className="underline decoration-line/70 underline-offset-2">
                            {evidence.value}
                          </a>
                        ) : (
                          evidence.value
                        )}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
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
