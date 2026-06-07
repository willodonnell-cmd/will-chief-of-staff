"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { saveInvestmentCommitteeWillNotes } from "@/lib/investment-committee";

function withFlash(key: "notice" | "error", value: string) {
  const url = new URL("/investment-committee", "http://localhost");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

function revalidateInvestmentCommitteePaths() {
  revalidatePath("/investment-committee");
  revalidatePath("/");
  revalidatePath("/inbox");
}

export async function saveInvestmentCommitteeWillNotesAction(formData: FormData) {
  const result = await saveInvestmentCommitteeWillNotes({
    weekOf: String(formData.get("weekOf") ?? ""),
    title: String(formData.get("title") ?? ""),
    memoUrl: String(formData.get("memoUrl") ?? ""),
    note: String(formData.get("note") ?? ""),
    boxFolderUrl: String(formData.get("boxFolderUrl") ?? ""),
    meetingDate: String(formData.get("meetingDate") ?? ""),
    questionsDueAt: String(formData.get("questionsDueAt") ?? "")
  });

  revalidateInvestmentCommitteePaths();
  redirect(withFlash(result.ok ? "notice" : "error", result.ok ? "notes-saved" : result.error) as Route);
}
