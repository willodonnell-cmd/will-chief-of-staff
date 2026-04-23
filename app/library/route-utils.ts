export type LibrarySearchParams = Record<string, string | string[] | undefined>;

function appendParam(params: URLSearchParams, key: string, value: string | string[] | undefined) {
  if (typeof value === "string" && value) {
    params.set(key, value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (item) {
        params.append(key, item);
      }
    }
  }
}

export function buildPathWithSearch(basePath: string, searchParams: LibrarySearchParams) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    appendParam(params, key, value);
  }

  const value = params.toString();
  return value ? `${basePath}?${value}` : basePath;
}

export function sanitizeLibraryFromPath(value: string | string[] | undefined, fallback: string) {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first || (!first.startsWith("/library") && first !== "/commitments")) {
    return fallback;
  }

  return first;
}
