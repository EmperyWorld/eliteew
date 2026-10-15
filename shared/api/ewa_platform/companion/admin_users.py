# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Admin Users tab helpers: namespace summary, timeline merge, allowlisted JSON patches,
# hard principal wipe (first-meet), and soft clear of one learned namespace.
# Invariants:
# - Patch paths default-deny; only ALLOWED_PATCH_ROOTS.
# - Optimistic concurrency via companion_revision when provided.
# - Wipe is fail-closed on Qdrant: probe client before any PG delete.
# - Soft clear does not touch Qdrant episodic points (hard wipe only).
# Related:
# - api/ewa_platform/gateways/routers/companion_admin.py
# - documentation/product/ewa/EWA-COMPANION-ADMIN-UI.md
# ---
"""Admin per-user companion profile operations."""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

import asyncpg

from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from api.ewa_platform.persistence_pg import companion_task_asyncpg as runs_pg

logger = logging.getLogger(__name__)


class CompanionAdminWipeQdrantUnavailable(RuntimeError):
    """Raised when wipe cannot probe Qdrant before deleting the profile."""


class CompanionAdminWipeQdrantFailed(RuntimeError):
    """Raised when Qdrant purge fails after a successful probe (PG may already be wiped)."""


ALLOWED_LEARNED_ROOTS: frozenset[str] = frozenset(
    {
        "companion_memory_v1",
        "companion_character_v1",
        "companion_context_anchor_v1",
        "companion_chat_condensed_v1",
        "companion_continuity_v1",
        "companion_meta_v1",
        "desktop_friend_chat_v1",
    }
)
ALLOWED_BASELINE_ROOTS: frozenset[str] = frozenset({"ewa_companion_trust_v1"})


def empty_learned_namespace_value(namespace: str) -> Any:
    """Canonical empty payload for soft-clear of one allowlisted learned root."""

    if namespace == "companion_memory_v1":
        return []
    if namespace == "desktop_friend_chat_v1":
        return {"messages": []}
    if namespace == "companion_chat_condensed_v1":
        return {}
    return {}


def _digest(obj: Any) -> str:
    raw = json.dumps(obj, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def namespace_summary(profile: dict[str, Any]) -> dict[str, Any]:
    raw_learned = profile.get("learned_preferences")
    learned: dict[str, Any] = raw_learned if isinstance(raw_learned, dict) else {}
    raw_baseline = profile.get("baseline")
    baseline: dict[str, Any] = raw_baseline if isinstance(raw_baseline, dict) else {}
    raw_chat = learned.get("desktop_friend_chat_v1")
    chat: dict[str, Any] = raw_chat if isinstance(raw_chat, dict) else {}
    raw_messages = chat.get("messages")
    messages: list[Any] = raw_messages if isinstance(raw_messages, list) else []
    memory = learned.get("companion_memory_v1")
    mem_n = len(memory) if isinstance(memory, list) else 0
    admin_note_obj = baseline.get("ewa_admin_note_v1")
    return {
        "seed_persona_id": profile.get("seed_persona_id"),
        "companion_revision": profile.get("companion_revision"),
        "updated_at": profile.get("updated_at"),
        "memory_entries": mem_n,
        "transcript_messages": len(messages),
        "has_character": isinstance(learned.get("companion_character_v1"), dict),
        "has_anchor": isinstance(learned.get("companion_context_anchor_v1"), dict),
        "has_condensed": isinstance(learned.get("companion_chat_condensed_v1"), (dict, str)),
        "has_continuity": isinstance(learned.get("companion_continuity_v1"), dict),
        "has_meta": isinstance(learned.get("companion_meta_v1"), dict),
        "trust_present": isinstance(baseline.get("ewa_companion_trust_v1"), dict),
        "admin_note": (admin_note_obj or {}).get("note") if isinstance(admin_note_obj, dict) else None,
        "namespaces": {
            "learned_preferences": {k: learned.get(k) for k in sorted(ALLOWED_LEARNED_ROOTS) if k in learned},
            "baseline": {k: baseline.get(k) for k in sorted(ALLOWED_BASELINE_ROOTS) if k in baseline},
        },
    }


async def build_user_timeline(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    limit: int = 40,
) -> list[dict[str, Any]]:
    lim = max(1, min(int(limit), 100))
    audits = await companion_pg.companion_profile_audit_list(pool, principal_id=principal_id, limit=lim)
    run_rows = await runs_pg.companion_task_runs_list_operator(
        pool,
        principal_id=principal_id,
        limit=lim,
    )
    events: list[dict[str, Any]] = []
    for a in audits:
        events.append({**a, "sort_at": a.get("created_at") or ""})
    for r in run_rows:
        events.append(
            {
                "kind": "task_run",
                "id": r.get("id") or r.get("run_id"),
                "status": r.get("status"),
                "intent_kind": r.get("intent_kind"),
                "user_message": str(r.get("user_message") or "")[:240],
                "created_at": r.get("created_at"),
                "sort_at": r.get("created_at") or "",
            }
        )
    events.sort(key=lambda e: str(e.get("sort_at") or ""), reverse=True)
    return events[:lim]


def transcript_tail(profile: dict[str, Any], *, limit: int = 40) -> list[dict[str, Any]]:
    raw_learned = profile.get("learned_preferences")
    learned: dict[str, Any] = raw_learned if isinstance(raw_learned, dict) else {}
    raw_chat = learned.get("desktop_friend_chat_v1")
    chat: dict[str, Any] = raw_chat if isinstance(raw_chat, dict) else {}
    raw_messages = chat.get("messages")
    messages: list[Any] = raw_messages if isinstance(raw_messages, list) else []
    lim = max(1, min(int(limit), 200))
    tail = messages[-lim:]
    out: list[dict[str, Any]] = []
    for m in tail:
        if not isinstance(m, dict):
            continue
        out.append(
            {
                "role": str(m.get("role") or ""),
                "content": str(m.get("content") or "")[:4000],
                "ts": m.get("ts") or m.get("created_at"),
            }
        )
    return out


async def apply_admin_user_patch(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    actor_sub: str | None,
    seed_persona_id: str | None = None,
    admin_note: str | None = None,
    learned_patch: dict[str, Any] | None = None,
    baseline_patch: dict[str, Any] | None = None,
    expected_revision: int | None = None,
) -> dict[str, Any]:
    profile = await companion_pg.companion_profile_fetch(pool, principal_id=principal_id)
    if profile is None:
        raise KeyError("profile_not_found")
    rev = int(profile.get("companion_revision") or 1)
    if expected_revision is not None and int(expected_revision) != rev:
        raise ValueError("revision_conflict")

    learned = dict(profile.get("learned_preferences") or {})
    baseline = dict(profile.get("baseline") or {})
    before = {"learned": _digest(learned), "baseline": _digest(baseline), "seed": profile.get("seed_persona_id")}

    if learned_patch:
        for key, value in learned_patch.items():
            if key not in ALLOWED_LEARNED_ROOTS:
                raise ValueError(f"learned_path_denied:{key}")
            learned[key] = value
    if baseline_patch:
        for key, value in baseline_patch.items():
            if key not in ALLOWED_BASELINE_ROOTS:
                raise ValueError(f"baseline_path_denied:{key}")
            baseline[key] = value
    if admin_note is not None:
        baseline["ewa_admin_note_v1"] = {"note": str(admin_note)[:4000], "by": actor_sub}

    seed = seed_persona_id.strip().lower() if isinstance(seed_persona_id, str) and seed_persona_id.strip() else None
    if seed:
        seeded = await companion_pg.companion_profile_set_seed_persona_id(
            pool,
            principal_id=principal_id,
            seed_persona_id=seed,
            expect_revision=expected_revision,
            audit_action="admin_seed_set",
            audit_detail_override={"actor_sub": actor_sub},
        )
        if seeded is None and expected_revision is not None:
            raise ValueError("revision_conflict")
        profile = seeded or profile
        expected_revision = int(profile.get("companion_revision") or 1)

    needs_blob_patch = bool(learned_patch) or bool(baseline_patch) or admin_note is not None
    if not needs_blob_patch:
        return profile

    patched = await companion_pg.companion_profile_patch(
        pool,
        principal_id=principal_id,
        learned_preferences=learned if learned_patch else None,
        baseline=baseline,
        expect_revision=expected_revision,
        audit_action="admin_patch",
        audit_detail_override={
            "actor_sub": actor_sub,
            "before": before,
            "after": {
                "learned": _digest(learned),
                "baseline": _digest(baseline),
                "seed": seed or profile.get("seed_persona_id"),
            },
            "learned_keys": sorted((learned_patch or {}).keys()),
            "baseline_keys": sorted((baseline_patch or {}).keys()),
        },
    )
    if patched is None and expected_revision is not None:
        raise ValueError("revision_conflict")
    return patched or profile


async def clear_learned_namespace(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    namespace: str,
    actor_sub: str | None,
    expected_revision: int | None = None,
) -> dict[str, Any]:
    """Soft-clear one allowlisted learned namespace (PG only; no Qdrant purge)."""

    ns = str(namespace or "").strip()
    if ns not in ALLOWED_LEARNED_ROOTS:
        raise ValueError(f"learned_path_denied:{ns or 'empty'}")

    profile = await companion_pg.companion_profile_fetch(pool, principal_id=principal_id)
    if profile is None:
        raise KeyError("profile_not_found")
    rev = int(profile.get("companion_revision") or 1)
    if expected_revision is not None and int(expected_revision) != rev:
        raise ValueError("revision_conflict")

    learned = dict(profile.get("learned_preferences") or {})
    before = _digest(learned.get(ns))
    learned[ns] = empty_learned_namespace_value(ns)

    patched = await companion_pg.companion_profile_patch(
        pool,
        principal_id=principal_id,
        learned_preferences=learned,
        expect_revision=expected_revision,
        audit_action="admin_clear_namespace",
        audit_detail_override={
            "actor_sub": actor_sub,
            "namespace": ns,
            "before_digest": before,
            "after_digest": _digest(learned.get(ns)),
            "source": "admin_users.clear_learned_namespace",
        },
    )
    if patched is None and expected_revision is not None:
        raise ValueError("revision_conflict")
    if patched is None:
        raise KeyError("profile_not_found")
    logger.info(
        "[STEP] companion_admin_clear_namespace_ok principal=%s ns=%s actor=%s",
        principal_id,
        ns,
        actor_sub,
    )
    return patched


async def wipe_companion_principal(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    actor_sub: str | None,
) -> dict[str, Any]:
    """Hard-reset one principal to first-meet: audit → workflows → profile CASCADE → Qdrant.

    Fail-closed: if the companion episodic Qdrant client cannot be obtained, raise
    ``CompanionAdminWipeQdrantUnavailable`` and do not delete PG rows.
    """

    pid = str(principal_id or "").strip()
    if not pid:
        raise KeyError("profile_not_found")

    profile = await companion_pg.companion_profile_fetch(pool, principal_id=pid)
    if profile is None:
        raise KeyError("profile_not_found")

    from api.ewa_platform.persistence_vector.companion_qdrant import (
        delete_companion_episodic_for_principal,
    )
    from api.services.chat_memory_service import (
        _embedding_dim,
        _get_qdrant_client_companion_episodic,
    )

    try:
        client = await _get_qdrant_client_companion_episodic()
    except Exception as exc:  # noqa: BLE001 — probe boundary
        logger.warning(
            "[STEP] companion_admin_wipe_qdrant_probe_failed principal=%s err=%s",
            pid,
            exc,
        )
        raise CompanionAdminWipeQdrantUnavailable("qdrant_probe_failed") from exc
    if client is None:
        raise CompanionAdminWipeQdrantUnavailable("qdrant_client_unavailable")

    dim = int(_embedding_dim())
    await companion_pg.companion_audit_only(
        pool,
        principal_id=pid,
        action="operator_admin_user_memory_wipe",
        detail={
            "actor_sub": actor_sub,
            "seed_persona_id": profile.get("seed_persona_id"),
            "companion_revision": profile.get("companion_revision"),
            "source": "admin_users.wipe_companion_principal",
        },
    )

    async with pool.acquire() as conn, conn.transaction():
        await conn.execute(
            """
                DELETE FROM ewa_companion_user_workflows
                WHERE principal_id::text = $1
                """,
            pid,
        )
        await conn.execute(
            """
                DELETE FROM ewa_companion_profile
                WHERE principal_id = $1
                """,
            pid,
        )

    try:
        deleted = await delete_companion_episodic_for_principal(
            client,
            dim=dim,
            principal_id=pid,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "[STEP] companion_admin_wipe_qdrant_purge_failed principal=%s err=%s",
            pid,
            exc,
        )
        raise CompanionAdminWipeQdrantFailed("qdrant_purge_failed") from exc

    logger.info(
        "[STEP] companion_admin_wipe_ok principal=%s actor=%s qdrant_points=%s",
        pid,
        actor_sub,
        deleted,
    )
    return {
        "wiped": True,
        "principal_id": pid,
        "qdrant_points_deleted": int(deleted),
    }


__all__ = (
    "ALLOWED_BASELINE_ROOTS",
    "ALLOWED_LEARNED_ROOTS",
    "CompanionAdminWipeQdrantFailed",
    "CompanionAdminWipeQdrantUnavailable",
    "apply_admin_user_patch",
    "build_user_timeline",
    "clear_learned_namespace",
    "empty_learned_namespace_value",
    "namespace_summary",
    "transcript_tail",
    "wipe_companion_principal",
)
