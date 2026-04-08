import { CaptureFlow } from "@/components/capture/capture-flow";
import { PageIntro } from "@/components/shell/page-intro";

export default async function CapturePage({
  searchParams
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="Capture"
        title="Capture without leaving the current working posture."
        description="Capture inherits context from wherever it was opened, keeps privacy quiet and explicit, and confirms gently once the note or task is saved."
      />
      <CaptureFlow initialFrom={from ?? null} />
    </div>
  );
}
