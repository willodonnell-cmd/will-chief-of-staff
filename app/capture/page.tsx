import { CaptureFlow } from "@/components/capture/capture-flow";
import { PageIntro } from "@/components/shell/page-intro";
import { listInitiativeOptions } from "@/lib/initiatives";
import { getTaskConfig } from "@/lib/task-config";

export default async function CapturePage({
  searchParams
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const [{ categories, commonCategories, captureSettings }, initiatives] = await Promise.all([
    getTaskConfig(),
    listInitiativeOptions()
  ]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="Capture"
        title="Capture without leaving the current working posture."
        description="Capture inherits context from wherever it was opened, keeps privacy quiet and explicit, and confirms gently once the note or task is saved."
      />
      <CaptureFlow
        initialFrom={from ?? null}
        categories={categories}
        commonCategories={commonCategories}
        captureSettings={captureSettings}
        initiatives={initiatives}
      />
    </div>
  );
}
