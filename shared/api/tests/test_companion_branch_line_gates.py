# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
"""Tests: companion orchestrator branch line gates."""

from __future__ import annotations

from api.ewa_platform.companion.orchestration.branch_line_gates import (
    early_tool_branch_may_probe,
    user_line_may_match_late_file_ops,
    user_line_may_probe_tool_router,
)
from api.ewa_platform.companion.ux.chit_chat import is_trivial_chit_chat_user_line


def test_trivial_chit_chat_skips_tool_router() -> None:
    assert is_trivial_chit_chat_user_line("Привет, как дела?") is True
    assert user_line_may_probe_tool_router("Привет, как дела?") is False
    assert user_line_may_probe_tool_router("создай файл notes.md с текстом: hi") is True


def test_late_file_ops_gate() -> None:
    assert user_line_may_match_late_file_ops("Привет") is False
    assert user_line_may_match_late_file_ops("создай документ plan.md с текстом: шаги") is True
    assert user_line_may_match_late_file_ops("переименуй файл a.md в b.md") is True


def test_early_branch_gate_catalog_list() -> None:
    assert early_tool_branch_may_probe("catalog_list", "привет", None) is False
    assert (
        early_tool_branch_may_probe(
            "catalog_list",
            "покажи мои файлы в каталоге",
            None,
        )
        is True
    )


def test_early_branch_gate_file_open_plain_filename() -> None:
    assert early_tool_branch_may_probe("file_open", "привет", None) is False
    assert early_tool_branch_may_probe("file_open", "открой музыкальный плеер", None) is False
    assert early_tool_branch_may_probe("file_open", "открой файл notes.md", None) is True
    assert early_tool_branch_may_probe("file_open", "open report.md in the document editor", None) is True


def test_late_file_ops_gate_novyy_fayl() -> None:
    assert user_line_may_match_late_file_ops("новый файл draft.md начни с заголовка") is True
