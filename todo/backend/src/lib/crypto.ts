// Small helpers for secrets at rest and signed OAuth state.
// TOKEN_SECRET must be a long random string (e.g. `openssl rand -base64 32`).

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function secret(): string {
  const value = process.env.TOKEN_SECRET;
  if (!value || value.length < 32) {
    throw new Error("TOKEN_SECRET must be set to at least 32 characters");
  }
  return value;
}

function key(purpose: string): Buffer {
  return createHash("sha256").update(`${purpose}:${secret()}`).digest();
}

/** AES-256-GCM. Output: base64url(iv | tag | ciphertext). */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("enc"), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key("enc"), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

/** Signed, expiring token carrying a small JSON payload. */
export function sign(payload: object, ttlSeconds: number): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })
  ).toString("base64url");
  const mac = createHmac("sha256", key("state")).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verify<T>(token: string): T | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", key("state")).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (typeof data.exp !== "number" || data.exp < Date.now() / 1000) return null;
  return data as T;
}
