import type { BlackhawkM365SignalAgentConfig } from "../config";
import type { BlackhawkSignalPayload } from "../payload/schemas";
import { parseBlackhawkImportSuccess } from "../payload/validators";
import { retry } from "../utils/retry";
import { redactSensitiveText, sanitizeErrorMessage } from "../utils/redact";

export type PendingRunRequest = {
  id: string;
  status: string;
  requestedAt: string;
  expiresAt: string;
  requestContext: Record<string, unknown>;
};

export class BlackhawkHttpError extends Error {
  statusCode: number;
  responseBody: string;
  retryable: boolean;

  constructor(message: string, options: { statusCode: number; responseBody: string; retryable?: boolean }) {
    super(message);
    this.name = "BlackhawkHttpError";
    this.statusCode = options.statusCode;
    this.responseBody = options.responseBody;
    this.retryable = options.retryable ?? options.statusCode >= 500;
  }
}

export class BlackhawkClaimConflictError extends Error {
  constructor(message = "The manual request was already claimed by another worker.") {
    super(message);
    this.name = "BlackhawkClaimConflictError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trimString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parsePendingRequest(input: unknown): PendingRunRequest {
  if (!isRecord(input)) {
    throw new Error("Pending request must be an object.");
  }

  return {
    id: trimString(input.id) ?? "",
    status: trimString(input.status) ?? "requested",
    requestedAt: trimString(input.requestedAt) ?? trimString(input.requested_at) ?? "",
    expiresAt: trimString(input.expiresAt) ?? trimString(input.expires_at) ?? "",
    requestContext: isRecord(input.requestContext)
      ? input.requestContext
      : isRecord(input.request_context)
        ? input.request_context
        : {}
  };
}

export class BlackhawkClient {
  private readonly baseUrl: string;
  private readonly secret: string;
  private readonly timeoutMs: number;

  constructor(config: Pick<BlackhawkM365SignalAgentConfig, "blackhawkBaseUrl" | "blackhawkImportSecret" | "requestTimeoutMs">) {
    this.baseUrl = config.blackhawkBaseUrl;
    this.secret = config.blackhawkImportSecret;
    this.timeoutMs = config.requestTimeoutMs;
  }

  async getPendingRunRequests() {
    const response = await this.request("/api/agent-run-requests/pending", {
      method: "GET"
    });
    const body = await this.parseJson(response);
    if (!isRecord(body) || !Array.isArray(body.requests)) {
      throw new Error("Blackhawk pending request response was malformed.");
    }

    return body.requests
      .map((request) => parsePendingRequest(request))
      .filter((request) => request.id && request.requestedAt && request.expiresAt);
  }

  async claimRunRequest(requestId: string) {
    const response = await this.request(`/api/agent-run-requests/${encodeURIComponent(requestId)}/claim`, {
      method: "POST"
    });
    const body = await this.parseJson(response);
    if (!isRecord(body) || !isRecord(body.request)) {
      throw new Error("Blackhawk claim response was malformed.");
    }

    return parsePendingRequest(body.request);
  }

  async importSignals(
    payload: BlackhawkSignalPayload,
    options: {
      manualRunRequestId?: string | null;
      idempotencyKey?: string | null;
    } = {}
  ) {
    const headers = new Headers({
      "content-type": "application/json",
      "x-agent-signals-import-secret": this.secret
    });

    if (options.manualRunRequestId) {
      headers.set("x-agent-run-request-id", options.manualRunRequestId);
    }

    if (options.idempotencyKey) {
      headers.set("x-idempotency-key", options.idempotencyKey);
    }

    const response = await this.request("/api/agent-signals/import", {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    return parseBlackhawkImportSuccess(await this.parseJson(response));
  }

  async completeRunRequest(requestId: string, runId: string) {
    await this.request(`/api/agent-run-requests/${encodeURIComponent(requestId)}/complete`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        agentSignalRunId: runId
      })
    });
  }

  async failRunRequest(requestId: string, errorMessage: string) {
    await this.request(`/api/agent-run-requests/${encodeURIComponent(requestId)}/fail`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        errorMessage
      })
    });
  }

  async retrySafeFailRunRequest(requestId: string, errorMessage: string) {
    await retry(() => this.failRunRequest(requestId, errorMessage), {
      attempts: 3,
      shouldRetry: (error) => error instanceof BlackhawkHttpError && error.retryable
    });
  }

  private async request(path: string, init: RequestInit) {
    return await retry(
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        timeout.unref?.();

        try {
          const headers = new Headers(init.headers);
          if (!headers.has("x-agent-signals-import-secret")) {
            headers.set("x-agent-signals-import-secret", this.secret);
          }

          const response = await fetch(`${this.baseUrl}${path}`, {
            ...init,
            headers,
            cache: "no-store",
            signal: controller.signal
          });

          if (response.status === 409 && path.endsWith("/claim")) {
            throw new BlackhawkClaimConflictError();
          }

          if (!response.ok) {
            const responseBody = await response.text().catch(() => "");
            throw new BlackhawkHttpError(
              `Blackhawk request failed with ${response.status} ${response.statusText}.`,
              {
                statusCode: response.status,
                responseBody: redactSensitiveText(responseBody, [this.secret])
              }
            );
          }

          return response;
        } finally {
          clearTimeout(timeout);
        }
      },
      {
        attempts: 3,
        shouldRetry: (error) =>
          error instanceof BlackhawkHttpError ? error.retryable : !(error instanceof BlackhawkClaimConflictError)
      }
    );
  }

  private async parseJson(response: Response) {
    try {
      return (await response.json()) as unknown;
    } catch (error) {
      throw new Error(
        sanitizeErrorMessage(error, {
          secrets: [this.secret],
          fallback: "Blackhawk returned invalid JSON."
        })
      );
    }
  }
}
