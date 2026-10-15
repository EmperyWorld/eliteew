# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Canonical **EWA companion** application layer (chat turn, orchestration, memory, storage-first catalogue, sidecar LLM).
# Only **subpackages** live under this namespace: ``turn``, ``orchestration``, ``memory``, ``sidecar``, ``episodic``,
# ``persona``, ``context``, ``actions``, ``affective``, ``ux``, ``storage``, ``server_first``, ``contracts``.
# Legacy ``api.services.ewa_companion`` package has been removed; limited compatibility exports may remain via ``__getattr__``.
# Invariants:
# - No standalone flat modules at this level; only explicit compatibility proxies (e.g. ``episodic_reembed``) are allowed.
# - **Two pools:** EWA profile/episodes use ``EWA_DATABASE_URL``; catalogue / ``unified_content`` use main ``DATABASE_URL`` (see ``storage.catalog_pipeline``).
# Related:
# - api/ewa_platform/companion/contracts/ (re-export surface for schema types used by turn/orchestration)
# Related: companion package layout under companion/* (historical migration note soft-retired)
# ---
"""EWA companion package (canonical location under ``ewa_platform``)."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from api.ewa_platform.companion.episodic import reembed as episodic_reembed
    from api.ewa_platform.companion.orchestration.routing_policy import orchestration_pipeline_order
    from api.ewa_platform.companion.orchestration.task_orchestrator import (
        maybe_handle_companion_task_orchestration,
    )
    from api.ewa_platform.companion.server_first.v2 import maybe_handle_server_first_v2_turn
    from api.ewa_platform.companion.storage.catalog_pipeline import catalog_pick_owner_row
    from api.ewa_platform.companion.turn.chat_turn import execute_companion_chat_message

__all__: tuple[str, ...] = (
    "catalog_pick_owner_row",
    "episodic_reembed",
    "execute_companion_chat_message",
    "maybe_handle_companion_task_orchestration",
    "maybe_handle_server_first_v2_turn",
    "orchestration_pipeline_order",
)


def __getattr__(name: str):
    if name == "episodic_reembed":
        from api.ewa_platform.companion.episodic import reembed as episodic_reembed

        return episodic_reembed
    if name == "execute_companion_chat_message":
        from api.ewa_platform.companion.turn.chat_turn import execute_companion_chat_message

        return execute_companion_chat_message
    if name == "maybe_handle_companion_task_orchestration":
        from api.ewa_platform.companion.orchestration.task_orchestrator import (
            maybe_handle_companion_task_orchestration,
        )

        return maybe_handle_companion_task_orchestration
    if name == "maybe_handle_server_first_v2_turn":
        from api.ewa_platform.companion.server_first.v2 import maybe_handle_server_first_v2_turn

        return maybe_handle_server_first_v2_turn
    if name == "catalog_pick_owner_row":
        from api.ewa_platform.companion.storage.catalog_pipeline import catalog_pick_owner_row

        return catalog_pick_owner_row
    if name == "orchestration_pipeline_order":
        from api.ewa_platform.companion.orchestration.routing_policy import orchestration_pipeline_order

        return orchestration_pipeline_order
    msg = f"module {__name__!r} has no attribute {name!r}"
    raise AttributeError(msg)
