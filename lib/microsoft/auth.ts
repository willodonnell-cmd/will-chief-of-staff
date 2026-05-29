import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

import { fetchMicrosoftJson } from "@/lib/microsoft/graph-client";

const MICROSOFT_GRAPH_SCOPES = ["openid", "profile", "email", "offline_access", "User.Read", "Mail.Read"] as const;

type MicrosoftOAuthTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
};

export type MicrosoftGraphTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  scopes: string[];
};

function getMicrosoftClientId() {
  return process.env.MICROSOFT_CLIENT_ID?.trim() ?? "";
}

function getMicrosoftClientSecret() {
  return process.env.MICROSOFT_CLIENT_SECRET?.trim() ?? "";
}

function getMicrosoftTenantId() {
  return process.env.MICROSOFT_TENANT_ID?.trim() || "organizations";
}

function getMicrosoftTokenEncryptionSecret() {
  return process.env.OUTLOOK_TOKEN_ENCRYPTION_KEY?.trim() ?? "";
}

function getMicrosoftEncryptionKey() {
  const secret = getMicrosoftTokenEncryptionSecret();
  if (!secret) {
    return null;
  }

  return createHash("sha256").update(secret).digest();
}

function getMicrosoftTokenEndpoint() {
  return `https://login.microsoftonline.com/${getMicrosoftTenantId()}/oauth2/v2.0/token`;
}

function getMicrosoftAuthorizeEndpoint() {
  return `https://login.microsoftonline.com/${getMicrosoftTenantId()}/oauth2/v2.0/authorize`;
}

function mapTokenResponse(response: MicrosoftOAuthTokenResponse): MicrosoftGraphTokenSet {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token ?? null,
    expiresAt: new Date(Date.now() + response.expires_in * 1000).toISOString(),
    scopes: (response.scope ?? MICROSOFT_GRAPH_SCOPES.join(" ")).split(" ").filter(Boolean)
  };
}

export function isMicrosoftGraphConfigured() {
  return Boolean(getMicrosoftClientId() && getMicrosoftClientSecret() && getMicrosoftEncryptionKey());
}

export function getMicrosoftGraphScopes() {
  return [...MICROSOFT_GRAPH_SCOPES];
}

export function createMicrosoftAuthorizationUrl(params: { redirectUri: string; state: string }) {
  const query = new URLSearchParams({
    client_id: getMicrosoftClientId(),
    response_type: "code",
    redirect_uri: params.redirectUri,
    response_mode: "query",
    scope: MICROSOFT_GRAPH_SCOPES.join(" "),
    state: params.state
  });

  return `${getMicrosoftAuthorizeEndpoint()}?${query.toString()}`;
}

export async function exchangeMicrosoftCodeForTokens(params: { code: string; redirectUri: string }) {
  const body = new URLSearchParams({
    client_id: getMicrosoftClientId(),
    client_secret: getMicrosoftClientSecret(),
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    scope: MICROSOFT_GRAPH_SCOPES.join(" ")
  });

  const response = await fetchMicrosoftJson<MicrosoftOAuthTokenResponse>(
    getMicrosoftTokenEndpoint(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    },
    "Microsoft token exchange failed"
  );

  return mapTokenResponse(response);
}

export async function refreshMicrosoftAccessToken(params: { refreshToken: string }) {
  const body = new URLSearchParams({
    client_id: getMicrosoftClientId(),
    client_secret: getMicrosoftClientSecret(),
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    scope: MICROSOFT_GRAPH_SCOPES.join(" ")
  });

  const response = await fetchMicrosoftJson<MicrosoftOAuthTokenResponse>(
    getMicrosoftTokenEndpoint(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    },
    "Microsoft token refresh failed"
  );

  return mapTokenResponse(response);
}

export function encryptMicrosoftSecret(value: string) {
  const key = getMicrosoftEncryptionKey();
  if (!key) {
    throw new Error("OUTLOOK_TOKEN_ENCRYPTION_KEY is required for Outlook token storage.");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptMicrosoftSecret(value: string) {
  const key = getMicrosoftEncryptionKey();
  if (!key) {
    throw new Error("OUTLOOK_TOKEN_ENCRYPTION_KEY is required for Outlook token storage.");
  }

  const [ivPart, tagPart, encryptedPart] = value.split(".");
  if (!ivPart || !tagPart || !encryptedPart) {
    throw new Error("Stored Outlook token is malformed.");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));

  return Buffer.concat([decipher.update(Buffer.from(encryptedPart, "base64")), decipher.final()]).toString("utf8");
}

