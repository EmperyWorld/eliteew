# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Build ``OrchestrationContext`` + ``PolicyContext`` for authenticated desktop orchestration turns;
# parse envelope, validate observation wire, normalize optional ``metadata.companion`` hints, run
# ``run_orchestration_turn`` (including ``companion_context`` journal entry when useful), return ``EwaResponseV1``.
# Invariants:
# - Policy uses ``BasicDesktopPolicyEngine`` with allowlist from ``EWA_DESKTOP_ORCH_APP_ALLOWLIST`` (CSV).
# - EliteEW HTTP desktop driver is used only when ``EWA_ORCH_USE_ELITEEW_HTTP`` is truthy and ``Authorization: Bearer`` present;
#   driver/hint ``httpx`` base is ``unified_settings.eliteew_self_http_base_url`` (loopback ``API_PORT``, not ``public_base_url``).
# - Optional UGS hint driver: ``EWA_ORCH_ATTACH_UGS_HTTP`` + Bearer; profile ``EWA_ORCH_UGS_PROFILE`` (``model_routing`` | ``generation_inventory``).
# - Optional shell-state hint drivers (GET ``/api/v1/desktop/shell-state``): ``EWA_ORCH_ATTACH_DOCUMENTS_SHELL_HINT``,
#   ``EWA_ORCH_ATTACH_CONTENT_SHELL_HINT`` (both require Bearer).
# - HTTP LLM for intent proposal: ``EWA_ORCH_USE_HTTP_LLM``; model override ``EWA_ORCH_LLM_MODEL``.
# - When ``EWA_DATABASE_URL`` pool is absent, optional ``app.state.ewa_orchestration_memory_stores`` shares one ``InMemoryOrchestrationStores`` across requests (tests / SSE smoke).
# - When pool is present and a companion row exists for the principal, orchestration passes ``companion_profile_llm_wire`` into the LLM ``complete`` variables only (no raw PII blobs in logs).
# - Invalid ``payload.metadata.companion`` shapes are dropped with codes in ``payload.persistence.companion.hints_warnings``; the HTTP turn still succeeds.
# Related:
# - shared/api/ewa_platform/gateways/desktop_http.py
# - shared/api/ewa_platform/core/orchestrator.py
# - shared/api/ewa_platform/persistence_pg/companion_asyncpg.py
# - shared/api/core/auth.py
# ---
"""Runtime wiring for EWA desktop orchestration HTTP."""

from __future__ import annotations

import asyncio
import logging
import os
from collections.abc import AsyncIterator, Mapping, Sequence
from typing import Any

from fastapi import HTTPException, Request, status

from api.core.auth import User
from api.core.unified_config import unified_settings
from api.ewa_platform.adapters.eliteew_desktop_http import EliteEwDesktopHttpDriverStub
from api.ewa_platform.adapters.eliteew_shell_domain_hints_http import (
    EliteEwContentManagerShellHintHttpDriver,
    EliteEwDocumentsWorkspaceShellHintHttpDriver,
    EliteEwShellStateHintHttpCache,
)
from api.ewa_platform.adapters.eliteew_ugs_http import EliteEwUgsHttpDriverStub, UgsHttpProfile
from api.ewa_platform.adapters.http_client_config import HttpClientConfig
from api.ewa_platform.contracts.policy_context import PolicyContext
from api.ewa_platform.core.orchestration_context import OrchestrationContext
from api.ewa_platform.core.orchestrator import run_orchestration_turn
from api.ewa_platform.gateways.desktop_http import (
    DESKTOP_ORCH_PAYLOAD_KIND,
    parse_envelope_or_raise,
)
from api.ewa_platform.gateways.desktop_sse import ORCHESTRATION_SSE_KEEPALIVE, iter_sse_data_events
from api.ewa_platform.io.desktop_orchestration_payload import (
    normalize_desktop_orchestration_turn_companion_hints,
)
from api.ewa_platform.io.desktop_payload import ensure_desktop_observation_wire_or_raise
from api.ewa_platform.io.envelope import (
    EWA_IO_API_VERSION,
    EwaResponseMessageType,
    EwaResponseV1,
    ewa_response_v1_to_mapping,
)
from api.ewa_platform.llm.client import LlmClient, StubLlmClient
from api.ewa_platform.llm.http_orch_llm import HttpOrchestrationLlmClient
from api.ewa_platform.persistence.in_memory_orchestration import InMemoryOrchestrationStores
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from api.ewa_platform.persistence_pg.orchestration_asyncpg import AsyncPgOrchestrationStores
from api.ewa_platform.policy.engine import BasicDesktopPolicyEngine
from api.ewa_platform.testing.fake_desktop_driver import FakeDesktopDriver

DESKTOP_ORCH_RESULT_PAYLOAD_KIND = "ewa_desktop_orchestration_result_v1"

logger = logging.getLogger(__name__)


def _env_truthy(raw: str | None) -> bool:
    if raw is None:
        return False
    return str(raw).strip().lower() in ("1", "true", "yes", "on")


def policy_context_from_auth_user(user: User) -> PolicyContext:
    """Map EliteEW ``User`` to AMKA ``PolicyContext`` (roles as frozenset of string names)."""

    role = str(user.role or "").strip()
    role_names = frozenset({role}) if role else frozenset()
    return PolicyContext(principal_id=str(user.id), role_names=role_names)


def parse_desktop_app_allowlist_from_env() -> frozenset[str]:
    """Comma-separated app_component ids allowed for ``open_app`` (``BasicDesktopPolicyEngine``)."""

    raw = os.getenv("EWA_DESKTOP_ORCH_APP_ALLOWLIST", "")
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    return frozenset(parts)


def extract_bearer_token(request: Request) -> str | None:
    """Return bearer token string or ``None``."""

    h = request.headers.get("Authorization") or request.headers.get("authorization")
    if not h or not isinstance(h, str):
        return None
    bits = h.split(None, 1)
    if len(bits) != 2 or bits[0].lower() != "bearer":
        return None
    tok = bits[1].strip()
    return tok or None


def orchestration_store_kind(request: Request) -> str:
    """Label persistence backing this request (logging only)."""

    pool = getattr(request.app.state, "ewa_orchestration_pool", None)
    shared_memory = getattr(request.app.state, "ewa_orchestration_memory_stores", None)
    if pool is not None:
        return "asyncpg"
    if shared_memory is not None:
        return "shared_memory"
    return "ephemeral_memory"


def orchestration_persistence_status(request: Request) -> dict[str, Any]:
    """Small JSON-safe status block returned to operator UI with every turn."""

    store_kind = orchestration_store_kind(request)
    persisted_across_requests = store_kind in {"asyncpg", "shared_memory"}
    status_block: dict[str, Any] = {
        "store_kind": store_kind,
        "persisted_across_requests": persisted_across_requests,
    }
    if not persisted_across_requests:
        status_block["operator_note"] = (
            "EWA_DATABASE_URL is unset and shared in-memory stores are not configured; "
            "POST turn and later SSE requests do not share events."
        )
    return status_block


def build_optional_documents_shell_hint_driver(
    bearer: str | None,
    *,
    state_cache: EliteEwShellStateHintHttpCache | None = None,
) -> EliteEwDocumentsWorkspaceShellHintHttpDriver | None:
    """Optional documents hint via GET shell-state (same Bearer as desktop HTTP driver)."""

    if not _env_truthy(os.getenv("EWA_ORCH_ATTACH_DOCUMENTS_SHELL_HINT")):
        return None
    if not bearer:
        return None
    return EliteEwDocumentsWorkspaceShellHintHttpDriver(
        HttpClientConfig(base_url=unified_settings.eliteew_self_http_base_url),
        bearer_token=bearer,
        state_cache=state_cache,
    )


def build_optional_content_shell_hint_driver(
    bearer: str | None,
    *,
    state_cache: EliteEwShellStateHintHttpCache | None = None,
) -> EliteEwContentManagerShellHintHttpDriver | None:
    """Optional content-manager hint via GET shell-state."""

    if not _env_truthy(os.getenv("EWA_ORCH_ATTACH_CONTENT_SHELL_HINT")):
        return None
    if not bearer:
        return None
    return EliteEwContentManagerShellHintHttpDriver(
        HttpClientConfig(base_url=unified_settings.eliteew_self_http_base_url),
        bearer_token=bearer,
        state_cache=state_cache,
    )


def build_optional_ugs_driver(_request: Request, bearer: str | None) -> EliteEwUgsHttpDriverStub | None:
    """Optional UGS read-only alignment hint driver (same Bearer as desktop HTTP driver)."""

    if not _env_truthy(os.getenv("EWA_ORCH_ATTACH_UGS_HTTP")):
        return None
    if not bearer:
        return None
    raw_profile = os.getenv("EWA_ORCH_UGS_PROFILE", "model_routing").strip().lower()
    profile: UgsHttpProfile = "generation_inventory" if raw_profile == "generation_inventory" else "model_routing"
    return EliteEwUgsHttpDriverStub(
        HttpClientConfig(base_url=unified_settings.eliteew_self_http_base_url),
        bearer_token=bearer,
        profile=profile,
    )


def build_llm_client() -> LlmClient:
    """Stub LLM by default; HTTP stack2 LLM when ``EWA_ORCH_USE_HTTP_LLM`` is set."""

    if _env_truthy(os.getenv("EWA_ORCH_USE_HTTP_LLM")):
        return HttpOrchestrationLlmClient()
    return StubLlmClient()


def build_desktop_driver(request: Request, bearer: str | None) -> FakeDesktopDriver | EliteEwDesktopHttpDriverStub:
    """Pick fake vs EliteEW HTTP driver from env + bearer presence."""

    if _env_truthy(os.getenv("EWA_ORCH_USE_ELITEEW_HTTP")) and bearer:
        return EliteEwDesktopHttpDriverStub(
            HttpClientConfig(base_url=unified_settings.eliteew_self_http_base_url),
            bearer_token=bearer,
        )
    return FakeDesktopDriver()


async def build_orchestration_context(request: Request) -> OrchestrationContext:
    """Compose stores, policy, desktop shell, LLM, optional UGS + shell-state domain hints."""

    pool = getattr(request.app.state, "ewa_orchestration_pool", None)
    shared_memory = getattr(request.app.state, "ewa_orchestration_memory_stores", None)
    if pool is not None:
        stores: AsyncPgOrchestrationStores | InMemoryOrchestrationStores = AsyncPgOrchestrationStores(pool)
    elif shared_memory is not None:
        stores = shared_memory
    else:
        stores = InMemoryOrchestrationStores()
    bearer = extract_bearer_token(request)
    desktop = build_desktop_driver(request, bearer)
    policy = BasicDesktopPolicyEngine(allowed_app_components=parse_desktop_app_allowlist_from_env())
    ugs_driver = build_optional_ugs_driver(request, bearer)
    shell_hint_cache = EliteEwShellStateHintHttpCache()
    documents_driver = build_optional_documents_shell_hint_driver(bearer, state_cache=shell_hint_cache)
    content_driver = build_optional_content_shell_hint_driver(bearer, state_cache=shell_hint_cache)
    return OrchestrationContext(
        sessions=stores,
        events=stores,
        desktop=desktop,
        policy=policy,
        llm=build_llm_client(),
        ugs=ugs_driver,
        documents=documents_driver,
        content=content_driver,
    )


def _companion_turn_context_event(
    companion_status: Mapping[str, Any],
    *,
    client_hints: Mapping[str, Any],
    hint_warnings: list[str],
) -> dict[str, Any]:
    """Build ``companion_context`` session event (JSON-safe, no free-text PII)."""

    loaded = bool(companion_status.get("loaded"))
    ev: dict[str, Any] = {
        "kind": "companion_context",
        "loaded": loaded,
    }
    if loaded:
        ev["seed_persona_id"] = companion_status.get("seed_persona_id")
        ev["companion_revision"] = companion_status.get("companion_revision")
    else:
        ev["seed_persona_id"] = None
        ev["companion_revision"] = None
        r = companion_status.get("reason")
        if isinstance(r, str) and r:
            ev["reason"] = r
    seed = client_hints.get("seed_persona_id")
    if isinstance(seed, str) and seed:
        ev["client_seed_persona_id"] = seed
    exp = client_hints.get("expect_companion_revision")
    if exp is not None:
        ev["client_expect_companion_revision"] = int(exp)
        rem = companion_status.get("revision_expect_matched")
        if rem is not None:
            ev["revision_expect_matched"] = bool(rem)
    if hint_warnings:
        ev["client_hints_warnings"] = list(hint_warnings)
    return ev


def _events_to_jsonable(events: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    return [dict(e) for e in events]


async def execute_desktop_orchestration_turn(
    *,
    request: Request,
    body: Mapping[str, Any],
    auth_user: User,
) -> dict[str, Any]:
    """Parse envelope, validate payload, run one orchestration turn, return response mapping."""

    try:
        req = parse_envelope_or_raise(body)
    except (KeyError, TypeError, ValueError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    payload = req.payload
    if payload.get("kind") != DESKTOP_ORCH_PAYLOAD_KIND:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"payload.kind must be {DESKTOP_ORCH_PAYLOAD_KIND!r}",
        )
    sid_raw = payload.get("session_id")
    if not isinstance(sid_raw, str) or not sid_raw.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="session_id must be a non-empty string")
    session_id = sid_raw.strip()
    obs_raw = payload.get("observation")
    if not isinstance(obs_raw, Mapping):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="observation must be an object")
    try:
        observation = ensure_desktop_observation_wire_or_raise(obs_raw)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    companion_hints, hint_warnings = normalize_desktop_orchestration_turn_companion_hints(payload)

    persistence = orchestration_persistence_status(request)
    pool = getattr(request.app.state, "ewa_orchestration_pool", None)
    companion_wire: dict[str, Any] | None = None
    companion_status: dict[str, Any] = {"loaded": False, "reason": "no_database_pool"}
    if pool is not None:
        row = await companion_pg.companion_profile_fetch(pool, principal_id=str(auth_user.id))
        if row is not None:
            companion_wire = companion_pg.companion_profile_llm_wire(row)
            companion_status = {
                "loaded": True,
                "companion_revision": int(row["companion_revision"]),
                "seed_persona_id": str(row["seed_persona_id"]),
            }
            logger.info(
                "[STEP] companion_profile_loaded companion_revision=%s",
                companion_status.get("companion_revision"),
            )
        else:
            companion_status = {"loaded": False, "reason": "not_initialized"}
    companion_persist = dict(companion_status)
    companion_persist["client"] = dict(companion_hints)
    if hint_warnings:
        companion_persist["hints_warnings"] = list(hint_warnings)
    rev_exp = companion_hints.get("expect_companion_revision")
    if rev_exp is not None:
        companion_persist["expect_companion_revision"] = int(rev_exp)
        if companion_persist.get("loaded"):
            companion_persist["revision_expect_matched"] = int(companion_persist["companion_revision"]) == int(rev_exp)
    persistence = {**persistence, "companion": companion_persist}

    emit_companion_ctx = bool(companion_hints or hint_warnings or companion_persist.get("loaded"))
    companion_context_event: Mapping[str, Any] | None = (
        _companion_turn_context_event(
            companion_persist,
            client_hints=companion_hints,
            hint_warnings=list(hint_warnings),
        )
        if emit_companion_ctx
        else None
    )

    ctx = await build_orchestration_context(request)
    policy_ctx = policy_context_from_auth_user(auth_user)
    await run_orchestration_turn(
        ctx,
        session_id=session_id,
        observation=observation,
        policy_context=policy_ctx,
        companion_wire=companion_wire,
        companion_context_event=companion_context_event,
    )
    events = await ctx.events.list_for_session(session_id)
    snap = await ctx.sessions.get(session_id)
    session_snapshot: dict[str, Any] = dict(snap) if isinstance(snap, Mapping) else {}
    res = EwaResponseV1(
        api_version=EWA_IO_API_VERSION,
        message_type=EwaResponseMessageType.RESULT,
        correlation_id=req.correlation_id,
        run_id=None,
        payload={
            "kind": DESKTOP_ORCH_RESULT_PAYLOAD_KIND,
            "session_id": session_id,
            "events": _events_to_jsonable(events),
            "session": session_snapshot,
            "persistence": persistence,
        },
    )
    logger.info(
        "[STEP] desktop_orchestration_turn_done correlation_id=%s session_id=%s store_kind=%s "
        "observation_kind=%s last_branch=%s last_intent_kind=%s",
        req.correlation_id,
        session_id,
        persistence.get("store_kind"),
        observation.get("observation_kind"),
        session_snapshot.get("last_branch"),
        session_snapshot.get("last_intent_kind"),
    )
    return ewa_response_v1_to_mapping(res)


async def iter_desktop_orchestration_session_sse(
    *,
    request: Request,
    session_id: str,
    follow: bool,
) -> AsyncIterator[str]:
    """Yield SSE ``data:`` lines for persisted session events plus keep-alive (optional long poll)."""

    ctx = await build_orchestration_context(request)
    events = await ctx.events.list_for_session(session_id)
    async for line in iter_sse_data_events(events):
        yield line
    yield ORCHESTRATION_SSE_KEEPALIVE
    if not follow:
        return
    raw_interval = os.getenv("EWA_ORCH_SSE_KEEPALIVE_SEC", "2").strip() or "2"
    try:
        interval = float(raw_interval)
    except ValueError:
        interval = 2.0
    if interval < 0.5:
        interval = 0.5
    while True:
        await asyncio.sleep(interval)
        yield ORCHESTRATION_SSE_KEEPALIVE
