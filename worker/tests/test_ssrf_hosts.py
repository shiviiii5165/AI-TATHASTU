"""36-attack matrix #21 (DNS spoofing / rebinding, app-layer) and SSRF: hostile user-supplied identifiers must
never steer the worker's outbound requests to another host (cloud metadata, localhost, an attacker server).
Executed against the real connector fetchers; only the socket layer (urlopen) is replaced by a recorder.
"""

from __future__ import annotations

import io
import json
import unittest
import urllib.parse
from unittest import mock

HOSTILE = [
    "x@169.254.169.254",
    "@127.0.0.1:5432",
    "..%2F..%2F@evil.example",
    "evil.example#",
    "a/../../@evil.example/",
    "user\\@evil.example",
    "http://evil.example/",
    "%40evil.example",
]
ALLOWED = {"leetcode.com", "www.hackerrank.com", "pub.orcid.org", "api.stackexchange.com", "www.kaggle.com", "api.github.com"}


class _Res(io.BytesIO):
    headers = {"Content-Encoding": None}

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class OutboundHostsStayFixed(unittest.TestCase):
    def setUp(self):
        self.hosts: list[str] = []

        def record(req, timeout=None):
            url = req.full_url if hasattr(req, "full_url") else req
            self.hosts.append(urllib.parse.urlsplit(url).hostname or "")
            return _Res(json.dumps({}).encode())

        self.patch = mock.patch("urllib.request.urlopen", side_effect=record)
        self.patch.start()

    def tearDown(self):
        self.patch.stop()

    def _drive(self, fn, *args):
        try:
            fn(*args)
        except Exception:  # empty fake responses make parsers bail; only the attempted host matters
            pass

    def test_hostile_identifiers_never_change_the_host(self):
        from connectors import coding_profiles, kaggle, orcid, stack_exchange

        for bad in HOSTILE:
            with self.subTest(identifier=bad):
                self.hosts.clear()
                self._drive(coding_profiles.fetch_leetcode, bad)
                self._drive(coding_profiles.fetch_hackerrank, bad)
                self._drive(orcid.fetch, bad)
                self._drive(stack_exchange.fetch, bad, 1)
                self._drive(kaggle.fetch, bad, "k")
                self.assertTrue(self.hosts, "fetchers attempted no request (test would be vacuous)")
                for h in self.hosts:
                    self.assertIn(h, ALLOWED, f"identifier {bad!r} steered a request to {h!r}")


if __name__ == "__main__":
    unittest.main()
