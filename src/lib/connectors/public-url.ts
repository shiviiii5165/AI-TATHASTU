import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const PRIVATE = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) PRIVATE.addSubnet(net, bits, "ipv4");
for (const [net, bits] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const) PRIVATE.addSubnet(net, bits, "ipv6");

export function isPrivateAddress(address: string) {
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mapped) return PRIVATE.check(mapped, "ipv4");
  return PRIVATE.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");
}

type Resolve = (host: string) => Promise<{ address: string }[]>;
const resolveAll: Resolve = (host) => lookup(host, { all: true });

/**
 * Public http(s) URL only: no localhost, private suffixes, raw IPs, or names that
 * resolve to private addresses (the worker's scraper will fetch it). The answer can
 * change after this check, so the fetcher's own protections still matter.
 */
export async function publicUrl(raw: string, resolve: Resolve = resolveAll): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (!["http:", "https:"].includes(u.protocol) || !host.includes(".")) return null;
  if (isIP(host.replace(/^\[|\]$/g, "")) || host === "localhost" || /\.(local|internal|localhost)$/.test(host)) return null;
  try {
    const addresses = await resolve(host);
    if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) return null;
  } catch {
    return null; // Doesn't resolve: nothing to fetch.
  }
  return u.toString();
}
