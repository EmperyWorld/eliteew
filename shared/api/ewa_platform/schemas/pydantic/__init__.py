# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pydantic models exposed by EWA HTTP surfaces (envelope responses, companion CRUD, runtime gateway requests,
# desktop orchestration payload wrappers). Sister package to ``schemas.json`` (JSON Schema artifacts).
# Invariants:
# - Pure Pydantic v2 / dataclass; no SQL or HTTP imports. Tied to the API surface, not core orchestration.
# Related:
# - api/ewa_platform/schemas/json/ (JSON Schema mirrors for non-Python consumers)
# - api/ewa_platform/gateways/routers/
# ---
"""EWA Pydantic schemas (HTTP-surface)."""
