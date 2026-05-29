import "server-only";

export {
  createMicrosoftAuthorizationUrl as createOutlookAuthorizationUrl,
  decryptMicrosoftSecret as decryptOutlookSecret,
  encryptMicrosoftSecret as encryptOutlookSecret,
  exchangeMicrosoftCodeForTokens as exchangeOutlookCodeForTokens,
  getMicrosoftGraphScopes as getOutlookScopes,
  isMicrosoftGraphConfigured as isOutlookConfigured,
  refreshMicrosoftAccessToken as refreshOutlookAccessToken,
  type MicrosoftGraphTokenSet as OutlookTokenSet
} from "@/lib/microsoft/auth";
export {
  fetchOutlookProfile,
  listOutlookInboxMessages,
  type OutlookMessage,
  type OutlookProfile
} from "@/lib/microsoft/outlook-mail";

export function getOutlookConnectHref(nextPath = "/inbox") {
  return `/api/integrations/outlook/connect?next=${encodeURIComponent(nextPath)}`;
}

export function resolveOutlookRedirectUri(origin: string) {
  return process.env.MICROSOFT_OUTLOOK_REDIRECT_URI?.trim() || `${origin}/api/integrations/outlook/callback`;
}
