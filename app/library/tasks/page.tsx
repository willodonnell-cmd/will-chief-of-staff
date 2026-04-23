import { LibraryShell } from "@/components/library/library-shell";
import { listLibraryItems, parseLibraryQuery } from "@/lib/capture-library";

import { buildPathWithSearch, type LibrarySearchParams } from "../route-utils";

export default async function LibraryTasksPage({
  searchParams
}: {
  searchParams: Promise<LibrarySearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = parseLibraryQuery(resolvedSearchParams, "tasks");
  const items = await listLibraryItems(query);

  return (
    <LibraryShell
      copy={{
        eyebrow: "Library / Tasks",
        title: "Tasks ordered for action before chronology.",
        description:
          "Active overdue tasks lead, then active tasks with upcoming due dates, then active tasks with no due date by recent activity, with completed work held last."
      }}
      scope="tasks"
      items={items}
      query={query}
      currentPath={buildPathWithSearch("/library/tasks", resolvedSearchParams)}
    />
  );
}
