import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Microsoft365SourceCoverageEntry,
  Microsoft365SourceCoverageStatus
} from "@/lib/microsoft-signal-intake";

export const MICROSOFT_GRAPH_DEFAULT_SCOPES = [
  "offline_access",
  "User.Read",
  "Mail.Read",
  "Calendars.Read",
  "Chat.Read"
] as const;

export type MicrosoftGraphTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
};

export type MicrosoftGraphProfileResponse = {
  id: string;
  displayName?: string | null;
  mail?: string | null;
  userPrincipalName?: string | null;
};

export type MicrosoftGraphProfile = {
  id: string;
  displayName: string | null;
  email: string | null;
};

export type MicrosoftGraphTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  scopes: string[];
};

export type MicrosoftGraphConnectionRow = {
  id: string;
  user_id: string;
  tenant_id: string | null;
  microsoft_user_id: string | null;
  email: string | null;
  display_name: string | null;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  expires_at: string;
  scopes: string[];
  connected_at: string;
  last_refreshed_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MicrosoftGraphConnectionMetadata = Omit<
  MicrosoftGraphConnectionRow,
  "access_token_encrypted" | "refresh_token_encrypted"
>;

export type MicrosoftGraphConnectionInsert = {
  user_id: string;
  tenant_id: string | null;
  microsoft_user_id: string | null;
  email: string | null;
  display_name: string | null;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  expires_at: string;
  scopes: string[];
};

export type MicrosoftGraphConnectionTokenUpdate = {
  access_token_encrypted: string;
  refresh_token_encrypted?: string;
  expires_at: string;
  scopes: string[];
  last_refreshed_at: string;
};

export type MicrosoftGraphConnectionRepository = {
  client: SupabaseClient;
  loadActiveConnection(userId: string): Promise<MicrosoftGraphConnectionRow | null>;
  loadActiveConnectionMetadata(userId: string): Promise<MicrosoftGraphConnectionMetadata | null>;
  storeConnection(row: MicrosoftGraphConnectionInsert): Promise<MicrosoftGraphConnectionMetadata>;
  updateTokens(
    connectionId: string,
    row: MicrosoftGraphConnectionTokenUpdate
  ): Promise<MicrosoftGraphConnectionRow>;
  markRevoked(userId: string, revokedAt: string): Promise<number>;
};

export type MicrosoftGraphConnectionState =
  | "not_configured"
  | "not_connected"
  | "connected"
  | "expired"
  | "revoked"
  | "error";

export type MicrosoftGraphConnectionStatus = {
  configured: boolean;
  state: MicrosoftGraphConnectionState;
  connected: boolean;
  connectHref: string;
  accountEmail: string | null;
  displayName: string | null;
  scopes: string[];
  expiresAt: string | null;
  connectedAt: string | null;
  lastRefreshedAt: string | null;
  statusLabel: string;
  missingConfiguration: string[];
};

export type MicrosoftGraphRequestIssueKind =
  | "auth"
  | "permission"
  | "rate_limit"
  | "not_found"
  | "network"
  | "unknown";

export type MicrosoftGraphSourceError = {
  source: "outlook" | "calendar" | "teams";
  status: Microsoft365SourceCoverageStatus;
  reason: string;
  issueKind: MicrosoftGraphRequestIssueKind;
};

export type MicrosoftGraphSourceResult<TRecord> = {
  records: TRecord[];
  coverage: Microsoft365SourceCoverageEntry;
  errors: MicrosoftGraphSourceError[];
};
