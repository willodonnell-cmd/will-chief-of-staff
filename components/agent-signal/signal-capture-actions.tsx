"use client";

import { useRouter } from "next/navigation";

import type { ChiefOfStaffSignal } from "@/lib/chief-of-staff-signal";
import {
  buildNoteCaptureDraftFromSignal,
  buildTaskCaptureDraftFromSignal,
  SIGNAL_CAPTURE_HANDOFF_STORAGE_PREFIX
} from "@/lib/signal-capture-drafts";

type SignalCaptureActionsProps = {
  signal: ChiefOfStaffSignal;
};

function storeSignalCaptureHandoff(signal: ChiefOfStaffSignal, pattern: "task" | "note") {
  const handoffId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${signal.id}-${pattern}-${Date.now()}`;
  const handoff =
    pattern === "task"
      ? buildTaskCaptureDraftFromSignal(signal)
      : buildNoteCaptureDraftFromSignal(signal);

  window.sessionStorage.setItem(
    `${SIGNAL_CAPTURE_HANDOFF_STORAGE_PREFIX}:${handoffId}`,
    JSON.stringify(handoff)
  );

  return handoffId;
}

export function SignalCaptureActions({ signal }: SignalCaptureActionsProps) {
  const router = useRouter();

  function handleCreate(pattern: "task" | "note") {
    const handoffId = storeSignalCaptureHandoff(signal, pattern);
    router.push(`/capture?from=%2Fagent-signal-brief&handoff=${encodeURIComponent(handoffId)}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => handleCreate("task")}
        className="rounded-full border border-line/75 bg-white/82 px-3.5 py-2 text-sm font-medium text-text transition hover:bg-white"
      >
        Create Task
      </button>
      <button
        type="button"
        onClick={() => handleCreate("note")}
        className="rounded-full border border-line/75 bg-white/72 px-3.5 py-2 text-sm text-text-muted transition hover:bg-white hover:text-text"
      >
        Create Note
      </button>
    </div>
  );
}
