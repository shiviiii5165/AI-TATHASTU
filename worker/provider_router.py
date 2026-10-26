"""The single entry point for every LLM call the worker makes.

Direct use of provider HTTP APIs outside this module is not allowed: this is
where consent is enforced, keys are pooled and rotated, failures trip circuit
breakers, and every call is logged by key *label* (never the key itself).

Chain (each provider skipped when it has no keys):
  text:   GroqPool → GeminiPool → OpenRouterPool
  images: GeminiPool → OpenRouterPool (vision models only; Groq has none here)

Keys: GROQ_KEYS, GEMINI_KEYS, OPENROUTER_KEYS (comma-separated).
Models: GROQ_MODELS, GEMINI_MODELS, OPENROUTER_MODELS, OPENROUTER_VISION_MODELS
as "model[:mode]" lists; mode = strict (JSON-schema structured output) or
json (JSON mode, schema in the prompt). The caller re-validates every result.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Callable, Deque, Dict, List, Optional, Sequence, Tuple

from jobs import NeedsReview

log = logging.getLogger("worker.llm")


class ConsentRequired(Exception):
    pass


class NeedsReviewError(NeedsReview):
    """Every provider failed or was unavailable."""


class RateLimited(Exception):
    def __init__(self, retry_after: float) -> None:
        super().__init__(f"rate limited, retry after {retry_after}s")
        self.retry_after = retry_after


class AuthFailed(Exception):
    pass


class ModelUnavailable(Exception):
    """404: the model was retired or isn't offered to this account. Not a provider failure."""


# Per-process call log (provider, model, tokens, latency); the benchmark reads
# and resets it. Bounded so a long-running worker doesn't grow it forever.
USAGE: Deque[Dict[str, Any]] = deque(maxlen=1000)


def _record(provider: str, model: str, tokens_in: Any, tokens_out: Any, started: float, images: int) -> None:
    USAGE.append({"provider": provider, "model": model, "tokens_in": tokens_in or 0, "tokens_out": tokens_out or 0,
                  "ms": int((time.monotonic() - started) * 1000), "images": images})


@dataclass(frozen=True)
class LLMResult:
    data: Dict[str, Any]
    provider: str  # "groq" | "gemini" | "openrouter"
    model: str


# ─── Key pool ───────────────────────────────────────────────────────────────


@dataclass
class Key:
    label: str
    secret: str
    cooldown_until: float = 0.0
    disabled: bool = False


class KeyPool:
    """Round-robin over keys that aren't cooling down (429) or disabled (401/403)."""

    def __init__(self, provider: str, env_var: str) -> None:
        secrets = [k.strip() for k in os.environ.get(env_var, "").split(",") if k.strip()]
        self.keys = [Key(label=f"{provider}_{i + 1}", secret=s) for i, s in enumerate(secrets)]
        self._next = 0
        self._lock = threading.Lock()

    def acquire(self) -> Optional[Key]:
        with self._lock:
            now = time.monotonic()
            for _ in range(len(self.keys)):
                key = self.keys[self._next % len(self.keys)]
                self._next += 1
                if not key.disabled and key.cooldown_until <= now:
                    return key
            return None

    def report(self, key: Key, status: int, retry_after: float = 30.0) -> None:
        if status == 429:
            key.cooldown_until = time.monotonic() + retry_after
        elif status in (401, 403):
            key.disabled = True
            log.error("key %s rejected (%d); disabled until restart", key.label, status)


# ─── Circuit breaker ────────────────────────────────────────────────────────


@dataclass
class Breaker:
    """Pauses a provider temporarily (30s) if >=50% of its calls in the last 5 min failed."""

    window_s: float = 300
    pause_s: float = 30
    threshold: float = 0.5
    min_calls: int = 4
    calls: Deque[Tuple[float, bool]] = field(default_factory=deque)
    open_until: float = 0.0

    def allow(self) -> bool:
        return time.monotonic() >= self.open_until

    def record(self, ok: bool) -> None:
        now = time.monotonic()
        self.calls.append((now, ok))
        while self.calls and self.calls[0][0] < now - self.window_s:
            self.calls.popleft()
        failures = sum(1 for _, good in self.calls if not good)
        if len(self.calls) >= self.min_calls and failures / len(self.calls) >= self.threshold:
            self.open_until = now + self.pause_s
            log.warning("circuit open for %.0fs after %d/%d failed calls", self.pause_s, failures, len(self.calls))
            self.calls.clear()


# ─── Providers ──────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Model:
    name: str
    mode: str  # "strict" | "json"
    vision: bool = False


MODES = ("strict", "json", "json_object")


def parse_models(spec: str, vision: bool = False) -> List[Model]:
    """"a:strict,b" → [Model(a, strict), Model(b, json)]. Model ids may contain ':' (e.g. ':free')."""
    out = []
    for item in (s.strip() for s in spec.split(",")):
        if not item:
            continue
        name, _, mode = item.rpartition(":")
        if mode not in MODES:
            name, mode = item, "json"
        out.append(Model(name=name, mode="json" if mode == "json_object" else mode, vision=vision))
    return out


def _sanitize_strict_schema(s: Any) -> Any:
    """Recursively ensures additionalProperties=False on all objects and all properties are required for strict JSON schema."""
    if isinstance(s, dict):
        new_dict = {k: _sanitize_strict_schema(v) for k, v in s.items()}
        if new_dict.get("type") == "object" or "properties" in new_dict:
            new_dict["type"] = "object"
            new_dict["additionalProperties"] = False
            if "properties" in new_dict and isinstance(new_dict["properties"], dict):
                current_req = set(new_dict.get("required") or [])
                new_dict["required"] = list(current_req.union(new_dict["properties"].keys()))
        return new_dict
    elif isinstance(s, list):
        return [_sanitize_strict_schema(item) for item in s]
    return s


# Groq (and others) sit behind Cloudflare, which rejects urllib's default
# "Python-urllib" agent with 403 / error 1010 before auth is even checked.
USER_AGENT = "ai-tathastu-worker/1.0 (+https://aitathastu.com)"


def _post(url: str, headers: Dict[str, str], body: Dict[str, Any], timeout: float) -> Dict[str, Any]:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "User-Agent": USER_AGENT, **headers},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return json.loads(res.read())
    except urllib.error.HTTPError as exc:
        if exc.code == 429:
            raise RateLimited(float(exc.headers.get("retry-after") or 30)) from exc
        if exc.code == 503:
            # Temporary high demand (common on Gemini standard tier spikes)
            raise RateLimited(float(exc.headers.get("retry-after") or 15)) from exc
        if exc.code in (401, 403):
            raise AuthFailed(str(exc.code)) from exc
        # Keep the provider's reason (e.g. Groq "json_validate_failed") in the log.
        detail = exc.read()[:300].decode("utf-8", "replace")
        if exc.code == 404:
            raise ModelUnavailable(detail) from exc
        raise ValueError(f"HTTP {exc.code}: {detail}") from exc


def _parse_json(text: str) -> Dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):  # some models fence JSON despite JSON mode
        text = text.strip("`").split("\n", 1)[-1].rsplit("```", 1)[0]
    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError("model returned non-object JSON")
    return data


class Provider:
    name = "base"

    def __init__(self, pool: KeyPool, models: List[Model]) -> None:
        self.pool = pool
        self.models = models
        self.breaker = Breaker()
        self.dead_models: set = set()  # 404'd this process; skipped until restart

    def call(
        self, key: Key, model: Model, system: str, user: str, schema: Dict[str, Any], images: Sequence[str], timeout: float
    ) -> Dict[str, Any]:
        raise NotImplementedError


class OpenAICompatiblePool(Provider):
    """Groq and OpenRouter both speak the OpenAI chat-completions protocol."""

    url = ""
    extra_headers: Dict[str, str] = {}

    def call(self, key, model, system, user, schema, images, timeout):
        content: Any = user
        if images:
            content = [{"type": "text", "text": user}] + [
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img}"}} for img in images
            ]
        messages = [{"role": "system", "content": system}, {"role": "user", "content": content}]
        body: Dict[str, Any] = {
            "model": model.name,
            "temperature": 0,
            "messages": messages,
            "max_tokens": 4096,
        }
        if model.mode == "strict":
            strict_schema = _sanitize_strict_schema(schema)
            body["response_format"] = {"type": "json_schema", "json_schema": {"name": "extraction", "strict": True, "schema": strict_schema}}
        else:
            body["response_format"] = {"type": "json_object"}
            messages[0]["content"] += "\n\nRespond with JSON matching this JSON Schema:\n" + json.dumps(schema)
        started = time.monotonic()
        try:
            payload = _post(self.url, {"Authorization": f"Bearer {key.secret}", **self.extra_headers}, body, timeout)
        except ValueError as exc:
            err_str = str(exc)
            if model.mode == "strict" and any(e in err_str.lower() for e in ("json_validate_failed", "invalid json schema", "response_format", "additionalproperties")):
                log.warning("%s/%s strict structured output failed (%s); retrying in json_object mode", self.name, model.name, err_str[:120])
                fallback_body = dict(body)
                fallback_body["response_format"] = {"type": "json_object"}
                fallback_body["messages"] = [
                    {"role": "system", "content": system + "\n\nRespond with strictly valid JSON matching this schema:\n" + json.dumps(schema)},
                    {"role": "user", "content": content},
                ]
                payload = _post(self.url, {"Authorization": f"Bearer {key.secret}", **self.extra_headers}, fallback_body, timeout)
            else:
                raise
        usage = payload.get("usage") or {}
        _record(self.name, model.name, usage.get("prompt_tokens"), usage.get("completion_tokens"), started, len(images))
        log.info("provider_call provider=%s key=%s model=%s images=%d tokens_in=%s tokens_out=%s",
                 self.name, key.label, model.name, len(images), usage.get("prompt_tokens"), usage.get("completion_tokens"))
        return _parse_json(payload["choices"][0]["message"]["content"])


class GroqPool(OpenAICompatiblePool):
    name = "groq"
    url = "https://api.groq.com/openai/v1/chat/completions"


class OpenRouterPool(OpenAICompatiblePool):
    name = "openrouter"
    url = "https://openrouter.ai/api/v1/chat/completions"
    extra_headers = {"HTTP-Referer": "https://aitathastu.com", "X-Title": "AI Tathastu"}


class GeminiPool(Provider):
    name = "gemini"
    base = "https://generativelanguage.googleapis.com/v1beta/models"

    def call(self, key, model, system, user, schema, images, timeout):
        parts: List[Dict[str, Any]] = [{"text": user}]
        parts += [{"inline_data": {"mime_type": "image/png", "data": img}} for img in images]
        generation: Dict[str, Any] = {"temperature": 0, "responseMimeType": "application/json"}
        system_text = system
        if model.mode == "strict":
            generation["responseJsonSchema"] = _sanitize_strict_schema(schema)
        else:
            system_text += "\n\nRespond with JSON matching this JSON Schema:\n" + json.dumps(schema)
        body = {
            "systemInstruction": {"parts": [{"text": system_text}]},
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": generation,
        }
        started = time.monotonic()
        payload = _post(f"{self.base}/{model.name}:generateContent", {"x-goog-api-key": key.secret}, body, timeout)
        meta = payload.get("usageMetadata") or {}
        _record("gemini", model.name, meta.get("promptTokenCount"), meta.get("candidatesTokenCount"), started, len(images))
        candidate = (payload.get("candidates") or [{}])[0]
        text = "".join(p.get("text", "") for p in (candidate.get("content") or {}).get("parts", []) if not p.get("thought"))
        if not text:
            raise ValueError(f"empty response (finishReason={candidate.get('finishReason')})")
        usage = payload.get("usageMetadata") or {}
        log.info("provider_call provider=gemini key=%s model=%s images=%d tokens_in=%s tokens_out=%s",
                 key.label, model.name, len(images), usage.get("promptTokenCount"), usage.get("candidatesTokenCount"))
        return _parse_json(text)


_chain: Optional[List[Provider]] = None


def chain() -> List[Provider]:
    global _chain
    if _chain is None:
        env = os.environ.get
        _chain = [
            GroqPool(KeyPool("groq", "GROQ_KEYS"),
                     parse_models(env("GROQ_MODELS", "llama-3.3-70b-versatile:strict,llama-3.1-8b-instant:strict,openai/gpt-oss-120b:strict,openai/gpt-oss-20b:strict"))),
            GeminiPool(KeyPool("gemini", "GEMINI_KEYS"),
                       parse_models(env("GEMINI_MODELS", "gemini-2.5-flash:strict,gemini-2.0-flash:strict,gemini-1.5-flash:strict,gemini-3.5-flash:strict,gemini-3.5-flash-lite:strict"), vision=True)),
            OpenRouterPool(KeyPool("openrouter", "OPENROUTER_KEYS"),
                           parse_models(env("OPENROUTER_MODELS", "nvidia/nemotron-3.5-super-vl:free:strict,xingchen-agi/xing4.0-29b-a4b:free:strict"))
                           + parse_models(env("OPENROUTER_VISION_MODELS", "nvidia/nemotron-3.5-super-vl:free:strict"), vision=True)),
        ]
    return _chain


def set_chain_for_tests(providers: Optional[List[Provider]]) -> None:
    global _chain
    _chain = providers


# ─── Entry point ────────────────────────────────────────────────────────────


def route_llm(
    *,
    system: str,
    user: str,
    schema: Dict[str, Any],
    consent_granted: bool,
    purpose: str,
    images: Sequence[str] = (),
    accept: Callable[[Dict[str, Any]], bool] = lambda _r: True,
    timeout: float = 25.0,
) -> LLMResult:
    """
    Returns the first result `accept` approves, trying providers in chain
    order, each provider's models in order, rotating keys. `images` are
    base64 PNGs; with images only vision models are tried. Raises
    ConsentRequired without consent, NeedsReviewError when all fail.
    """
    if not consent_granted:
        raise ConsentRequired(purpose)

    providers = chain()
    if images:  # Gemini is the primary vision provider
        providers = sorted(providers, key=lambda p: p.name != "gemini")

    for provider in providers:
        models = [m for m in provider.models if (m.vision or not images) and m.name not in provider.dead_models]
        if not models or not provider.pool.keys or not provider.breaker.allow():
            continue
        for model in models:
            # Key problems (429, 401/403) rotate to the next key for the same
            # model; anything else (timeout, bad JSON) moves to the next model.
            for _attempt in range(len(provider.pool.keys)):
                key = provider.pool.acquire()
                if key is None:
                    break  # every key cooling down or disabled
                try:
                    result = provider.call(key, model, system, user, schema, list(images), timeout)
                except RateLimited as exc:
                    provider.pool.report(key, 429, exc.retry_after)
                    provider.breaker.record(False)
                    log.warning("%s/%s rate limited on %s", provider.name, model.name, key.label)
                    continue
                except ModelUnavailable as exc:
                    provider.dead_models.add(model.name)
                    log.error("%s model %s unavailable (404), skipping it until restart: %s", provider.name, model.name, str(exc)[:160])
                    break
                except AuthFailed as exc:
                    provider.pool.report(key, int(str(exc) or 401))
                    if not any(not k.disabled for k in provider.pool.keys):
                        provider.breaker.record(False)
                    continue
                except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError, ValueError, IndexError) as exc:
                    log.warning("provider %s model %s failed: %s", provider.name, model.name, exc)
                    provider.breaker.record(False)
                    break
                provider.breaker.record(True)
                if accept(result):
                    return LLMResult(result, provider.name, model.name)
                log.info("provider %s model %s output rejected by structural check", provider.name, model.name)
                break
    raise NeedsReviewError(f"all providers exhausted for {purpose}")
