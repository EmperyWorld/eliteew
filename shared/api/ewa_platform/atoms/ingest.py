# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Best-effort **ingest** of one user line into ``ewa_atom`` + derived ``ewa_atom_edge`` after HCM episodic insert.
# Invariants:
# - Never raises into callers; failures are ``[STEP]`` warnings; respects ``EWA_ATOM_LAYER_ENABLED``.
# Related:
# - api/services/ewa_companion/episodic.py
# - api/ewa_platform/atoms/classifier.py
# - api/ewa_platform/atoms/graph.py
# - api/ewa_platform/persistence_pg/atoms_asyncpg.py
# ---
"""Persist atoms from companion episodic turns (optional feature flag)."""

from __future__ import annotations

import logging
import os
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from typing import Any

import asyncpg

from api.ewa_platform.atoms.classifier import (
    atom_layer_enabled,
    classify_raw_text_llm_v1,
    classify_raw_text_v0,
)
from api.ewa_platform.atoms.graph import build_atom_graph_edges
from api.ewa_platform.contracts.atoms_v1 import AnyAtomV1
from api.ewa_platform.persistence_pg.atoms_asyncpg import (
    atom_edges_insert,
    atom_insert,
    atoms_fetch_recent,
)

logger = logging.getLogger(__name__)


async def record_atoms_for_episode_turn(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_text: str,
    episode_id: str | None,
    importance: float,
    valence: float,
    context_tags: Mapping[str, Any] | None = None,
) -> None:
    """Classify → insert atom → rebuild edges for a recent slice (idempotent via unique edge index)."""

    if not atom_layer_enabled():
        return
    text = (user_text or "").strip()
    if not text:
        return
    try:
        atom_llm = await classify_raw_text_llm_v1(
            text,
            importance_hint=importance,
            valence_episode_0_1=valence,
        )
        atom: AnyAtomV1 = atom_llm or classify_raw_text_v0(
            text,
            importance_hint=importance,
            valence_episode_0_1=valence,
        )
        if episode_id:
            atom = atom.model_copy(update={"episode_id": str(episode_id).strip()})
        tags = dict(context_tags) if isinstance(context_tags, Mapping) else {}
        tid = str(tags.get("task_id") or tags.get("intent_hint") or "").strip()[:128] or None
        mid = str(tags.get("module_id") or "companion_chat").strip()[:128] or None
        raw_ttl = os.getenv("EWA_ATOM_TTL_DEFAULT_SEC", "604800").strip() or "604800"
        try:
            ttl_use = max(60, min(int(raw_ttl), 31_536_000))
        except ValueError:
            ttl_use = 604_800
        exp = datetime.now(UTC) + timedelta(seconds=ttl_use)
        atom = atom.model_copy(
            update={
                "task_id": tid,
                "module_id": mid,
                "ttl_seconds": ttl_use,
                "expires_at": exp,
            },
        )
        await atom_insert(pool, principal_id=principal_id, atom=atom)
        recent = await atoms_fetch_recent(pool, principal_id=principal_id, limit=48)
        edges = build_atom_graph_edges(recent)
        await atom_edges_insert(pool, principal_id=principal_id, edges=edges)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] ewa_atom_ingest_failed principal=%s episode=%s err=%s",
            principal_id,
            episode_id,
            exc,
        )


__all__ = ["record_atoms_for_episode_turn"]
