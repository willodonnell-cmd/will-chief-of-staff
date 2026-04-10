"use server";

import { saveCapture, type CaptureInput } from "@/lib/captures";

export async function persistCaptureAction(input: CaptureInput) {
  const savedCapture = await saveCapture(input);

  if (!savedCapture.ok) {
    return {
      ok: false as const,
      message: savedCapture.error
    };
  }

  return {
    ok: true as const,
    capture: savedCapture.capture
  };
}
