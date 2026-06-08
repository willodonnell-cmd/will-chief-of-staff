"use server";

import { revalidatePath } from "next/cache";

export async function requestExecutiveBriefRefreshAction() {
  revalidatePath("/brief");
  revalidatePath("/agent-signal-brief");
}
