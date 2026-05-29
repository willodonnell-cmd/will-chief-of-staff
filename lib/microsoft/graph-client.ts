import "server-only";

const MICROSOFT_GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const MICROSOFT_FETCH_TIMEOUT_MS = 15_000;

type MicrosoftGraphError = {
  error?: {
    code?: string;
    message?: string;
  };
};

export async function fetchMicrosoftJson<T>(input: string, init: RequestInit, errorLabel: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MICROSOFT_FETCH_TIMEOUT_MS);
  timeout.unref?.();

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      let detail = `${response.status} ${response.statusText}`;

      try {
        const json = (await response.json()) as MicrosoftGraphError;
        detail = json.error?.message ?? detail;
      } catch {
        try {
          detail = await response.text();
        } catch {
          // Fall through to the default status text.
        }
      }

      throw new Error(`${errorLabel}: ${detail}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchMicrosoftGraphJson<T>(
  path: string,
  params: {
    accessToken: string;
    init?: RequestInit;
    errorLabel: string;
  }
) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(params.init?.headers);
  headers.set("Authorization", `Bearer ${params.accessToken}`);

  return await fetchMicrosoftJson<T>(
    `${MICROSOFT_GRAPH_BASE_URL}${normalizedPath}`,
    {
      ...params.init,
      headers
    },
    params.errorLabel
  );
}
