# Kravspecifikation: SaaS-plattform för krisövning i Sverige

**Arbetsnamn:** ÖvningsHub Sverige | **Version:** 1.1 (Intern-nivå) | **Datum:** 2026-04-25
**Maxnivå för informationshantering:** **INTERN** (öppen och intern information). Plattformen får **inte** användas för säkerhetsskyddsklassificerade uppgifter (Begränsat hemlig eller högre enligt säkerhetsskyddslagen 2018:585).
**Målgrupper:** Kommuner och regioner (icke-säkerhetsskyddad krisberedskap) · MSB och statliga beredskapsmyndigheter (öppna/interna övningar) · Näringsliv (BCM/DORA/NIS2) · Hälso- och sjukvård (icke-säkerhetsskyddad katastrofmedicinsk beredskap) · Frivilliga försvarsorganisationer (öppen utbildning)
**Ej i scope:** Försvarsmaktens skarpa staber · FRA · FOI:s säkerhetsskyddsklassade verksamhet · övningar som behandlar uppgifter klassificerade enligt säkerhetsskyddslagen 2018:585.
**Standardgrund:** HSEEP · ISO 22301/22320/22361/22398 · MSB Övningsvägledning · WCAG 2.1 AA · GDPR · NIS2 · DORA · ISO 27001 · ISO 27701

---

## 1. Sammanfattning och bärande tes

Denna kravspecifikation beskriver en **suverän, svensk SaaS-plattform för planering, genomförande och utvärdering av krisövningar på öppen eller intern informationsnivå** – från tabletop-övningar i en mindre kommun till storskaliga sektorövergripande övningar med tusentals deltagare i offentlig sektor, näringsliv och vård. Plattformen ersätter dagens fragmenterade verktygsflora (PowerPoint, Excel-MSEL, fysiska whiteboards, ad-hoc-användning av Teams) med en **enhetlig, MSB-aligned miljö** som binder ihop scenariobygge, realtidsinjekter, GIS-baserad lägesbild, kommunikationssimulering, AAR och Lessons Learned i ett spårbart flöde.

**Tydlig avgränsning mot säkerhetsskydd.** Plattformen är medvetet designad för information klassad som öppen eller intern. För övningar som behandlar uppgifter som rör Sveriges säkerhet eller som omfattas av säkerhetsskyddslagen ska andra, säkerhetsskyddsklassade verktyg användas. Tekniska och organisatoriska kontroller (klassmodellen, ABAC-policy, plattformsadminens guardrails) ska aktivt **förhindra** att säkerhetsskyddsklassificerat material läggs in.

Den centrala produkthypotesen lyder: _Genom att digitalisera och kvalitetshöja icke-säkerhetsskyddad krisövningsverksamhet i hela samhället – från privata sjukhus och kommunala krisledningsnämnder till banker och statliga beredskapsmyndigheter – kan Sverige öva oftare, mer realistiskt och med mätbart bättre lärande, vilket direkt stärker den civila beredskapen._ Plattformen drivs i **två mognadsnivåer** på samma kodbas: Civil/BCM (näringsliv, vård, frivilligorganisationer) och Offentlig sektor (kommuner, regioner, myndigheter på intern-nivå).

Konkurrentanalysen visar att marknaden domineras av amerikanska generalister (WebEOC/Juvare, Veoci, D4H), tyska BCM-spelare (F24/FACT24, Riskonnect) och NATO-interna verktyg (JEMM). **Ingen aktör är samtidigt MSB-metodikförst och svensk-suverän med tydlig EU/Sverige-driftbas.** Det är denna lucka plattformen ska fylla.

---

## 2. Strategiska teman (Strategic Themes)

Sex strategiska teman styr portföljens investeringar 2026–2028.

**ST‑1 Demokratisera krisövning.** Sänk tröskeln så att även små kommuner, mindre vårdgivare och SMF kan genomföra metodiskt korrekta övningar utan extern konsult. **Mätetal:** ≥150 svenska kommuner aktiva inom 24 månader; tid att planera en TTX reduceras från 200 h till <40 h.

**ST‑2 Stärk civil samverkansförmåga.** Möjliggör övningar som spänner sektorer – kommun, region, myndighet, näringsliv, vård – enligt MSB:s 10 beredskapssektorer och 6 civilområden.

**ST‑3 Suverän, säker och regelefterlevd by design.** All data i Sverige eller EU/EES, modern kryptografi, ISO 27001/27701, full GDPR-, NIS2- och DORA-compliance, **explicita kontroller som förhindrar att säkerhetsskyddsklassificerat material hamnar i plattformen**.

**ST‑4 AI som accelerator för övningsdesign och lärande.** Generativ AI (suverän, EU-driftad modell) genererar scenarier, injekter, AAR-utkast och kopplar lessons learned över organisationer.

**ST‑5 Mät, jämför och förbättra förmåga över tid.** Bygg ett **förmågeobservatorium** som aggregerar AAR-data och identifierar systemiska brister över sektorer och regioner.

**ST‑6 Drift även när det skaver.** Fungera vid störd internetkoppling och cyberangrepp mot själva plattformen.

---

## 3. Portfolio Epics

| #    | Tema | Epic                                                                   | Typ          |
| ---- | ---- | ---------------------------------------------------------------------- | ------------ |
| E‑01 | ST‑1 | Övningsdesigner och scenariobibliotek                                  | Business     |
| E‑02 | ST‑1 | Multi-tenant och rollramverk för svensk beredskapsstruktur             | Enabler      |
| E‑03 | ST‑1 | Onboarding, mallar och MSB-metodikguide                                | Business     |
| E‑04 | ST‑2 | MSEL- och inject-motor (HSEEP-aligned)                                 | Business     |
| E‑05 | ST‑2 | Realtids-EXCON och spelmiljö                                           | Business     |
| E‑06 | ST‑2 | GIS och Common Operational Picture                                     | Business     |
| E‑07 | ST‑2 | Kommunikationssimulering (sociala medier, DISINFO, simulerad telefoni) | Business     |
| E‑08 | ST‑2 | Integration WIS, Sjunet, öppna API:er                                  | Enabler      |
| E‑09 | ST‑3 | Identitet, federation och stark autentisering                          | Enabler      |
| E‑10 | ST‑3 | Informationsklassning **upp till INTERN**, ABAC och DLP                | Enabler      |
| E‑11 | ST‑3 | Krypto, nyckelhantering och loggintegritet                             | Enabler      |
| E‑12 | ST‑3 | Compliance-paket (NIS2, DORA, GDPR, arkivlag, ISO 27001/27701)         | Compliance   |
| E‑13 | ST‑4 | AI-scenarioassistent och adaptiva injekter                             | Business     |
| E‑14 | ST‑4 | AI-driven AAR och Lessons Learned-analys                               | Business     |
| E‑15 | ST‑5 | Förmågeobservatorium och benchmarking                                  | Business     |
| E‑16 | ST‑5 | Utvärderings- och EEG-ramverk                                          | Business     |
| E‑17 | ST‑6 | Offline-, edge- och degraded-mode                                      | Architecture |
| E‑18 | ST‑6 | Resiliens, observability och DR                                        | Architecture |

---

## 4. Icke-funktionella krav (sammanfattning)

| Område                      | Krav                                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Datasuveränitet**         | All data och behandling i Sverige (primärt) eller EU/EES; suveräna molnplattformar (Tietoevry, City Network/Cleura, Evroc) eller on-prem |
| **Kryptering**              | TLS 1.3 in-transit; AES-256-GCM at-rest; HSM FIPS 140-2 nivå 2+; nyckelrotation ≤12 mån; BYOK valbart; post-kvant-hybrid på roadmap      |
| **Identitet**               | SAML/OIDC, SCIM, BankID, Freja eID+; MFA obligatoriskt (TOTP/FIDO2/passkeys)                                                             |
| **Tillgänglighet UX**       | WCAG 2.1 AA, EN 301 549 V3.2.1; svenska, engelska, samiska                                                                               |
| **Drifttillgänglighet**     | ≥99,9 % normalt; ≥99,99 % under aktiv övning; RTO ≤30 min; RPO ≤1 min                                                                    |
| **Skalbarhet**              | ≥1 000 samtidiga deltagare per övning; ≥10 parallella övningar per tenant; ≥100 tenants per region                                       |
| **Prestanda**               | API P95 <200 ms, P99 <500 ms; LCP <2 s på 4G; injekt-latens <1 s                                                                         |
| **Informationsklass-spärr** | Tekniska kontroller förhindrar att säkerhetsskyddsklassad information laddas upp eller skapas (DLP-mönster, klassningsfält-enum)         |
| **Loggintegritet**          | Append-only audit, kryptografisk hashkedja, WORM-lagring ≥10 år                                                                          |

---

## 5. Roadmap PI 1–PI 7 (21 månader)

**PI 1 – Foundation/MVP (månad 0–3).** E‑02 multi-tenant + RBAC; E‑01 grundläggande övningsdesigner med 5 mallar; E‑04 MSEL-redaktör (utan conditional); E‑16 EEG och AAR-mall; E‑09 identitetsfederation (BankID + SAML); E‑10 klassmodell **Öppen/Intern + säkerhetsskydds-spärr**; E‑11 krypto-grund.

**PI 2 – Spelmiljön på plats (månad 3–6).** E‑05 EXCON-cockpit och spelarvy; E‑04 push/pull/conditional injekter; E‑06 GIS och COP; E‑01 versionshantering; E‑18 observability.

**PI 3 – Kommunikation och integration (månad 6–9).** E‑07 simulerad samverkansradio (generisk), sociala medier, 112-sim, säker chat; E‑08 WIS-integration, SITHS; E‑12 NIS2- och GDPR-modul.

**PI 4 – Säkerhet, AI v1 och skalning (månad 9–12).** E‑10 ABAC + watermarking + DLP; E‑13 scenarioassistent (utkast); E‑14 AAR-generator (utkast); E‑17 offline-läge v1; ISO 27001-certifiering.

**PI 5 – Förmågeobservatorium och DORA (månad 12–15).** E‑15 nationell förmågedashboard; DORA TLPT-scenarier; ISO 22301- och ISO 27701-certifiering.

**PI 6 – Storskalig övning och resiliens (månad 15–18).** E‑17 fältcontainer-deployment, mesh/LoRa, Starlink; E‑18 multi-region failover.

**PI 7 – Marknadsexpansion (månad 18–21).** Norden-expansion (Finland, Norge); engelskt UI; SOC 2 Type II.

---

> **Not:** Detta är en sammanfattad version av kravspecifikationen.
> Den fullständiga specifikationen (~12 000 ord) med alla user stories,
> acceptance criteria, promptmallar och PI-detaljer ligger som
> arbetsdokument hos produktteamet.
