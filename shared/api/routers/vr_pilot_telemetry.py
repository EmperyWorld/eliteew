# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   VR pilot: приём клиентских событий без PII (только тип события и агрегаты).
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
VR pilot: приём клиентских событий без PII (только тип события и агрегаты).

Хранение в БД не делается в шаге 1: события пишутся в **логи API** (`logging`) для агрегации
внешними средствами (Loki/файлы контейнера). При появлении ТЗ на retention — добавить таблицу.
"""

from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import APIRouter, Depends, Response, status  # type: ignore[import-untyped]
from pydantic import BaseModel, Field, field_validator

from api.core.oauth2_auth import require_oauth2_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vr-pilot", tags=["VR Pilot"])

_MAX_EVENTS = 64
_MAX_PAYLOAD_KEYS = 12


def _sanitize_payload(raw: dict[str, Any] | None) -> dict[str, str | int | float | bool | None]:
    if not raw:
        return {}
    out: dict[str, str | int | float | bool | None] = {}
    for i, (k, v) in enumerate(raw.items()):
        if i >= _MAX_PAYLOAD_KEYS:
            break
        if not isinstance(k, str) or len(k) > 64:
            continue
        if isinstance(v, bool | int | float):
            out[k] = v
        elif isinstance(v, str):
            out[k] = v[:256] if len(v) > 256 else v
        elif v is None:
            out[k] = None
    return out


class VrPilotTelemetryEventIn(BaseModel):
    name: Literal[
        "enter_started",
        "enter_failed",
        "enter_ar_started",
        "enter_ar_failed",
        "session_end",
        "profile_query",
    ]
    payload: dict[str, Any] = Field(default_factory=dict)

    @field_validator("payload", mode="before")
    @classmethod
    def limit_payload_size(cls, v: object) -> dict[str, Any]:
        if v is None:
            return {}
        if not isinstance(v, dict):
            return {}
        return dict(list(v.items())[:_MAX_PAYLOAD_KEYS])


class VrPilotTelemetryBatchIn(BaseModel):
    events: list[VrPilotTelemetryEventIn] = Field(default_factory=list)
    # Не PII: произвольный id пакета на клиенте для корреляции в логах.
    client_batch_id: str | None = Field(default=None, max_length=64)

    @field_validator("events", mode="after")
    @classmethod
    def cap_events(cls, v: list[VrPilotTelemetryEventIn]) -> list[VrPilotTelemetryEventIn]:
        if len(v) > _MAX_EVENTS:
            return v[:_MAX_EVENTS]
        return v


@router.post(
    "/telemetry/events",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Принять пакет событий VR pilot (без PII)",
)
async def post_vr_pilot_telemetry_events(
    body: VrPilotTelemetryBatchIn,
    _user: object = Depends(require_oauth2_user),
) -> Response:
    """Пишет агрегированную сводку в лог; детали payload санитизированы."""
    if not body.events:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    names = [e.name for e in body.events]
    logger.info(
        "vr_pilot_telemetry_batch",
        extra={
            "vr_pilot_event_count": len(body.events),
            "vr_pilot_event_names": names,
            "vr_pilot_client_batch_id": body.client_batch_id,
            "vr_pilot_first_payload": _sanitize_payload(body.events[0].payload if body.events else None),
        },
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
