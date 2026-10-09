"""Postgres access: a thread-safe connection pool with small query helpers."""

import logging
import os
import time
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool

log = logging.getLogger("fifa.db")

# Errors that mean the connection itself is unusable (database restarted, network blip, ...).
CONNECTION_ERRORS = (psycopg2.OperationalError, psycopg2.InterfaceError)


def connection_settings() -> dict[str, Any]:
    """DATABASE_URL wins if set; otherwise the DB_* variables."""
    url = os.getenv("DATABASE_URL")
    if url:
        return {"dsn": url}
    return {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", "5432")),
        "dbname": os.getenv("DB_NAME"),
        "user": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASS"),
    }


class Database:
    def __init__(self, minconn: int = 1, maxconn: int = 10, **settings: Any):
        self._pool = ThreadedConnectionPool(
            minconn, maxconn, cursor_factory=RealDictCursor, connect_timeout=5, **settings
        )

    @classmethod
    def connect(cls, attempts: int = 30, delay: float = 1.0) -> "Database":
        """The database may still be starting next to us; keep trying for a while."""
        for attempt in range(1, attempts + 1):
            try:
                return cls(**connection_settings())
            except CONNECTION_ERRORS as exc:
                if attempt == attempts:
                    raise
                log.warning("database not reachable yet (%s), retrying", str(exc).strip())
                time.sleep(delay)
        raise RuntimeError("unreachable")

    def close(self) -> None:
        self._pool.closeall()

    @contextmanager
    def _connection(self, autocommit: bool):
        conn = self._pool.getconn()
        broken = False
        try:
            conn.autocommit = autocommit
            yield conn
        except CONNECTION_ERRORS:
            broken = True
            raise
        finally:
            # never hand a dead connection back to the pool
            self._pool.putconn(conn, close=broken or bool(conn.closed))

    @contextmanager
    def cursor(self) -> Iterator[RealDictCursor]:
        """A cursor in autocommit mode: every statement is its own transaction."""
        with self._connection(autocommit=True) as conn, conn.cursor() as cur:
            yield cur

    @contextmanager
    def transaction(self) -> Iterator[RealDictCursor]:
        """A cursor whose statements commit together, or not at all if the block raises."""
        with self._connection(autocommit=False) as conn:
            try:
                with conn.cursor() as cur:
                    yield cur
                conn.commit()
            except BaseException:
                if not conn.closed:
                    conn.rollback()
                raise

    def fetch_all(self, sql: str, params: Any = None) -> list[dict]:
        return self._read(sql, params, one=False)

    def fetch_one(self, sql: str, params: Any = None) -> dict | None:
        return self._read(sql, params, one=True)

    def execute(self, sql: str, params: Any = None) -> int:
        """Run a write and return the number of affected rows (never retried)."""
        with self.cursor() as cur:
            cur.execute(sql, params)
            return cur.rowcount

    def write_one(self, sql: str, params: Any = None) -> dict | None:
        """Run a write with RETURNING and return its row, if any (never retried)."""
        with self.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchone()

    def _read(self, sql: str, params: Any, one: bool):
        # Reads are safe to retry once: a pooled connection may have died since it was last used.
        for attempt in (1, 2):
            try:
                with self.cursor() as cur:
                    cur.execute(sql, params)
                    return cur.fetchone() if one else cur.fetchall()
            except CONNECTION_ERRORS:
                if attempt == 2:
                    raise
                log.warning("stale database connection, retrying once")
