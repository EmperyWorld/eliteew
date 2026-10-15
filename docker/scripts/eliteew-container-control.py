#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Упорядоченное управление container-стеками EliteEW (docker/podman; down/up/recreate) и диагностика без sudo.
# Нумерация запущенных стеков: list-stacks; выборочный recreate — recreate-running --skip-stack-num.
# Invariants:
# - Не запускать от root без --allow-root; не монтировать docker.sock в новые сервисы.
# - Порядок START_ORDER / STOP_ORDER фиксирован (data last on down, data first on up).
# Related:
# - docker/scripts/eliteew-container-console.sh, documentation/platform/docker-re_doc/STACK-CONTAINER-CONTROL.md
# ---

"""EliteEW container stack control center (docker/podman)."""

from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import shutil
import stat
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Iterable

try:
    import yaml
except Exception:  # noqa: BLE001
    yaml = None

MAX_STOP_TIMEOUT_SEC = 10


def _resolve_stop_timeout_sec(raw: int | None) -> int:
    """Compose ``stop --timeout``: 1..MAX_STOP_TIMEOUT_SEC (default MAX)."""
    if raw is None:
        return MAX_STOP_TIMEOUT_SEC
    return max(1, min(int(raw), MAX_STOP_TIMEOUT_SEC))


# ANSI (only applied when color mode allows and stdout is a TTY for "auto").
class _Ansi:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    RED = "\033[31m"
    CYAN = "\033[36m"
    DIM = "\033[2m"


@dataclass(frozen=True)
class StackSpec:
    key: str
    compose_file: Path
    env_file: Path | None
    description: str
    optional: bool = False
    profiles: tuple[str, ...] = ()


DEFAULT_STACK0_BACKEND_PROFILES: tuple[str, ...] = (
    "punisher-local-workers",
    "site-studio-worker",
)

CRITICAL_STACK0_CONTAINER_GROUPS: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "stack0 api",
        ("stack0-eliteew-api-prod", "stack0-eliteew-api-prod-baked"),
    ),
    (
        "stack0 frontend",
        ("stack0-eliteew-frontend-prod", "stack0-eliteew-frontend-prod-baked"),
    ),
)

START_ORDER: tuple[str, ...] = (
    "stack1",
    "stack-ewa-postgres",
    "stack12",
    "stack2",
    "stack6",
    "stack4",
    "stack9",
    "stack11",
    "stack0-backend",
    "stack0-frontend",
    "stack-yandex-tunnel",
    "meet-edge-wg",
)
STOP_ORDER: tuple[str, ...] = tuple(reversed(START_ORDER))

# Longest prefixes first for name-based stack resolution fallback.
MANAGED_CONTAINER_PREFIXES: tuple[str, ...] = (
    "meet-edge-wg",
    "stack-yandex-tunnel",
    "stack-ewa-postgres",
    "stack0-eliteew-frontend",
    "stack11-",
    "stack12-",
    "stack9-",
    "stack6-",
    "stack4-",
    "stack2-",
    "stack1-",
    "stack0-",
)

NAME_PREFIX_TO_STACK_KEY: tuple[tuple[str, str], ...] = (
    ("meet-edge-wg", "meet-edge-wg"),
    ("stack-yandex-tunnel", "stack-yandex-tunnel"),
    ("stack-ewa-postgres", "stack-ewa-postgres"),
    ("stack0-eliteew-frontend", "stack0-frontend"),
    ("stack11-", "stack11"),
    ("stack12-", "stack12"),
    ("stack9-", "stack9"),
    ("stack6-", "stack6"),
    ("stack4-", "stack4"),
    ("stack2-", "stack2"),
    ("stack1-", "stack1"),
    ("stack0-", "stack0-backend"),
)

RUNTIME_ENV_VAR = "ELITEEW_CONTAINER_RUNTIME"
SUPPORTED_RUNTIMES: tuple[str, ...] = ("docker", "podman")
PODMAN_COMPOSE_PROVIDER_ENV_VAR = "PODMAN_COMPOSE_PROVIDER"
DEFAULT_PODMAN_COMPOSE_PROVIDER = "podman-compose"

DEFAULT_LOG_ERROR_PATTERNS: tuple[str, ...] = (
    r"\bERROR\b",
    r"\bError\b",
    r"\bException\b",
    r"Traceback \(most recent",
    r"\bFATAL\b",
    r"\bCRITICAL\b",
    r"\bpanic\b",
    r"\[error\]",
    r"\[fail\]",
    r"\[issue\]",
    r"level=error",
    r'"level":"error"',
)


@dataclass(frozen=True)
class ContainerRow:
    """One managed container row for status/logs pickers."""

    index: int
    name: str
    stack_key: str
    state: str
    health: str


@dataclass(frozen=True)
class StackRow:
    """One managed stack row for running-stack recreate pickers."""

    index: int
    stack_key: str
    description: str
    running_count: int
    total_count: int
    container_names: tuple[str, ...]


class ControllerError(RuntimeError):
    """Raised when an operation cannot continue safely."""


def _resolve_runtime(value: str | None) -> str:
    runtime = (value or "").strip().lower()
    if not runtime:
        return "podman"
    if runtime in SUPPORTED_RUNTIMES:
        return runtime
    supported = ", ".join(SUPPORTED_RUNTIMES)
    raise ControllerError(
        f"Unsupported {RUNTIME_ENV_VAR}={value!r}. Supported values: {supported}",
    )


def _run(
    cmd: list[str],
    *,
    capture_output: bool = True,
    check: bool = False,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        text=True,
        capture_output=capture_output,
        check=check,
    )


def _parse_compose_ps_json(text: str) -> list[dict[str, Any]]:
    """Turn `compose ps --format json` stdout into a list of row dicts.

    Docker Compose may output a JSON array, one JSON object, or NDJSON (one
    object per line). A single JSON object used to be parsed as a dict; iterating
    ``for row in rows`` then walked **keys** (strings) → ``row.get`` crashed.
    """
    raw = (text or "").strip()
    if not raw:
        return []

    def _coerce_rows(decoded: object) -> list[dict[str, Any]]:
        if isinstance(decoded, list):
            return [x for x in decoded if isinstance(x, dict)]
        if isinstance(decoded, dict):
            return [decoded]
        return []

    try:
        return _coerce_rows(json.loads(raw))
    except json.JSONDecodeError:
        pass

    rows: list[dict[str, Any]] = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        rows.extend(_coerce_rows(obj))
    return rows


def _parse_docker_ps_ndjson(text: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line in (text or "").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(obj, dict):
            rows.append(obj)
    return rows


def _compose_project_from_labels(labels: Any) -> str:
    if isinstance(labels, dict):
        for key in ("com.docker.compose.project", "io.podman.compose.project"):
            value = labels.get(key)
            if value:
                return str(value).strip()
        return ""

    for part in str(labels or "").split(","):
        part = part.strip()
        if part.startswith("com.docker.compose.project="):
            return part.split("=", 1)[1].strip()
        if part.startswith("io.podman.compose.project="):
            return part.split("=", 1)[1].strip()
    return ""


def _health_from_docker_status(status: str) -> str:
    lowered = (status or "").lower()
    if "(healthy)" in lowered:
        return "healthy"
    if "(unhealthy)" in lowered:
        return "unhealthy"
    if "(health:" in lowered or "(starting)" in lowered:
        return "starting"
    return ""


def _stack_key_from_container_name(name: str) -> str:
    for prefix, key in NAME_PREFIX_TO_STACK_KEY:
        if name.startswith(prefix):
            return key
    return ""


def _iter_bind_volume_entries(
    service: dict[str, Any],
) -> Iterable[tuple[str, str, bool]]:
    """Yield (source, target, writable) for bind mounts (dict or short compose syntax)."""
    for volume in service.get("volumes", []) or []:
        if isinstance(volume, dict):
            if volume.get("type") not in (None, "bind"):
                continue
            source = str(volume.get("source", "")).strip()
            if not source:
                continue
            target = str(volume.get("target", ""))
            writable = not bool(volume.get("read_only", False))
            yield source, target, writable
            continue
        if not isinstance(volume, str):
            continue
        spec = volume.strip()
        if not spec:
            continue
        parts = spec.split(":")
        if len(parts) < 2:
            continue
        source = parts[0]
        target = parts[1]
        mode = parts[2].lower() if len(parts) > 2 else ""
        writable = mode != "ro"
        yield source, target, writable


@dataclass(frozen=True)
class BindCheckOutcome:
    """Result of evaluating host access to a compose bind-mount source path."""

    level: str  # ok | warn | fail
    detail: str
    read: bool | None = None
    write: bool | None = None
    exec: bool | None = None


def _docker_bind_tree(path: Path, repo_root: Path) -> str | None:
    """Return ``data`` or ``logs`` when *path* lives under ``docker/data`` or ``docker/logs``."""
    try:
        resolved = path.resolve()
        for root_name in ("data", "logs"):
            root = (repo_root / "docker" / root_name).resolve()
            if resolved == root or root in resolved.parents:
                return root_name
    except OSError:
        return None
    return None


def _lstat_path(path: Path) -> os.stat_result | None:
    try:
        return path.lstat()
    except OSError:
        return None


def _is_service_managed_bind(
    st: os.stat_result, host_uid: int, tree: str | None
) -> bool:
    """True when a bind under docker/data|logs is owned by a container service UID, not the deploy user."""
    if tree not in {"data", "logs"}:
        return False
    return st.st_uid != host_uid


def _find_service_managed_anchor(
    path: Path,
    repo_root: Path,
    host_uid: int,
) -> tuple[Path, os.stat_result] | None:
    """Nearest existing ancestor under docker/data|logs that a service UID owns (not the deploy user)."""
    current = path
    while True:
        st = _lstat_path(current)
        if st is not None:
            tree = _docker_bind_tree(current, repo_root)
            if tree and st.st_uid != host_uid:
                return current, st
        if current.parent == current:
            break
        current = current.parent
    return None


def evaluate_bind_mount_access(
    source: Path,
    *,
    writable: bool,
    repo_root: Path,
    host_uid: int | None = None,
    service_label: str = "",
) -> BindCheckOutcome:
    """Classify host-side access to a compose bind-mount source for ``check-perms``."""
    effective_uid = os.getuid() if host_uid is None else host_uid
    try:
        resolved = source.resolve()
    except OSError:
        resolved = source

    suffix = f" (service: {service_label})" if service_label else ""
    st = _lstat_path(resolved)
    if st is None:
        anchor = _find_service_managed_anchor(resolved, repo_root, effective_uid)
        if anchor is not None:
            anchor_path, _anchor_st = anchor
            return BindCheckOutcome(
                "warn",
                (
                    "container-managed bind — host cannot verify path under "
                    f"{anchor_path}{suffix}"
                ),
            )
        return BindCheckOutcome("fail", f"missing path{suffix}")

    tree = _docker_bind_tree(resolved, repo_root)
    is_dir = stat.S_ISDIR(st.st_mode)
    r_ok = os.access(resolved, os.R_OK)
    x_ok = os.access(resolved, os.X_OK) if is_dir else True
    w_ok = os.access(resolved, os.W_OK) if writable else True

    if r_ok and w_ok and x_ok:
        mode = "rw" if writable else "ro"
        return BindCheckOutcome("ok", f"({mode})", r_ok, w_ok, x_ok)

    if tree is not None and _is_service_managed_bind(st, effective_uid, tree):
        if not r_ok:
            reason = "container data/log bind — host read not required (service UID owns path)"
        elif writable and not w_ok:
            reason = "container data/log bind — host write not required"
        else:
            reason = "container-managed bind — host access limited"
        return BindCheckOutcome(
            "warn",
            f"read={r_ok} write={w_ok} exec={x_ok}; {reason}{suffix}",
            r_ok,
            w_ok,
            x_ok,
        )

    return BindCheckOutcome(
        "fail",
        f"read={r_ok} write={w_ok} exec={x_ok}{suffix}",
        r_ok,
        w_ok,
        x_ok,
    )


class StackController:
    def __init__(
        self,
        repo_root: Path,
        *,
        allow_root: bool = False,
        require_nonlocal_endpoint: bool = False,
        color: str = "auto",
    ):
        self.repo_root = repo_root.resolve()
        self.allow_root = allow_root
        self.require_nonlocal_endpoint = require_nonlocal_endpoint
        self.color = color
        self.runtime = _resolve_runtime(os.getenv(RUNTIME_ENV_VAR))
        self._configure_runtime_environment()
        self.compose_cli = (self.runtime, "compose")
        self.stacks = self._build_specs()
        self._compose_config_cache: dict[str, dict[str, Any]] = {}
        self._check_preconditions()

    def _configure_runtime_environment(self) -> None:
        if self.runtime != "podman":
            return
        provider = (
            os.getenv(PODMAN_COMPOSE_PROVIDER_ENV_VAR)
            or DEFAULT_PODMAN_COMPOSE_PROVIDER
        ).strip()
        if not provider:
            provider = DEFAULT_PODMAN_COMPOSE_PROVIDER
        if shutil.which(provider) is None:
            raise ControllerError(
                (
                    f"{PODMAN_COMPOSE_PROVIDER_ENV_VAR}={provider!r} is not available in PATH. "
                    f"Install {DEFAULT_PODMAN_COMPOSE_PROVIDER} or set "
                    f"{PODMAN_COMPOSE_PROVIDER_ENV_VAR} to a valid provider binary."
                ),
            )
        os.environ[PODMAN_COMPOSE_PROVIDER_ENV_VAR] = provider

    def _use_color(self) -> bool:
        if self.color == "never":
            return False
        if self.color == "always":
            return True
        return sys.stdout.isatty()

    def _c(self, text: str, code: str) -> str:
        if not self._use_color():
            return text
        return f"{code}{text}{_Ansi.RESET}"

    def _severity_for_row(self, state: str, health: str) -> str:
        """Classify a compose ps row for terminal highlighting."""
        st = (state or "").lower()
        ht = health or ""
        if ht == "unhealthy" or st in {"exited", "dead"}:
            return "bad"
        if "restarting" in st or ht == "starting":
            return "warn"
        if st == "running" and ht in {"", "healthy"}:
            return "ok"
        if "paused" in st:
            return "warn"
        return "warn" if st not in {"running"} else "ok"

    def _line_color(self, severity: str) -> str:
        if severity == "bad":
            return _Ansi.RED
        if severity == "warn":
            return _Ansi.YELLOW
        return _Ansi.GREEN

    def _colorize_tag(self, tag: str) -> str:
        """Colorize [info]/[warn]/[fail]/[ok]/[issue] prefixes."""
        if not self._use_color():
            return tag
        lower = tag.lower()
        if "[fail]" in lower or "[error]" in lower or "[issue]" in lower:
            return f"{_Ansi.RED}{tag}{_Ansi.RESET}"
        if "[warn]" in lower:
            return f"{_Ansi.YELLOW}{tag}{_Ansi.RESET}"
        if "[ok]" in lower:
            return f"{_Ansi.GREEN}{tag}{_Ansi.RESET}"
        if "[info]" in lower:
            return f"{_Ansi.CYAN}{tag}{_Ansi.RESET}"
        return tag

    def _check_preconditions(self) -> None:
        if hasattr(os, "geteuid") and os.geteuid() == 0 and not self.allow_root:
            raise ControllerError(
                "Refusing to run as root. Use a regular user in docker group.",
            )
        if not (self.repo_root / "docker" / "stack").exists():
            raise ControllerError(f"Invalid repo root: {self.repo_root}")
        if self.require_nonlocal_endpoint:
            if self.runtime != "docker":
                print(
                    "[warn] --require-nonlocal-endpoint applies only to docker runtime; "
                    "option ignored for podman.",
                )
                return
            host = self._docker_endpoint_host()
            if host.startswith("unix:///var/run/docker.sock"):
                raise ControllerError(
                    "Strict mode is enabled: local docker unix socket endpoint is forbidden.",
                )

    def _build_specs(self) -> dict[str, StackSpec]:
        d = self.repo_root / "docker"
        s = d / "stack"
        e = d / "env_file"
        return {
            "stack1": StackSpec(
                "stack1",
                s / "stack1.yml",
                e / ".env.stack1",
                "Core data stack (postgres/redis/search/queues)",
            ),
            "stack-ewa-postgres": StackSpec(
                "stack-ewa-postgres",
                s / "stack-ewa-postgres.yml",
                e / ".env.stack-ewa",
                "Dedicated EWA postgres",
                optional=True,
            ),
            "stack12": StackSpec(
                "stack12",
                s / "stack12.yml",
                e / ".env.stack12",
                "Internal DNS (CoreDNS)",
                optional=True,
            ),
            "stack2": StackSpec(
                "stack2",
                s / "stack2.yml",
                e / ".env.stack2",
                "LLM services",
                optional=True,
                profiles=("local-stack2-embed-rerank", "tei-cpu-embed", "companion-tool-router"),
            ),
            "stack6": StackSpec(
                "stack6",
                s / "stack6.yml",
                e / ".env.stack6",
                "Keycloak + Keycloak Postgres",
                optional=True,
            ),
            "stack4": StackSpec(
                "stack4",
                s / "stack4.yml",
                e / ".env.stack4",
                "OCR / document services",
                optional=True,
            ),
            "stack9": StackSpec(
                "stack9",
                s / "stack9.yml",
                e / ".env.stack9",
                "Voice services (STT/TTS)",
                optional=True,
            ),
            "stack11": StackSpec(
                "stack11",
                s / "stack11.yml",
                e / ".env.stack11",
                "Jitsi stack",
                optional=True,
                profiles=("recording", "collab"),
            ),
            "stack0-backend": StackSpec(
                "stack0-backend",
                s / "stack0_b.yml",
                e / ".env.stack0.backend",
                "Main backend/API/workers",
                profiles=DEFAULT_STACK0_BACKEND_PROFILES,
            ),
            "stack0-frontend": StackSpec(
                "stack0-frontend",
                s / "stack0_f.yml",
                e / ".env.stack0.backend",
                "Main frontend (nginx static)",
            ),
            "stack-yandex-tunnel": StackSpec(
                "stack-yandex-tunnel",
                s / "stack-yandex-tunnel.yml",
                e / ".env.yandex-tunnel",
                "Reverse SSH tunnel to Yandex VM",
                optional=True,
            ),
            "meet-edge-wg": StackSpec(
                "meet-edge-wg",
                s / "meet-edge-wg.yml",
                None,
                "Meet media WireGuard relay",
                optional=True,
            ),
        }

    @staticmethod
    def _echo(cmd: list[str]) -> None:
        print(f"$ {shlex.join(cmd)}")

    def _compose_cmd(
        self,
        spec: StackSpec,
        *,
        include_all_profiles: bool = False,
        override_profiles: Iterable[str] | None = None,
    ) -> list[str]:
        cmd = [*self.compose_cli, "-f", str(spec.compose_file)]
        if spec.env_file is not None:
            cmd += ["--env-file", str(spec.env_file)]
        profiles: list[str] = []
        if override_profiles is not None:
            profiles = [p for p in override_profiles if p]
        elif include_all_profiles:
            profiles = list(spec.profiles)
        for profile in profiles:
            cmd += ["--profile", profile]
        return cmd

    @staticmethod
    def _env_file_access_error(env_path: Path) -> str | None:
        """Return error text when env file is missing or unreadable (e.g. docker/env_file owned by root)."""
        if not env_path.parent.is_dir():
            return f"Missing env directory: {env_path.parent}"
        if not os.access(env_path.parent, os.R_OK | os.X_OK):
            return (
                f"Cannot read env directory {env_path.parent} (permission denied). "
                "Run: bash docker/scripts/fix-docker-permissions-final.sh (eec menu 25)."
            )
        if env_path.is_file():
            if os.access(env_path, os.R_OK):
                return None
            return (
                f"Env file not readable: {env_path}. "
                "Run: bash docker/scripts/fix-docker-permissions-final.sh"
            )
        return f"Missing env file: {env_path}"

    def _resolve_stacks(
        self,
        ordered_keys: Iterable[str],
        *,
        include: set[str] | None = None,
        exclude: set[str] | None = None,
        skip_optional_if_env_missing: bool = True,
    ) -> list[StackSpec]:
        include = include or set()
        exclude = exclude or set()
        resolved: list[StackSpec] = []
        resolved_keys: set[str] = set()

        def _append_stack(key: str) -> None:
            spec = self.stacks[key]
            if not spec.compose_file.exists():
                raise ControllerError(f"Missing compose file: {spec.compose_file}")
            if spec.env_file is not None:
                env_err = self._env_file_access_error(spec.env_file)
                if env_err is not None:
                    if spec.optional and skip_optional_if_env_missing:
                        print(f"[skip] {spec.key}: {env_err}")
                        return
                    raise ControllerError(env_err)
            resolved.append(spec)
            resolved_keys.add(spec.key)

        for key in ordered_keys:
            if include and key not in include:
                continue
            if key in exclude:
                continue
            _append_stack(key)

        if include:
            extras = sorted(include - resolved_keys)
            for key in extras:
                if key in exclude:
                    continue
                _append_stack(key)
        return resolved

    def validate_runtime(self) -> None:
        print(f"Container runtime: {self.runtime} ({RUNTIME_ENV_VAR})")
        probe_commands: tuple[list[str], ...]
        if self.runtime == "docker":
            probe_commands = (
                ["docker", "version", "--format", "{{.Client.Version}}"],
                ["docker", "compose", "version"],
                [
                    "docker",
                    "info",
                    "--format",
                    "Server={{.ServerVersion}} Name={{.Name}}",
                ],
            )
        else:
            probe_commands = (
                ["podman", "--version"],
                ["podman", "compose", "version"],
                [
                    "podman",
                    "info",
                    "--format",
                    "{{.Host.OS}}/{{.Host.Arch}} rootless={{.Host.Security.Rootless}}",
                ],
            )
            provider = (
                os.getenv(PODMAN_COMPOSE_PROVIDER_ENV_VAR, "").strip()
                or DEFAULT_PODMAN_COMPOSE_PROVIDER
            )
            print(f"{PODMAN_COMPOSE_PROVIDER_ENV_VAR}={provider}")

        for cmd in probe_commands:
            self._echo(cmd)
            proc = _run(cmd)
            if proc.returncode != 0:
                stderr = proc.stderr.strip() or "(no stderr)"
                raise ControllerError(f"Command failed: {' '.join(cmd)}\n{stderr}")
            out = proc.stdout.strip()
            if out:
                print(out)

        if self.runtime == "docker":
            host = self._docker_endpoint_host(print_command=True)
            if host:
                print(f"Docker endpoint: {host}")
                if host.startswith("unix:///var/run/docker.sock"):
                    if self.require_nonlocal_endpoint:
                        raise ControllerError(
                            "Strict mode is enabled: local docker unix socket endpoint is forbidden.",
                        )
                    print(
                        "[warn] Docker endpoint is local unix socket. "
                        "For strict no-socket policy, use ssh/tcp docker context.",
                    )

    def _docker_endpoint_host(self, *, print_command: bool = False) -> str:
        context_cmd = [
            "docker",
            "context",
            "inspect",
            "--format",
            "{{json .Endpoints.docker.Host}}",
        ]
        if print_command:
            self._echo(context_cmd)
        context_proc = _run(context_cmd)
        if context_proc.returncode != 0:
            return ""
        return context_proc.stdout.strip().strip('"')

    def _load_compose_config(
        self,
        spec: StackSpec,
        *,
        include_all_profiles: bool = True,
        echo: bool = True,
    ) -> dict[str, Any] | None:
        cache_key = f"{spec.key}:{'all' if include_all_profiles else 'base'}"
        if cache_key in self._compose_config_cache:
            return self._compose_config_cache[cache_key]

        json_cmd = self._compose_cmd(
            spec, include_all_profiles=include_all_profiles
        ) + [
            "config",
            "--format",
            "json",
        ]
        if echo:
            self._echo(json_cmd)
        proc = _run(json_cmd)
        cfg: dict[str, Any] | None = None
        if proc.returncode == 0:
            try:
                parsed = json.loads(proc.stdout or "{}")
                if isinstance(parsed, dict):
                    cfg = parsed
            except json.JSONDecodeError:
                cfg = None
        if cfg is None:
            yaml_cmd = self._compose_cmd(
                spec, include_all_profiles=include_all_profiles
            ) + ["config"]
            if echo:
                self._echo(yaml_cmd)
            proc_yaml = _run(yaml_cmd)
            if proc_yaml.returncode != 0:
                return None
            if yaml is None:
                return None
            try:
                parsed_yaml = yaml.safe_load(proc_yaml.stdout or "")
            except Exception:  # noqa: BLE001
                return None
            if isinstance(parsed_yaml, dict):
                cfg = parsed_yaml
        if cfg is None:
            return None
        if isinstance(cfg, dict):
            self._compose_config_cache[cache_key] = cfg
            return cfg
        return None

    def _prefetch_compose_configs(
        self,
        specs: list[StackSpec],
        *,
        jobs: int = 1,
    ) -> None:
        if jobs <= 1 or len(specs) <= 1:
            for spec in specs:
                self._load_compose_config(spec, echo=False)
            return
        workers = min(jobs, len(specs))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {
                pool.submit(self._load_compose_config, spec, echo=False): spec
                for spec in specs
            }
            for future in as_completed(futures):
                future.result()

    def validate_compose(
        self,
        *,
        include: set[str] | None = None,
        exclude: set[str] | None = None,
        jobs: int = 1,
    ) -> None:
        specs = self._resolve_stacks(START_ORDER, include=include, exclude=exclude)
        self._prefetch_compose_configs(specs, jobs=jobs)
        for spec in specs:
            cfg = self._load_compose_config(spec, echo=False)
            if cfg is None:
                self._load_compose_config(spec, echo=True)
                raise ControllerError(f"[{spec.key}] compose config failed")
            self._security_scan_config(spec, cfg)
            print(f"[ok] {spec.key}: compose config validated")

    def _security_scan_config(self, spec: StackSpec, cfg: dict) -> None:
        services = cfg.get("services", {}) if isinstance(cfg, dict) else {}
        if not isinstance(services, dict):
            print(
                f"[warn] {spec.key}: compose services is not an object, skipped security scan"
            )
            return
        for service_name, service in services.items():
            if not isinstance(service, dict):
                print(
                    f"[warn] {spec.key}/{service_name}: service entry is not an object, skipped"
                )
                continue
            if service.get("privileged", False):
                print(f"[warn] {spec.key}/{service_name}: privileged=true")
            if service.get("network_mode") == "host":
                print(
                    f"[warn] {spec.key}/{service_name}: network_mode=host (acceptable only by explicit threat model)",
                )
            for source, target, _writable in _iter_bind_volume_entries(service):
                if (
                    source.endswith("/var/run/docker.sock")
                    or target == "/var/run/docker.sock"
                ):
                    print(
                        f"[risk] {spec.key}/{service_name}: docker.sock bind detected ({source} -> {target})",
                    )

    def check_bind_permissions(
        self,
        *,
        include: set[str] | None = None,
        exclude: set[str] | None = None,
    ) -> int:
        specs = self._resolve_stacks(START_ORDER, include=include, exclude=exclude)
        self._prefetch_compose_configs(specs, jobs=1)
        issues = 0
        counts = {"ok": 0, "warn": 0, "fail": 0}
        checked: set[tuple[str, bool]] = set()
        host_uid = os.getuid()
        for spec in specs:
            cfg = self._load_compose_config(spec, echo=False)
            if cfg is None:
                print(f"[warn] {spec.key}: unable to render config for bind checks")
                issues += 1
                counts["warn"] += 1
                continue
            services = cfg.get("services", {}) if isinstance(cfg, dict) else {}
            if not isinstance(services, dict):
                print(
                    f"[warn] {spec.key}: compose services is not an object, skipped bind checks"
                )
                issues += 1
                counts["warn"] += 1
                continue
            for service_name, service in services.items():
                if not isinstance(service, dict):
                    continue
                for source_raw, _target, writable in _iter_bind_volume_entries(service):
                    if not source_raw:
                        continue
                    source = Path(source_raw)
                    if not source.is_absolute():
                        source = (spec.compose_file.parent / source).resolve()
                    marker = (str(source), writable)
                    if marker in checked:
                        continue
                    checked.add(marker)
                    outcome = evaluate_bind_mount_access(
                        source,
                        writable=writable,
                        repo_root=self.repo_root,
                        host_uid=host_uid,
                        service_label=f"{spec.key}/{service_name}",
                    )
                    tag = outcome.level
                    if tag == "ok":
                        print(f"[ok] {source} {outcome.detail}")
                    elif tag == "warn":
                        print(f"[warn] {source} {outcome.detail}")
                    else:
                        print(f"[fail] {source} {outcome.detail}")
                        issues += 1
                    counts[tag] = counts.get(tag, 0) + 1
        print(
            "[ok] bind permission summary: "
            f"{counts['ok']} ok, {counts['warn']} warn, {counts['fail']} fail "
            f"(host uid={host_uid}; service-owned docker/data|logs → warn, not fail)",
        )
        return issues

    @staticmethod
    def _resolve_stack0_backend_profiles(
        stack0_profiles: list[str] | None,
        *,
        action: str,
    ) -> list[str] | None:
        if stack0_profiles is not None:
            return stack0_profiles
        if action in {"up", "down"}:
            return list(DEFAULT_STACK0_BACKEND_PROFILES)
        return None

    def _analyze_stack0_completeness(self) -> int:
        proc = _run([self.runtime, "ps", "-a", "--format", "{{.Names}}\t{{.State}}"])
        if proc.returncode != 0:
            print("[warn] unable to list containers for stack0 completeness check")
            return 0
        running_stack0: set[str] = set()
        state_by_name: dict[str, str] = {}
        for line in proc.stdout.splitlines():
            if not line.strip():
                continue
            parts = line.split("\t", 1)
            name = parts[0].strip()
            state = parts[1].strip().lower() if len(parts) > 1 else ""
            state_by_name[name] = state
            if name.startswith("stack0-eliteew-") and state == "running":
                running_stack0.add(name)
        if not running_stack0:
            return 0
        issues = 0
        for role, accepted_names in CRITICAL_STACK0_CONTAINER_GROUPS:
            running_name = next(
                (name for name in accepted_names if state_by_name.get(name) == "running"),
                None,
            )
            if running_name is None:
                issues += 1
                states = ", ".join(
                    f"{name}={state_by_name.get(name, 'missing')}"
                    for name in accepted_names
                )
                print(
                    f"[issue] stack0 incomplete: {role} ({states}) "
                    f"while other stack0 containers run ({len(running_stack0)} running). "
                    "Hint: eectl --yes recreate --include stack0-backend,stack0-frontend "
                    "or eec → stack0 local recreate.",
                )
        return issues

    def _run_stack_action(
        self,
        action: str,
        ordered: Iterable[str],
        *,
        include: set[str] | None = None,
        exclude: set[str] | None = None,
        force_recreate: bool = False,
        timeout_sec: int = MAX_STOP_TIMEOUT_SEC,
        stack0_profiles: list[str] | None = None,
        stack2_profiles: list[str] | None = None,
        stack11_profiles: list[str] | None = None,
        dry_run: bool = False,
    ) -> int:
        timeout_sec = _resolve_stop_timeout_sec(timeout_sec)
        specs = self._resolve_stacks(ordered, include=include, exclude=exclude)
        failures = 0
        for spec in specs:
            override_profiles: list[str] | None = None
            if spec.key == "stack0-backend":
                override_profiles = self._resolve_stack0_backend_profiles(
                    stack0_profiles,
                    action=action,
                )
            elif spec.key == "stack2" and stack2_profiles is not None:
                override_profiles = stack2_profiles
            elif spec.key == "stack11" and stack11_profiles is not None:
                override_profiles = stack11_profiles

            include_all_profiles = (
                action == "down"
                and spec.key != "stack0-backend"
                and override_profiles is None
            )
            base = self._compose_cmd(
                spec,
                include_all_profiles=include_all_profiles,
                override_profiles=override_profiles,
            )
            command_queue: list[list[str]] = []
            if action == "down":
                command_queue.append(base + ["stop", "--timeout", str(timeout_sec)])
                command_queue.append(base + ["down", "--remove-orphans"])
            elif action == "up":
                cmd = base + ["up", "-d", "--remove-orphans"]
                if force_recreate:
                    cmd.append("--force-recreate")
                command_queue.append(cmd)
            else:
                raise ControllerError(f"Unsupported action: {action}")

            for cmd in command_queue:
                self._echo(cmd)
                if dry_run:
                    continue
                proc = _run(cmd)
                if proc.returncode != 0:
                    failures += 1
                    print(
                        f"[fail] {spec.key}: {proc.stderr.strip() or '(no stderr)'}",
                    )
                    break
                if (
                    action == "up"
                    and force_recreate
                    and spec.key == "stack11"
                    and not dry_run
                ):
                    self._restart_yandex_tunnel_after_jitsi_web()
        return failures

    def _restart_yandex_tunnel_after_jitsi_web(self) -> None:
        """Recreate tunnel after jitsi-web so SSH -R 13402 targets a live :34002 listener."""
        script = (
            self.repo_root / "docker/scripts/yandex-tunnel/restart-after-jitsi-web.sh"
        )
        if not script.is_file():
            print(f"[warn] missing {script}")
            return
        cmd = ["bash", str(script)]
        self._echo(cmd)
        proc = _run(cmd, capture_output=False)
        if proc.returncode != 0:
            print(
                "[warn] restart-after-jitsi-web.sh failed (Meet may log connect_to 127.0.0.1 port 34002: failed)",
            )

    @staticmethod
    def _extract_ps_fields(row: dict[str, Any]) -> tuple[str, str, str]:
        name = str(row.get("Name") or row.get("name") or "?")
        state = str(row.get("State") or row.get("state") or "?")
        health_raw: Any = None
        for hk in ("Health", "health"):
            if hk in row:
                health_raw = row[hk]
                break
        if health_raw is None:
            health = ""
        elif isinstance(health_raw, dict):
            health = str(health_raw.get("Status") or health_raw.get("status") or "")
        else:
            health = str(health_raw)
        return name, state, health

    def collect_container_rows(
        self,
        *,
        include: set[str] | None = None,
        exclude: set[str] | None = None,
    ) -> list[ContainerRow]:
        """Flat numbered list of managed containers (one ``<runtime> ps``, compose project labels)."""
        allowed = {
            spec.key
            for spec in self._resolve_stacks(
                START_ORDER,
                include=include,
                exclude=exclude,
            )
        }
        list_cmd = [self.runtime, "ps", "-a", "--format", "{{json .}}"]
        self._echo(list_cmd)
        proc = _run(list_cmd)
        if proc.returncode != 0:
            raise ControllerError(proc.stderr.strip() or f"{self.runtime} ps failed")

        stack_rank = {key: rank for rank, key in enumerate(START_ORDER)}
        pending: list[tuple[int, str, str, str, str]] = []
        for row in _parse_docker_ps_ndjson(proc.stdout):
            raw_names = row.get("Names")
            if isinstance(raw_names, list):
                name = str(raw_names[0]).strip() if raw_names else ""
            else:
                name = str(raw_names or row.get("Name") or "").strip()
            if not name or not name.startswith(MANAGED_CONTAINER_PREFIXES):
                continue
            project = _compose_project_from_labels(row.get("Labels") or "")
            stack_key = (
                project
                if project in self.stacks
                else _stack_key_from_container_name(name)
            )
            if stack_key not in allowed:
                continue
            state = str(row.get("State") or "?")
            status_blob = str(row.get("Status") or "")
            health = _health_from_docker_status(status_blob)
            if not health and status_blob.lower() in {
                "healthy",
                "unhealthy",
                "starting",
            }:
                health = status_blob.lower()
            pending.append(
                (stack_rank.get(stack_key, 999), name, stack_key, state, health),
            )

        pending.sort(key=lambda item: (item[0], item[1]))
        catalog: list[ContainerRow] = []
        for idx, (_rank, name, stack_key, state, health) in enumerate(pending, start=1):
            catalog.append(
                ContainerRow(
                    index=idx,
                    name=name,
                    stack_key=stack_key,
                    state=state,
                    health=health,
                ),
            )
        return catalog

    def collect_stack_rows(
        self,
        *,
        include: set[str] | None = None,
        exclude: set[str] | None = None,
        only_running: bool = False,
    ) -> list[StackRow]:
        """Group managed containers by stack key; number in START_ORDER."""
        catalog = self.collect_container_rows(include=include, exclude=exclude)
        grouped: dict[str, list[ContainerRow]] = {}
        for row in catalog:
            grouped.setdefault(row.stack_key, []).append(row)

        stack_rank = {key: rank for rank, key in enumerate(START_ORDER)}
        pending: list[tuple[int, str, str, int, int, tuple[str, ...]]] = []
        for stack_key in sorted(
            grouped.keys(), key=lambda key: (stack_rank.get(key, 999), key)
        ):
            containers = grouped[stack_key]
            running_count = sum(
                1 for item in containers if item.state.lower() == "running"
            )
            if only_running and running_count == 0:
                continue
            spec = self.stacks.get(stack_key)
            description = spec.description if spec is not None else stack_key
            names = tuple(sorted(item.name for item in containers))
            pending.append(
                (
                    stack_rank.get(stack_key, 999),
                    stack_key,
                    description,
                    running_count,
                    len(containers),
                    names,
                ),
            )

        rows: list[StackRow] = []
        for idx, (
            _rank,
            stack_key,
            description,
            running_count,
            total_count,
            names,
        ) in enumerate(
            pending,
            start=1,
        ):
            rows.append(
                StackRow(
                    index=idx,
                    stack_key=stack_key,
                    description=description,
                    running_count=running_count,
                    total_count=total_count,
                    container_names=names,
                ),
            )
        return rows

    @staticmethod
    def _resolve_skip_stack_nums(
        catalog: list[StackRow],
        skip_stack_nums: set[int] | None,
    ) -> set[int]:
        if not skip_stack_nums:
            return set()
        valid = {row.index for row in catalog}
        unknown = sorted(skip_stack_nums - valid)
        if unknown:
            valid_text = ", ".join(str(n) for n in sorted(valid)) or "(none)"
            raise ControllerError(
                f"Unknown --skip-stack-num value(s): {', '.join(str(n) for n in unknown)}. "
                f"Valid numbers: {valid_text}. Run `list-stacks` to inspect numbering.",
            )
        return skip_stack_nums

    def print_stack_catalog(
        self,
        catalog: list[StackRow],
        *,
        title: str = "Запущенные стеки (нумерация для recreate-running --skip-stack-num)",
        only_running: bool = True,
    ) -> None:
        if not catalog:
            if only_running:
                print(self._colorize_tag("[info]") + " нет запущенных managed-стеков")
            else:
                print(
                    self._colorize_tag("[info]") + " нет managed-стеков с контейнерами"
                )
            return
        print(title)
        print(f"{'#':>3}  {'Stack key':<22} {'Run/Total':<10} Description")
        print("-" * 95)
        for row in catalog:
            run_total = f"{row.running_count}/{row.total_count}"
            num = (
                self._c(f"{row.index:>3}", _Ansi.BOLD)
                if self._use_color()
                else f"{row.index:>3}"
            )
            key = (
                self._c(row.stack_key, _Ansi.BOLD + _Ansi.CYAN)
                if self._use_color()
                else row.stack_key
            )
            print(f"{num}  {key:<22} {run_total:<10} {row.description}")
            sample = ", ".join(row.container_names[:4])
            if len(row.container_names) > 4:
                sample += f", … (+{len(row.container_names) - 4})"
            print(f"     containers: {sample}")

    def recreate_running_stacks(
        self,
        *,
        include: set[str] | None = None,
        exclude: set[str] | None = None,
        skip_stack_nums: set[int] | None = None,
        timeout_sec: int = MAX_STOP_TIMEOUT_SEC,
        stack0_profiles: list[str] | None = None,
        stack2_profiles: list[str] | None = None,
        stack11_profiles: list[str] | None = None,
        dry_run: bool = False,
        interactive_skip: bool = False,
    ) -> int:
        """Down + up --force-recreate for stacks that currently have running containers."""
        catalog = self.collect_stack_rows(
            include=include, exclude=exclude, only_running=True
        )
        if not catalog:
            print(
                self._colorize_tag("[info]") + " no running managed stacks to recreate"
            )
            return 0

        skip_nums = set(skip_stack_nums or ())
        if interactive_skip and sys.stdin.isatty() and not skip_nums:
            self.print_stack_catalog(catalog)
            raw = input(
                "Номера стеков для исключения (через запятую, Enter=ни одного): ",
            ).strip()
            if raw:
                skip_nums = _int_csv_to_set(raw) or set()

        skip_nums = self._resolve_skip_stack_nums(catalog, skip_nums)
        selected_keys = {row.stack_key for row in catalog if row.index not in skip_nums}
        if not selected_keys:
            raise ControllerError(
                "No stacks left after exclusions. Adjust --skip-stack-num or interactive input.",
            )

        print("Running-stack recreate plan (down → up --force-recreate):")
        for row in catalog:
            marker = "skip" if row.index in skip_nums else "recreate"
            print(
                f"  #{row.index:>2} [{marker}] {row.stack_key} "
                f"({row.running_count}/{row.total_count} containers running)",
            )

        down_issues = self._run_stack_action(
            "down",
            STOP_ORDER,
            include=selected_keys,
            exclude=exclude,
            timeout_sec=timeout_sec,
            stack0_profiles=stack0_profiles,
            stack2_profiles=stack2_profiles,
            stack11_profiles=stack11_profiles,
            dry_run=dry_run,
        )
        if down_issues and not dry_run:
            raise ControllerError("Down phase failed; refusing to continue to up phase")
        up_issues = self._run_stack_action(
            "up",
            START_ORDER,
            include=selected_keys,
            exclude=exclude,
            force_recreate=True,
            timeout_sec=timeout_sec,
            stack0_profiles=stack0_profiles,
            stack2_profiles=stack2_profiles,
            stack11_profiles=stack11_profiles,
            dry_run=dry_run,
        )
        return down_issues + up_issues

    def print_container_catalog(
        self,
        catalog: list[ContainerRow],
        *,
        title: str = "Контейнеры (для выбора номера в logs)",
    ) -> None:
        if not catalog:
            print(self._colorize_tag("[info]") + " нет контейнеров в выбранных стеках")
            return
        print(title)
        print(f"{'#':>3}  {'Name':<42} {'Stack':<22} {'State':<12} Health")
        print("-" * 95)
        for row in catalog:
            health = row.health or "-"
            num = (
                self._c(f"{row.index:>3}", _Ansi.BOLD)
                if self._use_color()
                else f"{row.index:>3}"
            )
            print(f"{num}  {row.name:<42} {row.stack_key:<22} {row.state:<12} {health}")

    def _resolve_catalog_pick(
        self,
        catalog: list[ContainerRow],
        *,
        container: str | None,
        pick: int | None,
    ) -> str:
        if container:
            names = {row.name for row in catalog}
            if container not in names:
                raise ControllerError(
                    f"Unknown container {container!r}. Run `logs` without arguments to see the numbered list.",
                )
            return container
        if pick is not None:
            for row in catalog:
                if row.index == pick:
                    return row.name
            raise ControllerError(
                f"Invalid --pick {pick}; valid range is 1..{len(catalog)}",
            )
        if not sys.stdin.isatty():
            raise ControllerError(
                "Specify container name, --pick N, or run from an interactive terminal",
            )
        self.print_container_catalog(catalog)
        while True:
            raw = input("Номер контейнера (или имя, 0=отмена): ").strip()
            if raw in {"0", "q", "quit", ""}:
                raise ControllerError("Cancelled by user")
            if raw.isdigit():
                chosen = int(raw)
                for row in catalog:
                    if row.index == chosen:
                        return row.name
                print(f"Нет номера {chosen}; введите 1..{len(catalog)}")
                continue
            if any(row.name == raw for row in catalog):
                return raw
            print(f"Неизвестный контейнер: {raw!r}")
        return ""  # unreachable

    def _docker_logs_cmd(
        self,
        name: str,
        *,
        tail: int,
        since: str | None,
        timestamps: bool,
        follow: bool,
    ) -> list[str]:
        cmd = [self.runtime, "logs", name, "--tail", str(tail)]
        if since:
            cmd += ["--since", since]
        if timestamps:
            cmd.append("--timestamps")
        if follow:
            cmd.append("--follow")
        return cmd

    def show_container_logs(
        self,
        *,
        include: set[str] | None = None,
        exclude: set[str] | None = None,
        container: str | None = None,
        pick: int | None = None,
        tail: int = 100,
        since: str | None = None,
        timestamps: bool = False,
        follow: bool = False,
    ) -> int:
        catalog = self.collect_container_rows(include=include, exclude=exclude)
        if not catalog:
            print(self._colorize_tag("[warn]") + " no containers to show logs for")
            return 1
        name = self._resolve_catalog_pick(catalog, container=container, pick=pick)
        cmd = self._docker_logs_cmd(
            name,
            tail=tail,
            since=since,
            timestamps=timestamps,
            follow=follow,
        )
        self._echo(cmd)
        if follow:
            return subprocess.run(cmd, check=False).returncode
        proc = _run(cmd)
        if proc.returncode != 0:
            err = proc.stderr.strip() or proc.stdout.strip() or "(no output)"
            raise ControllerError(f"{self.runtime} logs failed for {name}:\n{err}")
        combined = "\n".join(
            part for part in (proc.stdout or "", proc.stderr or "") if part
        )
        if combined:
            print(combined, end="" if combined.endswith("\n") else "\n")
        return 0

    @staticmethod
    def _compile_log_error_patterns(extra: list[str] | None) -> list[re.Pattern[str]]:
        patterns = list(DEFAULT_LOG_ERROR_PATTERNS)
        if extra:
            patterns.extend(extra)
        return [re.compile(p, re.IGNORECASE) for p in patterns]

    @staticmethod
    def _line_matches_error_patterns(
        line: str,
        compiled: list[re.Pattern[str]],
    ) -> bool:
        return any(p.search(line) for p in compiled)

    def show_logs_errors(
        self,
        *,
        include: set[str] | None = None,
        exclude: set[str] | None = None,
        tail: int = 200,
        since: str | None = None,
        extra_patterns: list[str] | None = None,
        only_running: bool = False,
    ) -> int:
        """Scan managed containers and print log lines matching error heuristics."""
        catalog = self.collect_container_rows(include=include, exclude=exclude)
        if not catalog:
            print(self._colorize_tag("[info]") + " no containers")
            return 0
        compiled = self._compile_log_error_patterns(extra_patterns)
        hits = 0
        containers_with_hits = 0
        for row in catalog:
            if only_running and row.state.lower() != "running":
                continue
            cmd = self._docker_logs_cmd(
                row.name,
                tail=tail,
                since=since,
                timestamps=True,
                follow=False,
            )
            proc = _run(cmd)
            if proc.returncode != 0:
                print(
                    f"{self._colorize_tag('[warn]')} {row.name}: cannot read logs ({proc.stderr.strip() or 'failed'})",
                )
                continue
            log_blob = "\n".join(
                part for part in (proc.stdout or "", proc.stderr or "") if part
            )
            matched_lines: list[str] = []
            for line in log_blob.splitlines():
                if self._line_matches_error_patterns(line, compiled):
                    matched_lines.append(line)
            if not matched_lines:
                continue
            containers_with_hits += 1
            hits += len(matched_lines)
            header = f"=== {row.name} [{row.stack_key}] state={row.state} ==="
            print(
                self._c(header, _Ansi.BOLD + _Ansi.CYAN)
                if self._use_color()
                else header
            )
            for line in matched_lines:
                if self._use_color():
                    print(self._c(line, _Ansi.RED))
                else:
                    print(line)
            print()
        if containers_with_hits == 0:
            print(
                self._colorize_tag("[ok]")
                + f" no error-like log lines in last {tail} lines "
                f"({len(catalog)} container(s) scanned)",
            )
            return 0
        print(
            self._colorize_tag("[info]")
            + f" {hits} line(s) in {containers_with_hits} container(s)",
        )
        return 0

    def show_status(
        self,
        *,
        include: set[str] | None = None,
        exclude: set[str] | None = None,
        numbered: bool = False,
    ) -> int:
        catalog = self.collect_container_rows(include=include, exclude=exclude)
        if numbered:
            self.print_container_catalog(
                catalog,
                title="Статус контейнеров (нумерация для logs)",
            )
            return 0
        issues = 0
        for row in catalog:
            health_suffix = f", health={row.health}" if row.health else ""
            severity = self._severity_for_row(row.state, row.health)
            line = f"[{row.stack_key}] {row.name}: state={row.state}{health_suffix}"
            if self._use_color():
                prefix = self._c(f"[{row.stack_key}]", _Ansi.BOLD + _Ansi.CYAN)
                state_hl = self._c(f"state={row.state}", self._line_color(severity))
                health_part = ""
                if row.health:
                    hc = (
                        _Ansi.GREEN
                        if row.health == "healthy"
                        else _Ansi.RED
                        if row.health == "unhealthy"
                        else _Ansi.YELLOW
                    )
                    health_part = ", " + self._c(f"health={row.health}", hc)
                line = f"{prefix} {row.name}: {state_hl}{health_part}"
            print(line)
            if severity == "bad" or "restarting" in row.state.lower():
                issues += 1
        if not catalog:
            print(self._colorize_tag("[info]") + " no containers in selected stacks")
        return issues

    def analyze_containers(
        self,
        *,
        include: set[str] | None = None,
        exclude: set[str] | None = None,
    ) -> int:
        catalog = self.collect_container_rows(include=include, exclude=exclude)
        managed = [row.name for row in catalog]
        if not managed:
            print(self._colorize_tag("[info]") + " no managed containers detected")
            return 0

        inspect_cmd = [self.runtime, "inspect", *managed]
        self._echo(inspect_cmd)
        ins = _run(inspect_cmd)
        if ins.returncode != 0:
            raise ControllerError(
                ins.stderr.strip() or f"{self.runtime} inspect failed"
            )
        payload = json.loads(ins.stdout or "[]")
        if isinstance(payload, dict):
            payload_list: list[Any] = [payload]
        elif isinstance(payload, list):
            payload_list = payload
        else:
            payload_list = []
        issues = 0
        for item in payload_list:
            if not isinstance(item, dict):
                continue
            name = str(item.get("Name", "")).lstrip("/") or "unknown"
            state_raw = item.get("State", {}) or {}
            if isinstance(state_raw, dict):
                status = str(state_raw.get("Status", "unknown"))
                health_blob = state_raw.get("Health") or {}
                if isinstance(health_blob, dict):
                    health = str(health_blob.get("Status", ""))
                else:
                    health = str(health_blob) if health_blob else ""
            else:
                status = str(state_raw)
                health = ""
            try:
                restart_count = int(item.get("RestartCount", 0) or 0)
            except TypeError, ValueError:
                restart_count = 0
            if (
                status == "running"
                and health not in {"unhealthy"}
                and restart_count < 3
            ):
                continue
            issues += 1
            msg = f"[issue] {name}: status={status}, health={health or '-'}, restart_count={restart_count}"
            if self._use_color():
                st = (status or "").lower()
                ht = health or "-"
                st_c = (
                    _Ansi.GREEN
                    if st == "running" and ht not in {"unhealthy"}
                    else _Ansi.RED
                    if st in {"exited", "dead"} or ht == "unhealthy"
                    else _Ansi.YELLOW
                )
                msg = (
                    f"{self._c('[issue]', _Ansi.RED + _Ansi.BOLD)} {name}: "
                    f"{self._c('status=' + status, st_c)}, "
                    f"{self._c('health=' + ht, _Ansi.RED if ht == 'unhealthy' else _Ansi.YELLOW)}, "
                    f"restart_count={restart_count}"
                )
            print(msg)
        issues += self._analyze_stack0_completeness()
        if issues == 0:
            print(
                self._colorize_tag("[ok]")
                + " no unhealthy/restarting/exited managed containers",
            )
        return issues

    def run_doctor(
        self,
        *,
        include: set[str] | None = None,
        exclude: set[str] | None = None,
        jobs: int = 4,
    ) -> int:
        total_issues = 0
        self.validate_runtime()
        self.validate_compose(include=include, exclude=exclude, jobs=jobs)
        total_issues += self.show_status(include=include, exclude=exclude)
        total_issues += self.analyze_containers(include=include, exclude=exclude)
        total_issues += self.check_bind_permissions(include=include, exclude=exclude)
        return total_issues


def _csv_to_set(value: str | None) -> set[str] | None:
    if value is None:
        return None
    return {item.strip() for item in value.split(",") if item.strip()}


def _csv_to_list(value: str | None) -> list[str] | None:
    if value is None:
        return None
    return [item.strip() for item in value.split(",") if item.strip()]


def _int_csv_to_set(value: str | None) -> set[int] | None:
    if value is None:
        return None
    out: set[int] = set()
    for item in value.split(","):
        token = item.strip()
        if not token:
            continue
        if not token.isdigit() or int(token) <= 0:
            raise ControllerError(
                f"Invalid stack number {token!r}; expected positive integers in --skip-stack-num",
            )
        out.add(int(token))
    return out or None


def _confirm_or_fail(auto_yes: bool, text: str) -> None:
    if auto_yes:
        return
    answer = input(f"{text} [y/N]: ").strip().lower()
    if answer not in {"y", "yes"}:
        raise ControllerError("Cancelled by user")


def _interactive(controller: StackController, args: argparse.Namespace) -> int:
    include = _csv_to_set(args.include)
    exclude = _csv_to_set(args.exclude)
    stack0_profiles = _csv_to_list(args.stack0_profiles)
    stack2_profiles = _csv_to_list(args.stack2_profiles)
    stack11_profiles = _csv_to_list(args.stack11_profiles)

    def _run_validate() -> int:
        controller.validate_runtime()
        controller.validate_compose(
            include=include,
            exclude=exclude,
            jobs=max(1, int(args.jobs)),
        )
        return 0

    actions: dict[str, tuple[str, Callable[[], int | None]]] = {
        "1": ("validate runtime + compose", _run_validate),
        "2": (
            "show status",
            lambda: controller.show_status(include=include, exclude=exclude),
        ),
        "3": (
            "show status (numbered, for logs pick)",
            lambda: controller.show_status(
                include=include, exclude=exclude, numbered=True
            ),
        ),
        "4": (
            "analyze health/restarts",
            lambda: controller.analyze_containers(include=include, exclude=exclude),
        ),
        "5": (
            "check bind permissions",
            lambda: controller.check_bind_permissions(include=include, exclude=exclude),
        ),
        "6": (
            "container logs (pick by number)",
            lambda: controller.show_container_logs(include=include, exclude=exclude),
        ),
        "7": (
            "logs: errors across all containers",
            lambda: controller.show_logs_errors(include=include, exclude=exclude),
        ),
        "8": (
            "ordered stop all",
            lambda: (
                _confirm_or_fail(args.yes, "Proceed with ordered shutdown?"),
                controller._run_stack_action(
                    "down",
                    STOP_ORDER,
                    include=include,
                    exclude=exclude,
                    timeout_sec=args.timeout,
                    stack0_profiles=stack0_profiles,
                ),
            )[1],
        ),
        "9": (
            "ordered start all",
            lambda: controller._run_stack_action(
                "up",
                START_ORDER,
                include=include,
                exclude=exclude,
                timeout_sec=args.timeout,
                stack0_profiles=stack0_profiles,
                stack2_profiles=stack2_profiles,
                stack11_profiles=stack11_profiles,
            ),
        ),
        "10": (
            "full recreate (down + up --force-recreate)",
            lambda: (
                _confirm_or_fail(
                    args.yes,
                    "Proceed with full recreate (down + up --force-recreate)?",
                ),
                (
                    controller._run_stack_action(
                        "down",
                        STOP_ORDER,
                        include=include,
                        exclude=exclude,
                        timeout_sec=args.timeout,
                        stack0_profiles=stack0_profiles,
                        stack2_profiles=stack2_profiles,
                        stack11_profiles=stack11_profiles,
                    )
                    + controller._run_stack_action(
                        "up",
                        START_ORDER,
                        include=include,
                        exclude=exclude,
                        force_recreate=True,
                        timeout_sec=args.timeout,
                        stack0_profiles=stack0_profiles,
                        stack2_profiles=stack2_profiles,
                        stack11_profiles=stack11_profiles,
                    )
                ),
            )[1],
        ),
        "11": (
            "doctor (all checks)",
            lambda: controller.run_doctor(
                include=include,
                exclude=exclude,
                jobs=max(1, int(args.jobs)),
            ),
        ),
        "0": ("quit", lambda: 0),
    }

    def _menu_order(key: str) -> tuple[int, str]:
        if key == "0":
            return (-1, key)
        try:
            return (int(key), key)
        except ValueError:
            return (999, key)

    while True:
        print("\nEliteEW container control menu:")
        for key in sorted(actions, key=_menu_order):
            title, _ = actions[key]
            print(f"  {key}. {title}")
        choice = input("Select action: ").strip()
        if choice == "0":
            return 0
        action = actions.get(choice)
        if action is None:
            print("Unknown action")
            continue
        try:
            result = action[1]()
            if result:
                print(f"[done] issues={result}")
            else:
                print("[done] ok")
        except ControllerError as exc:
            print(f"[error] {exc}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="EliteEW ordered container stack lifecycle and diagnostics (docker/podman)",
    )
    parser.add_argument(
        "--repo-root",
        default=str(Path(__file__).resolve().parents[2]),
        help="Path to powered_by_emperyworld repository root",
    )
    parser.add_argument(
        "--allow-root",
        action="store_true",
        help="Allow root execution (not recommended)",
    )
    parser.add_argument(
        "--require-nonlocal-endpoint",
        action="store_true",
        help="Fail when docker endpoint is local unix socket (/var/run/docker.sock); docker runtime only",
    )
    parser.add_argument("--include", help="Comma-separated stack keys to include")
    parser.add_argument("--exclude", help="Comma-separated stack keys to exclude")
    parser.add_argument(
        "--timeout",
        type=int,
        default=MAX_STOP_TIMEOUT_SEC,
        help=f"Compose stop timeout in seconds, 1–{MAX_STOP_TIMEOUT_SEC} (default: {MAX_STOP_TIMEOUT_SEC})",
    )
    parser.add_argument(
        "--stack0-profiles",
        help="Comma-separated stack0-backend profiles (default: punisher-local-workers,site-studio-worker)",
    )
    parser.add_argument(
        "--stack2-profiles",
        help="Comma-separated stack2 profiles for up/recreate (example: local-stack2-embed-rerank,tei-cpu-embed)",
    )
    parser.add_argument(
        "--stack11-profiles",
        help="Comma-separated stack11 profiles for up/recreate (example: recording,collab)",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip confirmation prompts for destructive actions",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print commands without executing lifecycle actions",
    )
    parser.add_argument(
        "--color",
        choices=("auto", "always", "never"),
        default="auto",
        help="Colorize status/analyze output (default: auto — use color when stdout is a TTY)",
    )
    parser.add_argument(
        "--jobs",
        type=int,
        default=4,
        metavar="N",
        help="Parallel compose config renders for validate/doctor (default: 4, min 1)",
    )

    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("validate", help="Validate selected runtime and compose configs")
    sub.add_parser("status", help="Show stack status")
    sub.add_parser(
        "analyze", help="Show unhealthy/restarting/exited managed containers"
    )
    sub.add_parser("check-perms", help="Check local bind mount path permissions")
    sub.add_parser("doctor", help="Run all diagnostics")
    sub.add_parser("down", help="Ordered shutdown (apps first, data last)")
    sub.add_parser("up", help="Ordered startup (data first, apps last)")
    sub.add_parser(
        "recreate", help="Ordered full recreate (down then up --force-recreate)"
    )
    sub.add_parser("interactive", help="Interactive control menu")

    sub.add_parser("list", help="Numbered list of managed containers")

    list_stacks_p = sub.add_parser(
        "list-stacks",
        help="Numbered list of managed stacks (default: only stacks with running containers)",
    )
    list_stacks_p.add_argument(
        "--all",
        action="store_true",
        help="Include stacks that have containers but none running",
    )

    recreate_running_p = sub.add_parser(
        "recreate-running",
        help="Down + up --force-recreate only for stacks with running containers",
    )
    recreate_running_p.add_argument(
        "--skip-stack-num",
        help="Comma-separated stack numbers to exclude (see list-stacks)",
    )
    recreate_running_p.add_argument(
        "--ask-skip",
        action="store_true",
        help="After list-stacks view, prompt for stack numbers to exclude",
    )

    logs_p = sub.add_parser(
        "logs", help="Show logs for one container (by name, --pick, or prompt)"
    )
    logs_p.add_argument(
        "container",
        nargs="?",
        help="Container name (e.g. stack1-rabbitmq); omit for interactive pick",
    )
    logs_p.add_argument(
        "--pick", type=int, metavar="N", help="Pick container by number from list"
    )
    logs_p.add_argument(
        "--tail", type=int, default=100, help="Lines from log end (default: 100)"
    )
    logs_p.add_argument(
        "--since", help="Only logs since duration (logs --since, e.g. 1h)"
    )
    logs_p.add_argument(
        "-f",
        "--follow",
        action="store_true",
        help="Stream logs (logs -f)",
    )
    logs_p.add_argument(
        "--timestamps",
        action="store_true",
        help="Prefix each line with timestamp",
    )

    err_p = sub.add_parser(
        "logs-errors",
        help="Scan all managed containers; print log lines matching error heuristics",
    )
    err_p.add_argument(
        "--tail", type=int, default=200, help="Lines per container (default: 200)"
    )
    err_p.add_argument("--since", help="Only logs since duration (e.g. 30m)")
    err_p.add_argument(
        "--pattern",
        action="append",
        dest="patterns",
        metavar="REGEX",
        help="Extra case-insensitive regex (repeatable)",
    )
    err_p.add_argument(
        "--running-only",
        action="store_true",
        help="Skip containers not in running state",
    )

    return parser


SUBCOMMANDS = frozenset(
    {
        "validate",
        "status",
        "analyze",
        "check-perms",
        "doctor",
        "down",
        "up",
        "recreate",
        "interactive",
        "list",
        "list-stacks",
        "recreate-running",
        "logs",
        "logs-errors",
    }
)

# Root parser options that may appear after the subcommand (argparse requires them before).
ROOT_OPTION_ARITY: dict[str, int] = {
    "--repo-root": 1,
    "--allow-root": 0,
    "--require-nonlocal-endpoint": 0,
    "--include": 1,
    "--exclude": 1,
    "--timeout": 1,
    "--stack0-profiles": 1,
    "--stack2-profiles": 1,
    "--stack11-profiles": 1,
    "--yes": 0,
    "--dry-run": 0,
    "--color": 1,
    "--jobs": 1,
}


def _normalize_argv(argv: list[str]) -> list[str]:
    """Move root-level flags from after the subcommand to before it."""
    if not argv:
        return argv

    sub_idx = next((i for i, token in enumerate(argv) if token in SUBCOMMANDS), None)
    if sub_idx is None:
        return argv

    prefix = argv[:sub_idx]
    subcommand = argv[sub_idx]
    suffix = argv[sub_idx + 1 :]

    moved: list[str] = []
    remainder: list[str] = []
    i = 0
    while i < len(suffix):
        token = suffix[i]
        if token in ROOT_OPTION_ARITY:
            arity = ROOT_OPTION_ARITY[token]
            moved.append(token)
            for offset in range(arity):
                if i + 1 + offset < len(suffix):
                    moved.append(suffix[i + 1 + offset])
            i += 1 + arity
            continue
        remainder.append(token)
        i += 1

    return prefix + moved + [subcommand] + remainder


def main() -> int:
    parser = build_parser()
    args = parser.parse_args(_normalize_argv(sys.argv[1:]))
    args.timeout = _resolve_stop_timeout_sec(args.timeout)
    include = _csv_to_set(args.include)
    exclude = _csv_to_set(args.exclude)

    try:
        controller = StackController(
            Path(args.repo_root),
            allow_root=args.allow_root,
            require_nonlocal_endpoint=args.require_nonlocal_endpoint,
            color=str(args.color),
        )
        known = set(controller.stacks)
        if include:
            unknown = include - known
            if unknown:
                raise ControllerError(
                    f"Unknown stack keys in --include: {', '.join(sorted(unknown))}"
                )
        if exclude:
            unknown = exclude - known
            if unknown:
                raise ControllerError(
                    f"Unknown stack keys in --exclude: {', '.join(sorted(unknown))}"
                )
        jobs = max(1, int(args.jobs))
        if args.command == "validate":
            controller.validate_runtime()
            controller.validate_compose(include=include, exclude=exclude, jobs=jobs)
            return 0
        if args.command == "status":
            return 1 if controller.show_status(include=include, exclude=exclude) else 0
        if args.command == "analyze":
            return (
                1
                if controller.analyze_containers(include=include, exclude=exclude)
                else 0
            )
        if args.command == "check-perms":
            return (
                1
                if controller.check_bind_permissions(include=include, exclude=exclude)
                else 0
            )
        if args.command == "doctor":
            return (
                1
                if controller.run_doctor(include=include, exclude=exclude, jobs=jobs)
                else 0
            )
        if args.command == "down":
            _confirm_or_fail(args.yes, "Proceed with ordered shutdown?")
            issues = controller._run_stack_action(
                "down",
                STOP_ORDER,
                include=include,
                exclude=exclude,
                timeout_sec=args.timeout,
                stack0_profiles=_csv_to_list(args.stack0_profiles),
                stack2_profiles=_csv_to_list(args.stack2_profiles),
                stack11_profiles=_csv_to_list(args.stack11_profiles),
                dry_run=args.dry_run,
            )
            return 1 if issues else 0
        if args.command == "up":
            issues = controller._run_stack_action(
                "up",
                START_ORDER,
                include=include,
                exclude=exclude,
                timeout_sec=args.timeout,
                stack0_profiles=_csv_to_list(args.stack0_profiles),
                stack2_profiles=_csv_to_list(args.stack2_profiles),
                stack11_profiles=_csv_to_list(args.stack11_profiles),
                dry_run=args.dry_run,
            )
            return 1 if issues else 0
        if args.command == "recreate":
            _confirm_or_fail(
                args.yes, "Proceed with full recreate (down + up --force-recreate)?"
            )
            down_issues = controller._run_stack_action(
                "down",
                STOP_ORDER,
                include=include,
                exclude=exclude,
                timeout_sec=args.timeout,
                stack0_profiles=_csv_to_list(args.stack0_profiles),
                stack2_profiles=_csv_to_list(args.stack2_profiles),
                stack11_profiles=_csv_to_list(args.stack11_profiles),
                dry_run=args.dry_run,
            )
            if down_issues and not args.dry_run:
                raise ControllerError(
                    "Down phase failed; refusing to continue to up phase"
                )
            up_issues = controller._run_stack_action(
                "up",
                START_ORDER,
                include=include,
                exclude=exclude,
                force_recreate=True,
                timeout_sec=args.timeout,
                stack0_profiles=_csv_to_list(args.stack0_profiles),
                stack2_profiles=_csv_to_list(args.stack2_profiles),
                stack11_profiles=_csv_to_list(args.stack11_profiles),
                dry_run=args.dry_run,
            )
            return 1 if (down_issues + up_issues) else 0
        if args.command == "interactive":
            return _interactive(controller, args)
        if args.command == "list":
            controller.print_container_catalog(
                controller.collect_container_rows(include=include, exclude=exclude),
            )
            return 0
        if args.command == "list-stacks":
            only_running = not bool(args.all)
            catalog = controller.collect_stack_rows(
                include=include,
                exclude=exclude,
                only_running=only_running,
            )
            title = (
                "Запущенные стеки (нумерация для recreate-running --skip-stack-num)"
                if only_running
                else "Managed-стеки с контейнерами (нумерация по START_ORDER)"
            )
            controller.print_stack_catalog(
                catalog,
                title=title,
                only_running=only_running,
            )
            return 0
        if args.command == "recreate-running":
            _confirm_or_fail(
                args.yes,
                "Proceed with recreate of currently running stacks (down + up --force-recreate)?",
            )
            issues = controller.recreate_running_stacks(
                include=include,
                exclude=exclude,
                skip_stack_nums=_int_csv_to_set(args.skip_stack_num),
                timeout_sec=args.timeout,
                stack0_profiles=_csv_to_list(args.stack0_profiles),
                stack2_profiles=_csv_to_list(args.stack2_profiles),
                stack11_profiles=_csv_to_list(args.stack11_profiles),
                dry_run=args.dry_run,
                interactive_skip=bool(args.ask_skip),
            )
            return 1 if issues else 0
        if args.command == "logs":
            return controller.show_container_logs(
                include=include,
                exclude=exclude,
                container=args.container,
                pick=args.pick,
                tail=args.tail,
                since=args.since,
                timestamps=args.timestamps,
                follow=args.follow,
            )
        if args.command == "logs-errors":
            return controller.show_logs_errors(
                include=include,
                exclude=exclude,
                tail=args.tail,
                since=args.since,
                extra_patterns=args.patterns,
                only_running=args.running_only,
            )
        parser.error(f"Unknown command: {args.command}")
        return 2
    except ControllerError as exc:
        print(f"[error] {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
