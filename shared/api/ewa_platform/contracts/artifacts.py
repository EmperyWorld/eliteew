# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Portable artifact descriptors for orchestration payloads (JSON, audio, external URI refs).
# Invariants:
# - Binary payloads are never embedded; use storage_ref + optional sha256 for integrity.
# Related:
# - api/ewa_platform/media/pipeline.py
# - documentation/product/amka-seed-album/AMKA-PLATFORM-GREENFIELD.md
# ---
from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class ArtifactKind(StrEnum):
    """High-level classification of an artifact for JSON-safe descriptors."""

    TEXT = "text"
    JSON = "json"
    AUDIO = "audio"
    URI = "uri"


@dataclass(slots=True)
class ArtifactDescriptor:
    """JSON-friendly pointer to stored content (object store, blob URI, or inline kind)."""

    kind: ArtifactKind
    mime: str
    storage_ref: str
    sha256: str | None = None
