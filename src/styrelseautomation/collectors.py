"""Collectors för uppdragskällor. Varje collector returnerar Opportunity-objekt."""
from __future__ import annotations

import csv
import email
import logging
import re
import xml.etree.ElementTree as ET
from email import policy
from pathlib import Path
from typing import Iterable, Iterator
from urllib.request import Request, urlopen

import yaml

from .storage import Opportunity

log = logging.getLogger(__name__)


def load_sources(path: Path = Path("config/sources.yaml")) -> dict:
    if not path.exists():
        return {"sources": []}
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def collect_all(sources_cfg: dict) -> Iterator[Opportunity]:
    for src in sources_cfg.get("sources", []):
        name = src.get("name", "unknown")
        kind = src.get("type")
        try:
            if kind == "rss":
                yield from collect_rss(name, src["url"])
            elif kind == "csv":
                yield from collect_csv(name, Path(src["path"]))
            elif kind == "styrelseakademien":
                yield from collect_csv(name, Path(src["path"]))
            elif kind == "nel":
                yield from collect_nel(name, Path(src["inbox_dir"]))
            elif kind == "manual":
                # "Manual" samlas inte automatiskt – 'styrelse add' skriver direkt till DB.
                continue
            else:
                log.warning("Okänd källtyp: %s (%s)", kind, name)
        except FileNotFoundError as exc:
            log.warning("Hoppar över %s: %s", name, exc)
        except Exception as exc:  # noqa: BLE001 – collectors får inte krascha hela runnet
            log.error("Fel vid insamling från %s: %s", name, exc)


def collect_rss(source_name: str, url: str, timeout: int = 15) -> Iterator[Opportunity]:
    """Parsar RSS 2.0 och Atom med stdlib (inga extra beroenden)."""
    req = Request(url, headers={"User-Agent": "styrelseautomation/0.1"})
    with urlopen(req, timeout=timeout) as resp:
        data = resp.read()
    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        log.warning("Kunde inte parsa RSS från %s: %s", url, exc)
        return

    # RSS 2.0: <rss><channel><item>...
    for item in root.iter("item"):
        yield Opportunity(
            title=_xml_text(item, "title"),
            summary=_strip_html(_xml_text(item, "description")),
            url=_xml_text(item, "link"),
            posted_at=_xml_text(item, "pubDate"),
            source=source_name,
            raw={"guid": _xml_text(item, "guid")},
        )

    # Atom: <feed><entry>...
    atom_ns = "{http://www.w3.org/2005/Atom}"
    for entry in root.iter(f"{atom_ns}entry"):
        link_el = entry.find(f"{atom_ns}link")
        link_url = link_el.attrib.get("href", "") if link_el is not None else ""
        yield Opportunity(
            title=_xml_text(entry, f"{atom_ns}title"),
            summary=_strip_html(_xml_text(entry, f"{atom_ns}summary")
                                 or _xml_text(entry, f"{atom_ns}content")),
            url=link_url,
            posted_at=_xml_text(entry, f"{atom_ns}updated")
                       or _xml_text(entry, f"{atom_ns}published"),
            source=source_name,
            raw={"id": _xml_text(entry, f"{atom_ns}id")},
        )


def _xml_text(elem: ET.Element, tag: str) -> str:
    found = elem.find(tag)
    return (found.text or "").strip() if found is not None and found.text else ""


def collect_csv(source_name: str, path: Path) -> Iterator[Opportunity]:
    if not path.exists():
        raise FileNotFoundError(f"CSV saknas: {path} (skapa filen eller ta bort källan)")
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            yield Opportunity(
                title=(row.get("title") or "").strip(),
                org=(row.get("org") or "").strip(),
                summary=(row.get("summary") or "").strip(),
                url=(row.get("url") or "").strip(),
                location=(row.get("location") or "").strip(),
                posted_at=(row.get("posted_at") or "").strip(),
                source=source_name,
                raw=dict(row),
            )


def collect_nel(source_name: str, inbox_dir: Path) -> Iterator[Opportunity]:
    """Parsar sparade Nordic Executive List-mejl (.eml) och extraherar uppdragsrader.

    NEL skickar en lista rubriker av formen:
        [Källa] Titel - ev. bolag (stad)
        https://...
    """
    if not inbox_dir.exists():
        raise FileNotFoundError(f"NEL inbox saknas: {inbox_dir}")

    link_pat = re.compile(r"https?://\S+")
    for eml_file in sorted(inbox_dir.glob("*.eml")):
        with eml_file.open("rb") as f:
            msg = email.message_from_binary_file(f, policy=policy.default)
        body = _eml_text(msg)
        for block in _split_nel_blocks(body):
            title = block[0].strip(" -•")
            url = next((m.group(0) for line in block for m in [link_pat.search(line)] if m), "")
            summary = "\n".join(block[1:])[:500]
            if not title:
                continue
            yield Opportunity(
                title=title,
                summary=summary,
                url=url,
                source=source_name,
                posted_at=msg.get("Date", ""),
                raw={"file": eml_file.name},
            )


def _eml_text(msg) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                return part.get_content()
        for part in msg.walk():
            if part.get_content_type() == "text/html":
                return _strip_html(part.get_content())
    return msg.get_content() if hasattr(msg, "get_content") else ""


def _split_nel_blocks(body: str) -> Iterable[list[str]]:
    # Gruppera icke-tomma rader i block separerade av blanka rader.
    current: list[str] = []
    for line in body.splitlines():
        if line.strip():
            current.append(line.strip())
        else:
            if current:
                yield current
                current = []
    if current:
        yield current


_HTML_TAG = re.compile(r"<[^>]+>")


def _strip_html(text: str) -> str:
    text = _HTML_TAG.sub(" ", text or "")
    return re.sub(r"\s+", " ", text).strip()
