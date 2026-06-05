import {
  createMicrosoftGraphConnectionRepository,
  decryptMicrosoftGraphConnectionTokens,
  refreshMicrosoftGraphAccessToken,
  updateEncryptedMicrosoftGraphConnectionTokens
} from "@/lib/microsoft-graph/auth";
import type {
  MicrosoftGraphConnectionRepository,
  MicrosoftGraphConnectionRow,
  MicrosoftGraphRequestIssueKind
} from "@/lib/microsoft-graph/types";

const MICROSOFT_GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const MICROSOFT_GRAPH_FETCH_TIMEOUT_MS = 20_000;
const MICROSOFT_GRAPH_REFRESH_WINDOW_MS = 5 * 60 * 1000;

type FetchImpl = typeof fetch;

type GraphErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class MicrosoftGraphConnectionRequiredError extends Error {
  code = "microsoft_not_connected" as const;
}

export class MicrosoftGraphRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null,
    public readonly issueKind: MicrosoftGraphRequestIssueKind,
    public readonly retryAfter: string | null = null
  ) {
    super(message);
  }
}

function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error("Microsoft Graph client is only available on the server.");
  }
}

function normalizeGraphUrl(input: string) {
  if (/^https:\/\//i.test(input)) {
    return input;
  }

  return `${MICROSOFT_GRAPH_BASE_URL}${input.startsWith("/") ? input : `/${input}`}`;
}

function issueKindForStatus(status: number): MicrosoftGraphRequestIssueKind {
  if (status === 401) {
    return "auth";
  }

  if (status === 403) {
    return "permission";
  }

  if (status === 404) {
    return "not_found";
  }

  if (status === 429) {
    return "rate_limit";
  }

  return "unknown";
}

async function parseGraphError(response: Response): Promise<{ code: string | null; message: string }> {
  try {
    const body = (await response.json()) as GraphErrorBody;
    return {
      code: body.error?.code ?? null,
      message: body.error?.message ?? `${response.status} ${response.statusText}`
    };
  } catch {
    return {
      code: null,
      message: `${response.status} ${response.statusText}`
    };
  }
}

export class MicrosoftGraphClient {
  constructor(
    private accessToken: string,
    private readonly fetchImpl: FetchImpl = fetch
  ) {}

  async getJson<TResponse>(pathOrUrl: string, init: RequestInit = {}): Promise<TResponse> {
    assertServerOnly();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MICROSOFT_GRAPH_FETCH_TIMEOUT_MS);
    timeout.unref?.();

    try {
      const response = await this.fetchImpl(normalizeGraphUrl(pathOrUrl), {
        ...init,
        method: "GET",
        headers: {
          ...(init.headers ?? {}),
          Authorization: `Bearer ${this.accessToken}`
        },
        signal: controller.signal,
        cache: "no-store"
      });

      if (!response.ok) {
        const parsed = await parseGraphError(response);
        throw new MicrosoftGraphRequestError(
          parsed.message,
          response.status,
          parsed.code,
          issueKindForStatus(response.status),
          response.headers.get("retry-after")
        );
      }

      return (await response.json()) as TResponse;
    } catch (error) {
      if (error instanceof MicrosoftGraphRequestError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new MicrosoftGraphRequestError("Microsoft Graph request timed out.", 0, null, "network");
      }

      throw new MicrosoftGraphRequestError(
        error instanceof Error ? error.message : "Microsoft Graph request failed.",
        0,
        null,
        "network"
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async getJsonPages<TItem>(
    pathOrUrl: string,
    init: RequestInit = {}
  ): Promise<TItem[]> {
    const items: TItem[] = [];
    let nextUrl: string | null = pathOrUrl;

    while (nextUrl) {
      const page: {
        value?: TItem[];
        "@odata.nextLink"?: string;
      } = await this.getJson(nextUrl, init);

      items.push(...(page.value ?? []));
      nextUrl = page["@odata.nextLink"] ?? null;
    }

    return items;
  }
}

function shouldRefresh(connection: MicrosoftGraphConnectionRow) {
  const expiresAt = Date.parse(connection.expires_at);
  return Number.isNaN(expiresAt) || expiresAt - Date.now() < MICROSOFT_GRAPH_REFRESH_WINDOW_MS;
}

export async function getMicrosoftGraphClientForUser(params: {
  userId: string;
  repository?: MicrosoftGraphConnectionRepository;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: FetchImpl;
}) {
  assertServerOnly();

  const repository = params.repository ?? createMicrosoftGraphConnectionRepository();
  const connection = await repository.loadActiveConnection(params.userId);
  if (!connection) {
    throw new MicrosoftGraphConnectionRequiredError("Connect Microsoft 365 to run native Blackhawk signal pulls.");
  }

  let resolvedConnection = connection;
  let tokens = decryptMicrosoftGraphConnectionTokens(connection, params.env);

  if (shouldRefresh(connection)) {
    const refreshedTokens = await refreshMicrosoftGraphAccessToken({
      refreshToken: tokens.refreshToken,
      env: params.env,
      fetchImpl: params.fetchImpl
    });
    resolvedConnection = await updateEncryptedMicrosoftGraphConnectionTokens({
      connectionId: connection.id,
      existingRefreshTokenEncrypted: connection.refresh_token_encrypted,
      tokens: refreshedTokens,
      repository,
      env: params.env
    });
    tokens = decryptMicrosoftGraphConnectionTokens(resolvedConnection, params.env);
  }

  return {
    client: new MicrosoftGraphClient(tokens.accessToken, params.fetchImpl),
    connection: resolvedConnection
  };
}
