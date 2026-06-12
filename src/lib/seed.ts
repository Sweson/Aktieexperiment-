import type Database from "better-sqlite3";

/**
 * Demodata baserad på metodhandbokens genomgående praktikfall:
 * temat "Kapacitet för elektrifieringen" med förmågorna
 * Anslutningshantering och Nätplanering, samt två kompletterande teman.
 */
export function seed(db: Database.Database) {
  const tx = db.transaction(() => {
    // ---- Organisation -------------------------------------------------
    const ous = [
      ["Kund och marknad", "KM"],
      ["Nät", "NÄT"],
      ["Drift", "DRIFT"],
      ["Digitalisering", "DIGI"],
      ["Ekonomi och stab", "EKO"],
    ];
    const insOu = db.prepare("INSERT INTO ous (name, short) VALUES (?, ?)");
    const ouId: Record<string, number> = {};
    for (const [name, short] of ous) ouId[short] = Number(insOu.run(name, short).lastInsertRowid);

    const insUser = db.prepare("INSERT INTO users (name, role, ou_id) VALUES (?, ?, ?)");
    const uid: Record<string, number> = {};
    uid.eva = Number(insUser.run("Eva Lind", "VD / DEMT-ordförande", null).lastInsertRowid);
    uid.anna = Number(insUser.run("Anna Berg", "OU-chef Kund och marknad / DEMT", ouId.KM).lastInsertRowid);
    uid.johan = Number(insUser.run("Johan Ek", "OU-chef Nät / DEMT", ouId["NÄT"]).lastInsertRowid);
    uid.sara = Number(insUser.run("Sara Holm", "OU-chef Drift / DEMT", ouId.DRIFT).lastInsertRowid);
    uid.maria = Number(insUser.run("Maria Sjö", "OU-chef Digitalisering / DEMT", ouId.DIGI).lastInsertRowid);
    uid.per = Number(insUser.run("Per Nord", "PMO / portföljledning", ouId.DIGI).lastInsertRowid);
    uid.lisa = Number(insUser.run("Lisa Vik", "Temakoordinator", ouId.KM).lastInsertRowid);
    uid.omar = Number(insUser.run("Omar Hassan", "Verksamhetsarkitekt", ouId.DIGI).lastInsertRowid);
    uid.karin = Number(insUser.run("Karin Falk", "Temakoordinator", ouId.DRIFT).lastInsertRowid);
    uid.nils = Number(insUser.run("Nils Åkesson", "Controller", ouId.EKO).lastInsertRowid);

    // ---- Kompetensområden och kapacitet -------------------------------
    const insComp = db.prepare("INSERT INTO competences (name) VALUES (?)");
    const comp: Record<string, number> = {};
    for (const c of ["Nätanalytiker", "Beredare", "Integrationsutvecklare", "OT-ingenjör", "Dataingenjör", "Projektledare", "Förändringsledare"])
      comp[c] = Number(insComp.run(c).lastInsertRowid);

    const quarters = ["2026-Q3", "2026-Q4", "2027-Q1", "2027-Q2"];
    const insCap = db.prepare("INSERT INTO ou_capacity (ou_id, competence_id, quarter, hours) VALUES (?, ?, ?, ?)");
    const capacity: [string, string, number][] = [
      ["KM", "Beredare", 1400], ["KM", "Projektledare", 900], ["KM", "Förändringsledare", 500],
      ["NÄT", "Nätanalytiker", 1100], ["NÄT", "Beredare", 1600], ["NÄT", "Projektledare", 1100],
      ["DRIFT", "OT-ingenjör", 900], ["DRIFT", "Nätanalytiker", 400], ["DRIFT", "Projektledare", 600],
      ["DIGI", "Integrationsutvecklare", 1300], ["DIGI", "Dataingenjör", 1000], ["DIGI", "Projektledare", 800],
    ];
    for (const q of quarters) for (const [ou, c, h] of capacity) insCap.run(ouId[ou], comp[c], q, h);

    // ---- Förmågekartan (TOGAF nivå 1–2) --------------------------------
    const areas: [string, string[]][] = [
      ["Kund och anslutning", ["Anslutningshantering", "Kundkommunikation", "Avtalshantering", "Flexibilitetstjänster"]],
      ["Nätutveckling", ["Nätplanering", "Investeringsplanering", "Tillstånd och markåtkomst", "Projektgenomförande"]],
      ["Tillgångsförvaltning", ["Anläggningsinformation", "Underhållsstyrning", "Tillståndsbedömning", "Reinvesteringsplanering"]],
      ["Nätdrift", ["Driftövervakning och styrning", "Avbrottshantering", "Driftplanering", "Beredskap och krishantering"]],
      ["Mätning och avräkning", ["Mätvärdesinsamling", "Mätvärdeskvalitet", "Avräkning och rapportering"]],
      ["Data och digitalisering", ["Dataförvaltning", "Analys och AI", "Integrationsförmåga", "Digitala kanaler"]],
      ["Säkerhet och regelefterlevnad", ["Informationssäkerhet och OT-säkerhet", "Säkerhetsskydd", "Regulatorisk efterlevnad", "Riskhantering"]],
      ["Verksamhetsstöd", ["Kompetensförsörjning", "Inköp och leverantörsstyrning", "Ekonomistyrning", "Portfölj- och projektstyrning"]],
    ];
    const insArea = db.prepare("INSERT INTO capability_areas (name, sort) VALUES (?, ?)");
    const insCapb = db.prepare("INSERT INTO capabilities (area_id, name) VALUES (?, ?)");
    const capb: Record<string, number> = {};
    areas.forEach(([area, caps], i) => {
      const aid = Number(insArea.run(area, i).lastInsertRowid);
      for (const c of caps) capb[c] = Number(insCapb.run(aid, c).lastInsertRowid);
    });

    // ---- Grundkartor ---------------------------------------------------
    const insProc = db.prepare("INSERT INTO processes (name, owner) VALUES (?, ?)");
    const proc: Record<string, number> = {};
    for (const [n, o] of [
      ["Anslutningsprocess storkund", "KM"], ["Anslutningsprocess standardärende (<63A)", "KM"],
      ["Offert- och avtalsprocess", "KM"], ["Nätkapacitetsanalys", "NÄT"],
      ["Avbrottsprocess", "DRIFT"], ["Mätvärde-till-faktura", "KM"],
    ] as const) proc[n] = Number(insProc.run(n, o).lastInsertRowid);

    const insInfo = db.prepare("INSERT INTO info_objects (name, classification, quality) VALUES (?, ?, ?)");
    const info: Record<string, number> = {};
    for (const [n, k, q] of [
      ["Nätkapacitetsdata", "C2", "Brister: ej digitalt tillgänglig för offertberedning"],
      ["Kundärende", "C2", "God"], ["Anläggningsdata (masterdata)", "C2", "Ofullständig täckning region nord"],
      ["Avtal (masterdata)", "C2", "God"], ["Mätvärden", "C2", "God"],
    ] as const) info[n] = Number(insInfo.run(n, k, q).lastInsertRowid);

    const insSys = db.prepare("INSERT INTO systems (name, lifecycle, debt) VALUES (?, ?, ?)");
    const sys: Record<string, number> = {};
    for (const [n, l, d] of [
      ["Ärendehanteringssystem", "Aktiv", "Begränsad automationstakhöjd"],
      ["GIS/NIS", "Aktiv", "Integrationsskuld mot offertstöd"],
      ["Kundportal", "Aktiv", ""], ["Avtalssystem", "Aktiv", ""],
      ["SCADA/DMS", "Aktiv", "OT-segmentering pågår"], ["MDM (mätvärdessystem)", "Aktiv", ""],
    ] as const) sys[n] = Number(insSys.run(n, l, d).lastInsertRowid);

    const mp = db.prepare("INSERT INTO map_capability_process (capability_id, process_id) VALUES (?, ?)");
    const mi = db.prepare("INSERT INTO map_capability_info (capability_id, info_id) VALUES (?, ?)");
    const ms = db.prepare("INSERT INTO map_capability_system (capability_id, system_id) VALUES (?, ?)");
    const mo = db.prepare("INSERT INTO map_capability_ou (capability_id, ou_id, role) VALUES (?, ?, ?)");
    // Anslutningshantering – exempel ur handbokens tabell 5
    mp.run(capb["Anslutningshantering"], proc["Anslutningsprocess storkund"]);
    mp.run(capb["Anslutningshantering"], proc["Anslutningsprocess standardärende (<63A)"]);
    mp.run(capb["Anslutningshantering"], proc["Offert- och avtalsprocess"]);
    mi.run(capb["Anslutningshantering"], info["Nätkapacitetsdata"]);
    mi.run(capb["Anslutningshantering"], info["Kundärende"]);
    mi.run(capb["Anslutningshantering"], info["Anläggningsdata (masterdata)"]);
    mi.run(capb["Anslutningshantering"], info["Avtal (masterdata)"]);
    ms.run(capb["Anslutningshantering"], sys["Ärendehanteringssystem"]);
    ms.run(capb["Anslutningshantering"], sys["GIS/NIS"]);
    ms.run(capb["Anslutningshantering"], sys["Kundportal"]);
    ms.run(capb["Anslutningshantering"], sys["Avtalssystem"]);
    mo.run(capb["Anslutningshantering"], ouId.KM, "Ärende och avtal");
    mo.run(capb["Anslutningshantering"], ouId["NÄT"], "Beredning och kapacitet");
    mo.run(capb["Anslutningshantering"], ouId.DIGI, "System och data");
    mp.run(capb["Nätplanering"], proc["Nätkapacitetsanalys"]);
    mi.run(capb["Nätplanering"], info["Nätkapacitetsdata"]);
    ms.run(capb["Nätplanering"], sys["GIS/NIS"]);
    mo.run(capb["Nätplanering"], ouId["NÄT"], "Utförande");
    mo.run(capb["Flexibilitetstjänster"], ouId.KM, "Avtal och marknad");
    mo.run(capb["Flexibilitetstjänster"], ouId.DRIFT, "Aktivering i drift");
    mo.run(capb["Dataförvaltning"], ouId.DIGI, "Plattform och styrning");
    mo.run(capb["Integrationsförmåga"], ouId.DIGI, "Utförande");
    mo.run(capb["Tillstånd och markåtkomst"], ouId["NÄT"], "Utförande");
    mo.run(capb["Driftövervakning och styrning"], ouId.DRIFT, "Utförande");
    mi.run(capb["Dataförvaltning"], info["Anläggningsdata (masterdata)"]);
    mi.run(capb["Dataförvaltning"], info["Nätkapacitetsdata"]);
    ms.run(capb["Driftövervakning och styrning"], sys["SCADA/DMS"]);
    mp.run(capb["Avbrottshantering"], proc["Avbrottsprocess"]);
    mo.run(capb["Avbrottshantering"], ouId.DRIFT, "Utförande");
    mp.run(capb["Mätvärdesinsamling"], proc["Mätvärde-till-faktura"]);
    mi.run(capb["Mätvärdesinsamling"], info["Mätvärden"]);
    ms.run(capb["Mätvärdesinsamling"], sys["MDM (mätvärdessystem)"]);

    // ---- Teman ---------------------------------------------------------
    const insTheme = db.prepare(`INSERT INTO themes
      (name, objective, why_now, status, priority_rank, owner_id, coordinator_id, mandate, resources, decided_at, review_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const t1 = Number(insTheme.run(
      "Kapacitet för elektrifieringen",
      "Vi möter elektrifieringens anslutnings- och kapacitetsbehov så snabbt att nätet aldrig är skälet till att en kunds omställning försenas.",
      "Elektrifieringen av industri och transporter ger kraftigt ökade anslutningsvolymer; ledtider och kapacitetsbrist riskerar kunders omställning och bolagets åtaganden.",
      "beslutad", 1, uid.anna, uid.lisa,
      "Omfördela inom temats ram upp till 5 MSEK/kvartal; vägval mellan OU:er inom temat. Jäv: vägval som rör egen OU lyfts till DEMT.",
      "Temakoordinator 80 % (Lisa Vik), arkitektstöd 40 %, utredningsram 1,5 MSEK",
      "2026-04-15", "2027-04-30"
    ).lastInsertRowid);
    const t2 = Number(insTheme.run(
      "Effektiv och datadriven nätdrift",
      "Vi styr nätet proaktivt på data: färre och kortare avbrott för kund, och full nytta av flexibilitet i driften.",
      "Stigande avbrottskostnader och kvalitetsincitament i Ei-regleringen; flexibilitetsresurser kräver datadriven driftledning.",
      "beslutad", 2, uid.sara, uid.karin,
      "Omfördela inom temats ram upp till 3 MSEK/kvartal.",
      "Temakoordinator 60 % (Karin Falk), arkitektstöd 20 %",
      "2026-04-15", "2027-04-30"
    ).lastInsertRowid);
    const t3 = Number(insTheme.run(
      "Datadriven tillgångsförvaltning",
      "Vi reinvesterar där det gör störst nytta: tillståndsbaserat, datadrivet och spårbart mot risk och intäktsram.",
      "Åldrande anläggningsbestånd och begränsad intäktsram kräver träffsäker reinvesteringsprioritering.",
      "beslutad", 3, uid.maria, null,
      "Omfördela inom temats ram upp till 2 MSEK/kvartal.",
      "Arkitektstöd 20 %; temakoordinator ej utsedd",
      "2026-04-15", "2027-04-30"
    ).lastInsertRowid);
    insTheme.run(
      "Kundupplevelse i toppklass",
      "Vi gör varje kundmöte enkelt, digitalt och proaktivt.",
      "Kandidat från temaworkshop 2026 – ej prioriterad i årets temarangordning; omprövas vid nästa temaöversyn.",
      "utkast", null, null, null, "", "", null, null
    );

    // ---- Key Results ---------------------------------------------------
    const insKr = db.prepare(`INSERT INTO key_results
      (theme_id, title, baseline, target, unit, deadline, source, frequency, is_customer_value, direction)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const kr1 = Number(insKr.run(t1, "Medianledtid komplett anslutningsförfrågan (>1 MW) till bindande offert", 9, 4, "mån", "2026-Q4", "Ärendehanteringssystem", "Månadsvis", 1, "down").lastInsertRowid);
    const kr2 = Number(insKr.run(t1, "Andel standardärenden (<63 A) helt digitalt utan manuell beredning", 15, 70, "%", "2026-Q4", "Ärendehanteringssystem", "Månadsvis", 0, "up").lastInsertRowid);
    const kr3 = Number(insKr.run(t1, "Frigjord nätkapacitet via flexibilitet och villkorade avtal i kapacitetsbristområden", 0, 220, "MW", "2027-Q4", "Avtalsregister + driftdata", "Kvartalsvis", 1, "up").lastInsertRowid);
    const kr4 = Number(insKr.run(t1, "Kundnöjdhet i anslutningsprocessen (NKI, segment företag)", 58, 70, "NKI", "2026-Q4", "NKI-mätning", "Kvartalsvis", 1, "up").lastInsertRowid);
    const kr5 = Number(insKr.run(t2, "Kundavbrottstid (SAIDI) i landsbygdsnät", 210, 150, "min/år", "2027-Q4", "Avbrottsstatistik (DARWin)", "Kvartalsvis", 1, "down").lastInsertRowid);
    const kr6 = Number(insKr.run(t2, "Andel fjärrstyrda nätstationer i prioriterade ledningssträckor", 40, 70, "%", "2027-Q2", "Anläggningsregister", "Kvartalsvis", 0, "up").lastInsertRowid);
    const kr7 = Number(insKr.run(t3, "Andel reinvesteringsbeslut baserade på tillståndsdata", 25, 80, "%", "2027-Q2", "Beslutslogg reinvestering", "Kvartalsvis", 0, "up").lastInsertRowid);
    Number(insKr.run(t3, "Oplanerade avbrott orsakade av komponentfel i riskklassade anläggningar", 100, 70, "index", "2027-Q4", "Avbrottsstatistik", "Kvartalsvis", 1, "down").lastInsertRowid);

    const insM = db.prepare("INSERT INTO kr_measurements (kr_id, date, actual, forecast, rag, comment) VALUES (?, ?, ?, ?, ?, ?)");
    insM.run(kr1, "2026-03-31", 8.5, 5.0, "grön", "Parallellisering påbörjad");
    insM.run(kr1, "2026-04-30", 8.0, 5.0, "grön", "");
    insM.run(kr1, "2026-05-31", 7.5, 4.5, "gul", "Inhyrda nätanalytiker sex veckor sena – delmål flyttat ett kvartal, slutmål kvarstår. Åtgärdsplan beslutad av temaägare.");
    insM.run(kr2, "2026-03-31", 22, 60, "gul", "Automationsflöde i pilot");
    insM.run(kr2, "2026-04-30", 31, 65, "grön", "");
    insM.run(kr2, "2026-05-31", 43, 70, "grön", "Delmål 1 verifierat: 43 % mot mål 40 %");
    insM.run(kr3, "2026-03-31", 0, 180, "röd", "OU Drifts flexinitiativ saknar committed bemanning – lucka lyft till DEMT");
    insM.run(kr3, "2026-05-31", 15, 220, "gul", "DEMT har justerat ambitionen 300→220 MW (dokumenterat vägval); pilotavtal tecknade");
    insM.run(kr4, "2026-03-31", 59, 66, "gul", "");
    insM.run(kr4, "2026-05-31", 61, 68, "grön", "Förbättrad ärendestatus-kommunikation ger effekt");
    insM.run(kr5, "2026-05-31", 205, 175, "gul", "Fjärrstyrningsutbyggnad enligt plan men vegetationsår påverkar");
    insM.run(kr6, "2026-05-31", 46, 68, "grön", "");
    insM.run(kr7, "2026-05-31", 30, 55, "gul", "Datainsamling tillståndsdata försenad i region nord");

    // ---- Heatmap (steg 3) ----------------------------------------------
    const insHeat = db.prepare(`INSERT INTO heatmap (theme_id, capability_id, criticality, movement, motivation, to_gap, exclusion_motive) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    insHeat.run(t1, capb["Anslutningshantering"], "Kritisk", "Förbättra", "Bär KR1, KR2 och KR4. OU Kund och marknad samt OU Nät.", 1, "");
    insHeat.run(t1, capb["Nätplanering"], "Kritisk", "Förbättra", "Bär KR1 och KR3. OU Nät.", 1, "");
    insHeat.run(t1, capb["Flexibilitetstjänster"], "Kritisk", "Bygga ny", "Bär KR3. Förmågan saknas i dag. OU Kund och marknad, OU Drift.", 1, "");
    insHeat.run(t1, capb["Tillstånd och markåtkomst"], "Viktig", "Förbättra", "Påverkar KR1 för storkundsärenden med nätförstärkning.", 1, "");
    insHeat.run(t1, capb["Dataförvaltning"], "Viktig", "Förbättra", "Förutsättning för KR2 – kapacitets- och anläggningsdata.", 1, "");
    insHeat.run(t1, capb["Integrationsförmåga"], "Viktig", "Förbättra", "KR2 kräver integration ärendeflöde–GIS/NIS–kundportal.", 1, "");
    insHeat.run(t1, capb["Projektgenomförande"], "Stödjande", "Utnyttja", "", 0, "Tillräcklig nivå; bevakas som kapacitetsrisk i steg 6 i stället för gap-analys.");
    insHeat.run(t1, capb["Kundkommunikation"], "Stödjande", "Utnyttja", "", 0, "Befintlig förmåga räcker för temats KR; förbättringar tas i linjen.");
    insHeat.run(t1, capb["Avtalshantering"], "Stödjande", "Utnyttja", "", 0, "Villkorade avtal hanteras inom Flexibilitetstjänster.");
    insHeat.run(t2, capb["Driftövervakning och styrning"], "Kritisk", "Förbättra", "Bär KR5 och KR6.", 1, "");
    insHeat.run(t2, capb["Avbrottshantering"], "Kritisk", "Förbättra", "Bär KR5.", 1, "");
    insHeat.run(t2, capb["Analys och AI"], "Viktig", "Bygga ny", "Prognos- och felanalysförmåga.", 1, "");
    insHeat.run(t2, capb["Flexibilitetstjänster"], "Viktig", "Bygga ny", "Delad förmåga med tema 1 – aktivering i drift.", 0, "Gap-analyseras under tema 1; beroendet följs i konsolideringen.");
    insHeat.run(t3, capb["Tillståndsbedömning"], "Kritisk", "Förbättra", "Bär KR7.", 1, "");
    insHeat.run(t3, capb["Anläggningsinformation"], "Kritisk", "Förbättra", "Masterdata anläggning är grundförutsättning.", 1, "");
    insHeat.run(t3, capb["Reinvesteringsplanering"], "Viktig", "Förbättra", "Beslutsprocess och prioriteringsmodell.", 1, "");

    // ---- Gap (steg 4) ----------------------------------------------------
    const insGap = db.prepare("INSERT INTO gaps (theme_id, capability_id, title, description, classification, status) VALUES (?, ?, ?, ?, ?, ?)");
    const insGapKr = db.prepare("INSERT INTO gap_krs (gap_id, kr_id) VALUES (?, ?)");
    const insDim = db.prepare("INSERT INTO gap_dimensions (gap_id, dimension, current, target, motivation) VALUES (?, ?, ?, ?, ?)");
    const insDep = db.prepare("INSERT INTO gap_dependencies (gap_id, depends_on_gap_id, note) VALUES (?, ?, ?)");

    const g1 = Number(insGap.run(t1, capb["Anslutningshantering"], "Sekventiell storkundsberedning med köbildning",
      "Beredning av storkundsärenden sker sekventiellt mellan tre enheter med köbildning mellan stegen. Förmågan saknar parallelliserat arbetssätt med gemensam ärendebild.", "Måste", "öppet").lastInsertRowid);
    insGapKr.run(g1, kr1);
    insDim.run(g1, "Process", 2, 4, "Sekventiell hantering, omarbete vid kompletteringar, ingen gemensam kö");
    insDim.run(g1, "Organisation och kompetens", 2, 3, "Beredningskompetens koncentrerad till fyra nyckelpersoner");
    insDim.run(g1, "Styrning", 2, 4, "Ledtid mäts inte per beredningssteg");

    const g2 = Number(insGap.run(t1, capb["Anslutningshantering"], "Nätkapacitetsdata ej digitalt tillgänglig för offertberedning",
      "Förmågan saknar digital åtkomst till aktuell nätkapacitetsdata i offertflödet; kapacitetsbedömning kräver manuell förfrågan till nätanalys.", "Måste", "öppet").lastInsertRowid);
    insGapKr.run(g2, kr1); insGapKr.run(g2, kr2);
    insDim.run(g2, "Information och data", 1, 4, "Kapacitetsdata finns endast i beräkningsmiljö, ej åtkomlig i ärendeflödet; oklart dataägarskap");
    insDim.run(g2, "Teknik och system", 2, 4, "Integration GIS/NIS–ärendesystem saknas");

    const g3 = Number(insGap.run(t1, capb["Anslutningshantering"], "Standardärenden saknar automatiserat flöde",
      "Förmågan saknar automatiserat genomflöde för standardärenden < 63 A; samtliga ärenden kräver manuell beredning.", "Måste", "öppet").lastInsertRowid);
    insGapKr.run(g3, kr2);
    insDim.run(g3, "Process", 2, 4, "Standardärenden följer samma flöde som komplexa ärenden");
    insDim.run(g3, "Teknik och system", 2, 4, "Regelmotor och automatiska kontroller saknas i befintlig plattform");

    const g4 = Number(insGap.run(t1, capb["Anslutningshantering"], "Koncentrerat nyckelpersonberoende i beredning",
      "Beredningskompetens för storkundsärenden är koncentrerad till fyra nyckelpersoner; förmågan saknar redundans och strukturerad kompetensbreddning.", "Bör", "öppet").lastInsertRowid);
    insGapKr.run(g4, kr1);
    insDim.run(g4, "Organisation och kompetens", 2, 4, "Fyra nyckelpersoner; ingen dokumenterad beredningsstandard för komplexa fall");

    const g5 = Number(insGap.run(t1, capb["Anslutningshantering"], "Mätentreprenörens SLA matchar inte målledtiden",
      "Leverantörsledets åtaganden för mätarbyte/anslutningspunkt är dimensionerade för dagens ledtid, inte målets.", "Bör", "öppet").lastInsertRowid);
    insGapKr.run(g5, kr1);
    insDim.run(g5, "Partner och leverantör", 2, 4, "SLA 8 veckor mot behov 3 veckor; omförhandling möjlig vid avtalsfönster Q1 2027");

    const g6 = Number(insGap.run(t1, capb["Nätplanering"], "Manuell och reaktiv nätkapacitetsanalys",
      "Förmågan saknar löpande, scenariobaserad kapacitetsanalys; analyser görs manuellt per förfrågan med veckors ledtid.", "Måste", "öppet").lastInsertRowid);
    insGapKr.run(g6, kr1); insGapKr.run(g6, kr3);
    insDim.run(g6, "Process", 2, 4, "Analys per ärende i stället för rullande områdesanalys");
    insDim.run(g6, "Teknik och system", 2, 4, "Beräkningar i lokala verktyg utan koppling till GIS/NIS-masterdata");
    insDim.run(g6, "Organisation och kompetens", 2, 3, "Nätanalytikerkapacitet under efterfrågan – flaskhals");

    const g7 = Number(insGap.run(t1, capb["Flexibilitetstjänster"], "Förmåga att teckna och aktivera villkorade avtal saknas",
      "Verksamheten saknar i dag förmåga att erbjuda, teckna och i drift aktivera villkorade anslutningsavtal och flexibilitetstjänster.", "Måste", "öppet").lastInsertRowid);
    insGapKr.run(g7, kr3);
    insDim.run(g7, "Process", 1, 3, "Process för villkorade avtal saknas");
    insDim.run(g7, "Teknik och system", 1, 3, "Ingen plattform för aktivering/avrop i driften");
    insDim.run(g7, "Styrning", 1, 3, "Otydligt regelverksstöd – kräver juridisk och regulatorisk beredning");
    insDim.run(g7, "Partner och leverantör", 1, 3, "Aggregatorsmarknaden omogen – avtalsmodeller saknas");

    const g8 = Number(insGap.run(t1, capb["Dataförvaltning"], "Ofullständig masterdata för anläggning och kapacitet",
      "Masterdata för anläggning och nätkapacitet saknar full täckning och tydligt dataägarskap, vilket blockerar digital kapacitetskarta och automation.", "Bör", "öppet").lastInsertRowid);
    insGapKr.run(g8, kr2);
    insDim.run(g8, "Information och data", 2, 4, "Täckningsgrad 78 % region nord; dataägarskap beslutat men ej bemannat");
    insDim.run(g8, "Styrning", 2, 3, "Datakvalitet mäts inte löpande");

    const g9 = Number(insGap.run(t2, capb["Driftövervakning och styrning"], "Begränsad fjärrstyrning i prioriterade sträckor",
      "Förmågan att sektionera och styra om nätet på distans täcker 40 % av prioriterade ledningssträckor.", "Måste", "öppet").lastInsertRowid);
    insGapKr.run(g9, kr5); insGapKr.run(g9, kr6);
    insDim.run(g9, "Teknik och system", 2, 4, "Fjärrstyrda frånskiljare saknas i 60 % av prioriterade sträckor");
    insDim.run(g9, "Organisation och kompetens", 3, 4, "OT-ingenjörskapacitet begränsad");

    const g10 = Number(insGap.run(t3, capb["Anläggningsinformation"], "Tillståndsdata saknas för riskklassade anläggningar",
      "Förmågan saknar systematisk insamling av tillståndsdata för riskklassade anläggningstyper.", "Måste", "öppet").lastInsertRowid);
    insGapKr.run(g10, kr7);
    insDim.run(g10, "Information och data", 2, 4, "Tillståndsdata finns för 25 % av riskklassade anläggningar");
    insDim.run(g10, "Process", 2, 3, "Besiktningsdata fångas på papper i region nord");

    insDep.run(g2, g8, "Digital kapacitetskarta kräver masterdata anläggning/kapacitet");
    insDep.run(g3, g2, "Automatiserat standardflöde kräver digital kapacitetsdata");
    insDep.run(g7, g6, "Villkorade avtal kräver löpande kapacitetsanalys per område");
    insDep.run(g9, g10, "Prioritering av fjärrstyrning använder samma tillstånds-/anläggningsdata");

    // ---- Initiativ (steg 5) ----------------------------------------------
    const insInit = db.prepare(`INSERT INTO initiatives
      (name, ou_id, owner, description, status, start_quarter, end_quarter, ownership, ext_cost,
       business_value, time_criticality, risk_reduction, job_size, benefit_logic)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insIg = db.prepare("INSERT INTO initiative_gaps (initiative_id, gap_id) VALUES (?, ?)");
    const insMil = db.prepare("INSERT INTO milestones (initiative_id, title, due_quarter, status, verified_by, outcome) VALUES (?, ?, ?, ?, ?, ?)");
    const insRes = db.prepare("INSERT INTO initiative_resources (initiative_id, competence_id, quarter, hours) VALUES (?, ?, ?, ?)");
    const insMir = db.prepare("INSERT INTO mirror_commitments (initiative_id, ou_id, description, due_quarter, status, competence_id, hours) VALUES (?, ?, ?, ?, ?, ?, ?)");

    const k1 = Number(insInit.run("K1 Digital kapacitetskarta i offertflödet", ouId.KM, "Jonas Pile",
      "Gör nätkapacitetsdata digitalt tillgänglig i offertberedningen. Increment 1: läsåtkomst för beredare. Increment 2: integrerad kapacitetskarta i offertstödet.",
      "committed", "2026-Q3", "2027-Q1", "ou", 1.2, 9, 8, 6, 5,
      "KR1: −1,5 mån medianledtid genom direkt kapacitetsbesked. KR2: förutsättning för automation.").lastInsertRowid);
    insIg.run(k1, g2);
    insMil.run(k1, "Beredare har läsåtkomst till kapacitetsdata i ärendeflödet", "2026-Q3", "på plan", "", "");
    insMil.run(k1, "Kapacitetskarta integrerad i offertstöd – kapacitetsbesked < 1 dag", "2027-Q1", "ej påbörjad", "", "");
    insRes.run(k1, comp["Integrationsutvecklare"], "2026-Q3", 300);
    insRes.run(k1, comp["Beredare"], "2026-Q3", 100);
    insRes.run(k1, comp["Integrationsutvecklare"], "2026-Q4", 300);
    insMir.run(k1, ouId.DIGI, "Integrationstjänst GIS/NIS → ärendesystem, drift och förvaltning", "2026-Q4", "committed", comp["Integrationsutvecklare"], 400);
    insMir.run(k1, ouId["NÄT"], "Kvalitetssäkrad kapacitetsdata per nätområde (datadefinition + leverans)", "2026-Q3", "committed", comp["Nätanalytiker"], 150);

    const k2 = Number(insInit.run("K2 Automatiserat standardflöde < 63 A", ouId.KM, "Sofia Lindqvist",
      "Automation av standardärenden i befintlig ärendeplattform enligt DEMT:s vägvalsbeslut. Regelmotor, automatiska kontroller och digital signering.",
      "committed", "2026-Q1", "2026-Q4", "ou", 2.0, 10, 9, 5, 6,
      "KR2: 15→70 % helautomatiska ärenden. KR4: snabbare besked höjer NKI.").lastInsertRowid);
    insIg.run(k2, g3);
    insMil.run(k2, "40 % av standardärenden flödar automatiskt", "2026-Q2", "uppnådd", "Lisa Vik (temakoordinator)", "Verifierat utfall 43 % – mätt i ärendesystemet maj 2026");
    insMil.run(k2, "70 % av standardärenden flödar automatiskt", "2026-Q4", "på plan", "", "");
    insRes.run(k2, comp["Integrationsutvecklare"], "2026-Q3", 250);
    insRes.run(k2, comp["Förändringsledare"], "2026-Q3", 120);
    insRes.run(k2, comp["Förändringsledare"], "2026-Q4", 120);

    const k3 = Number(insInit.run("K3 Parallelliserad storkundsberedning", ouId.KM, "Henrik Modig",
      "Processinitiativ med linjeuppdrag: parallell beredning med gemensam ärendebild, beredningsstandard och kompetensbreddning (ADKAR-baserad förändringsledning).",
      "committed", "2026-Q1", "2027-Q1", "ou", 2.1, 9, 8, 7, 7,
      "KR1: median 9→4 mån. Reducerat nyckelpersonberoende (G4).").lastInsertRowid);
    insIg.run(k3, g1); insIg.run(k3, g4);
    insMil.run(k3, "Medianledtid 6 månader", "2026-Q3", "risk", "", "Inhyrda nätanalytiker sex veckor sena – delmål flyttat ett kvartal med bibehållet slutmål (beslut temaägare)");
    insMil.run(k3, "Medianledtid 4 månader", "2026-Q4", "på plan", "", "");
    insMil.run(k3, "Åtta beredare certifierade enligt ny beredningsstandard", "2026-Q4", "på plan", "", "");
    insRes.run(k3, comp["Beredare"], "2026-Q3", 500);
    insRes.run(k3, comp["Nätanalytiker"], "2026-Q3", 300);
    insRes.run(k3, comp["Förändringsledare"], "2026-Q3", 150);
    insRes.run(k3, comp["Beredare"], "2026-Q4", 400);
    insRes.run(k3, comp["Nätanalytiker"], "2026-Q4", 200);

    const k4 = Number(insInit.run("K4 Omförhandlat mätentreprenörs-SLA", ouId.KM, "Sofia Lindqvist",
      "Omförhandling av entreprenörs-SLA för mätarbyte och anslutningspunkt vid avtalsfönster.",
      "planned", "2027-Q1", "2027-Q2", "ou", 0.3, 6, 7, 4, 2,
      "KR1: −0,5 mån i slutledet av anslutningsflödet.").lastInsertRowid);
    insIg.run(k4, g5);
    insMil.run(k4, "Nytt SLA 3 veckor signerat", "2027-Q1", "ej påbörjad", "", "");

    const n1 = Number(insInit.run("N1 Förstärkningspaket kapacitetsbristområden", ouId["NÄT"], "Petra Ahl",
      "Riktade nätförstärkningar i utpekade kapacitetsbristområden, samordnade med flexlösningar.",
      "committed", "2026-Q2", "2027-Q2", "ou", 38, 8, 8, 8, 9,
      "KR1/KR3: möjliggör anslutning i bristområden där flex inte räcker.").lastInsertRowid);
    insIg.run(n1, g6);
    insMil.run(n1, "Förstärkning etapp 1 driftsatt (område Syd-3)", "2026-Q4", "på plan", "", "");
    insMil.run(n1, "Förstärkning etapp 2 driftsatt (område Nord-1)", "2027-Q2", "ej påbörjad", "", "");
    insRes.run(n1, comp["Nätanalytiker"], "2026-Q3", 700);
    insRes.run(n1, comp["Projektledare"], "2026-Q3", 500);
    insRes.run(n1, comp["Nätanalytiker"], "2026-Q4", 500);
    insRes.run(n1, comp["Projektledare"], "2026-Q4", 500);

    const n2 = Number(insInit.run("N2 Automatiserad nätkapacitetsanalys", ouId["NÄT"], "Ali Reza",
      "Rullande, scenariobaserad kapacitetsanalys per nätområde, kopplad till GIS/NIS-masterdata. Levererar datagrunden till K1.",
      "committed", "2026-Q3", "2027-Q2", "ou", 3.5, 8, 7, 7, 6,
      "KR1: kapacitetsbesked på dagar i stället för veckor. KR3: identifierar flexpotential per område.").lastInsertRowid);
    insIg.run(n2, g6); insIg.run(n2, g2);
    insMil.run(n2, "Rullande områdesanalys i drift för tre pilotområden", "2026-Q4", "på plan", "", "");
    insMil.run(n2, "Samtliga kapacitetsbristområden analyseras rullande", "2027-Q2", "ej påbörjad", "", "");
    insRes.run(n2, comp["Nätanalytiker"], "2026-Q3", 400);
    insRes.run(n2, comp["Dataingenjör"], "2026-Q3", 200);
    insRes.run(n2, comp["Nätanalytiker"], "2026-Q4", 300);

    const d1 = Number(insInit.run("D1 Flexibilitetsplattform och villkorade avtal", ouId.DRIFT, "Ej bemannad",
      "Bygga förmågan att teckna och i drift aktivera villkorade avtal och flexibilitetstjänster. Vägval köpa/bygga plattform är öppet.",
      "planned", "2026-Q4", "2027-Q4", "ou", 6.0, 9, 7, 8, 8,
      "KR3: +220 MW frigjord kapacitet. Utan committed bemanning bär ingen KR3 – lucka lyft till DEMT.").lastInsertRowid);
    insIg.run(d1, g7);
    insMil.run(d1, "Tio pilotavtal villkorad anslutning tecknade", "2027-Q1", "ej påbörjad", "", "");
    insMil.run(d1, "Aktivering via driftcentral i skarp drift", "2027-Q3", "ej påbörjad", "", "");

    const dg1 = Number(insInit.run("DG1 Masterdata anläggning och kapacitet", ouId.DIGI, "Mei Chen",
      "Enabler: komplett masterdata för anläggning/kapacitet med bemannat dataägarskap och löpande kvalitetsmätning.",
      "committed", "2026-Q2", "2026-Q4", "ou", 1.0, 7, 8, 6, 4,
      "Förutsättning för K1, K2 och N2 (delad datagrund – även tema Effektiv nätdrift).").lastInsertRowid);
    insIg.run(dg1, g8);
    insMil.run(dg1, "Täckningsgrad masterdata 95 % i kapacitetsbristområden", "2026-Q4", "på plan", "", "");
    insRes.run(dg1, comp["Dataingenjör"], "2026-Q3", 400);
    insRes.run(dg1, comp["Dataingenjör"], "2026-Q4", 300);

    const dr1 = Number(insInit.run("DR1 Fjärrstyrning prioriterade sträckor", ouId.DRIFT, "Lars Vall",
      "Utbyggnad av fjärrstyrda frånskiljare och sektionering i prioriterade landsbygdssträckor.",
      "committed", "2026-Q1", "2027-Q2", "ou", 14, 8, 7, 8, 7,
      "KR5/KR6: kortare avbrott via snabb omkoppling.").lastInsertRowid);
    insIg.run(dr1, g9);
    insMil.run(dr1, "55 % av prioriterade sträckor fjärrstyrda", "2026-Q4", "på plan", "", "");
    insMil.run(dr1, "70 % av prioriterade sträckor fjärrstyrda", "2027-Q2", "ej påbörjad", "", "");
    insRes.run(dr1, comp["OT-ingenjör"], "2026-Q3", 600);
    insRes.run(dr1, comp["OT-ingenjör"], "2026-Q4", 600);
    insRes.run(dr1, comp["Projektledare"], "2026-Q3", 200);

    const tg1 = Number(insInit.run("T1 Tillståndsdata riskklassade anläggningar", ouId["NÄT"], "Eva Strand",
      "Systematisk insamling av tillståndsdata (digitala besiktningsprotokoll, sensorik på pilotobjekt).",
      "committed", "2026-Q3", "2027-Q2", "ou", 2.4, 7, 6, 7, 5,
      "KR7: tillståndsdata för 80 % av riskklassade anläggningar.").lastInsertRowid);
    insIg.run(tg1, g10);
    insMil.run(tg1, "Digitala besiktningsprotokoll i samtliga regioner", "2026-Q4", "på plan", "", "");
    insRes.run(tg1, comp["Dataingenjör"], "2026-Q4", 200);
    insRes.run(tg1, comp["Beredare"], "2026-Q4", 150);

    // ---- Eskalationer ----------------------------------------------------
    const insEsc = db.prepare("INSERT INTO escalations (ou_id, initiative_id, title, description, quarter, status, resolution) VALUES (?, ?, ?, ?, ?, ?, ?)");
    insEsc.run(ouId.KM, k3, "Nätanalytiker 130 % i Q3 2026", "K3 kolliderar med OU Näts förstärkningspaket (N1) om nätanalytiker. Efterfrågan 130 % av tillgänglig kapacitet.", "2026-Q3", "löst",
      "DEMT 2026-05-20: inhyrning av konsultkapacitet (+2,1 MSEK) ur temats ram enligt temarangordning. KR3-prognos justerad 300→220 MW.");
    insEsc.run(ouId.DRIFT, d1, "KR3 saknar committed bärare", "D1 ligger planned utan committed bemanning – KR3 (+220 MW) saknar därmed committed-initiativ.", "2026-Q4", "öppen", "");
    insEsc.run(ouId.DIGI, k1, "Integrationsutvecklare över 80 % planeringsgrad Q4", "Summerad efterfrågan på integrationsutvecklare i Q4 2026 överstiger 80-procentsregeln.", "2026-Q4", "öppen", "");

    // ---- Vägval och beslutslogg -----------------------------------------
    const insDec = db.prepare(`INSERT INTO decisions (theme_id, title, question, recommendation, decision, decided_by, decided_at, motive, review_conditions, status, forum) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insAlt = db.prepare("INSERT INTO decision_alternatives (decision_id, name, cost, kr_effect, risk, lead_time, chosen) VALUES (?, ?, ?, ?, ?, ?, ?)");

    const v1 = Number(insDec.run(t1, "Plattformsval för automatiserat standardflöde",
      "Ska standardärenden < 63 A automatiseras i befintlig ärendeplattform eller via upphandling av ny ärendeplattform?",
      "Automatisera i befintlig plattform – KR2 har deadline Q4 2026 och värdeerosionen vid senareläggning är hög.",
      "Automatisera i befintlig plattform. Plattformsbyte omprövas vid nästa temaöversyn med underlag från automationsutfallet.",
      "DEMT", "2026-04-28",
      "Tid till effekt avgör: KR2 nås inte med upphandlingsspår. Takhöjden (~75 % automation) räcker för målvärdet 70 %.",
      "Om automationsgraden stagnerar under 60 % två kvartal i rad, eller om förvaltningskostnaden ökar > 20 %, omprövas plattformsvalet.",
      "beslutat", "DEMT roadmapbeslut").lastInsertRowid);
    insAlt.run(v1, "Automatisera i befintlig plattform", "2,0 MSEK", "KR2 nås Q4 2026; takhöjd ~75 %", "Begränsad takhöjd; viss teknisk skuld kvarstår", "Effekt från Q2 2026", 1);
    insAlt.run(v1, "Upphandla ny ärendeplattform", "8–12 MSEK", "KR2 nås tidigast Q4 2027; högre slutnivå (~90 %)", "Upphandlings- och migreringsrisk; påverkar flera teman", "Effekt från Q4 2027", 0);

    const v2 = Number(insDec.run(t1, "Nätanalytikerkonflikt K3 ↔ N1 (Q3 2026)",
      "Hur löses kapacitetskonflikten om nätanalytiker mellan K3 Parallelliserad storkundsberedning och N1 Förstärkningspaket?",
      "Inhyrning av konsultkapacitet finansierad ur temats ram.",
      "Inhyrning (+2,1 MSEK) ur temats ram enligt temarangordning. KR3-prognosen justeras samtidigt 300→220 MW inom 18 månader – en dokumenterad ambitionsjustering i stället för en tyst miss.",
      "DEMT", "2026-05-20",
      "Temarangordningen ger tema 1 företräde; att flytta analytiker från reinvesteringsplanering skulle skapa risk i tema 3.",
      "Om konsultkostnaden överstiger 3 MSEK eller kompetensöverföringen uteblir, omprövas bemanningsmodellen inför Q1 2027.",
      "beslutat", "DEMT roadmapbeslut").lastInsertRowid);
    insAlt.run(v2, "Senarelägg K3", "0 kr", "KR1 missas (median 4 mån nås ej Q4)", "Temats högst prioriterade KR äventyras", "—", 0);
    insAlt.run(v2, "Hyr in konsultkapacitet", "+2,1 MSEK", "KR1 hålls; sex veckors försening av delmål", "Kompetensöverföring kräver styrning", "6 veckor uppstart", 1);
    insAlt.run(v2, "Flytta två analytiker från reinvesteringsplanering", "0 kr direkt", "KR1 hålls", "Risk i tema 3 (KR7); nyckelpersonberoende ökar", "Omedelbar", 0);

    const v3 = Number(insDec.run(t1, "Flexibilitetsplattform: köpa eller bygga",
      "Ska aktiverings-/avropsplattform för flexibilitet upphandlas som tjänst eller byggas på befintlig SCADA/DMS-miljö?",
      "PMO bereder: marknadsanalys klar till konsolideringsforum Q3.",
      "", "", null, "", "", "öppet", "DEMT roadmapbeslut").lastInsertRowid);
    insAlt.run(v3, "Upphandla marknadsplattform (SaaS)", "1,5 MSEK/år", "KR3-effekt från Q2 2027", "Beroende till extern part i driftnära process; informationssäkerhetskrav (NIS2) måste säkras", "6 mån", 0);
    insAlt.run(v3, "Bygg på SCADA/DMS", "5 MSEK + förvaltning", "KR3-effekt från Q4 2027", "OT-utvecklingskapacitet är flaskhals", "12–18 mån", 0);

    // ---- Statusrapporter (steg 7) ----------------------------------------
    const insSr = db.prepare("INSERT INTO status_reports (initiative_id, month, summary, prognosis, resource_state, decisions_needed, lessons) VALUES (?, ?, ?, ?, ?, ?, ?)");
    insSr.run(k2, "2026-05", "Delmål 1 uppnått och verifierat: 43 % av standardärendena flödar automatiskt (mål 40 %).", "grön", "Enligt plan", "", "Regelmotorns undantagslista växer – behöver förvaltningsrutin från start.");
    insSr.run(k3, "2026-05", "Inhyrda analytiker på plats sex veckor sent. Delmålet 'median 6 mån' flyttas ett kvartal med bibehållet slutmål – beslutat av temaägare inom mandat.", "gul", "Nätanalytiker: inhyrning aktiv enligt DEMT-beslut", "Inget – beslut fattat, åtgärdsplan följs i navet.", "Konsultuppstart tar 6 veckor – planera inhyrning ett kvartal tidigare än behovet.");
    insSr.run(k1, "2026-05", "Datadefinition för kapacitetsdata klar med OU Nät. Integrationsarbete startar enligt plan i juli.", "grön", "Enligt plan; spegelpost DIGI bemannad", "", "");
    insSr.run(n1, "2026-05", "Etapp 1 i fas. Beredningsresurser säkrade efter inhyrningsbeslut.", "grön", "Nätanalytiker täckt via konsult (V2)", "", "");
    insSr.run(n2, "2026-05", "Pilotområde 1 modellerat; datakvalitetsbrister i region nord bromsar – beroende till DG1.", "gul", "Enligt plan", "Prioritering av DG1-leverans för region nord.", "Beroenden till dataförmågor underskattas systematiskt – ta med dataingenjör i planeringen.");
    insSr.run(dg1, "2026-05", "Täckningsgrad 84 % (från 78). Dataägarskap bemannat för anläggning.", "grön", "Enligt plan", "", "");
    insSr.run(dr1, "2026-05", "48 % av sträckorna fjärrstyrda. Materielleveranser enligt plan.", "grön", "Enligt plan", "", "");
    insSr.run(tg1, "2026-05", "Upphandling av digitala besiktningsprotokoll klar; pilot i region syd startad.", "grön", "Enligt plan", "", "");

    // ---- Nyttoregister ----------------------------------------------------
    const insBen = db.prepare("INSERT INTO benefits (theme_id, initiative_id, kr_id, description, owner, action, baseline, measure_point, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    insBen.run(t1, k2, kr2, "70 % helautomatiska standardärenden frigör ca 4 åa beredningskapacitet", "Enhetschef Anslutning (KM)", "Omfördela frigjord beredningskapacitet till storkundsärenden; släck manuella kontrollsteg", "15 % automation", "Ärendesystemets flödesstatistik, månadsvis", "pågår");
    insBen.run(t1, k3, kr1, "Median 4 mån ledtid ger ~35 fler anslutna storkunder per år", "Enhetschef Anslutning (KM)", "Ny beredningsstandard obligatorisk; ledtid per steg följs i linjemål", "9 mån", "Ärendesystem, median rullande 3 mån", "pågår");
    insBen.run(t1, k1, kr1, "Kapacitetsbesked < 1 dag i offertflödet", "Chef Offert (KM)", "Manuell kapacitetsförfrågan till nätanalys avvecklas", "2–4 veckor per besked", "Offertstödets loggdata", "ej påbörjad");
    insBen.run(t1, d1, kr3, "+220 MW frigjord kapacitet via villkorade avtal", "Driftchef (DRIFT)", "Aktiveringsrutin i driftcentral; avtalsuppföljning per område", "0 MW", "Avtalsregister + driftdata, kvartalsvis", "ej påbörjad");
    insBen.run(t2, dr1, kr5, "Snabb omkoppling minskar SAIDI med ~40 min/år i berörda sträckor", "Driftchef (DRIFT)", "Omkopplingsinstruktioner och larmprioritering uppdateras", "210 min/år", "Avbrottsstatistik (DARWin)", "pågår");
  });
  tx();
}
