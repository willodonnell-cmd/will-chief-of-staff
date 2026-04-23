import { notFound } from "next/navigation";

import { LibraryDetail } from "@/components/library/library-detail";
import { getLibraryItemDetail } from "@/lib/capture-library";

import { sanitizeLibraryFromPath, type LibrarySearchParams } from "../route-utils";

type DetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<LibrarySearchParams>;
};

function backLabelForPath(path: string) {
  if (path === "/commitments") {
    return "Back to commitments";
  }

  if (path === "/library/tasks") {
    return "Back to tasks";
  }

  if (path === "/library/archived") {
    return "Back to archived library";
  }

  return "Back to library";
}

function fallbackReturnPath(item: Awaited<ReturnType<typeof getLibraryItemDetail>>) {
  if (!item) {
    return "/library";
  }

  if (item.status === "archived") {
    return "/library/archived";
  }

  if (item.type === "task") {
    return "/library/tasks";
  }

  return "/library";
}

export default async function LibraryDetailPage({ params, searchParams }: DetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const item = await getLibraryItemDetail(id);

  if (!item) {
    notFound();
  }

  const returnTo = sanitizeLibraryFromPath(resolvedSearchParams.from, fallbackReturnPath(item));
  const redirectTo = resolvedSearchParams.from
    ? `/library/${item.id}?from=${encodeURIComponent(returnTo)}`
    : `/library/${item.id}`;

  const notice = Array.isArray(resolvedSearchParams.notice)
    ? resolvedSearchParams.notice[0]
    : resolvedSearchParams.notice;
  const error = Array.isArray(resolvedSearchParams.error) ? resolvedSearchParams.error[0] : resolvedSearchParams.error;

  return (
    <LibraryDetail
      item={item}
      backHref={returnTo}
      backLabel={backLabelForPath(returnTo)}
      redirectTo={redirectTo}
      returnTo={returnTo}
      notice={notice}
      error={error}
    />
  );
}
