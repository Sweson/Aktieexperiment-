"""Kör en handelstur.

Användning
----------
    # Hämta marknadsdata + skriv ut nuvarande state och watchlist
    python -m src.turn snapshot

    # Köp 5 st VOLV-B.ST till marknadspris med en motivering
    python -m src.turn buy VOLV-B.ST 5 --reason "Stark trend, RSI ok"

    # Sälj 3 st ERIC-B.ST
    python -m src.turn sell ERIC-B.ST 3 --reason "Tar hem vinst"

    # Stå still denna tur (loggas ändå)
    python -m src.turn hold --reason "Inget bra setup"

    # Visa rapport
    python -m src.turn report

Varje gång snapshot körs sparas en marknadsbild i data/snapshots.jsonl
och varje köp/sälj/hold loggas i data/trades.jsonl + data/decisions.jsonl.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any

import yaml

from src import market, portfolio as P

CONFIG_PATH = "config.yaml"
SNAPSHOTS_PATH = os.path.join("data", "snapshots.jsonl")
DECISIONS_PATH = os.path.join("data", "decisions.jsonl")


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_config(path: str = CONFIG_PATH) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_watchlist_tickers(cfg: dict[str, Any]) -> list[str]:
    return [item["ticker"] for item in cfg.get("watchlist", [])]


def get_fee(cfg: dict[str, Any]) -> P.Fee:
    rules = cfg.get("rules", {})
    return P.Fee(pct=float(rules.get("fee_pct", 0.0025)), minimum=float(rules.get("fee_min_sek", 1.0)))


def fetch_prices_for_portfolio_and_watchlist(
    cfg: dict[str, Any], pf: dict[str, Any]
) -> dict[str, market.Quote]:
    """Hämtar priser för watchlist + ev. innehav som inte finns i watchlisten."""
    tickers = set(get_watchlist_tickers(cfg))
    tickers.update((pf.get("holdings") or {}).keys())
    return market.fetch_quotes(sorted(tickers))


def _append_jsonl(path: str, obj: dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")


def write_snapshot(quotes: dict[str, market.Quote], pf: dict[str, Any]) -> dict[str, Any]:
    snap = {
        "timestamp": _now_iso(),
        "turn": int(pf.get("turn_count", 0)) + 1,
        "quotes": {t: market.summarize_quote(q) for t, q in quotes.items()},
    }
    _append_jsonl(SNAPSHOTS_PATH, snap)
    return snap


def write_decision(
    pf: dict[str, Any],
    action: str,
    details: dict[str, Any],
    reasoning: str,
    valuation_before: dict[str, Any],
    snapshot: dict[str, Any],
) -> None:
    decision = {
        "turn": int(pf.get("turn_count", 0)) + 1,
        "timestamp": _now_iso(),
        "action": action,
        "details": details,
        "reasoning": reasoning,
        "portfolio_before": {
            "cash": valuation_before["cash"],
            "holdings_value": valuation_before["holdings_value"],
            "total_value": valuation_before["total_value"],
            "total_return_pct": valuation_before["total_return_pct"],
            "positions": valuation_before["positions"],
        },
        "market_snapshot_ref": snapshot["timestamp"],
    }
    _append_jsonl(DECISIONS_PATH, decision)


def _bump_turn(pf: dict[str, Any]) -> None:
    pf["turn_count"] = int(pf.get("turn_count", 0)) + 1
    pf["last_turn_at"] = _now_iso()


def _print_snapshot(snap: dict[str, Any], valuation: dict[str, Any]) -> None:
    print("=" * 70)
    print(f"AI Aktieexperiment — tur #{snap['turn']}  {snap['timestamp']}")
    print("=" * 70)
    print(
        f"Cash: {valuation['cash']:>10.2f} SEK   "
        f"Innehav: {valuation['holdings_value']:>10.2f} SEK   "
        f"Totalt: {valuation['total_value']:>10.2f} SEK"
    )
    print(
        f"Avkastning: {valuation['total_return_sek']:+.2f} SEK "
        f"({valuation['total_return_pct']:+.2f}%)  "
        f"från startkapital {valuation['starting_capital']:.2f} SEK"
    )
    if valuation["positions"]:
        print("\nInnehav:")
        for pos in valuation["positions"]:
            print(
                f"  {pos['ticker']:<12} {pos['shares']:>5} st  "
                f"snittkurs {pos['avg_cost']:>8.2f}  nu {pos['last_price']:>8.2f}  "
                f"värde {pos['market_value']:>9.2f}  "
                f"P/L {pos['unrealized_pnl']:>+8.2f} ({pos['unrealized_pct']:+.1f}%)"
            )
    else:
        print("\nInga innehav.")

    print("\nWatchlist:")
    print(
        f"  {'TICKER':<12} {'PRIS':>10} {'DAG%':>8} {'5D%':>8} {'30D%':>8} {'STATUS':>10}"
    )
    for t, q in sorted(snap["quotes"].items()):
        d = q.get("day_change_pct")
        d5 = q.get("change_5d_pct")
        d30 = q.get("change_30d_pct")
        ms = q.get("market_state") or "-"
        print(
            f"  {t:<12} {q['price']:>10.2f} "
            f"{(f'{d:+.2f}' if d is not None else '-'):>8} "
            f"{(f'{d5:+.2f}' if d5 is not None else '-'):>8} "
            f"{(f'{d30:+.2f}' if d30 is not None else '-'):>8} "
            f"{ms:>10}"
        )
    print("=" * 70)


def cmd_snapshot(_args: argparse.Namespace) -> int:
    cfg = load_config()
    pf = P.load_portfolio()
    quotes = fetch_prices_for_portfolio_and_watchlist(cfg, pf)
    if not quotes:
        print("Kunde inte hämta marknadsdata. Försök igen.", file=sys.stderr)
        return 2
    snap = write_snapshot(quotes, pf)
    prices = {t: q.price for t, q in quotes.items()}
    valuation = P.portfolio_value(pf, prices)
    _print_snapshot(snap, valuation)
    return 0


def _execute_trade(
    args: argparse.Namespace, action: str
) -> int:
    cfg = load_config()
    pf = P.load_portfolio()
    fee = get_fee(cfg)
    rules = cfg.get("rules", {})

    quotes = fetch_prices_for_portfolio_and_watchlist(cfg, pf)
    if args.ticker not in quotes:
        # Se om vi kan hämta direkt
        try:
            quotes[args.ticker] = market.fetch_quote(args.ticker)
        except Exception as exc:  # noqa: BLE001
            print(f"Kunde inte hämta pris för {args.ticker}: {exc}", file=sys.stderr)
            return 2

    price = quotes[args.ticker].price
    prices = {t: q.price for t, q in quotes.items()}
    valuation_before = P.portfolio_value(pf, prices)
    snap = write_snapshot(quotes, pf)

    try:
        if action == "BUY":
            ok, msg = P.check_position_limit(
                pf, args.ticker, args.shares * price, prices,
                float(rules.get("max_position_pct", 0.30)),
            )
            if not ok:
                print(f"BLOCKAT: {msg}", file=sys.stderr)
                return 3
            trade = P.execute_buy(
                pf, args.ticker, int(args.shares), price, fee, args.reason or "",
                int(pf.get("turn_count", 0)) + 1,
            )
        else:
            trade = P.execute_sell(
                pf, args.ticker, int(args.shares), price, fee, args.reason or "",
                int(pf.get("turn_count", 0)) + 1,
            )
    except ValueError as exc:
        print(f"FEL: {exc}", file=sys.stderr)
        return 4

    write_decision(
        pf,
        action=action,
        details={"ticker": args.ticker, "shares": int(args.shares), "price": price},
        reasoning=args.reason or "",
        valuation_before=valuation_before,
        snapshot=snap,
    )
    _bump_turn(pf)
    P.save_portfolio(pf)
    print(f"Utförd: {trade}")

    valuation_after = P.portfolio_value(pf, prices)
    print(
        f"\nNytt totalt värde: {valuation_after['total_value']:.2f} SEK "
        f"({valuation_after['total_return_pct']:+.2f}% sedan start)"
    )
    return 0


def cmd_buy(args: argparse.Namespace) -> int:
    return _execute_trade(args, "BUY")


def cmd_sell(args: argparse.Namespace) -> int:
    return _execute_trade(args, "SELL")


def cmd_hold(args: argparse.Namespace) -> int:
    cfg = load_config()
    pf = P.load_portfolio()
    quotes = fetch_prices_for_portfolio_and_watchlist(cfg, pf)
    prices = {t: q.price for t, q in quotes.items()}
    valuation_before = P.portfolio_value(pf, prices)
    snap = write_snapshot(quotes, pf)
    write_decision(
        pf,
        action="HOLD",
        details={},
        reasoning=args.reason or "",
        valuation_before=valuation_before,
        snapshot=snap,
    )
    _bump_turn(pf)
    P.save_portfolio(pf)
    print(f"Tur #{pf['turn_count']} loggad som HOLD: {args.reason or '(ingen motivering)'}")
    return 0


def cmd_report(_args: argparse.Namespace) -> int:
    from src.report import print_report

    return print_report()


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="src.turn", description="AI Aktieexperiment - turstyrning")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub_snapshot = sub.add_parser("snapshot", help="Hämta marknadsdata och visa portfölj")
    sub_snapshot.set_defaults(func=cmd_snapshot)

    sub_buy = sub.add_parser("buy", help="Köp aktier")
    sub_buy.add_argument("ticker")
    sub_buy.add_argument("shares", type=int)
    sub_buy.add_argument("--reason", "-r", default="", help="Motivering till AI-beslut")
    sub_buy.set_defaults(func=cmd_buy)

    sub_sell = sub.add_parser("sell", help="Sälj aktier")
    sub_sell.add_argument("ticker")
    sub_sell.add_argument("shares", type=int)
    sub_sell.add_argument("--reason", "-r", default="")
    sub_sell.set_defaults(func=cmd_sell)

    sub_hold = sub.add_parser("hold", help="Stå still men logga turen")
    sub_hold.add_argument("--reason", "-r", default="")
    sub_hold.set_defaults(func=cmd_hold)

    sub_report = sub.add_parser("report", help="Visa rapport")
    sub_report.set_defaults(func=cmd_report)

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args) or 0)


if __name__ == "__main__":
    raise SystemExit(main())
