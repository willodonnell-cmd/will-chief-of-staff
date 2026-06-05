import assert from "node:assert/strict";
import test from "node:test";

import { decryptToken, encryptToken, getTokenEncryptionKey } from "../lib/security/token-encryption";

const VALID_ENV = {
  ...process.env,
  MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY: "12345678901234567890123456789012"
};

test("encryptToken and decryptToken round trip without preserving plaintext", () => {
  const plaintext = "access-token-secret";
  const ciphertext = encryptToken(plaintext, VALID_ENV);

  assert.notEqual(ciphertext, plaintext);
  assert.equal(decryptToken(ciphertext, VALID_ENV), plaintext);
});

test("missing Microsoft Graph token encryption key fails clearly", () => {
  assert.throws(() => getTokenEncryptionKey({ ...process.env, MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY: "" }), {
    message: /MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY is required/
  });
});

test("invalid Microsoft Graph token encryption key length fails clearly", () => {
  assert.throws(
    () =>
      getTokenEncryptionKey({
        ...process.env,
        MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY: "too-short"
      }),
    {
      message: /exactly 32 bytes/
    }
  );
});
