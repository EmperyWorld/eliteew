# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# AsyncPG persistence for **EWA Atom** rows and directed **ewa_atom_edge** links (``EWA_DATABASE_URL``).
# Invariants:
# - ``payload`` is JSON-serializable (string stored as JSON string value); ``particle`` holds kind-specific fields only.
# - Edge ``(principal_id, from_atom_id, to_atom_id, link_kind)`` is unique; no self-loops.
# Related:
# - api/ewa_platform/migrations/applied/007_ewa_atoms.sql
# - api/ewa_platform/contracts/atoms_v1.py
# - documentation/product/ewa/EWA-ATOM-LAYER.md
# ---
"""Postgres access for EWA Atom layer (graph primitives)."""

from __future__ import annotations

import contextlib
import json
import logging
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any
from uuid import uuid4

import asyncpg

from api.ewa_platform.contracts.atoms_v1 import (
    AnyAtomV1,
    CometAtomV1,
    NebulaAtomV1,
    StarAtomV1,
    parse_any_atom_v1,
)

logger = logging.getLogger(__name__)


def _particle_blob(atom: AnyAtomV1) -> dict[str, Any]:
    if isinstance(atom, StarAtomV1):
        return {
            "origin_source": atom.origin_source,
            "stability_index": float(atom.stability_index),
            "veracity_score": atom.veracity_score,
        }
    if isinstance(atom, CometAtomV1):
        return {
            "duration_iso": atom.duration_iso,
            "impact_magnitude": atom.impact_magnitude,
            "trajectory_vector": list(atom.trajectory_vector),
        }
    if isinstance(atom, NebulaAtomV1):
        return {
            "valence": atom.valence,
            "arousal": atom.arousal,
            "color_hex": atom.color_hex,
        }
    raise TypeError(f"unsupported atom type: {type(atom)!r}")


def _payload_for_jsonb(payload: str | dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False)


def _meta_blob(atom: AnyAtomV1) -> dict[str, Any]:
    out: dict[str, Any] = {}
    if atom.episode_id:
        out["episode_id"] = atom.episode_id
    if atom.expires_at is not None:
        out["expires_at"] = atom.expires_at.isoformat()
    if atom.ttl_seconds is not None:
        out["ttl_seconds"] = int(atom.ttl_seconds)
    out["priority"] = int(atom.priority)
    if atom.module_id:
        out["module_id"] = str(atom.module_id).strip()[:128]
    if atom.task_id:
        out["task_id"] = str(atom.task_id).strip()[:128]
    return out


def _row_to_atom_dict(row: asyncpg.Record) -> dict[str, Any]:
    kind = str(row["particle_kind"])
    particle = dict(row["particle"]) if isinstance(row["particle"], Mapping) else {}
    meta = dict(row["meta"]) if isinstance(row["meta"], Mapping) else {}
    pl: Any = row["payload"]
    if isinstance(pl, str):
        try:
            payload: str | dict[str, Any] = json.loads(pl)
        except json.JSONDecodeError:
            payload = pl
    else:
        payload = pl if isinstance(pl, (dict, str)) else dict(pl) if isinstance(pl, Mapping) else str(pl)
    base: dict[str, Any] = {
        "id": row["id"],
        "timestamp": row["atom_timestamp"],
        "importance": float(row["importance"]),
        "tags": list(row["tags"] or []),
        "payload": payload,
        "particle_kind": kind,
    }
    if meta.get("episode_id"):
        base["episode_id"] = str(meta["episode_id"])
    if meta.get("ttl_seconds") is not None:
        with contextlib.suppress(TypeError, ValueError):
            base["ttl_seconds"] = int(meta["ttl_seconds"])
    if meta.get("expires_at"):
        try:
            raw_exp = str(meta["expires_at"]).strip()
            if raw_exp.endswith("Z"):
                raw_exp = raw_exp[:-1] + "+00:00"
            base["expires_at"] = datetime.fromisoformat(raw_exp)
        except (TypeError, ValueError, OSError):  # fmt: skip
            pass
    if meta.get("priority") is not None:
        with contextlib.suppress(TypeError, ValueError):
            base["priority"] = int(meta["priority"])
    if meta.get("module_id"):
        base["module_id"] = str(meta["module_id"])[:128]
    if meta.get("task_id"):
        base["task_id"] = str(meta["task_id"])[:128]
    base.update(particle)
    return base


async def atom_insert(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    atom: AnyAtomV1,
) -> None:
    """Insert one atom row (caller supplies ``atom.id`` and timestamps)."""

    pid = (principal_id or "").strip()
    if not pid:
        raise ValueError("principal_id required")
    aid = str(atom.id)
    tags = [str(t) for t in (atom.tags or [])]
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO ewa_atom (
                id, principal_id, particle_kind, atom_timestamp, importance,
                tags, payload, particle, meta
            )
            VALUES ($1, $2, $3, $4, $5, $6::text[], $7::jsonb, $8::jsonb, $9::jsonb)
            """,
            aid,
            pid,
            atom.particle_kind,
            atom.timestamp,
            float(atom.importance),
            tags,
            _payload_for_jsonb(atom.payload),
            json.dumps(_particle_blob(atom), ensure_ascii=False),
            json.dumps(_meta_blob(atom), ensure_ascii=False),
        )


async def atoms_fetch_recent(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    limit: int = 64,
) -> list[AnyAtomV1]:
    """Return newest atoms first (parsed models)."""

    lim = max(1, min(int(limit), 500))
    pid = (principal_id or "").strip()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, principal_id, particle_kind, atom_timestamp, importance, tags, payload, particle, meta
            FROM ewa_atom
            WHERE principal_id = $1
            ORDER BY atom_timestamp DESC, id DESC
            LIMIT $2
            """,
            pid,
            lim,
        )
    out: list[AnyAtomV1] = []
    for row in rows:
        try:
            out.append(parse_any_atom_v1(_row_to_atom_dict(row)))
        except Exception as exc:  # noqa: BLE001
            logger.warning("[STEP] ewa_atom_row_parse_failed id=%s err=%s", row.get("id"), exc)
    return out


async def atom_edges_insert(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    edges: Sequence[Mapping[str, Any]],
) -> int:
    """Insert edges; skips duplicates (unique index). Returns inserted count (best-effort)."""

    pid = (principal_id or "").strip()
    if not pid or not edges:
        return 0
    inserted = 0
    async with pool.acquire() as conn:
        for e in edges:
            eid = str(e.get("id") or "").strip() or str(uuid4())
            fa = str(e.get("from_atom_id") or "").strip()
            ta = str(e.get("to_atom_id") or "").strip()
            lk = str(e.get("link_kind") or "").strip()
            if not fa or not ta or lk not in ("temporal", "semantic", "affective"):
                continue
            try:
                w = float(e.get("weight", 1.0))
            except (TypeError, ValueError):  # fmt: skip
                w = 1.0
            meta = dict(e.get("meta") or {})
            try:
                tag = await conn.execute(
                    """
                    INSERT INTO ewa_atom_edge (id, principal_id, from_atom_id, to_atom_id, link_kind, weight, meta)
                    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
                    ON CONFLICT (principal_id, from_atom_id, to_atom_id, link_kind) DO NOTHING
                    """,
                    eid,
                    pid,
                    fa,
                    ta,
                    lk,
                    w,
                    json.dumps(meta, ensure_ascii=False),
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "[STEP] ewa_atom_edge_insert_failed from=%s to=%s kind=%s err=%s",
                    fa,
                    ta,
                    lk,
                    exc,
                )
                continue
            if str(tag).split()[-1] == "1":
                inserted += 1
    return inserted


__all__ = [
    "atom_edges_insert",
    "atom_insert",
    "atoms_fetch_recent",
]
