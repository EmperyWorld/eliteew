# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Public service submodules for KBSEW (package exports for absolute imports).
# Invariants:
# - Import order avoids circular init: leaves → search/ingestion → worker.
# Related:
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

from . import (
    barrel_service,
    embedding_client,
    ingestion_service,
    ingestion_worker,
    object_store,
    qdrant_store,
    revision_service,
    search_service,
    sparse_vectors,
    stack4_client,
    text_quality,
)

__all__ = [
    "barrel_service",
    "embedding_client",
    "ingestion_service",
    "ingestion_worker",
    "object_store",
    "qdrant_store",
    "revision_service",
    "search_service",
    "sparse_vectors",
    "stack4_client",
    "text_quality",
]
