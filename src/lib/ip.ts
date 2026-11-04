import "server-only";

import { isIP, isIPv4, isIPv6 } from "node:net";

export type NormalizedIp = {
  /** The canonical normalized IP address (RFC 5952 for IPv6, standard dotted-decimal for IPv4). */
  normalized: string;
  /**
   * The rate-limiting bucket key:
   * - IPv4: canonical dotted decimal (e.g., "192.0.2.1")
   * - IPv6: canonical /64 subnet prefix (e.g., "2001:db8:abcd:12::/64") to group privacy
   *   extension addresses (RFC 4941 / RFC 8981) and ISP subnet rotations without allowing
   *   rate-limit bypass via address rotating.
   */
  bucketKey: string;
  version: 4 | 6;
};

/**
 * Strips port and enclosing brackets from an IP string candidate.
 * e.g., "[2001:db8::1]:8080" -> "2001:db8::1"
 *       "192.0.2.1:8080" -> "192.0.2.1"
 */
function cleanCandidate(raw: string): string {
  const trimmed = raw.trim();

  // IPv6 enclosed in brackets, optional port: [2001:db8::1] or [2001:db8::1]:8080
  const v6BracketMatch = /^\[([a-fA-F0-9:]+)\](?::\d+)?$/.exec(trimmed);
  if (v6BracketMatch) {
    return v6BracketMatch[1] ?? "";
  }

  // IPv4 with port: 192.0.2.1:8080 (must be standard 4 octets followed by :port)
  const v4PortMatch = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+$/.exec(trimmed);
  if (v4PortMatch) {
    return v4PortMatch[1] ?? "";
  }

  return trimmed;
}

/**
 * Parses and expands a valid IPv6 address into its 8 16-bit hextet numbers (0x0000 - 0xffff).
 */
function parseIPv6Hextets(ip: string): number[] | null {
  if (!isIPv6(ip)) return null;

  // Handle embedded IPv4 in IPv6 (e.g., ::ffff:192.0.2.1 or 64:ff9b::192.0.2.1)
  const lastColon = ip.lastIndexOf(":");
  const tail = ip.slice(lastColon + 1);
  let v6Str = ip;
  if (isIPv4(tail)) {
    const octets = tail.split(".").map(Number);
    if (octets.some((n) => isNaN(n) || n < 0 || n > 255)) return null;
    const hex1 = (((octets[0] ?? 0) << 8) | (octets[1] ?? 0)).toString(16);
    const hex2 = (((octets[2] ?? 0) << 8) | (octets[3] ?? 0)).toString(16);
    v6Str = ip.slice(0, lastColon) + ":" + hex1 + ":" + hex2;
  }

  const parts = v6Str.split("::");
  if (parts.length > 2) return null;

  const left = parts[0] ? parts[0].split(":").filter(Boolean) : [];
  const right = parts.length === 2 && parts[1] ? parts[1].split(":").filter(Boolean) : [];
  const missing = 8 - (left.length + right.length);
  if (missing < 0) return null;

  const rawHextets = [
    ...left.map((h) => parseInt(h, 16)),
    ...Array<number>(missing).fill(0),
    ...right.map((h) => parseInt(h, 16)),
  ];

  if (rawHextets.length !== 8 || rawHextets.some((n) => isNaN(n) || n < 0 || n > 0xffff)) {
    return null;
  }

  return rawHextets;
}

/**
 * Formats 8 hextets in RFC 5952 canonical format (lowercase, longest zero run collapsed to ::).
 */
function formatIPv6Canonical(hextets: number[]): string {
  // Find the longest run of consecutive 0 hextets of length >= 2
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;

  for (let i = 0; i < 8; i++) {
    if (hextets[i] === 0) {
      if (curStart === -1) {
        curStart = i;
        curLen = 1;
      } else {
        curLen++;
      }
    } else {
      if (curLen > bestLen && curLen >= 2) {
        bestStart = curStart;
        bestLen = curLen;
      }
      curStart = -1;
      curLen = 0;
    }
  }
  if (curLen > bestLen && curLen >= 2) {
    bestStart = curStart;
    bestLen = curLen;
  }

  const hexStrings = hextets.map((h) => h.toString(16));
  if (bestStart !== -1) {
    const left = hexStrings.slice(0, bestStart).join(":");
    const right = hexStrings.slice(bestStart + bestLen).join(":");
    return (left ? left : "") + "::" + (right ? right : "");
  }
  return hexStrings.join(":");
}

/**
 * Validates, cleans, and normalizes an incoming IP address candidate.
 * Returns null if the value is malformed, invalid, or empty.
 */
export function normalizeIp(raw: string | null | undefined): NormalizedIp | null {
  if (!raw || typeof raw !== "string") return null;

  const candidate = cleanCandidate(raw);
  if (!candidate) return null;

  const ipType = isIP(candidate);
  if (ipType === 0) return null;

  if (ipType === 4) {
    // node:net isIPv4 already validates 4 octets 0-255 and rejects leading zeros
    const octets = candidate.split(".").map(Number);
    if (octets.length !== 4 || octets.some((o) => isNaN(o) || o < 0 || o > 255)) {
      return null;
    }
    const normalized = octets.join(".");
    return {
      normalized,
      bucketKey: normalized,
      version: 4,
    };
  }

  if (ipType === 6) {
    const hextets = parseIPv6Hextets(candidate);
    if (!hextets) return null;

    // Check for IPv4-mapped IPv6 address: ::ffff:a.b.c.d
    // hextets 0-4 are 0, hextet 5 is 0xffff
    const isV4Mapped =
      hextets[0] === 0 &&
      hextets[1] === 0 &&
      hextets[2] === 0 &&
      hextets[3] === 0 &&
      hextets[4] === 0 &&
      hextets[5] === 0xffff;

    if (isV4Mapped) {
      const h6 = hextets[6] ?? 0;
      const h7 = hextets[7] ?? 0;
      const v4 = [
        (h6 >> 8) & 0xff,
        h6 & 0xff,
        (h7 >> 8) & 0xff,
        h7 & 0xff,
      ].join(".");
      return {
        normalized: v4,
        bucketKey: v4,
        version: 4,
      };
    }

    // Native IPv6:
    // Format full address canonically per RFC 5952
    const normalized = formatIPv6Canonical(hextets);

    // Group by /64 prefix (the first 4 hextets)
    // Standard residential/cloud IPv6 allocations assign at least a /64 subnet.
    // RFC 4941 / RFC 8981 privacy extensions rotate the bottom 64 bits (interface ID).
    // Partitioning by /64 ensures privacy rotation cannot bypass rate limits while
    // independent /64 subnets remain isolated.
    const prefixHextets = hextets.slice(0, 4);
    const bucketKey = `${prefixHextets.map((h) => h.toString(16)).join(":")}::/64`;

    return {
      normalized,
      bucketKey,
      version: 6,
    };
  }

  return null;
}

