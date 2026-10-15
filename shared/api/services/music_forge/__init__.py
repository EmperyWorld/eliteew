# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# MusicForge service package: backend-first song planning, orchestration and result feedback.
# Invariants:
# - Package imports must not start generation work; Celery/HTTP entrypoints call pipeline functions explicitly.
# Related:
# - api/services/music_forge/pipeline.py
# ---
"""MusicForge backend-first song generation services."""
