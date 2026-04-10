"use server";

import { saveCapture, type CaptureInput } from "@/lib/captures";

export async function persistCaptureAction(input: CaptureInput) {
  const savedCapture = await saveCapture(input);

  if (!savedCapture) {
    return {
      ok: false as const,
      message: "Capture could not be saved. Check the Supabase connection and migrations."
    };
  }

  return {
    ok: true as const,
    capture: savedCapture
  };
}
