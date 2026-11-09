import { describe, expect, it } from "vitest";

import { decodeTotpSecret, hotp, isMfaProofValid, matchTotp, newTotpSecret, signMfaProof } from "./totp";

const RFC_KEY = Buffer.from("12345678901234567890");
// "12345678901234567890" in base32, the RFC 6238 test secret.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("TOTP", () => {
  it("matches the RFC 6238 SHA-1 vectors", () => {
    expect(hotp(RFC_KEY, Math.floor(59 / 30), 8)).toBe("94287082");
    expect(hotp(RFC_KEY, Math.floor(1111111109 / 30), 8)).toBe("07081804");
    expect(hotp(RFC_KEY, Math.floor(2000000000 / 30), 8)).toBe("69279037");
  });

  it("accepts one step of drift and nothing further", () => {
    const at = 1111111109_000;
    const code = hotp(RFC_KEY, Math.floor(at / 30000));
    expect(matchTotp(RFC_SECRET, code, at)).toBe(Math.floor(at / 30000));
    expect(matchTotp(RFC_SECRET, code, at + 30_000)).not.toBeNull();
    expect(matchTotp(RFC_SECRET, code, at + 120_000)).toBeNull();
  });

  it("rejects malformed codes", () => {
    expect(matchTotp(RFC_SECRET, "12345")).toBeNull();
    expect(matchTotp(RFC_SECRET, "abcdef")).toBeNull();
  });

  it("generates a 160-bit base32 secret that round-trips", () => {
    const secret = newTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    const at = 1_800_000_000_000;
    const counter = Math.floor(at / 30000);
    expect(matchTotp(secret, hotp(decodeTotpSecret(secret), counter), at)).toBe(counter);
  });
});

describe("MFA proof", () => {
  const AUTH = "test-auth-secret-test-auth-secret";
  const now = 1_800_000_000_000;
  const proof = signMfaProof(AUTH, "user-1", 2, now / 1000 + 60);

  it("accepts its own user and session version until it expires", () => {
    expect(isMfaProofValid(AUTH, proof, "user-1", 2, now)).toBe(true);
    expect(isMfaProofValid(AUTH, proof, "user-1", 2, now + 61_000)).toBe(false);
  });

  it("rejects another user, a revoked session, a forged or missing proof", () => {
    expect(isMfaProofValid(AUTH, proof, "user-2", 2, now)).toBe(false);
    expect(isMfaProofValid(AUTH, proof, "user-1", 3, now)).toBe(false);
    expect(isMfaProofValid("another-secret-another-secret-xx", proof, "user-1", 2, now)).toBe(false);
    expect(isMfaProofValid(AUTH, `${now / 1000 + 9999}.${proof.split(".")[1]}`, "user-1", 2, now)).toBe(false);
    expect(isMfaProofValid(AUTH, undefined, "user-1", 2, now)).toBe(false);
  });

  it("returns false, never throws, for a tampered MAC with non-ASCII characters of the same length", () => {
    const mac = proof.split(".")[1];
    const tampered = `${now / 1000 + 60}.${"é".repeat(mac.length)}`; // same character length, longer in UTF-8
    expect(() => isMfaProofValid(AUTH, tampered, "user-1", 2, now)).not.toThrow();
    expect(isMfaProofValid(AUTH, tampered, "user-1", 2, now)).toBe(false);
  });
});
