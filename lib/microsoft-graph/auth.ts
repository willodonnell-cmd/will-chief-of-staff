import { randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptToken, encryptToken } from "@/lib/security/token-encryption";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveCurrentAppUser } from "@/lib/supabase/current-user";
import { withSupabaseTimeout } from "@/lib/supabase/request-timeout";
import {
  MICROSOFT_GRAPH_DEFAULT_SCOPES,
  type MicrosoftGraphConnectionInsert,
  type MicrosoftGraphConnectionMetadata,
  type MicrosoftGraphConnectionRepository,
  type MicrosoftGraphConnectionRow,
  type MicrosoftGraphConnectionStatus,
  type MicrosoftGraphConnectionTokenUpdate,
  type MicrosoftGraphProfile,
  type MicrosoftGraphProfileResponse,
  type MicrosoftGraphTokenResponse,
  type MicrosoftGraphTokenSet
} from "@/lib/microsoft-graph/types";

const MICROSOFT_GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const MICROSOFT_GRAPH_FETCH_TIMEOUT_MS = 15_000;
export const MICROSOFT_GRAPH_OAUTH_STATE_COOKIE = "blackhawk_microsoft_graph_oauth_state";
const MICROSOFT_GRAPH_CONNECTION_SELECT = `
  id,
  user_id,
  tenant_id,
  microsoft_user_id,
  email,
  display_name,
  access_token_encrypted,
  refresh_token_encrypted,
  expires_at,
  scopes,
  connected_at,
  last_refreshed_at,
  revoked_at,
  created_at,
  updated_at
`;
const MICROSOFT_GRAPH_CONNECTION_METADATA_SELECT = `
  id,
  user_id,
  tenant_id,
  microsoft_user_id,
  email,
  display_name,
  expires_at,
  scopes,
  connected_at,
  last_refreshed_at,
  revoked_at,
  created_at,
  updated_at
`;

type FetchImpl = typeof fetch;

export class MicrosoftGraphConfigurationError extends Error {}
export class MicrosoftGraphAuthError extends Error {}

function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error("Microsoft Graph auth helpers are only available on the server.");
  }
}

function trim(value: string | undefined) {
  return value?.trim() ?? "";
}

export function getMicrosoftGraphTenantId(env: NodeJS.ProcessEnv = process.env) {
  return trim(env.MICROSOFT_GRAPH_TENANT_ID) || "organizations";
}

export function parseMicrosoftGraphScopes(value: string | undefined) {
  const scopes = value
    ?.split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

  return scopes && scopes.length > 0 ? scopes : [...MICROSOFT_GRAPH_DEFAULT_SCOPES];
}

export function getMicrosoftGraphScopes(env: NodeJS.ProcessEnv = process.env) {
  return parseMicrosoftGraphScopes(env.MICROSOFT_GRAPH_SCOPES);
}

export function resolveMicrosoftGraphRedirectUri(origin: string, env: NodeJS.ProcessEnv = process.env) {
  return trim(env.MICROSOFT_GRAPH_REDIRECT_URI) || `${origin}/api/microsoft/callback`;
}

export function getMicrosoftGraphMissingConfiguration(env: NodeJS.ProcessEnv = process.env) {
  return [
    ["MICROSOFT_GRAPH_CLIENT_ID", trim(env.MICROSOFT_GRAPH_CLIENT_ID)],
    ["MICROSOFT_GRAPH_CLIENT_SECRET", trim(env.MICROSOFT_GRAPH_CLIENT_SECRET)],
    ["MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY", trim(env.MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY)]
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

export function isMicrosoftGraphConfigured(env: NodeJS.ProcessEnv = process.env) {
  return getMicrosoftGraphMissingConfiguration(env).length === 0;
}

function getMicrosoftGraphTokenEndpoint(env: NodeJS.ProcessEnv = process.env) {
  return `https://login.microsoftonline.com/${encodeURIComponent(getMicrosoftGraphTenantId(env))}/oauth2/v2.0/token`;
}

function getMicrosoftGraphAuthorizeEndpoint(env: NodeJS.ProcessEnv = process.env) {
  return `https://login.microsoftonline.com/${encodeURIComponent(getMicrosoftGraphTenantId(env))}/oauth2/v2.0/authorize`;
}

export function generateMicrosoftGraphOAuthState() {
  assertServerOnly();
  return randomBytes(32).toString("base64url");
}

export function verifyMicrosoftGraphOAuthState(returnedState: string | null, expectedState: string | null) {
  if (!returnedState || !expectedState) {
    return false;
  }

  const returned = Buffer.from(returnedState);
  const expected = Buffer.from(expectedState);

  return returned.length === expected.length && timingSafeEqual(returned, expected);
}

export function buildMicrosoftGraphAuthorizationUrl(params: {
  state: string;
  redirectUri: string;
  env?: NodeJS.ProcessEnv;
}) {
  const env = params.env ?? process.env;
  const missing = getMicrosoftGraphMissingConfiguration(env).filter(
    (name) => name !== "MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY"
  );
  if (missing.length > 0) {
    throw new MicrosoftGraphConfigurationError(
      `Microsoft Graph OAuth is missing configuration: ${missing.join(", ")}.`
    );
  }

  const query = new URLSearchParams({
    client_id: trim(env.MICROSOFT_GRAPH_CLIENT_ID),
    response_type: "code",
    redirect_uri: params.redirectUri,
    response_mode: "query",
    scope: getMicrosoftGraphScopes(env).join(" "),
    state: params.state,
    prompt: "select_account"
  });

  return `${getMicrosoftGraphAuthorizeEndpoint(env)}?${query.toString()}`;
}

async function fetchJson<TResponse>(
  input: string,
  init: RequestInit,
  errorLabel: string,
  fetchImpl: FetchImpl = fetch
): Promise<TResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MICROSOFT_GRAPH_FETCH_TIMEOUT_MS);
  timeout.unref?.();

  try {
    const response = await fetchImpl(input, {
      ...init,
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      let detail = `${response.status} ${response.statusText}`;
      try {
        const body = (await response.json()) as { error?: { message?: string; code?: string } };
        detail = body.error?.message ?? body.error?.code ?? detail;
      } catch {
        // Keep the safe status text.
      }

      throw new MicrosoftGraphAuthError(`${errorLabel}: ${detail}`);
    }

    return (await response.json()) as TResponse;
  } finally {
    clearTimeout(timeout);
  }
}

function mapTokenResponse(response: MicrosoftGraphTokenResponse): MicrosoftGraphTokenSet {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token ?? null,
    expiresAt: new Date(Date.now() + response.expires_in * 1000).toISOString(),
    scopes: (response.scope ?? getMicrosoftGraphScopes().join(" ")).split(/\s+/).filter(Boolean)
  };
}

export async function exchangeMicrosoftGraphCodeForTokens(params: {
  code: string;
  redirectUri: string;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: FetchImpl;
}) {
  assertServerOnly();
  const env = params.env ?? process.env;
  const missing = getMicrosoftGraphMissingConfiguration(env).filter(
    (name) => name !== "MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY"
  );
  if (missing.length > 0) {
    throw new MicrosoftGraphConfigurationError(
      `Microsoft Graph token exchange is missing configuration: ${missing.join(", ")}.`
    );
  }

  const body = new URLSearchParams({
    client_id: trim(env.MICROSOFT_GRAPH_CLIENT_ID),
    client_secret: trim(env.MICROSOFT_GRAPH_CLIENT_SECRET),
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    scope: getMicrosoftGraphScopes(env).join(" ")
  });

  const response = await fetchJson<MicrosoftGraphTokenResponse>(
    getMicrosoftGraphTokenEndpoint(env),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    },
    "Microsoft Graph token exchange failed",
    params.fetchImpl
  );

  const tokens = mapTokenResponse(response);
  if (!tokens.refreshToken) {
    throw new MicrosoftGraphAuthError("Microsoft Graph did not return a refresh token. Reconnect with offline_access.");
  }

  return tokens;
}

export async function refreshMicrosoftGraphAccessToken(params: {
  refreshToken: string;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: FetchImpl;
}) {
  assertServerOnly();
  const env = params.env ?? process.env;
  const missing = getMicrosoftGraphMissingConfiguration(env).filter(
    (name) => name !== "MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY"
  );
  if (missing.length > 0) {
    throw new MicrosoftGraphConfigurationError(
      `Microsoft Graph token refresh is missing configuration: ${missing.join(", ")}.`
    );
  }

  const body = new URLSearchParams({
    client_id: trim(env.MICROSOFT_GRAPH_CLIENT_ID),
    client_secret: trim(env.MICROSOFT_GRAPH_CLIENT_SECRET),
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    scope: getMicrosoftGraphScopes(env).join(" ")
  });

  return mapTokenResponse(
    await fetchJson<MicrosoftGraphTokenResponse>(
      getMicrosoftGraphTokenEndpoint(env),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      },
      "Microsoft Graph token refresh failed",
      params.fetchImpl
    )
  );
}

export function normalizeMicrosoftGraphProfile(profile: MicrosoftGraphProfileResponse): MicrosoftGraphProfile {
  return {
    id: profile.id,
    displayName: profile.displayName?.trim() || null,
    email: profile.mail?.trim() || profile.userPrincipalName?.trim() || null
  };
}

export async function fetchMicrosoftGraphProfile(accessToken: string, fetchImpl: FetchImpl = fetch) {
  return normalizeMicrosoftGraphProfile(
    await fetchJson<MicrosoftGraphProfileResponse>(
      `${MICROSOFT_GRAPH_BASE_URL}/me?$select=id,displayName,mail,userPrincipalName`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      },
      "Microsoft Graph profile fetch failed",
      fetchImpl
    )
  );
}

function mapConnectionMetadata(row: MicrosoftGraphConnectionMetadata): MicrosoftGraphConnectionMetadata {
  return {
    ...row,
    scopes: row.scopes ?? []
  };
}

export function createMicrosoftGraphConnectionRepository(
  client?: SupabaseClient | null
): MicrosoftGraphConnectionRepository {
  assertServerOnly();

  const resolvedClient = client ?? createSupabaseAdminClient();
  if (!resolvedClient) {
    throw new MicrosoftGraphConfigurationError(
      "SUPABASE_SERVICE_ROLE_KEY is required for Microsoft Graph connection storage."
    );
  }

  return {
    client: resolvedClient,
    async loadActiveConnection(userId) {
      const response = await withSupabaseTimeout(
        resolvedClient
          .from("microsoft_graph_connections")
          .select(MICROSOFT_GRAPH_CONNECTION_SELECT)
          .eq("user_id", userId)
          .is("revoked_at", null)
          .order("connected_at", { ascending: false })
          .limit(1)
          .maybeSingle<MicrosoftGraphConnectionRow>()
      );

      if (response.error) {
        throw new Error(response.error.message ?? "Microsoft Graph connection could not be read.");
      }

      return response.data ? { ...response.data, scopes: response.data.scopes ?? [] } : null;
    },
    async loadActiveConnectionMetadata(userId) {
      const response = await withSupabaseTimeout(
        resolvedClient
          .from("microsoft_graph_connections")
          .select(MICROSOFT_GRAPH_CONNECTION_METADATA_SELECT)
          .eq("user_id", userId)
          .is("revoked_at", null)
          .order("connected_at", { ascending: false })
          .limit(1)
          .maybeSingle<MicrosoftGraphConnectionMetadata>()
      );

      if (response.error) {
        throw new Error(response.error.message ?? "Microsoft Graph connection metadata could not be read.");
      }

      return response.data ? mapConnectionMetadata(response.data) : null;
    },
    async storeConnection(row) {
      const now = new Date().toISOString();
      await this.markRevoked(row.user_id, now);

      const response = await withSupabaseTimeout(
        resolvedClient
          .from("microsoft_graph_connections")
          .insert(row)
          .select(MICROSOFT_GRAPH_CONNECTION_METADATA_SELECT)
          .single<MicrosoftGraphConnectionMetadata>()
      );

      if (response.error || !response.data) {
        throw new Error(response.error?.message ?? "Microsoft Graph connection could not be stored.");
      }

      return mapConnectionMetadata(response.data);
    },
    async updateTokens(connectionId, row) {
      const response = await withSupabaseTimeout(
        resolvedClient
          .from("microsoft_graph_connections")
          .update(row)
          .eq("id", connectionId)
          .select(MICROSOFT_GRAPH_CONNECTION_SELECT)
          .single<MicrosoftGraphConnectionRow>()
      );

      if (response.error || !response.data) {
        throw new Error(response.error?.message ?? "Microsoft Graph tokens could not be refreshed.");
      }

      return { ...response.data, scopes: response.data.scopes ?? [] };
    },
    async markRevoked(userId, revokedAt) {
      const response = await withSupabaseTimeout(
        resolvedClient
          .from("microsoft_graph_connections")
          .update({ revoked_at: revokedAt })
          .eq("user_id", userId)
          .is("revoked_at", null)
          .select("id")
      );

      if (response.error) {
        throw new Error(response.error.message ?? "Microsoft Graph connection could not be revoked.");
      }

      return response.data?.length ?? 0;
    }
  };
}

export async function storeEncryptedMicrosoftGraphConnection(params: {
  userId: string;
  tenantId?: string | null;
  profile: MicrosoftGraphProfile;
  tokens: MicrosoftGraphTokenSet;
  repository?: MicrosoftGraphConnectionRepository;
  env?: NodeJS.ProcessEnv;
}) {
  const env = params.env ?? process.env;
  const repository = params.repository ?? createMicrosoftGraphConnectionRepository();
  if (!params.tokens.refreshToken) {
    throw new MicrosoftGraphAuthError("Microsoft Graph refresh token is required for durable connection storage.");
  }

  const row: MicrosoftGraphConnectionInsert = {
    user_id: params.userId,
    tenant_id: params.tenantId ?? getMicrosoftGraphTenantId(env),
    microsoft_user_id: params.profile.id,
    email: params.profile.email,
    display_name: params.profile.displayName,
    access_token_encrypted: encryptToken(params.tokens.accessToken, env),
    refresh_token_encrypted: encryptToken(params.tokens.refreshToken, env),
    expires_at: params.tokens.expiresAt,
    scopes: params.tokens.scopes
  };

  return await repository.storeConnection(row);
}

export async function updateEncryptedMicrosoftGraphConnectionTokens(params: {
  connectionId: string;
  existingRefreshTokenEncrypted: string;
  tokens: MicrosoftGraphTokenSet;
  repository: MicrosoftGraphConnectionRepository;
  env?: NodeJS.ProcessEnv;
  refreshedAt?: string;
}) {
  const env = params.env ?? process.env;
  const row: MicrosoftGraphConnectionTokenUpdate = {
    access_token_encrypted: encryptToken(params.tokens.accessToken, env),
    refresh_token_encrypted: params.tokens.refreshToken
      ? encryptToken(params.tokens.refreshToken, env)
      : params.existingRefreshTokenEncrypted,
    expires_at: params.tokens.expiresAt,
    scopes: params.tokens.scopes,
    last_refreshed_at: params.refreshedAt ?? new Date().toISOString()
  };

  return await params.repository.updateTokens(params.connectionId, row);
}

export function decryptMicrosoftGraphConnectionTokens(
  connection: MicrosoftGraphConnectionRow,
  env: NodeJS.ProcessEnv = process.env
) {
  return {
    accessToken: decryptToken(connection.access_token_encrypted, env),
    refreshToken: decryptToken(connection.refresh_token_encrypted, env)
  };
}

export async function markMicrosoftGraphConnectionRevoked(params: {
  userId: string;
  repository?: MicrosoftGraphConnectionRepository;
  revokedAt?: string;
}) {
  const repository = params.repository ?? createMicrosoftGraphConnectionRepository();
  return await repository.markRevoked(params.userId, params.revokedAt ?? new Date().toISOString());
}

function statusLabel(status: MicrosoftGraphConnectionStatus) {
  if (!status.configured) {
    return `Microsoft Graph is not configured: ${status.missingConfiguration.join(", ")}.`;
  }

  switch (status.state) {
    case "connected":
      return status.accountEmail
        ? `Microsoft 365 connected as ${status.accountEmail}.`
        : "Microsoft 365 is connected.";
    case "expired":
      return "Microsoft 365 token is expired. Reconnect or run refresh.";
    case "revoked":
      return "Microsoft 365 has been disconnected.";
    case "error":
      return "Microsoft 365 connection status could not be loaded.";
    case "not_connected":
    case "not_configured":
    default:
      return "Microsoft 365 is not connected.";
  }
}

export async function getMicrosoftGraphConnectionStatusForCurrentUser(params: {
  env?: NodeJS.ProcessEnv;
  repository?: MicrosoftGraphConnectionRepository;
  resolveAppUser?: typeof resolveCurrentAppUser;
} = {}): Promise<MicrosoftGraphConnectionStatus> {
  const env = params.env ?? process.env;
  const missingConfiguration = getMicrosoftGraphMissingConfiguration(env);
  const baseStatus: MicrosoftGraphConnectionStatus = {
    configured: missingConfiguration.length === 0,
    state: missingConfiguration.length === 0 ? "not_connected" : "not_configured",
    connected: false,
    connectHref: "/api/microsoft/connect",
    accountEmail: null,
    displayName: null,
    scopes: getMicrosoftGraphScopes(env),
    expiresAt: null,
    connectedAt: null,
    lastRefreshedAt: null,
    statusLabel: "",
    missingConfiguration
  };

  if (missingConfiguration.length > 0) {
    return {
      ...baseStatus,
      statusLabel: statusLabel(baseStatus)
    };
  }

  const resolved = await (params.resolveAppUser ?? resolveCurrentAppUser)();
  if (!resolved) {
    const next = {
      ...baseStatus,
      state: "not_connected" as const
    };
    return {
      ...next,
      statusLabel: statusLabel(next)
    };
  }

  try {
    const repository = params.repository ?? createMicrosoftGraphConnectionRepository(resolved.client);
    const connection = await repository.loadActiveConnectionMetadata(resolved.user.id);
    if (!connection) {
      const next = {
        ...baseStatus,
        state: "not_connected" as const
      };
      return {
        ...next,
        statusLabel: statusLabel(next)
      };
    }

    const expired = Date.parse(connection.expires_at) <= Date.now();
    const next: MicrosoftGraphConnectionStatus = {
      ...baseStatus,
      state: expired ? "expired" : "connected",
      connected: !expired,
      accountEmail: connection.email,
      displayName: connection.display_name,
      scopes: connection.scopes,
      expiresAt: connection.expires_at,
      connectedAt: connection.connected_at,
      lastRefreshedAt: connection.last_refreshed_at
    };

    return {
      ...next,
      statusLabel: statusLabel(next)
    };
  } catch {
    const next = {
      ...baseStatus,
      state: "error" as const
    };
    return {
      ...next,
      statusLabel: statusLabel(next)
    };
  }
}
