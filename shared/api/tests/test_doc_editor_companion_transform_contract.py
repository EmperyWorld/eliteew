# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for companion-centric DocEditor `/ai/complete` request handling and prompt shaping.
# Invariants:
# - Tests stub DocEditorService/get_db_pool and never call real network/model providers.
# - Companion metadata may shape the generated prompt but must stay no-dialogue when requested.
# Related:
# - api/routers/doc_editor.py
# ---
from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any

from fastapi.responses import StreamingResponse

import api.services.doc_editor_service as doc_editor_service_module
from api.routers import doc_editor as doc_editor_router


class _DummyDocEditorService:
    last_nonstream_prompt: str | None = None
    last_stream_prompt: str | None = None

    def __init__(self, _db_pool: Any, _ugs_service: Any) -> None:
        pass

    async def ai_complete(self, **kwargs: Any) -> str:
        self.__class__.last_nonstream_prompt = str(kwargs.get("prompt") or "")
        return "rewritten"

    def ai_complete_streaming(self, **kwargs: Any):
        self.__class__.last_stream_prompt = str(kwargs.get("prompt") or "")

        async def _iter():
            yield 'data: {"text":"ok"}\n\n'
            yield "data: [DONE]\n\n"

        return _iter()


def _patch_doc_editor_runtime(monkeypatch: Any) -> None:
    async def _fake_get_db_pool() -> object:
        return object()

    monkeypatch.setattr(doc_editor_router, "get_db_pool", _fake_get_db_pool)
    monkeypatch.setattr(doc_editor_service_module, "DocEditorService", _DummyDocEditorService)
    _DummyDocEditorService.last_nonstream_prompt = None
    _DummyDocEditorService.last_stream_prompt = None


def test_build_companion_transform_directive_empty_without_companion_payload() -> None:
    request = doc_editor_router.AICompleteRequest(prompt="Improve text")
    assert doc_editor_router._build_companion_transform_directive(request) == ""


def test_build_companion_transform_directive_includes_persona_style_and_no_dialogue() -> None:
    request = doc_editor_router.AICompleteRequest(
        prompt="Improve text",
        companion_seed_persona_id="arlika_v2",
        companion_name="Arlika",
        companion_character_state={"mood": "steady", "warmth": 0.71},
        companion_style_parameters={"tone": "supportive", "temperature": 0.35},
        companion_baseline={"voice": "gentle"},
        companion_no_dialogue=True,
    )

    directive = doc_editor_router._build_companion_transform_directive(request)

    assert "Companion transform mode:" in directive
    assert "Companion name: Arlika" in directive
    assert "Persona id: arlika_v2" in directive
    assert "Character hints:" in directive
    assert "Style hints:" in directive
    assert "Baseline hints:" in directive
    assert "Return only the transformed document text" in directive


def test_ai_complete_nonstream_prepends_companion_directive_and_returns_meta(
    monkeypatch: Any,
) -> None:
    _patch_doc_editor_runtime(monkeypatch)
    request = doc_editor_router.AICompleteRequest(
        prompt="Improve text",
        context="Original fragment",
        stream=False,
        companion_seed_persona_id="arlika_v2",
        companion_name="Arlika",
        companion_style_parameters={"tone": "supportive"},
        companion_no_dialogue=True,
    )

    result = asyncio.run(
        doc_editor_router.ai_complete(
            data=request,
            user=SimpleNamespace(id="user-1"),
            ugs_service=object(),
            db=SimpleNamespace(),
        )
    )

    sent_prompt = _DummyDocEditorService.last_nonstream_prompt
    assert sent_prompt is not None
    assert sent_prompt.startswith("Companion transform mode:")
    assert sent_prompt.endswith("\n\nImprove text")
    assert isinstance(result, dict)
    assert result["response"] == "rewritten"
    assert result["meta"]["companion"] == {
        "seedPersonaId": "arlika_v2",
        "name": "Arlika",
        "noDialogue": True,
    }


def test_ai_complete_stream_uses_companion_directive_prompt(monkeypatch: Any) -> None:
    _patch_doc_editor_runtime(monkeypatch)
    request = doc_editor_router.AICompleteRequest(
        prompt="Shorten text",
        stream=True,
        companion_name="EWA",
        companion_no_dialogue=True,
    )

    response = asyncio.run(
        doc_editor_router.ai_complete(
            data=request,
            user=SimpleNamespace(id="user-2"),
            ugs_service=object(),
            db=SimpleNamespace(),
        )
    )

    assert isinstance(response, StreamingResponse)
    sent_prompt = _DummyDocEditorService.last_stream_prompt
    assert sent_prompt is not None
    assert sent_prompt.startswith("Companion transform mode:")
    assert sent_prompt.endswith("\n\nShorten text")
