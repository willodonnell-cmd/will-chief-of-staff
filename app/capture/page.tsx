import { CaptureFlow } from "@/components/capture/capture-flow";
import { listInitiativeOptions } from "@/lib/initiatives";
import { getTaskConfig } from "@/lib/task-config";

export default async function CapturePage({
  searchParams
}: {
  searchParams: Promise<{ from?: string; handoff?: string }>;
}) {
  const { from, handoff } = await searchParams;
  const [{ categories, commonCategories, captureSettings }, initiatives] = await Promise.all([
    getTaskConfig(),
    listInitiativeOptions()
  ]);

  return (
    <CaptureFlow
      initialFrom={from ?? null}
      initialHandoffKey={handoff ?? null}
      categories={categories}
      commonCategories={commonCategories}
      captureSettings={captureSettings}
      initiatives={initiatives}
    />
  );
}
