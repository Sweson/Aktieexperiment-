"""Frågar Claude (Anthropic API) om beslut för en handelstur.

Förutsätter att miljövariabeln ANTHROPIC_API_KEY är satt.

Skicket på portföljen + watchlistens marknadsdata skickas in,
tillsammans med innehållet i prompts/trader_instructions.md.
Modellen ska svara med ett strikt JSON-objekt:

    {"action": "BUY" | "SELL" | "HOLD",
     "ticker": "VOLV-B.ST" | null,
     "shares": 10 | null,
     "reasoning": "Kort motivering"}

JSON parsas och rätt subkommando i src.turn körs. Ifall modellen
svarar trasigt eller bryter en regel faller vi tillbaka till HOLD.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from typing import Any

import requests

from src import market, portfolio as P
from src.turn import (
    fetch_prices_for_portfolio_and_watchlist,
    load_config,
)

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
DEFAULT_MODEL = os.environ.get("AI_TRADER_MODEL", "claude-opus-4-6")
INSTRUCTIONS_PATH = os.path.join("prompts", "trader_instructions.md")


def load_instructions() -> str:
    with open(INSTRUCTIONS_PATH, "r", encoding="utf-8") as f:
        return f.read()


def build_user_message(
    cfg: dict[str, Any],
    pf: dict[str, Any],
    quotes: dict[str, market.Quote],
) -> str:
    prices = {t: q.price for t, q in quotes.items()}
    val = P.portfolio_value(pf, prices)

    market_block = {
        t: market.summarize_quote(q) for t, q in sorted(quotes.items())
    }

    payload = {
        "rules": cfg.get("rules", {}),
        "turn": int(pf.get("turn_count", 0)) + 1,
        "starting_capital_sek": val["starting_capital"],
        "portfolio": {
            "cash": val["cash"],
            "holdings_value": val["holdings_value"],
            "total_value": val["total_value"],
            "total_return_pct": val["total_return_pct"],
            "positions": val["positions"],
        },
        "watchlist_quotes": market_block,
    }

    return (
        "Nedan är aktuellt state och marknadsdata. Bestäm en åtgärd för "
        "denna tur enligt instruktionerna i system-prompten.\n\n"
        "Svara ENDAST med ett JSON-objekt på exakt formen:\n"
        '{"action":"BUY"|"SELL"|"HOLD","ticker":<string|null>,'
        '"shares":<int|null>,"reasoning":<string>}\n\n'
        "STATE_JSON:\n```json\n"
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + "\n```"
    )


def call_claude(system: str, user: str, model: str = DEFAULT_MODEL) -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY saknas")
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": model,
        "max_tokens": 1024,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    resp = requests.post(ANTHROPIC_URL, headers=headers, json=body, timeout=60)
    resp.raise_for_status()
    data = resp.json()
    parts = data.get("content") or []
    text_chunks = [p.get("text", "") for p in parts if p.get("type") == "text"]
    return "".join(text_chunks).strip()


_JSON_RE = re.compile(r"\{[\s\S]*\}")


def parse_decision(text: str) -> dict[str, Any]:
    """Extraherar JSON-objektet ur svaret. Tolerant mot extra text."""
    match = _JSON_RE.search(text)
    if not match:
        raise ValueError(f"Inget JSON-objekt i svaret: {text!r}")
    obj = json.loads(match.group(0))
    action = obj.get("action", "").upper()
    if action not in {"BUY", "SELL", "HOLD"}:
        raise ValueError(f"Ogiltig action: {action!r}")
    return {
        "action": action,
        "ticker": obj.get("ticker"),
        "shares": obj.get("shares"),
        "reasoning": obj.get("reasoning") or "(ingen motivering)",
    }


def execute_decision(decision: dict[str, Any]) -> int:
    """Anropar src.turn-CLI:t som subprocess för att utföra beslutet."""
    action = decision["action"]
    reason = decision["reasoning"]
    if action == "HOLD":
        cmd = [sys.executable, "-m", "src.turn", "hold", "--reason", reason]
    else:
        ticker = decision.get("ticker")
        shares = decision.get("shares")
        if not ticker or not shares or int(shares) <= 0:
            print("Ogiltigt beslut, faller tillbaka till HOLD.", file=sys.stderr)
            cmd = [
                sys.executable, "-m", "src.turn", "hold",
                "--reason", f"Fallback HOLD: ogiltig {action}-respons",
            ]
        else:
            cmd = [
                sys.executable, "-m", "src.turn",
                action.lower(), str(ticker), str(int(shares)),
                "--reason", reason,
            ]
    print("Kör:", " ".join(cmd))
    return subprocess.call(cmd)


def main() -> int:
    cfg = load_config()
    pf = P.load_portfolio()
    quotes = fetch_prices_for_portfolio_and_watchlist(cfg, pf)
    if not quotes:
        print("Ingen marknadsdata tillgänglig — HOLD.", file=sys.stderr)
        return execute_decision(
            {"action": "HOLD", "ticker": None, "shares": None,
             "reasoning": "Fallback HOLD: kunde inte hämta marknadsdata"}
        )

    system = load_instructions()
    user = build_user_message(cfg, pf, quotes)

    try:
        text = call_claude(system, user)
        print("--- AI-svar ---")
        print(text)
        print("---------------")
        decision = parse_decision(text)
    except Exception as exc:  # noqa: BLE001
        print(f"AI-anrop misslyckades: {exc}", file=sys.stderr)
        decision = {
            "action": "HOLD",
            "ticker": None,
            "shares": None,
            "reasoning": f"Fallback HOLD: {exc}",
        }

    return execute_decision(decision)


if __name__ == "__main__":
    raise SystemExit(main())
