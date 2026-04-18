# Styrelseuppdrag-automation

Systematiserad process för att hitta, kvalificera och initiera kontakt kring
styrelseuppdrag som matchar profilen **organisation, AI, expert inom
digitalisering och transformation** (referensprofil: Gustav Hansson).

Repot implementerar både **processen** (best practice-baserad strategi) och
**verktyget** (CLI som aggregerar källor, scorar mot profilen och genererar
utkast till outreach — alla utskick kräver manuellt godkännande).

## Snabbstart

```bash
pip install -e .
styrelse discover          # hämta nya uppdrag från konfigurerade källor
styrelse list --top 20     # lista bäst matchande uppdrag
styrelse show <id>         # detaljer + score-breakdown
styrelse draft <id>        # skapa outreach-utkast i data/drafts/
styrelse approve <id>      # markera utkast som godkänt för utskick
styrelse send <id>         # skicka godkänt utkast (dry-run som default)
```

## Struktur

```
config/
  profile.yaml       # din profil, keywords, preferenser, vikter
  sources.yaml       # källor att bevaka (RSS, CSV, manuella listor)
docs/
  best_practices.md  # sammanställd research: hur man får styrelseuppdrag
  process.md         # veckorytm och arbetsflöde
  templates/         # outreach-mallar (mejl, LinkedIn, valberedning)
src/styrelseautomation/
  cli.py             # styrelse-kommandot
  collectors.py      # RSS, CSV, manuella, annonsflöden
  scoring.py         # profilmatchning
  outreach.py        # utkast + godkännande + skick
  storage.py         # SQLite
data/                # opportunities.db + drafts/ (gitignorerat)
tests/
```

Se `docs/process.md` för veckorytm och `docs/best_practices.md` för research
som processen bygger på.
