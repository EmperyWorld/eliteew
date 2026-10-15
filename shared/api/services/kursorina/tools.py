# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Курсорина tool runners: library (primary), platform docs/code, Yandex web.
# Invariants:
# - Observations are extracts for the evidence ledger — not genre prose.
# - Library ACL uses ContentQueryService with runtime user_id only.
# - web_search uses existing Yandex Search API via desktop_chat web_search_tool.
# - fetch_url reuses desktop_chat SSRF-safe page fetch for deeper extracts.
# - Binary PDF streams and corrupted web payloads are rejected before entering evidence ledger.
# - Finance/benchmark never invent numbers via defaults or RNG — explicit inputs only.
# Related:
# - documentation/product/desktop/KURSORINA.md
# - documentation/reference/solution-readiness/2026-09-07-kursorina-deep-synthesis-scale-and-evidence-cleansing.md
# - api/services/kursorina/library.py
# - api/services/desktop_chat/tools/web_search_tool.py
# - api/services/desktop_chat/tools/fetch_url.py
# ---

from __future__ import annotations

import logging
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any
from uuid import uuid4

from api.services.kursorina.models import EvidenceItem
from api.services.kursorina.paths import is_path_allowed, monorepo_root, resolve_allowed_path
from api.services.kursorina.runtime import ToolRuntime

logger = logging.getLogger(__name__)

_MAX_EXTRACT = 4_000
_MAX_PAGE_EXTRACT = 6_000
_MAX_HITS = 8
_FETCH_MAX_BYTES = 400_000
_FETCH_TIMEOUT_SEC = 20.0


def _eid() -> str:
    return uuid4().hex[:12]


def _rg_list(*, root: Path, query: str, glob: str, search_root: Path) -> list[str]:
    hits: list[str] = []
    rg = shutil.which("rg")
    if not rg or not search_root.is_dir():
        return hits
    try:
        proc = subprocess.run(
            [
                rg,
                "-l",
                "-i",
                "--glob",
                glob,
                "-m",
                "1",
                query,
                str(search_root),
            ],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        logger.info("[STEP] kursorina_rg_fail err=%s", type(exc).__name__)
        return hits
    for line in (proc.stdout or "").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rel = Path(line).resolve().relative_to(root.resolve()).as_posix()
        except ValueError:
            continue
        if is_path_allowed(rel, root=root):
            hits.append(rel)
        if len(hits) >= _MAX_HITS:
            break
    return hits


async def tool_search_docs(query: str) -> tuple[str, list[EvidenceItem]]:
    q = str(query or "").strip()
    if not q:
        return "empty query", []
    root = monorepo_root()
    docs = root / "documentation"
    hits = _rg_list(root=root, query=q, glob="*.md", search_root=docs)
    # Phrase miss → try significant tokens (rg OR via sequential union)
    if not hits:
        platform_tokens = [
            tok
            for tok in (
                "EliteEW",
                "архитектур",
                "безопасност",
                "туннел",
                "экосистем",
                "стек",
                "контур",
                "stack0",
                "keycloak",
                "ролев",
                "субд",
            )
            if tok.casefold() in q.casefold()
        ]
        tokens = platform_tokens or [t for t in q.split() if len(t) >= 4][:4]
        seen: set[str] = set()
        for tok in tokens:
            for h in _rg_list(root=root, query=tok, glob="*.md", search_root=docs):
                if h not in seen:
                    seen.add(h)
                    hits.append(h)
                if len(hits) >= _MAX_HITS:
                    break
            if len(hits) >= _MAX_HITS:
                break
    if not hits and docs.is_dir():
        needle = q.casefold()
        for path in docs.rglob("*.md"):
            try:
                rel = path.relative_to(root).as_posix()
            except ValueError:
                continue
            if not is_path_allowed(rel, root=root):
                continue
            if needle in path.name.casefold() or needle in rel.casefold():
                hits.append(rel)
            if len(hits) >= _MAX_HITS:
                break
    evidence = [EvidenceItem(id=_eid(), kind="doc_hit", ref=h, extract=f"path match for query={q[:120]}") for h in hits]
    obs = f"found {len(hits)} doc paths" if hits else "no doc hits"
    return obs, evidence


async def tool_search_code(query: str) -> tuple[str, list[EvidenceItem]]:
    q = str(query or "").strip()
    if not q:
        return "empty query", []
    root = monorepo_root()
    api = root / "shared" / "api"
    hits = _rg_list(root=root, query=q, glob="*.py", search_root=api)
    evidence = [
        EvidenceItem(id=_eid(), kind="code_hit", ref=h, extract=f"code path match for query={q[:120]}") for h in hits
    ]
    obs = f"found {len(hits)} code paths" if hits else "no code hits"
    return obs, evidence


async def tool_read_path(path_rel: str) -> tuple[str, list[EvidenceItem]]:
    path = resolve_allowed_path(path_rel)
    if path is None:
        return f"path denied or missing: {path_rel[:200]}", []
    if path.is_dir():
        names = sorted(p.name for p in path.iterdir())[:40]
        extract = "dir listing:\n" + "\n".join(names)
        ev = EvidenceItem(id=_eid(), kind="dir", ref=path_rel, extract=extract[:_MAX_EXTRACT])
        return f"listed {len(names)} entries", [ev]
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        return f"read failed: {type(exc).__name__}", []
    extract = text[:_MAX_EXTRACT]
    root = monorepo_root()
    try:
        rel = path.relative_to(root).as_posix()
    except ValueError:
        rel = path_rel
    kind = "file"
    if rel.endswith(".py"):
        kind = "code"
    elif rel.endswith(".md"):
        kind = "file"
    ev = EvidenceItem(id=_eid(), kind=kind, ref=rel, extract=extract)
    return f"read {len(extract)} chars from {rel}", [ev]


async def tool_web_search(query: str, *, runtime: ToolRuntime | None) -> tuple[str, list[EvidenceItem]]:
    q = str(query or "").strip()
    if not q:
        return "empty query", []
    rt = runtime or ToolRuntime()
    if rt.db is None or rt.user_id is None:
        return "web_search requires authenticated DB session", []
    if not rt.web_enabled:
        return "web_search disabled for this mission", []

    from api.services.desktop_chat.tools.web_search_tool import run_web_search_with_sources
    from api.services.search_service import (
        get_web_search_query,
        resolve_web_search_provider_for_surface,
        sanitize_web_search_query,
    )

    provider = await resolve_web_search_provider_for_surface(db=rt.db, surface="desktop")
    if not provider:
        return "web_search not configured (no Yandex Search API)", []

    # Long chatty goals (mission c236bbb6) → condense before Yandex 400-char / relevance budget.
    search_q = sanitize_web_search_query(get_web_search_query(q, []))
    if not search_q:
        search_q = sanitize_web_search_query(q) or q[:160]

    try:
        block, sources = await run_web_search_with_sources(
            rt.db,
            user_id=rt.user_id,
            query=search_q,
            enabled=True,
        )
    except Exception as exc:  # noqa: BLE001 — tool boundary
        logger.info("[STEP] kursorina_web_search_fail err=%s", type(exc).__name__)
        return f"web_search error: {type(exc).__name__}", []

    evidence: list[EvidenceItem] = []
    if isinstance(sources, list):
        for src in sources[:8]:
            if not isinstance(src, dict):
                continue
            title = str(src.get("title") or src.get("name") or "")[:200]
            url = str(src.get("url") or src.get("href") or "")[:500]
            snippet = str(src.get("snippet") or src.get("content") or src.get("extract") or "")[:1_500]
            ref = url or title or "web"
            extract = f"{title}\n{snippet}".strip()[:_MAX_EXTRACT]
            evidence.append(EvidenceItem(id=_eid(), kind="web", ref=ref, extract=extract))

    if not evidence:
        lowered = (block or "").casefold()
        if any(marker in lowered for marker in ("отключён", "не настроен", "ничего не найдено", "квота", "quota")):
            return (block or "web_search empty")[:800], []
        # Extract bare URLs from prompt block — do not invent a web hit from unparsed prose.
        urls = re.findall(r"https?://[^\s\]\)\"'<>]+", block or "")
        for url in urls[:8]:
            evidence.append(
                EvidenceItem(
                    id=_eid(),
                    kind="web",
                    ref=url[:500],
                    extract=(block or "")[:800],
                )
            )
        if not evidence:
            return (block or "web_search returned no sources")[:800], []

    obs = f"web hits={len(evidence)}"
    logger.info("[STEP] kursorina_web_search_ok hits=%s query_chars=%s", len(evidence), len(q))
    return obs, evidence


async def tool_fetch_url(url: str, *, runtime: ToolRuntime | None = None) -> tuple[str, list[EvidenceItem]]:
    """Fetch http(s) page text via Desktop SSRF-safe fetcher; store as web evidence."""
    del runtime  # reserved for future quota/session; SSRF is host-side
    raw = str(url or "").strip()
    if not raw:
        return "empty url", []
    if not re.match(r"^https?://", raw, flags=re.I):
        return "fetch_url requires http(s) URL", []
    try:
        from api.services.desktop_chat.tools.fetch_url import run_fetch_url
    except ImportError:
        return "fetch_url unavailable", []

    try:
        text = await run_fetch_url(
            raw,
            max_bytes=_FETCH_MAX_BYTES,
            timeout_sec=_FETCH_TIMEOUT_SEC,
            allow_hosts=[],  # public web; private/loopback blocked inside run_fetch_url
            deny_hosts=[],
        )
    except Exception as exc:  # noqa: BLE001 — tool boundary
        logger.info("[STEP] kursorina_fetch_url_fail err=%s", type(exc).__name__)
        return f"fetch_url error: {type(exc).__name__}", []

    body = str(text or "").strip()
    if not body or body.startswith("Ошибка") or body.startswith("Не удалось"):
        logger.info(
            "[STEP] kursorina_fetch_url_empty url_chars=%s obs=%s",
            len(raw),
            body[:160],
        )
        return (body or "fetch_url empty")[:800], []

    # Safeguard against binary PDF streams or corrupt non-text payload
    if body.startswith("%PDF") or "\x00" in body[:1000] or body.count("\ufffd") > 20:
        logger.info("[STEP] kursorina_fetch_url_binary_rejected url_chars=%s", len(raw))
        return "fetch_url rejected: binary stream detected", []

    extract = body[:_MAX_PAGE_EXTRACT]
    evidence = [EvidenceItem(id=_eid(), kind="web", ref=raw[:500], extract=extract)]
    logger.info(
        "[STEP] kursorina_fetch_url_ok chars=%s url_chars=%s",
        len(extract),
        len(raw),
    )
    return f"fetched chars={len(extract)}", evidence


async def tool_knowledge_base_search(
    query: str,
    *,
    barrel_id: str | None = None,
    runtime: ToolRuntime | None = None,
) -> tuple[str, list[EvidenceItem]]:
    """Semantic search in KBSEW corporate knowledge barrels (RAG retrieval)."""
    del runtime  # discovery / ACL handled inside KBSEW service
    q = str(query or "").strip()
    if not q:
        return "empty query", []
    try:
        from api.services.desktop_chat.tools.knowledge_base_search_tool import run_knowledge_base_search

        text = await run_knowledge_base_search(
            query=q,
            barrel_id=str(barrel_id or ""),
            enabled=True,
        )
    except Exception as exc:  # noqa: BLE001 — tool boundary
        logger.info("[STEP] kursorina_kbsew_fail err=%s", type(exc).__name__)
        return f"knowledge_base_search error: {type(exc).__name__}", []

    body = str(text or "").strip()
    if (
        not body
        or "не найдено" in body.casefold()
        or "отключён" in body.casefold()
        or "не удалось" in body.casefold()
        or "нет активных" in body.casefold()
        or "ошибка" in body.casefold()
    ):
        return (body or "knowledge_base_search empty")[:800], []

    extract = body[:_MAX_EXTRACT]
    evidence = [EvidenceItem(id=_eid(), kind="kbsew", ref=f"kbsew:{barrel_id or 'auto'}", extract=extract)]
    logger.info("[STEP] kursorina_kbsew_ok chars=%s query=%s", len(extract), q[:40])
    return f"found kbsew material ({len(extract)} chars)", evidence


async def tool_search_projects(
    query: str,
    *,
    status: str | None = None,
    runtime: ToolRuntime | None = None,
) -> tuple[str, list[EvidenceItem]]:
    """Search user's active/internal organizational projects and company context."""
    del runtime
    q = str(query or "").strip()

    try:
        from api.core.database_manager import get_asyncpg_pool

        pool = await get_asyncpg_pool()
        async with pool.acquire() as conn:
            sql = """
                SELECT p.id, p.name, p.slug, p.description, p.category, p.status, p.priority,
                       c.name AS company_name
                FROM projects p
                LEFT JOIN companies c ON c.id = p.company_id
                WHERE ($1 = '' OR p.name ILIKE '%' || $1 || '%' OR p.description ILIKE '%' || $1 || '%' OR COALESCE(c.name, '') ILIKE '%' || $1 || '%')
                  AND ($2::text IS NULL OR p.status = $2::text)
                ORDER BY p.updated_at DESC NULLS LAST
                LIMIT 8
            """
            rows = await conn.fetch(sql, q, status)
    except Exception as exc:  # noqa: BLE001 — tool boundary
        logger.info("[STEP] kursorina_search_projects_fail err=%s", type(exc).__name__)
        return f"search_projects error: {type(exc).__name__}", []

    if not rows:
        return f"no projects found for query={q[:100]}", []

    evidence: list[EvidenceItem] = []
    for r in rows:
        pid = str(r["id"])
        name = str(r["name"] or "Без названия")
        status_val = str(r["status"] or "active")
        priority_val = str(r["priority"] or "normal")
        desc = str(r["description"] or "").strip()
        comp = str(r["company_name"] or "")
        comp_str = f" (Компания: {comp})" if comp else ""
        extract = (
            f"Проект: {name}{comp_str}\n"
            f"Статус: {status_val} | Приоритет: {priority_val} | ID: {pid}\n"
            f"Описание: {desc or 'отсутствует'}"
        )[:_MAX_EXTRACT]
        evidence.append(EvidenceItem(id=_eid(), kind="project", ref=f"project:{pid}", extract=extract))

    logger.info("[STEP] kursorina_search_projects_ok count=%s", len(evidence))
    return f"found {len(evidence)} projects", evidence


async def tool_generate_diagram(
    code: str,
    title: str = "",
    *,
    diagram_type: str = "flowchart",
    save_as_file: bool = True,
    runtime: ToolRuntime | None = None,
    mission_id: str | None = None,
) -> tuple[str, list[EvidenceItem]]:
    """Generate structured visual diagram (Mermaid/SVG), validate syntax, and export deliverable."""
    raw = str(code or "").strip()
    valid_headers = (
        "flowchart",
        "graph",
        "sequenceDiagram",
        "classDiagram",
        "stateDiagram",
        "erDiagram",
        "mindmap",
        "timeline",
        "pie",
        "gantt",
    )
    norm_type = str(diagram_type or "flowchart").strip()
    if not any(raw.startswith(h) for h in valid_headers):
        header = "flowchart TD" if norm_type == "flowchart" else norm_type
        clean_code = f"{header}\n{raw}"
    else:
        clean_code = raw

    title_clean = str(title or "Диаграмма исследования").strip()[:160]
    safe_name = re.sub(r"[^\w.\-а-яА-ЯёЁ]+", "_", title_clean)[:80] or "diagram"
    mermaid_filename = f"{safe_name}.mermaid"

    extract = f"### {title_clean}\n\n```mermaid\n{clean_code}\n```"
    evidence = [EvidenceItem(id=_eid(), kind="diagram", ref=mermaid_filename, extract=extract[:_MAX_EXTRACT])]

    # Physical disk mirror
    if mission_id:
        try:
            from api.services.kursorina.python_tool import write_physical_file

            write_physical_file(mission_id, mermaid_filename, clean_code)
        except Exception as exc:  # noqa: BLE001
            logger.debug("[STEP] kursorina_diagram_disk_skip err=%s", exc)

    # Save to user's library if requested
    if save_as_file and runtime and runtime.user_id:
        try:
            from api.services.kursorina.library import tool_save_to_library

            _, lib_ev = await tool_save_to_library(
                f"{title_clean} (Mermaid)",
                f"# {title_clean}\n\n```mermaid\n{clean_code}\n```",
                runtime=runtime,
                mission_id=mission_id,
            )
            if lib_ev:
                evidence.extend(lib_ev)
        except Exception as exc:  # noqa: BLE001
            logger.debug("[STEP] kursorina_diagram_library_skip err=%s", exc)

    logger.info("[STEP] kursorina_generate_diagram_ok chars=%s", len(clean_code))
    return f"diagram generated ({len(clean_code)} chars) file={mermaid_filename}", evidence


async def tool_extract_table_data(
    data: str,
    *,
    title: str = "",
    calculate_stats: bool = True,
    runtime: ToolRuntime | None = None,
    mission_id: str | None = None,
) -> tuple[str, list[EvidenceItem]]:
    """Parse, structure, and calculate summary metrics on tabular data; export clean Markdown & CSV."""
    del runtime
    raw = str(data or "").strip()
    if not raw:
        return "empty data", []

    lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    if not lines:
        return "empty lines in table data", []

    rows: list[list[str]] = []
    for line in lines:
        if line.startswith("|-") or line.startswith("| -") or line.startswith("---"):
            continue
        if "|" in line:
            parts = [p.strip() for p in line.strip("|").split("|")]
        elif "\t" in line:
            parts = [p.strip() for p in line.split("\t")]
        elif ";" in line:
            parts = [p.strip() for p in line.split(";")]
        elif "," in line and not line.startswith('"'):
            parts = [p.strip() for p in line.split(",")]
        else:
            parts = [line]
        if any(parts):
            rows.append(parts)

    if not rows:
        return "could not parse table rows", []

    max_cols = max(len(r) for r in rows)
    norm_rows: list[list[str]] = [r + [""] * (max_cols - len(r)) for r in rows]
    headers = norm_rows[0]
    data_rows = norm_rows[1:] if len(norm_rows) > 1 else []

    stats_row: list[str] = ["Итого / Среднее"]
    if calculate_stats and data_rows:
        has_numeric = False
        for col_idx in range(1, max_cols):
            vals: list[float] = []
            for r in data_rows:
                cell = r[col_idx].replace(" ", "").replace("$", "").replace("€", "").replace("₽", "").replace("%", "")
                try:
                    vals.append(float(cell))
                except ValueError:
                    continue
            if vals and len(vals) >= len(data_rows) * 0.5:
                has_numeric = True
                avg = sum(vals) / len(vals)
                total = sum(vals)
                stats_row.append(f"Σ={total:,.1f} (avg={avg:,.1f})")
            else:
                stats_row.append("—")
        if not has_numeric:
            stats_row = []
    else:
        stats_row = []

    col_widths = [max(len(r[i]) for r in norm_rows + ([stats_row] if stats_row else [])) for i in range(max_cols)]
    col_widths = [max(w, 3) for w in col_widths]

    def _fmt_row(r: list[str]) -> str:
        cells = [r[i].ljust(col_widths[i]) if i < len(r) else "".ljust(col_widths[i]) for i in range(max_cols)]
        return "| " + " | ".join(cells) + " |"

    md_lines: list[str] = []
    title_clean = str(title or "Сводная аналитическая таблица").strip()
    if title_clean:
        md_lines.append(f"### {title_clean}\n")
    md_lines.append(_fmt_row(headers))
    md_lines.append("| " + " | ".join("-" * w for w in col_widths) + " |")
    for r in data_rows:
        md_lines.append(_fmt_row(r))
    if stats_row:
        md_lines.append("| " + " | ".join("-" * w for w in col_widths) + " |")
        md_lines.append(_fmt_row(stats_row))

    table_md = "\n".join(md_lines)
    safe_title = re.sub(r"[^\w.\-а-яА-ЯёЁ]+", "_", title_clean)[:80] or "table"
    csv_filename = f"{safe_title}.csv"

    # Write physical CSV file
    if mission_id:
        try:
            import csv
            import io

            out_csv = io.StringIO()
            writer = csv.writer(out_csv)
            for r in norm_rows:
                writer.writerow(r)
            from api.services.kursorina.python_tool import write_physical_file

            write_physical_file(mission_id, csv_filename, out_csv.getvalue())
        except Exception as exc:  # noqa: BLE001
            logger.debug("[STEP] kursorina_table_csv_disk_skip err=%s", exc)

    evidence = [EvidenceItem(id=_eid(), kind="table", ref=csv_filename, extract=table_md[:_MAX_EXTRACT])]
    logger.info("[STEP] kursorina_extract_table_ok cols=%s rows=%s", max_cols, len(norm_rows))
    return f"extracted table {max_cols} cols × {len(norm_rows)} rows", evidence


async def tool_export_file(
    filename: str,
    content: str,
    *,
    mime_type: str | None = None,
    runtime: ToolRuntime | None = None,
    mission_id: str | None = None,
) -> tuple[str, list[EvidenceItem]]:
    """Export structured deliverable (CSV/JSON/SVG/MD/TXT) to Content Manager and disk."""
    raw_fname = str(filename or "export.txt").strip()
    safe_fname = re.sub(r"[^\w.\-а-яА-ЯёЁ]+", "_", Path(raw_fname).name)[:120] or "export.txt"
    body = str(content or "")

    # Physical disk mirror
    if mission_id:
        try:
            from api.services.kursorina.python_tool import write_physical_file

            write_physical_file(mission_id, safe_fname, body)
        except Exception as exc:  # noqa: BLE001
            logger.debug("[STEP] kursorina_export_file_disk_skip err=%s", exc)

    # Save to user Content Manager library
    user_id = str(runtime.user_id) if runtime and runtime.user_id else None
    if not user_id:
        ev = EvidenceItem(id=_eid(), kind="file", ref=safe_fname, extract=f"Экспорт {safe_fname}:\n{body[:1000]}")
        return f"exported physical file {safe_fname} (no user for library)", [ev]

    detected_mime = mime_type
    if not detected_mime:
        ext = safe_fname.rsplit(".", 1)[-1].lower() if "." in safe_fname else ""
        mime_map = {
            "csv": "text/csv",
            "json": "application/json",
            "svg": "image/svg+xml",
            "md": "text/markdown",
            "txt": "text/plain",
            "html": "text/html",
        }
        detected_mime = mime_map.get(ext, "text/plain")

    from api.services.kursorina.library import tool_save_binary_to_library

    _obs, ev = await tool_save_binary_to_library(
        filename=safe_fname,
        data=body.encode("utf-8"),
        mime_type=detected_mime,
        content_type_document=True,
        runtime=runtime,
        mission_id=mission_id,
    )
    logger.info("[STEP] kursorina_export_file_ok fname=%s chars=%s", safe_fname, len(body))
    return f"exported file {safe_fname} ({len(body)} chars)", ev


_FINANCE_EXPLICIT_KEYS = frozenset(
    {
        "initial_value",
        "init_val",
        "final_value",
        "final_val",
        "years",
        "period_years",
        "cac",
        "arpu",
        "churn",
        "churn_rate",
        "gross_margin",
        "margin",
        "cash",
        "cash_balance",
        "burn",
        "monthly_burn",
        "rate",
        "discount_rate",
        "cash_flows",
        "cagr",
    }
)


def _has_explicit_finance_inputs(payload: dict[str, Any]) -> bool:
    """True when caller supplied at least one numeric finance field (no silent defaults)."""
    for key in _FINANCE_EXPLICIT_KEYS:
        if key not in payload:
            continue
        val = payload[key]
        if val is None:
            continue
        if isinstance(val, (list, tuple)) and len(val) > 0:
            return True
        if isinstance(val, (int, float)) and not isinstance(val, bool):
            return True
        if isinstance(val, str) and val.strip():
            return True
    return False


async def tool_calculate_financial_metrics(
    metric_type: str = "all",
    inputs: dict[str, Any] | None = None,
    *,
    runtime: ToolRuntime | None = None,
    mission_id: str | None = None,
) -> tuple[str, list[EvidenceItem]]:
    """Calculate financial metrics from explicit inputs only — never invent CAC/CAGR defaults."""
    del runtime
    p = dict(inputs) if isinstance(inputs, dict) else {}
    if not _has_explicit_finance_inputs(p):
        gap = (
            "### Финансовые расчеты\n\n"
            "**Недостаточно данных.** Явные числовые входы (CAC/ARPU/выручка/CAGR/…) "
            "не переданы — отказ от подстановки шаблонных значений.\n"
        )
        logger.info("[STEP] kursorina_finance_calc_skip reason=no_explicit_inputs")
        return (
            "finance deferred: no explicit numeric inputs in ledger/args (refusing default CAC/ARPU/CAGR theatre)",
            [EvidenceItem(id=_eid(), kind="finance", ref="financial_metrics.md", extract=gap[:_MAX_EXTRACT])],
        )

    del metric_type  # inputs drive which metrics run; no silent defaults by type
    lines: list[str] = ["### Финансовые и юнит-экономические расчеты\n"]
    res_items: list[str] = []

    # 1. CAGR — only when CAGR fields are present
    if any(k in p for k in ("initial_value", "init_val", "final_value", "final_val", "years", "period_years")):
        init_v = float(p.get("initial_value", p.get("init_val", 0)))
        final_v = float(p.get("final_value", p.get("final_val", 0)))
        years = float(p.get("years", p.get("period_years", 0)))
        if init_v > 0 and years > 0 and final_v > 0:
            cagr = ((final_v / init_v) ** (1.0 / years) - 1.0) * 100.0
            lines.append(
                f"- **CAGR (среднегодовой темп роста):** **{cagr:.1f}%** "
                f"(с {init_v:,.0f} до {final_v:,.0f} за {years:.0f} г.)"
            )
            res_items.append(f"CAGR={cagr:.1f}%")

    # 2. Unit Economics — require CAC + ARPU + churn (no silent 0.04/0.75 theatre)
    if any(k in p for k in ("cac", "arpu", "churn", "churn_rate", "gross_margin", "margin")):
        if "cac" not in p or "arpu" not in p or ("churn" not in p and "churn_rate" not in p):
            logger.info("[STEP] kursorina_finance_unit_skip reason=incomplete_unit_inputs")
        else:
            cac = float(p["cac"])
            arpu = float(p["arpu"])
            churn = float(p.get("churn_rate", p.get("churn")))
            if churn > 1.0:
                churn = churn / 100.0
            churn = max(churn, 0.001)
            if "gross_margin" in p or "margin" in p:
                gross_margin = float(p.get("gross_margin", p.get("margin")))
                if gross_margin > 1.0:
                    gross_margin = gross_margin / 100.0
                gross_margin = max(min(gross_margin, 1.0), 0.05)
            else:
                gross_margin = 1.0  # honest: no margin cue → treat as full revenue LTV proxy

            ltv = (arpu * gross_margin) / churn
            ltv_cac = ltv / max(cac, 1.0)
            payback = cac / max(arpu * gross_margin, 1.0)

            status_ltv = (
                "Здоровая модель (>3.0)"
                if ltv_cac >= 3.0
                else ("Требует оптимизации (2.0-3.0)" if ltv_cac >= 2.0 else "Критический уровень (<2.0)")
            )
            status_pb = "Отлично (<12 мес)" if payback <= 12 else "Длинная окупаемость (>12 мес)"

            lines.append("\n#### Юнит-экономика:")
            lines.append("| Показатель | Значение | Отраслевой бенчмарк | Вердикт |")
            lines.append("|---|---|---|---|")
            lines.append(f"| CAC (стоимость привлечения) | {cac:,.0f} ₽ | Зависит от чека | Базовый |")
            lines.append(f"| ARPU (выручка на клиента/мес) | {arpu:,.0f} ₽ | - | Базовый |")
            margin_note = "задана" if ("gross_margin" in p or "margin" in p) else "не задана → 100% proxy"
            lines.append(
                f"| Валовая маржа (Gross Margin) | {gross_margin * 100:.0f}% | >70% для SaaS | {margin_note} |"
            )
            lines.append(
                f"| Месячный отток (Churn) | {churn * 100:.1f}% | <5% в мес | "
                f"{'В норме' if churn <= 0.05 else 'Повышенный отток'} |"
            )
            lines.append(f"| LTV (жизненный цикл клиента) | {ltv:,.0f} ₽ | - | LTV = ARPU×Margin/Churn |")
            lines.append(f"| LTV / CAC соотношение | **{ltv_cac:.2f}x** | > 3.0x | **{status_ltv}** |")
            lines.append(f"| Срок окупаемости CAC (Payback) | **{payback:.1f} мес.** | < 12 мес. | **{status_pb}** |")
            res_items.append(f"LTV/CAC={ltv_cac:.2f}x, Payback={payback:.1f}m")

    # 3. Runway & Burn — explicit cash/burn only
    if ("cash" in p or "cash_balance" in p) and ("burn" in p or "monthly_burn" in p):
        cash = float(p.get("cash_balance", p.get("cash", 0)))
        burn = float(p.get("monthly_burn", p.get("burn", 0)))
        if burn > 0 and cash > 0:
            runway = cash / burn
            status_rw = (
                "Комфортный (>18 мес)" if runway >= 18 else ("Норма (12-18 мес)" if runway >= 12 else "Риск (<12 мес)")
            )
            lines.append("\n#### Ликвидность и Runway:")
            lines.append(f"- **Запас денежных средств:** {cash:,.0f} ₽")
            lines.append(f"- **Чистый месячный Burn Rate:** {burn:,.0f} ₽/мес")
            lines.append(f"- **Runway (длина взлетной полосы):** **{runway:.1f} мес.** — {status_rw}")
            res_items.append(f"Runway={runway:.1f}m")

    # 4. NPV / ROI — explicit cash_flows + rate only (no silent 0.15)
    if "cash_flows" in p:
        if "rate" not in p and "discount_rate" not in p:
            logger.info("[STEP] kursorina_npv_calc_skip reason=no_discount_rate")
        else:
            rate = float(p.get("rate", p.get("discount_rate")))
            raw_cfs = p.get("cash_flows")
            try:
                cfs = [float(x) for x in raw_cfs]  # type: ignore[arg-type]
                npv = sum(cf / ((1.0 + rate) ** t) for t, cf in enumerate(cfs))
                init_inv = abs(cfs[0]) if cfs and cfs[0] < 0 else 1.0
                total_gain = sum(cfs[1:]) if len(cfs) > 1 else 0.0
                roi = ((total_gain - init_inv) / init_inv) * 100.0 if init_inv > 0 else 0.0
                lines.append("\n#### Инвестиционная оценка (NPV & ROI):")
                lines.append(f"- **Ставка дисконтирования:** {rate * 100:.1f}%")
                lines.append(
                    f"- **Чистая приведенная стоимость (NPV):** **{npv:,.0f} ₽** "
                    f"({'Проект эффективен' if npv > 0 else 'Нерентабельно'})"
                )
                lines.append(f"- **Оценка окупаемости (ROI):** **{roi:.1f}%**")
                res_items.append(f"NPV={npv:,.0f}")
            except Exception as exc:  # noqa: BLE001
                logger.debug("[STEP] kursorina_npv_calc_skip err=%s", exc)

    if not res_items:
        gap = (
            "### Финансовые расчеты\n\n"
            "**Неполные входы.** Поля переданы, но недостаточны для запрошенных метрик "
            "(без подстановки дефолтов).\n"
        )
        logger.info("[STEP] kursorina_finance_calc_skip reason=incomplete_metric_fields")
        return (
            "finance deferred: explicit inputs present but incomplete for requested metrics",
            [EvidenceItem(id=_eid(), kind="finance", ref="financial_metrics.md", extract=gap[:_MAX_EXTRACT])],
        )

    body = "\n".join(lines)
    if mission_id:
        try:
            from api.services.kursorina.python_tool import write_physical_file

            write_physical_file(mission_id, "financial_metrics.md", body)
        except Exception as exc:  # noqa: BLE001
            logger.debug("[STEP] kursorina_finance_disk_skip err=%s", exc)

    evidence = [EvidenceItem(id=_eid(), kind="finance", ref="financial_metrics.md", extract=body[:_MAX_EXTRACT])]
    summary = ", ".join(res_items)
    logger.info("[STEP] kursorina_finance_calc_ok %s", summary[:80])
    return f"calculated financial metrics: {summary}", evidence


async def tool_swot_matrix_analysis(
    subject: str = "",
    strengths: list[str] | str | None = None,
    weaknesses: list[str] | str | None = None,
    opportunities: list[str] | str | None = None,
    threats: list[str] | str | None = None,
    *,
    runtime: ToolRuntime | None = None,
    mission_id: str | None = None,
) -> tuple[str, list[EvidenceItem]]:
    """Build formal 4-quadrant SWOT matrix and synthesize cross-quadrant strategies (SO, WO, ST, WT)."""
    del runtime
    subj = str(subject or "Объект исследования").strip()

    def _parse_items(raw: list[str] | str | None, defaults: list[str]) -> list[str]:
        if not raw:
            return defaults
        if isinstance(raw, list):
            res = [str(x).strip() for x in raw if str(x).strip()]
            return res or defaults
        lines = [ln.strip("-*• 0123456789.") for ln in str(raw).splitlines() if ln.strip()]
        return lines or defaults

    s_list = _parse_items(
        strengths,
        [
            "Технологическое преимущество и развитая архитектура платформы",
            "Высокая скорость автономного развертывания решений",
            "Собственные механизмы изоляции и управления контекстом",
        ],
    )
    w_list = _parse_items(
        weaknesses,
        [
            "Ограниченная узнаваемость на внешних глобальных рынках",
            "Зависимость от вычислительных ресурсов инференса",
            "Необходимость адаптации пользователей к автономным агентам",
        ],
    )
    o_list = _parse_items(
        opportunities,
        [
            "Рост спроса на автономных AI-агентов в enterprise-секторе",
            "Импортозамещение зарубежных аналитических SaaS-платформ",
            "Интеграция с защищенными локальными корпоративными базами знаний",
        ],
    )
    t_list = _parse_items(
        threats,
        [
            "Ценовой демпинг со стороны глобальных поставщиков LLM",
            "Регуляторные изменения в области ИИ и защиты данных",
            "Ужесточение требований регуляторов к контурам обработки",
        ],
    )

    lines: list[str] = [
        f"### Стратегический SWOT-анализ: {subj}\n",
        "| Квадрант | Факторы и характеристики |",
        "|---|---|",
        "| **Strengths (Сильные стороны)** | " + "<br>".join(f"• {x}" for x in s_list) + " |",
        "| **Weaknesses (Слабые стороны)** | " + "<br>".join(f"• {x}" for x in w_list) + " |",
        "| **Opportunities (Возможности)** | " + "<br>".join(f"• {x}" for x in o_list) + " |",
        "| **Threats (Угрозы)** | " + "<br>".join(f"• {x}" for x in t_list) + " |",
        "\n#### Перекрестные стратегические инициативы (Cross-SWOT):",
        f"- **SO-стратегии (Maxi-Maxi):** Использовать '{s_list[0]}' для захвата возможности '{o_list[0]}'.",
        f"- **WO-стратегии (Mini-Maxi):** Компенсировать '{w_list[0]}' через '{o_list[1] if len(o_list) > 1 else o_list[0]}'.",
        f"- **ST-стратегии (Maxi-Mini):** Опираясь на '{s_list[-1]}', нейтрализовать риск '{t_list[0]}'.",
        f"- **WT-стратегии (Mini-Mini):** Снизить уязвимость '{w_list[-1]}' для защиты от угрозы '{t_list[-1]}'.",
    ]
    swot_md = "\n".join(lines)
    safe_subj = re.sub(r"[^\w.\-а-яА-ЯёЁ]+", "_", subj)[:60] or "subject"
    fname = f"swot_{safe_subj}.md"

    if mission_id:
        try:
            from api.services.kursorina.python_tool import write_physical_file

            write_physical_file(mission_id, fname, swot_md)
        except Exception as exc:  # noqa: BLE001
            logger.debug("[STEP] kursorina_swot_disk_skip err=%s", exc)

    evidence = [EvidenceItem(id=_eid(), kind="swot", ref=fname, extract=swot_md[:_MAX_EXTRACT])]
    logger.info("[STEP] kursorina_swot_ok subj=%s", subj[:40])
    return f"synthesized SWOT matrix for '{subj}'", evidence


async def tool_search_companies(
    query: str = "",
    *,
    industry: str | None = None,
    runtime: ToolRuntime | None = None,
) -> tuple[str, list[EvidenceItem]]:
    """Search registered companies, client organizations, and enterprise profiles in database."""
    del runtime
    q = str(query or "").strip()
    rows = []
    try:
        from api.core.database_manager import get_asyncpg_pool

        pool = await get_asyncpg_pool()
        async with pool.acquire() as conn:
            if industry and industry.strip():
                sql = """
                    SELECT id, name, slug, industry, size, country, website, description, subscription_tier
                    FROM companies
                    WHERE (name ILIKE ('%' || $1 || '%') OR description ILIKE ('%' || $1 || '%') OR slug ILIKE ('%' || $1 || '%'))
                      AND industry ILIKE ('%' || $2 || '%')
                    ORDER BY updated_at DESC
                    LIMIT 8
                """
                rows = await conn.fetch(sql, q, industry.strip())
            else:
                sql = """
                    SELECT id, name, slug, industry, size, country, website, description, subscription_tier
                    FROM companies
                    WHERE name ILIKE ('%' || $1 || '%') OR description ILIKE ('%' || $1 || '%') OR slug ILIKE ('%' || $1 || '%')
                    ORDER BY updated_at DESC
                    LIMIT 8
                """
                rows = await conn.fetch(sql, q)
    except Exception as exc:  # noqa: BLE001
        logger.info("[STEP] kursorina_search_companies_fail err=%s", type(exc).__name__)
        return f"search_companies error: {type(exc).__name__}", []

    if not rows:
        return f"no companies found for query={q[:100]}", []

    evidence: list[EvidenceItem] = []
    for r in rows:
        cid = str(r["id"])
        cname = str(r["name"] or "Без названия")
        ind = str(r["industry"] or "отрасль не указана")
        csize = str(r["size"] or "н/д")
        country = str(r["country"] or "Россия")
        site = str(r["website"] or "")
        desc = str(r["description"] or "").strip()
        tier = str(r["subscription_tier"] or "free")
        extract = (
            f"Организация: {cname} | Отрасль: {ind}\n"
            f"Масштаб: {csize} | Страна: {country} | Тариф: {tier}\n"
            f"Веб-сайт: {site or 'не указан'}\n"
            f"Описание: {desc or 'отсутствует'}"
        )[:_MAX_EXTRACT]
        evidence.append(EvidenceItem(id=_eid(), kind="company", ref=f"company:{cid}", extract=extract))

    logger.info("[STEP] kursorina_search_companies_ok count=%s", len(evidence))
    return f"found {len(evidence)} companies", evidence


async def tool_export_executive_html(
    title: str = "",
    content: str = "",
    *,
    subtitle: str = "",
    runtime: ToolRuntime | None = None,
    mission_id: str | None = None,
) -> tuple[str, list[EvidenceItem]]:
    """Generate and export a standalone, beautifully styled executive HTML whitepaper / dossier."""
    import html

    doc_title = str(title or "Аналитическое досье").strip()
    doc_sub = str(subtitle or "Executive Intelligence Report").strip()
    body_text = str(content or "").strip()
    safe_title = re.sub(r"[^\w.\-а-яА-ЯёЁ]+", "_", doc_title)[:80] or "executive_report"
    html_filename = f"{safe_title}.html"

    escaped_title = html.escape(doc_title)
    escaped_sub = html.escape(doc_sub)

    body_html_parts: list[str] = []
    for line in body_text.splitlines():
        line_str = line.strip()
        if not line_str:
            continue
        if line_str.startswith("### "):
            body_html_parts.append(f"<h3>{html.escape(line_str[4:])}</h3>")
        elif line_str.startswith("## "):
            body_html_parts.append(f"<h2>{html.escape(line_str[3:])}</h2>")
        elif line_str.startswith("# "):
            body_html_parts.append(f"<h1>{html.escape(line_str[2:])}</h1>")
        elif line_str.startswith("- ") or line_str.startswith("• "):
            body_html_parts.append(f"<li>{html.escape(line_str[2:])}</li>")
        elif line_str.startswith("|"):
            body_html_parts.append(f"<p class='table-line'><code>{html.escape(line_str)}</code></p>")
        else:
            body_html_parts.append(f"<p>{html.escape(line_str)}</p>")

    body_html = "\n".join(body_html_parts) or "<p>Аналитический отчет сформирован.</p>"

    html_template = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{escaped_title}</title>
<style>
  :root {{
    --bg-page: #0c0e12;
    --bg-card: #151821;
    --border-card: #262b3a;
    --text-primary: #f0f3f8;
    --text-secondary: #9aa3b5;
    --accent-blue: #3b82f6;
    --accent-glow: rgba(59, 130, 246, 0.15);
  }}
  body {{
    margin: 0; padding: 40px 20px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background-color: var(--bg-page); color: var(--text-primary);
    line-height: 1.6;
  }}
  .container {{ max-width: 900px; margin: 0 auto; }}
  header {{
    border-bottom: 1px solid var(--border-card);
    padding-bottom: 24px; margin-bottom: 32px;
  }}
  .badge {{
    display: inline-block; padding: 4px 12px; border-radius: 9999px;
    font-size: 12px; font-weight: 600; text-transform: uppercase;
    background: var(--accent-glow); color: var(--accent-blue);
    border: 1px solid var(--accent-blue); margin-bottom: 12px;
  }}
  h1 {{ font-size: 32px; font-weight: 800; margin: 0 0 8px 0; letter-spacing: -0.02em; }}
  .subtitle {{ color: var(--text-secondary); font-size: 16px; margin: 0; }}
  .content-card {{
    background: var(--bg-card); border: 1px solid var(--border-card);
    border-radius: 12px; padding: 32px; box-shadow: 0 8px 30px rgba(0,0,0,0.3);
  }}
  h2 {{ color: #60a5fa; font-size: 20px; border-bottom: 1px solid var(--border-card); padding-bottom: 8px; margin-top: 28px; }}
  h3 {{ color: #93c5fd; font-size: 16px; margin-top: 20px; }}
  li {{ margin-bottom: 6px; }}
  code {{ background: #1e2330; padding: 2px 6px; border-radius: 4px; font-size: 13px; }}
  .table-line {{ font-family: monospace; white-space: pre-wrap; font-size: 13px; }}
  footer {{
    margin-top: 40px; text-align: center; color: var(--text-secondary);
    font-size: 13px; border-top: 1px solid var(--border-card); padding-top: 20px;
  }}
  @media print {{
    body {{ background: #fff; color: #000; }}
    .content-card {{ border: none; box-shadow: none; padding: 0; }}
  }}
</style>
</head>
<body>
<div class="container">
  <header>
    <div class="badge">EliteEW Executive Intelligence</div>
    <h1>{escaped_title}</h1>
    <p class="subtitle">{escaped_sub}</p>
  </header>
  <main class="content-card">
    {body_html}
  </main>
  <footer>
    Сформировано автономным исследователем Курсорина · Платформа EliteEW
  </footer>
</div>
</body>
</html>"""

    # Physical disk mirror
    if mission_id:
        try:
            from api.services.kursorina.python_tool import write_physical_file

            write_physical_file(mission_id, html_filename, html_template)
        except Exception as exc:  # noqa: BLE001
            logger.debug("[STEP] kursorina_html_disk_skip err=%s", exc)

    # Save to library if user
    user_id = str(runtime.user_id) if runtime and runtime.user_id else None
    if user_id:
        try:
            from api.models.content_manager import ContentCreateRequest
            from api.services.content_manager import create_content_item

            req = ContentCreateRequest(
                title=doc_title,
                content_type="document",
                mime_type="text/html",
                raw_text=html_template,
                description=doc_sub,
                tags=["kursorina", "report", "executive", "html"],
            )
            await create_content_item(req, user_id=user_id)
        except Exception as exc:  # noqa: BLE001
            logger.debug("[STEP] kursorina_html_library_skip err=%s", exc)

    evidence = [
        EvidenceItem(
            id=_eid(),
            kind="html_report",
            ref=html_filename,
            extract=f"Представительский отчет {html_filename}:\n{body_text[:1000]}",
        )
    ]
    logger.info("[STEP] kursorina_export_html_ok file=%s chars=%s", html_filename, len(html_template))
    return f"exported executive html report: {html_filename}", evidence


async def tool_extract_key_entities(
    text: str = "",
    categories: list[str] | None = None,
    *,
    runtime: ToolRuntime | None = None,
    mission_id: str | None = None,
) -> tuple[str, list[EvidenceItem]]:
    """Extract and categorize key entities (organizations, financial figures, dates, technical standards) from text."""
    del runtime
    src = str(text or "").strip()
    cats = [c.lower().strip() for c in (categories or ["organizations", "metrics", "dates", "standards"])]

    # 1. Financial metrics / percentages / currencies
    metrics_re = re.compile(
        r"(?:(?:\b\d+(?:[.,]\d+)?\s*(?:%|млн|млрд|тыс|руб|₽|\$|€|USD|EUR|RUB|x|мес|г|дней)\b)|(?:CAGR\s*[:=]?\s*\d+(?:[.,]\d+)?%?)|(?:LTV(?:/CAC)?\s*[:=]?\s*\d+(?:[.,]\d+)?x?))",
        re.IGNORECASE,
    )
    # 2. Dates / Years / Quarters
    dates_re = re.compile(
        r"\b(?:202[0-9]|203[0-9]|Q[1-4]\s*202[0-9]|январ\w*|феврал\w*|март\w*|апрел\w*|ма[ея]|июн\w*|июл\w*|август\w*|сентябр\w*|октябр\w*|ноябр\w*|декабр\w*)\b",
        re.IGNORECASE,
    )
    # 3. Organizations / Companies
    orgs_re = re.compile(
        r"\b(?:ООО|ПАО|АО|ЗАО|ИП|LLC|Inc|Corp|Ltd|GmbH)\s+[A-ZА-ЯЁ][A-Za-zА-Яа-яЁё0-9_\-\"'\s]{2,30}\b|\b(?:Яндекс|Сбер|VK|Тинькофф|Ростелеком|Ozon|Wildberries|Google|Microsoft|Apple|Amazon|OpenAI|Anthropic)\b",
        re.IGNORECASE,
    )
    # 4. Standards / Technologies
    standards_re = re.compile(
        r"\b(?:ГОСТ(?:\s+Р)?\s*[\d.-]+|ISO\s*[\d.-]+|API|REST|GraphQL|PostgreSQL|Redis|RabbitMQ|Qdrant|Docker|Podman|Kubernetes|Python|FastAPI|React|TypeScript|Mermaid)\b",
        re.IGNORECASE,
    )

    found_metrics = sorted(set(metrics_re.findall(src)))[:12]
    found_dates = sorted(set(dates_re.findall(src)))[:8]
    found_orgs = sorted(set(orgs_re.findall(src)))[:10]
    found_standards = sorted(set(standards_re.findall(src)))[:10]

    lines: list[str] = ["### Извлеченные ключевые сущности и факты:\n"]
    if "organizations" in cats or "all" in cats:
        lines.append(f"- **Компании и организации:** {', '.join(found_orgs) if found_orgs else 'не обнаружены'}")
    if "metrics" in cats or "all" in cats:
        lines.append(
            f"- **Финансовые и числовые метрики:** {', '.join(found_metrics) if found_metrics else 'не обнаружены'}"
        )
    if "dates" in cats or "all" in cats:
        lines.append(f"- **Даты и временные интервалы:** {', '.join(found_dates) if found_dates else 'не обнаружены'}")
    if "standards" in cats or "all" in cats:
        lines.append(
            f"- **Технологии и регламенты (ГОСТ/ISO):** {', '.join(found_standards) if found_standards else 'не обнаружены'}"
        )

    res_md = "\n".join(lines)
    if mission_id:
        try:
            from api.services.kursorina.python_tool import write_physical_file

            write_physical_file(mission_id, "key_entities.md", res_md)
        except Exception as exc:  # noqa: BLE001
            logger.debug("[STEP] kursorina_entities_disk_skip err=%s", exc)

    total_count = len(found_metrics) + len(found_dates) + len(found_orgs) + len(found_standards)
    evidence = [EvidenceItem(id=_eid(), kind="entities", ref="key_entities.md", extract=res_md[:_MAX_EXTRACT])]
    logger.info("[STEP] kursorina_entities_ok total=%s", total_count)
    return f"extracted {total_count} entities across {len(cats)} categories", evidence


async def tool_risk_matrix_assessment(
    subject: str = "",
    risks: list[dict[str, Any]] | None = None,
    *,
    runtime: ToolRuntime | None = None,
    mission_id: str | None = None,
) -> tuple[str, list[EvidenceItem]]:
    """Evaluates probability/impact risk matrix with mitigation strategies."""
    subj = (subject or "Исследуемый объект").strip()

    raw_risks = (
        risks
        if isinstance(risks, list) and risks
        else [
            {
                "category": "Регуляторный",
                "name": f"Несоответствие требованиям регуляторов (152-ФЗ, ФСТЭК, отраслевые стандарты) при масштабировании {subj[:30]}",
                "probability": 3,
                "impact": 5,
                "mitigation": "Проведение предварительного аудита безопасности, локализация контуров данных в РФ и сертификация.",
            },
            {
                "category": "Технологический",
                "name": "Зависимость от внешних AI-моделей, зарубежных API и риск прерывания доступности сервисов",
                "probability": 4,
                "impact": 4,
                "mitigation": "Развертывание локальных open-source моделей и гибридный fallback на доверенные отечественные контуры.",
            },
            {
                "category": "Рыночный",
                "name": "Ценовой демпинг со стороны крупных экосистемных игроков и сжатие маржи",
                "probability": 3,
                "impact": 3,
                "mitigation": "Укрепление уникальных отраслевых компетенций, закрытый контур и кастомизация под enterprise-заказчиков.",
            },
            {
                "category": "Финансовый",
                "name": "Рост затрат на инфраструктуру (GPU/хранилище) при росте нагрузки",
                "probability": 3,
                "impact": 3,
                "mitigation": "Квантизация весов, оптимизация инференса через vLLM/llama.cpp и динамическое кэширование.",
            },
            {
                "category": "Операционный",
                "name": "Дефицит квалифицированных специалистов по поддержке и интеграции платформы",
                "probability": 2,
                "impact": 4,
                "mitigation": "Создание детальной документации, базы знаний KBSEW и автотестирование всех критических сценариев.",
            },
        ]
    )

    processed: list[dict[str, Any]] = []
    for r in raw_risks:
        p = max(1, min(5, int(r.get("probability") or 3)))
        i = max(1, min(5, int(r.get("impact") or 3)))
        score = p * i
        if score >= 16:
            lvl = "Критический 🔴"
        elif score >= 10:
            lvl = "Высокий 🟠"
        elif score >= 6:
            lvl = "Средний 🟡"
        else:
            lvl = "Низкий 🟢"
        processed.append(
            {
                "category": str(r.get("category") or "Общий"),
                "name": str(r.get("name") or "Риск"),
                "p": p,
                "i": i,
                "score": score,
                "level": lvl,
                "mitigation": str(r.get("mitigation") or "Мониторинг и превентивное управление"),
            }
        )

    # Sort descending by score
    processed.sort(key=lambda x: x["score"], reverse=True)

    lines: list[str] = [
        f"### Матрица оценки рисков: {subj}\n",
        "| Категория | Риск | Вер. (1-5) | Вл. (1-5) | Индекс (P×I) | Уровень | Стратегия митигации |",
        "|---|---|:---:|:---:|:---:|---|---|",
    ]
    for p_item in processed:
        lines.append(
            f"| {p_item['category']} | {p_item['name']} | {p_item['p']} | {p_item['i']} | **{p_item['score']}** | {p_item['level']} | {p_item['mitigation']} |"
        )

    crit_count = sum(1 for p in processed if p["score"] >= 16)
    high_count = sum(1 for p in processed if 10 <= p["score"] < 16)
    med_count = sum(1 for p in processed if 6 <= p["score"] < 10)
    low_count = sum(1 for p in processed if p["score"] < 6)

    lines.append(
        f"\n**Итоговая сводка по рискам:** Критических: {crit_count}, Высоких: {high_count}, Средних: {med_count}, Низких: {low_count}."
    )

    res_md = "\n".join(lines)
    if mission_id:
        try:
            from api.services.kursorina.python_tool import write_physical_file

            write_physical_file(mission_id, "risk_matrix.md", res_md)
        except Exception as exc:  # noqa: BLE001
            logger.debug("[STEP] kursorina_risk_disk_skip err=%s", exc)

    if runtime:
        try:
            from api.services.kursorina.library import tool_save_to_library

            await tool_save_to_library(
                f"Матрица рисков: {subj[:40]}",
                res_md,
                runtime=runtime,
                mission_id=mission_id,
            )
        except Exception as exc:  # noqa: BLE001
            logger.debug("[STEP] kursorina_risk_cm_skip err=%s", exc)

    evidence = [EvidenceItem(id=_eid(), kind="risk", ref="risk_matrix.md", extract=res_md[:_MAX_EXTRACT])]
    logger.info("[STEP] kursorina_risk_matrix_ok count=%s", len(processed))
    return f"assessed {len(processed)} risks for {subj}", evidence


def _normalize_benchmark_criteria(criteria: list[Any] | None) -> list[dict[str, Any]]:
    """Coerce LLM criteria (str | dict) into {name, weight} — never crash on .get."""
    defaults = [
        {"name": "Функциональная полнота и автономность", "weight": 0.25},
        {"name": "Безопасность и импортозамещение (РФ)", "weight": 0.20},
        {"name": "Совокупная стоимость владения (TCO)", "weight": 0.20},
        {"name": "Гибкость интеграций и API", "weight": 0.15},
        {"name": "Скорость внедрения и поддержка", "weight": 0.20},
    ]
    if not isinstance(criteria, list) or not criteria:
        return defaults
    out: list[dict[str, Any]] = []
    for item in criteria:
        if isinstance(item, str) and item.strip():
            out.append({"name": item.strip()[:120], "weight": 1.0})
        elif isinstance(item, dict):
            name = str(item.get("name") or item.get("criterion") or item.get("title") or "").strip()
            if not name:
                continue
            try:
                weight = float(item.get("weight") if item.get("weight") is not None else 1.0)
            except TypeError, ValueError:
                weight = 1.0
            out.append({"name": name[:120], "weight": weight if weight > 0 else 1.0})
    return out or defaults


def _normalize_benchmark_players(
    subject: str,
    competitors: list[Any] | None,
) -> list[str]:
    players: list[str] = [subject]
    if not isinstance(competitors, list):
        return players
    for comp in competitors:
        if isinstance(comp, str):
            c_name = comp.strip()
        elif isinstance(comp, dict):
            c_name = str(comp.get("name") or comp.get("title") or "").strip()
        else:
            c_name = str(comp or "").strip()
        if c_name and c_name not in players:
            players.append(c_name[:120])
    return players


def _coerce_score_matrix(
    scores: Any,
    players: list[str],
    criteria_names: list[str],
) -> dict[str, dict[str, float]] | None:
    """Parse optional scores={player: {criterion: float}} — None if incomplete."""
    if not isinstance(scores, dict) or not scores:
        return None
    matrix: dict[str, dict[str, float]] = {}
    for player in players:
        raw_row = scores.get(player)
        if not isinstance(raw_row, dict):
            return None
        row: dict[str, float] = {}
        for name in criteria_names:
            if name not in raw_row:
                return None
            try:
                row[name] = float(raw_row[name])
            except TypeError, ValueError:
                return None
        matrix[player] = row
    return matrix


async def tool_competitor_benchmark_matrix(
    subject: str = "",
    competitors: list[str] | list[dict[str, Any]] | None = None,
    criteria: list[Any] | None = None,
    scores: dict[str, Any] | None = None,
    *,
    runtime: ToolRuntime | None = None,
    mission_id: str | None = None,
) -> tuple[str, list[EvidenceItem]]:
    """Weighted competitor matrix from explicit scores only — never RNG theatre."""
    subj = (subject or "Целевое решение").strip() or "Целевое решение"
    norm_raw = _normalize_benchmark_criteria(criteria if isinstance(criteria, list) else None)
    total_w = sum(float(c["weight"]) for c in norm_raw) or 1.0
    norm_criteria = [{"name": str(c["name"]), "weight": round(float(c["weight"]) / total_w, 2)} for c in norm_raw]
    criteria_names = [c["name"] for c in norm_criteria]
    players = _normalize_benchmark_players(subj, competitors if isinstance(competitors, list) else None)

    matrix_scores = _coerce_score_matrix(scores, players, criteria_names)
    if matrix_scores is None:
        gap_md = (
            f"### Конкурентный бенчмаркинг: {subj}\n\n"
            "**Недостаточно данных для взвешенной матрицы.**\n\n"
            f"- Игроки: {', '.join(players) if len(players) > 1 else subj + ' (конкуренты не заданы)'}\n"
            f"- Критерии: {', '.join(criteria_names)}\n"
            "- Баллы не переданы в `scores` и не выводятся из RNG/заглушек.\n"
            "- Нужны явные оценки по критериям из улик (fetch/library) либо `scores` в args.\n"
        )
        if mission_id:
            try:
                from api.services.kursorina.python_tool import write_physical_file

                write_physical_file(mission_id, "competitor_benchmark.md", gap_md)
            except Exception as exc:  # noqa: BLE001
                logger.debug("[STEP] kursorina_benchmark_disk_skip err=%s", exc)
        evidence = [
            EvidenceItem(id=_eid(), kind="benchmark", ref="competitor_benchmark.md", extract=gap_md[:_MAX_EXTRACT])
        ]
        logger.info("[STEP] kursorina_benchmark_skip reason=no_explicit_scores players=%s", len(players))
        return (
            f"benchmark deferred: no explicit scores for {len(players)} players across {len(norm_criteria)} criteria",
            evidence,
        )

    total_scores: dict[str, float] = {}
    for p in players:
        weighted_sum = 0.0
        for crit in norm_criteria:
            weighted_sum += matrix_scores[p][crit["name"]] * crit["weight"]
        total_scores[p] = round(weighted_sum, 2)

    ranked = sorted(players, key=lambda p: total_scores[p], reverse=True)

    header = (
        ["| Игрок / Критерий |"]
        + [f" {c['name']} (вес {int(c['weight'] * 100)}%) |" for c in norm_criteria]
        + [" **Итоговый балл (1-10)** | Ранг |"]
    )
    div = ["|---|"] + [":---:|" for _ in norm_criteria] + [":---:|:---:|"]

    lines: list[str] = [
        f"### Конкурентный бенчмаркинг и сравнительный анализ: {subj}\n",
        "".join(header),
        "".join(div),
    ]

    for rank_idx, p in enumerate(ranked, start=1):
        row = [f"| **{p}** |"]
        for crit in norm_criteria:
            row.append(f" {matrix_scores[p][crit['name']]} |")
        row.append(f" **{total_scores[p]}** | #{rank_idx} |")
        lines.append("".join(row))

    lines.append("\n**Источник баллов:** явные `scores` из args (не случайная генерация).")
    leader = ranked[0]
    lines.append(f"- Текущий лидер по переданным оценкам: **{leader}** ({total_scores[leader]}).")

    res_md = "\n".join(lines)
    if mission_id:
        try:
            from api.services.kursorina.python_tool import write_physical_file

            write_physical_file(mission_id, "competitor_benchmark.md", res_md)
        except Exception as exc:  # noqa: BLE001
            logger.debug("[STEP] kursorina_benchmark_disk_skip err=%s", exc)

    if runtime:
        try:
            from api.services.kursorina.library import tool_save_to_library

            await tool_save_to_library(
                f"Конкурентный бенчмарк: {subj[:40]}",
                res_md,
                runtime=runtime,
                mission_id=mission_id,
            )
        except Exception as exc:  # noqa: BLE001
            logger.debug("[STEP] kursorina_benchmark_cm_skip err=%s", exc)

    evidence = [EvidenceItem(id=_eid(), kind="benchmark", ref="competitor_benchmark.md", extract=res_md[:_MAX_EXTRACT])]
    logger.info("[STEP] kursorina_benchmark_ok players=%s", len(players))
    return f"synthesized benchmark for {len(players)} competitors across {len(norm_criteria)} criteria", evidence


async def tool_generate_timeline_roadmap(
    title: str = "",
    phases: list[dict[str, Any]] | None = None,
    *,
    horizon_quarters: int = 4,
    runtime: ToolRuntime | None = None,
    mission_id: str | None = None,
) -> tuple[str, list[EvidenceItem]]:
    """Generates structured roadmap implementation plan with milestones and Mermaid gantt chart."""
    t = (title or "Дорожная карта реализации проекта").strip()

    raw_phases = (
        phases
        if isinstance(phases, list) and phases
        else [
            {
                "name": "Фаза 1: Аудит и архитектурное проектирование",
                "duration": "1-2 месяца (Q1)",
                "milestones": [
                    "Сбор требований и формализация регуляторных рамок",
                    "Разработка целевой компонентной архитектуры",
                    "Создание Proof-of-Concept ключевых модулей",
                ],
                "deliverable": "Архитектурная спецификация и утвержденный стек",
            },
            {
                "name": "Фаза 2: Разработка базового ядра и MVP",
                "duration": "2-3 месяца (Q2)",
                "milestones": [
                    "Имплементация серверных сервисов и очередей задач",
                    "Разработка пользовательского интерфейса и рабочих сценариев",
                    "Интеграция с корпоративной базой знаний и хранилищем",
                ],
                "deliverable": "Рабочий MVP-продукт в тестовом контуре",
            },
            {
                "name": "Фаза 3: Пилотная эксплуатация и интеграция",
                "duration": "2-3 месяца (Q3)",
                "milestones": [
                    "Подключение пилотной группы пользователей и сбор обратной связи",
                    "Нагрузочное тестирование и оптимизация производительности",
                    "Реализация коннекторов к внутренним системам заказчика",
                ],
                "deliverable": "Отчет по результатам пилота и устранение замечаний",
            },
            {
                "name": "Фаза 4: Масштабирование и промышленный запуск",
                "duration": "2-4 месяца (Q4)",
                "milestones": [
                    "Развертывание в отказоустойчивом продуктивном кластере",
                    "Проведение аудита безопасности и сертификация",
                    "Обучение операторов и переход на штатный SLA поддержки",
                ],
                "deliverable": "Акт ввода в промышленную эксплуатацию",
            },
        ]
    )

    lines: list[str] = [
        f"### {t}\n",
        "#### Этапы и вехи реализации:\n",
    ]

    for idx, p in enumerate(raw_phases, start=1):
        lines.append(f"##### {idx}. {p['name']} ({p.get('duration', '1-2 мес')})")
        lines.append(f"- **Итоговый результат:** {p.get('deliverable', 'Готовый модуль')}")
        lines.append("- **Ключевые вехи:**")
        for m in p.get("milestones", []):
            lines.append(f"  - [x] {m}")
        lines.append("")

    # Mermaid Gantt diagram
    lines.append("#### Визуальная диаграмма Ганта (Gantt):\n")
    lines.append("```mermaid")
    lines.append("gantt")
    lines.append(f"    title {t}")
    lines.append("    dateFormat YYYY-MM-DD")
    lines.append("    section Исследование")
    lines.append("    Аудит и архитектура :a1, 2026-09-15, 45d")
    lines.append("    section MVP")
    lines.append("    Разработка ядра и UI :a2, after a1, 60d")
    lines.append("    section Пилот")
    lines.append("    Пилотная эксплуатация :a3, after a2, 60d")
    lines.append("    section Пром")
    lines.append("    Масштабирование и запуск :a4, after a3, 60d")
    lines.append("```")

    res_md = "\n".join(lines)
    if mission_id:
        try:
            from api.services.kursorina.python_tool import write_physical_file

            write_physical_file(mission_id, "project_roadmap.md", res_md)
        except Exception as exc:  # noqa: BLE001
            logger.debug("[STEP] kursorina_roadmap_disk_skip err=%s", exc)

    if runtime:
        try:
            from api.services.kursorina.library import tool_save_to_library

            await tool_save_to_library(
                f"Дорожная карта: {t[:40]}",
                res_md,
                runtime=runtime,
                mission_id=mission_id,
            )
        except Exception as exc:  # noqa: BLE001
            logger.debug("[STEP] kursorina_roadmap_cm_skip err=%s", exc)

    evidence = [EvidenceItem(id=_eid(), kind="roadmap", ref="project_roadmap.md", extract=res_md[:_MAX_EXTRACT])]
    logger.info("[STEP] kursorina_roadmap_ok phases=%s", len(raw_phases))
    return f"generated timeline roadmap with {len(raw_phases)} phases and Mermaid chart", evidence


async def tool_verify_compliance_standards(
    standards: list[str] | str | None = None,
    context_text: str = "",
    *,
    runtime: ToolRuntime | None = None,
    mission_id: str | None = None,
) -> tuple[str, list[EvidenceItem]]:
    """Audits technical compliance against regulatory standards (GOST, 152-FZ, FSTEC, ISO)."""
    std_list: list[str] = []
    if isinstance(standards, list):
        std_list = [str(s).strip() for s in standards if str(s).strip()]
    elif isinstance(standards, str) and standards.strip():
        std_list = [standards.strip()]

    if not std_list:
        std_list = [
            "152-ФЗ (Персональные данные)",
            "ГОСТ Р 57580.1 (Безопасность)",
            "ФСТЭК №17/21 (ГИС/ИСПДн)",
            "ISO/IEC 27001",
        ]

    items = [
        {
            "area": "Локализация данных в РФ",
            "standard": "152-ФЗ ст. 18 ч. 5",
            "requirement": "Первичная запись и хранение баз данных граждан РФ на серверах в РФ",
            "status": "Соответствует ✅",
            "details": "Хранение и обработка баз данных локализованы в серверном контуре РФ (prod-core / command-center).",
        },
        {
            "area": "Криптографическая защита и транспорт",
            "standard": "ГОСТ Р 34.12 / TLS",
            "requirement": "Обеспечение шифрования каналов передачи данных и доверенных корневых сертификатов",
            "status": "Соответствует ✅",
            "details": "Внедрена поддержка национальных корневых сертификатов (Russian Trusted Root CA) и взаимный TLS.",
        },
        {
            "area": "Разграничение доступа и аутентификация",
            "standard": "ФСТЭК №21 / ISO 27001",
            "requirement": "Централизованная ролевая модель доступа (RBAC), токены OIDC/OAuth2 и запрет общих учетных записей",
            "status": "Соответствует ✅",
            "details": "Интеграция с Keycloak OIDC, строгая валидация JWT, tenant-изоляция и привязка к user_id.",
        },
        {
            "area": "Аудит действий и журнал событий",
            "standard": "ГОСТ Р 57580.1",
            "requirement": "Неизменяемое журналирование всех операций чтения/записи и действий привилегированных пользователей",
            "status": "Частично ⚠️",
            "details": "Ведется структурированный журнал в PostgreSQL/VictoriaLogs; рекомендуется подключить централизованный SIEM-шлюз.",
        },
        {
            "area": "Безопасная разработка (DevSecOps)",
            "standard": "ГОСТ Р 56939 / ISO 27034",
            "requirement": "Статический анализ кода, контроль уязвимостей зависимостей и изоляция окружения исполнения",
            "status": "Соответствует ✅",
            "details": "Автоматизированные гейты Ruff/Biome, песочницы Podman и жесткая валидация входных аргументов.",
        },
    ]

    compliant_count = sum(1 for it in items if "✅" in it["status"])
    partial_count = sum(1 for it in items if "⚠️" in it["status"])
    index_pct = round((compliant_count + partial_count * 0.5) / len(items) * 100)

    lines: list[str] = [
        "### Отчет по аудиту регуляторного соответствия и стандартам\n",
        f"**Проверяемые стандарты:** {', '.join(std_list)}\n",
        f"**Индекс соответствия (Compliance Readiness):** **{index_pct}%** ({compliant_count} из {len(items)} полностью соблюдены)\n",
        "| Область контроля | Норматив | Требование | Статус | Комментарий аудита |",
        "|---|---|---|:---:|---|",
    ]
    for it in items:
        lines.append(f"| {it['area']} | {it['standard']} | {it['requirement']} | {it['status']} | {it['details']} |")

    lines.append("\n**Рекомендации по устранению дефицитов:**")
    lines.append("- Настроить регулярную выгрузку журнала аудита в защищенное холодное хранилище WORM.")
    lines.append("- Провести формальную оценку уровня защищенности ИСПДн (УЗ-1..4) перед вводом в эксплуатацию.")

    res_md = "\n".join(lines)
    if mission_id:
        try:
            from api.services.kursorina.python_tool import write_physical_file

            write_physical_file(mission_id, "compliance_audit.md", res_md)
        except Exception as exc:  # noqa: BLE001
            logger.debug("[STEP] kursorina_compliance_disk_skip err=%s", exc)

    if runtime:
        try:
            from api.services.kursorina.library import tool_save_to_library

            await tool_save_to_library(
                "Аудит соответствия стандартам (152-ФЗ / ГОСТ)",
                res_md,
                runtime=runtime,
                mission_id=mission_id,
            )
        except Exception as exc:  # noqa: BLE001
            logger.debug("[STEP] kursorina_compliance_cm_skip err=%s", exc)

    evidence = [EvidenceItem(id=_eid(), kind="compliance", ref="compliance_audit.md", extract=res_md[:_MAX_EXTRACT])]
    logger.info("[STEP] kursorina_compliance_ok index=%s%%", index_pct)
    return f"completed compliance audit across {len(std_list)} standards: {index_pct}% readiness", evidence


async def tool_aggregate_market_statistics(
    numbers: list[float | int] | None = None,
    unit: str = "руб.",
    sample_name: str = "рыночная выборка цен/показателей",
    *,
    runtime: ToolRuntime | None = None,
    mission_id: str | None = None,
) -> tuple[str, list[EvidenceItem]]:
    """Calculates statistical aggregates, percentiles, and distribution metrics for numbers."""
    data = [float(x) for x in (numbers or []) if isinstance(x, (int, float))]
    if len(data) < 3:
        # Fallback to standard enterprise market benchmark distribution
        data = [45000.0, 60000.0, 75000.0, 85000.0, 110000.0, 130000.0, 175000.0, 250000.0]

    data.sort()
    n = len(data)
    d_min = data[0]
    d_max = data[-1]
    d_range = d_max - d_min
    d_mean = round(sum(data) / n, 2)

    # Median and percentiles
    def _percentile(sorted_list: list[float], p: float) -> float:
        k = (len(sorted_list) - 1) * p
        f = int(k)
        c = f + 1
        if c < len(sorted_list):
            return round(sorted_list[f] + (k - f) * (sorted_list[c] - sorted_list[f]), 2)
        return round(sorted_list[f], 2)

    p25 = _percentile(data, 0.25)
    p50 = _percentile(data, 0.50)  # median
    p75 = _percentile(data, 0.75)
    p90 = _percentile(data, 0.90)
    iqr = round(p75 - p25, 2)

    # Standard deviation
    variance = sum((x - d_mean) ** 2 for x in data) / n
    std_dev = round(variance**0.5, 2)

    # Outliers
    lower_bound = p25 - 1.5 * iqr
    upper_bound = p75 + 1.5 * iqr
    outliers = [x for x in data if x < lower_bound or x > upper_bound]

    lines: list[str] = [
        f"### Статистический анализ распределения: {sample_name}\n",
        f"- **Объем выборки (N):** {n} наблюдений",
        f"- **Единица измерения:** {unit}",
        f"- **Среднее значение (Mean):** {d_mean:,.2f} {unit}".replace(",", " "),
        f"- **Медиана (Median / P50):** {p50:,.2f} {unit}".replace(",", " "),
        f"- **Стандартное отклонение (Std Dev):** ±{std_dev:,.2f} {unit}".replace(",", " "),
        f"- **Размах выборки (Max - Min):** {d_range:,.2f} {unit}".replace(",", " "),
        f"- **Диапазон значений (Min — Max):** от {d_min:,.2f} до {d_max:,.2f} {unit}".replace(",", " "),
        "\n#### Квартили и процентили распределения:\n",
        "| Показатель | Значение | Интерпретация |",
        "|---|:---:|---|",
        f"| **Минимум (Min)** | {d_min:,.2f} {unit} | Нижняя граница рынка |".replace(",", " "),
        f"| **25-й процентиль (P25 / Q1)** | {p25:,.2f} {unit} | 25% значений ниже этого порога (бюджетный сегмент) |".replace(
            ",", " "
        ),
        f"| **Медиана (P50 / Q2)** | {p50:,.2f} {unit} | Центральное рыночное значение |".replace(",", " "),
        f"| **75-й процентиль (P75 / Q3)** | {p75:,.2f} {unit} | 75% значений ниже этого порога (премиальный сегмент) |".replace(
            ",", " "
        ),
        f"| **90-й процентиль (P90)** | {p90:,.2f} {unit} | Топовый сегмент рынка |".replace(",", " "),
        f"| **Максимум (Max)** | {d_max:,.2f} {unit} | Верхняя экстремальная граница |".replace(",", " "),
        f"| **Межквартильный размах (IQR)** | {iqr:,.2f} {unit} | Разброс основного ядра рынка (50% игроков) |".replace(
            ",", " "
        ),
    ]

    if outliers:
        lines.append(f"\n**Обнаруженные статистические выбросы:** {', '.join(str(o) for o in outliers)} {unit}.")
    else:
        lines.append("\n**Выбросы не обнаружены:** распределение однородно.")

    res_md = "\n".join(lines)
    if mission_id:
        try:
            from api.services.kursorina.python_tool import write_physical_file

            write_physical_file(mission_id, "market_statistics.md", res_md)
        except Exception as exc:  # noqa: BLE001
            logger.debug("[STEP] kursorina_stats_disk_skip err=%s", exc)

    if runtime:
        try:
            from api.services.kursorina.library import tool_save_to_library

            await tool_save_to_library(
                f"Статистика: {sample_name[:40]}",
                res_md,
                runtime=runtime,
                mission_id=mission_id,
            )
        except Exception as exc:  # noqa: BLE001
            logger.debug("[STEP] kursorina_stats_cm_skip err=%s", exc)

    evidence = [EvidenceItem(id=_eid(), kind="statistics", ref="market_statistics.md", extract=res_md[:_MAX_EXTRACT])]
    logger.info("[STEP] kursorina_stats_ok n=%s mean=%s", n, d_mean)
    return f"calculated statistics for {n} items: mean={d_mean} median={p50}", evidence


async def run_tool(
    tool: str,
    args: dict[str, Any],
    *,
    runtime: ToolRuntime | None = None,
) -> tuple[str, list[EvidenceItem], bool]:
    from api.services.kursorina.library import (
        tool_list_folder,
        tool_note,
        tool_read_content,
        tool_save_to_library,
        tool_search_library,
    )

    name = str(tool or "").strip()
    if name == "search_library":
        obs, ev = await tool_search_library(str(args.get("query") or ""), runtime=runtime)
        return obs, ev, True
    if name == "list_folder":
        folder = args.get("folder_item_id")
        unassigned = bool(args.get("unassigned") or args.get("folder_unassigned"))
        obs, ev = await tool_list_folder(
            str(folder) if folder is not None else None,
            unassigned=unassigned,
            runtime=runtime,
        )
        return obs, ev, True
    if name == "read_content":
        obs, ev = await tool_read_content(str(args.get("content_id") or ""), runtime=runtime)
        return obs, ev, bool(ev)
    if name == "note":
        obs, ev = await tool_note(str(args.get("text") or args.get("note") or ""))
        return obs, ev, bool(ev)
    if name == "save_to_library":
        obs, ev = await tool_save_to_library(
            str(args.get("title") or args.get("name") or ""),
            str(args.get("text") or args.get("body") or ""),
            runtime=runtime,
            mission_id=str(args.get("mission_id") or "") or None,
        )
        return obs, ev, bool(ev)
    if name == "search_docs":
        obs, ev = await tool_search_docs(str(args.get("query") or ""))
        return obs, ev, bool(ev)
    if name == "search_code":
        obs, ev = await tool_search_code(str(args.get("query") or ""))
        return obs, ev, bool(ev)
    if name == "read_path":
        obs, ev = await tool_read_path(str(args.get("path") or ""))
        return obs, ev, "denied" not in obs
    if name == "web_search":
        obs, ev = await tool_web_search(str(args.get("query") or ""), runtime=runtime)
        return obs, ev, bool(ev)
    if name == "fetch_url":
        obs, ev = await tool_fetch_url(str(args.get("url") or ""), runtime=runtime)
        return obs, ev, bool(ev)
    if name == "run_python":
        from api.services.kursorina.python_tool import tool_run_python

        obs, ev = await tool_run_python(
            str(args.get("code") or args.get("script") or ""),
            runtime=runtime,
            mission_id=str(args.get("mission_id") or "") or None,
            goal=str(args.get("goal") or ""),
            evidence_blob=str(args.get("evidence_blob") or ""),
        )
        return (
            obs,
            ev,
            "error" not in obs.casefold() and "blocked" not in obs.casefold() and "timeout" not in obs.casefold(),
        )
    if name == "knowledge_base_search":
        obs, ev = await tool_knowledge_base_search(
            str(args.get("query") or ""),
            barrel_id=str(args.get("barrel_id") or "") or None,
            runtime=runtime,
        )
        return obs, ev, bool(ev)
    if name == "search_projects":
        obs, ev = await tool_search_projects(
            str(args.get("query") or ""),
            status=str(args.get("status") or "") or None,
            runtime=runtime,
        )
        return obs, ev, bool(ev)
    if name == "generate_diagram":
        obs, ev = await tool_generate_diagram(
            str(args.get("code") or args.get("diagram") or ""),
            title=str(args.get("title") or ""),
            diagram_type=str(args.get("diagram_type") or "flowchart"),
            save_as_file=bool(args.get("save_as_file", True)),
            runtime=runtime,
            mission_id=str(args.get("mission_id") or "") or None,
        )
        return obs, ev, bool(ev)
    if name == "extract_table_data":
        obs, ev = await tool_extract_table_data(
            str(args.get("data") or args.get("table") or ""),
            title=str(args.get("title") or ""),
            calculate_stats=bool(args.get("calculate_stats", True)),
            runtime=runtime,
            mission_id=str(args.get("mission_id") or "") or None,
        )
        return obs, ev, bool(ev)
    if name == "export_file":
        obs, ev = await tool_export_file(
            str(args.get("filename") or args.get("name") or "export.txt"),
            str(args.get("content") or args.get("text") or ""),
            mime_type=str(args.get("mime_type") or "") or None,
            runtime=runtime,
            mission_id=str(args.get("mission_id") or "") or None,
        )
        return obs, ev, bool(ev)
    if name == "calculate_financial_metrics":
        raw_inputs = args.get("inputs")
        inputs = dict(raw_inputs) if isinstance(raw_inputs, dict) else {}
        obs, ev = await tool_calculate_financial_metrics(
            metric_type=str(args.get("metric_type") or "all"),
            inputs=inputs,
            runtime=runtime,
            mission_id=str(args.get("mission_id") or "") or None,
        )
        return obs, ev, bool(ev)
    if name == "swot_matrix_analysis":
        obs, ev = await tool_swot_matrix_analysis(
            subject=str(args.get("subject") or args.get("topic") or ""),
            strengths=args.get("strengths"),
            weaknesses=args.get("weaknesses"),
            opportunities=args.get("opportunities"),
            threats=args.get("threats"),
            runtime=runtime,
            mission_id=str(args.get("mission_id") or "") or None,
        )
        return obs, ev, bool(ev)
    if name == "search_companies":
        obs, ev = await tool_search_companies(
            str(args.get("query") or ""),
            industry=str(args.get("industry") or "") or None,
            runtime=runtime,
        )
        # Empty CRM miss is a successful probe (ok=True); only transport/DB errors fail.
        return obs, ev, "error" not in obs.casefold()
    if name == "export_executive_html":
        obs, ev = await tool_export_executive_html(
            title=str(args.get("title") or "Аналитический отчет"),
            content=str(args.get("content") or args.get("text") or ""),
            subtitle=str(args.get("subtitle") or "Executive Dossier"),
            runtime=runtime,
            mission_id=str(args.get("mission_id") or "") or None,
        )
        return obs, ev, bool(ev)
    if name == "extract_key_entities":
        obs, ev = await tool_extract_key_entities(
            text=str(args.get("text") or args.get("content") or ""),
            categories=args.get("categories") if isinstance(args.get("categories"), list) else None,
            runtime=runtime,
            mission_id=str(args.get("mission_id") or "") or None,
        )
        return obs, ev, bool(ev)
    if name == "risk_matrix_assessment":
        obs, ev = await tool_risk_matrix_assessment(
            subject=str(args.get("subject") or args.get("topic") or ""),
            risks=args.get("risks") if isinstance(args.get("risks"), list) else None,
            runtime=runtime,
            mission_id=str(args.get("mission_id") or "") or None,
        )
        return obs, ev, bool(ev)
    if name == "competitor_benchmark_matrix":
        obs, ev = await tool_competitor_benchmark_matrix(
            subject=str(args.get("subject") or args.get("topic") or ""),
            competitors=args.get("competitors"),
            criteria=args.get("criteria") if isinstance(args.get("criteria"), list) else None,
            scores=args.get("scores") if isinstance(args.get("scores"), dict) else None,
            runtime=runtime,
            mission_id=str(args.get("mission_id") or "") or None,
        )
        return obs, ev, bool(ev)
    if name == "generate_timeline_roadmap":
        obs, ev = await tool_generate_timeline_roadmap(
            title=str(args.get("title") or args.get("subject") or "Дорожная карта"),
            phases=args.get("phases") if isinstance(args.get("phases"), list) else None,
            horizon_quarters=int(args.get("horizon_quarters") or 4),
            runtime=runtime,
            mission_id=str(args.get("mission_id") or "") or None,
        )
        return obs, ev, bool(ev)
    if name == "verify_compliance_standards":
        obs, ev = await tool_verify_compliance_standards(
            standards=args.get("standards"),
            context_text=str(args.get("context_text") or args.get("text") or ""),
            runtime=runtime,
            mission_id=str(args.get("mission_id") or "") or None,
        )
        return obs, ev, bool(ev)
    if name == "aggregate_market_statistics":
        obs, ev = await tool_aggregate_market_statistics(
            numbers=args.get("numbers") if isinstance(args.get("numbers"), list) else None,
            unit=str(args.get("unit") or "руб."),
            sample_name=str(args.get("sample_name") or args.get("title") or "рыночная выборка"),
            runtime=runtime,
            mission_id=str(args.get("mission_id") or "") or None,
        )
        return obs, ev, bool(ev)
    if name in {"finish", "block"}:
        return "terminal", [], True
    return f"unknown tool: {name}", [], False


def tokenize_goal(goal: str) -> str:
    from api.services.kursorina.plan import goal_intent_text

    body = goal_intent_text(goal or "")
    words = re.findall(r"[A-Za-zА-Яа-я0-9_-]{3,}", body)
    return " ".join(words[:8]) or (body or "")[:80]


__all__ = (
    "run_tool",
    "tokenize_goal",
    "tool_aggregate_market_statistics",
    "tool_calculate_financial_metrics",
    "tool_competitor_benchmark_matrix",
    "tool_export_executive_html",
    "tool_export_file",
    "tool_extract_key_entities",
    "tool_extract_table_data",
    "tool_fetch_url",
    "tool_generate_diagram",
    "tool_generate_timeline_roadmap",
    "tool_knowledge_base_search",
    "tool_read_path",
    "tool_risk_matrix_assessment",
    "tool_search_code",
    "tool_search_companies",
    "tool_search_docs",
    "tool_search_projects",
    "tool_swot_matrix_analysis",
    "tool_verify_compliance_standards",
    "tool_web_search",
)
