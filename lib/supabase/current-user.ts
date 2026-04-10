import type { User } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const BOOTSTRAP_USER_EMAIL = "local@chief-of-staff.app";

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

function shouldUseBootstrapFallback() {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_SUPABASE_BOOTSTRAP_FALLBACK === "true";
}

async function findAppUserByField(
  client: SupabaseReadClient,
  field: "auth_user_id" | "email",
  value: string
) {
  const { data, error } = await client
    .from("users")
    .select("id, auth_user_id, email, full_name, timezone")
    .eq(field, value)
    .maybeSingle<AppUserRecord>();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function resolveCurrentAppUser(): Promise<ResolvedAppUser | null> {
  const serverClient = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();
  const client = adminClient ?? serverClient;

  if (!client) {
    return null;
  }

  let authUser: User | null = null;

  if (serverClient) {
    const { data } = await serverClient.auth.getUser();
    authUser = data.user ?? null;
  }

  if (authUser?.id) {
    const userByAuthId = await findAppUserByField(client, "auth_user_id", authUser.id);
    if (userByAuthId) {
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
      return {
        client,
        user: userByEmail,
        source: "auth-email",
        authUser
      };
    }
  }

  if (!shouldUseBootstrapFallback()) {
    return null;
  }

  const bootstrapUser = await findAppUserByField(client, "email", BOOTSTRAP_USER_EMAIL);
  if (!bootstrapUser) {
    return null;
  }

  return {
    client,
    user: bootstrapUser,
    source: "bootstrap",
    authUser
  };
}
