import { PriorityInboxWorkspace } from "@/components/inbox/priority-inbox-workspace";
import { listInitiativeOptions } from "@/lib/initiatives";
import { getPriorityInboxForwardingSummary } from "@/lib/priority-inbox-forwarding";
import { ensureSeedPriorityInboxItems, listPriorityInboxItems } from "@/lib/priority-inbox-store";
import {
  buildPriorityInboxSourceStatuses,
  getPriorityInboxSourceConnectionSummary,
  shouldAutoSyncPriorityInboxSource,
  syncPriorityInboxSource
} from "@/lib/priority-inbox-sources";
import { getTaskConfig } from "@/lib/task-config";

export default async function InboxPage({
  searchParams
}: {
  searchParams: Promise<{ manual?: string; outlook?: string; outlook_message?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  await ensureSeedPriorityInboxItems();
  if (await shouldAutoSyncPriorityInboxSource("outlook")) {
    await syncPriorityInboxSource("outlook");
  }

  const outlookConnection = await getPriorityInboxSourceConnectionSummary("outlook");
  const [forwardingSummary, initialItems, taskConfig, initiatives] = await Promise.all([
    getPriorityInboxForwardingSummary(),
    listPriorityInboxItems(),
    getTaskConfig(),
    listInitiativeOptions()
  ]);
  const sourceStatuses = buildPriorityInboxSourceStatuses({
    outlook: outlookConnection,
    forwarding: forwardingSummary
  });
  const initialNotice =
    resolvedSearchParams.outlook === "connected"
      ? "Outlook connected and synced into Priority Inbox."
      : resolvedSearchParams.outlook === "error"
        ? resolvedSearchParams.outlook_message || "Outlook connection could not be completed."
        : resolvedSearchParams.outlook === "not_configured"
          ? "Outlook integration is not configured yet."
          : null;

  return (
    <PriorityInboxWorkspace
      initialItems={initialItems}
      initialManualComposerOpen={resolvedSearchParams.manual === "1"}
      outlookConnection={outlookConnection}
      forwardingSummary={forwardingSummary}
      sourceStatuses={sourceStatuses}
      initialNotice={initialNotice}
      categories={taskConfig.categories}
      commonCategories={taskConfig.commonCategories}
      initiatives={initiatives}
    />
  );
}
