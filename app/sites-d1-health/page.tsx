import { AppShell } from "@/components/app-shell";
import { loadSitesD1Health } from "@/lib/sites/sites-d1-health";

export const dynamic = "force-dynamic";

function statusText(value: boolean) {
  return value ? "Available" : "Unavailable";
}

export default async function SitesD1HealthPage() {
  const health = await loadSitesD1Health();

  const rows = [
    ["D1 binding", `${health.d1BindingName}: ${statusText(health.d1BindingAvailable)}`],
    ["Brief source", health.briefSourceMode],
    ["Workspace ingest", health.workspaceIngestEnabled ? "Enabled" : "Disabled"],
    ["Primary user mapping", health.primaryUserConfigured ? "Configured" : "Missing"],
    ["Agent ingest secret", health.agentIngestSecretConfigured ? "Configured" : "Missing"],
    ["CloudMailIn fallback", health.cloudMailInFallbackActive ? "Active" : "Disabled"],
    [
      "Latest D1 snapshot",
      health.latestSnapshot
        ? `${health.latestSnapshot.slot} · ${health.latestSnapshot.generatedAt ?? health.latestSnapshot.createdAt}`
        : "None detected"
    ],
    ["Checked", health.checkedAt]
  ];

  return (
    <AppShell>
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Sites / D1 parallel run</p>
          <h1 className="text-2xl font-semibold text-slate-950">Structured ingest health</h1>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <dl className="divide-y divide-slate-200">
            {rows.map(([label, value]) => (
              <div className="grid gap-1 px-4 py-3 sm:grid-cols-[220px_1fr]" key={label}>
                <dt className="text-sm font-medium text-slate-500">{label}</dt>
                <dd className="text-sm text-slate-950">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </AppShell>
  );
}
