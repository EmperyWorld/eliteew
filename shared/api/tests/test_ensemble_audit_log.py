"""Тесты опционального audit-log группового чата (файловая запись, без Llama)."""

from __future__ import annotations

import asyncio
from pathlib import Path
from uuid import uuid4

import pytest

from api.services.desktop_chat_ensemble import ensemble_audit_log


def test_audit_log_base_dir_none_when_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DESKTOP_ENSEMBLE_AUDIT_LOG_DIR", raising=False)
    assert ensemble_audit_log.audit_log_base_dir() is None


def test_slug_sanitizes() -> None:
    assert ensemble_audit_log._slug("step a!") == "step_a"
    assert ensemble_audit_log._slug("!!!") == "step"


def test_begin_turn_writes_layout(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    async def _run() -> None:
        monkeypatch.setenv("DESKTOP_ENSEMBLE_AUDIT_LOG_DIR", str(tmp_path))
        cid = uuid4()
        tok = await ensemble_audit_log.begin_turn(
            chat_id=cid,
            user_text="hello",
            enriched="ENRICHED",
            rag_summary={"chat_rag_chunks": 0},
            model="test-model",
            forced_path=None,
            routing_mode="test_mode",
        )
        assert tok is not None
        chat_dir = tmp_path / str(cid)
        assert chat_dir.is_dir()
        turns = [p for p in chat_dir.iterdir() if p.is_dir()]
        assert len(turns) == 1
        tdir = turns[0]
        assert (tdir / "user_message.txt").read_text(encoding="utf-8") == "hello"
        assert "ENRICHED" in (tdir / "enriched_user_content.txt").read_text(encoding="utf-8")
        meta = (tdir / "meta.json").read_text(encoding="utf-8")
        assert "test-model" in meta and "test_mode" in meta

        await ensemble_audit_log.log_stream_turn(
            "probe_stream",
            messages=[{"role": "user", "content": "x"}],
            model="m",
            max_tokens=10,
            response_text="out",
        )
        steps = sorted([p for p in tdir.iterdir() if p.is_dir()], key=lambda p: p.name)
        assert steps and (steps[0] / "response_stream.txt").read_text(encoding="utf-8") == "out"

        ensemble_audit_log.end_turn(tok)
        assert ensemble_audit_log._state() is None

    asyncio.run(_run())
