export type SitesAuthenticatedUser = {
  id: string;
  email: string;
  displayName: string | null;
};

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function decodeOptionalFullName(headers: Headers) {
  const encoded = headers.get("oai-authenticated-user-full-name");
  const encoding = headers.get("oai-authenticated-user-full-name-encoding");
  if (!encoded || encoding !== "percent-encoded-utf-8") {
    return null;
  }

  try {
    return decodeURIComponent(encoded).trim() || null;
  } catch {
    return null;
  }
}

export function resolveSitesAuthenticatedUser(headers: Headers): SitesAuthenticatedUser | null {
  const headerEmail = normalizeEmail(headers.get("oai-authenticated-user-email"));
  const configuredEmail = normalizeEmail(process.env.BLACKHAWK_PRIMARY_USER_EMAIL);
  const email = headerEmail ?? configuredEmail;
  if (!email) {
    return null;
  }

  if (configuredEmail && headerEmail && configuredEmail !== headerEmail) {
    return null;
  }

  return {
    id: process.env.BLACKHAWK_PRIMARY_USER_ID?.trim() || "will-primary",
    email,
    displayName: decodeOptionalFullName(headers)
  };
}
