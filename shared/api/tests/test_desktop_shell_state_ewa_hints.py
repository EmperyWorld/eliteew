# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression tests for optional ``ewa_hints`` in desktop shell-state models (GET/PATCH contract).
# Invariants:
# - No DB; exercises ``DesktopShellStatePatch`` / ``_shell_state_to_out`` only.
# Related:
# - api/routers/desktop_shell_config.py
# - api/ewa_platform/contracts/ewa_shell_hints_wire.py
# ---
"""Desktop shell-state AMKA hints field."""

from __future__ import annotations

from api.routers.desktop_shell_config import DesktopShellStatePatch, _shell_state_to_out


def test_shell_state_to_out_preserves_ewa_hints() -> None:
    raw = {"ewa_hints": {"documents_workspace": {"open_documents": []}}}
    out = _shell_state_to_out(raw)
    assert out.ewa_hints == {"documents_workspace": {"open_documents": []}}


def test_shell_state_to_out_rejects_non_dict_hints() -> None:
    raw = {"ewa_hints": "bad"}
    out = _shell_state_to_out(raw)
    assert out.ewa_hints is None


def test_patch_model_dump_includes_ewa_hints() -> None:
    p = DesktopShellStatePatch(ewa_hints={"content_manager": {}})
    dumped = p.model_dump(exclude_unset=True)
    assert dumped.get("ewa_hints") == {"content_manager": {}}


def test_patch_rejects_non_dict_ewa_hints() -> None:
    p = DesktopShellStatePatch.model_validate({"ewa_hints": "x"})
    assert p.ewa_hints is None
