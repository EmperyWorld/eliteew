# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pure preflight logic for stack0 API container startup (imports, TCP/HTTP probes, guards).
# Invariants:
# - No secrets in logs; EWA DSN exposes host/port/db only.
# - Fail-closed only for keys listed in STACK0_PREFLIGHT_FAIL_ON; import checklist always fail-closed.
# - Site Studio worker readiness is NOT checked here (FastAPI lifespan only).
# Related:
# - docker/builders/stack0-api/scripts/lib/stack0_preflight.py
# - documentation/platform/docker-re_doc/STACK0-API-STARTUP.md
# ---
from __future__ import annotations

import importlib.util
import os
import shutil
import socket
import subprocess
import sys
from dataclasses import dataclass, field
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

CheckStatus = Literal["ok", "warn", "fail", "skip"]

KNOWN_FAIL_KEYS = frozenset(
    {
        "postgres",
        "redis",
        "ewa_postgres",
        "minio",
        "elasticsearch",
        "rabbitmq",
        "llama",
        "tika",
        "imports",
        "redis_forbidden",
    }
)


@dataclass(frozen=True)
class EwaTarget:
    host: str
    port: int
    database: str


@dataclass
class PreflightCheck:
    key: str
    name: str
    status: CheckStatus
    detail: str


@dataclass
class PreflightReport:
    checks: list[PreflightCheck] = field(default_factory=list)
    exit_code: int = 0

    def add(self, check: PreflightCheck) -> None:
        self.checks.append(check)
        if check.status == "fail":
            self.exit_code = 1


def parse_fail_on_keys(raw: str | None) -> set[str]:
    if not raw or not raw.strip():
        return set()
    return {part.strip().lower() for part in raw.split(",") if part.strip()}


def fail_on_enabled(key: str, fail_on: set[str]) -> bool:
    return key.lower() in fail_on


def parse_ewa_database_url(raw: str | None) -> EwaTarget | None:
    """Return EwaTarget, None when unset, raise ValueError when malformed."""
    text = (raw or "").strip()
    if not text:
        return None
    parsed = urlparse(text)
    host = parsed.hostname or ""
    port = parsed.port if parsed.port is not None else 5432
    database = (parsed.path or "").strip("/") or "(default)"
    if not host:
        raise ValueError("hostname missing in EWA_DATABASE_URL")
    return EwaTarget(host=host, port=port, database=database)


def redis_host_forbidden(host: str | None, forbidden_csv: str) -> bool:
    needle = (host or "").strip()
    if not needle:
        return False
    return any(needle == part.strip() for part in forbidden_csv.split(","))


def llama_probe_path(suffix: str, llama_use_openai_api: str | None) -> str:
    normalized = (llama_use_openai_api or "").strip().lower()
    openai_compat = normalized in {"1", "true", "yes", "on"}
    if openai_compat and suffix == "/api/tags":
        return "/health"
    return suffix


def probe_tcp(host: str, port: int | str, timeout_sec: float) -> bool:
    port_int = int(port)
    with socket.create_connection((host, port_int), timeout=timeout_sec):
        return True


def probe_http(url: str, timeout_sec: float) -> bool:
    request = Request(url, method="GET")
    with urlopen(request, timeout=timeout_sec) as response:
        return 200 <= response.status < 400


def resolve_ffmpeg_bin(configured: str) -> str | None:
    path = shutil.which("ffmpeg")
    if path:
        return path
    candidate = (configured or "").strip()
    if candidate and os.path.isfile(candidate) and os.access(candidate, os.X_OK):
        return candidate
    return None


def check_import_checklist(python_executable: str, checklist_csv: str) -> tuple[int, int, list[str]]:
    installed = 0
    missing: list[str] = []
    for pair in checklist_csv.split(","):
        pair = pair.strip()
        if not pair or ":" not in pair:
            continue
        package_name, import_name = (part.strip() for part in pair.split(":", 1))
        if not package_name or not import_name:
            continue
        spec = importlib.util.find_spec(import_name)
        if spec is None:
            # Match shell behavior: subprocess import via venv python
            proc = subprocess.run(
                [python_executable, "-c", f"import {import_name}"],
                capture_output=True,
                check=False,
            )
            if proc.returncode != 0:
                missing.append(package_name)
                continue
        installed += 1
    missing_count = len(missing)
    return installed, missing_count, missing


def _record(
    report: PreflightReport,
    *,
    key: str,
    name: str,
    ok: bool,
    fail_on: set[str],
    detail_ok: str,
    detail_fail: str,
    skip: bool = False,
    skip_detail: str = "",
) -> None:
    if skip:
        report.add(PreflightCheck(key=key, name=name, status="skip", detail=skip_detail))
        return
    if ok:
        report.add(PreflightCheck(key=key, name=name, status="ok", detail=detail_ok))
        return
    status: CheckStatus = "fail" if fail_on_enabled(key, fail_on) else "warn"
    report.add(PreflightCheck(key=key, name=name, status=status, detail=detail_fail))
    if status == "fail":
        report.exit_code = 1


_PREFLIGHT_REQUIRED_ENV = (
    "STACK0_PACKAGE_IMPORT_CHECKLIST",
    "STACK0_TCP_PROBE_TIMEOUT_SEC",
    "STACK0_REDIS_FORBIDDEN_HOSTS",
    "STACK0_LL_HTTP_HEALTH_SUFFIX",
    "STACK0_TIKA_HTTP_HEALTH_SUFFIX",
    "STACK0_FFMPEG_BIN",
)


def run_preflight(*, python_executable: str | None = None) -> PreflightReport:
    """Run all shell-equivalent startup checks. Mutates nothing except import side-effects in subprocess."""
    report = PreflightReport()
    for key in _PREFLIGHT_REQUIRED_ENV:
        if not (os.environ.get(key) or "").strip():
            report.add(
                PreflightCheck(
                    key="env",
                    name=f"Env {key}",
                    status="fail",
                    detail=f"{key} is required for stack0 preflight",
                )
            )
            report.exit_code = 1
            return report

    fail_on = parse_fail_on_keys(os.environ.get("STACK0_PREFLIGHT_FAIL_ON") or "postgres,redis,ewa_postgres")
    verbose = (os.environ.get("STACK0_PREFLIGHT_VERBOSE") or "0").strip() == "1"
    tcp_timeout = float((os.environ.get("STACK0_TCP_PROBE_TIMEOUT_SEC") or "2").strip() or "2")
    http_timeout = 5.0
    python_cmd = python_executable or sys.executable

    # --- import checklist (always fail-closed) ---
    checklist = (os.environ.get("STACK0_PACKAGE_IMPORT_CHECKLIST") or "").strip()
    if not checklist:
        report.add(
            PreflightCheck(
                key="imports",
                name="Import checklist",
                status="fail",
                detail="STACK0_PACKAGE_IMPORT_CHECKLIST is empty",
            )
        )
        report.exit_code = 1
    else:
        installed, missing_count, missing = check_import_checklist(python_cmd, checklist)
        if missing_count > 0:
            report.add(
                PreflightCheck(
                    key="imports",
                    name="Import checklist",
                    status="fail",
                    detail=f"{missing_count} missing: {', '.join(missing)} ({installed} ok)",
                )
            )
            report.exit_code = 1
        else:
            detail = f"{installed} packages ok"
            if verbose:
                detail = f"{detail} (verbose)"
            report.add(PreflightCheck(key="imports", name="Import checklist", status="ok", detail=detail))

    # --- ffmpeg (warn only) ---
    ffmpeg_bin = resolve_ffmpeg_bin(os.environ.get("STACK0_FFMPEG_BIN", ""))
    if ffmpeg_bin:
        report.add(PreflightCheck(key="ffmpeg", name="ffmpeg", status="ok", detail=ffmpeg_bin))
    else:
        docfile = os.environ.get("STACK0_DOC_DOCFILE_REL", "docker/builders/stack0-api/Dockerfile")
        report.add(
            PreflightCheck(
                key="ffmpeg",
                name="ffmpeg",
                status="warn",
                detail=f"not found — audio/video convert will fail; rebuild {docfile}",
            )
        )

    # --- playwright absent in API venv (warn only) ---
    playwright_spec = importlib.util.find_spec("playwright")
    if playwright_spec is not None:
        report.add(
            PreflightCheck(
                key="playwright",
                name="playwright",
                status="warn",
                detail="present in API venv — expected only on queue-worker",
            )
        )
    else:
        report.add(
            PreflightCheck(
                key="playwright",
                name="playwright",
                status="ok",
                detail="absent from API venv (expected)",
            )
        )

    # --- redis forbidden host (always fail-closed) ---
    redis_host = (os.environ.get("REDIS_HOST") or "").strip()
    forbidden = os.environ.get("STACK0_REDIS_FORBIDDEN_HOSTS") or ""
    if redis_host_forbidden(redis_host, forbidden):
        hint = os.environ.get("STACK0_DOC_REDIS_HOST_HINT", "stack1 Redis")
        env_hint = os.environ.get("STACK0_DOC_ENV_FILE_HINT", "docker/env_file/.env.stack0.backend")
        report.add(
            PreflightCheck(
                key="redis_forbidden",
                name="Redis host guard",
                status="fail",
                detail=f"REDIS_HOST={redis_host} forbidden ({forbidden}); use {hint}; see {env_hint}",
            )
        )
        report.exit_code = 1

    # --- EWA DSN ---
    ewa_target: EwaTarget | None = None
    try:
        ewa_target = parse_ewa_database_url(os.environ.get("EWA_DATABASE_URL"))
        if ewa_target is None:
            report.add(
                PreflightCheck(
                    key="ewa_postgres",
                    name="EWA Postgres",
                    status="skip",
                    detail="EWA_DATABASE_URL unset — EWA pool disabled",
                )
            )
        else:
            report.add(
                PreflightCheck(
                    key="ewa_postgres",
                    name="EWA Postgres DSN",
                    status="ok",
                    detail=f"{ewa_target.host}:{ewa_target.port} db={ewa_target.database}",
                )
            )
    except ValueError as exc:
        report.add(
            PreflightCheck(
                key="ewa_postgres",
                name="EWA Postgres DSN",
                status="warn",
                detail=f"EWA_DATABASE_URL unparsable: {exc}",
            )
        )

    def tcp_probe(key: str, name: str, host: str | None, port: str | None) -> None:
        host_s = (host or "").strip()
        port_s = str(port or "").strip()
        if not host_s or not port_s:
            _record(
                report,
                key=key,
                name=name,
                ok=False,
                fail_on=fail_on,
                detail_ok="",
                detail_fail=f"{name}: host/port unset",
                skip=False,
            )
            return
        try:
            ok = probe_tcp(host_s, port_s, tcp_timeout)
        except OSError as exc:
            ok = False
            detail_fail = f"{name} TCP fail: {host_s}:{port_s} ({exc})"
            _record(
                report,
                key=key,
                name=name,
                ok=False,
                fail_on=fail_on,
                detail_ok="",
                detail_fail=detail_fail,
            )
            return
        _record(
            report,
            key=key,
            name=name,
            ok=ok,
            fail_on=fail_on,
            detail_ok=f"{name} TCP ok: {host_s}:{port_s}",
            detail_fail=f"{name} TCP fail: {host_s}:{port_s}",
        )

    tcp_probe("postgres", "PostgreSQL", os.environ.get("POSTGRES_HOST"), os.environ.get("POSTGRES_PORT"))
    tcp_probe("redis", "Redis", os.environ.get("REDIS_HOST"), os.environ.get("REDIS_PORT"))
    tcp_probe("minio", "SeaweedFS/S3", os.environ.get("MINIO_HOST"), os.environ.get("MINIO_PORT"))
    tcp_probe(
        "elasticsearch",
        "Elasticsearch",
        os.environ.get("ELASTICSEARCH_HOST"),
        os.environ.get("ELASTICSEARCH_PORT"),
    )
    if ewa_target is not None:
        tcp_probe("ewa_postgres", "EWA Postgres", ewa_target.host, str(ewa_target.port))
    tcp_probe("rabbitmq", "RabbitMQ", os.environ.get("RABBITMQ_HOST"), os.environ.get("RABBITMQ_PORT"))

    def http_probe(key: str, name: str, base_url: str | None, suffix: str) -> None:
        url = (base_url or "").strip()
        if not url:
            report.add(PreflightCheck(key=key, name=name, status="skip", detail=f"{name}: URL unset"))
            return
        full_url = f"{url.rstrip('/')}{suffix}"
        try:
            ok = probe_http(full_url, http_timeout)
            detail_fail = f"{name} HTTP fail: {full_url}"
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            ok = False
            detail_fail = f"{name} HTTP fail: {full_url} ({exc})"
        _record(
            report,
            key=key,
            name=name,
            ok=ok,
            fail_on=fail_on,
            detail_ok=f"{name} HTTP ok: {full_url}",
            detail_fail=detail_fail,
        )

    llama_suffix = llama_probe_path(
        (os.environ.get("STACK0_LL_HTTP_HEALTH_SUFFIX") or "/api/tags").strip(),
        os.environ.get("LLAMA_USE_OPENAI_API"),
    )
    http_probe("llama", "LLM", os.environ.get("LLAMA_URL"), llama_suffix)
    http_probe(
        "tika",
        "Tika",
        os.environ.get("TIKA_URL"),
        (os.environ.get("STACK0_TIKA_HTTP_HEALTH_SUFFIX") or "/tika").strip(),
    )

    report.add(
        PreflightCheck(
            key="site_studio",
            name="Site Studio worker",
            status="skip",
            detail="delegated to FastAPI lifespan (wait_for_site_studio_worker_ready_at_startup)",
        )
    )

    _ = verbose  # reserved for future per-check verbose flag in format_output
    return report


def format_operator_lines(report: PreflightReport) -> list[str]:
    lines: list[str] = []
    for check in report.checks:
        prefix = {
            "ok": "[OK]",
            "warn": "[WARN]",
            "fail": "[FAIL]",
            "skip": "[SKIP]",
        }[check.status]
        lines.append(f"{prefix} {check.name}: {check.detail}")
    if report.exit_code != 0:
        lines.append("[FAIL] Preflight aborted — fix fail-closed checks or adjust STACK0_PREFLIGHT_FAIL_ON")
    else:
        lines.append("[OK] Preflight complete")
    return lines
