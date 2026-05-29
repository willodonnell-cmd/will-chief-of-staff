import "server-only";

import { fetchMicrosoftGraphJson } from "@/lib/microsoft/graph-client";

type OutlookProfileResponse = {
  id: string;
  displayName?: string | null;
  mail?: string | null;
  userPrincipalName?: string | null;
};

type OutlookMessagesResponse = {
  value: OutlookMessage[];
};

export type OutlookParticipant = {
  emailAddress?: {
    name?: string | null;
    address?: string | null;
  } | null;
} | null;

export type OutlookMessage = {
  id: string;
  conversationId?: string | null;
  subject?: string | null;
  receivedDateTime?: string | null;
  bodyPreview?: string | null;
  webLink?: string | null;
  internetMessageId?: string | null;
  importance?: "low" | "normal" | "high";
  inferenceClassification?: "focused" | "other";
  isRead?: boolean;
  hasAttachments?: boolean;
  lastModifiedDateTime?: string | null;
  categories?: string[] | null;
  flag?: {
    flagStatus?: "notFlagged" | "complete" | "flagged";
  } | null;
  from?: OutlookParticipant;
  toRecipients?: OutlookParticipant[] | null;
  ccRecipients?: OutlookParticipant[] | null;
};

export type OutlookProfile = {
  id: string;
  displayName: string | null;
  email: string | null;
};

export async function fetchOutlookProfile(accessToken: string): Promise<OutlookProfile> {
  const response = await fetchMicrosoftGraphJson<OutlookProfileResponse>("/me?$select=id,displayName,mail,userPrincipalName", {
    accessToken,
    errorLabel: "Microsoft profile fetch failed"
  });

  return {
    id: response.id,
    displayName: response.displayName ?? null,
    email: response.mail ?? response.userPrincipalName ?? null
  };
}

export async function listOutlookInboxMessages(accessToken: string, top = 25): Promise<OutlookMessage[]> {
  const query = new URLSearchParams({
    $select:
      "id,conversationId,subject,receivedDateTime,bodyPreview,webLink,from,toRecipients,ccRecipients,internetMessageId,inferenceClassification,importance,isRead,hasAttachments,lastModifiedDateTime,flag,categories",
    $orderby: "receivedDateTime DESC",
    $top: `${Math.max(1, Math.min(top, 50))}`
  });

  const response = await fetchMicrosoftGraphJson<OutlookMessagesResponse>(
    `/me/mailFolders/inbox/messages?${query.toString()}`,
    {
      accessToken,
      errorLabel: "Microsoft inbox fetch failed"
    }
  );

  return response.value ?? [];
}

