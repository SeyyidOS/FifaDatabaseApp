# elo_settings_service.py
from typing import Optional


class EloSettingsService:
    """
    Owns the elo_settings table (singleton row id=1).
    Keeps Database decoupled from app-specific settings.
    """

    def __init__(self, db):
        self.db = db
        self._ensure_table()
        self._ensure_row()

    def _ensure_table(self):
        self.db.execute(
            """
            CREATE TABLE IF NOT EXISTS elo_settings (
                id SMALLINT PRIMARY KEY DEFAULT 1,
                k_factor INT NOT NULL DEFAULT 24,
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
            """,
            commit=True,
        )

    def _ensure_row(self):
        self.db.execute(
            """
            INSERT INTO elo_settings (id, k_factor)
            VALUES (1, 24)
            ON CONFLICT (id) DO NOTHING;
            """,
            commit=True,
        )

    def get_k_factor(self) -> int:
        row = self.db.execute(
            "SELECT k_factor FROM elo_settings WHERE id = 1;",
            fetch_one=True,
        )
        return int(row["k_factor"]) if row and row.get("k_factor") is not None else 24

    def set_k_factor(self, k: int) -> None:
        self.db.execute(
            """
            UPDATE elo_settings
            SET k_factor = %s, updated_at = NOW()
            WHERE id = 1;
            """,
            (k,),
            commit=True,
        )
