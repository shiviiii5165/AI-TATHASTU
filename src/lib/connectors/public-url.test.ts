import { describe, expect, it } from "vitest";

import { isPrivateAddress, publicUrl } from "./public-url";

const resolvesTo = (...ips: string[]) => async () => ips.map((address) => ({ address }));

describe("publicUrl", () => {
  it("accepts a name with only public addresses", async () => {
    expect(await publicUrl("yourname.dev", resolvesTo("93.184.216.34"))).toBe("https://yourname.dev/");
  });

  it.each(["127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.0.5", "::1", "fd00::1", "::ffff:10.0.0.1"])(
    "rejects a name resolving to %s",
    async (ip) => {
      expect(await publicUrl("rebind.example.com", resolvesTo(ip))).toBeNull();
    },
  );

  it("rejects when any one address is private", async () => {
    expect(await publicUrl("mixed.example.com", resolvesTo("93.184.216.34", "10.0.0.1"))).toBeNull();
  });

  it("rejects literals, internal names and unresolvable hosts", async () => {
    const never = async () => {
      throw new Error("no such host");
    };
    expect(await publicUrl("http://127.0.0.1/", resolvesTo("93.184.216.34"))).toBeNull();
    expect(await publicUrl("http://db.internal/", resolvesTo("93.184.216.34"))).toBeNull();
    expect(await publicUrl("ftp://site.example.com/", resolvesTo("93.184.216.34"))).toBeNull();
    expect(await publicUrl("gone.example.com", never)).toBeNull();
  });
});

describe("isPrivateAddress", () => {
  it("does not flag public addresses", () => {
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("2001:4860:4860::8888")).toBe(false);
  });
});
