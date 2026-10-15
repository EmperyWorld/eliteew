# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Desktop-orchestration **composition root** for the EliteEW monolith: optional asyncpg pool lifecycle and the per-request
# ``OrchestrationContext`` wiring used by the FastAPI router. Previously lived at ``api.ewa_platform.desktop``.
# Invariants:
# - No FastAPI route handlers in this package; routers call ``runtime`` helpers only.
# - Pool is created at app lifespan only when ``EWA_DATABASE_URL`` is configured; otherwise ``app.state.ewa_orchestration_pool`` stays ``None``.
# Related:
# - api/ewa_platform/gateways/routers/desktop.py
# - api/ewa_platform/core/orchestrator.py
# - api/ewa_platform/persistence_pg/orchestration_asyncpg.py
# ---
"""EWA desktop orchestration composition root."""
