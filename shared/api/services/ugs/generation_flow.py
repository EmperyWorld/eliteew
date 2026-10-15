#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pure helper functions for UGS request generation flow.
# Invariants:
# - Content cache fingerprints are deterministic for equivalent JSON input order.
# - User/tenant scoping is layered by UnifiedGenerationService before hitting the global cache table.
# Related:
# - api/services/ugs/unified_generation_service.py
# - api/services/ugs/cache_service.py
# ---
"""UGS generation flow helpers."""

import hashlib
import json
from typing import Any


def generate_cache_key(type_key: str, input_data: dict[str, Any]) -> str:
    """Generate cache key from type_key and input_data (stable for deduplication)."""
    key_data = f"{type_key}:{json.dumps(input_data, sort_keys=True)}"
    return hashlib.md5(key_data.encode()).hexdigest()  # noqa: S324
