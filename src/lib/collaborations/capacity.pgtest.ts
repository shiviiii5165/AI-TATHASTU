import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { createPoolDb, resetAndMigrate } from "@/test/real-postgres";

// Real Postgres, separate connections: proves collab_decide_application's row lock really serialises concurrent
// acceptances (PGlite has one connection, so service.test.ts can't). `npm run test:pg` with TEST_POSTGRES_URL.
let db: ReturnType<typeof createPoolDb>;

beforeAll(async () => {
  await resetAndMigrate();
  db = createPoolDb();
});

const one = async <T>(q: ReturnType<typeof sql>) => ((await db.execute(q)).rows[0] as T);

describe("team capacity under concurrency", () => {
  it("20 simultaneous acceptances on a 3-person team admit exactly 3", async () => {
    const owner = await one<{ id: string }>(sql`insert into users (email) values ('owner@example.com') returning id`);
    const post = await one<{ id: string }>(sql`insert into collab_posts (owner_id, creator_type, category, status, title, summary, capacity) values (${owner.id}, 'student', 'project', 'recruiting', 'Race test', 's', 3) returning id`);
    const apps: string[] = [];
    for (let i = 0; i < 20; i++) {
      const u = await one<{ id: string }>(sql`insert into users (email) values (${`a${i}@example.com`}) returning id`);
      const r = await one<{ r: string }>(sql`select collab_apply(${post.id}::uuid, ${u.id}::uuid, null, 'hi', '{}'::text[], 'm', '[]'::jsonb) as r`);
      apps.push(r.r);
    }
    const results = await Promise.all(apps.map((id) => one<{ r: string }>(sql`select collab_decide_application(${id}::uuid, ${owner.id}::uuid, true) as r`)));
    expect(results.filter((r) => r.r === "accepted")).toHaveLength(3);
    expect(results.filter((r) => r.r === "!full" || r.r === "!not_recruiting")).toHaveLength(17);
    const members = await one<{ n: number }>(sql`select count(*)::int as n from collab_members where post_id = ${post.id} and kind = 'member' and status = 'active'`);
    expect(members.n).toBe(3);
    expect((await one<{ status: string }>(sql`select status from collab_posts where id = ${post.id}`)).status).toBe("team_full");
  });

  it("the same applicant can't hold two pending requests even when sent at once", async () => {
    const owner = await one<{ id: string }>(sql`insert into users (email) values ('owner2@example.com') returning id`);
    const u = await one<{ id: string }>(sql`insert into users (email) values ('dup@example.com') returning id`);
    const post = await one<{ id: string }>(sql`insert into collab_posts (owner_id, creator_type, category, status, title, summary, capacity) values (${owner.id}, 'student', 'project', 'recruiting', 'Dup test', 's', 3) returning id`);
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => one<{ r: string }>(sql`select collab_apply(${post.id}::uuid, ${u.id}::uuid, null, 'hi', '{}'::text[], 'm', '[]'::jsonb) as r`)));
    const pending = await one<{ n: number }>(sql`select count(*)::int as n from collab_applications where post_id = ${post.id} and status = 'pending'`);
    expect(pending.n).toBe(1);
    expect(results.filter((r) => r.status === "fulfilled" && !r.value.r.startsWith("!"))).toHaveLength(1);
  });
});
