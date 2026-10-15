# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Единая точка времени UTC для API: naive для колонок PostgreSQL без таймзоны,
#   осознанная ISO‑строка для JSON/WebSocket ответов.
# Invariants:
#   - utc_now_naive() семантически совпадает с legacy datetime.utcnow() (совместимость схем).
# Related:
#   - services/queue_features.utcnow_naive (реэкспорт имени для очередей)
# ------------------------------------------------------------------------------

from __future__ import annotations

from datetime import UTC, datetime


def utc_now_naive() -> datetime:
    """Текущий момент в UTC без tzinfo (TIMESTAMP WITHOUT TIME ZONE, как прежний utcnow)."""
    return datetime.now(UTC).replace(tzinfo=None)


def utc_now_iso(timespec: str = "microseconds") -> str:
    """ISO 8601 в UTC с оффсетом +00:00 для полезной нагрузки JSON/Socket.IO."""
    return datetime.now(UTC).isoformat(timespec=timespec)
