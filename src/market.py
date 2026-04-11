"""Hämtar marknadsdata från Yahoo Finance.

Använder Yahoo Finance chart-API direkt via `requests` så att vi
slipper beroenden som yfinance/pandas. API:t är publikt och kräver
ingen nyckel. För varje ticker hämtar vi senaste pris, dagsförändring
och en kort historik som AI:n kan använda för beslut.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, asdict
from typing import Any

import requests

YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept": "application/json,text/plain,*/*",
}


@dataclass
class Quote:
    ticker: str
    price: float
    currency: str
    previous_close: float | None
    day_change_pct: float | None
    market_state: str | None
    timestamp: int | None
    history_close: list[float]  # senaste ~30 stängningar
    history_timestamps: list[int]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def fetch_quote(
    ticker: str,
    range_: str = "1mo",
    interval: str = "1d",
    timeout: float = 10.0,
) -> Quote:
    """Hämtar en quote + kort prishistorik för en ticker."""
    url = YAHOO_CHART_URL.format(symbol=ticker)
    params = {"range": range_, "interval": interval, "includePrePost": "false"}
    resp = requests.get(url, params=params, headers=DEFAULT_HEADERS, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()

    result = (data.get("chart") or {}).get("result") or []
    if not result:
        raise ValueError(f"Inget resultat från Yahoo för {ticker}")
    r0 = result[0]
    meta = r0.get("meta") or {}

    price = meta.get("regularMarketPrice")
    if price is None:
        raise ValueError(f"Saknar regularMarketPrice för {ticker}")

    prev_close = meta.get("chartPreviousClose") or meta.get("previousClose")
    day_change_pct = None
    if prev_close:
        day_change_pct = (price - prev_close) / prev_close * 100.0

    timestamps = r0.get("timestamp") or []
    indicators = r0.get("indicators") or {}
    quote_block = (indicators.get("quote") or [{}])[0]
    closes = [c for c in (quote_block.get("close") or []) if c is not None]

    return Quote(
        ticker=ticker,
        price=float(price),
        currency=meta.get("currency", "SEK"),
        previous_close=float(prev_close) if prev_close else None,
        day_change_pct=day_change_pct,
        market_state=meta.get("marketState"),
        timestamp=meta.get("regularMarketTime"),
        history_close=[float(c) for c in closes[-30:]],
        history_timestamps=[int(t) for t in timestamps[-30:]],
    )


def fetch_quotes(tickers: list[str], delay: float = 0.15) -> dict[str, Quote]:
    """Hämtar quotes för en lista av tickers. Hoppar över misslyckade."""
    out: dict[str, Quote] = {}
    for t in tickers:
        try:
            out[t] = fetch_quote(t)
        except Exception as exc:  # noqa: BLE001
            print(f"[market] varning: kunde inte hämta {t}: {exc}")
        time.sleep(delay)  # var snäll mot Yahoo
    return out


def summarize_quote(q: Quote) -> dict[str, Any]:
    """Komprimerad form lämplig att skicka in i en AI-prompt."""
    closes = q.history_close
    summary: dict[str, Any] = {
        "ticker": q.ticker,
        "price": round(q.price, 4),
        "currency": q.currency,
        "day_change_pct": round(q.day_change_pct, 2) if q.day_change_pct is not None else None,
        "market_state": q.market_state,
    }
    if len(closes) >= 2:
        summary["change_5d_pct"] = round((closes[-1] / closes[-min(5, len(closes))] - 1) * 100, 2)
        summary["change_30d_pct"] = round((closes[-1] / closes[0] - 1) * 100, 2)
        hi = max(closes)
        lo = min(closes)
        summary["range_30d"] = {"low": round(lo, 4), "high": round(hi, 4)}
    return summary
