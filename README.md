# Aktieexperiment

Ett litet experiment där en AI får 10 000 SEK i fiktiva pengar och försöker
maximera vinst genom att handla på Stockholmsbörsen, en tur per timme.

## Vad detta är

- **Startkapital:** 10 000 SEK
- **Marknad:** Stockholmsbörsen (large/mid cap)
- **Frekvens:** En tur per timme, mån–fre 09:00–16:00 Europe/Stockholm
  (8 turer per handelsdag, cron via GitHub Actions)
- **Mål:** Maximera total avkastning på kortast möjliga tid
- **Beslutsfattare:** Claude (Anthropic API) — eller en mänsklig operatör som
  manuellt kör `src.turn` mellan turerna

Allt körs på fiktiva pengar. Marknadsdatan är dock äkta — den hämtas live från
Yahoo Finance utan API-nyckel.

## Hårda regler

| Regel | Värde |
|-------|------:|
| Startkapital | 10 000 SEK |
| Valuta | SEK (endast Stockholms-tickers) |
| Blankning | Ej tillåten |
| Belåning | Ej tillåten |
| Fraktionerade aktier | Ej tillåtna |
| Max andel av portfölj i en aktie | 30 % |
| Courtage | 0,25 % av handelsvärdet, min 1 SEK |
| En åtgärd per tur | BUY \| SELL \| HOLD |

Alla regler bor i [`config.yaml`](config.yaml). De fullständiga AI-instruktionerna
finns i [`prompts/trader_instructions.md`](prompts/trader_instructions.md).

## Struktur

```
.
├── README.md
├── config.yaml                  # Regler + watchlist
├── requirements.txt
├── prompts/
│   └── trader_instructions.md   # Promptregler för AI-tradern
├── src/
│   ├── market.py                # Hämtar pris från Yahoo Finance
│   ├── portfolio.py             # Köp/sälj/värdering, persistens
│   ├── turn.py                  # CLI: snapshot/buy/sell/hold/report
│   ├── report.py                # Status- och prestandarapport
│   └── ai_decide.py             # Anropar Anthropic API för beslut
├── data/
│   ├── portfolio.json           # Cash + innehav (kanonisk state)
│   ├── trades.jsonl             # Logg över alla utförda affärer
│   ├── decisions.jsonl          # Logg över varje turs beslut + motivering
│   └── snapshots.jsonl          # Marknadsbild per tur
└── .github/workflows/
    └── hourly_trade.yml         # Kör en tur varje hel timme
```

## Köra lokalt

```bash
pip install -r requirements.txt

# Hämta marknadsdata och visa nuvarande portfölj + watchlist
python -m src.turn snapshot

# Köp 4 st VOLV-B.ST med en motivering
python -m src.turn buy VOLV-B.ST 4 --reason "Stark trend i industri"

# Sälj 2 st
python -m src.turn sell VOLV-B.ST 2 --reason "Tar hem 50% av positionen"

# Stå still men logga turen
python -m src.turn hold --reason "Inget bra setup just nu"

# Visa rapport
python -m src.turn report
```

## Köra automatiskt (mån–fre 09–16)

Workflowet [`hourly_trade.yml`](.github/workflows/hourly_trade.yml) kör en tur
varje hel timme **mån–fre 09:00–16:00 Europe/Stockholm** (8 turer per handelsdag).
Det:

1. Kontrollerar lokal Stockholmstid via en *guard*. Om vi är utanför fönstret
   eller på en helg avslutas jobbet direkt utan att göra något.
2. Hämtar marknadsdata för watchlisten.
3. Skriver en snapshot till `data/snapshots.jsonl`.
4. Om secret `ANTHROPIC_API_KEY` finns: anropar `src.ai_decide` som frågar
   Claude vad som ska göras och kör det. Annars: loggar en HOLD.
5. Committar `data/`-ändringar och pushar tillbaka till branchen.

Cron-uttrycket är `0 6-15 * * 1-5` (UTC) — bredare än fönstret för att täcka
både CET (UTC+1) och CEST (UTC+2). Sommartid hanteras av guard-steget, så
schemat blir alltid 09–16 lokal tid oavsett tidpunkt på året.

### Sätt upp AI-runnern

1. Skapa ett Anthropic API-key på https://console.anthropic.com.
2. Lägg till det som repository secret med namnet `ANTHROPIC_API_KEY`
   under *Settings → Secrets and variables → Actions*.
3. Workflowet kör då Claude varje timme. Modellen styrs av miljövariabeln
   `AI_TRADER_MODEL` (default `claude-opus-4-6`).

### Köra manuellt

Du kan trigga workflowet direkt under *Actions → Hourly AI Trade →
Run workflow*.

## Datakontrakt

- **`data/portfolio.json`** är kanoniskt — ändra det aldrig för hand. Alla
  uppdateringar går via `src.turn`.
- **`data/trades.jsonl`** — append-only. En rad per utförd affär.
- **`data/decisions.jsonl`** — append-only. En rad per tur, även HOLD.
- **`data/snapshots.jsonl`** — append-only. En marknadsbild per tur.

## Begränsningar att ha i åtanke

- Yahoo Finance kan halta — då hoppas turen över eller faller tillbaka till HOLD.
- Stockholmsbörsen är öppen 09:00–17:30 CET. Utanför öppettider hänger priserna
  kvar på senaste stängning, så turer på natten är effektivt no-ops.
- Det finns ingen slippage-modell. Vi antar att man får exakt `regularMarketPrice`
  som handlas vid kommando-tillfället. För 10 000 SEK i large caps är det en
  rimlig approximation.
- Ingen handel med utdelningar/splits — om det händer i en innehavd aktie kan
  rapporten bli skev tills positionen säljs.

## Mål

Maximera `total_return_pct` på kortast möjliga tid, utan att bryta reglerna.
Se [`src/report.py`](src/report.py) för hur prestanda räknas ut.
