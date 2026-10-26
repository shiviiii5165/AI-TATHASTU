"""Worker as a Render *Web Service* (free tier has no Background Workers).

Main thread: a tiny HTTP server on $PORT (Render health checks + wake-up
pings from the web app). Background thread: the unchanged queue loop from
worker.py. Standard library only.

  GET /health  → 200 {"status": "healthy"} while the queue thread is alive,
                 503 if it has died (so Render restarts the instance).

Free instances sleep after ~15 min without inbound HTTP; the web app pings
WORKER_WAKE_URL whenever it queues a job (src/lib/worker-ping.ts). Jobs
queued while asleep simply wait in Postgres until the instance wakes.
"""

from __future__ import annotations

import json
import logging
import os
import signal
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, List

from worker import HANDLERS, WORKER_ID, Worker, configure_logging, database_url

log = logging.getLogger("worker.server")


def make_handler(queue_threads: List[threading.Thread]):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 (http.server naming)
            if self.path.split("?")[0] not in ("/health", "/"):
                self._send(404, {"error": "not found"})
            elif any(t.is_alive() for t in queue_threads):
                self._send(200, {"status": "healthy"})
            else:
                self._send(503, {"status": "unhealthy", "reason": "all queue threads stopped"})

        do_HEAD = do_GET  # noqa: N815

        def _send(self, code: int, body: dict) -> None:
            payload = json.dumps(body).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(payload)

        def log_message(self, *_: Any) -> None:
            pass  # health checks every few seconds would drown the job logs

    return Handler


def main() -> None:
    configure_logging()
    concurrency = max(1, int(os.environ.get("WORKER_CONCURRENCY", "2")))
    workers = [Worker(database_url()) for _ in range(concurrency)]
    queue_threads = [
        threading.Thread(target=w.run_forever, name=f"queue-{i+1}", daemon=True)
        for i, w in enumerate(workers)
    ]
    for t in queue_threads:
        t.start()

    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), make_handler(queue_threads))

    def shutdown(*_: Any) -> None:
        # Stop claiming, let the current job finish (bounded by Render's grace
        # period; a hard kill is covered by job lock expiry), then stop HTTP.
        for w in workers:
            w.stop()
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    log.info("worker %s: http on 0.0.0.0:%d, running %d queue worker(s) for %s", WORKER_ID, port, concurrency, ", ".join(HANDLERS))
    server.serve_forever()
    for t in queue_threads:
        t.join(timeout=25)
    log.info("server stopped")


if __name__ == "__main__":
    main()
