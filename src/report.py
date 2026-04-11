"""Rapportering av experimentets prestanda."""

from __future__ import annotations

import json
import os
from typing import Any

from src import market, portfolio as P
from src.turn import (
    fetch_prices_for_portfolio_and_watchlist,
    load_config,
)

DECISIONS_PATH = os.path.join("data", "decisions.jsonl")
TRADES_PATH = os.path.join("data", "trades.jsonl")


def _load_jsonl(path: str) -> list[dict[str, Any]]:
    if not os.path.exists(path):
        return []
    out: list[dict[str, Any]] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return out


def print_report() -> int:
    cfg = load_config()
    pf = P.load_portfolio()
    quotes = fetch_prices_for_portfolio_and_watchlist(cfg, pf)
    prices = {t: q.price for t, q in quotes.items()}
    val = P.portfolio_value(pf, prices)
    trades = _load_jsonl(TRADES_PATH)
    decisions = _load_jsonl(DECISIONS_PATH)

    print("=" * 70)
    print("AI Aktieexperiment - Rapport")
    print("=" * 70)
    print(f"Turer körda:        {pf.get('turn_count', 0)}")
    print(f"Antal trades:       {len(trades)}")
    print(f"Antal beslut:       {len(decisions)}")
    print(f"Startkapital:       {val['starting_capital']:.2f} SEK")
    print(f"Cash:               {val['cash']:.2f} SEK")
    print(f"Innehavsvärde:      {val['holdings_value']:.2f} SEK")
    print(f"Totalt värde:       {val['total_value']:.2f} SEK")
    print(
        f"Total avkastning:   {val['total_return_sek']:+.2f} SEK "
        f"({val['total_return_pct']:+.2f}%)"
    )
    print(f"Realiserad PnL:     {pf.get('realized_pnl', 0.0):+.2f} SEK")
    print(f"Courtage betalat:   {pf.get('total_fees_paid', 0.0):.2f} SEK")

    if val["positions"]:
        print("\nAktuella innehav:")
        for pos in val["positions"]:
            print(
                f"  {pos['ticker']:<12} {pos['shares']:>5} st "
                f"snitt {pos['avg_cost']:>8.2f}  nu {pos['last_price']:>8.2f}  "
                f"P/L {pos['unrealized_pnl']:>+8.2f} ({pos['unrealized_pct']:+.1f}%)"
            )

    if trades:
        print("\nSenaste 10 trades:")
        for t in trades[-10:]:
            tag = t["action"]
            print(
                f"  [{t['timestamp']}] {tag:<4} {t['shares']:>4} {t['ticker']:<12} "
                f"@ {t['price']:>8.2f}  ({t.get('reasoning','')[:50]})"
            )

    print("=" * 70)
    return 0


if __name__ == "__main__":
    raise SystemExit(print_report())
