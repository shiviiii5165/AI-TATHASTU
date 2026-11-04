// Which database a script is about to touch, and whether it may.
//
// A write goes through only if the host is this machine, or the operator has named that
// exact host in AIT_APPROVED_WRITE_HOST for this one run. A test or CI run may never leave
// this machine, approved or not. There's no list of "production" hosts to fall out of date:
// anything remote counts as production until someone says otherwise.

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"]);

export function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export const isLocalDatabase = (url) => LOOPBACK.has(hostOf(url) ?? "");

const isTestRun = (env) => env.NODE_ENV === "test" || Boolean(env.CI) || Boolean(env.VITEST);

/** For anything that reads a database: a test or CI run stays on this machine. Returns the url. */
export function assertTestIsolation(url, env = process.env) {
  if (!url) throw new Error("No database URL is set.");
  if (isTestRun(env) && !isLocalDatabase(url)) {
    throw new Error(`Refusing: this is a test or CI run and the database is remote (${hostOf(url) ?? "unparseable URL"}).`);
  }
  return url;
}

/** For anything that writes. Returns the url. The host is named in errors; credentials never are. */
export function assertWriteAllowed(url, env = process.env) {
  assertTestIsolation(url, env);
  if (isLocalDatabase(url)) return url;
  const host = hostOf(url);
  if (!host) throw new Error("Refusing: the database URL can't be parsed.");
  if ((env.AIT_APPROVED_WRITE_HOST ?? "").trim().toLowerCase() !== host) {
    throw new Error(
      `Refusing to write to remote database host ${host}. Treat it as production. ` +
        "If you are the owner and mean to, set AIT_APPROVED_WRITE_HOST to exactly that host for this one command.",
    );
  }
  return url;
}
