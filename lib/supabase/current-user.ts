import type { User } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withSupabaseTimeout } from "@/lib/supabase/request-timeout";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const BOOTSTRAP_USER_EMAIL = "local@chief-of-staff.app";
export const BOOTSTRAP_USER_ID = "11111111-1111-1111-1111-111111111111";

const BOOTSTRAP_USER_RECORD = {
  id: BOOTSTRAP_USER_ID,
  auth_user_id: null,
  email: BOOTSTRAP_USER_EMAIL,
  full_name: "Will O'Donnell",
  timezone: "America/Los_Angeles"
} satisfies AppUserRecord;

type AppUserRecord = {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  timezone: string;
};

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type SupabaseReadClient = NonNullable<ServerClient | AdminClient>;

export type ResolvedAppUser = {
  client: SupabaseReadClient;
  user: AppUserRecord;
  source: "auth" | "auth-email" | "bootstrap";
  authUser: User | null;
};

function logUserResolution(message: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.info("[supabase.current-user]", message, details ?? {});
}

function shouldUseBootstrapFallback() {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_SUPABASE_BOOTSTRAP_FALLBACK === "true";
}

function resolveBootstrapUserRecord(authUser: User | null, client: SupabaseReadClient): ResolvedAppUser {
  return {
    client,
    user: BOOTSTRAP_USER_RECORD,
    source: "bootstrap",
    authUser
  };
}

async function findAppUserByField(
  client: SupabaseReadClient,
  field: "auth_user_id" | "email",
  value: string
) {
  let data: AppUserRecord | null = null;
  let error:
    | {
        message: string;
        code?: string | null;
        details?: string | null;
        hint?: string | null;
      }
    | null = null;

  try {
    const response = await withSupabaseTimeout(
      client
        .from("users")
        .select("id, auth_user_id, email, full_name, timezone")
        .eq(field, value)
        .maybeSingle<AppUserRecord>()
    );

    data = response.data;
    error = response.error;
  } catch (requestError) {
    error = {
      message: requestError instanceof Error ? requestError.message : "Unknown Supabase users query error."
    };
  }

  if (error) {
    logUserResolution("Failed to query app user.", {
      field,
      value,
      errorMessage: error.message,
      errorCode: error.code ?? null,
      errorDetails: error.details ?? null,
      errorHint: error.hint ?? null
    });
    return null;
  }

  if (!data) {
    return null;
  }

  return data;
}

export async function resolveCurrentAppUser(): Promise<ResolvedAppUser | null> {
  let serverClient: ServerClient = null;
  try {
    serverClient = await createSupabaseServerClient();
  } catch (error) {
    logUserResolution("Supabase server client is unavailable outside a request scope; continuing without request cookies.", {
      errorMessage: error instanceof Error ? error.message : String(error)
    });
  }

  const adminClient = createSupabaseAdminClient();
  const client = adminClient ?? serverClient;

  if (!client) {
    logUserResolution("Unable to build a Supabase client for current-user resolution.", {
      hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasPublishableKey: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ),
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
    });
    return null;
  }

  let authUser: User | null = null;

  if (serverClient) {
    try {
      const { data } = await withSupabaseTimeout(serverClient.auth.getUser());
      authUser = data.user ?? null;
    } catch (error) {
      logUserResolution("Supabase auth.getUser timed out or failed; continuing with bootstrap fallback when allowed.", {
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (authUser?.id) {
    const userByAuthId = await findAppUserByField(client, "auth_user_id", authUser.id);
    if (userByAuthId) {
      logUserResolution("Resolved current app user from auth_user_id.", {
        source: "auth",
        userId: userByAuthId.id,
        email: userByAuthId.email
      });
      return {
        client,
        user: userByAuthId,
        source: "auth",
        authUser
      };
    }
  }

  if (authUser?.email) {
    const userByEmail = await findAppUserByField(client, "email", authUser.email);
    if (userByEmail) {
      logUserResolution("Resolved current app user from auth email.", {
        source: "auth-email",
        userId: userByEmail.id,
        email: userByEmail.email
      });
      return {
        client,
        user: userByEmail,
        source: "auth-email",
        authUser
      };
    }
  }

  if (!shouldUseBootstrapFallback()) {
    logUserResolution("Bootstrap fallback disabled and no auth-backed app user was resolved.");
    return null;
  }

  if (!authUser) {
    logUserResolution("Resolved current app user from configured local bootstrap record.", {
      source: "bootstrap",
      userId: BOOTSTRAP_USER_ID,
      email: BOOTSTRAP_USER_EMAIL
    });

    return resolveBootstrapUserRecord(authUser, client);
  }

  const bootstrapUser = await findAppUserByField(client, "email", BOOTSTRAP_USER_EMAIL);
  if (!bootstrapUser) {
    logUserResolution("Bootstrap lookup failed. Falling back to the configured local bootstrap user record.", {
      expectedUserId: BOOTSTRAP_USER_ID,
      expectedEmail: BOOTSTRAP_USER_EMAIL
    });

    return resolveBootstrapUserRecord(authUser, client);
  }

  logUserResolution("Resolved current app user from bootstrap fallback.", {
    source: "bootstrap",
    userId: bootstrapUser.id,
    email: bootstrapUser.email
  });

  return {
    client,
    user: bootstrapUser,
    source: "bootstrap",
    authUser
  };
}
