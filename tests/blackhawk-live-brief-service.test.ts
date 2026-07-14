import assert from "node:assert/strict";
import test from "node:test";

import { buildBlackhawkRefreshIdempotencyKey } from "../lib/blackhawk/live-brief-refresh-key";

test("opening refreshes in the same five-minute window join one request", () => {
  const first = buildBlackhawkRefreshIdempotencyKey({
    userId: "will",
    trigger: "open",
    now: "2026-07-13T16:01:00.000Z"
  });
  const second = buildBlackhawkRefreshIdempotencyKey({
    userId: "will",
    trigger: "open",
    now: "2026-07-13T16:04:59.000Z"
  });
  assert.equal(first, second);
});

test("opening refreshes in different windows create different requests", () => {
  const first = buildBlackhawkRefreshIdempotencyKey({
    userId: "will",
    trigger: "open",
    now: "2026-07-13T16:04:59.000Z"
  });
  const second = buildBlackhawkRefreshIdempotencyKey({
    userId: "will",
    trigger: "open",
    now: "2026-07-13T16:05:00.000Z"
  });
  assert.notEqual(first, second);
});

test("invalid refresh windows are rejected", () => {
  assert.throws(() => buildBlackhawkRefreshIdempotencyKey({
    userId: "will",
    trigger: "open",
    windowMinutes: 0
  }), /positive integer/);
});
