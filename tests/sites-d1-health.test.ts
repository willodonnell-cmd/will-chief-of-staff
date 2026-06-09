import assert from "node:assert/strict";
import test from "node:test";

import { D1_BINDING_NAME } from "../db/schema";
import { loadSitesD1Health } from "../lib/sites/sites-d1-health";

test("Sites D1 health reports configuration without requiring a local D1 binding", async () => {
  const previousBriefSource = process.env.BLACKHAWK_BRIEF_SOURCE;
  const previousPrimaryEmail = process.env.BLACKHAWK_PRIMARY_USER_EMAIL;
  const previousSecret = process.env.BLACKHAWK_AGENT_INGEST_SECRET;
  const previousFallback = process.env.BLACKHAWK_CLOUDMAILIN_FALLBACK_ACTIVE;

  process.env.BLACKHAWK_BRIEF_SOURCE = "parallel";
  process.env.BLACKHAWK_PRIMARY_USER_EMAIL = "will@example.com";
  process.env.BLACKHAWK_AGENT_INGEST_SECRET = "secret";
  process.env.BLACKHAWK_CLOUDMAILIN_FALLBACK_ACTIVE = "true";

  try {
    const health = await loadSitesD1Health();

    assert.equal(health.d1BindingName, D1_BINDING_NAME);
    assert.equal(health.d1BindingAvailable, false);
    assert.equal(health.briefSourceMode, "parallel");
    assert.equal(health.primaryUserConfigured, true);
    assert.equal(health.agentIngestSecretConfigured, true);
    assert.equal(health.cloudMailInFallbackActive, true);
    assert.equal(health.latestSnapshot, null);
    assert.match(health.checkedAt, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    if (previousBriefSource === undefined) {
      delete process.env.BLACKHAWK_BRIEF_SOURCE;
    } else {
      process.env.BLACKHAWK_BRIEF_SOURCE = previousBriefSource;
    }
    if (previousPrimaryEmail === undefined) {
      delete process.env.BLACKHAWK_PRIMARY_USER_EMAIL;
    } else {
      process.env.BLACKHAWK_PRIMARY_USER_EMAIL = previousPrimaryEmail;
    }
    if (previousSecret === undefined) {
      delete process.env.BLACKHAWK_AGENT_INGEST_SECRET;
    } else {
      process.env.BLACKHAWK_AGENT_INGEST_SECRET = previousSecret;
    }
    if (previousFallback === undefined) {
      delete process.env.BLACKHAWK_CLOUDMAILIN_FALLBACK_ACTIVE;
    } else {
      process.env.BLACKHAWK_CLOUDMAILIN_FALLBACK_ACTIVE = previousFallback;
    }
  }
});
