import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { normalizeIp } from "./ip";

describe("normalizeIp", () => {
  describe("IPv4", () => {
    it("normalizes standard dotted-decimal IPv4", () => {
      const res = normalizeIp("192.0.2.1");
      expect(res).toEqual({
        normalized: "192.0.2.1",
        bucketKey: "192.0.2.1",
        version: 4,
      });
    });

    it("strips port from IPv4", () => {
      const res = normalizeIp("198.51.100.42:8080");
      expect(res).toEqual({
        normalized: "198.51.100.42",
        bucketKey: "198.51.100.42",
        version: 4,
      });
    });

    it("rejects leading zeros (prevents octal misinterpretation)", () => {
      expect(normalizeIp("010.0.0.1")).toBeNull();
      expect(normalizeIp("192.168.01.1")).toBeNull();
    });

    it("rejects invalid octets or wrong count", () => {
      expect(normalizeIp("256.0.0.1")).toBeNull();
      expect(normalizeIp("1.2.3")).toBeNull();
      expect(normalizeIp("1.2.3.4.5")).toBeNull();
      expect(normalizeIp("1.2.3.-4")).toBeNull();
    });
  });

  describe("IPv6", () => {
    it("normalizes standard IPv6 to RFC 5952 canonical format", () => {
      const res = normalizeIp("2001:0db8:0000:0000:0000:0000:0000:0001");
      expect(res).toEqual({
        normalized: "2001:db8::1",
        bucketKey: "2001:db8:0:0::/64",
        version: 6,
      });
    });

    it("handles IPv6 loopback", () => {
      const res = normalizeIp("::1");
      expect(res).toEqual({
        normalized: "::1",
        bucketKey: "0:0:0:0::/64",
        version: 6,
      });
    });

    it("strips port and brackets from IPv6", () => {
      const res = normalizeIp("[2001:db8:abcd:12::42]:8443");
      expect(res).toEqual({
        normalized: "2001:db8:abcd:12::42",
        bucketKey: "2001:db8:abcd:12::/64",
        version: 6,
      });
    });

    it("groups privacy addresses in the same /64 subnet into the same bucketKey", () => {
      // Two temporary SLAAC / privacy addresses (RFC 4941/8981) from the same /64 prefix
      const client1 = normalizeIp("2001:db8:abcd:0012:1234:5678:9abc:def0");
      const client2 = normalizeIp("2001:db8:abcd:0012:ffff:eeee:dddd:cccc");

      expect(client1?.bucketKey).toBe("2001:db8:abcd:12::/64");
      expect(client2?.bucketKey).toBe("2001:db8:abcd:12::/64");
      expect(client1?.bucketKey).toBe(client2?.bucketKey);
      // But full addresses remain distinct
      expect(client1?.normalized).not.toBe(client2?.normalized);
    });

    it("partitions different /64 subnets into distinct bucketKeys", () => {
      const netA = normalizeIp("2001:db8:abcd:0012::1");
      const netB = normalizeIp("2001:db8:abcd:0013::1");

      expect(netA?.bucketKey).toBe("2001:db8:abcd:12::/64");
      expect(netB?.bucketKey).toBe("2001:db8:abcd:13::/64");
      expect(netA?.bucketKey).not.toBe(netB?.bucketKey);
    });

    it("maps IPv4-mapped IPv6 (::ffff:x.x.x.x) to canonical IPv4", () => {
      const res = normalizeIp("::ffff:192.0.2.1");
      expect(res).toEqual({
        normalized: "192.0.2.1",
        bucketKey: "192.0.2.1",
        version: 4,
      });
    });

    it("rejects malformed IPv6 strings", () => {
      expect(normalizeIp("2001:db8::1::2")).toBeNull(); // multiple ::
      expect(normalizeIp("2001:gggg::1")).toBeNull(); // invalid hex
      expect(normalizeIp("2001:db8:1:2:3:4:5:6:7")).toBeNull(); // 9 hextets
    });
  });

  describe("Invalid and Garbage inputs", () => {
    it("returns null for non-IP, empty, or malicious strings", () => {
      expect(normalizeIp("")).toBeNull();
      expect(normalizeIp("   ")).toBeNull();
      expect(normalizeIp(null)).toBeNull();
      expect(normalizeIp(undefined)).toBeNull();
      expect(normalizeIp("unknown")).toBeNull();
      expect(normalizeIp("localhost")).toBeNull();
      expect(normalizeIp("1.1.1.1, 2.2.2.2")).toBeNull(); // multi-IP unsplit list
      expect(normalizeIp("<script>alert(1)</script>")).toBeNull();
      expect(normalizeIp("127.0.0.1; DROP TABLE users;")).toBeNull();
    });
  });
});

