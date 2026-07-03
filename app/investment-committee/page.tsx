import { InvestmentCommitteeWorkspace } from "@/components/investment-committee/investment-committee-workspace";
import { PageIntro } from "@/components/shell/page-intro";
import { getInvestmentCommitteePageData } from "@/lib/investment-committee";

type InvestmentCommitteePageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
  }>;
};

export default async function InvestmentCommitteePage({ searchParams }: InvestmentCommitteePageProps) {
  const [{ notice, error }, pageData] = await Promise.all([searchParams, getInvestmentCommitteePageData()]);

  if (!pageData) {
    return (
      <div className="space-y-6 lg:space-y-8">
        <PageIntro
          eyebrow="Investment Committee"
          title="Investment Committee"
          description="Weekly memo review and question generation."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="Investment Committee"
        title="Investment Committee"
        description="Weekly memo review and question generation."
      />

      <InvestmentCommitteeWorkspace data={pageData} notice={notice} error={error} />
    </div>
  );
}
