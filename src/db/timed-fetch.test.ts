import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { neon, neonConfig } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { timedFetch } from "./timed-fetch";

// A database that accepts the request and never answers: the real driver, a real socket.
let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer(() => {});
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
  vi.unstubAllEnvs();
});

describe("timedFetch", () => {
  it("makes a stalled Neon HTTP query fail instead of hanging", async () => {
    vi.stubEnv("DB_QUERY_TIMEOUT_MS", "150");
    vi.spyOn(console, "error").mockImplementation(() => {});
    neonConfig.fetchFunction = timedFetch;
    neonConfig.fetchEndpoint = () => `http://127.0.0.1:${port}/sql`;

    const sql = neon("postgres://u:p@stalled.example.test/db");
    const started = Date.now();
    await expect(sql`select 1`).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});
