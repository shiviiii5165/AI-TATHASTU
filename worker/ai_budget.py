"""Spending limits for every paid provider call: LLMs, embeddings, Firecrawl, Apify.

reserve() atomically sets aside the most a call could cost, or refuses it. settle()
replaces that with what it did cost. If the database can't be reached nothing is
reserved and the call doesn't happen: this fails closed.

Maximum exposure. A limit can only be passed by a call that costs more than its
reservation, and a reservation is the call's upper bound: at most one token per input
character, the output cap we send, and every attempt the call can make. In-flight calls
hold their reservations, and how many can be open is capped. So, with correct rates:

    spend <= limit + (open calls) x (amount a provider bills beyond our bound)

which is zero unless a provider ignores the output cap or tokenises beyond a token per
character. An overrun is recorded at its real cost, logged as ai_reservation_exceeded, and
counts against the limit, so the next reservation is refused. Wrong rates are the
remaining risk: these are our rates, not provider invoices.

A reservation whose worker died is never released as free: once it expires it is charged
in full as `estimated`, because the provider may well have billed for it. settle() only
acts on a row still `reserved`, so a late or repeated settle can't count anything twice.

Statuses: `metered` has token counts reported by the provider, priced at our configured
rates. `estimated` is charged at the reservation, because usage wasn't reported, or the
call timed out, or it's a flat per-call price. `released` was refused by the provider
before doing any work and costs nothing. None of these is a provider invoice.
"""

from __future__ import annotations

import contextvars
import json
import logging
import os
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from decimal import ROUND_CEILING, Decimal
from typing import Any, Iterator, List, Optional, Tuple

import psycopg2

from jobs import NeedsReview

log = logging.getLogger("worker.ai_budget")

# USD per million tokens (input, output), per provider. Deliberately on the high side
# until set from real price lists: AI_MODEL_PRICES overrides per model, e.g.
# {"gemini-2.5-flash": {"in": 0.3, "out": 2.5}}. OpenRouter ":free" models cost nothing.
PROVIDER_RATES = {"groq": (0.60, 0.80), "gemini": (0.30, 2.50), "openrouter": (3.00, 15.00)}
DEFAULT_RATES = (3.00, 15.00)
# Flat per-call prices, overridable with AI_FIRECRAWL_CALL_USD and AI_APIFY_CALL_USD.
FIRECRAWL_CALL_USD = 0.01
APIFY_CALL_USD = 0.004  # the actor mode in connectors/linkedin.py: $4 per 1,000
TOKENS_PER_IMAGE = 2000
EXPIRY_MARGIN_S = 120
SWEEP_BATCH = 10
# Open calls allowed at once. The worker's own peak is far lower (two queue threads, four
# repo-scoring threads), so hitting these means something is wrong; override if that changes.
MAX_OPEN_PER_USER = 8
MAX_OPEN_GLOBAL = 32
MICRO = Decimal("0.000001")


class BudgetError(NeedsReview):
    """Not retried: a retry would only be refused again. Callers fall back to rules."""


class BudgetDenied(BudgetError):
    pass


class BudgetUnavailable(BudgetError):
    pass


class JobAiUse:
    """What really happened in a job, so its output can say whether AI was used. Shared across threads."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.succeeded = 0
        self.failed = 0

    def note(self, ok: bool) -> None:
        with self._lock:
            if ok:
                self.succeeded += 1
            else:
                self.failed += 1


@dataclass(frozen=True)
class Scope:
    user_id: Optional[str]
    job_id: Optional[str]
    use: JobAiUse = field(default_factory=JobAiUse, compare=False)


_scope: contextvars.ContextVar[Scope] = contextvars.ContextVar("ai_budget_scope", default=Scope(None, None))


@contextmanager
def job_scope(user_id: Optional[str], job_id: Optional[str]) -> Iterator[None]:
    """Spend inside this block counts against this user. Threads don't inherit it: use contextvars.copy_context()."""
    token = _scope.set(Scope(str(user_id) if user_id else None, str(job_id) if job_id else None))
    try:
        yield
    finally:
        _scope.reset(token)


def current_use() -> JobAiUse:
    return _scope.get().use


def _rates(provider: str, model: str) -> Tuple[float, float]:
    if model.endswith(":free"):
        return 0.0, 0.0
    try:
        custom = json.loads(os.environ.get("AI_MODEL_PRICES") or "{}").get(model)
        if custom:
            return float(custom["in"]), float(custom["out"])
    except (ValueError, KeyError, TypeError, AttributeError):
        log.error("AI_MODEL_PRICES is invalid; using provider rates")
    return PROVIDER_RATES.get(provider, DEFAULT_RATES)


def _money(value: float) -> Decimal:
    return Decimal(str(value)).quantize(MICRO, rounding=ROUND_CEILING)


def token_cost(provider: str, model: str, tokens_in: int, tokens_out: int) -> Decimal:
    rate_in, rate_out = _rates(provider, model)
    return _money((tokens_in * rate_in + tokens_out * rate_out) / 1_000_000)


def worst_case_cost(provider: str, model: str, chars: int, images: int, max_output: int, posts: int = 1) -> Decimal:
    """An upper bound: a token is at least a character. `posts` covers a call that can send its request twice."""
    return token_cost(provider, model, chars + images * TOKENS_PER_IMAGE, max_output) * posts


def flat_cost(env_var: str, default: float) -> Decimal:
    try:
        return _money(float(os.environ.get(env_var, default)))
    except ValueError:
        return _money(default)


def _open_limit(env_var: str, default: int) -> int:
    raw = os.environ.get(env_var, "")
    return int(raw) if raw.isdigit() and int(raw) > 0 else default


@dataclass
class Reservation:
    id: Optional[str]
    provider: str
    model: str
    amount: Decimal
    started: float = field(default_factory=time.monotonic)
    error_kind: Optional[str] = None

    @property
    def latency_ms(self) -> int:
        return int((time.monotonic() - self.started) * 1000)


# ─── Postgres gate ──────────────────────────────────────────────────────────


LOCK_COUNTER = "SELECT metered_usd + estimated_usd + reserved_usd AS used FROM ai_spend_counters WHERE scope = %s AND period = %s FOR UPDATE"
ENSURE_COUNTER = "INSERT INTO ai_spend_counters (scope, period, user_id) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING"


def _scopes(user_id: Optional[str], day: str, month: str, scoped_to_user: Optional[str]) -> List[Tuple[str, str, Optional[str]]]:
    """Always locked in this order, so concurrent reservations can't deadlock. user_id may be gone at settle time."""
    rows = [("global", month, None)]
    if scoped_to_user:
        rows += [(scoped_to_user, day, user_id), (scoped_to_user, month, user_id)]
    return rows


class PostgresGate:
    def __init__(self, dsn: Optional[str] = None) -> None:
        self.dsn = dsn
        self._local = threading.local()

    def _connect(self) -> Any:
        conn = getattr(self._local, "conn", None)
        if conn is not None and not conn.closed:
            return conn
        dsn = self.dsn or os.environ.get("WORKER_DATABASE_URL") or os.environ.get("DATABASE_URL")
        if not dsn:
            raise BudgetUnavailable("no database configured for AI budgets")
        conn = psycopg2.connect(dsn, connect_timeout=5, application_name="ait-worker-budget", options="-c statement_timeout=5000")
        self._local.conn = conn
        return conn

    def _run(self, fn: Any) -> Any:
        """One transaction, with one retry: Neon closes idle connections, and a deadlock is safe to repeat."""
        for attempt in (1, 2):
            try:
                conn = self._connect()
                with conn, conn.cursor() as cur:
                    return fn(cur)
            except BudgetError:
                raise
            except psycopg2.Error as exc:
                conn = getattr(self._local, "conn", None)
                if conn is not None and not conn.closed:
                    conn.close()
                if attempt == 2:
                    raise BudgetUnavailable(f"AI budget database unavailable: {type(exc).__name__}") from exc

    def reserve(self, scope: Scope, provider: str, model: str, purpose: str, amount: Decimal, timeout: float) -> Reservation:
        self._run(self._sweep_expired)

        def run(cur: Any) -> str:
            cur.execute("SELECT budget_usd, user_daily_usd, user_monthly_usd, to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'), to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM') FROM ai_cost_budgets ORDER BY id LIMIT 1")
            row = cur.fetchone()
            if row is None:
                raise BudgetUnavailable("no AI budget policy")
            global_limit, user_daily, user_monthly, day, month = row
            for key, period, user in _scopes(scope.user_id, day, month, scope.user_id):
                cur.execute(ENSURE_COUNTER, (key, period, user))
                cur.execute(LOCK_COUNTER, (key, period))
                used = cur.fetchone()[0]
                limit = global_limit if key == "global" else (user_daily if period == day else user_monthly)
                if used + amount > limit:
                    label = "global" if key == "global" else ("user-daily" if period == day else "user-monthly")
                    raise BudgetDenied(f"AI budget reached ({label})")
                cur.execute("UPDATE ai_spend_counters SET reserved_usd = reserved_usd + %s WHERE scope = %s AND period = %s", (amount, key, period))
            # Exact: every reservation holds the global row until it commits.
            cur.execute("SELECT count(*), count(*) FILTER (WHERE scoped_to_user = %s) FROM ai_usage_ledger WHERE status = 'reserved'", (scope.user_id,))
            open_all, open_user = cur.fetchone()
            if open_all >= _open_limit("AI_MAX_OPEN_GLOBAL", MAX_OPEN_GLOBAL) or open_user >= _open_limit("AI_MAX_OPEN_PER_USER", MAX_OPEN_PER_USER):
                raise BudgetDenied("too many AI calls in flight")
            cur.execute(
                """INSERT INTO ai_usage_ledger (user_id, job_id, provider, model, purpose, reserved_usd, day, month, scoped_to_user, expires_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, now() + make_interval(secs => %s)) RETURNING id""",
                (scope.user_id, scope.job_id, provider, model, purpose, amount, day, month, scope.user_id, timeout + EXPIRY_MARGIN_S),
            )
            return str(cur.fetchone()[0])

        return Reservation(self._run(run), provider, model, amount)

    def settle(self, reservation: Reservation, status: str, cost: Decimal, tokens_in: Optional[int], tokens_out: Optional[int]) -> None:
        def run(cur: Any) -> None:
            self._close_out(cur, reservation.id, status, cost, tokens_in, tokens_out, reservation.latency_ms, reservation.error_kind)

        self._run(run)

    @staticmethod
    def _close_out(cur: Any, ledger_id: str, status: str, cost: Decimal, tokens_in: Optional[int], tokens_out: Optional[int], latency_ms: Optional[int], error_kind: Optional[str]) -> bool:
        cur.execute(
            """UPDATE ai_usage_ledger SET status = %s, cost_usd = %s, tokens_in = %s, tokens_out = %s, latency_ms = %s, error_kind = %s, settled_at = now()
                WHERE id = %s AND status = 'reserved'
            RETURNING reserved_usd, day, month, scoped_to_user""",
            (status, cost, tokens_in, tokens_out, latency_ms, error_kind, ledger_id),
        )
        row = cur.fetchone()
        if row is None:
            return False  # already settled, or swept after expiring
        reserved, day, month, scoped = row
        if cost > reserved:
            log.error(json.dumps({"event": "ai_reservation_exceeded", "ledger": str(ledger_id), "reserved": str(reserved), "cost": str(cost)}))
        column = {"metered": "metered_usd", "estimated": "estimated_usd"}.get(status, "estimated_usd")
        for key, period, _user in _scopes(None, day, month, scoped):
            cur.execute(LOCK_COUNTER, (key, period))
            cur.execute(
                f"UPDATE ai_spend_counters SET reserved_usd = GREATEST(reserved_usd - %s, 0), {column} = {column} + %s WHERE scope = %s AND period = %s",  # noqa: S608 - column is from the fixed map above
                (reserved, cost, key, period),
            )
        return True

    def _sweep_expired(self, cur: Any) -> None:
        """A worker that died mid-call: its reservation becomes a charge, never free money."""
        cur.execute(
            "SELECT id, reserved_usd FROM ai_usage_ledger WHERE status = 'reserved' AND expires_at < now() ORDER BY expires_at LIMIT %s FOR UPDATE SKIP LOCKED",
            (SWEEP_BATCH,),
        )
        for ledger_id, reserved in cur.fetchall():
            self._close_out(cur, ledger_id, "estimated", reserved, None, None, None, "expired")
            log.warning(json.dumps({"event": "ai_reservation_expired", "ledger": str(ledger_id)}))


_gate: Any = PostgresGate()


def set_gate_for_tests(gate: Any) -> None:
    global _gate
    _gate = gate


# ─── What the call sites use ────────────────────────────────────────────────


def _reserve(provider: str, model: str, purpose: str, amount: Decimal, timeout: float) -> Reservation:
    scope = _scope.get()
    try:
        return _gate.reserve(scope, provider, model, purpose, amount, timeout)
    except BudgetDenied as exc:
        log.warning(json.dumps({"event": "ai_budget_denied", "reason": str(exc), "purpose": purpose, "job": scope.job_id}))
        raise
    except BudgetUnavailable:
        log.error(json.dumps({"event": "ai_budget_unavailable", "purpose": purpose, "job": scope.job_id}))
        raise
    except Exception as exc:  # noqa: BLE001 - anything unexpected here must also stop the spend
        log.error(json.dumps({"event": "ai_budget_unavailable", "purpose": purpose, "kind": type(exc).__name__}))
        raise BudgetUnavailable(f"AI budget check failed: {type(exc).__name__}") from exc


def reserve_tokens(provider: str, model: str, purpose: str, chars: int, images: int, max_output: int, timeout: float, posts: int = 1) -> Reservation:
    return _reserve(provider, model, purpose, worst_case_cost(provider, model, chars, images, max_output, posts), timeout * posts)


def reserve_flat(provider: str, purpose: str, amount: Decimal, timeout: float) -> Reservation:
    return _reserve(provider, provider, purpose, amount, timeout)


def _settle(reservation: Reservation, status: str, cost: Decimal, tokens_in: Optional[int], tokens_out: Optional[int]) -> None:
    try:
        _gate.settle(reservation, status, cost, tokens_in, tokens_out)
    except Exception as exc:  # noqa: BLE001 - the call already happened; expiry charges the reservation in full
        log.error(json.dumps({"event": "ai_settle_failed", "ledger": reservation.id, "kind": type(exc).__name__}))


def settle_used(reservation: Reservation, tokens_in: Any = None, tokens_out: Any = None, error_kind: Optional[str] = None) -> None:
    """The provider did the work, or may have (a timeout). Reported usage is metered; otherwise the reservation stands."""
    reservation.error_kind = error_kind
    if isinstance(tokens_in, int) and isinstance(tokens_out, int):
        _settle(reservation, "metered", token_cost(reservation.provider, reservation.model, tokens_in, tokens_out), tokens_in, tokens_out)
    else:
        _settle(reservation, "estimated", reservation.amount, None, None)


def settle_rejected(reservation: Reservation, error_kind: str = "refused") -> None:
    """The provider refused before doing any work (429, 401, 404): nothing to pay."""
    reservation.error_kind = error_kind
    _settle(reservation, "released", Decimal(0), None, None)
