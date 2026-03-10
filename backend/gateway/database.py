"""
Lightweight Supabase client using httpx + PostgREST API.
Avoids the heavy supabase-py SDK which requires C++ build tools.
"""

import logging
from typing import Any, Optional, List

import httpx

import config

logger = logging.getLogger(__name__)


class SupabaseTable:
    """Fluent query builder for a single Supabase table."""

    def __init__(self, base_url: str, api_key: str, table_name: str):
        self._base_url = f"{base_url}/rest/v1/{table_name}"
        self._headers = {
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        self._params: dict[str, str] = {}
        self._method: str = "GET"
        self._body: Any = None
        self._select_cols: str = "*"

    def select(self, columns: str = "*") -> "SupabaseTable":
        self._method = "GET"
        self._select_cols = columns
        self._params["select"] = columns
        return self

    def insert(self, data: Any) -> "SupabaseTable":
        self._method = "POST"
        self._body = data
        return self

    def eq(self, column: str, value: str) -> "SupabaseTable":
        self._params[column] = f"eq.{value}"
        return self

    def in_(self, column: str, values: List[str]) -> "SupabaseTable":
        joined = ",".join(values)
        self._params[column] = f"in.({joined})"
        return self

    def order(self, column: str, desc: bool = False) -> "SupabaseTable":
        direction = "desc" if desc else "asc"
        self._params["order"] = f"{column}.{direction}"
        return self

    def limit(self, count: int) -> "SupabaseTable":
        self._params["limit"] = str(count)
        return self

    def execute(self) -> "SupabaseResult":
        """Execute the query synchronously."""
        with httpx.Client(timeout=30.0) as client:
            if self._method == "GET":
                resp = client.get(self._base_url, headers=self._headers, params=self._params)
            elif self._method == "POST":
                resp = client.post(self._base_url, headers=self._headers, json=self._body, params=self._params)
            else:
                raise ValueError(f"Unsupported method: {self._method}")

            if resp.status_code >= 400:
                logger.error(f"Supabase error {resp.status_code}: {resp.text}")
                raise RuntimeError(f"Supabase API error: {resp.status_code} — {resp.text}")

            data = resp.json() if resp.text else []
            return SupabaseResult(data=data if isinstance(data, list) else [data])


class SupabaseResult:
    """Wrapper for Supabase query results."""

    def __init__(self, data: list):
        self.data = data


class SupabaseClient:
    """Lightweight Supabase client."""

    def __init__(self, url: str, key: str):
        self._url = url.rstrip("/")
        self._key = key

    def table(self, name: str) -> SupabaseTable:
        return SupabaseTable(self._url, self._key, name)


# ── Singleton ───────────────────────────────────────────────────

_client: Optional[SupabaseClient] = None


def get_db() -> SupabaseClient:
    """Return a singleton Supabase client."""
    global _client
    if _client is None:
        if not config.SUPABASE_URL or not config.SUPABASE_KEY:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_KEY must be set in environment variables."
            )
        _client = SupabaseClient(config.SUPABASE_URL, config.SUPABASE_KEY)
        logger.info("Supabase client initialized (lightweight httpx mode).")
    return _client
