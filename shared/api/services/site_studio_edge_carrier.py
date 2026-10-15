# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Static Site-Image pack + Carrier deploy/undeploy for Site Studio Edge (worker build → .10 run).
# Resolves content as runtime_dist → HTTP storefront snapshot → minimal stub; records edge_content_source.
# Invariants:
# - No secrets in logs; SITE_EDGE_SSH is host identity only.
# - When SITE_EDGE_CARRIER_ENABLED is off, callers must not invoke deploy.
# - Public Edge publish success requires content_source in {runtime_dist, snapshot}; stub fails unless
#   SITE_EDGE_ALLOW_STUB_PUBLISH is explicitly enabled (operator dry-run only).
# - Edge serves static packs only (no Postgres / olenti API on Celeron).
# Related:
# - documentation/platform/SITE-EDGE-CARRIER.md
# - docker/scripts/site-edge-carrier-deploy.sh
# - api/routers/desktop_sites.py
# ---
from __future__ import annotations

import asyncio
import hashlib
import html
import logging
import os
import re
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal
from urllib.parse import urljoin, urlparse

from api.services.queue_features import env_flag

logger = logging.getLogger(__name__)

SITE_EDGE_CARRIER_ENABLED_ENV = "SITE_EDGE_CARRIER_ENABLED"
SITE_EDGE_SSH_ENV = "SITE_EDGE_SSH"
SITE_EDGE_WORKDIR_ENV = "SITE_EDGE_WORKDIR"
SITE_EDGE_PORT_BASE_ENV = "SITE_EDGE_PORT_BASE"
SITE_EDGE_PORT_SPAN_ENV = "SITE_EDGE_PORT_SPAN"
SITE_EDGE_CARRIER_SCRIPT_ENV = "SITE_EDGE_CARRIER_SCRIPT"
SITE_EDGE_PUBLIC_BASE_ENV = "SITE_EDGE_PUBLIC_BASE"
SITE_EDGE_ALLOW_STUB_PUBLISH_ENV = "SITE_EDGE_ALLOW_STUB_PUBLISH"

DEFAULT_PORT_BASE = 8080
DEFAULT_PORT_SPAN = 100

EdgeContentSource = Literal["runtime_dist", "snapshot", "stub"]
CONTENT_SOURCE_RUNTIME = "runtime_dist"
CONTENT_SOURCE_SNAPSHOT = "snapshot"
CONTENT_SOURCE_STUB = "stub"
PUBLIC_EDGE_CONTENT_SOURCES: frozenset[str] = frozenset({CONTENT_SOURCE_RUNTIME, CONTENT_SOURCE_SNAPSHOT})

_ASSET_ATTR_RE = re.compile(
    r"""(?:href|src)\s*=\s*["']([^"'#?]+)(?:[?#][^"']*)?["']""",
    re.IGNORECASE,
)
_SNAPSHOT_MIN_BYTES = 200
_SNAPSHOT_MAX_ASSETS = 40
_SNAPSHOT_TIMEOUT_S = 12.0


class SiteStudioEdgeCarrierError(RuntimeError):
    """Raised when Edge pack/build/deploy fails."""


@dataclass(frozen=True)
class EdgeContentPack:
    """Resolved static tree for Carrier plus honesty label for health/UI."""

    path: Path
    source: EdgeContentSource


def site_edge_carrier_enabled() -> bool:
    return env_flag(SITE_EDGE_CARRIER_ENABLED_ENV, default=False)


def site_edge_allow_stub_publish() -> bool:
    """Operator dry-run only. Default off — stub must not count as public Edge success."""
    return env_flag(SITE_EDGE_ALLOW_STUB_PUBLISH_ENV, default=False)


def site_edge_ssh_configured() -> bool:
    return bool((os.environ.get(SITE_EDGE_SSH_ENV) or "").strip())


def site_edge_public_base() -> str:
    return (os.environ.get(SITE_EDGE_PUBLIC_BASE_ENV) or "").strip().rstrip("/")


def assert_public_edge_content_source(source: EdgeContentSource | str) -> None:
    """Fail closed when Carrier would publish stub-only content as a live visitor site."""
    if source in PUBLIC_EDGE_CONTENT_SOURCES:
        return
    if source == CONTENT_SOURCE_STUB and site_edge_allow_stub_publish():
        logger.warning(
            "[STEP] site_studio_edge_stub_publish_allowed env=%s",
            SITE_EDGE_ALLOW_STUB_PUBLISH_ENV,
        )
        return
    raise SiteStudioEdgeCarrierError(
        "Edge publish requires runtime_dist or storefront snapshot content; "
        f"got content_source={source!r}. Start the storefront (for snapshot) or ensure "
        "runtime frontend dist exists before publishing. "
        f"Stub publish is blocked unless {SITE_EDGE_ALLOW_STUB_PUBLISH_ENV}=1 (operator dry-run)."
    )


def allocate_edge_port(slug: str, *, port_base: int | None = None, port_span: int | None = None) -> int:
    """Stable host port in [base, base+span) derived from site slug."""
    base = (
        port_base
        if port_base is not None
        else int((os.environ.get(SITE_EDGE_PORT_BASE_ENV) or str(DEFAULT_PORT_BASE)).strip() or DEFAULT_PORT_BASE)
    )
    span = (
        port_span
        if port_span is not None
        else int((os.environ.get(SITE_EDGE_PORT_SPAN_ENV) or str(DEFAULT_PORT_SPAN)).strip() or DEFAULT_PORT_SPAN)
    )
    span = max(1, span)
    digest = hashlib.sha256((slug or "site").encode("utf-8")).hexdigest()
    offset = int(digest[:8], 16) % span
    return base + offset


def edge_url_for_port(port: int) -> str | None:
    base = site_edge_public_base()
    if not base:
        ssh = (os.environ.get(SITE_EDGE_SSH_ENV) or "").strip()
        if "@" in ssh:
            host = ssh.rsplit("@", 1)[-1].strip()
            if host:
                base = f"http://{host}"
    if not base:
        return None
    return f"{base}:{port}"


def build_edge_health_snapshot(instance: Any) -> dict[str, Any]:
    ports = instance.ports_json if isinstance(getattr(instance, "ports_json", None), dict) else {}
    port_raw = ports.get("edge_http")
    port = int(port_raw) if isinstance(port_raw, int | str) and str(port_raw).isdigit() else None
    url = ports.get("edge_url") if isinstance(ports.get("edge_url"), str) else None
    if not url and port is not None:
        url = edge_url_for_port(port)
    content_source = ports.get("edge_content_source")
    if content_source not in {
        CONTENT_SOURCE_RUNTIME,
        CONTENT_SOURCE_SNAPSHOT,
        CONTENT_SOURCE_STUB,
    }:
        content_source = None
    return {
        "enabled": site_edge_carrier_enabled(),
        "ssh_configured": site_edge_ssh_configured(),
        "port": port,
        "url": url,
        "last_error": ports.get("edge_last_error") if isinstance(ports.get("edge_last_error"), str) else None,
        "deployed_at": ports.get("edge_deployed_at") if isinstance(ports.get("edge_deployed_at"), str) else None,
        "content_source": content_source,
    }


# Host path used by stack0 site-studio-worker volume mounts (compose binds repo docker/ here).
SITE_EDGE_CARRIER_SCRIPT_HOST_DEFAULT = "/opt/eliteew/docker/scripts/site-edge-carrier-deploy.sh"


def _carrier_script_candidates() -> list[Path]:
    """Ordered lookup for Carrier deploy script across host checkout and container mounts."""
    candidates: list[Path] = []
    configured = (os.environ.get(SITE_EDGE_CARRIER_SCRIPT_ENV) or "").strip()
    if configured:
        candidates.append(Path(configured))
    repo_env = (os.environ.get("ELITEEW_REPO_ROOT") or "").strip()
    if repo_env:
        candidates.append(Path(repo_env) / "docker" / "scripts" / "site-edge-carrier-deploy.sh")
    candidates.append(Path(SITE_EDGE_CARRIER_SCRIPT_HOST_DEFAULT))
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidates.append(parent / "docker" / "scripts" / "site-edge-carrier-deploy.sh")
    # Deduplicate while preserving order
    seen: set[str] = set()
    ordered: list[Path] = []
    for path in candidates:
        key = str(path)
        if key in seen:
            continue
        seen.add(key)
        ordered.append(path)
    return ordered


def resolve_carrier_script() -> Path:
    configured = (os.environ.get(SITE_EDGE_CARRIER_SCRIPT_ENV) or "").strip()
    if configured:
        path = Path(configured)
        if path.is_file():
            return path
        if path.is_dir():
            raise SiteStudioEdgeCarrierError(
                f"SITE_EDGE_CARRIER_SCRIPT is a directory (bad bind mount of missing file?): {configured}"
            )
        raise SiteStudioEdgeCarrierError(f"SITE_EDGE_CARRIER_SCRIPT not found: {configured}")

    tried: list[str] = []
    for candidate in _carrier_script_candidates():
        tried.append(str(candidate))
        if candidate.is_file():
            return candidate
    raise SiteStudioEdgeCarrierError(
        "Carrier script not found. Tried: "
        + "; ".join(tried[:6])
        + ("; …" if len(tried) > 6 else "")
        + ". Mount docker/scripts + docker/builders/site-edge-carrier into site-studio-worker "
        "or set SITE_EDGE_CARRIER_SCRIPT. Ensure the host path is a file before compose up "
        "(missing source becomes an empty directory bind)."
    )


def _find_runtime_frontend_dist(instance: Any) -> Path | None:
    """Prefer an existing frontend dist under the instance runtime dirs."""
    candidates: list[Path] = []
    for attr in ("runtime_dir", "source_dir"):
        raw = getattr(instance, attr, None)
        if not raw:
            continue
        root = Path(str(raw))
        candidates.extend(
            [
                root / "frontend" / "dist",
                root / "frontend" / "dist-build",
                root / "dist",
                root / "dist-build",
                root / "elite_frontend" / "dist",
            ]
        )
    for path in candidates:
        index = path / "index.html"
        if index.is_file():
            return path
    return None


def _safe_brief_lines(brief_json: Any, *, limit: int = 8) -> list[str]:
    if not isinstance(brief_json, dict):
        return []
    lines: list[str] = []
    for key in ("summary", "audience", "offer", "style", "tone", "description"):
        value = brief_json.get(key)
        if isinstance(value, str) and value.strip():
            lines.append(f"{key}: {value.strip()}")
        if len(lines) >= limit:
            break
    return lines


def write_minimal_static_pack(
    target_dir: Path,
    *,
    site_title: str,
    site_topic: str,
    brief_json: Any = None,
) -> Path:
    """Write a minimal honest static pack (index.html) for Edge when no runtime dist exists."""
    target_dir.mkdir(parents=True, exist_ok=True)
    title = html.escape((site_title or "Site").strip() or "Site")
    topic = html.escape((site_topic or "").strip())
    brief_items = "".join(f"<li>{html.escape(line)}</li>" for line in _safe_brief_lines(brief_json))
    brief_block = f"<ul>{brief_items}</ul>" if brief_items else "<p>Static Edge preview pack.</p>"
    index = target_dir / "index.html"
    index.write_text(
        f"""<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <style>
      :root {{ color-scheme: light dark; font-family: system-ui, sans-serif; }}
      body {{ margin: 0; padding: 2rem; line-height: 1.5; }}
      main {{ max-width: 42rem; margin: 0 auto; }}
      .meta {{ opacity: 0.75; font-size: 0.95rem; }}
    </style>
  </head>
  <body>
    <main>
      <h1>{title}</h1>
      <p class="meta">{topic or "Site Studio Edge"}</p>
      {brief_block}
      <p class="meta">Published via Site-Edge Carrier (static pack).</p>
    </main>
  </body>
</html>
""",
        encoding="utf-8",
    )
    return target_dir


def build_static_content_dir(instance: Any, *, work_root: Path | None = None) -> Path:
    """Sync helper: runtime dist or stub (no HTTP snapshot). Prefer ``resolve_edge_content_pack``."""
    existing = _find_runtime_frontend_dist(instance)
    if existing is not None:
        return existing
    root = work_root or Path(tempfile.mkdtemp(prefix="site-edge-pack-"))
    pack_dir = root / "content"
    write_minimal_static_pack(
        pack_dir,
        site_title=str(getattr(instance, "site_title", "") or ""),
        site_topic=str(getattr(instance, "site_topic", "") or ""),
        brief_json=getattr(instance, "brief_json", None),
    )
    return pack_dir


def _is_edge_lan_url(url: str) -> bool:
    """True when URL already points at the Edge LAN host (avoid snapshot loops)."""
    try:
        host = (urlparse(url).hostname or "").strip().lower()
    except Exception:  # noqa: BLE001 — malformed URL
        return False
    if not host:
        return False
    public_base = site_edge_public_base()
    if public_base:
        try:
            base_host = (urlparse(public_base).hostname or "").strip().lower()
        except Exception:  # noqa: BLE001
            base_host = ""
        if base_host and host == base_host:
            return True
    ssh = (os.environ.get(SITE_EDGE_SSH_ENV) or "").strip()
    if "@" in ssh:
        edge_host = ssh.rsplit("@", 1)[-1].strip().lower()
        if edge_host and host == edge_host:
            return True
    return False


def _snapshot_url_candidates(instance: Any) -> list[str]:
    """Ordered storefront URLs to try for a static HTML snapshot (never Edge LAN)."""
    candidates: list[str] = []

    def _add(raw: Any) -> None:
        if not isinstance(raw, str):
            return
        url = raw.strip().rstrip("/")
        if not url or not url.startswith(("http://", "https://")):
            return
        if _is_edge_lan_url(url):
            return
        if url not in candidates:
            candidates.append(url)

    compose = str(getattr(instance, "compose_project_name", "") or "").strip()
    if compose:
        try:
            from api.services.site_studio_runtime_service import (
                build_site_studio_internal_public_url,
            )

            _add(build_site_studio_internal_public_url(compose))
        except Exception:  # noqa: BLE001 — optional import path
            logger.debug(
                "[STEP] site_studio_edge_internal_url_skip",
                exc_info=True,
            )

    ports = instance.ports_json if isinstance(getattr(instance, "ports_json", None), dict) else {}
    for key in ("frontend_url", "public_http_url", "storefront_url"):
        _add(ports.get(key))

    for attr in ("public_url",):
        _add(getattr(instance, attr, None))

    rewritten = None
    try:
        from api.services.site_studio_runtime_service import rewrite_site_studio_internal_url

        rewritten = rewrite_site_studio_internal_url(getattr(instance, "public_url", None))
    except Exception:  # noqa: BLE001
        rewritten = None
    _add(rewritten)
    return candidates


def _safe_relpath_from_url(base: str, asset_url: str) -> str | None:
    parsed = urlparse(asset_url)
    if parsed.scheme and parsed.scheme not in {"http", "https"}:
        return None
    base_host = (urlparse(base).hostname or "").lower()
    asset_host = (parsed.hostname or base_host).lower()
    if parsed.hostname and asset_host != base_host:
        return None
    path = parsed.path or ""
    if not path or path.endswith("/"):
        return None
    # Strip leading slash → relative file under content dir
    rel = path.lstrip("/")
    if not rel or ".." in Path(rel).parts:
        return None
    return rel


async def _download_same_origin_assets(
    *,
    client: Any,
    base_url: str,
    html_body: str,
    target_dir: Path,
) -> int:
    saved = 0
    seen: set[str] = set()
    for match in _ASSET_ATTR_RE.finditer(html_body):
        if saved >= _SNAPSHOT_MAX_ASSETS:
            break
        ref = (match.group(1) or "").strip()
        if not ref or ref.startswith(("data:", "mailto:", "javascript:", "#")):
            continue
        absolute = urljoin(base_url if base_url.endswith("/") else base_url + "/", ref)
        if absolute in seen:
            continue
        seen.add(absolute)
        rel = _safe_relpath_from_url(base_url, absolute)
        if not rel:
            continue
        dest = target_dir / rel
        if dest.exists():
            continue
        try:
            response = await client.get(absolute, follow_redirects=True)
            if response.status_code >= 400:
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(response.content)
            saved += 1
        except Exception:  # noqa: BLE001 — best-effort assets
            logger.debug(
                "[STEP] site_studio_edge_snapshot_asset_skip url=%s",
                absolute[:200],
                exc_info=True,
            )
    return saved


async def export_static_snapshot(instance: Any, target_dir: Path) -> bool:
    """Fetch live storefront HTML (+ same-origin assets) into ``target_dir``. Returns True on success."""
    candidates = _snapshot_url_candidates(instance)
    if not candidates:
        return False

    target_dir.mkdir(parents=True, exist_ok=True)
    try:
        from api.core.http_clients import get_httpx_client
    except Exception:  # noqa: BLE001
        logger.debug("[STEP] site_studio_edge_snapshot_http_client_skip", exc_info=True)
        return False

    client = get_httpx_client()
    for url in candidates:
        try:
            response = await asyncio.wait_for(
                client.get(url, follow_redirects=True),
                timeout=_SNAPSHOT_TIMEOUT_S,
            )
        except Exception:  # noqa: BLE001 — try next candidate
            logger.debug(
                "[STEP] site_studio_edge_snapshot_fetch_skip url=%s",
                url[:200],
                exc_info=True,
            )
            continue
        if response.status_code >= 400:
            continue
        body = response.text or ""
        if len(body.encode("utf-8", errors="replace")) < _SNAPSHOT_MIN_BYTES:
            continue
        if "Published via Site-Edge Carrier (static pack)" in body:
            # Already a stub page — not a real storefront snapshot.
            continue
        ctype = (response.headers.get("content-type") or "").lower()
        if "html" not in ctype and "<html" not in body[:500].lower():
            continue
        index = target_dir / "index.html"
        index.write_text(body, encoding="utf-8")
        assets = await _download_same_origin_assets(
            client=client,
            base_url=str(response.url),
            html_body=body,
            target_dir=target_dir,
        )
        logger.info(
            "[STEP] site_studio_edge_content_snapshot slug=%s url=%s assets=%s",
            getattr(instance, "site_slug", None),
            url[:200],
            assets,
        )
        return True
    return False


async def resolve_edge_content_pack(instance: Any, *, work_root: Path | None = None) -> EdgeContentPack:
    """Resolve static content: runtime dist → HTTP snapshot → minimal stub."""
    existing = _find_runtime_frontend_dist(instance)
    if existing is not None:
        logger.info(
            "[STEP] site_studio_edge_content_from_runtime slug=%s path=%s",
            getattr(instance, "site_slug", None),
            existing,
        )
        return EdgeContentPack(path=existing, source=CONTENT_SOURCE_RUNTIME)

    root = work_root or Path(tempfile.mkdtemp(prefix="site-edge-pack-"))
    pack_dir = root / "content"
    if await export_static_snapshot(instance, pack_dir):
        return EdgeContentPack(path=pack_dir, source=CONTENT_SOURCE_SNAPSHOT)

    write_minimal_static_pack(
        pack_dir,
        site_title=str(getattr(instance, "site_title", "") or ""),
        site_topic=str(getattr(instance, "site_topic", "") or ""),
        brief_json=getattr(instance, "brief_json", None),
    )
    logger.info(
        "[STEP] site_studio_edge_content_generated slug=%s path=%s",
        getattr(instance, "site_slug", None),
        pack_dir,
    )
    return EdgeContentPack(path=pack_dir, source=CONTENT_SOURCE_STUB)


def _merge_ports(instance: Any, updates: dict[str, Any]) -> dict[str, Any]:
    ports = dict(instance.ports_json) if isinstance(getattr(instance, "ports_json", None), dict) else {}
    ports.update(updates)
    instance.ports_json = ports
    return ports


async def _run_cmd(cmd: list[str], *, env: dict[str, str] | None = None) -> None:
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )
    stdout_b, stderr_b = await proc.communicate()
    stdout = (stdout_b or b"").decode("utf-8", errors="replace")
    stderr = (stderr_b or b"").decode("utf-8", errors="replace")
    if proc.returncode != 0:
        detail = (stderr or stdout or f"exit={proc.returncode}").strip()
        raise SiteStudioEdgeCarrierError(detail[:2000])
    if stdout.strip():
        logger.info("[STEP] site_studio_edge_cmd_ok cmd=%s out=%s", cmd[0], stdout.strip()[:500])


async def deploy_instance_to_edge(instance: Any) -> dict[str, Any]:
    """Build Site-Image via Carrier script and deploy to SITE_EDGE_SSH host."""
    if not site_edge_carrier_enabled():
        raise SiteStudioEdgeCarrierError("SITE_EDGE_CARRIER_ENABLED is off")
    if not site_edge_ssh_configured():
        raise SiteStudioEdgeCarrierError("SITE_EDGE_SSH is not configured on the worker host")

    slug = str(getattr(instance, "site_slug", "") or "").strip()
    if not slug:
        raise SiteStudioEdgeCarrierError("site_slug is required")

    script = resolve_carrier_script()
    port = allocate_edge_port(slug)
    work_root = Path(tempfile.mkdtemp(prefix=f"site-edge-{slug}-"))
    try:
        pack = await resolve_edge_content_pack(instance, work_root=work_root)
        assert_public_edge_content_source(pack.source)
        content_dir = pack.path
        env = os.environ.copy()
        env["SITE_EDGE_SSH"] = (os.environ.get(SITE_EDGE_SSH_ENV) or "").strip()
        workdir = (os.environ.get(SITE_EDGE_WORKDIR_ENV) or "").strip()
        if workdir:
            env["SITE_EDGE_WORKDIR"] = workdir

        cmd = [
            "bash",
            str(script),
            "--slug",
            slug,
            "--content-dir",
            str(content_dir),
            "--host-port",
            str(port),
            "--yes",
        ]
        logger.info(
            "[STEP] site_studio_edge_deploy_start slug=%s port=%s source=%s ssh_set=%s",
            slug,
            port,
            pack.source,
            bool(env.get("SITE_EDGE_SSH")),
        )
        await _run_cmd(cmd, env=env)

        from api.utils.datetime_helpers import utc_now_naive

        url = edge_url_for_port(port)
        ports = _merge_ports(
            instance,
            {
                "edge_http": port,
                "edge_url": url,
                "edge_last_error": None,
                "edge_content_source": pack.source,
                "edge_deployed_at": utc_now_naive().isoformat(timespec="seconds"),
            },
        )
        if url:
            # Prefer Edge LAN URL for visitor link when Carrier mode is on.
            instance.public_url = url
        logger.info(
            "[STEP] site_studio_edge_deploy_ok slug=%s url=%s source=%s",
            slug,
            url,
            pack.source,
        )
        return {
            "port": port,
            "url": url,
            "content_source": pack.source,
            "ports_json": ports,
        }
    except Exception as exc:
        _merge_ports(instance, {"edge_last_error": str(exc)[:2000]})
        instance.last_error = str(exc)[:2000]
        raise
    finally:
        shutil.rmtree(work_root, ignore_errors=True)


async def undeploy_instance_from_edge(instance: Any) -> dict[str, Any]:
    """Stop/remove site-edge-<slug> on the Edge host via SSH."""
    if not site_edge_carrier_enabled():
        raise SiteStudioEdgeCarrierError("SITE_EDGE_CARRIER_ENABLED is off")
    ssh = (os.environ.get(SITE_EDGE_SSH_ENV) or "").strip()
    if not ssh:
        raise SiteStudioEdgeCarrierError("SITE_EDGE_SSH is not configured on the worker host")

    slug = str(getattr(instance, "site_slug", "") or "").strip()
    if not slug:
        raise SiteStudioEdgeCarrierError("site_slug is required")
    container = f"site-edge-{slug}"
    remote = (
        f"if podman container exists '{container}' 2>/dev/null; then "
        f"podman stop '{container}' || true; podman rm '{container}' || true; fi"
    )
    cmd = ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=15", ssh, "bash", "-lc", remote]
    logger.info("[STEP] site_studio_edge_undeploy_start slug=%s", slug)
    try:
        await _run_cmd(cmd)
        ports = _merge_ports(
            instance,
            {
                "edge_last_error": None,
                "edge_url": None,
                "edge_deployed_at": None,
            },
        )
        # Keep edge_http for stable re-publish port affinity.
        logger.info("[STEP] site_studio_edge_undeploy_ok slug=%s", slug)
        return {"ports_json": ports}
    except Exception as exc:
        _merge_ports(instance, {"edge_last_error": str(exc)[:2000]})
        instance.last_error = str(exc)[:2000]
        raise


async def execute_site_studio_edge_task(
    instance_id: Any,
    task_type: str,
    *,
    instance_scope: str = "user",
    job_id: Any = None,
) -> None:
    """Worker entry: edge publish/unpublish for a Site Studio instance."""
    from uuid import UUID

    from api.core.database_manager import get_database_manager
    from api.models.desktop import ProjectSiteInstance, UserSiteInstance
    from api.services.site_studio_lifecycle_jobs import (
        mark_lifecycle_job_failed,
        mark_lifecycle_job_running,
        mark_lifecycle_job_stage,
        mark_lifecycle_job_succeeded,
        record_worker_heartbeat,
    )

    iid = instance_id if isinstance(instance_id, UUID) else UUID(str(instance_id))
    db_manager = await get_database_manager()
    async with db_manager.get_postgres_session() as db:
        if (instance_scope or "user").strip().lower() == "project":
            instance = await db.get(ProjectSiteInstance, iid)
        else:
            instance = await db.get(UserSiteInstance, iid)
        if instance is None:
            return

        worker_id = await record_worker_heartbeat(
            db, metadata={"task_type": task_type, "instance_scope": instance_scope}
        )
        await mark_lifecycle_job_running(db, job_id, worker_id=worker_id, stage="edge_accepted")
        await db.commit()

        try:
            if task_type == "site_studio_edge_publish":
                await mark_lifecycle_job_stage(db, job_id, stage="edge_snapshot")
                await db.commit()
                await mark_lifecycle_job_stage(db, job_id, stage="edge_build")
                await db.commit()
                await deploy_instance_to_edge(instance)
                await mark_lifecycle_job_stage(db, job_id, stage="edge_transfer")
                await db.commit()
                inst_ok: Any = instance
                inst_ok.last_error = None
                await mark_lifecycle_job_succeeded(db, job_id, stage="edge_running")
                await db.commit()
            elif task_type == "site_studio_edge_unpublish":
                await mark_lifecycle_job_stage(db, job_id, stage="edge_stopping")
                await db.commit()
                await undeploy_instance_from_edge(instance)
                inst_cleared: Any = instance
                inst_cleared.last_error = None
                await mark_lifecycle_job_succeeded(db, job_id, stage="edge_stopped")
                await db.commit()
            else:
                raise SiteStudioEdgeCarrierError(f"unsupported edge task_type={task_type}")
        except Exception as exc:
            await db.rollback()
            try:
                async with db_manager.get_postgres_session() as db2:
                    if (instance_scope or "user").strip().lower() == "project":
                        inst2 = await db2.get(ProjectSiteInstance, iid)
                    else:
                        inst2 = await db2.get(UserSiteInstance, iid)
                    if inst2 is not None:
                        _merge_ports(inst2, {"edge_last_error": str(exc)[:2000]})
                        inst2_mut: Any = inst2
                        inst2_mut.last_error = str(exc)[:2000]
                    await mark_lifecycle_job_failed(
                        db2,
                        job_id,
                        stage="edge_failed",
                        error=str(exc)[:2000],
                    )
                    await db2.commit()
            except Exception:  # noqa: BLE001 — best-effort failure record
                logger.exception(
                    "[STEP] site_studio_edge_fail_record_skip task=%s instance_id=%s",
                    task_type,
                    iid,
                )
            logger.exception(
                "Site Studio edge task failed task=%s instance_id=%s",
                task_type,
                iid,
            )
            raise
