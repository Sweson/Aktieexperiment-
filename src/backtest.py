"""Backtest av AI-traderns strategi.

Två datakällor:

1. ``--source yahoo`` (default i CI): Hämtar dagliga stängningar för
   varje ticker i watchlistan via Yahoo Finance. Kräver internet.

2. ``--source synthetic``: Genererar prisbanor med en geometrisk Brownsk
   rörelse per ticker. Reproducerbart givet ``--seed``. Används när vi
   inte kan nå Yahoo (lokal sandbox utan internet).

Strategin är fix och beskriven i ``STRATEGY.md`` (samma regler som
AI-tradern är instruerad att följa). Den ska fånga trendföljning med
stop-loss/take-profit, max 30 % per position, courtage 0,25 %.

Användning::

    python -m src.backtest --days 30 --source synthetic --seed 42
    python -m src.backtest --days 30 --source yahoo
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import statistics
import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from src import portfolio as P
from src.turn import load_config

OUTPUT_DIR = os.path.join("data", "backtest")


# ---------------------------------------------------------------------------
# Datakällor
# ---------------------------------------------------------------------------

@dataclass
class PriceSeries:
    ticker: str
    timestamps: list[int]   # unix seconds
    closes: list[float]


def fetch_yahoo_history(ticker: str, days: int) -> PriceSeries:
    import requests
    from src import market

    url = market.YAHOO_CHART_URL.format(symbol=ticker)
    params = {"range": f"{max(days+5, 35)}d", "interval": "1d"}
    resp = requests.get(
        url, params=params, headers=market.DEFAULT_HEADERS, timeout=15
    )
    resp.raise_for_status()
    data = resp.json()
    res = (data.get("chart") or {}).get("result") or []
    if not res:
        raise ValueError(f"Inget Yahoo-resultat för {ticker}")
    r0 = res[0]
    ts = r0.get("timestamp") or []
    closes = (r0.get("indicators") or {}).get("quote", [{}])[0].get("close") or []
    pairs = [(int(t), float(c)) for t, c in zip(ts, closes) if c is not None]
    return PriceSeries(
        ticker=ticker,
        timestamps=[t for t, _ in pairs],
        closes=[c for _, c in pairs],
    )


# Realistiska startpriser och årlig volatilitet ur klassen "stora bolag på
# Stockholmsbörsen". Drift sätts till 0 så att den syntetiska
# körningen inte är systematiskt biased uppåt eller nedåt - all "alpha" som
# strategin genererar är då äkta strategi-effekt och inte dold drift.
SYNTHETIC_PARAMS: dict[str, dict[str, float]] = {
    "VOLV-B.ST":  {"start": 285.0, "vol": 0.28},
    "ERIC-B.ST":  {"start":  72.0, "vol": 0.32},
    "HM-B.ST":    {"start": 175.0, "vol": 0.30},
    "SAND.ST":    {"start": 235.0, "vol": 0.27},
    "ATCO-A.ST":  {"start": 175.0, "vol": 0.25},
    "INVE-B.ST":  {"start": 280.0, "vol": 0.22},
    "ABB.ST":     {"start": 510.0, "vol": 0.26},
    "AZN.ST":     {"start": 1320.0, "vol": 0.24},
    "SEB-A.ST":   {"start": 165.0, "vol": 0.26},
    "SWED-A.ST":  {"start": 230.0, "vol": 0.27},
    "EVO.ST":     {"start": 950.0, "vol": 0.45},
    "NIBE-B.ST":  {"start":  55.0, "vol": 0.42},
    "EMBRAC-B.ST":{"start":  20.0, "vol": 0.55},
    "SBB-B.ST":   {"start":   6.0, "vol": 0.65},
    "SAS.ST":     {"start":   2.5, "vol": 0.70},
}


def synthetic_history(ticker: str, days: int, seed: int) -> PriceSeries:
    """Genererar dagliga stängningar med GBM. Drift = 0."""
    params = SYNTHETIC_PARAMS.get(
        ticker, {"start": 100.0, "vol": 0.30}
    )
    rnd = random.Random(seed + hash(ticker) % 100000)
    n = days
    sigma_daily = params["vol"] / math.sqrt(252)
    price = params["start"]
    closes: list[float] = []
    timestamps: list[int] = []
    end = datetime.now(timezone.utc).replace(hour=15, minute=30, second=0, microsecond=0)
    start_dt = end - timedelta(days=days - 1)
    cur = start_dt
    for _ in range(n):
        # Hoppa över helgdagar
        while cur.weekday() >= 5:
            cur += timedelta(days=1)
        # log-return ~ N(-0.5*sigma^2, sigma^2)
        z = rnd.gauss(0.0, 1.0)
        log_ret = -0.5 * sigma_daily ** 2 + sigma_daily * z
        price = price * math.exp(log_ret)
        closes.append(round(price, 4))
        timestamps.append(int(cur.timestamp()))
        cur += timedelta(days=1)
    return PriceSeries(ticker=ticker, timestamps=timestamps, closes=closes)


# ---------------------------------------------------------------------------
# Strategi
# ---------------------------------------------------------------------------

@dataclass
class StrategyConfig:
    momentum_window: int = 5     # antal bar för momentumberäkning
    take_profit_pct: float = 0.06   # +6 %
    stop_loss_pct: float = 0.03     # -3 %
    target_position_value: float = 2500.0   # ~25 % av startkapital
    max_positions: int = 3
    min_cash_for_buy: float = 2000.0
    max_position_pct: float = 0.30


def momentum(closes: list[float], window: int) -> float | None:
    if len(closes) < window + 1:
        return None
    return closes[-1] / closes[-1 - window] - 1.0


@dataclass
class BacktestResult:
    starting_capital: float
    final_value: float
    total_return_pct: float
    max_drawdown_pct: float
    n_trades: int
    winning_trades: int
    losing_trades: int
    fees_paid: float
    realized_pnl: float
    equity_curve: list[dict[str, Any]]
    trades: list[dict[str, Any]]
    decisions: list[dict[str, Any]]


def run_backtest(
    histories: dict[str, PriceSeries],
    cfg: StrategyConfig,
    fee: P.Fee,
    starting_capital: float = 10000.0,
) -> BacktestResult:
    # Anta att alla serier har samma längd och timestamps
    tickers = sorted(histories.keys())
    if not tickers:
        raise ValueError("Inga histories")
    n_bars = len(histories[tickers[0]].closes)

    pf: dict[str, Any] = {
        "currency": "SEK",
        "starting_capital": starting_capital,
        "cash": starting_capital,
        "holdings": {},
        "realized_pnl": 0.0,
        "total_fees_paid": 0.0,
        "turn_count": 0,
    }
    trades: list[dict[str, Any]] = []
    decisions: list[dict[str, Any]] = []
    equity_curve: list[dict[str, Any]] = []

    # Patch portfolio module to capture appended trades in-memory
    real_append = P.append_trade
    P.append_trade = lambda t, path=None: trades.append(t)  # type: ignore

    try:
        for bar in range(n_bars):
            timestamp = histories[tickers[0]].timestamps[bar]
            prices: dict[str, float] = {
                t: histories[t].closes[bar] for t in tickers
            }

            # 1. Sälj-signaler först (TP/SL) ----------------------------------
            for ticker in list(pf["holdings"].keys()):
                h = pf["holdings"][ticker]
                price = prices[ticker]
                avg = float(h["avg_cost"])
                ret = price / avg - 1.0
                action: str | None = None
                if ret >= cfg.take_profit_pct:
                    action = "TP"
                elif ret <= -cfg.stop_loss_pct:
                    action = "SL"
                if action:
                    shares = int(h["shares"])
                    P.execute_sell(
                        pf, ticker, shares, price, fee,
                        f"{action} @ {ret*100:+.1f}% från snitt {avg:.2f}",
                        bar + 1,
                    )
                    decisions.append({
                        "bar": bar, "action": "SELL",
                        "ticker": ticker, "shares": shares,
                        "price": price, "reason": action,
                    })

            # 2. Köp-signal: top-momentum --------------------------------------
            cur_positions = len(pf["holdings"])
            if (
                cur_positions < cfg.max_positions
                and pf["cash"] >= cfg.min_cash_for_buy
            ):
                ranked: list[tuple[str, float]] = []
                for ticker in tickers:
                    if ticker in pf["holdings"]:
                        continue
                    closes_so_far = histories[ticker].closes[: bar + 1]
                    m = momentum(closes_so_far, cfg.momentum_window)
                    if m is not None and m > 0:
                        ranked.append((ticker, m))
                ranked.sort(key=lambda x: x[1], reverse=True)

                if ranked:
                    target_ticker, mom = ranked[0]
                    price = prices[target_ticker]
                    desired_value = min(cfg.target_position_value, pf["cash"] * 0.95)
                    shares = int(desired_value // price)
                    if shares > 0:
                        ok, _ = P.check_position_limit(
                            pf, target_ticker, shares * price, prices,
                            cfg.max_position_pct,
                        )
                        if ok:
                            try:
                                P.execute_buy(
                                    pf, target_ticker, shares, price, fee,
                                    f"Momentum {cfg.momentum_window}d {mom*100:+.1f}%",
                                    bar + 1,
                                )
                                decisions.append({
                                    "bar": bar, "action": "BUY",
                                    "ticker": target_ticker, "shares": shares,
                                    "price": price, "reason": f"mom {mom*100:+.1f}%",
                                })
                            except ValueError:
                                pass

            # 3. Värdera och spara equity ---------------------------------------
            val = P.portfolio_value(pf, prices)
            equity_curve.append({
                "bar": bar,
                "timestamp": timestamp,
                "date": datetime.fromtimestamp(timestamp, timezone.utc).strftime("%Y-%m-%d"),
                "cash": val["cash"],
                "holdings_value": val["holdings_value"],
                "total_value": val["total_value"],
                "return_pct": val["total_return_pct"],
            })
    finally:
        P.append_trade = real_append  # type: ignore

    # Stäng eventuella kvarvarande positioner till sista pris för att
    # mäta slutgiltigt värde mot kapital
    last_prices = {t: histories[t].closes[-1] for t in tickers}
    final_val = P.portfolio_value(pf, last_prices)
    final_value = final_val["total_value"]

    # Drawdown
    peak = -math.inf
    max_dd = 0.0
    for row in equity_curve:
        peak = max(peak, row["total_value"])
        dd = (row["total_value"] / peak - 1.0) if peak > 0 else 0.0
        if dd < max_dd:
            max_dd = dd

    sells = [t for t in trades if t["action"] == "SELL"]
    wins = sum(1 for t in sells if t.get("realized_pnl_sek", 0) > 0)
    losses = sum(1 for t in sells if t.get("realized_pnl_sek", 0) <= 0)

    return BacktestResult(
        starting_capital=starting_capital,
        final_value=round(final_value, 2),
        total_return_pct=round((final_value / starting_capital - 1) * 100, 2),
        max_drawdown_pct=round(max_dd * 100, 2),
        n_trades=len(trades),
        winning_trades=wins,
        losing_trades=losses,
        fees_paid=round(pf["total_fees_paid"], 2),
        realized_pnl=round(pf["realized_pnl"], 2),
        equity_curve=equity_curve,
        trades=trades,
        decisions=decisions,
    )


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def write_outputs(result: BacktestResult, source: str, days: int, seed: int | None) -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # JSON-summary
    summary = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": source,
        "days": days,
        "seed": seed,
        "starting_capital": result.starting_capital,
        "final_value": result.final_value,
        "total_return_pct": result.total_return_pct,
        "max_drawdown_pct": result.max_drawdown_pct,
        "n_trades": result.n_trades,
        "winning_trades": result.winning_trades,
        "losing_trades": result.losing_trades,
        "fees_paid": result.fees_paid,
        "realized_pnl": result.realized_pnl,
    }
    with open(os.path.join(OUTPUT_DIR, "summary.json"), "w") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # CSV-equity
    with open(os.path.join(OUTPUT_DIR, "equity_curve.csv"), "w") as f:
        f.write("bar,date,cash,holdings_value,total_value,return_pct\n")
        for row in result.equity_curve:
            f.write(
                f"{row['bar']},{row['date']},{row['cash']:.2f},"
                f"{row['holdings_value']:.2f},{row['total_value']:.2f},"
                f"{row['return_pct']:.2f}\n"
            )

    # CSV-trades
    with open(os.path.join(OUTPUT_DIR, "trades.csv"), "w") as f:
        f.write("turn,timestamp,action,ticker,shares,price,gross_sek,fee_sek,total_sek,realized_pnl_sek,reasoning\n")
        for t in result.trades:
            f.write(
                f"{t['turn']},{t['timestamp']},{t['action']},{t['ticker']},"
                f"{t['shares']},{t['price']:.4f},{t['gross_sek']:.2f},"
                f"{t['fee_sek']:.2f},{t['total_sek']:.2f},"
                f"{t.get('realized_pnl_sek', 0):.2f},"
                f"\"{t.get('reasoning','').replace(chr(34),'')}\"\n"
            )

    # Markdown-rapport
    md = []
    md.append(f"# Backtest-rapport\n")
    md.append(f"- **Datakälla:** {source}{' (seed='+str(seed)+')' if seed is not None else ''}")
    md.append(f"- **Period:** ~{days} dagar")
    md.append(f"- **Startkapital:** {result.starting_capital:.2f} SEK")
    md.append(f"- **Slutvärde:** {result.final_value:.2f} SEK")
    md.append(f"- **Total avkastning:** {result.total_return_pct:+.2f} %")
    md.append(f"- **Max drawdown:** {result.max_drawdown_pct:.2f} %")
    md.append(f"- **Antal trades:** {result.n_trades} ({result.winning_trades} vinst / {result.losing_trades} förlust)")
    md.append(f"- **Realiserad PnL:** {result.realized_pnl:+.2f} SEK")
    md.append(f"- **Courtage betalat:** {result.fees_paid:.2f} SEK")
    md.append("\n## Equity-kurva (per bar)\n")
    md.append("| Bar | Datum | Cash | Innehav | Totalt | Avk % |")
    md.append("|----:|:------|------:|--------:|-------:|------:|")
    for row in result.equity_curve:
        md.append(
            f"| {row['bar']} | {row['date']} | "
            f"{row['cash']:.2f} | {row['holdings_value']:.2f} | "
            f"{row['total_value']:.2f} | {row['return_pct']:+.2f} |"
        )
    md.append("\n## Trades\n")
    md.append("| Tur | Action | Ticker | Antal | Pris | Fee | Realiserad | Reason |")
    md.append("|----:|:------|:------|------:|-----:|----:|-----------:|:-------|")
    for t in result.trades:
        md.append(
            f"| {t['turn']} | {t['action']} | {t['ticker']} | "
            f"{t['shares']} | {t['price']:.2f} | {t['fee_sek']:.2f} | "
            f"{t.get('realized_pnl_sek', 0):+.2f} | {t.get('reasoning','')} |"
        )
    with open(os.path.join(OUTPUT_DIR, "report.md"), "w") as f:
        f.write("\n".join(md) + "\n")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="AI Aktieexperiment - backtest")
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--source", choices=["yahoo", "synthetic"], default="synthetic")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args(argv)

    cfg = load_config()
    tickers = [w["ticker"] for w in cfg.get("watchlist", [])]
    rules = cfg.get("rules", {})
    fee = P.Fee(
        pct=float(rules.get("fee_pct", 0.0025)),
        minimum=float(rules.get("fee_min_sek", 1.0)),
    )

    histories: dict[str, PriceSeries] = {}
    if args.source == "yahoo":
        for t in tickers:
            try:
                histories[t] = fetch_yahoo_history(t, args.days)
            except Exception as exc:  # noqa: BLE001
                print(f"[backtest] Hoppar över {t}: {exc}", file=sys.stderr)
        if not histories:
            print("Ingen Yahoo-data kunde hämtas.", file=sys.stderr)
            return 2
        # Trimma till gemensam längd (sista N bars)
        n = min(len(h.closes) for h in histories.values())
        n = min(n, args.days)
        for k, v in histories.items():
            histories[k] = PriceSeries(
                ticker=k,
                timestamps=v.timestamps[-n:],
                closes=v.closes[-n:],
            )
    else:
        for t in tickers:
            histories[t] = synthetic_history(t, args.days, args.seed)

    strategy = StrategyConfig(
        momentum_window=int(rules.get("backtest_momentum_window", 5)),
        max_position_pct=float(rules.get("max_position_pct", 0.30)),
    )

    result = run_backtest(histories, strategy, fee, starting_capital=10000.0)

    print("=" * 60)
    print(f"Backtest klar  ({args.source}, {args.days} dagar"
          + (f", seed={args.seed}" if args.source == 'synthetic' else "")
          + ")")
    print("=" * 60)
    print(f"Startkapital:    {result.starting_capital:>10.2f} SEK")
    print(f"Slutvärde:       {result.final_value:>10.2f} SEK")
    print(f"Avkastning:      {result.total_return_pct:>+10.2f} %")
    print(f"Max drawdown:    {result.max_drawdown_pct:>10.2f} %")
    print(f"Trades:          {result.n_trades:>10d}  "
          f"({result.winning_trades} vinst / {result.losing_trades} förlust)")
    print(f"Realiserad PnL:  {result.realized_pnl:>+10.2f} SEK")
    print(f"Courtage:        {result.fees_paid:>10.2f} SEK")

    write_outputs(result, args.source, args.days, args.seed if args.source == "synthetic" else None)
    print(f"\nResultat sparat i {OUTPUT_DIR}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
