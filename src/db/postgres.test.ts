/**
 * The node-postgres client used for Supabase (src/db/postgres.ts), against a real Postgres wire
 * protocol (PGlite's socket server): atomic batches, plain queries, and TLS/URL handling.
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { eq, sql } from "drizzle-orm";
import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { connectPostgres, poolConfig, sslFor } from "@/db/postgres";
import { SUPABASE_ROOT_CA } from "@/db/supabase-ca";

const tt = pgTable("t", { id: integer("id").primaryKey(), v: text("v").notNull() });
const PORT = 55000 + Math.floor(Math.random() * 400);
let pglite: PGlite;
let server: PGLiteSocketServer;
let db: ReturnType<typeof connectPostgres>;

beforeAll(async () => {
  pglite = new PGlite();
  server = new PGLiteSocketServer({ db: pglite, port: PORT, host: "127.0.0.1" });
  await server.start();
  process.env.DB_POOL_MAX = "1"; // PGlite serves one connection at a time
  db = connectPostgres(`postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`, {});
  await db.execute(sql`create table t (id int primary key, v text not null)`);
});

afterAll(async () => {
  await server.stop();
  await pglite.close();
});

beforeEach(async () => {
  await db.execute(sql`delete from t`);
});

const rows = async () => (await db.execute(sql`select id, v from t order by id`)).rows;

describe("db.batch on node-postgres", () => {
  it("commits every query together and returns each result in order", async () => {
    const results = await db.batch([
      db.execute(sql`insert into t values (1, 'a') returning id`),
      db.execute(sql`insert into t values (2, 'b') returning id`),
    ] as never);
    expect(results).toHaveLength(2);
    expect(await rows()).toEqual([{ id: 1, v: "a" }, { id: 2, v: "b" }]);
  });

  it("is atomic: a failing query rolls back the ones before it", async () => {
    await expect(
      db.batch([
        db.execute(sql`insert into t values (10, 'kept?')`),
        db.execute(sql`insert into t values (10, 'duplicate key')`),
      ] as never),
    ).rejects.toThrow();
    expect(await rows()).toEqual([]);
  });

  it("leaves the connection usable after a rolled-back batch", async () => {
    await db.batch([db.execute(sql`insert into t values (1, 'x')`), db.execute(sql`insert into t values (1, 'y')`)] as never).catch(() => undefined);
    await db.execute(sql`insert into t values (3, 'after')`);
    expect(await rows()).toEqual([{ id: 3, v: "after" }]);
  });

  it("works with Drizzle builders (insert/update/delete ... returning), as the app uses it", async () => {
    const [ins, upd, del] = (await db.batch([
      db.insert(tt).values([{ id: 7, v: "seven" }, { id: 8, v: "eight" }]).returning({ id: tt.id }),
      db.update(tt).set({ v: "SEVEN" }).where(eq(tt.id, 7)).returning({ id: tt.id, v: tt.v }),
      db.delete(tt).where(eq(tt.id, 8)).returning({ id: tt.id }),
    ] as never)) as [{ id: number }[], { id: number; v: string }[], { id: number }[]];
    expect(ins).toEqual([{ id: 7 }, { id: 8 }]);
    expect(upd).toEqual([{ id: 7, v: "SEVEN" }]);
    expect(del).toEqual([{ id: 8 }]);
    expect(await db.select().from(tt)).toEqual([{ id: 7, v: "SEVEN" }]);
  });

  it("a failing Drizzle builder rolls back the whole batch", async () => {
    await expect(
      db.batch([db.insert(tt).values({ id: 20, v: "a" }), db.insert(tt).values({ id: 20, v: "dup" })] as never),
    ).rejects.toThrow();
    expect(await db.select().from(tt)).toEqual([]);
  });

  it("plain queries outside a batch still run normally", async () => {
    await db.execute(sql`insert into t values (5, 'solo')`);
    expect(await rows()).toEqual([{ id: 5, v: "solo" }]);
  });
});

describe("TLS and connection settings", () => {
  it("verifies Supabase against Supabase's root CA, strictly", () => {
    expect(sslFor("aws-0-ap-south-1.pooler.supabase.com", "require")).toEqual({
      ca: SUPABASE_ROOT_CA,
      rejectUnauthorized: true,
      servername: "aws-0-ap-south-1.pooler.supabase.com",
    });
    expect(sslFor("db.abc.supabase.co", null)).toMatchObject({ ca: SUPABASE_ROOT_CA, rejectUnauthorized: true });
  });

  it("other remote hosts verify against the system store; never rejectUnauthorized:false", () => {
    expect(sslFor("ep-x.us-east-2.aws.neon.tech", "require")).toEqual({ rejectUnauthorized: true, servername: "ep-x.us-east-2.aws.neon.tech" });
  });

  it("only loopback may go without TLS", () => {
    expect(sslFor("127.0.0.1", null)).toBe(false);
    expect(sslFor("localhost", null)).toBe(false);
  });

  it("decodes credentials and ignores the URL's sslmode", () => {
    const c = poolConfig("postgresql://postgres.ref:p%40ss%2Fw0rd@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require");
    expect(c).toMatchObject({ host: "aws-0-ap-south-1.pooler.supabase.com", port: 6543, user: "postgres.ref", password: "p@ss/w0rd", database: "postgres" });
    expect(c.ssl).toMatchObject({ rejectUnauthorized: true, ca: SUPABASE_ROOT_CA });
  });
});
