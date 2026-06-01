"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  appendLibraryItemUpdate,
  archiveLibraryItem,
  createTaskFromNote,
  deleteLibraryItem,
  setLibraryTaskCompletion,
  updateExecutiveLibraryItemDetails,
  unarchiveLibraryItem,
  updateLibraryTaskDetails,
  updateLibraryItemWorkingCopy
} from "@/lib/capture-library";

function sanitizeLibraryPath(value: FormDataEntryValue | null | undefined, fallback: string) {
  if (typeof value !== "string" || (!value.startsWith("/library") && value !== "/commitments")) {
    return fallback;
  }

  return value;
}

function withFlash(path: string, key: "notice" | "error", value: string) {
  const url = new URL(path, "http://localhost");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

function revalidateLibraryPaths(captureId: string) {
  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath("/library/tasks");
  revalidatePath("/library/archived");
  revalidatePath(`/library/${captureId}`);
}

export async function updateWorkingContentAction(formData: FormData) {
  const captureId = String(formData.get("captureId") ?? "");
  const redirectTo = sanitizeLibraryPath(formData.get("redirectTo"), `/library/${captureId}`);
  const result = await updateLibraryItemWorkingCopy({
    captureId,
    title: String(formData.get("title") ?? ""),
    workingContent: String(formData.get("workingContent") ?? ""),
    linkedInitiativeId: String(formData.get("linkedInitiativeId") ?? "") || null
  });

  revalidateLibraryPaths(captureId);
  redirect(withFlash(redirectTo, result.ok ? "notice" : "error", result.ok ? "working-saved" : result.error) as Route);
}

export async function updateTaskDetailsAction(formData: FormData) {
  const captureId = String(formData.get("captureId") ?? "");
  const redirectTo = sanitizeLibraryPath(formData.get("redirectTo"), `/library/${captureId}`);
  const result = await updateLibraryTaskDetails({
    captureId,
    description: String(formData.get("description") ?? ""),
    nextStep: String(formData.get("nextStep") ?? ""),
    desiredOutcome: String(formData.get("desiredOutcome") ?? ""),
    status: String(formData.get("status") ?? ""),
    dueAt: String(formData.get("dueAt") ?? ""),
    priority: String(formData.get("priority") ?? ""),
    categoryId: String(formData.get("categoryId") ?? "") || null,
    linkedInitiativeId: String(formData.get("linkedInitiativeId") ?? "") || null
  });

  revalidateLibraryPaths(captureId);
  redirect(withFlash(redirectTo, result.ok ? "notice" : "error", result.ok ? "task-details-saved" : result.error) as Route);
}

export async function updateExecutiveDetailsAction(formData: FormData) {
  const captureId = String(formData.get("captureId") ?? "");
  const redirectTo = sanitizeLibraryPath(formData.get("redirectTo"), `/library/${captureId}`);
  const mode = String(formData.get("mode") ?? "");
  const result = await updateExecutiveLibraryItemDetails({
    captureId,
    mode:
      mode === "decision" || mode === "opportunity" || mode === "waiting_on" || mode === "meeting_note"
        ? mode
        : "decision",
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    description: String(formData.get("description") ?? ""),
    nextStep: String(formData.get("nextStep") ?? ""),
    desiredOutcome: String(formData.get("desiredOutcome") ?? ""),
    taskStatus: String(formData.get("taskStatus") ?? ""),
    dueAt: String(formData.get("dueAt") ?? ""),
    priority: String(formData.get("priority") ?? ""),
    categoryId: String(formData.get("categoryId") ?? "") || null,
    linkedInitiativeId: String(formData.get("linkedInitiativeId") ?? "") || null,
    metadataStatus: String(formData.get("metadataStatus") ?? ""),
    companyOrCounterparty: String(formData.get("companyOrCounterparty") ?? ""),
    strategicRelevance: String(formData.get("strategicRelevance") ?? ""),
    owner: String(formData.get("owner") ?? ""),
    nextAction: String(formData.get("nextAction") ?? ""),
    relatedCompany: String(formData.get("relatedCompany") ?? ""),
    relatedOpportunity: String(formData.get("relatedOpportunity") ?? ""),
    relatedPerson: String(formData.get("relatedPerson") ?? ""),
    decisionQuestion: String(formData.get("decisionQuestion") ?? ""),
    recommendation: String(formData.get("recommendation") ?? ""),
    optionsTradeoffs: String(formData.get("optionsTradeoffs") ?? ""),
    risks: String(formData.get("risks") ?? ""),
    peopleInvolved: String(formData.get("peopleInvolved") ?? ""),
    waitingOn: String(formData.get("waitingOn") ?? ""),
    expectedOutcome: String(formData.get("expectedOutcome") ?? ""),
    delegatedTo: String(formData.get("delegatedTo") ?? ""),
    lastTouch: String(formData.get("lastTouch") ?? ""),
    meetingTitle: String(formData.get("meetingTitle") ?? ""),
    meetingAt: String(formData.get("meetingAt") ?? ""),
    attendees: String(formData.get("attendees") ?? ""),
    decisions: String(formData.get("decisions") ?? ""),
    followUps: String(formData.get("followUps") ?? ""),
    waitingOnItems: String(formData.get("waitingOnItems") ?? "")
  });

  revalidateLibraryPaths(captureId);
  redirect(withFlash(redirectTo, result.ok ? "notice" : "error", result.ok ? "executive-details-saved" : result.error) as Route);
}

export async function createTaskFromNoteAction(formData: FormData) {
  const captureId = String(formData.get("captureId") ?? "");
  const redirectTo = sanitizeLibraryPath(formData.get("redirectTo"), `/library/${captureId}`);
  const result = await createTaskFromNote({
    captureId,
    description: String(formData.get("description") ?? ""),
    nextStep: String(formData.get("nextStep") ?? ""),
    desiredOutcome: String(formData.get("desiredOutcome") ?? ""),
    priority: String(formData.get("priority") ?? ""),
    categoryId: String(formData.get("categoryId") ?? "") || null,
    linkedInitiativeId: String(formData.get("linkedInitiativeId") ?? "") || null
  });

  revalidateLibraryPaths(captureId);
  if (!result.ok) {
    redirect(withFlash(redirectTo, "error", result.error) as Route);
  }

  redirect(withFlash(`/library/${result.object.captureId}?from=%2Flibrary%2Ftasks`, "notice", "task-created-from-note") as Route);
}

export async function appendUpdateAction(formData: FormData) {
  const captureId = String(formData.get("captureId") ?? "");
  const redirectTo = sanitizeLibraryPath(formData.get("redirectTo"), `/library/${captureId}`);
  const kind = formData.get("kind");
  const result = await appendLibraryItemUpdate({
    captureId,
    kind: kind === "comment" ? "comment" : "update",
    body: String(formData.get("body") ?? "")
  });

  revalidateLibraryPaths(captureId);
  redirect(withFlash(redirectTo, result.ok ? "notice" : "error", result.ok ? "update-added" : result.error) as Route);
}

export async function archiveLibraryItemAction(formData: FormData) {
  const captureId = String(formData.get("captureId") ?? "");
  const redirectTo = sanitizeLibraryPath(formData.get("redirectTo"), `/library/${captureId}`);
  const result = await archiveLibraryItem(captureId);

  revalidateLibraryPaths(captureId);
  redirect(withFlash(redirectTo, result.ok ? "notice" : "error", result.ok ? "item-archived" : result.error) as Route);
}

export async function unarchiveLibraryItemAction(formData: FormData) {
  const captureId = String(formData.get("captureId") ?? "");
  const redirectTo = sanitizeLibraryPath(formData.get("redirectTo"), `/library/${captureId}`);
  const result = await unarchiveLibraryItem(captureId);

  revalidateLibraryPaths(captureId);
  redirect(withFlash(redirectTo, result.ok ? "notice" : "error", result.ok ? "item-unarchived" : result.error) as Route);
}

export async function completeTaskAction(formData: FormData) {
  const captureId = String(formData.get("captureId") ?? "");
  const redirectTo = sanitizeLibraryPath(formData.get("redirectTo"), `/library/${captureId}`);
  const result = await setLibraryTaskCompletion(captureId, true);

  revalidateLibraryPaths(captureId);
  redirect(withFlash(redirectTo, result.ok ? "notice" : "error", result.ok ? "task-completed" : result.error) as Route);
}

export async function reopenTaskAction(formData: FormData) {
  const captureId = String(formData.get("captureId") ?? "");
  const redirectTo = sanitizeLibraryPath(formData.get("redirectTo"), `/library/${captureId}`);
  const result = await setLibraryTaskCompletion(captureId, false);

  revalidateLibraryPaths(captureId);
  redirect(withFlash(redirectTo, result.ok ? "notice" : "error", result.ok ? "task-reopened" : result.error) as Route);
}

export async function deleteLibraryItemAction(formData: FormData) {
  const captureId = String(formData.get("captureId") ?? "");
  const returnTo = sanitizeLibraryPath(formData.get("returnTo"), "/library");
  const result = await deleteLibraryItem(captureId);

  revalidateLibraryPaths(captureId);
  redirect(withFlash(returnTo, result.ok ? "notice" : "error", result.ok ? "item-deleted" : result.error) as Route);
}
