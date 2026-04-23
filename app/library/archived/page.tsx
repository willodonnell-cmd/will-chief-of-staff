import { LibraryShell } from "@/components/library/library-shell";
import { listLibraryItems, parseLibraryQuery } from "@/lib/capture-library";

import { buildPathWithSearch, type LibrarySearchParams } from "../route-utils";

export default async function ArchivedLibraryPage({
  searchParams
}: {
  searchParams: Promise<LibrarySearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = parseLibraryQuery(resolvedSearchParams, "archived");
  const items = await listLibraryItems(query);

  return (
    <LibraryShell
      copy={{
        eyebrow: "Library / Archived",
        title: "Archived captures stay reachable, but out of the active library.",
        description:
          "Archived items remain searchable and reversible here without taking a top-level position in the main shell."
      }}
      scope="archived"
      items={items}
      query={query}
      currentPath={buildPathWithSearch("/library/archived", resolvedSearchParams)}
    />
  );
}
