import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const TOKEN_ENCRYPTION_ALGORITHM = "aes-256-gcm";
const TOKEN_ENCRYPTION_IV_BYTES = 12;
const TOKEN_ENCRYPTION_KEY_BYTES = 32;

function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error("Token encryption is only available on the server.");
  }
}

function decodeKey(value: string) {
  if (value.startsWith("base64:")) {
    return Buffer.from(value.slice("base64:".length), "base64");
  }

  if (value.startsWith("hex:")) {
    return Buffer.from(value.slice("hex:".length), "hex");
  }

  if (/^[0-9a-f]{64}$/i.test(value)) {
    return Buffer.from(value, "hex");
  }

  return Buffer.from(value, "utf8");
}

export function getTokenEncryptionKey(env: NodeJS.ProcessEnv = process.env) {
  assertServerOnly();

  const rawKey = env.MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY?.trim();
  if (!rawKey) {
    throw new Error("MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY is required for Microsoft Graph token storage.");
  }

  const key = decodeKey(rawKey);
  if (key.length !== TOKEN_ENCRYPTION_KEY_BYTES) {
    throw new Error(
      "MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes for AES-256-GCM."
    );
  }

  return key;
}

export function encryptToken(plaintext: string, env: NodeJS.ProcessEnv = process.env) {
  assertServerOnly();

  if (!plaintext) {
    throw new Error("Cannot encrypt an empty Microsoft Graph token.");
  }

  const key = getTokenEncryptionKey(env);
  const iv = randomBytes(TOKEN_ENCRYPTION_IV_BYTES);
  const cipher = createCipheriv(TOKEN_ENCRYPTION_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url")
  ].join(".");
}

export function decryptToken(ciphertext: string, env: NodeJS.ProcessEnv = process.env) {
  assertServerOnly();

  const [version, ivPart, tagPart, encryptedPart] = ciphertext.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !encryptedPart) {
    throw new Error("Stored Microsoft Graph token is malformed.");
  }

  const key = getTokenEncryptionKey(env);
  const decipher = createDecipheriv(
    TOKEN_ENCRYPTION_ALGORITHM,
    key,
    Buffer.from(ivPart, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
