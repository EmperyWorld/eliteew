# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Vector-store persistence for EWA platform (companion episodic memory in Qdrant). Holds thin wrappers around the shared
# AsyncQdrantClient + the embedding channel so the rest of the platform sees one canonical entry point per concern.
# Invariants:
# - No imports from ``api.services.amka_core``; embedding & client come from ``api.services.chat_memory_service``.
# - Collection names always include the embedding dimension suffix to survive ``AI_EMBEDDINGS_DIMENSION`` swaps.
# Related:
# - api/ewa_platform/persistence_vector/companion_qdrant.py
# - api/services/ewa_companion/episodic.py
# - documentation/product/ewa/EWA-COMPANION-HCM-MEMORY.md
# ---
"""Vector persistence package for EWA platform."""

from __future__ import annotations

from api.ewa_platform.persistence_vector.companion_qdrant import (
    COMPANION_EPISODIC_BASE_COLLECTION,
    CompanionEpisodicHit,
    CompanionEpisodicPoint,
    companion_episodic_collection_name,
    delete_companion_episodic_for_principal,
    ensure_companion_episodic_collection,
    search_companion_episodic,
    upsert_companion_episodic,
)

__all__ = [
    "COMPANION_EPISODIC_BASE_COLLECTION",
    "CompanionEpisodicHit",
    "CompanionEpisodicPoint",
    "companion_episodic_collection_name",
    "delete_companion_episodic_for_principal",
    "ensure_companion_episodic_collection",
    "search_companion_episodic",
    "upsert_companion_episodic",
]
