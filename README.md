# Navet – plattform för förmågebaserad planering

En komplett SaaS-tjänst som faciliterar hela processen i *Metodhandbok för förmågebaserad planering*
(taktisk styrning – från strategiska teman till OU-roadmap och realisering). Byggd för att köras på en
lokal server: en enda Node-process med inbäddad SQLite-databas, inga externa beroenden i drift.

## Funktioner – hela sjustegsprocessen + navet

| Modul | Steg | Innehåll |
|---|---|---|
| **Navet** (startsida) | Nav | OKR-läge per tema (utfall/prognos/RAG), larmlista, "beslut som behövs", leveransläge, spårbarhetskedjan |
| **Teman & OKR** | 1–2 | Temakort, OKR med basvärde/målvärde/mätserier och trendgrafer, mandatkort, temarangordning, ensidig temarapport |
| **Förmågekarta** | 3 | TOGAF-karta i 2 nivåer, heatmapping per tema (kritikalitet × förflyttningsbehov), 8-förmågorsregeln, korsmappningar ur grundkartorna |
| **Gap-register** | 4 | Gap-kort med mognadsbedömning (1–5) per sex förmågedimensioner, spindeldiagram nuläge/målläge, Måste/Bör/Kan, beroendekarta |
| **OU-roadmap** | 5 | Gantt med committed/planned/outlook, delmål som romber, kapacitetsbild med 80 %-regeln, spegelposter, eskalationslista |
| **Konsolidering** | 6 | De fem analyserna (täckning, konflikt, dubblett, ram, spegelkonsistens) körda live + justerad WSJF-prioritering med strategisk kopplingsmultiplikator |
| **Realisering** | 7 | Prognosdriven månadsrapportering, verifiering av delmål av oberoende part, nyttoregister med hemtagningsansvar, lärandelogg |
| **Vägval & beslut** | 4–7 | Vägvalsmallen (alternativ med kostnad/KR-effekt/risk/tid), beslutslogg med motiv och omprövningsvillkor |
| **Grundkartor** | Faktabas | Process-, informations-, system- och organisationskartan korsmappade mot förmågekartan |
| **Metodstöd** | Alla | Kvalitetsmotorn: handbokens checklistor (bilaga D) utvärderade automatiskt mot portföljens läge, årshjul, RACI, mognadstrappa |

Plattformen kodifierar handbokens regler: max 5 teman, max 8 förmågor till gap-analys, aktivitets-KR-detektering,
Måste-gap kräver KR-spårbarhet, 80 %-regeln för kapacitet, KR utan committed-bärare flaggas, initiativ med
saknade speglar blir inte committed, med mera.

## Kom igång

```bash
npm install
npm run dev        # utvecklingsläge på http://localhost:3000
```

Produktionsdrift på lokal server:

```bash
npm run build
npm start          # http://localhost:3000 (eller PORT=8080 npm start)
```

Databasen skapas automatiskt i `data/navet.db` vid första start och fylls med ett komplett demodata-set
baserat på handbokens genomgående praktikfall (temat *Kapacitet för elektrifieringen* med förmågorna
Anslutningshantering och Nätplanering, nätanalytikerkonflikten, vägvalsbesluten m.m.).
Radera filen för att börja om från ren demodata.

## Teknik

- **Next.js 15** (App Router, React Server Components, Server Actions) – ett enda körbart paket
- **SQLite** via better-sqlite3 – noll driftberoenden, hela informationsmodellen i en fil
- **Tailwind CSS 4** – designsystem
- Diagram (trendlinjer, spindeldiagram, gantt, kapacitetsstaplar) renderas som ren SVG utan externa bibliotek

## Informationsmodell

Teman → Key Results → (heatmap) → Förmågor → Gap (dimensioner, beroenden) → Initiativ (delmål, resurser,
spegelposter) → Status/Nytta, med vägval, eskaleringar och beslutslogg som tvärgående objekt – en
informationsmodell, inga skuggregister (designprincip 6), spårbarhet åt båda håll (designprincip 7).
