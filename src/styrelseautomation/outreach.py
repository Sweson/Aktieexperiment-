"""Genererar outreach-utkast och hanterar godkännande/utskick.

Designprinciper:
- Inga utskick utan explicit approve + send.
- Ingen email eller LinkedIn-automation körs som default – send() är dry-run
  om inte STYRELSE_SMTP_* eller --confirm-send är konfigurerat.
- Mallar läses från docs/templates/ och fylls med placeholders.
"""
from __future__ import annotations

import logging
import os
import smtplib
import sqlite3
from dataclasses import dataclass
from email.message import EmailMessage
from pathlib import Path
from string import Template

from . import storage

log = logging.getLogger(__name__)

TEMPLATES_DIR = Path("docs/templates")
DRAFTS_DIR = Path("data/drafts")


@dataclass
class Draft:
    channel: str
    recipient: str
    subject: str
    body: str


def _load_template(name: str) -> Template:
    path = TEMPLATES_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"Mall saknas: {path}")
    return Template(path.read_text(encoding="utf-8"))


def _choose_channel(opp_row: sqlite3.Row) -> str:
    url = (opp_row["url"] or "").lower()
    if "linkedin.com" in url:
        return "linkedin"
    if opp_row["source"] in {"styrelseakademien_export", "nordic_executive_list"}:
        return "email"
    return "email"


def _guess_recipient(opp_row: sqlite3.Row) -> str:
    # Vi gissar inte mejladresser – säkrast att lämna tomt och låta
    # användaren fylla i manuellt innan godkännande.
    return ""


def _template_vars(opp_row: sqlite3.Row, profile: dict) -> dict[str, str]:
    cand = profile.get("candidate", {})
    return {
        "org": opp_row["org"] or "organisationen",
        "title": opp_row["title"] or "styrelseuppdraget",
        "url": opp_row["url"] or "",
        "candidate_name": cand.get("name", ""),
        "candidate_headline": cand.get("headline", ""),
        "candidate_oneliner": cand.get("one_liner", "").strip(),
        "candidate_linkedin": cand.get("linkedin", ""),
        "proof_points": "\n".join(f"- {p}" for p in cand.get("proof_points", [])),
    }


def build_draft(opp_row: sqlite3.Row, profile: dict) -> Draft:
    channel = _choose_channel(opp_row)
    template_name = {
        "email": "intro_email.md",
        "linkedin": "linkedin_message.md",
    }.get(channel, "intro_email.md")

    tmpl = _load_template(template_name)
    vars_ = _template_vars(opp_row, profile)
    body = tmpl.safe_substitute(vars_)

    subject = f"Intresseanmälan: styrelseuppdrag – {vars_['org']}".strip()
    if channel == "linkedin":
        subject = ""  # LinkedIn har inget subject
    return Draft(channel=channel, recipient=_guess_recipient(opp_row), subject=subject, body=body)


def write_draft_file(opp_id: str, draft: Draft) -> Path:
    DRAFTS_DIR.mkdir(parents=True, exist_ok=True)
    path = DRAFTS_DIR / f"{opp_id}.md"
    header = [
        f"# Outreach-utkast {opp_id}",
        f"- kanal: {draft.channel}",
        f"- mottagare: {draft.recipient or '(fyll i innan godkännande)'}",
    ]
    if draft.subject:
        header.append(f"- ämne: {draft.subject}")
    body = "\n".join(header) + "\n\n---\n\n" + draft.body + "\n"
    path.write_text(body, encoding="utf-8")
    return path


def send_email(draft: Draft, dry_run: bool = True) -> str:
    """Skicka mejl via STYRELSE_SMTP_*-variabler. Dry-run som default."""
    if dry_run:
        return "dry-run: skickade ingenting"
    host = os.environ.get("STYRELSE_SMTP_HOST")
    port = int(os.environ.get("STYRELSE_SMTP_PORT", "587"))
    user = os.environ.get("STYRELSE_SMTP_USER")
    pwd = os.environ.get("STYRELSE_SMTP_PASSWORD")
    sender = os.environ.get("STYRELSE_SMTP_FROM", user or "")

    if not (host and user and pwd and draft.recipient):
        raise RuntimeError(
            "SMTP ej konfigurerat eller saknar mottagare. "
            "Sätt STYRELSE_SMTP_HOST/PORT/USER/PASSWORD/FROM och recipient i utkastet."
        )

    msg = EmailMessage()
    msg["Subject"] = draft.subject
    msg["From"] = sender
    msg["To"] = draft.recipient
    msg.set_content(draft.body)

    with smtplib.SMTP(host, port) as s:
        s.starttls()
        s.login(user, pwd)
        s.send_message(msg)
    return f"skickat till {draft.recipient}"


def load_draft_from_file(opp_id: str) -> Draft | None:
    """Läser in ev. manuellt redigerad utkastfil före utskick."""
    path = DRAFTS_DIR / f"{opp_id}.md"
    if not path.exists():
        return None
    text = path.read_text(encoding="utf-8")
    header, _, body = text.partition("\n---\n")
    meta: dict[str, str] = {}
    for line in header.splitlines():
        if line.startswith("- ") and ":" in line:
            key, _, val = line[2:].partition(":")
            meta[key.strip()] = val.strip()
    return Draft(
        channel=meta.get("kanal", "email"),
        recipient=meta.get("mottagare", ""),
        subject=meta.get("ämne", ""),
        body=body.strip(),
    )
