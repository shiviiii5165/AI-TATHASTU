"""AI spend limits. Unit tests need nothing; TestPostgresGate needs QUEUE_TEST_DATABASE_URL
pointing at a throwaway database with the migrations applied (skipped otherwise, including in CI)."""

from __future__ import annotations

import os
import sys
import unittest
import urllib.error
import uuid
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from pathlib import Path
from unittest import mock

import psycopg2

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import ai_budget  # noqa: E402
import provider_router  # noqa: E402
from connectors import linkedin, portfolio  # noqa: E402
from connectors.common import HttpError  # noqa: E402
from intelligence import collaboration, repo_scorer  # noqa: E402
from provider_router import Key, KeyPool, Model, Provider  # noqa: E402


class RecordingGate:
    def __init__(self, deny=None):
        self.deny = deny
        self.reserved = []
        self.settled = []

    def reserve(self, scope, provider, model, purpose, amount, timeout):
        if self.deny:
            raise self.deny
        self.reserved.append((scope, provider, model, purpose, amount))
        return ai_budget.Reservation(str(len(self.reserved)), provider, model, amount)

    def settle(self, reservation, status, cost, tokens_in, tokens_out):
        self.settled.append((reservation.id, status, cost, tokens_in, tokens_out))


class FakeProvider(Provider):
    name = "groq"

    def __init__(self, outcomes, usage=None):
        pool = KeyPool("groq", "NOPE")
        pool.keys = [Key("groq_1", "x")]
        super().__init__(pool, [Model("m", "strict")])
        self.outcomes = list(outcomes)
        self.usage = usage
        self.calls = 0

    def call(self, key, model, system, user, schema, images, timeout):
        self.calls += 1
        if self.usage:
            provider_router._record(self.name, model.name, *self.usage, 0.0, 0)
        out = self.outcomes.pop(0)
        if isinstance(out, BaseException):
            raise out
        return out


def route(**kw):
    return provider_router.route_llm(system="s", user="u", schema={}, consent_granted=True, purpose="test", **kw)


class WithGate(unittest.TestCase):
    gate_kwargs = {}

    def setUp(self):
        self.gate = RecordingGate(**self.gate_kwargs)
        previous = ai_budget._gate
        ai_budget.set_gate_for_tests(self.gate)
        self.addCleanup(ai_budget.set_gate_for_tests, previous)
        self.addCleanup(provider_router.set_chain_for_tests, None)


class RouterSettlement(WithGate):
    def test_reported_usage_is_metered_at_configured_rates(self):
        provider_router.set_chain_for_tests([FakeProvider([{"ok": 1}], usage=(1000, 500))])
        route()
        _id, status, cost, tokens_in, tokens_out = self.gate.settled[0]
        self.assertEqual((status, tokens_in, tokens_out), ("metered", 1000, 500))
        self.assertEqual(cost, ai_budget.token_cost("groq", "m", 1000, 500))

    def test_missing_usage_charges_the_whole_reservation_as_estimated(self):
        provider_router.set_chain_for_tests([FakeProvider([{"ok": 1}])])
        route()
        self.assertEqual(self.gate.settled[0][1:3], ("estimated", self.gate.reserved[0][4]))

    def test_timeout_is_charged_because_the_provider_may_have_billed(self):
        provider_router.set_chain_for_tests([FakeProvider([TimeoutError("slow")])])
        with self.assertRaises(provider_router.NeedsReviewError):
            route()
        self.assertEqual(self.gate.settled[0][1], "estimated")

    def test_unreadable_answer_with_usage_stays_metered(self):
        provider_router.set_chain_for_tests([FakeProvider([ValueError("bad json")], usage=(10, 10))])
        with self.assertRaises(provider_router.NeedsReviewError):
            route()
        self.assertEqual(self.gate.settled[0][1], "metered")

    def test_provider_refusals_cost_nothing(self):
        for refusal in (provider_router.RateLimited(1), provider_router.AuthFailed("401"), provider_router.ModelUnavailable("x"), ValueError("HTTP 400: bad")):
            self.gate.settled.clear()
            provider_router.set_chain_for_tests([FakeProvider([refusal])])
            with self.assertRaises(provider_router.NeedsReviewError):
                route()
            self.assertEqual(self.gate.settled[0][1:3], ("released", Decimal(0)), refusal)

    def test_every_fallback_attempt_is_reserved_separately(self):
        first = FakeProvider([TimeoutError("slow")])
        second = FakeProvider([{"ok": 1}])
        second.name = "gemini"
        provider_router.set_chain_for_tests([first, second])
        route()
        self.assertEqual([r[1] for r in self.gate.reserved], ["groq", "gemini"])
        self.assertEqual(len(self.gate.settled), 2)

    def test_the_job_is_charged_to_its_user(self):
        provider_router.set_chain_for_tests([FakeProvider([{"ok": 1}])])
        with ai_budget.job_scope("user-1", "job-1"):
            route()
        self.assertEqual(self.gate.reserved[0][0], ai_budget.Scope("user-1", "job-1"))

    def test_settle_failure_doesnt_lose_the_providers_answer(self):
        provider_router.set_chain_for_tests([FakeProvider([{"ok": 1}])])
        with mock.patch.object(self.gate, "settle", side_effect=psycopg2.OperationalError("down")):
            self.assertEqual(route().data, {"ok": 1})


class Truncation(WithGate):
    def _usable_after_truncation(self, http_reply, pool_cls, model_mode="json"):
        pool = KeyPool("x", "NOPE")
        pool.keys = [Key("x_1", "k")]
        provider = pool_cls(pool, [Model("m", model_mode)])
        provider_router.set_chain_for_tests([provider])
        with mock.patch.object(provider_router, "_post", return_value=http_reply), self.assertLogs("worker.llm", "WARNING") as logs:
            with self.assertRaises(provider_router.NeedsReviewError):
                route()
        self.assertTrue(any("llm_output_truncated" in line for line in logs.output))
        return provider

    def test_gemini_max_tokens_is_never_parsed_even_if_valid_json(self):
        reply = {"usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 8192},
                 "candidates": [{"finishReason": "MAX_TOKENS", "content": {"parts": [{"text": '{"partial": true}'}]}}]}
        provider = self._usable_after_truncation(reply, provider_router.GeminiPool)
        self.assertEqual(provider.breaker.calls, type(provider.breaker.calls)())  # not held against the provider
        self.assertEqual(self.gate.settled[0][1], "metered")  # it was billed

    def test_openai_style_length_finish_is_never_parsed(self):
        reply = {"usage": {"prompt_tokens": 10, "completion_tokens": 4096},
                 "choices": [{"finish_reason": "length", "message": {"content": '{"partial": true}'}}]}
        self._usable_after_truncation(reply, provider_router.GroqPool)
        self.assertEqual(self.gate.settled[0][1], "metered")

    def test_gemini_requests_carry_the_cap_the_reservation_assumes(self):
        pool = KeyPool("gemini", "NOPE")
        provider = provider_router.GeminiPool(pool, [])
        reply = {"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": "{}"}]}}]}
        with mock.patch.object(provider_router, "_post", return_value=reply) as post:
            provider.call(Key("g", "k"), Model("m", "json"), "s", "u", {}, [], 5)
        self.assertEqual(post.call_args.args[2]["generationConfig"]["maxOutputTokens"], provider_router.GEMINI_MAX_OUTPUT_TOKENS)

    def test_a_truncated_whole_document_falls_back_to_a_smaller_model_answer(self):
        first = FakeProvider([provider_router.OutputTruncated("cap")])
        second = FakeProvider([{"ok": 1}])
        second.name = "gemini"
        provider_router.set_chain_for_tests([first, second])
        self.assertEqual(route().data, {"ok": 1})


class AiAssistedStatus(WithGate):
    def test_records_real_success_and_failure_across_threads(self):
        provider_router.set_chain_for_tests([FakeProvider([{"impact_score": 1, "rationale": "r"}] * 3)])
        with ai_budget.job_scope("u", "j"):
            repo_scorer.score_repos([{"id": i, "repo_name": str(i)} for i in range(3)], allow_external_ai=True)
            use = ai_budget.current_use()
            self.assertEqual((use.succeeded, use.failed), (3, 0))

    def test_budget_refusal_counts_as_not_ai_assisted(self):
        self.gate.deny = ai_budget.BudgetDenied("reached")
        provider_router.set_chain_for_tests([FakeProvider([{"ok": 1}])])
        with ai_budget.job_scope("u", "j"):
            with self.assertRaises(provider_router.NeedsReviewError):
                route()
            use = ai_budget.current_use()
            self.assertEqual((use.succeeded, use.failed), (0, 1))

    def test_each_job_starts_clean(self):
        with ai_budget.job_scope("u", "1"):
            ai_budget.current_use().note(True)
        with ai_budget.job_scope("u", "2"):
            self.assertEqual(ai_budget.current_use().succeeded, 0)


class Refusals(unittest.TestCase):
    def _with(self, error):
        gate = RecordingGate(deny=error)
        previous = ai_budget._gate
        ai_budget.set_gate_for_tests(gate)
        self.addCleanup(ai_budget.set_gate_for_tests, previous)
        self.addCleanup(provider_router.set_chain_for_tests, None)

    def _assert_provider_never_called(self):
        provider = FakeProvider([{"ok": 1}])
        provider_router.set_chain_for_tests([provider])
        with self.assertRaises(provider_router.NeedsReviewError):
            route()
        self.assertEqual(provider.calls, 0)

    def test_exhausted_budget_stops_the_call(self):
        self._with(ai_budget.BudgetDenied("reached"))
        self._assert_provider_never_called()

    def test_database_outage_fails_closed(self):
        self._with(ai_budget.BudgetUnavailable("down"))
        self._assert_provider_never_called()

    def test_an_unexpected_gate_error_also_fails_closed(self):
        self._with(RuntimeError("bug"))
        self._assert_provider_never_called()

    def test_no_database_configured_fails_closed(self):
        previous = ai_budget._gate
        self.addCleanup(ai_budget.set_gate_for_tests, previous)
        self.addCleanup(provider_router.set_chain_for_tests, None)
        ai_budget.set_gate_for_tests(ai_budget.PostgresGate())
        with mock.patch.dict(os.environ, {"WORKER_DATABASE_URL": "", "DATABASE_URL": ""}):
            self._assert_provider_never_called()

    def test_unreachable_database_fails_closed(self):
        previous = ai_budget._gate
        self.addCleanup(ai_budget.set_gate_for_tests, previous)
        self.addCleanup(provider_router.set_chain_for_tests, None)
        ai_budget.set_gate_for_tests(ai_budget.PostgresGate("postgresql://x:y@127.0.0.1:1/none"))
        self._assert_provider_never_called()

    def test_budget_refusal_of_a_scrape_is_not_retried_and_makes_no_request(self):
        self._with(ai_budget.BudgetDenied("reached"))
        for module, call, env in ((portfolio, lambda: portfolio.scrape("https://x.dev"), "firecrawl"), (linkedin, lambda: linkedin.fetch("https://x"), "apify")):
            pool = KeyPool(env, "NOPE")
            pool.keys = [Key(f"{env}_1", "x")]
            with mock.patch.object(module, "_keys", return_value=pool), mock.patch.object(module, "http_json") as http:
                with self.assertRaises(ai_budget.BudgetError):
                    call()
            http.assert_not_called()

    def test_embeddings_fall_back_to_the_local_vector_with_no_request(self):
        self._with(ai_budget.BudgetDenied("reached"))
        with mock.patch.dict(os.environ, {"GEMINI_KEYS": "k"}), mock.patch.object(collaboration.urllib.request, "urlopen") as urlopen:
            vector = collaboration.compute_profile_vector("student", ["python"], [], [], allow_external=True)
        urlopen.assert_not_called()
        self.assertEqual(len(vector), collaboration.EMBEDDING_DIM)


class OtherPaidCalls(WithGate):
    def _pool(self, name):
        pool = KeyPool(name, "NOPE")
        pool.keys = [Key(f"{name}_1", "x")]
        return pool

    def test_firecrawl_success_failure_and_refusal(self):
        with mock.patch.object(portfolio, "_keys", return_value=self._pool("firecrawl")), mock.patch.object(portfolio, "http_json", return_value={"data": {"markdown": "hi"}}):
            self.assertEqual(portfolio.scrape("https://x.dev"), "hi")
        self.assertEqual(self.gate.settled[-1][1], "estimated")
        with mock.patch.object(portfolio, "_keys", return_value=self._pool("firecrawl")), mock.patch.object(portfolio, "http_json", side_effect=HttpError(404, "no")):
            with self.assertRaises(HttpError):
                portfolio.scrape("https://x.dev")
        self.assertEqual(self.gate.settled[-1][1], "released")
        with mock.patch.object(portfolio, "_keys", return_value=self._pool("firecrawl")), mock.patch.object(portfolio, "http_json", side_effect=TimeoutError("slow")):
            with self.assertRaises(TimeoutError):
                portfolio.scrape("https://x.dev")
        self.assertEqual(self.gate.settled[-1][1], "estimated")

    def test_apify_is_reserved(self):
        with mock.patch.object(linkedin, "_keys", return_value=self._pool("apify")), mock.patch.object(linkedin, "http_json", return_value=[{"firstName": "A"}]):
            linkedin.fetch("https://x")
        self.assertEqual(self.gate.reserved[0][1], "apify")

    def test_repo_scoring_threads_keep_the_jobs_user(self):
        provider_router.set_chain_for_tests([FakeProvider([{"impact_score": 1, "rationale": "r"}] * 6)])
        repos = [{"id": i, "repo_name": f"r{i}"} for i in range(6)]
        with ai_budget.job_scope("user-1", "job-1"):
            repo_scorer.score_repos(repos, allow_external_ai=True)
        self.assertEqual(len(self.gate.reserved), 6)
        self.assertTrue(all(r[0].user_id == "user-1" for r in self.gate.reserved))

    def test_embedding_http_refusal_costs_nothing_and_usage_is_metered(self):
        error = urllib.error.HTTPError("u", 429, "slow down", {}, None)
        with mock.patch.dict(os.environ, {"GEMINI_KEYS": "k", "OPENROUTER_KEYS": ""}), mock.patch.object(collaboration.urllib.request, "urlopen", side_effect=error):
            self.assertIsNone(collaboration.fetch_dense_api_embedding("text"))
        self.assertEqual(self.gate.settled[0][1], "released")


class Pricing(unittest.TestCase):
    def test_free_models_cost_nothing(self):
        self.assertEqual(ai_budget.token_cost("openrouter", "a/b:free", 10**6, 10**6), Decimal(0))

    def test_override_and_invalid_override(self):
        with mock.patch.dict(os.environ, {"AI_MODEL_PRICES": '{"m": {"in": 1, "out": 2}}'}):
            self.assertEqual(ai_budget.token_cost("groq", "m", 10**6, 10**6), Decimal(3))
        with mock.patch.dict(os.environ, {"AI_MODEL_PRICES": "not json"}):
            self.assertGreater(ai_budget.token_cost("unknown", "m", 10**6, 0), 0)

    def test_reservation_is_an_upper_bound_at_one_token_per_character(self):
        reserved = ai_budget.worst_case_cost("groq", "m", chars=4000, images=0, max_output=4096)
        self.assertEqual(reserved, ai_budget.token_cost("groq", "m", 4000, 4096))

    def test_a_call_that_can_post_twice_reserves_twice(self):
        once = ai_budget.worst_case_cost("groq", "m", 100, 0, 100)
        self.assertEqual(ai_budget.worst_case_cost("groq", "m", 100, 0, 100, posts=2), once * 2)


class TestPostgresGate(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dsn = os.environ.get("QUEUE_TEST_DATABASE_URL", "")
        if "127.0.0.1" not in cls.dsn and "localhost" not in cls.dsn:
            raise unittest.SkipTest("set QUEUE_TEST_DATABASE_URL to a local throwaway database")
        cls.conn = psycopg2.connect(cls.dsn)
        cls.conn.autocommit = True

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def setUp(self):
        self.gate = ai_budget.PostgresGate(self.dsn)
        self.cur = self.conn.cursor()
        self.cur.execute("DELETE FROM ai_usage_ledger; DELETE FROM ai_spend_counters")
        self.cur.execute("UPDATE ai_cost_budgets SET budget_usd = 100, user_daily_usd = 1, user_monthly_usd = 5")
        self.user = self._user()

    def _user(self):
        user = str(uuid.uuid4())
        self.cur.execute("INSERT INTO users (id, email) VALUES (%s, %s)", (user, f"{user}@x.test"))
        return user

    def _reserve(self, user, amount="0.10", timeout=25.0, gate=None):
        return (gate or self.gate).reserve(ai_budget.Scope(user, None), "groq", "m", "test", Decimal(amount), timeout)

    def _counter(self, scope, like="%"):
        self.cur.execute("SELECT coalesce(sum(metered_usd),0), coalesce(sum(estimated_usd),0), coalesce(sum(reserved_usd),0) FROM ai_spend_counters WHERE scope = %s AND period LIKE %s AND length(period) = 7", (scope, like))
        return tuple(self.cur.fetchone())

    def test_budget_exhaustion_per_user_and_others_unaffected(self):
        self._reserve(self.user, "0.90")
        self._reserve(self.user, "0.10")
        with self.assertRaisesRegex(ai_budget.BudgetDenied, "user-daily"):
            self._reserve(self.user, "0.01")
        self._reserve(self._user(), "0.50")

    def test_monthly_user_limit(self):
        self.cur.execute("UPDATE ai_cost_budgets SET user_daily_usd = 100, user_monthly_usd = 1")
        self._reserve(self.user, "1.00")
        with self.assertRaisesRegex(ai_budget.BudgetDenied, "user-monthly"):
            self._reserve(self.user, "0.01")

    def test_global_limit_stops_many_accounts(self):
        self.cur.execute("UPDATE ai_cost_budgets SET budget_usd = 1")
        for _ in range(4):
            self._reserve(self._user(), "0.25")
        with self.assertRaisesRegex(ai_budget.BudgetDenied, "global"):
            self._reserve(self._user(), "0.25")

    def test_open_calls_are_capped_per_user_and_globally(self):
        for _ in range(ai_budget.MAX_OPEN_PER_USER):
            self._reserve(self.user, "0.01")
        with self.assertRaisesRegex(ai_budget.BudgetDenied, "in flight"):
            self._reserve(self.user, "0.01")
        with mock.patch.dict(os.environ, {"AI_MAX_OPEN_GLOBAL": str(ai_budget.MAX_OPEN_PER_USER)}):
            with self.assertRaisesRegex(ai_budget.BudgetDenied, "in flight"):
                self._reserve(self._user(), "0.01")

    def test_settling_frees_an_open_slot(self):
        held = [self._reserve(self.user, "0.01") for _ in range(ai_budget.MAX_OPEN_PER_USER)]
        self.gate.settle(held[0], "released", Decimal(0), None, None)
        self._reserve(self.user, "0.01")

    def test_an_overrun_is_recorded_alerts_and_stops_the_next_call(self):
        reservation = self._reserve(self.user, "0.10")
        with self.assertLogs("worker.ai_budget", "ERROR") as logs:
            self.gate.settle(reservation, "metered", Decimal("0.995"), 1, 1)
        self.assertIn("ai_reservation_exceeded", logs.output[0])
        self.assertEqual(self._counter(self.user)[0], Decimal("0.995000"))
        with self.assertRaises(ai_budget.BudgetDenied):
            self._reserve(self.user, "0.01")

    def test_call_data_is_recorded_for_the_provider_page(self):
        reservation = self._reserve(self.user, "0.10")
        reservation.error_kind = "truncated"
        self.gate.settle(reservation, "metered", Decimal("0.01"), 1, 1)
        self.cur.execute("SELECT error_kind, latency_ms FROM ai_usage_ledger WHERE id = %s", (reservation.id,))
        kind, latency = self.cur.fetchone()
        self.assertEqual(kind, "truncated")
        self.assertGreaterEqual(latency, 0)

    def test_worker_recomputes_are_limited_and_postponed_not_dropped(self):
        from db import enqueue_compute_intelligence, enqueue_compute_matches

        self.cur.execute("INSERT INTO onboarding_state (user_id, current_step) VALUES (%s, 'done')", (self.user,))

        def queue(fn):
            fn(self.cur, self.user, "test")
            self.cur.execute("SELECT id, run_at > now() + interval '1 minute' FROM jobs WHERE user_id = %s AND status = 'queued'", (self.user,))
            return self.cur.fetchall()

        for _ in range(30):
            rows = queue(enqueue_compute_intelligence)
            self.assertEqual([r[1] for r in rows], [False])
            self.cur.execute("UPDATE jobs SET status = 'done' WHERE user_id = %s", (self.user,))
        rows = queue(enqueue_compute_intelligence)
        self.assertEqual([r[1] for r in rows], [True])  # the 31st waits
        self.assertEqual(len(queue(enqueue_compute_intelligence)), 1)  # and later ones collapse into it
        self.assertEqual(len(queue(enqueue_compute_matches)), 2)

    def test_web_and_worker_share_one_recompute_limit(self):
        self.cur.execute("INSERT INTO onboarding_state (user_id, current_step) VALUES (%s, 'done')", (self.user,))
        self.cur.execute("SELECT hit_sliding_limit(%s, 30, 3600) FROM generate_series(1, 30)", (f"paid:recompute:{self.user}",))
        from db import enqueue_compute_intelligence

        enqueue_compute_intelligence(self.cur, self.user, "test")
        self.cur.execute("SELECT run_at > now() + interval '1 minute' FROM jobs WHERE user_id = %s", (self.user,))
        self.assertTrue(self.cur.fetchone()[0])

    def test_concurrent_reservations_cannot_overspend(self):
        patcher = mock.patch.dict(os.environ, {"AI_MAX_OPEN_PER_USER": "1000", "AI_MAX_OPEN_GLOBAL": "1000"})
        patcher.start()
        self.addCleanup(patcher.stop)

        def attempt(_):
            try:
                self._reserve(self.user, "0.10", gate=ai_budget.PostgresGate(self.dsn))
                return True
            except ai_budget.BudgetDenied:
                return False

        with ThreadPoolExecutor(max_workers=16) as pool:
            results = list(pool.map(attempt, range(30)))
        self.assertEqual(sum(results), 10)
        self.assertEqual(self._counter(self.user)[2], Decimal("1.000000"))

    def test_concurrent_accounts_share_the_global_limit_exactly(self):
        self.cur.execute("UPDATE ai_cost_budgets SET budget_usd = 1")
        users = [self._user() for _ in range(20)]

        def attempt(user):
            try:
                self._reserve(user, "0.10", gate=ai_budget.PostgresGate(self.dsn))
                return True
            except ai_budget.BudgetDenied:
                return False

        with ThreadPoolExecutor(max_workers=16) as pool:
            self.assertEqual(sum(pool.map(attempt, users)), 10)

    def test_settling_replaces_the_reservation_with_the_real_cost(self):
        reservation = self._reserve(self.user, "0.50")
        self.gate.settle(reservation, "metered", Decimal("0.02"), 100, 50)
        self.assertEqual(self._counter(self.user), (Decimal("0.020000"), Decimal(0), Decimal(0)))
        self.assertEqual(self._counter("global"), (Decimal("0.020000"), Decimal(0), Decimal(0)))
        self._reserve(self.user, "0.90")  # The unspent reservation came back.

    def test_settling_twice_counts_once(self):
        reservation = self._reserve(self.user, "0.50")
        self.gate.settle(reservation, "metered", Decimal("0.02"), 1, 1)
        self.gate.settle(reservation, "estimated", Decimal("0.50"), None, None)
        self.assertEqual(self._counter(self.user)[:2], (Decimal("0.020000"), Decimal(0)))

    def test_released_costs_nothing(self):
        reservation = self._reserve(self.user, "0.50")
        self.gate.settle(reservation, "released", Decimal(0), None, None)
        self.assertEqual(self._counter(self.user), (Decimal(0), Decimal(0), Decimal(0)))

    def test_worker_restart_expired_reservation_is_charged_not_freed(self):
        reservation = self._reserve(self.user, "0.40")  # The worker dies here, before settling.
        self.cur.execute("UPDATE ai_usage_ledger SET expires_at = now() - interval '1 second' WHERE id = %s", (reservation.id,))
        self._reserve(self.user, "0.10", gate=ai_budget.PostgresGate(self.dsn))  # A new process sweeps it.
        self.assertEqual(self._counter(self.user), (Decimal(0), Decimal("0.400000"), Decimal("0.100000")))
        self.cur.execute("SELECT status FROM ai_usage_ledger WHERE id = %s", (reservation.id,))
        self.assertEqual(self.cur.fetchone()[0], "estimated")

    def test_late_settle_after_expiry_cannot_double_count(self):
        reservation = self._reserve(self.user, "0.40")
        self.cur.execute("UPDATE ai_usage_ledger SET expires_at = now() - interval '1 second' WHERE id = %s", (reservation.id,))
        self._reserve(self.user, "0.10")
        self.gate.settle(reservation, "metered", Decimal("0.01"), 1, 1)  # The old worker wakes up.
        self.assertEqual(self._counter(self.user)[:2], (Decimal(0), Decimal("0.400000")))

    def test_an_unexpired_reservation_is_left_alone(self):
        self._reserve(self.user, "0.40", timeout=600)
        self._reserve(self.user, "0.10")
        self.assertEqual(self._counter(self.user), (Decimal(0), Decimal(0), Decimal("0.500000")))

    def test_no_policy_row_fails_closed(self):
        self.cur.execute("SELECT id, budget_usd FROM ai_cost_budgets")
        rows = self.cur.fetchall()
        self.cur.execute("DELETE FROM ai_cost_budgets")
        try:
            with self.assertRaises(ai_budget.BudgetUnavailable):
                self._reserve(self.user)
        finally:
            for row in rows:
                self.cur.execute("INSERT INTO ai_cost_budgets (id, budget_usd) VALUES (%s, %s)", row)

    def test_system_spend_only_counts_globally(self):
        reservation = self.gate.reserve(ai_budget.Scope(None, None), "gemini", "e", "embedding", Decimal("0.01"), 8)
        self.gate.settle(reservation, "metered", Decimal("0.01"), 1, 0)
        self.assertEqual(self._counter("global")[0], Decimal("0.010000"))

    def test_a_dropped_connection_reconnects(self):
        self._reserve(self.user, "0.01")
        self.gate._local.conn.close()
        self._reserve(self.user, "0.01")

    def test_deleting_a_user_keeps_global_spend_but_drops_their_identity(self):
        reservation = self._reserve(self.user, "0.10")
        self.gate.settle(reservation, "metered", Decimal("0.05"), 1, 1)
        self.cur.execute("DELETE FROM users WHERE id = %s", (self.user,))
        self.assertEqual(self._counter(self.user)[0], Decimal(0))
        self.assertEqual(self._counter("global")[0], Decimal("0.050000"))
        self.cur.execute("SELECT user_id, scoped_to_user FROM ai_usage_ledger WHERE id = %s", (reservation.id,))
        self.assertIsNone(self.cur.fetchone()[0])


if __name__ == "__main__":
    unittest.main()
