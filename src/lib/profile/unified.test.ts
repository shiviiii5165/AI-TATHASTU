import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});

const { db } = await import("@/db");
const { profileFacts, users } = await import("@/db/schema");
const { loadProfile } = await import("./unified");
const { platformUrlField } = await import("./field-groups");

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

type Origin = (typeof profileFacts.$inferInsert)["origin"];
const contact = (userId: string, field: string, value: string, origin: Origin, confirmation: "unconfirmed" | "edited" = "unconfirmed") => ({
  userId, fieldGroup: "contact", fieldName: field, normalizedValue: value, extractedValue: value, origin, confirmation,
});

describe("platformUrlField", () => {
  it("files platform profiles under their own field and leaves personal sites alone", () => {
    expect(platformUrlField("https://leetcode.com/u/shiviiii5165/")).toBe("leetcode_url");
    expect(platformUrlField("www.linkedin.com/in/shivam-kumar-singh-lpu")).toBe("linkedin_url");
    expect(platformUrlField("https://github.com/shiviiii5165/")).toBe("github_url");
    expect(platformUrlField("https://www.kaggle.com/asha")).toBe("kaggle_url");
    expect(platformUrlField("https://orcid.org/0000-0002-1825-0097")).toBe("orcid_url");
    expect(platformUrlField("https://stackoverflow.com/users/1/asha")).toBe("stackexchange_url");
    expect(platformUrlField("https://www.hackerrank.com/profile/asha")).toBe("hackerrank_url");
    expect(platformUrlField("https://shivamkumarsingh-ashy.vercel.app/")).toBeNull();
    expect(platformUrlField("https://github.com/asha/repo")).toBeNull(); // a repo, not a profile
    expect(platformUrlField("not a url")).toBeNull();
  });
});

describe("loadProfile contact links", () => {
  it("keeps the portfolio as the website even when older rows stored platform URLs there", async () => {
    const u = id(1);
    await db.insert(users).values({ id: u, name: "Asha", role: "student" });
    await db.insert(profileFacts).values([
      // Written by connectors before platform fields existed (existing data, not rewritten).
      contact(u, "website", "https://leetcode.com/u/asha", "leetcode"),
      contact(u, "website", "https://www.kaggle.com/asha", "kaggle"),
      contact(u, "website", "https://asha-blog.dev", "github"), // GitHub profile "blog"
      contact(u, "website", "https://asha.dev", "portfolio"),
      contact(u, "github_url", "https://github.com/asha", "github"),
    ]);
    const p = await loadProfile(u);
    expect(p.identity.website.best.value).toBe("https://asha.dev");
    expect(p.identity.website.others.map((o) => o.value)).toEqual(["https://asha-blog.dev"]);
    expect(p.identity.leetcode_url.best.value).toBe("https://leetcode.com/u/asha");
    expect(p.identity.kaggle_url.best.value).toBe("https://www.kaggle.com/asha");
    expect(p.identity.github_url.best.value).toBe("https://github.com/asha");
  });

  it("a website the user edited beats the portfolio connector", async () => {
    const u = id(2);
    await db.insert(users).values({ id: u, name: "Ravi", role: "student" });
    await db.insert(profileFacts).values([
      contact(u, "website", "https://ravi.dev", "portfolio"),
      contact(u, "website", "https://ravi.me", "resume", "edited"),
    ]);
    expect((await loadProfile(u)).identity.website.best.value).toBe("https://ravi.me");
  });
});
