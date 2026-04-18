# Process – så kör du automationen

Syftet är att omvandla best practice till en systematisk rytm. Verktyget gör
det tråkiga (bevakning, scoring, utkast). Du fattar alla beslut som matchar
människor.

## Veckorytm

### Måndag: Discover (10 min)
```bash
styrelse discover
styrelse list --top 20
```
Gå igenom top-listan. Markera 2–3 uppdrag som känns intressanta.

### Tisdag–onsdag: Research & utkast (30–45 min)
För varje valt uppdrag:
```bash
styrelse show <id>          # se matchningen
styrelse draft <id>         # skapar data/drafts/<id>.md
```
Öppna utkastet i en editor. Fyll i:
- **mottagare**: valberednings­ordförande, styrelseordförande eller avsändare
  av annonsen. Googla + verifiera på bolagets hemsida.
- **personlig krok**: ta bort generella fraser, lägg in en konkret koppling
  (gemensam kontakt, deras senaste uttalande, din relevanta case).
- **ask**: ett tydligt ja/nej-förslag – 20 min digitalt samtal nästa vecka.

### Torsdag: Approve & skicka
```bash
styrelse approve <id>
styrelse send <id>                 # dry-run
styrelse send <id> --confirm-send  # skickar på riktigt (kräver SMTP-env)
```
LinkedIn-meddelanden kopieras manuellt från utkastfilen – inget automatiskt
utskick mot LinkedIn (ToS).

### Fredag: Följa upp
```bash
styrelse list --status contacted
```
För kontakter som är 10–14 dagar gamla utan svar: skicka en kort uppföljning.
Efter två uppföljningar utan svar → släpp och gå vidare.

## Månadsrytm

- **Första i månaden**: uppdatera `config/profile.yaml` om kompetenser/case
  har förändrats.
- **Uppdatera kandidatbankerna** (StyrelseAkademien, NEL) med senaste CV.
- **Publicera 1 LinkedIn-inlägg** om AI/transformation i styrelseperspektiv.
- **Boka 4–6 nätverksmöten** med personer från bevakningens top-lista.

## Kvartalsrytm

- Kör `styrelse report` och se om pipeline är sund (>20 uppdrag i "new",
  >3 i "contacted"). Om inte: fler källor, bredare keywords, eller mer
  proaktivt nätverksarbete.
- Review av `config/sources.yaml` – finns nya kanaler? Tas några bort?
- Gör en ärlig självbedömning av keyword-vikterna i `config/profile.yaml`.

## Kritiska principer

1. **Inget utskick utan approve.** Verktyget går aldrig förbi dig.
2. **Inget LinkedIn-scraping.** Det bryter mot ToS och skadar profilen om
   du blir flaggad. Använd manuell inmatning via CSV eller `styrelse add`.
3. **Kvalitet > kvantitet i outreach.** 5 personliga meddelanden slår 50
   mallar. Score hjälper dig att välja – inte att automatisera bort tanken.
4. **Spåra resultat.** Efter 3 månader: vilka källor gav kvalificerade
   möjligheter? Skala upp dem, plocka bort resten.
