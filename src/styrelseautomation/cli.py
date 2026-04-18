"""CLI: styrelse <command>."""
from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

import click
import yaml
from rich.console import Console
from rich.table import Table

from . import collectors, outreach, storage
from .scoring import score_opportunity
from .storage import Opportunity

console = Console()
log = logging.getLogger("styrelse")


def _load_profile(path: Path = Path("config/profile.yaml")) -> dict:
    if not path.exists():
        raise click.ClickException(f"Profil saknas: {path}")
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


@click.group()
@click.option("--verbose", "-v", is_flag=True)
def main(verbose: bool) -> None:
    """styrelse – hitta och hantera styrelseuppdrag."""
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(levelname)s %(name)s: %(message)s",
    )


@main.command()
def discover() -> None:
    """Hämta uppdrag från konfigurerade källor, scora och spara."""
    profile = _load_profile()
    sources_cfg = collectors.load_sources()
    min_score = float(profile.get("filters", {}).get("min_score", 0))

    total = kept = 0
    scored: list[Opportunity] = []
    for opp in collectors.collect_all(sources_cfg):
        total += 1
        result = score_opportunity(opp, profile)
        if result.rejected_reason or result.score < min_score:
            continue
        opp.score = result.score
        opp.score_breakdown = result.matched
        scored.append(opp)
        kept += 1

    with storage.connect() as conn:
        new, updated = storage.upsert_opportunities(conn, scored)
    console.print(
        f"[green]Klart[/green]: {total} inlästa, {kept} över tröskel, "
        f"{new} nya, {updated} uppdaterade."
    )


@main.command("list")
@click.option("--top", default=20, help="Antal att visa")
@click.option("--status", default=None, help="Filtrera på status (new, contacted, ...)")
def list_cmd(top: int, status: str | None) -> None:
    """Lista uppdrag sorterat på score."""
    profile = _load_profile()
    min_score = float(profile.get("filters", {}).get("min_score", 0))
    with storage.connect() as conn:
        rows = storage.list_opportunities(conn, min_score=min_score, status=status, limit=top)

    if not rows:
        console.print("[yellow]Inga uppdrag matchar filtren ännu. Kör 'styrelse discover'.[/yellow]")
        return

    table = Table(title=f"Top {len(rows)} styrelseuppdrag")
    table.add_column("id", style="cyan")
    table.add_column("score", justify="right", style="green")
    table.add_column("org")
    table.add_column("titel")
    table.add_column("ort")
    table.add_column("källa", style="dim")
    table.add_column("status")
    for r in rows:
        table.add_row(
            r["id"], f"{r['score']:.1f}", (r["org"] or "")[:28],
            (r["title"] or "")[:60], (r["location"] or "")[:18],
            r["source"], r["status"],
        )
    console.print(table)


@main.command()
@click.argument("opp_id")
def show(opp_id: str) -> None:
    """Visa detaljer och score-breakdown för ett uppdrag."""
    with storage.connect() as conn:
        row = storage.get_opportunity(conn, opp_id)
    if not row:
        raise click.ClickException(f"Hittar inte {opp_id}")
    console.rule(f"{row['org'] or '—'} · {row['title']}")
    console.print(f"[bold]Score:[/bold] {row['score']}")
    console.print(f"[bold]Källa:[/bold] {row['source']}")
    console.print(f"[bold]Ort:[/bold] {row['location'] or '—'}")
    console.print(f"[bold]Publicerad:[/bold] {row['posted_at'] or '—'}")
    console.print(f"[bold]URL:[/bold] {row['url'] or '—'}")
    console.print(f"\n{row['summary'] or ''}\n")
    import json
    breakdown = json.loads(row["score_breakdown"] or "{}")
    if breakdown:
        console.print("[bold]Matchade nyckelord:[/bold]")
        for term, weight in sorted(breakdown.items(), key=lambda x: -x[1]):
            console.print(f"  {term}: {weight:+.1f}")


@main.command()
@click.argument("opp_id")
def draft(opp_id: str) -> None:
    """Skapa outreach-utkast i data/drafts/."""
    profile = _load_profile()
    with storage.connect() as conn:
        row = storage.get_opportunity(conn, opp_id)
        if not row:
            raise click.ClickException(f"Hittar inte {opp_id}")
        d = outreach.build_draft(row, profile)
        path = outreach.write_draft_file(opp_id, d)
        storage.save_draft(conn, opp_id, d.channel, d.recipient, d.subject, d.body)
    console.print(f"[green]Utkast sparat:[/green] {path}")
    console.print(
        "Redigera filen (fyll i mottagare, finslipa tonen) och kör sedan "
        f"[cyan]styrelse approve {opp_id}[/cyan]."
    )


@main.command()
@click.argument("opp_id")
def approve(opp_id: str) -> None:
    """Markera utkast som godkänt för utskick."""
    with storage.connect() as conn:
        existing = storage.get_draft(conn, opp_id)
        if not existing:
            raise click.ClickException("Inget utkast att godkänna – kör 'styrelse draft' först.")
        edited = outreach.load_draft_from_file(opp_id)
        if edited:
            storage.save_draft(conn, opp_id, edited.channel, edited.recipient,
                               edited.subject, edited.body)
            if not edited.recipient:
                raise click.ClickException(
                    "Mottagare saknas i utkastet. Fyll i 'mottagare:' i filen."
                )
        storage.mark_approved(conn, opp_id)
    console.print(f"[green]Godkänt[/green] {opp_id}. Kör 'styrelse send {opp_id}' för att skicka.")


@main.command()
@click.argument("opp_id")
@click.option("--confirm-send", is_flag=True, help="Skicka på riktigt (annars dry-run).")
def send(opp_id: str, confirm_send: bool) -> None:
    """Skicka godkänt utkast. Default = dry-run."""
    with storage.connect() as conn:
        d = storage.get_draft(conn, opp_id)
        if not d or d["status"] != "approved":
            raise click.ClickException("Utkastet är inte godkänt. Kör 'approve' först.")
        edited = outreach.load_draft_from_file(opp_id)
        draft_obj = outreach.Draft(
            channel=edited.channel if edited else d["channel"],
            recipient=edited.recipient if edited else d["recipient"],
            subject=edited.subject if edited else d["subject"],
            body=edited.body if edited else d["body"],
        )
        if draft_obj.channel == "email":
            result = outreach.send_email(draft_obj, dry_run=not confirm_send)
        else:
            result = (
                f"LinkedIn-meddelanden skickas inte automatiskt (ToS). "
                f"Kopiera texten från data/drafts/{opp_id}.md manuellt."
            )
        if confirm_send and draft_obj.channel == "email":
            storage.mark_sent(conn, opp_id)
    console.print(result)


@main.command()
@click.option("--title", prompt=True)
@click.option("--org", prompt=True)
@click.option("--summary", prompt=True, default="")
@click.option("--url", prompt=True, default="")
@click.option("--location", prompt=True, default="")
def add(title: str, org: str, summary: str, url: str, location: str) -> None:
    """Lägg till uppdrag manuellt (t.ex. en tipsning du fått)."""
    profile = _load_profile()
    opp = Opportunity(
        title=title, org=org, summary=summary, url=url, location=location,
        posted_at=datetime.utcnow().isoformat(timespec="seconds"),
        source="manuella_uppdrag",
    )
    result = score_opportunity(opp, profile)
    opp.score = result.score
    opp.score_breakdown = result.matched
    with storage.connect() as conn:
        storage.upsert_opportunities(conn, [opp])
    console.print(f"[green]Sparat[/green] {opp.id} (score {opp.score}).")


@main.command()
def report() -> None:
    """Kort veckorapport: pipeline-status."""
    with storage.connect() as conn:
        rows = conn.execute(
            "SELECT status, COUNT(*) c FROM opportunities GROUP BY status"
        ).fetchall()
        total = sum(r["c"] for r in rows)
        by_status = {r["status"]: r["c"] for r in rows}

    table = Table(title="Pipeline")
    table.add_column("status"); table.add_column("antal", justify="right")
    for s, c in by_status.items():
        table.add_row(s, str(c))
    table.add_row("[bold]totalt[/bold]", f"[bold]{total}[/bold]")
    console.print(table)
