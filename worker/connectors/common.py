"""Plumbing shared by every connector: HTTP, credentials, fact rows, finishing a sync."""

from __future__ import annotations

import gzip
import json
import logging
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import psycopg2.extras

from crypto_box import open_credential
from db import enqueue_compute_intelligence, fetch_one, has_consent, jsonb
from jobs import Job
from profile_urls import route_contact_url

log = logging.getLogger("worker.connectors")

USER_AGENT = "ai-tathastu-worker/1.0 (+https://aitathastu.com)"
STALE_AFTER = timedelta(days=7)


class HttpError(Exception):
    def __init__(self, status: int, body: str) -> None:
        super().__init__(f"HTTP {status}: {body[:200]}")
        self.status = status
        self.body = body


def http_json(method: str, url: str, headers: Optional[Dict[str, str]] = None, body: Any = None, timeout: float = 30) -> Any:
    """JSON over HTTP with a real User-Agent (Cloudflare blocks urllib's) and gzip support."""
    h = {"User-Agent": USER_AGENT, "Accept": "application/json", "Accept-Encoding": "gzip", **(headers or {})}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            raw = res.read()
            if res.headers.get("Content-Encoding") == "gzip":
                raw = gzip.decompress(raw)
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            raw = gzip.decompress(raw)
        except OSError:
            pass
        raise HttpError(exc.code, raw.decode("utf-8", "replace")) from exc


def load_connection(conn: Any, job: Job, source: str) -> Optional[Tuple[Dict[str, Any], Dict[str, Any]]]:
    """(connection row, decrypted credential), marking it 'syncing'; None if it was disconnected."""
    with conn, conn.cursor() as cur:
        row = fetch_one(
            cur,
            "SELECT id, token_enc FROM connections WHERE id = %s AND user_id = %s AND source_id = %s",
            (job.payload.get("connection_id"), job.user_id, source),
        )
        if not row:
            log.info("%s connection %s gone (disconnected); nothing to sync", source, job.payload.get("connection_id"))
            return None
        cur.execute("UPDATE connections SET status = 'syncing' WHERE id = %s", (row["id"],))
    credential = open_credential(row["token_enc"], job.user_id, source) if row["token_enc"] else {}
    return row, credential


def set_status(conn: Any, connection_id: str, status: str) -> None:
    with conn, conn.cursor() as cur:
        cur.execute("UPDATE connections SET status = %s WHERE id = %s", (status, connection_id))


class Facts:
    """Collects profile_facts rows for one source; replace() swaps them in atomically."""

    def __init__(self, user_id: str, origin: str, method: str) -> None:
        self.user_id, self.origin, self.method = user_id, origin, method
        self.rows: List[Tuple[Any, ...]] = []

    def add(
        self,
        group: str,
        field: str,
        value: Any,
        evidence: str,
        record_key: Optional[str] = None,
        extracted: Any = None,
        confidence: float = 1.0,
        method: Optional[str] = None,
        validation: str = "validated",
    ) -> None:
        if value is None or (isinstance(value, str) and not value.strip()):
            return
        if isinstance(value, str):
            value = value.strip()
        if group == "contact" and isinstance(value, str):
            field, value = route_contact_url(field, value)  # platform URLs never land in `website`
            if field is None:
                return
        if any(r[1] == group and r[2] == field and r[3] == record_key and r[5] == jsonb(value) for r in self.rows):
            return  # same fact twice in one sync (e.g. a blog URL that is also the portfolio)
        self.rows.append((
            self.user_id, group, field, record_key,
            jsonb(value if extracted is None else extracted), jsonb(value),
            (evidence or "")[:500], method or self.method, self.origin, confidence, validation, "unconfirmed",
        ))

    def groups(self) -> Dict[str, int]:
        out: Dict[str, int] = {}
        for r in self.rows:
            out[r[1]] = out.get(r[1], 0) + 1
        return out

    def replace(self, cur: Any) -> int:
        """This source's facts are rebuilt wholesale on every sync."""
        cur.execute("DELETE FROM profile_facts WHERE user_id = %s AND origin = %s", (self.user_id, self.origin))
        if self.rows:
            psycopg2.extras.execute_values(
                cur,
                """INSERT INTO profile_facts
                     (user_id, field_group, field_name, record_key, extracted_value, normalized_value,
                      source_evidence, extraction_method, origin, confidence, validation_status, confirmation)
                   VALUES %s""",
                self.rows,
            )
        return len(self.rows)


def still_connected(cur: Any, connection_id: str, user_id: str) -> bool:
    """Locks the connection row; False if the user disconnected while the sync ran
    (disconnect deletes this source's facts, so writing now would revive them)."""
    cur.execute("SELECT 1 FROM connections WHERE id = %s AND user_id = %s FOR UPDATE", (connection_id, user_id))
    return cur.fetchone() is not None


def finish_sync(conn: Any, job: Job, connection_id: str, source: str, facts: Facts, consent: Optional[str] = None) -> None:
    with conn, conn.cursor() as cur:
        if not still_connected(cur, connection_id, job.user_id):
            log.info("%s connection %s was disconnected mid-sync; results discarded", source, connection_id)
            return
        if consent and not has_consent(cur, job.user_id, consent):
            log.info("%s: %s consent revoked mid-sync; results discarded", source, consent)
            return
        n = facts.replace(cur)
        now = datetime.now(timezone.utc)
        cur.execute(
            "UPDATE connections SET status = 'connected', last_sync_at = %s, stale_after = %s WHERE id = %s",
            (now, now + STALE_AFTER, connection_id),
        )
        enqueue_compute_intelligence(cur, job.user_id, f"connector_sync:{source}")
    log.info("%s sync for %s: %d facts %s", source, job.user_id, n, facts.groups())
