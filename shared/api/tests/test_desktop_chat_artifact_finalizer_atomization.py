#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Structural lock for desktop-ai-chat-024 artifact_finalizer atomization.
# Invariants:
# - Public finalize API stays on artifact_finalizer facade.
# - Validation child + facade stay under soft LOC caps (no god-file >800).
# Related:
# - api.services.desktop_chat_ensemble.blueprint.artifact_finalizer
# - api.services.desktop_chat_ensemble.blueprint.artifact_validation
# - documentation/platform/PRODUCT-AUDIT-STABILITY-BACKLOG.md
# ---
"""Artifact finalizer atomization contract."""

from __future__ import annotations

from pathlib import Path

import api.services.desktop_chat_ensemble.blueprint.artifact_finalizer as facade

PKG = Path(__file__).resolve().parents[1] / "services" / "desktop_chat_ensemble" / "blueprint"


def _loc(name: str) -> int:
    return len((PKG / name).read_text(encoding="utf-8").splitlines())


def test_artifact_finalizer_validation_child_exists() -> None:
    assert (PKG / "artifact_finalizer.py").is_file()
    assert (PKG / "artifact_validation.py").is_file()


def test_artifact_finalizer_modules_under_loc_caps() -> None:
    assert _loc("artifact_finalizer.py") <= 500
    assert _loc("artifact_validation.py") <= 800


def test_facade_reexports_public_finalize_api() -> None:
    for symbol in (
        "ArtifactFinalizationResult",
        "apply_finalization_status",
        "ensure_web_evidence_section",
        "finalize_artifact",
        "sanitize_artifact_markdown",
        "validate_artifact_markdown",
    ):
        assert hasattr(facade, symbol), symbol
    assert callable(facade.finalize_artifact)
    assert callable(facade.validate_artifact_markdown)
