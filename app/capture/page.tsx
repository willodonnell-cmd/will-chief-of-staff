import { CaptureCard } from "@/components/shell/capture-card";
import { PageIntro } from "@/components/shell/page-intro";

export default function CapturePage() {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Capture"
        title="The fastest path from thought to trusted system."
        description="Capture is centered in mobile navigation and elevated on larger screens so fragmented inputs can land without asking the user to choose the right destination first."
      />
      <CaptureCard />
    </div>
  );
}

