# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression coverage for **EWA Runtime Gateway** context + command services: authenticated user scoping, content
# pagination, allowlisted desktop actions, and DocEditor confirmation boundaries.
# Invariants:
# - Tests use service-level fakes; no FastAPI, real Postgres, storage, or LLM calls.
# - Assertions ensure request bodies cannot spoof user/content scope.
# Related:
# - api/ewa_platform/gateways/runtime_gateway/runtime_context.py
# - api/ewa_platform/gateways/runtime_gateway/runtime_command.py
# ---
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from uuid import UUID

from api.ewa_platform.gateways.runtime_gateway.runtime_command import execute_runtime_command
from api.ewa_platform.gateways.runtime_gateway.runtime_context import (
    build_runtime_content_page,
    build_runtime_context,
    normalize_catalog_filters,
)
from api.ewa_platform.schemas.pydantic.runtime_command import EwaRuntimeCommandIn
from api.ewa_platform.schemas.pydantic.runtime_context import EwaRuntimeCatalogPreferencesOut


@dataclass
class FakeContent:
    id: UUID
    name: str
    content_type: str = "document"
    mime_type: str = "text/markdown"
    user_id: str = "content-user"
    extracted_text: str = "Document body preview"
    is_owner: bool = True
    can_edit: bool = True


@dataclass
class FakeUser:
    id: str = "oauth-sub"
    email: str = "u@example.test"
    username: str = "tester"
    role: str = "admin"
    ew_family: bool = False


class FakeQueryService:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    async def list_content(self, **kwargs: object) -> tuple[list[FakeContent], int]:
        self.calls.append(dict(kwargs))
        return (
            [
                FakeContent(UUID("11111111-1111-1111-1111-111111111111"), "alpha.md"),
                FakeContent(UUID("22222222-2222-2222-2222-222222222222"), "beta.md"),
            ],
            5,
        )


class FakeStorageService:
    def __init__(self) -> None:
        self.deleted: list[str] = []
        self.updated: list[tuple[str, object]] = []
        self.created: list[str] = []

    async def get_content(self, content_id: UUID, user_id: str, check_permissions: bool = True) -> FakeContent:
        del check_permissions
        if str(content_id) == "99999999-9999-9999-9999-999999999999":
            raise PermissionError("Access denied to content")
        return FakeContent(content_id, "resolved.md", user_id=user_id)

    async def create_content(self, *, content_data, file_data: bytes, user_id: str) -> FakeContent:
        del file_data
        self.created.append(content_data.name)
        return FakeContent(UUID("33333333-3333-3333-3333-333333333333"), content_data.name, user_id=user_id)

    async def delete_content(self, content_id: UUID, user_id: str) -> bool:
        del user_id
        self.deleted.append(str(content_id))
        return True

    async def restore_content(self, content_id: UUID, user_id: str) -> FakeContent:
        return FakeContent(content_id, "restored.md", user_id=user_id)

    async def update_content(self, content_id: UUID, user_id: str, updates) -> FakeContent:
        self.updated.append((str(content_id), updates))
        return FakeContent(content_id, updates.name or "updated.md", user_id=user_id)


def _run_command(cmd: EwaRuntimeCommandIn):
    storage = FakeStorageService()
    return asyncio.run(
        execute_runtime_command(
            cmd,
            authorized_user_id="oauth-sub",
            content_user_id="content-user",
            oauth2_sub="oauth-sub",
            query_svc=FakeQueryService(),
            storage_svc=storage,
        )
    )


def test_runtime_context_returns_server_scoped_content_page() -> None:
    query_svc = FakeQueryService()
    data = asyncio.run(
        build_runtime_context(
            auth_user=FakeUser(),
            content_user_id="content-user",
            query_svc=query_svc,
            companion_pool=None,
            content_limit=2,
            content_search="alpha",
        )
    )
    assert data.context_version == "ewa_runtime_context_v1"
    assert data.principal.principal_id == "oauth-sub"
    assert data.principal.content_user_id == "content-user"
    assert data.companion.loaded is False
    assert data.companion.reason == "no_database_pool"
    assert data.content.total == 5
    assert data.content.truncated is True
    assert data.content.next_offset == 2
    assert query_svc.calls[0]["user_id"] == "content-user"
    assert query_svc.calls[0]["alternate_user_id"] == "oauth-sub"
    assert query_svc.calls[0]["search_query"] == "alpha"


def test_runtime_content_page_is_paginated() -> None:
    query_svc = FakeQueryService()
    data = asyncio.run(
        build_runtime_content_page(
            query_svc,
            content_user_id="content-user",
            oauth2_sub="oauth-sub",
            search_query="body phrase",
            search_scope="content",
            offset=1,
            limit=2,
        )
    )
    assert data.offset == 1
    assert data.limit == 2
    assert data.next_offset == 3
    assert query_svc.calls[0]["offset"] == 1
    assert query_svc.calls[0]["limit"] == 2
    assert query_svc.calls[0]["search_scope"] == "content"


def test_runtime_content_page_filters_by_extension_and_preferences() -> None:
    class MixedQueryService(FakeQueryService):
        async def list_content(self, **kwargs: object) -> tuple[list[FakeContent], int]:
            self.calls.append(dict(kwargs))
            return (
                [
                    FakeContent(UUID("11111111-1111-1111-1111-111111111111"), "alpha.md", "document", "text/markdown"),
                    FakeContent(UUID("22222222-2222-2222-2222-222222222222"), "song.mp3", "audio", "audio/mpeg"),
                    FakeContent(UUID("33333333-3333-3333-3333-333333333333"), "beta.html", "document", "text/html"),
                ],
                3,
            )

    data = asyncio.run(
        build_runtime_content_page(
            MixedQueryService(),
            content_user_id="content-user",
            oauth2_sub="oauth-sub",
            limit=10,
            filters=normalize_catalog_filters(extension_include=[".md", ".html"]),
            preferences=EwaRuntimeCatalogPreferencesOut(exclude_content_types=["audio"], extension_exclude=[".html"]),
        )
    )
    assert data.total == 1
    assert [item.name for item in data.items] == ["alpha.md"]
    assert data.applied_preferences is not None
    assert data.applied_preferences.extension_exclude == [".html"]


def test_runtime_content_search_zero_results_empty_corpus_hint() -> None:
    class ZeroHitQuery(FakeQueryService):
        def __init__(self) -> None:
            super().__init__()
            self.corpus_calls: list[dict[str, object]] = []

        async def list_content(self, **kwargs: object) -> tuple[list[FakeContent], int]:
            self.calls.append(dict(kwargs))
            return ([], 0)

        async def count_indexed_body_corpus(self, **kwargs: object) -> int:
            self.corpus_calls.append(dict(kwargs))
            return 0

    query_svc = ZeroHitQuery()
    data = asyncio.run(
        build_runtime_content_page(
            query_svc,
            content_user_id="content-user",
            oauth2_sub="oauth-sub",
            search_query="missing phrase",
            search_scope="content",
        )
    )
    assert data.total == 0
    assert data.search_diagnostics["zero_results"] is True
    assert data.search_diagnostics["indexed_body_corpus_count"] == 0
    assert "нет документов с проиндексированным текстом" in data.search_diagnostics["zero_results_hint"]
    assert query_svc.corpus_calls[0]["user_id"] == "content-user"
    assert query_svc.corpus_calls[0]["alternate_user_id"] == "oauth-sub"


def test_runtime_content_search_zero_results_nonempty_corpus_hint() -> None:
    class ZeroHitWithCorpusQuery(FakeQueryService):
        async def list_content(self, **kwargs: object) -> tuple[list[FakeContent], int]:
            self.calls.append(dict(kwargs))
            return ([], 0)

        async def count_indexed_body_corpus(self, **kwargs: object) -> int:
            return 3

    data = asyncio.run(
        build_runtime_content_page(
            ZeroHitWithCorpusQuery(),
            content_user_id="content-user",
            oauth2_sub="oauth-sub",
            search_query="missing phrase",
            search_scope="hybrid",
        )
    )
    assert data.total == 0
    assert data.search_diagnostics["indexed_body_corpus_count"] == 3
    assert "документы с текстом есть" in data.search_diagnostics["zero_results_hint"]


def test_runtime_content_search_metadata_zero_skips_corpus_diagnostics() -> None:
    class ZeroHitQuery(FakeQueryService):
        async def list_content(self, **kwargs: object) -> tuple[list[FakeContent], int]:
            self.calls.append(dict(kwargs))
            return ([], 0)

        async def count_indexed_body_corpus(self, **kwargs: object) -> int:
            raise AssertionError("metadata zero-hit must not count indexed body corpus")

    data = asyncio.run(
        build_runtime_content_page(
            ZeroHitQuery(),
            content_user_id="content-user",
            oauth2_sub="oauth-sub",
            search_query="missing phrase",
            search_scope="metadata",
        )
    )
    assert data.total == 0
    assert data.search_diagnostics["zero_results"] is True
    assert "indexed_body_corpus_count" not in data.search_diagnostics
    assert "zero_results_hint" not in data.search_diagnostics


def test_runtime_command_desktop_open_app_allowlist() -> None:
    data = _run_command(
        EwaRuntimeCommandIn(command_kind="desktop.open_app", arguments={"app_component": "ContentManagerPro"})
    )
    assert data.status == "ok"
    assert data.safety_tier == "safe_ui"
    assert data.actions == [{"type": "open_app", "app_component": "ContentManagerPro"}]


def test_runtime_command_rejects_disallowed_app() -> None:
    data = _run_command(
        EwaRuntimeCommandIn(command_kind="desktop.open_app", arguments={"app_component": "UnifiedAdminApp"})
    )
    assert data.status == "rejected"
    assert data.rejection_reason == "desktop_action_not_allowlisted"


def test_runtime_command_content_search_passes_body_scope() -> None:
    query = FakeQueryService()
    data = asyncio.run(
        execute_runtime_command(
            EwaRuntimeCommandIn(
                command_kind="content.search",
                arguments={"search_query": "амортизация", "search_scope": "content"},
            ),
            authorized_user_id="oauth-sub",
            content_user_id="content-user",
            oauth2_sub="oauth-sub",
            query_svc=query,
            storage_svc=FakeStorageService(),
        )
    )
    assert data.status == "ok"
    assert query.calls[0]["search_scope"] == "content"
    assert data.result["search_scope"] == "content"


def test_runtime_command_doc_apply_requires_confirmation() -> None:
    data = _run_command(
        EwaRuntimeCommandIn(
            command_kind="doc.edit.apply",
            arguments={
                "unified_content_id": "11111111-1111-1111-1111-111111111111",
                "body_html": "<p>Updated</p>",
            },
        )
    )
    assert data.status == "requires_confirmation"
    assert data.result["confirmation_required"] is True
    assert data.actions == []


def test_runtime_command_doc_create_requires_confirmation_then_creates() -> None:
    storage = FakeStorageService()
    blocked = asyncio.run(
        execute_runtime_command(
            EwaRuntimeCommandIn(command_kind="doc.create", arguments={"name": "note", "plain_text": "hello"}),
            authorized_user_id="oauth-sub",
            content_user_id="content-user",
            oauth2_sub="oauth-sub",
            query_svc=FakeQueryService(),
            storage_svc=storage,
        )
    )
    assert blocked.status == "requires_confirmation"
    created = asyncio.run(
        execute_runtime_command(
            EwaRuntimeCommandIn(
                command_kind="doc.create",
                arguments={"name": "note", "plain_text": "hello"},
                confirmed=True,
            ),
            authorized_user_id="oauth-sub",
            content_user_id="content-user",
            oauth2_sub="oauth-sub",
            query_svc=FakeQueryService(),
            storage_svc=storage,
        )
    )
    assert created.status == "ok"
    assert storage.created == ["note.txt"]


def test_runtime_command_delete_apply_soft_deletes_after_confirmation() -> None:
    storage = FakeStorageService()
    target = "11111111-1111-1111-1111-111111111111"
    blocked = asyncio.run(
        execute_runtime_command(
            EwaRuntimeCommandIn(command_kind="doc.delete.apply", arguments={"unified_content_id": target}),
            authorized_user_id="oauth-sub",
            content_user_id="content-user",
            oauth2_sub="oauth-sub",
            query_svc=FakeQueryService(),
            storage_svc=storage,
        )
    )
    assert blocked.status == "requires_confirmation"
    deleted = asyncio.run(
        execute_runtime_command(
            EwaRuntimeCommandIn(
                command_kind="doc.delete.apply",
                arguments={"unified_content_id": target},
                confirmed=True,
            ),
            authorized_user_id="oauth-sub",
            content_user_id="content-user",
            oauth2_sub="oauth-sub",
            query_svc=FakeQueryService(),
            storage_svc=storage,
        )
    )
    assert deleted.status == "ok"
    assert storage.deleted == [target]


def test_runtime_command_doc_read_rejects_denied_content() -> None:
    data = _run_command(
        EwaRuntimeCommandIn(
            command_kind="doc.read",
            arguments={"unified_content_id": "99999999-9999-9999-9999-999999999999"},
        )
    )
    assert data.status == "rejected"
