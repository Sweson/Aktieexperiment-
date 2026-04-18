"""Matcha uppdrag mot profilen. Keyword-baserad scoring + filter."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from dateutil import parser as dateparser

from .storage import Opportunity


@dataclass
class ScoreResult:
    score: float
    matched: dict[str, float]
    rejected_reason: str | None = None


def _text_blob(opp: Opportunity) -> str:
    parts = [opp.title, opp.org, opp.summary, opp.location]
    return " \n ".join(p for p in parts if p).lower()


def _match_keywords(text: str, items: list[dict[str, Any]]) -> dict[str, float]:
    hits: dict[str, float] = {}
    for entry in items:
        term = str(entry.get("term", "")).lower().strip()
        if not term:
            continue
        if term in text:
            # Varje keyword räknas en gång (inte per förekomst) för att undvika
            # att lång text övervinner mer specifika matches.
            weight = float(entry.get("weight", 1.0))
            hits[term] = hits.get(term, 0.0) + weight
    return hits


def _age_penalty(posted_at: str, max_age_days: int) -> float:
    if not posted_at or max_age_days <= 0:
        return 0.0
    try:
        dt = dateparser.parse(posted_at)
    except (ValueError, TypeError):
        return 0.0
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    age = datetime.now(timezone.utc) - dt
    if age > timedelta(days=max_age_days):
        return -999.0  # filtrera bort
    # Mjuk penalty: -0.01 per dag
    return -0.01 * age.days


def _location_ok(opp: Opportunity, allow: list[str]) -> bool:
    if not allow:
        return True
    if not opp.location:
        # Tom lokation = släpp igenom (kan vara remote/svenskt bolag utan angiven ort).
        return True
    loc = opp.location.lower()
    return any(a.lower() in loc for a in allow)


def score_opportunity(opp: Opportunity, profile: dict) -> ScoreResult:
    text = _text_blob(opp)
    kw = profile.get("keywords", {})
    core = _match_keywords(text, kw.get("core", []))
    boost = _match_keywords(text, kw.get("boost", []))
    neg = _match_keywords(text, kw.get("negative", []))

    filters = profile.get("filters", {})
    if not _location_ok(opp, filters.get("locations_allow", []) or []):
        return ScoreResult(score=0.0, matched={}, rejected_reason="location")

    for industry in filters.get("blocked_industries", []) or []:
        if industry.lower() in text:
            return ScoreResult(score=0.0, matched={}, rejected_reason=f"blocked industry: {industry}")

    age_pen = _age_penalty(opp.posted_at, int(filters.get("max_age_days", 0)))
    if age_pen <= -100:
        return ScoreResult(score=0.0, matched={}, rejected_reason="too old")

    # Viktad summa. Negative weights är redan negativa så vi summerar rakt av.
    base = sum(core.values()) + sum(boost.values()) + sum(neg.values())
    score = max(0.0, base + age_pen)

    matched = {**core, **boost, **neg}
    return ScoreResult(score=round(score, 2), matched=matched)
