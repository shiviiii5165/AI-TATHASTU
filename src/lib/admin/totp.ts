import { createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

// RFC 6238 TOTP with the parameters authenticator apps assume: HMAC-SHA1, 6 digits,
// 30 seconds. HMAC-SHA1 stays sound here; collisions don't help forge a keyed code.
const STEP_SECONDS = 30;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function newTotpSecret() {
  let bits = "";
  for (const byte of randomBytes(20)) bits += byte.toString(2).padStart(8, "0");
  return bits.match(/.{5}/g)!.map((chunk) => ALPHABET[parseInt(chunk, 2)]).join("");
}

export function decodeTotpSecret(secret: string) {
  let bits = "";
  for (const char of secret) bits += ALPHABET.indexOf(char).toString(2).padStart(5, "0");
  return Buffer.from(bits.match(/.{8}/g)!.map((chunk) => parseInt(chunk, 2)));
}

export function hotp(key: Buffer, counter: number, digits = 6) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", key).update(message).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const value = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(value % 10 ** digits).padStart(digits, "0");
}

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** The time-step a code belongs to, allowing one step of clock drift; null if it matches none. */
export function matchTotp(secret: string, code: string, nowMs = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const key = decodeTotpSecret(secret);
  const current = Math.floor(nowMs / 1000 / STEP_SECONDS);
  for (const counter of [current - 1, current, current + 1]) {
    if (same(hotp(key, counter), code)) return counter;
  }
  return null;
}

export const otpauthUri = (secret: string, account: string) =>
  `otpauth://totp/${encodeURIComponent(`AI Tathastu Admin:${account}`)}?secret=${secret}&issuer=${encodeURIComponent("AI Tathastu Admin")}`;

const proofKey = (secret: string) => Buffer.from(hkdfSync("sha256", secret, "", "admin-mfa-proof", 32));
const sign = (secret: string, payload: string) => createHmac("sha256", proofKey(secret)).update(payload).digest("base64url");

/** Proof of a passed code, bound to the user and their session version so revocation ends it too. */
export function signMfaProof(secret: string, userId: string, sessionVersion: number, expiresAtS: number) {
  return `${expiresAtS}.${sign(secret, `${userId}:${sessionVersion}:${expiresAtS}`)}`;
}

export function isMfaProofValid(secret: string, proof: string | undefined, userId: string, sessionVersion: number, nowMs = Date.now()) {
  const [expires, mac] = proof?.split(".") ?? [];
  const expiresAtS = Number(expires);
  if (!mac || !Number.isInteger(expiresAtS) || expiresAtS * 1000 <= nowMs) return false;
  return same(mac, sign(secret, `${userId}:${sessionVersion}:${expiresAtS}`));
}

// 80 random bits, shown as XXXX-XXXX-XXXX-XXXX. Enough that a plain hash at rest can't be brute-forced.
export function newRecoveryCode() {
  let bits = "";
  for (const byte of randomBytes(10)) bits += byte.toString(2).padStart(8, "0");
  const code = bits.match(/.{5}/g)!.map((chunk) => ALPHABET[parseInt(chunk, 2)]).join("");
  return code.match(/.{4}/g)!.join("-");
}

/** The canonical form of something typed as a recovery code, or null if it can't be one. */
export function normalizeRecoveryCode(input: string) {
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  return /^[A-Z2-7]{16}$/.test(code) ? code : null;
}

export const hashRecoveryCode = (normalized: string) => createHash("sha256").update(normalized).digest("hex");
