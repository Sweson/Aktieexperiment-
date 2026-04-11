# Strategi - vad AI:n faktiskt gör

Den här filen beskriver den deterministiska strategi som
[`src/backtest.py`](src/backtest.py) implementerar och som speglar
hur AI-tradern är instruerad att bete sig (se
[`prompts/trader_instructions.md`](prompts/trader_instructions.md)).

## Idé i en mening

> Köp den aktie i watchlistan som har starkast 5-dagars momentum, ta hem
> vinster vid +6 % och stoppa förluster vid -3 %, max 3 samtidiga
> positioner och max 30 % av portföljen i en enskild aktie.

## Detaljerade regler

### Säljbeslut (görs först varje bar)
För varje innehavd position:

- Om priset är **+6 % eller mer** över snittkurs -> sälj hela positionen (TP).
- Om priset är **-3 % eller mer** under snittkurs -> sälj hela positionen (SL).
- Annars: håll.

### Köpbeslut (görs efter sälj)

Om vi har < 3 öppna positioner OCH > 2 000 SEK i cash:

1. Beräkna 5-dagars momentum (`pris_idag / pris_för_5_dagar_sedan - 1`)
   för varje aktie i watchlistan som vi inte redan äger.
2. Filtrera bort negativa.
3. Köp den aktie som rankas högst.
4. Storlek: 25 % av startkapital (= 2 500 SEK), eller mindre om courtage
   och 30 %-regeln säger nej.

### Hårda regler (samma som live-experimentet)
- Startkapital: 10 000 SEK
- Endast Stockholms-tickers (SEK)
- Inga blankningar, ingen belåning, inga fraktionerade aktier
- Max 30 % av portföljen i en enskild aktie
- Courtage: 0,25 % av handelsvärdet, min 1 SEK

## Varför just den här strategin?

- **Trendföljning** är den enklaste och mest robusta edgen som småsparare
  kan uttrycka utan att övertränas. Att ranka watchlistan på 5d-momentum
  är ett klassiskt enkelt signalfilter.
- **Stop-loss på -3 %** håller drawdown begränsad. Med max 3 positioner
  och 30 % per position är värsta dagen ungefär -2,7 % på portföljen.
- **Take-profit på +6 %** ger en R/R på 2:1, vilket räcker för positivt
  förväntat värde redan vid 35 % träffsäkerhet.
- **Max 3 positioner** är ett medvetet val: tillräckligt med
  diversifiering för att inte dö på en enskild rapport, samtidigt som
  varje vinnare faktiskt rör portföljen.
- **Position size 25 %** lämnar buffert mot 30 %-regeln om en position
  rusar mellan turerna.

Det här är en tydligt formulerad bas. AI-tradern i live-läget får
**avvika** från strategin om den ser ett bättre läge - men då måste
den motivera det i `--reason`. Backtesten kör alltid den deterministiska
versionen.

## Begränsningar att veta om

- Strategin är **dagsbaserad** i backtesten. I live-experimentet körs
  den varje timme - signalen är alltså långsammare än cyklen, vilket
  betyder att de flesta intra-day-turerna borde bli HOLD om strategin
  följs strikt.
- **Slippage modelleras inte.** Vi handlar till stängningskursen för
  varje bar utan friktionskostnad utöver courtaget. Det är OK för
  large caps men optimistiskt för småbolag.
- **Inga utdelningar eller splits** justeras.
- **Drift = 0 i syntetisk data.** Backtestet på syntetiska priser
  visar därför alpha från strategin (eller avsaknaden av det), inte
  generell marknadsavkastning.
