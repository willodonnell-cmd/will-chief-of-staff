"use server";

import { saveCapture, type CapturePattern, type CapturePrivacy } from "@/lib/captures";

type PersistCaptureInput = {
  sourcePath: string | null;
  pattern: CapturePattern;
  privacy: CapturePrivacy;
  summary: string;
  followUp: string;
  privateContext: string;
};

export async function persistCaptureAction(input: PersistCaptureInput) {
  const savedCapture = await saveCapture(input);

  if (!savedCapture) {
    return {
      ok: false as const,
      message: "Capture could not be saved."
    };
  }

  return {
    ok: true as const,
    message: `Captured ${savedCapture.pattern} in ${input.sourcePath && input.sourcePath !== "/capture" ? "context" : "general capture"}.`,
    capture: savedCapture
  };
}
