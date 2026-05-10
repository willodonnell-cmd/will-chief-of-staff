import { CaptureFlow } from "@/components/capture/capture-flow";
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
    <CaptureFlow
      initialFrom={from ?? null}
      categories={categories}
      commonCategories={commonCategories}
      captureSettings={captureSettings}
      initiatives={initiatives}
    />
  );
}
