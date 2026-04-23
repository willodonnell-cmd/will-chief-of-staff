import { LibraryShell } from "@/components/library/library-shell";
import { listLibraryItems, parseLibraryQuery } from "@/lib/capture-library";

import { buildPathWithSearch, type LibrarySearchParams } from "./route-utils";

export default async function LibraryPage({
  searchParams
}: {
  searchParams: Promise<LibrarySearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = parseLibraryQuery(resolvedSearchParams, "library");
  const items = await listLibraryItems(query);

  return (
    <LibraryShell
      copy={{
        eyebrow: "Library",
        title: "Saved captures, kept in one working library.",
        description:
          "Library keeps notes and tasks in one retrieval system, ranked by most recent activity unless the task view needs stronger operational ordering."
      }}
      scope="library"
      items={items}
      query={query}
      currentPath={buildPathWithSearch("/library", resolvedSearchParams)}
    />
  );
}
