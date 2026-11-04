"""Compute vector embeddings for all learning_resources rows in NeonDB."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

# Add worker to sys.path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / "worker"))

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / ".env")

from intelligence.collaboration import compute_profile_vector, fetch_dense_api_embedding

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL not set!")
    sys.exit(1)

_host = (urlparse(DATABASE_URL).hostname or "").lower()
if _host not in ("localhost", "127.0.0.1", "::1", "host.docker.internal"):
    # Same rule as scripts/lib/db-target.mjs.
    if os.environ.get("CI") or os.environ.get("NODE_ENV") == "test" or os.environ.get("AIT_APPROVED_WRITE_HOST", "").strip().lower() != _host:
        print(f"Refusing to write to remote database host {_host}. If you are the owner and mean to, set AIT_APPROVED_WRITE_HOST to exactly that host for this one command.")
        sys.exit(1)

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("SELECT id, title, provider, description FROM learning_resources WHERE embedding IS NULL")
rows = cur.fetchall()
print(f"Found {len(rows)} learning resources to embed.")

for r in rows:
    text = f"{r['title']} by {r['provider']}. {r['description'] or ''}"
    vec = compute_profile_vector(
        role="learning_course",
        skills=[r["title"], r["provider"]],
        projects=[],
        goals=[r["description"] or ""],
        dim=768,
        allow_external=True,  # public course catalogue text, not user data
    )
    vec_str = f"[{','.join(f'{x:.6f}' for x in vec)}]"
    cur.execute("UPDATE learning_resources SET embedding = %s::vector WHERE id = %s", (vec_str, r["id"]))

conn.commit()
print("Successfully computed and saved 768-dim vector embeddings for all learning resources!")
conn.close()
