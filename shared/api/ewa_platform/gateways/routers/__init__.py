# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# FastAPI router modules for EWA HTTP surfaces (companion profile, companion chat, desktop orchestration,
# runtime context, runtime command, standalone facade). The single registration entrypoint for the monolith is
# ``api.ewa_platform.gateways.companion_http.include_ewa_routers``.
# Invariants:
# - Routers stay thin: business logic lives in ``companion/`` subpackages, ``desktop/`` runtime, or
#   ``runtime_gateway/``. No SQL or LLM calls in route handlers themselves.
# Related:
# - api/ewa_platform/gateways/companion_http.py
# - api/domains/bi_ugs.py
# ---
"""FastAPI router package for the EWA HTTP surface."""
