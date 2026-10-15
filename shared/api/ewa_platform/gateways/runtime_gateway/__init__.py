# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **EWA Runtime Gateway** services: composes a server-derived context snapshot and routes allowlisted typed commands
# for the SPA companion / desktop turn surfaces. Keeps catalog filter/search & catalog preferences alongside.
# Invariants:
# - Auth scope is enforced upstream in router handlers (``gateways/routers/runtime_context.py`` and
#   ``runtime_command.py``); functions here trust the resolved ``User`` and act on its principal.
# - Catalog reads remain scope-aware (``content_catalog_user_id``); writes use a tier model.
# Related:
# - api/ewa_platform/gateways/routers/runtime_context.py
# - api/ewa_platform/gateways/routers/runtime_command.py
# - api/ewa_platform/docs/DESKTOP-ORCHESTRATION.md
# ---
"""EWA Runtime Gateway service package."""
