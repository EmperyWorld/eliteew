# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **Server-first** branch of the EWA companion turn — catalog-driven file resolve, ``unified_content``
# read, LLM body rewrite, and persistence; runs in ``orchestration.task_orchestrator`` ahead of intent planner.
# Invariants:
# - Two pools: catalog/body live in **main** ``DATABASE_URL``; companion profile/episodes live in ``EWA_DATABASE_URL``.
# - Branch is gated by learnèd-pref ``ewa_companion_server_first_v2`` or env override (see ``v2.py``).
# Related:
# - api/ewa_platform/companion/server_first/v2.py
# - api/ewa_platform/companion/storage/catalog_pipeline.py
# Related: companion package layout (historical migration note soft-retired)
# ---
"""Server-first turn pipeline for EWA companion."""
