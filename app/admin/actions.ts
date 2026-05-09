"use server";

import { revalidatePath } from "next/cache";

import {
  createTaskCategory,
  deactivateTaskCategory,
  moveTaskCategory,
  renameTaskCategory,
  updateTaskCaptureSettings
} from "@/lib/task-config";

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/capture");
  revalidatePath("/inbox");
  revalidatePath("/library");
  revalidatePath("/library/tasks");
}

export async function createTaskCategoryAction(formData: FormData) {
  await createTaskCategory(String(formData.get("name") ?? ""));
  revalidateAdmin();
}

export async function renameTaskCategoryAction(formData: FormData) {
  await renameTaskCategory(String(formData.get("categoryId") ?? ""), String(formData.get("name") ?? ""));
  revalidateAdmin();
}

export async function moveTaskCategoryUpAction(formData: FormData) {
  await moveTaskCategory(String(formData.get("categoryId") ?? ""), "up");
  revalidateAdmin();
}

export async function moveTaskCategoryDownAction(formData: FormData) {
  await moveTaskCategory(String(formData.get("categoryId") ?? ""), "down");
  revalidateAdmin();
}

export async function deactivateTaskCategoryAction(formData: FormData) {
  await deactivateTaskCategory(String(formData.get("categoryId") ?? ""));
  revalidateAdmin();
}

export async function updateTaskCaptureSettingsAction(formData: FormData) {
  await updateTaskCaptureSettings({
    expandNextStepByDefault: formData.get("expandNextStepByDefault") === "on",
    expandDesiredOutcomeByDefault: formData.get("expandDesiredOutcomeByDefault") === "on"
  });
  revalidateAdmin();
}
