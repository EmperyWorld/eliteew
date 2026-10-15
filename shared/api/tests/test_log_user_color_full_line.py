# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioural tests for `log_user_color`: full-line ANSI wrap and label extraction.
# Invariants:
# - Tests force coloring via ELITEEW_LOG_* env so they pass without a TTY.
# Related:
# - api/utils/log_user_color.py
# ---

from __future__ import annotations

import logging

import pytest

from api.utils import log_user_color as luc


@pytest.fixture
def force_user_color_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_LOG_USER_COLOR", "1")
    monkeypatch.setenv("ELITEEW_LOG_COLOR", "1")


def test_try_extract_prefers_plain_user_authorized() -> None:
    assert luc.try_extract_user_label("noise user=alice authorized path=/api") == "alice"
    j = '{"event":"x","user":"jsonuser","username":"u2"}'
    assert luc.try_extract_user_label(j) == "jsonuser"


def test_wrap_full_line_one_reset_no_mid_line_reset(force_user_color_on: None) -> None:
    line = "2025 user=alice authorized path=/foo"
    out = luc.wrap_full_line_user_colored(line)
    assert out.startswith("\033[")
    assert out.endswith("\033[0m")
    assert "alice" in out
    assert "path=/foo" in out
    inner_resets = out.count("\033[0m")
    assert inner_resets == 1  # trailing reset only — no truncation after username


def test_user_color_filter_rewrites_msg(force_user_color_on: None) -> None:
    f = luc.UserColorConsoleFilter()
    r = logging.LogRecord(
        name="t",
        level=logging.INFO,
        pathname="p",
        lineno=0,
        msg="user=%s authorized path=%s",
        args=("bob", "/x"),
        exc_info=None,
    )
    assert f.filter(r) is True
    assert r.args == ()
    assert r.msg.startswith("\033[")
    assert "bob" in r.msg
    assert "/x" in r.msg
