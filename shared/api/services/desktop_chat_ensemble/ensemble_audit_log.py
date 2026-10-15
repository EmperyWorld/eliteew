# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `services/desktop_chat_ensemble/ensemble_audit_log.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""Опциональное файловое логирование ходов группового (ensemble) чата.

Включение: переменная окружения DESKTOP_ENSEMBLE_AUDIT_LOG_DIR — абсолютный или относительный путь
к корню логов. Пусто или не задано — весь модуль no-op.

Структура: {base}/{chat_id}/{utc_ts}_{rand}/ — одна папка на пользовательский ход; внутри нумерованные
подпапки по шагам (запросы к Llama и стадии склейки).

Важно: эти файлы не читаются моделью и не подмешиваются в промпты — только побочная запись на диск.

См. documentation/product/desktop/DESKTOP-ENSEMBLE-AUDIT-LOGGING.md — как отключить и удалить хуки.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
import re
import secrets
from contextvars import ContextVar, Token
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)

_ENV_KEY = "DESKTOP_ENSEMBLE_AUDIT_LOG_DIR"


def audit_log_base_dir() -> Path | None:
    raw = (os.environ.get(_ENV_KEY) or "").strip()
    if not raw:
        return None
    return Path(raw).expanduser()


@dataclass
class _AuditState:
    turn_dir: Path
    step_seq: int = 0


_ctx: ContextVar[_AuditState | None] = ContextVar("ensemble_audit_ctx", default=None)


def _slug(s: str, max_len: int = 56) -> str:
    out = re.sub(r"[^a-zA-Z0-9._-]+", "_", s)[:max_len].strip("_")
    return out or "step"


def _safe_chat_segment(chat_id: UUID) -> str | None:
    try:
        u = chat_id if isinstance(chat_id, UUID) else UUID(str(chat_id))
    except (TypeError, ValueError):  # fmt: skip
        return None
    return str(u)


def _state() -> _AuditState | None:
    return _ctx.get()


async def begin_turn(
    *,
    chat_id: UUID,
    user_text: str,
    enriched: str,
    rag_summary: dict[str, Any],
    model: str,
    forced_path: str | None = None,
    routing_mode: str | None = None,
) -> Token | None:
    """Создаёт папку хода и активирует контекст логирования. Возвращает токен для end_turn."""
    base = audit_log_base_dir()
    if not base:
        return None
    chat_seg = _safe_chat_segment(chat_id)
    if not chat_seg:
        logger.warning("ensemble_audit: invalid chat_id, skip")
        return None
    ts = datetime.now(UTC).strftime("%Y%m%dT%H%M%S")
    rid = secrets.token_hex(3)
    turn_dir = base / chat_seg / f"{ts}_{rid}"
    meta = {
        "chat_id": chat_seg,
        "model": model,
        "forced_path": forced_path,
        "routing_mode": routing_mode,
        "utc_started": datetime.now(UTC).isoformat(),
    }

    def _init() -> None:
        turn_dir.mkdir(parents=True, exist_ok=True)
        (turn_dir / "user_message.txt").write_text(user_text or "", encoding="utf-8")
        (turn_dir / "enriched_user_content.txt").write_text(enriched or "", encoding="utf-8")
        (turn_dir / "rag_summary.json").write_text(
            json.dumps(rag_summary, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        (turn_dir / "meta.json").write_text(
            json.dumps(meta, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    try:
        await asyncio.to_thread(_init)
    except OSError as ex:
        logger.warning("ensemble_audit: init failed %s", ex)
        return None
    st = _AuditState(turn_dir=turn_dir)
    return _ctx.set(st)


def end_turn(reset_token: Token | None) -> None:
    if reset_token is None:
        return
    with contextlib.suppress(ValueError):
        _ctx.reset(reset_token)


def _serialize_response(result: dict[str, Any] | None) -> dict[str, Any] | None:
    if result is None:
        return None
    return {
        "text": result.get("text"),
        "error": result.get("error"),
        "finish_reason": result.get("finish_reason"),
    }


async def log_llm_chat(
    kind: str,
    *,
    messages: list[dict[str, Any]],
    model: str,
    max_tokens: int,
    temperature: float | None = None,
    response: dict[str, Any] | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    st = _state()
    if not st:
        return
    st.step_seq += 1
    d = st.turn_dir / f"{st.step_seq:03d}_{_slug(kind)}"
    payload = {
        "kind": kind,
        "model": model,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "extra": extra or {},
    }
    resp_out = _serialize_response(response)
    text_body = ((response or {}).get("text") or "").strip() if response else ""

    def _w() -> None:
        d.mkdir(parents=True, exist_ok=True)
        (d / "request_meta.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        (d / "llama_messages.json").write_text(
            json.dumps(messages, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        if resp_out is not None:
            (d / "llama_response.json").write_text(
                json.dumps(resp_out, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        if text_body:
            (d / "response_text.txt").write_text(text_body, encoding="utf-8")

    try:
        await asyncio.to_thread(_w)
    except OSError as ex:
        logger.warning("ensemble_audit: log_llm_chat failed %s", ex)


async def log_stream_turn(
    kind: str,
    *,
    messages: list[dict[str, Any]],
    model: str,
    max_tokens: int,
    response_text: str,
    extra: dict[str, Any] | None = None,
) -> None:
    st = _state()
    if not st:
        return
    st.step_seq += 1
    d = st.turn_dir / f"{st.step_seq:03d}_{_slug(kind)}"
    payload = {
        "kind": kind,
        "model": model,
        "max_tokens": max_tokens,
        "extra": extra or {},
    }

    def _w() -> None:
        d.mkdir(parents=True, exist_ok=True)
        (d / "request_meta.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        (d / "llama_messages.json").write_text(
            json.dumps(messages, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        (d / "response_stream.txt").write_text(response_text or "", encoding="utf-8")

    try:
        await asyncio.to_thread(_w)
    except OSError as ex:
        logger.warning("ensemble_audit: log_stream_turn failed %s", ex)


async def log_stitched_markdown(stage: str, text: str) -> None:
    st = _state()
    if not st:
        return
    st.step_seq += 1
    d = st.turn_dir / f"{st.step_seq:03d}_{_slug(stage)}"

    def _w() -> None:
        d.mkdir(parents=True, exist_ok=True)
        (d / "stitched.md").write_text(text or "", encoding="utf-8")

    try:
        await asyncio.to_thread(_w)
    except OSError as ex:
        logger.warning("ensemble_audit: log_stitched_markdown failed %s", ex)
