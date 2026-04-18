"""SQLite-lagring för uppdrag och outreach-state."""
from __future__ import annotations

import hashlib
import json
import sqlite3
from contextlib import contextmanager
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Iterable, Iterator, Optional

DB_PATH = Path("data/opportunities.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS opportunities (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    org TEXT,
    summary TEXT,
    url TEXT,
    location TEXT,
    posted_at TEXT,
    source TEXT,
    raw_json TEXT,
    score REAL DEFAULT 0,
    score_breakdown TEXT,
    status TEXT DEFAULT 'new',
    discovered_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS outreach (
    opportunity_id TEXT PRIMARY KEY,
    channel TEXT,
    recipient TEXT,
    subject TEXT,
    body TEXT,
    status TEXT DEFAULT 'draft',
    created_at TEXT NOT NULL,
    approved_at TEXT,
    sent_at TEXT,
    FOREIGN KEY (opportunity_id) REFERENCES opportunities(id)
);
CREATE INDEX IF NOT EXISTS idx_opp_score ON opportunities(score DESC);
CREATE INDEX IF NOT EXISTS idx_opp_status ON opportunities(status);
"""


@dataclass
class Opportunity:
    title: str
    org: str = ""
    summary: str = ""
    url: str = ""
    location: str = ""
    posted_at: str = ""
    source: str = ""
    raw: dict = field(default_factory=dict)
    score: float = 0.0
    score_breakdown: dict = field(default_factory=dict)
    status: str = "new"
    id: str = ""

    def __post_init__(self) -> None:
        if not self.id:
            self.id = self._make_id()

    def _make_id(self) -> str:
        key = f"{self.source}|{self.url or self.title}|{self.org}".lower()
        return hashlib.sha1(key.encode("utf-8")).hexdigest()[:12]


def _ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


@contextmanager
def connect(db_path: Path = DB_PATH) -> Iterator[sqlite3.Connection]:
    _ensure_parent(db_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        conn.executescript(SCHEMA)
        yield conn
        conn.commit()
    finally:
        conn.close()


def upsert_opportunities(conn: sqlite3.Connection, opps: Iterable[Opportunity]) -> tuple[int, int]:
    """Infoga nya uppdrag. Returnerar (nya, uppdaterade)."""
    new = updated = 0
    now = datetime.utcnow().isoformat(timespec="seconds")
    for opp in opps:
        row = conn.execute("SELECT id FROM opportunities WHERE id = ?", (opp.id,)).fetchone()
        if row is None:
            conn.execute(
                """INSERT INTO opportunities
                   (id,title,org,summary,url,location,posted_at,source,raw_json,
                    score,score_breakdown,status,discovered_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    opp.id, opp.title, opp.org, opp.summary, opp.url, opp.location,
                    opp.posted_at, opp.source, json.dumps(opp.raw, ensure_ascii=False),
                    opp.score, json.dumps(opp.score_breakdown, ensure_ascii=False),
                    opp.status, now,
                ),
            )
            new += 1
        else:
            conn.execute(
                """UPDATE opportunities
                   SET title=?, org=?, summary=?, url=?, location=?, posted_at=?,
                       score=?, score_breakdown=?
                   WHERE id=?""",
                (
                    opp.title, opp.org, opp.summary, opp.url, opp.location, opp.posted_at,
                    opp.score, json.dumps(opp.score_breakdown, ensure_ascii=False), opp.id,
                ),
            )
            updated += 1
    return new, updated


def list_opportunities(
    conn: sqlite3.Connection,
    min_score: float = 0.0,
    status: Optional[str] = None,
    limit: int = 50,
) -> list[sqlite3.Row]:
    sql = "SELECT * FROM opportunities WHERE score >= ?"
    args: list = [min_score]
    if status:
        sql += " AND status = ?"
        args.append(status)
    sql += " ORDER BY score DESC, discovered_at DESC LIMIT ?"
    args.append(limit)
    return conn.execute(sql, args).fetchall()


def get_opportunity(conn: sqlite3.Connection, opp_id: str) -> Optional[sqlite3.Row]:
    return conn.execute("SELECT * FROM opportunities WHERE id = ?", (opp_id,)).fetchone()


def set_status(conn: sqlite3.Connection, opp_id: str, status: str) -> None:
    conn.execute("UPDATE opportunities SET status=? WHERE id=?", (status, opp_id))


def save_draft(conn: sqlite3.Connection, opp_id: str, channel: str, recipient: str,
               subject: str, body: str) -> None:
    now = datetime.utcnow().isoformat(timespec="seconds")
    conn.execute(
        """INSERT INTO outreach (opportunity_id,channel,recipient,subject,body,status,created_at)
           VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(opportunity_id) DO UPDATE SET
             channel=excluded.channel, recipient=excluded.recipient,
             subject=excluded.subject, body=excluded.body,
             status='draft', created_at=excluded.created_at""",
        (opp_id, channel, recipient, subject, body, "draft", now),
    )


def get_draft(conn: sqlite3.Connection, opp_id: str) -> Optional[sqlite3.Row]:
    return conn.execute("SELECT * FROM outreach WHERE opportunity_id = ?", (opp_id,)).fetchone()


def mark_approved(conn: sqlite3.Connection, opp_id: str) -> None:
    now = datetime.utcnow().isoformat(timespec="seconds")
    conn.execute(
        "UPDATE outreach SET status='approved', approved_at=? WHERE opportunity_id=?",
        (now, opp_id),
    )


def mark_sent(conn: sqlite3.Connection, opp_id: str) -> None:
    now = datetime.utcnow().isoformat(timespec="seconds")
    conn.execute(
        "UPDATE outreach SET status='sent', sent_at=? WHERE opportunity_id=?",
        (now, opp_id),
    )
    conn.execute("UPDATE opportunities SET status='contacted' WHERE id=?", (opp_id,))
