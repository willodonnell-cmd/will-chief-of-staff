import { ExecutiveBriefWorkspace } from "@/components/brief/executive-brief-workspace";
import { PageIntro } from "@/components/shell/page-intro";
import { loadExecutiveBriefPageData } from "@/lib/brief/load-executive-brief-page-data";

export const dynamic = "force-dynamic";

export default async function BriefPage() {
  const pageData = await loadExecutiveBriefPageData();

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="Executive Brief"
        title="Blackhawk Executive Brief"
        description="The latest processed agent-email snapshot for Blackhawk, organized by scheduled brief slot and manual refreshes."
      />

      <ExecutiveBriefWorkspace data={pageData} />
    </div>
  );
}
