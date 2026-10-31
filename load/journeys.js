// k6 journeys against a LOCAL stack only (stubbed providers, synthetic users from
// load/seed.mts). Not part of the test suite. Example (Docker, no k6 install):
//   docker run --rm -i -v "$PWD/load:/load" -v "<tokens dir>:/data" -e BASE=http://host.docker.internal:3100 \
//     -e PEAK=250 grafana/k6:0.54.0 run /load/journeys.js
// Each VU is one signed-in session with think time between steps, so request
// rate follows from sessions x journey, not from registered users.
// WRITES=heavy adds read-your-write loops. Every isolation metric counts its own
// checks: isolation_checks must be > 0 or the run didn't exercise isolation at all.
import { check, group, sleep } from "k6";
import http from "k6/http";
import { SharedArray } from "k6/data";
import { Counter, Rate, Trend } from "k6/metrics";

// One URL, or several comma-separated: each VU sticks to one app instance.
const BASES = (__ENV.BASE || "http://host.docker.internal:3100").split(",");
const base = () => BASES[__VU % BASES.length];
const PEAK = Number(__ENV.PEAK || 100);
const HOLD = __ENV.HOLD || "2m";
const MODE = __ENV.MODE || "ramp"; // ramp | spike | soak
const HEAVY = __ENV.WRITES === "heavy";
const sessions = new SharedArray("sessions", () => JSON.parse(open(__ENV.TOKENS || "/data/tokens.json")));

const readLatency = new Trend("read_latency", true);
const writeLatency = new Trend("write_latency", true);
const failures = new Rate("journey_failures"); // Not a 2xx/3xx, or the body was wrong.
const leaks = new Counter("cross_user_leak");
const isolationChecks = new Counter("isolation_checks");
const staleWrites = new Counter("write_not_visible");
const limited = new Counter("rate_limited_429");
const unavailable = new Counter("server_errors_5xx");
const timeouts = new Counter("timeouts");

const scenarios = {
  ramp: { executor: "ramping-vus", startVUs: 0, stages: [{ duration: "1m", target: PEAK }, { duration: HOLD, target: PEAK }, { duration: "30s", target: 0 }] },
  spike: { executor: "ramping-vus", startVUs: 0, stages: [{ duration: "30s", target: Math.round(PEAK / 5) }, { duration: "10s", target: PEAK }, { duration: "1m", target: PEAK }, { duration: "10s", target: Math.round(PEAK / 5) }, { duration: "1m", target: Math.round(PEAK / 5) }] },
  soak: { executor: "constant-vus", vus: PEAK, duration: HOLD },
};

export const options = {
  scenarios: { journeys: { ...scenarios[MODE], ...(MODE === "soak" ? {} : { gracefulRampDown: "10s" }) } },
  thresholds: {
    read_latency: ["p(95)<500", "p(99)<1500"],
    write_latency: ["p(95)<800", "p(99)<2500"],
    journey_failures: ["rate<0.01"],
    cross_user_leak: ["count==0"],
    isolation_checks: ["count>0"],
    write_not_visible: ["count==0"],
  },
  summaryTrendStats: ["p(50)", "p(95)", "p(99)", "max", "count"],
  // Our ownership probe answers 404 by design; 429 is the limiter working.
  noConnectionReuse: false,
};

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 404, 429));

function think(min = 3, max = 8) {
  sleep(min + Math.random() * (max - min));
}

function record(res, trend, name, expected = 200) {
  trend.add(res.timings.duration, { name });
  if (res.status === 0) timeouts.add(1, { name });
  if (res.status >= 500) unavailable.add(1, { name });
  if (res.status === 429) limited.add(1, { name });
  const ok = res.status === expected;
  failures.add(!ok, { name });
  check(res, { [`${name} ${expected}`]: () => ok });
  return ok;
}

const headers = (s, extra = {}) => ({ Cookie: `authjs.session-token=${s.cookie}`, ...extra });

function get(path, s, name, { expected = 200, extraHeaders } = {}) {
  const res = http.get(`${base()}${path}`, { headers: headers(s, extraHeaders), redirects: 0, tags: { name } });
  record(res, readLatency, name, expected);
  return res;
}

function post(path, s, body, name, expected = 200) {
  const res = http.post(`${base()}${path}`, JSON.stringify(body), { headers: headers(s, { "Content-Type": "application/json" }), redirects: 0, tags: { name } });
  record(res, writeLatency, name, expected);
  return res;
}

function isolation(name, passed) {
  isolationChecks.add(1, { name });
  if (!passed) leaks.add(1, { name });
  check(null, { [`isolation: ${name}`]: () => passed });
}

const safeJson = (res) => {
  try {
    return res.json();
  } catch {
    return null;
  }
};

export default function () {
  const s = sessions[(__VU - 1) % sessions.length];

  group("dashboard", () => {
    const page = get("/dashboard", s, "page /dashboard");
    if (page.status === 200) isolation("dashboard greets its owner", page.body.includes(s.name.split(" ")[0] + "<") || new RegExp(`\\b${s.name.split(" ")[0]}\\b`).test(page.body));
    const st = get("/api/dashboard/status", s, "api dashboard/status");
    if (st.status === 200) check(st, { "status has ready and job": (r) => { const b = safeJson(r); return b && b.ready === true && "job" in b; } });
    think();

    // Session isolation: the profile API must describe *this* session's user.
    const me = get("/api/profile/v1/me", s, "api profile/me", { extraHeaders: { "X-AIT-Module": "learn" } });
    if (me.status === 200) {
      const body = safeJson(me);
      isolation("profile/me is the session user", Boolean(body) && body.identity && body.identity.name === s.name);
    }
    // Object-level ownership: another user's job must read as not found.
    const other = get(`/api/jobs/${s.otherUsersJob}`, s, "api jobs (other user's)", { expected: 404 });
    // A failed or rejected request says nothing; only a 200 hands over the data. Fail the run outright
    // if sessions are being rejected, rather than report numbers for the login check alone.
    if (other.status === 200 || other.status === 404) isolation("other user's job is hidden", other.status === 404);
    think();
  });

  group("profile and skills", () => {
    get("/profile", s, "page /profile");
    think();
    const pinned = Math.random() < 0.5;
    const saved = post("/api/widget-prefs", s, { widgetId: "skill_gaps", pinned }, "api widget-prefs (write)").status === 200;
    const prefs = safeJson(get("/api/widget-prefs", s, "api widget-prefs (read)"));
    // Read-your-write: a write reported as saved must be there, for this user.
    const row = prefs && prefs.prefs && prefs.prefs.find((p) => p.widgetId === "skill_gaps");
    if (saved && prefs && (!row || row.pinned !== pinned)) staleWrites.add(1);
    think(2, 5);
    get("/skills", s, "page /skills");
    think();
    get("/projects", s, "page /projects");
    think();
  });

  if (Math.random() < 0.5) {
    group("people discovery", () => {
      const people = get("/people", s, "page /people");
      // Private students must never appear; students never see any student. The viewer's own name doesn't count.
      const others = people.status === 200 ? people.body.split(s.name).join("") : "";
      if (people.status === 200) isolation("people hides private students", !others.includes("Load Student Private"));
      if (people.status === 200 && s.role === "student") isolation("students see no students", !others.includes("Load Student"));
      think();
      const search = safeJson(get("/api/search?q=load%20student", s, "api search"));
      if (search && search.results) {
        const titles = search.results.people.map((p) => p.title).join("|");
        isolation("search hides private students", !titles.includes("Private"));
        if (s.role === "student") isolation("search shows students no students", !titles.includes("Student"));
      }
      think();
    });
  }

  if (Math.random() < 0.3) {
    group("yora (rule-based, no provider)", () => {
      const reply = safeJson(post("/api/yora/chat", s, { message: "what skills should I learn next?" }, "api yora (write path)"));
      if (reply) check(null, { "yora answered": () => typeof reply.response === "string" });
      think();
    });
  }

  if (HEAVY) {
    group("writes", () => {
      for (let i = 0; i < 5; i++) {
        const dismissed = i % 2 === 0;
        const saved = post("/api/widget-prefs", s, { widgetId: "profile_completeness", dismissed }, "api widget-prefs (write)").status === 200;
        const prefs = safeJson(get("/api/widget-prefs", s, "api widget-prefs (read)"));
        const row = prefs && prefs.prefs && prefs.prefs.find((p) => p.widgetId === "profile_completeness");
        if (saved && prefs && (!row || row.dismissed !== dismissed)) staleWrites.add(1);
        post("/api/analytics", s, { event: "institution_select", properties: { other: true } }, "api analytics (write)", 204);
        think(1, 2);
      }
    });
  }
  // Resume upload is step-gated to onboarding (403 for finished users), so it
  // isn't part of this post-onboarding journey; see the audit for its tests.
}
