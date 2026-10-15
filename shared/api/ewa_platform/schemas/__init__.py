# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# EWA platform schema artefacts — split into two sister subpackages:
#   * ``schemas.json``     — JSON Schema mirrors for non-Python consumers (envelope, orchestration, atoms, …);
#   * ``schemas.pydantic`` — Pydantic v2 models used by FastAPI routers/responses.
# Invariants:
# - Canonical JSON Schema lives under ``schemas/json/*.json``; Pydantic models under ``schemas/pydantic/*.py``.
# - This package is a marker only — no runtime logic; ``io/envelope.py`` is the Python source of truth for envelope v1.
# Related:
# - api/ewa_platform/schemas/json/  (ewa_io_v1.json, orchestration_v1.json, desktop_*_v1.json, …)
# - api/ewa_platform/schemas/pydantic/  (companion.py, companion_chat.py, runtime_context.py, …)
# - api/ewa_platform/io/envelope.py
# ---
"""EWA platform schemas (JSON Schema + Pydantic; see sibling subpackages)."""
