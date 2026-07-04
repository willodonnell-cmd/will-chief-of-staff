import { readFile } from "node:fs/promises";

type IngestProofResponse = {
  ok?: unknown;
  snapshotId?: unknown;
  slot?: unknown;
  generatedAt?: unknown;
  taskPersistence?: unknown;
  excludedColumns?: unknown;
  error?: unknown;
};

type SitesD1HealthResponse = {
  latestSnapshot?: {
    id?: unknown;
    slot?: unknown;
    generatedAt?: unknown;
    createdAt?: unknown;
  } | null;
  d1BindingAvailable?: unknown;
  briefSourceMode?: unknown;
};

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function resolveUrl(value: string, path: string) {
  const url = new URL(value);
  if (url.pathname === "/" || url.pathname === "") {
    url.pathname = path;
  }
  return url.toString();
}

function ingestSecret() {
  return (
    process.env.BLACKHAWK_AGENT_INGEST_SECRET?.trim() ||
    process.env.BLACKHAWK_BRIEF_INGEST_SECRET?.trim() ||
    null
  );
}

function assertProofResponse(value: IngestProofResponse) {
  if (value.ok !== true) {
    throw new Error(`Ingest did not return ok: ${JSON.stringify(value)}`);
  }

  if (typeof value.snapshotId !== "string" || !value.snapshotId.trim()) {
    throw new Error(`Ingest response did not include snapshotId: ${JSON.stringify(value)}`);
  }

  if (typeof value.slot !== "string" || !value.slot.trim()) {
    throw new Error(`Ingest response did not include slot: ${JSON.stringify(value)}`);
  }

  if (typeof value.generatedAt !== "string" || Number.isNaN(new Date(value.generatedAt).getTime())) {
    throw new Error(`Ingest response did not include a valid generatedAt: ${JSON.stringify(value)}`);
  }

  if (value.taskPersistence !== "candidate_only") {
    throw new Error(`Ingest response did not preserve candidate-only task persistence: ${JSON.stringify(value)}`);
  }
}

function assertHealthSnapshot(value: SitesD1HealthResponse, expectedSnapshotId: string) {
  if (!value.latestSnapshot || value.latestSnapshot.id !== expectedSnapshotId) {
    throw new Error(`D1 health did not report the ingested snapshot ${expectedSnapshotId}: ${JSON.stringify(value)}`);
  }
}

async function readJsonResponse<T>(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Expected JSON response, received: ${text.slice(0, 500)}`);
  }
}

async function main() {
  const baseUrlValue = argValue("--base-url") ?? process.env.BLACKHAWK_BASE_URL?.trim();
  const ingestUrlValue = argValue("--ingest-url") ?? process.env.BLACKHAWK_BRIEF_INGEST_URL?.trim();
  if (!baseUrlValue && !ingestUrlValue) {
    throw new Error("BLACKHAWK_BASE_URL, BLACKHAWK_BRIEF_INGEST_URL, --base-url, or --ingest-url is required.");
  }
  const baseUrl = baseUrlValue ? trimTrailingSlash(baseUrlValue) : null;
  const ingestUrl = ingestUrlValue ? resolveUrl(ingestUrlValue, "/api/brief/agent-ingest") : `${baseUrl}/api/brief/agent-ingest`;
  const healthUrlValue = argValue("--health-url") ?? process.env.BLACKHAWK_D1_HEALTH_URL?.trim();
  const healthUrl = healthUrlValue
    ? resolveUrl(healthUrlValue, "/health")
    : ingestUrlValue
      ? resolveUrl(ingestUrlValue, "/health")
      : `${baseUrl}/api/sites-d1-health`;
  const payloadPath = argValue("--payload") ?? "fixtures/codex-sites-executive-brief-payload.json";
  const secret = ingestSecret();
  if (!secret) {
    throw new Error("BLACKHAWK_AGENT_INGEST_SECRET or BLACKHAWK_BRIEF_INGEST_SECRET is required.");
  }

  const payload = await readFile(payloadPath, "utf8");
  const ingestResponse = await fetch(ingestUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-blackhawk-agent-ingest-secret": secret
    },
    body: payload
  });
  const ingestBody = await readJsonResponse<IngestProofResponse>(ingestResponse);
  if (!ingestResponse.ok) {
    throw new Error(`Ingest failed with HTTP ${ingestResponse.status}: ${JSON.stringify(ingestBody)}`);
  }
  assertProofResponse(ingestBody);

  const healthResponse = await fetch(healthUrl, {
    headers: {
      accept: "application/json"
    }
  });
  const healthBody = await readJsonResponse<SitesD1HealthResponse>(healthResponse);
  if (!healthResponse.ok) {
    throw new Error(`D1 health failed with HTTP ${healthResponse.status}: ${JSON.stringify(healthBody)}`);
  }
  assertHealthSnapshot(healthBody, ingestBody.snapshotId as string);

  console.log(
    JSON.stringify(
      {
        ok: true,
        snapshotId: ingestBody.snapshotId,
        slot: ingestBody.slot,
        generatedAt: ingestBody.generatedAt,
        taskPersistence: ingestBody.taskPersistence,
        excludedColumns: ingestBody.excludedColumns,
        health: {
          url: healthUrl,
          d1BindingAvailable: healthBody.d1BindingAvailable,
          briefSourceMode: healthBody.briefSourceMode,
          latestSnapshot: healthBody.latestSnapshot
        }
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
