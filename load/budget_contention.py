"""Measures the AI budget gate on a throwaway local Postgres. Wipes spend tables; refuses a non-local DSN.

    python load/budget_contention.py postgresql://postgres:test@127.0.0.1:55432/ait_test

Reports reserve + settle latency against concurrency, round trips per call, and a simulated
repo-scoring run. Local numbers show lock contention; a remote database adds its round-trip
time to every statement, which the report also estimates.
"""

from __future__ import annotations

import statistics
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from pathlib import Path

import psycopg2

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "worker"))
import ai_budget  # noqa: E402


def percentile(values, q):
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(len(ordered) * q))]


def setup(dsn):
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("DELETE FROM ai_usage_ledger; DELETE FROM ai_spend_counters")
    cur.execute("UPDATE ai_cost_budgets SET budget_usd = 99999, user_daily_usd = 99999, user_monthly_usd = 99999")
    return cur


def users(cur, n):
    ids = [str(uuid.uuid4()) for _ in range(n)]
    for i in ids:
        cur.execute("INSERT INTO users (id, email) VALUES (%s, %s)", (i, f"{i}@bench.test"))
    return ids


def one_call(gate, scope):
    started = time.perf_counter()
    reservation = gate.reserve(scope, "groq", "m", "bench", Decimal("0.001"), 25.0)
    reserved = time.perf_counter()
    gate.settle(reservation, "metered", Decimal("0.0005"), 10, 10)
    return (reserved - started) * 1000, (time.perf_counter() - reserved) * 1000


def concurrency_run(dsn, cur, threads, calls_each, same_user):
    ids = users(cur, 1 if same_user else threads)
    gate = ai_budget.PostgresGate(dsn)

    def run(index):
        scope = ai_budget.Scope(ids[0 if same_user else index], None)
        return [one_call(gate, scope) for _ in range(calls_each)]

    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=threads) as pool:
        results = [r for rs in pool.map(run, range(threads)) for r in rs]
    elapsed = time.perf_counter() - started
    reserve = [r[0] for r in results]
    settle = [r[1] for r in results]
    print(f"{threads:>3} threads {'one user ' if same_user else 'many users'} | reserve p50 {statistics.median(reserve):7.1f} p95 {percentile(reserve, .95):7.1f} p99 {percentile(reserve, .99):7.1f} ms"
          f" | settle p50 {statistics.median(settle):6.1f} p95 {percentile(settle, .95):6.1f} ms | {len(results) / elapsed:6.0f} calls/s")


def round_trips(dsn, cur):
    """Counts statements with a tracing cursor, excluding commits and begins."""
    user = users(cur, 1)[0]
    gate = ai_budget.PostgresGate(dsn)
    gate.reserve(ai_budget.Scope(user, None), "groq", "m", "warm", Decimal("0.001"), 25.0)  # first run creates counters
    conn = gate._local.conn
    count = {"n": 0}

    class Counting(conn.cursor_factory or psycopg2.extensions.cursor):
        def execute(self, *a, **k):
            count["n"] += 1
            return super().execute(*a, **k)

    conn.cursor_factory = Counting
    reservation = gate.reserve(ai_budget.Scope(user, None), "groq", "m", "x", Decimal("0.001"), 25.0)
    reserved = count["n"]
    gate.settle(reservation, "metered", Decimal("0.0005"), 1, 1)
    return reserved, count["n"] - reserved


def repo_scoring(dsn, cur, repos, concurrency, provider_ms, with_gate):
    """100 repos scored four at a time, as repo_scorer does, with a simulated provider call."""
    user = users(cur, 1)[0]
    gate = ai_budget.PostgresGate(dsn)
    scope = ai_budget.Scope(user, None)

    def score(_):
        reservation = gate.reserve(scope, "groq", "m", "bench", Decimal("0.0001"), 15.0) if with_gate else None
        time.sleep(provider_ms / 1000)
        if reservation:
            gate.settle(reservation, "metered", Decimal("0.00005"), 1, 1)

    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        list(pool.map(score, range(repos)))
    return time.perf_counter() - started


def main():
    dsn = sys.argv[1]
    if "127.0.0.1" not in dsn and "localhost" not in dsn:
        raise SystemExit("refusing a non-local database")
    cur = setup(dsn)
    print("Reservation and settlement against concurrency (all contend on the one global row):")
    for threads in (1, 2, 4, 8, 16, 32):
        concurrency_run(dsn, cur, threads, 30, same_user=False)
    concurrency_run(dsn, cur, 8, 30, same_user=True)

    reserve_trips, settle_trips = round_trips(dsn, cur)
    print(f"\nStatements per paid call: reserve {reserve_trips}, settle {settle_trips} (plus commits)")
    for rtt in (2, 10, 50):
        print(f"  added serial latency at {rtt:>2} ms round trip: about {(reserve_trips + settle_trips + 3) * rtt} ms per call")

    print("\n100 repos, 4 at a time, simulated provider call:")
    for provider_ms in (200, 1000):
        bare = repo_scoring(dsn, cur, 100, 4, provider_ms, with_gate=False)
        gated = repo_scoring(dsn, cur, 100, 4, provider_ms, with_gate=True)
        print(f"  provider {provider_ms:>4} ms: without gate {bare:6.2f} s, with gate {gated:6.2f} s (+{(gated / bare - 1) * 100:.1f}%)")


if __name__ == "__main__":
    main()
