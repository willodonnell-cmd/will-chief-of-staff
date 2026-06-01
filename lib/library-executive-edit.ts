import type { ExecutiveCaptureMetadata, ExecutiveCaptureType } from "@/lib/blackhawk-capture-model";
import type { ExecutiveWorkType } from "@/lib/executive-work";

export type LibraryEditorStorageType = "note" | "task";
export type LibraryItemEditorMode = ExecutiveCaptureType;

type ExecutiveCaptureMetadataPatch = Partial<Omit<ExecutiveCaptureMetadata, "captureType">> & {
  captureType: ExecutiveCaptureType;
};

function executiveCaptureTypeForWorkType(
  value: ExecutiveWorkType | null | undefined
): Exclude<ExecutiveCaptureType, "note" | "task"> | null {
  switch (value) {
    case "decision":
      return "decision";
    case "opportunity":
      return "opportunity";
    case "delegation":
      return "waiting_on";
    case "meeting":
      return "meeting_note";
    default:
      return null;
  }
}

export function resolveLibraryItemEditorMode(input: {
  type: LibraryEditorStorageType;
  captureType?: ExecutiveCaptureType | null;
  executiveWorkType?: ExecutiveWorkType | null;
}): LibraryItemEditorMode {
  return input.captureType ?? executiveCaptureTypeForWorkType(input.executiveWorkType) ?? input.type;
}

export function mergeExecutiveCaptureMetadata(
  existing: ExecutiveCaptureMetadata | null | undefined,
  patch: ExecutiveCaptureMetadataPatch
): ExecutiveCaptureMetadata {
  const merged: Record<string, unknown> = {
    ...(existing ?? {}),
    captureType: patch.captureType
  };

  for (const [key, value] of Object.entries(patch)) {
    if (key === "captureType" || value === undefined) {
      continue;
    }

    merged[key] = value;
  }

  return merged as ExecutiveCaptureMetadata;
}
