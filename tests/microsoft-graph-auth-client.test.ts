import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMicrosoftGraphAuthorizationUrl,
  exchangeMicrosoftGraphCodeForTokens,
  verifyMicrosoftGraphOAuthState
} from "../lib/microsoft-graph/auth";
import {
  getMicrosoftGraphClientForUser,
  MicrosoftGraphRequestError,
  MicrosoftGraphClient
} from "../lib/microsoft-graph/client";
import type {
  MicrosoftGraphConnectionMetadata,
  MicrosoftGraphConnectionRepository,
  MicrosoftGraphConnectionRow,
  MicrosoftGraphConnectionTokenUpdate
} from "../lib/microsoft-graph/types";
import { encryptToken } from "../lib/security/token-encryption";

const GRAPH_ENV = {
  ...process.env,
  MICROSOFT_GRAPH_CLIENT_ID: "client-id",
  MICROSOFT_GRAPH_CLIENT_SECRET: "client-secret",
  MICROSOFT_GRAPH_TENANT_ID: "organizations",
  MICROSOFT_GRAPH_REDIRECT_URI: "http://localhost/api/microsoft/callback",
  MICROSOFT_GRAPH_SCOPES: "offline_access User.Read Mail.Read Calendars.Read Chat.Read",
  MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY: "12345678901234567890123456789012"
};

function createConnection(overrides: Partial<MicrosoftGraphConnectionRow> = {}): MicrosoftGraphConnectionRow {
  return {
    id: "connection-1",
    user_id: "user-1",
    tenant_id: "organizations",
    microsoft_user_id: "microsoft-user-1",
    email: "will@example.com",
    display_name: "Will O'Donnell",
    access_token_encrypted: encryptToken("old-access", GRAPH_ENV),
    refresh_token_encrypted: encryptToken("old-refresh", GRAPH_ENV),
    expires_at: new Date(Date.now() - 60_000).toISOString(),
    scopes: ["offline_access", "User.Read", "Mail.Read", "Calendars.Read", "Chat.Read"],
    connected_at: "2026-06-05T12:00:00Z",
    last_refreshed_at: null,
    revoked_at: null,
    created_at: "2026-06-05T12:00:00Z",
    updated_at: "2026-06-05T12:00:00Z",
    ...overrides
  };
}

test("buildMicrosoftGraphAuthorizationUrl includes expected delegated scopes", () => {
  const url = new URL(
    buildMicrosoftGraphAuthorizationUrl({
      state: "state-1",
      redirectUri: "http://localhost/api/microsoft/callback",
      env: GRAPH_ENV
    })
  );

  assert.equal(url.searchParams.get("client_id"), "client-id");
  assert.equal(url.searchParams.get("state"), "state-1");
  assert.equal(url.searchParams.get("redirect_uri"), "http://localhost/api/microsoft/callback");
  assert.deepEqual(url.searchParams.get("scope")?.split(" "), [
    "offline_access",
    "User.Read",
    "Mail.Read",
    "Calendars.Read",
    "Chat.Read"
  ]);
});

test("verifyMicrosoftGraphOAuthState accepts matching state and rejects invalid state", () => {
  assert.equal(verifyMicrosoftGraphOAuthState("abc", "abc"), true);
  assert.equal(verifyMicrosoftGraphOAuthState("abc", "def"), false);
  assert.equal(verifyMicrosoftGraphOAuthState(null, "def"), false);
});

test("exchangeMicrosoftGraphCodeForTokens posts authorization code to Microsoft token endpoint", async () => {
  let bodyText = "";
  const fetchImpl: typeof fetch = async (_input, init) => {
    bodyText = init?.body?.toString() ?? "";
    return new Response(
      JSON.stringify({
        access_token: "access",
        refresh_token: "refresh",
        expires_in: 3600,
        scope: "offline_access User.Read Mail.Read Calendars.Read Chat.Read",
        token_type: "Bearer"
      })
    );
  };

  const tokens = await exchangeMicrosoftGraphCodeForTokens({
    code: "code-1",
    redirectUri: "http://localhost/api/microsoft/callback",
    env: GRAPH_ENV,
    fetchImpl
  });

  assert.equal(tokens.accessToken, "access");
  assert.equal(tokens.refreshToken, "refresh");
  assert.match(bodyText, /grant_type=authorization_code/);
  assert.match(bodyText, /code=code-1/);
});

test("getMicrosoftGraphClientForUser refreshes near-expired tokens and persists encrypted tokens", async () => {
  const connection = createConnection();
  let tokenUpdate: MicrosoftGraphConnectionTokenUpdate | null = null;
  const repository: MicrosoftGraphConnectionRepository = {
    client: {} as never,
    async loadActiveConnection() {
      return connection;
    },
    async loadActiveConnectionMetadata() {
      return connection as MicrosoftGraphConnectionMetadata;
    },
    async storeConnection() {
      throw new Error("not used");
    },
    async updateTokens(_connectionId, row) {
      tokenUpdate = row;
      return {
        ...connection,
        ...row
      };
    },
    async markRevoked() {
      return 0;
    }
  };
  const fetchImpl: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 3600,
        scope: "offline_access User.Read Mail.Read Calendars.Read Chat.Read",
        token_type: "Bearer"
      })
    );

  const result = await getMicrosoftGraphClientForUser({
    userId: "user-1",
    repository,
    env: GRAPH_ENV,
    fetchImpl
  });

  assert.ok(result.client);
  const persistedUpdate = tokenUpdate as MicrosoftGraphConnectionTokenUpdate | null;
  assert.ok(persistedUpdate);
  assert.notEqual(persistedUpdate.access_token_encrypted, "new-access");
  assert.equal(persistedUpdate.scopes.includes("Chat.Read"), true);
});

test("MicrosoftGraphClient sends Bearer token, follows pagination, and maps Graph errors", async () => {
  const requested: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    requested.push(String(input));
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer access");

    if (String(input).includes("page-2")) {
      return new Response(JSON.stringify({ value: [{ id: "2" }] }));
    }

    if (String(input).includes("denied")) {
      return new Response(
        JSON.stringify({ error: { code: "Forbidden", message: "Forbidden" } }),
        { status: 403 }
      );
    }

    return new Response(
      JSON.stringify({
        value: [{ id: "1" }],
        "@odata.nextLink": "https://graph.microsoft.com/v1.0/page-2"
      })
    );
  };
  const client = new MicrosoftGraphClient("access", fetchImpl);

  const items = await client.getJsonPages<{ id: string }>("/me/messages");
  assert.deepEqual(items.map((item) => item.id), ["1", "2"]);
  assert.equal(requested.length, 2);

  await assert.rejects(() => client.getJson("/denied"), (error) => {
    assert.ok(error instanceof MicrosoftGraphRequestError);
    assert.equal(error.status, 403);
    assert.equal(error.issueKind, "permission");
    return true;
  });
});
