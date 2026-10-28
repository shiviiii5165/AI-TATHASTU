// k6 journeys against the LOCAL e2e stack only (stubbed providers, synthetic users).
// Not part of the test suite. Example (Docker, no k6 install):
//   docker run --rm -i -v "$PWD/load:/load" -v "<tokens dir>:/data" -e BASE=http://host.docker.internal:3100 \
//     -e PEAK=250 grafana/k6:0.54.0 run /load/journeys.js
// Each VU is one signed-in session with think time between steps, so request
// rate follows from sessions x journey, not from registered users.
import { check, group, sleep } from "k6";
import http from "k6/http";
import { SharedArray } from "k6/data";
import { Trend, Rate } from "k6/metrics";

const BASE = __ENV.BASE || "http://host.docker.internal:3100";
const PEAK = Number(__ENV.PEAK || 100);
const HOLD = __ENV.HOLD || "2m";
const MODE = __ENV.MODE || "ramp"; // ramp | spike | soak
const sessions = new SharedArray("sessions", () => JSON.parse(open(__ENV.TOKENS || "/data/tokens.json")));

const readLatency = new Trend("read_latency", true);
const writeLatency = new Trend("write_latency", true);
const wrongUser = new Rate("cross_user_leak");

const scenarios = {
  ramp: { executor: "ramping-vus", startVUs: 0, stages: [{ duration: "1m", target: PEAK }, { duration: HOLD, target: PEAK }, { duration: "30s", target: 0 }] },
  spike: { executor: "ramping-vus", startVUs: 0, stages: [{ duration: "30s", target: Math.round(PEAK / 5) }, { duration: "10s", target: PEAK }, { duration: "1m", target: PEAK }, { duration: "10s", target: Math.round(PEAK / 5) }, { duration: "1m", target: Math.round(PEAK / 5) }] },
  soak: { executor: "constant-vus", vus: PEAK, duration: HOLD },
};

export const options = {
  scenarios: { journeys: { ...scenarios[MODE], gracefulRampDown: "10s" } },
  thresholds: {
    "read_latency": ["p(95)<500", "p(99)<1500"],
    "write_latency": ["p(95)<800", "p(99)<2500"],
    "http_req_failed{expected_5xx:no}": ["rate<0.01"],
    "cross_user_leak": ["rate==0"],
  },
  summaryTrendStats: ["p(50)", "p(95)", "p(99)", "max", "count"],
};

function think(min = 3, max = 8) {
  sleep(min + Math.random() * (max - min));
}

function get(path, s, name) {
  const res = http.get(`${BASE}${path}`, { headers: { Cookie: `authjs.session-token=${s.cookie}` }, redirects: 0, tags: { name } });
  readLatency.add(res.timings.duration, { name });
  check(res, { [`${name} 200`]: (r) => r.status === 200 });
  return res;
}

function post(path, s, body, name) {
  const res = http.post(`${BASE}${path}`, JSON.stringify(body), {
    headers: { Cookie: `authjs.session-token=${s.cookie}`, "Content-Type": "application/json" },
    redirects: 0,
    tags: { name },
  });
  writeLatency.add(res.timings.duration, { name });
  check(res, { [`${name} ok`]: (r) => r.status < 400 || r.status === 429 });
  return res;
}

export default function () {
  const s = sessions[(__VU - 1) % sessions.length];

  group("dashboard", () => {
    get("/dashboard", s, "page /dashboard");
    const st = get("/api/dashboard/status", s, "api dashboard/status");
    think();
    // Session isolation: the profile API must describe *this* session's user.
    const me = http.get(`${BASE}/api/profile/v1/me`, { headers: { Cookie: `authjs.session-token=${s.cookie}` }, tags: { name: "api profile/me" } });
    if (me.status === 200) {
      const id = (me.json() || {}).userId || (me.json() || {}).id;
      wrongUser.add(id !== undefined && id !== s.id);
    }
    void st;
  });

  group("profile and skills", () => {
    get("/profile", s, "page /profile");
    think();
    post("/api/widget-prefs", s, { widgetId: "skill_gaps", pinned: Math.random() < 0.5 }, "api widget-prefs (write)");
    think(2, 5);
    get("/skills", s, "page /skills");
    think();
    get("/projects", s, "page /projects");
    think();
  });

  if (Math.random() < 0.5) {
    group("people discovery", () => {
      get("/people", s, "page /people");
      think();
      get("/api/search?q=python", s, "api search");
      think();
    });
  }

  if (Math.random() < 0.3) {
    group("yora (rule-based, no provider)", () => {
      post("/api/yora/chat", s, { message: "what skills should I learn next?" }, "api yora (write path)");
      think();
    });
  }
  // Resume upload is step-gated to onboarding (403 for finished users), so it
  // isn't part of this post-onboarding journey; see the audit for its tests.
}
