"""Shared Qdrant optimizer defaults (see documentation/platform/docker-re_doc/QDRANT-INDEXING.md)."""

# Below Qdrant default (~20000) so HNSW builds earlier on small/medium collections.
QDRANT_INDEXING_THRESHOLD = 5000
