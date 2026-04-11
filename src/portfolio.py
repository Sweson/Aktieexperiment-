"""Portfölj-modul: läs/skriv state, köp, sälj, värdering."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

PORTFOLIO_PATH = os.path.join("data", "portfolio.json")
TRADES_PATH = os.path.join("data", "trades.jsonl")


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_portfolio(path: str = PORTFOLIO_PATH) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_portfolio(p: dict[str, Any], path: str = PORTFOLIO_PATH) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(p, f, indent=2, ensure_ascii=False)
        f.write("\n")


def append_trade(trade: dict[str, Any], path: str = TRADES_PATH) -> None:
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(trade, ensure_ascii=False) + "\n")


@dataclass
class Fee:
    pct: float = 0.0025
    minimum: float = 1.0

    def calc(self, value: float) -> float:
        return max(self.minimum, value * self.pct)


def portfolio_value(
    portfolio: dict[str, Any],
    prices: dict[str, float],
) -> dict[str, Any]:
    """Räknar ut totalt portföljvärde givet aktuella priser."""
    cash = float(portfolio["cash"])
    holdings_value = 0.0
    positions = []
    for ticker, h in (portfolio.get("holdings") or {}).items():
        shares = int(h["shares"])
        avg_cost = float(h["avg_cost"])
        last_price = float(prices.get(ticker, avg_cost))
        market_value = shares * last_price
        unrealized = (last_price - avg_cost) * shares
        unrealized_pct = (last_price / avg_cost - 1) * 100 if avg_cost else 0.0
        holdings_value += market_value
        positions.append(
            {
                "ticker": ticker,
                "shares": shares,
                "avg_cost": round(avg_cost, 4),
                "last_price": round(last_price, 4),
                "market_value": round(market_value, 2),
                "unrealized_pnl": round(unrealized, 2),
                "unrealized_pct": round(unrealized_pct, 2),
            }
        )
    total = cash + holdings_value
    starting = float(portfolio.get("starting_capital", 10000.0))
    return {
        "cash": round(cash, 2),
        "holdings_value": round(holdings_value, 2),
        "total_value": round(total, 2),
        "starting_capital": round(starting, 2),
        "total_return_sek": round(total - starting, 2),
        "total_return_pct": round((total / starting - 1) * 100, 2),
        "positions": positions,
    }


def execute_buy(
    portfolio: dict[str, Any],
    ticker: str,
    shares: int,
    price: float,
    fee: Fee,
    reasoning: str,
    turn: int,
) -> dict[str, Any]:
    if shares <= 0:
        raise ValueError("shares måste vara > 0")
    gross = shares * price
    fees = fee.calc(gross)
    total_cost = gross + fees
    if total_cost > portfolio["cash"] + 1e-6:
        raise ValueError(
            f"Otillräckligt med cash: behöver {total_cost:.2f} SEK, har {portfolio['cash']:.2f}"
        )
    portfolio["cash"] = round(portfolio["cash"] - total_cost, 4)
    portfolio["total_fees_paid"] = round(portfolio.get("total_fees_paid", 0.0) + fees, 4)

    holdings = portfolio.setdefault("holdings", {})
    h = holdings.get(ticker)
    if h is None:
        holdings[ticker] = {"shares": shares, "avg_cost": round(price, 6)}
    else:
        old_shares = int(h["shares"])
        old_cost = float(h["avg_cost"])
        new_shares = old_shares + shares
        new_avg = (old_shares * old_cost + shares * price) / new_shares
        h["shares"] = new_shares
        h["avg_cost"] = round(new_avg, 6)

    trade = {
        "turn": turn,
        "timestamp": _now_iso(),
        "action": "BUY",
        "ticker": ticker,
        "shares": shares,
        "price": round(price, 4),
        "gross_sek": round(gross, 2),
        "fee_sek": round(fees, 2),
        "total_sek": round(total_cost, 2),
        "reasoning": reasoning,
    }
    append_trade(trade)
    return trade


def execute_sell(
    portfolio: dict[str, Any],
    ticker: str,
    shares: int,
    price: float,
    fee: Fee,
    reasoning: str,
    turn: int,
) -> dict[str, Any]:
    if shares <= 0:
        raise ValueError("shares måste vara > 0")
    holdings = portfolio.setdefault("holdings", {})
    h = holdings.get(ticker)
    if not h or int(h["shares"]) < shares:
        have = int(h["shares"]) if h else 0
        raise ValueError(f"Har bara {have} st av {ticker}, kan inte sälja {shares}")

    gross = shares * price
    fees = fee.calc(gross)
    proceeds = gross - fees
    avg_cost = float(h["avg_cost"])
    realized = (price - avg_cost) * shares - fees

    portfolio["cash"] = round(portfolio["cash"] + proceeds, 4)
    portfolio["total_fees_paid"] = round(portfolio.get("total_fees_paid", 0.0) + fees, 4)
    portfolio["realized_pnl"] = round(portfolio.get("realized_pnl", 0.0) + realized, 4)

    h["shares"] = int(h["shares"]) - shares
    if h["shares"] == 0:
        del holdings[ticker]

    trade = {
        "turn": turn,
        "timestamp": _now_iso(),
        "action": "SELL",
        "ticker": ticker,
        "shares": shares,
        "price": round(price, 4),
        "gross_sek": round(gross, 2),
        "fee_sek": round(fees, 2),
        "total_sek": round(proceeds, 2),
        "realized_pnl_sek": round(realized, 2),
        "reasoning": reasoning,
    }
    append_trade(trade)
    return trade


def check_position_limit(
    portfolio: dict[str, Any],
    ticker: str,
    additional_value: float,
    prices: dict[str, float],
    max_pct: float,
) -> tuple[bool, str]:
    """Kollar om ett köp skulle bryta max_position_pct-regeln."""
    valuation = portfolio_value(portfolio, prices)
    total = valuation["total_value"]
    if total <= 0:
        return False, "Portföljvärde är 0"
    current = 0.0
    for pos in valuation["positions"]:
        if pos["ticker"] == ticker:
            current = pos["market_value"]
            break
    new_position = current + additional_value
    new_pct = new_position / total
    if new_pct > max_pct + 1e-6:
        return False, (
            f"Position i {ticker} skulle bli {new_pct*100:.1f}% "
            f"(max {max_pct*100:.0f}%)"
        )
    return True, "OK"
