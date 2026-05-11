"use server";

import { revalidatePath } from "next/cache";

import {
  addManualPriorityInboxItem,
  deletePriorityInboxItem,
  demotePriorityInboxItem,
  getPriorityInboxContext,
  ingestForwardedPriorityInboxItem,
  openPriorityInboxSource,
  promotePriorityInboxItem,
  restorePriorityInboxItem,
  transitionPriorityInboxItem
} from "@/lib/priority-inbox-store";
import { forwardedEmailFixtures, parseForwardedEmail } from "@/lib/priority-inbox-forwarded";
import { syncPriorityInboxSource } from "@/lib/priority-inbox-sources";
import { updatePriorityInboxForwardingDestination } from "@/lib/priority-inbox-forwarding";
import type { PriorityInboxManualAddInput, PriorityInboxTransitionPayload } from "@/lib/priority-inbox";

function revalidatePriorityInbox() {
  revalidatePath("/inbox");
}

export async function addManualPriorityInboxItemAction(input: PriorityInboxManualAddInput) {
  const result = await addManualPriorityInboxItem(input);
  revalidatePriorityInbox();
  return result;
}

export async function openPriorityInboxSourceAction(itemId: string) {
  return await openPriorityInboxSource(itemId);
}

export async function transitionPriorityInboxItemAction(itemId: string, payload: PriorityInboxTransitionPayload) {
  const result = await transitionPriorityInboxItem(itemId, payload);
  revalidatePriorityInbox();
  return result;
}

export async function promotePriorityInboxItemAction(itemId: string) {
  const result = await promotePriorityInboxItem(itemId);
  revalidatePriorityInbox();
  return result;
}

export async function demotePriorityInboxItemAction(itemId: string) {
  const result = await demotePriorityInboxItem(itemId);
  revalidatePriorityInbox();
  return result;
}

export async function restorePriorityInboxItemAction(itemId: string) {
  const result = await restorePriorityInboxItem(itemId);
  revalidatePriorityInbox();
  return result;
}

export async function deletePriorityInboxItemAction(itemId: string) {
  const result = await deletePriorityInboxItem(itemId);
  revalidatePriorityInbox();
  return result;
}

export async function syncOutlookPriorityInboxAction() {
  const result = await syncPriorityInboxSource("outlook");
  revalidatePriorityInbox();
  return result;
}

export async function updatePriorityInboxForwardingDestinationAction(destinationAddress: string) {
  const result = await updatePriorityInboxForwardingDestination(destinationAddress);
  revalidatePriorityInbox();
  return result;
}

export async function ingestForwardedEmailFixtureAction(fixtureId: keyof typeof forwardedEmailFixtures) {
  const fixture = forwardedEmailFixtures[fixtureId];
  if (!fixture) {
    return {
      ok: false as const,
      error: "Forwarded email fixture could not be found."
    };
  }

  const context = await getPriorityInboxContext();
  if (!context || "error" in context) {
    return {
      ok: false as const,
      error: context && "error" in context ? context.error : "No active app user could be resolved for Priority Inbox."
    };
  }

  try {
    const item = await ingestForwardedPriorityInboxItem({
      client: context.client,
      userId: context.resolved.user.id,
      destinationAddress: fixture.destinationAddress,
      parsed: parseForwardedEmail(fixture)
    });

    revalidatePriorityInbox();
    return {
      ok: true as const,
      item: item.item
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Forwarded email fixture could not be ingested."
    };
  }
}

export async function ingestForwardedEmailRawAction(input: {
  destinationAddress: string;
  subject?: string | null;
  rawText: string;
}) {
  const context = await getPriorityInboxContext();
  if (!context || "error" in context) {
    return {
      ok: false as const,
      error: context && "error" in context ? context.error : "No active app user could be resolved for Priority Inbox."
    };
  }

  try {
    const item = await ingestForwardedPriorityInboxItem({
      client: context.client,
      userId: context.resolved.user.id,
      destinationAddress: input.destinationAddress,
      parsed: parseForwardedEmail({
        destinationAddress: input.destinationAddress,
        subject: input.subject,
        rawText: input.rawText
      })
    });

    revalidatePriorityInbox();
    return {
      ok: true as const,
      item: item.item
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Forwarded email could not be ingested."
    };
  }
}
