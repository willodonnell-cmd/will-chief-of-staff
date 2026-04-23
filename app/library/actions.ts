"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  appendLibraryItemUpdate,
  archiveLibraryItem,
  deleteLibraryItem,
  setLibraryTaskCompletion,
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
    workingContent: String(formData.get("workingContent") ?? "")
  });

  revalidateLibraryPaths(captureId);
  redirect(withFlash(redirectTo, result.ok ? "notice" : "error", result.ok ? "working-saved" : result.error) as Route);
}

export async function updateTaskDetailsAction(formData: FormData) {
  const captureId = String(formData.get("captureId") ?? "");
  const redirectTo = sanitizeLibraryPath(formData.get("redirectTo"), `/library/${captureId}`);
  const result = await updateLibraryTaskDetails({
    captureId,
    title: String(formData.get("title") ?? ""),
    status: String(formData.get("status") ?? ""),
    dueAt: String(formData.get("dueAt") ?? ""),
    priority: String(formData.get("priority") ?? "")
  });

  revalidateLibraryPaths(captureId);
  redirect(withFlash(redirectTo, result.ok ? "notice" : "error", result.ok ? "task-details-saved" : result.error) as Route);
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
