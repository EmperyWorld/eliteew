# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fetch URL and extract clean plain text (HTTP GET, pinned SSRF checks, streaming size cap and PDF extraction).
# Invariants:
# - Strict SSRF checks (loopback, private IP, link-local, cloud metadata blocked).
# - Null characters stripped to preserve PostgreSQL JSONB integrity.
# - Failed PDF extractions never fall back to raw binary byte decoding.
# Related:
# - api/services/kursorina/tools.py
# - api/services/desktop_chat/tools/registry.py
# - documentation/reference/solution-readiness/2026-09-07-kursorina-deep-synthesis-scale-and-evidence-cleansing.md
# ---

from __future__ import annotations

import html
import ipaddress
import logging
import re
import socket
from urllib.parse import urlparse

from api.services.safe_url_transport import fetch_url, ip_allowed

logger = logging.getLogger(__name__)

TOOL_NAME = "desktop_fetch_url"
LLAMA_TOOL = {
    "type": "function",
    "function": {
        "name": TOOL_NAME,
        "description": "Скачать страницу по URL и вернуть извлечённый текст (без полного рендера браузера).",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "HTTP(S) URL"},
            },
            "required": ["url"],
        },
    },
}

_TAG_RE = re.compile(r"<script[^>]*>[\s\S]*?</script>", re.I)
_TAG_RE2 = re.compile(r"<style[^>]*>[\s\S]*?</style>", re.I)
_HTML_TAG_RE = re.compile(r"<[^>]+>")

_MAX_REDIRECTS = 8

_METADATA_IPV4 = ipaddress.ip_address("169.254.169.254")


def _ip_blocked(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return not ip_allowed(ip)


def _hostname_is_ssrf_blocked(hostname: str) -> bool:
    """True if the hostname must not be fetched (SSRF)."""
    hn = (hostname or "").strip().lower()
    if not hn:
        return True
    if hn in ("localhost", "127.0.0.1", "::1", "[::1]"):
        return True
    try:
        ip = ipaddress.ip_address(hn)
        return _ip_blocked(ip)
    except ValueError:
        pass
    try:
        infos = socket.getaddrinfo(hn, None, type=socket.SOCK_STREAM)
    except OSError:
        return True
    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0])
            if _ip_blocked(ip):
                return True
        except ValueError:
            continue
    return False


def _host_allowed(url: str, allow_hosts: list[str], deny_hosts: list[str]) -> bool:
    try:
        p = urlparse(url)
        host = (p.hostname or "").lower()
        if p.scheme not in ("http", "https") or not host:
            return False
        if any(d and host.endswith(d.lower().lstrip(".")) for d in deny_hosts if d):
            return False
        if not allow_hosts:
            return True
        return any(host == a.lower() or host.endswith("." + a.lower().lstrip(".")) for a in allow_hosts if a)
    except Exception as exc:
        logger.debug("[STEP] fetch_url_host_allowed_skip url=%r err=%s", url, exc)
        return False


def _extract_pdf_text(data: bytes, max_pages: int = 20) -> str:
    """Extract plain text from PDF bytes via pymupdf/fitz."""
    doc = None
    try:
        import pymupdf  # type: ignore

        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception:
        try:
            import fitz  # type: ignore

            doc = fitz.open(stream=data, filetype="pdf")
        except Exception as exc:
            logger.debug("[STEP] fetch_url_pdf_import_err err=%s", exc)
            return ""
    try:
        pages: list[str] = []
        for i, page in enumerate(doc):
            if i >= max_pages:
                break
            txt = page.get_text()
            if txt and txt.strip():
                pages.append(txt.strip())
        return "\n\n".join(pages)
    except Exception as exc:
        logger.debug("[STEP] fetch_url_pdf_extract_err err=%s", exc)
        return ""
    finally:
        if doc is not None:
            import contextlib

            with contextlib.suppress(Exception):
                doc.close()


def _sanitize_extracted_text(text: str) -> str:
    """Remove null bytes and ASCII control characters to prevent DB/JSONB failure."""
    if not text:
        return ""
    cleaned = text.replace("\x00", " ").replace("\0", " ")
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


async def run_fetch_url(
    url: str,
    *,
    max_bytes: int,
    timeout_sec: float,
    allow_hosts: list[str],
    deny_hosts: list[str],
) -> str:
    raw = (url or "").strip()
    if not raw:
        return "Ошибка: пустой URL."
    if not _host_allowed(raw, allow_hosts, deny_hosts):
        return f"Ошибка: хост не разрешён политикой allowlist/denylist: {raw[:500]}"

    try:
        result = await fetch_url(
            raw,
            max_bytes=max_bytes,
            timeout_sec=timeout_sec,
            max_redirects=_MAX_REDIRECTS,
            truncate=True,
            url_allowed=lambda u: _host_allowed(u, allow_hosts, deny_hosts),
        )
        content_type = result.headers.get("content-type", "").lower()
        data, truncated = result.body, result.truncated
    except Exception as e:
        logger.warning(
            "desktop_fetch_url failed url=%s err_type=%s err=%r",
            raw[:200],
            type(e).__name__,
            e,
        )
        detail = (repr(e) if not str(e).strip() else str(e))[:300]
        return f"Ошибка загрузки URL: {detail}"

    text = ""
    is_pdf = "application/pdf" in content_type or raw.lower().endswith(".pdf") or data.startswith(b"%PDF")
    if is_pdf:
        text = _extract_pdf_text(data)
        if not text:
            return "Не удалось извлечь текст из PDF документа (файл защищен, поврежден при загрузке или не содержит текстового слоя)."

    if not text:
        try:
            text = data.decode("utf-8", errors="replace")
        except Exception:
            text = data.decode("latin-1", errors="replace")

        text = _TAG_RE.sub(" ", text)
        text = _TAG_RE2.sub(" ", text)
        text = _HTML_TAG_RE.sub(" ", text)
        text = html.unescape(text)

    text = _sanitize_extracted_text(text)
    if len(text) > 16_000:
        text = text[:16_000] + "…"
    if not text:
        return "Не удалось извлечь текст со страницы (пусто или бинарный контент)."
    if truncated:
        return text + " …[ответ обрезан по лимиту байт]"
    return text
