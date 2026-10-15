"""Joint polish cleanup helpers."""

from __future__ import annotations

import pytest

pytest.importorskip("sqlalchemy")

from api.services.desktop_chat_ensemble.archive.legacy_freeform.joint_polish import (
    _cleanup_joint_markdown,
)


def test_cleanup_joint_markdown_strips_technical_noise() -> None:
    raw = """
## Резюме

#
Реплика участника «Ликий Соренто»: не оставлять
[label=pl1.txt]
Оставить этот абзац.
""".strip()
    cleaned = _cleanup_joint_markdown(raw)
    assert cleaned == "## Резюме\n\nОставить этот абзац."
