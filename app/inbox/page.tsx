import { PriorityInboxWorkspace } from "@/components/inbox/priority-inbox-workspace";
import { listInitiativeOptions } from "@/lib/initiatives";
import { ensureSeedPriorityInboxItems, listPriorityInboxItems } from "@/lib/priority-inbox-store";
import { shouldAutoSyncPriorityInboxSource, syncPriorityInboxSource } from "@/lib/priority-inbox-sources";
import { getTaskConfig } from "@/lib/task-config";

export default async function InboxPage() {
  await ensureSeedPriorityInboxItems();
  if (await shouldAutoSyncPriorityInboxSource("outlook")) {
    await syncPriorityInboxSource("outlook");
  }

  const [initialItems, taskConfig, initiatives] = await Promise.all([
    listPriorityInboxItems(),
    getTaskConfig(),
    listInitiativeOptions()
  ]);

  return (
    <PriorityInboxWorkspace
      initialItems={initialItems}
      categories={taskConfig.categories}
      commonCategories={taskConfig.commonCategories}
      initiatives={initiatives}
    />
  );
}
