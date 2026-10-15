# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Companion file_delete must not propose confirmation for catalogue rows the actor cannot delete.
# Related:
# - api/ewa_platform/companion/orchestration/flows/file_delete.py
# - api/ewa_platform/companion/orchestration/flows/catalog_resolve.py
# ---
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import pytest

from api.ewa_platform.companion.orchestration.flows.catalog_resolve import CatalogPhraseMatch
from api.ewa_platform.companion.orchestration.flows.file_delete import propose_file_delete_from_query


@dataclass
class _FakeCompactRow:
    id: UUID
    name: str
    original_filename: str
    can_delete: bool
    can_edit: bool


class _FakeQuery:
    def __init__(self, items: list[_FakeCompactRow]) -> None:
        self._items = items

    async def list_content(self, **_kw: Any) -> tuple[list[_FakeCompactRow], int]:
        return self._items, len(self._items)


@pytest.mark.unit
def test_file_delete_allows_shared_recipient_when_can_delete(monkeypatch: pytest.MonkeyPatch) -> None:
    created: list[dict[str, object]] = []

    async def fake_resolve(*_a: object, **_k: object):
        from api.ewa_platform.companion.orchestration.flows.catalog_resolve import CatalogPhraseMatch

        return CatalogPhraseMatch(
            unified_content_id="7dbf35be-e0a6-4468-9fda-7e0df743ed13",
            label="shared.md",
            can_delete=True,
            can_edit=False,
        )

    async def fake_run_create(
        *_a: object,
        status: object,
        plan_payload: dict[str, object],
        **_k: object,
    ) -> dict[str, object]:
        run = {"id": "run-del", "status": status, "plan_payload": dict(plan_payload)}
        created.append(run)
        return run

    async def fake_step_create(*_a: object, **_k: object) -> dict[str, object]:
        return {"id": "step-del"}

    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.flows.file_delete.resolve_uc_by_phrase",
        fake_resolve,
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_task_run_create",
        fake_run_create,
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_task_step_create",
        fake_step_create,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.flows.file_delete.query_service_or_none",
        lambda: object(),
    )

    out = asyncio.run(
        propose_file_delete_from_query(
            object(),
            principal_id="principal-1",
            user_line="удали файл shared.md",
            content_catalog_user_id="3b22cefa-8d9e-44f0-aec0-fa76b15bd4ef",
            oauth2_sub=None,
            phrase="shared.md",
        )
    )
    assert out is not None
    assert out["task_run"] is not None
    assert created
    assert "уберёт файл из твоей библиотеки" in str(out["reply"])


@pytest.mark.unit
def test_file_delete_blocks_when_can_delete_false(monkeypatch: pytest.MonkeyPatch) -> None:
    row = _FakeCompactRow(
        id=UUID("7dbf35be-e0a6-4468-9fda-7e0df743ed13"),
        name="ELITEEW-MINI-PREZENTACIYA-v4.md",
        original_filename="ELITEEW-MINI-PREZENTACIYA-v4.md",
        can_delete=False,
        can_edit=False,
    )

    async def fake_query_svc() -> _FakeQuery:
        return _FakeQuery([row])

    async def fail_create(*_a: Any, **_k: Any) -> dict[str, Any]:
        raise AssertionError("task run must not be created for non-owner delete")

    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.flows.file_delete.query_service_or_none",
        fake_query_svc,
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_asyncpg.companion_task_run_create",
        fail_create,
    )

    out = asyncio.run(
        propose_file_delete_from_query(
            object(),
            principal_id="principal-1",
            user_line="удали файл ELITEEW-MINI-PREZENTACIYA-v4.md",
            content_catalog_user_id="3b22cefa-8d9e-44f0-aec0-fa76b15bd4ef",
            oauth2_sub=None,
            phrase="ELITEEW-MINI-PREZENTACIYA-v4.md",
        )
    )
    assert out is not None
    assert out["task_run"] is None
    assert "убрать его из твоей библиотеки" in out["reply"]


@pytest.mark.unit
def test_catalog_phrase_match_carries_can_delete_from_row() -> None:
    match = CatalogPhraseMatch(
        unified_content_id="uc-1",
        label="a.md",
        can_delete=False,
        can_edit=True,
    )
    assert match.can_delete is False
    assert match.can_edit is True
