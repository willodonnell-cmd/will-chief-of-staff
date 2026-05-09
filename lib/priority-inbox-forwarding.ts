import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  markPriorityInboxLocalFallbackActive,
  normalizePriorityInboxSourceError,
  shouldBypassPriorityInboxRemoteStorage,
  shouldUsePriorityInboxLocalFallback
} from "@/lib/priority-inbox-errors";
import {
  getLocalPriorityInboxForwardingConfig,
  resolveLocalPriorityInboxForwardingUserByDestination,
  updateLocalPriorityInboxForwardingConfig
} from "@/lib/priority-inbox-local-store";
import { resolveCurrentAppUser } from "@/lib/supabase/current-user";
import { withSupabaseTimeout } from "@/lib/supabase/request-timeout";

export type PriorityInboxForwardingSummary = {
  destinationAddress: string | null;
  inboundAddressStatus: "configured" | "not_configured";
  providerStatus: "ready" | "dev_only";
  statusLabel: string;
  productionReady: boolean;
  exampleWebhookPath: string;
};

type ForwardingConfigRow = {
  id: string;
  user_id: string;
  destination_address: string;
  source_metadata: unknown;
};

function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function defaultForwardingAddress(email: string) {
  const domain = process.env.BLACKHAWK_FORWARDING_DOMAIN?.trim();
  if (!domain) {
    return null;
  }

  const localPart = email.split("@")[0]?.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "user";
  return `priority+${localPart}@${domain.replace(/^@/, "").toLowerCase()}`;
}

async function upsertForwardingConfig(userId: string, destinationAddress: string, metadata?: Record<string, unknown>) {
  const client = createSupabaseAdminClient();
  if (!client) {
    throw new Error("Priority Inbox forwarding config requires SUPABASE_SERVICE_ROLE_KEY.");
  }

  const response = await withSupabaseTimeout(
    client
      .from("priority_inbox_forwarding_configs")
      .upsert(
        {
          user_id: userId,
          destination_address: destinationAddress,
          source_metadata: metadata ?? {}
        },
        {
          onConflict: "user_id"
        }
      )
      .select("id, user_id, destination_address, source_metadata")
      .single<ForwardingConfigRow>()
  );

  if (response.error || !response.data) {
    throw new Error(response.error?.message ?? "Priority Inbox forwarding destination could not be saved.");
  }

  return response.data;
}

export async function getPriorityInboxForwardingSummary(): Promise<PriorityInboxForwardingSummary | null> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return null;
  }

  const defaultAddress = defaultForwardingAddress(resolved.user.email);
  if (shouldBypassPriorityInboxRemoteStorage()) {
    const localConfig = await getLocalPriorityInboxForwardingConfig({
      userId: resolved.user.id,
      defaultAddress
    });
    const destinationAddress = localConfig?.destination_address ?? defaultAddress;

    return {
      destinationAddress,
      inboundAddressStatus: destinationAddress ? "configured" : "not_configured",
      providerStatus: "dev_only",
      statusLabel: destinationAddress
        ? "Local dev fallback is active because Supabase is blocked from this network."
        : "Set a forwarding destination so local dev can route forwarded mail into Priority Inbox.",
      productionReady: false,
      exampleWebhookPath: "/api/inbox/forwarded-email"
    };
  }

  const client = createSupabaseAdminClient() ?? resolved.client;
  try {
    const response = await withSupabaseTimeout(
      client
        .from("priority_inbox_forwarding_configs")
        .select("id, user_id, destination_address, source_metadata")
        .eq("user_id", resolved.user.id)
        .maybeSingle<ForwardingConfigRow>()
    );
    if (response.error && shouldUsePriorityInboxLocalFallback(response.error.message)) {
      throw new Error(response.error.message);
    }

    const sourceStatusError = response.error
      ? normalizePriorityInboxSourceError(response.error.message, "Forwarding destination status could not be loaded.")
      : null;

    const existingAddress = response.data?.destination_address?.trim() || null;
    const destinationAddress = existingAddress ?? defaultAddress;

    if (!sourceStatusError && !existingAddress && defaultAddress && createSupabaseAdminClient()) {
      await upsertForwardingConfig(resolved.user.id, defaultAddress, {
        origin: "default"
      }).catch(() => null);
    }

    const productionReady =
      !sourceStatusError &&
      Boolean(destinationAddress) &&
      Boolean(
        (process.env.CLOUDMAILIN_BASIC_AUTH_USERNAME?.trim() && process.env.CLOUDMAILIN_BASIC_AUTH_PASSWORD?.trim()) ||
          process.env.BLACKHAWK_FORWARDING_INGEST_TOKEN
      ) &&
      Boolean(createSupabaseAdminClient());

    return {
      destinationAddress,
      inboundAddressStatus: destinationAddress ? "configured" : "not_configured",
      providerStatus: productionReady ? "ready" : "dev_only",
      statusLabel: sourceStatusError
        ? sourceStatusError
        : destinationAddress
          ? productionReady
            ? "Forward meaningful emails here for real triage while live mailbox OAuth is blocked."
            : "Destination is set, but local/dev should use the simulator until inbound provider wiring is present."
          : "Set a forwarding destination so Blackhawk can map forwarded mail into Priority Inbox.",
      productionReady,
      exampleWebhookPath: "/api/inbox/cloudmailin"
    };
  } catch (error) {
    if (!shouldUsePriorityInboxLocalFallback(error)) {
      const sourceStatusError = normalizePriorityInboxSourceError(
        error,
        "Forwarding destination status could not be loaded."
      );
      return {
        destinationAddress: defaultAddress,
        inboundAddressStatus: defaultAddress ? "configured" : "not_configured",
        providerStatus: "dev_only",
        statusLabel: sourceStatusError,
        productionReady: false,
        exampleWebhookPath: "/api/inbox/cloudmailin"
      };
    }

    markPriorityInboxLocalFallbackActive();
    const localConfig = await getLocalPriorityInboxForwardingConfig({
      userId: resolved.user.id,
      defaultAddress
    });
    const destinationAddress = localConfig?.destination_address ?? defaultAddress;

    return {
      destinationAddress,
      inboundAddressStatus: destinationAddress ? "configured" : "not_configured",
      providerStatus: "dev_only",
      statusLabel: destinationAddress
        ? "Local dev fallback is active because Supabase is blocked from this network."
        : "Set a forwarding destination so local dev can route forwarded mail into Priority Inbox.",
      productionReady: false,
      exampleWebhookPath: "/api/inbox/forwarded-email"
    };
  }
}

export async function updatePriorityInboxForwardingDestination(destinationAddress: string) {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return {
      ok: false as const,
      error: "No active app user could be resolved for Priority Inbox."
    };
  }

  const normalized = normalizeEmailAddress(destinationAddress);
  if (!isValidEmailAddress(normalized)) {
    return {
      ok: false as const,
      error: "Enter a valid forwarding email address."
    };
  }

  try {
    const row = await upsertForwardingConfig(resolved.user.id, normalized, {
      origin: "manual"
    });

    return {
      ok: true as const,
      destinationAddress: row.destination_address
    };
  } catch (error) {
    if (shouldUsePriorityInboxLocalFallback(error)) {
      markPriorityInboxLocalFallbackActive();
      const row = await updateLocalPriorityInboxForwardingConfig(resolved.user.id, normalized);
      return {
        ok: true as const,
        destinationAddress: row.destination_address
      };
    }

    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Priority Inbox forwarding destination could not be saved."
    };
  }
}

export async function resolveForwardingUserByDestination(destinationAddress: string) {
  const client = createSupabaseAdminClient();
  if (!client || shouldBypassPriorityInboxRemoteStorage()) {
    return await resolveLocalPriorityInboxForwardingUserByDestination(destinationAddress);
  }

  const normalized = normalizeEmailAddress(destinationAddress);
  try {
    const response = await withSupabaseTimeout(
      client
        .from("priority_inbox_forwarding_configs")
        .select("id, user_id, destination_address, source_metadata")
        .eq("destination_address", normalized)
        .maybeSingle<ForwardingConfigRow>()
    );

    if (response.error) {
      throw new Error(response.error.message);
    }

    if (!response.data) {
      return null;
    }

    return response.data;
  } catch (error) {
    if (!shouldUsePriorityInboxLocalFallback(error)) {
      throw error;
    }

    markPriorityInboxLocalFallbackActive();
    return await resolveLocalPriorityInboxForwardingUserByDestination(normalized);
  }
}
