# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pydantic v2 contracts for the **EWA Atom layer** (Stars / Comets / Nebulae) — portable JSON-serializable graph nodes
# with a discriminated ``particle_kind`` and optional post-graph ``affective_overlay`` hints.
# Invariants:
# - No asyncio, SQL, or HTTP; ``importance`` and affective scalars stay within documented ranges; ``stability_index`` is
#   fixed at ``1.0`` for Stars; ``color_hex`` is ``#RRGGBB``.
# Related:
# - api/ewa_platform/schemas/json/ewa_atom_v1.json
# - documentation/product/ewa/EWA-ATOM-LAYER.md
# ---
"""Atom v1 discriminated models (knowledge-graph primitives for EWA)."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, field_validator

_COLOR_HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


class AffectiveInfluenceV1(BaseModel):
    """Post-graph hint: a Nebula-shaped node nudges another atom's weighting in consumers."""

    model_config = ConfigDict(extra="forbid")

    nebula_id: UUID
    weight_delta: float = Field(ge=-1.0, le=1.0, default=0.0)


class AtomBaseV1(BaseModel):
    """Shared fields for every particle (temporal anchor + payload envelope)."""

    model_config = ConfigDict(extra="forbid")

    id: UUID = Field(default_factory=uuid4)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    importance: float = Field(ge=0.0, le=1.0, default=0.5)
    tags: list[str] = Field(default_factory=list)
    payload: str | dict[str, Any]
    affective_overlay: list[AffectiveInfluenceV1] | None = None
    episode_id: str | None = Field(
        default=None,
        description="Optional link to ``ewa_companion_episodes.id`` when ingested from HCM chat.",
    )
    ttl_seconds: int | None = Field(
        default=None,
        ge=0,
        le=31_536_000,
        description="Optional TTL from ingestion time; pairs with ``expires_at``.",
    )
    expires_at: datetime | None = Field(
        default=None,
        description="Absolute expiry for retrieval filtering (UTC).",
    )
    priority: int = Field(
        default=50,
        ge=0,
        le=100,
        description="Retrieval rank helper (0=lowest); distinct from fuzzy ``importance`` scalar.",
    )
    module_id: str | None = Field(default=None, max_length=128)
    task_id: str | None = Field(default=None, max_length=128)


class StarAtomV1(AtomBaseV1):
    """Type A — static asserted fact (high permanence)."""

    particle_kind: Literal["star"] = "star"
    origin_source: str = Field(default="user", min_length=1, max_length=120)
    # Fixed at 1.0 for Stars; Literal[float] is invalid for pyright/basedpyright (see reportInvalidTypeForm).
    stability_index: float = Field(default=1.0, ge=1.0, le=1.0)
    veracity_score: float = Field(ge=0.0, le=1.0, default=0.5)


class CometAtomV1(AtomBaseV1):
    """Type B — transient event / dynamics."""

    particle_kind: Literal["comet"] = "comet"
    duration_iso: str = Field(
        default="PT60S",
        min_length=2,
        max_length=32,
        description="ISO-8601 duration (e.g. PT45S).",
    )
    impact_magnitude: float = Field(ge=0.0, le=1.0, default=0.35)
    trajectory_vector: tuple[float, float, float] = (0.0, 0.0, 1.0)

    @field_validator("duration_iso")
    @classmethod
    def _duration_prefix(cls, v: str) -> str:
        s = (v or "").strip().upper()
        if not s.startswith("P"):
            raise ValueError("duration_iso must be an ISO-8601 duration starting with P")
        return s


class NebulaAtomV1(AtomBaseV1):
    """Type C — affective / atmospheric modifier."""

    particle_kind: Literal["nebula"] = "nebula"
    valence: float = Field(ge=-1.0, le=1.0, default=0.0)
    arousal: float = Field(ge=0.0, le=1.0, default=0.5)
    color_hex: str = Field(default="#808080", min_length=7, max_length=7)

    @field_validator("color_hex")
    @classmethod
    def _color_hex(cls, v: str) -> str:
        if not _COLOR_HEX_RE.match(v):
            raise ValueError("color_hex must match #RRGGBB")
        return v


AnyAtomV1 = StarAtomV1 | CometAtomV1 | NebulaAtomV1

_ATOM_ADAPTER = TypeAdapter(AnyAtomV1)


def parse_any_atom_v1(data: Any) -> StarAtomV1 | CometAtomV1 | NebulaAtomV1:
    """Validate a mapping or model into a discriminated atom."""

    return _ATOM_ADAPTER.validate_python(data)


def dump_atom_to_json_dict(atom: StarAtomV1 | CometAtomV1 | NebulaAtomV1) -> dict[str, Any]:
    """JSON-ready dict (UUID → str, datetime → ISO)."""

    return atom.model_dump(mode="json")


__all__ = [
    "AnyAtomV1",
    "AffectiveInfluenceV1",
    "AtomBaseV1",
    "CometAtomV1",
    "NebulaAtomV1",
    "StarAtomV1",
    "dump_atom_to_json_dict",
    "parse_any_atom_v1",
]
