# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared LAN tool-router sidecar URL/model resolution for marketing, desktop, and EWA companion.
# Invariants:
# - Fallback base is stack2-llama-tool-router:8080, never main chat LLAMA_URL (llama-chat).
# - Env chain: domain-specific URL → EWA_COMPANION → DESKTOP → docker sidecar hostname.
# Related:
# - documentation/platform/STACK2-LLM-CONTRACT.md
# - api/services/marketing_cabinet/marketing_tool_router.py
# ---
"""Resolve HTTP base URL and model for the shared Qwen-class tool-router sidecar."""

from __future__ import annotations

import os

_DEFAULT_TOOL_ROUTER_DOCKER_BASE = "http://stack2-llama-tool-router:8080"
_DEFAULT_TOOL_ROUTER_MODEL = "Qwen3-4B-Instruct-2507-Q4_K_M.gguf"
_DEFAULT_LAN_HOST = "192.168.1.141"
_DEFAULT_LAN_TOOL_ROUTER_PORT = "8083"

_TOOL_ROUTER_URL_ENVS = (
    "MARKETING_CABINET_TOOL_ROUTER_URL",
    "EWA_COMPANION_TOOL_ROUTER_URL",
    "DESKTOP_AI_CHAT_TOOL_ROUTER_URL",
)


def shared_tool_router_url_explicitly_set(*, primary_url_env: str | None = None) -> bool:
    """True when any tool-router URL env is non-empty (not the docker default hostname)."""

    envs: list[str] = []
    if primary_url_env:
        envs.append(primary_url_env)
    envs.extend(_TOOL_ROUTER_URL_ENVS)
    seen: set[str] = set()
    for name in envs:
        if name in seen:
            continue
        seen.add(name)
        if os.getenv(name, "").strip():
            return True
    return False


def _lan_tool_router_host() -> str:
    for candidate in (
        os.getenv("LLAMA_REMOTE_HOST", "").strip(),
        os.getenv("HOST_IP", "").strip(),
    ):
        if candidate and candidate not in ("127.0.0.1", "localhost"):
            return candidate.rstrip("/")
    return _DEFAULT_LAN_HOST


def _lan_tool_router_base_url() -> str:
    port = (
        os.getenv("LLAMA_TOOL_ROUTER_HOST_PORT", _DEFAULT_LAN_TOOL_ROUTER_PORT).strip() or _DEFAULT_LAN_TOOL_ROUTER_PORT
    )
    return f"http://{_lan_tool_router_host()}:{port}"


_DOCKER_TOOL_ROUTER_HOST = "stack2-llama-tool-router"


def _prefer_lan_tool_router_over_docker_hostname(url: str) -> str:
    """Prod-core / dev-bind API often cannot resolve ``stack2-llama-tool-router`` — use gpu141 LAN."""

    base = (url or "").strip().rstrip("/")
    if _DOCKER_TOOL_ROUTER_HOST not in base:
        return base
    explicit_lan = os.getenv("LLAMA_TOOL_ROUTER_URL", "").strip().rstrip("/")
    if explicit_lan and _DOCKER_TOOL_ROUTER_HOST not in explicit_lan:
        return explicit_lan
    return _lan_tool_router_base_url()


def shared_tool_router_base_url(*, primary_url_env: str | None = None) -> str:
    """LAN / docker tool-router sidecar base (port 8083 class), not llama-chat."""

    candidates: list[str] = []
    if primary_url_env:
        candidates.append(os.getenv(primary_url_env, "").strip())
    candidates.extend(
        [
            os.getenv("EWA_COMPANION_TOOL_ROUTER_URL", "").strip(),
            os.getenv("DESKTOP_AI_CHAT_TOOL_ROUTER_URL", "").strip(),
        ]
    )
    for raw in candidates:
        base = raw.rstrip("/")
        if base:
            return _prefer_lan_tool_router_over_docker_hostname(base)
    explicit_lan = os.getenv("LLAMA_TOOL_ROUTER_URL", "").strip().rstrip("/")
    if explicit_lan:
        return _prefer_lan_tool_router_over_docker_hostname(explicit_lan)
    if os.getenv("HOST_IP", "").strip() or os.getenv("LLAMA_TOOL_ROUTER_HOST_PORT", "").strip():
        return _lan_tool_router_base_url()
    return _DEFAULT_TOOL_ROUTER_DOCKER_BASE


def shared_tool_router_model(*, primary_model_env: str | None = None) -> str:
    candidates: list[str] = []
    if primary_model_env:
        candidates.append(os.getenv(primary_model_env, "").strip())
    candidates.extend(
        [
            os.getenv("EWA_COMPANION_TOOL_ROUTER_MODEL", "").strip(),
            os.getenv("DESKTOP_AI_CHAT_TOOL_ROUTER_MODEL", "").strip(),
            os.getenv("MARKETING_CABINET_TOOL_ROUTER_MODEL", "").strip(),
            os.getenv("LLAMA_TOOL_ROUTER_FILE", "").strip(),
        ]
    )
    for raw in candidates:
        if raw:
            return raw
    return _DEFAULT_TOOL_ROUTER_MODEL


def marketing_tool_router_stack2_fallback_enabled() -> bool:
    raw = os.getenv("MARKETING_CABINET_TOOL_ROUTER_FALLBACK_STACK2", "0").strip().lower()
    return raw in ("1", "true", "yes", "on")
