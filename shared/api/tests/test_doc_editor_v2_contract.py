#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for the first Document Editor V2 backend contour and router error mapping.
# Invariants:
# - Tests exercise the V2 router through dependency overrides, not legacy doc_editor routes.
# - Version conflicts must return a machine-readable 409 payload with the current server document.
# Related:
# - api/routers/doc_editor_v2.py
# - api/schemas/doc_editor_v2.py
# - api/services/doc_editor_v2/document_service.py
# ---
"""Document Editor V2 contract tests."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

import pytest
from fastapi import FastAPI  # type: ignore[import-untyped]
from fastapi.testclient import TestClient

from api.routers import doc_editor_v2 as router_module
from api.schemas.doc_editor_v2 import (
    DocEditorV2Capabilities,
    DocEditorV2CollaborationSnapshotRequest,
    DocEditorV2CollaborationSnapshotResponse,
    DocEditorV2CollaborationStateResponse,
    DocEditorV2CreateRequest,
    DocEditorV2DocumentResponse,
    DocEditorV2DraftRequest,
    DocEditorV2DraftResponse,
    DocEditorV2EditorFormat,
    DocEditorV2EwaAction,
    DocEditorV2EwaContextPacket,
    DocEditorV2EwaSuggestRequest,
    DocEditorV2ExportFormat,
    DocEditorV2ExportRequest,
    DocEditorV2ExportResponse,
    DocEditorV2ImportRequest,
    DocEditorV2ImportResponse,
    DocEditorV2SourceFormat,
    DocEditorV2StructureItem,
    DocEditorV2StructureResponse,
    DocEditorV2SuggestionApplyRequest,
    DocEditorV2SuggestionApplyResponse,
    DocEditorV2SuggestionResponse,
    DocEditorV2SuggestionStatus,
    DocEditorV2UpdateRequest,
)
from api.services.doc_editor_v2 import DocumentEditorV2VersionConflictError

_DOC_ID = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
_USER_ID = "11111111-1111-1111-1111-111111111111"


def _document(**overrides: object) -> DocEditorV2DocumentResponse:
    now = datetime.now(UTC)
    payload = {
        "document_id": _DOC_ID,
        "owner_user_id": _USER_ID,
        "title": "Draft",
        "editor_format": DocEditorV2EditorFormat.MARKDOWN,
        "editor_json": None,
        "content_html": "<h1>Draft</h1>",
        "content_markdown": "# Draft\n",
        "plain_text": "Draft",
        "source_format": DocEditorV2SourceFormat.MARKDOWN,
        "parse_warnings": [],
        "version": 1,
        "capabilities": DocEditorV2Capabilities(
            can_read=True,
            can_edit=True,
            can_comment=True,
            can_apply_ewa=True,
            can_export=True,
        ),
        "tags": [],
        "created_at": now,
        "updated_at": now,
    }
    payload.update(overrides)
    return DocEditorV2DocumentResponse(**payload)


class _FakeDocEditorV2Service:
    async def create_document(
        self,
        user_id: str,
        request: DocEditorV2CreateRequest,
    ) -> DocEditorV2DocumentResponse:
        assert user_id == _USER_ID
        assert request.tags == ["draft", "roadmap"]
        return _document(title=request.title, content_markdown=request.content_markdown or "", plain_text="Created")

    async def get_document(self, document_id: UUID, user_id: str) -> DocEditorV2DocumentResponse:
        assert document_id == _DOC_ID
        assert user_id == _USER_ID
        return _document()

    async def update_document(
        self,
        document_id: UUID,
        user_id: str,
        request: DocEditorV2UpdateRequest,
    ) -> DocEditorV2DocumentResponse:
        assert document_id == _DOC_ID
        assert user_id == _USER_ID
        raise DocumentEditorV2VersionConflictError(
            expected_version=request.expected_version,
            current_version=2,
            server_document=_document(version=2, plain_text="Server"),
        )

    async def get_draft(self, document_id: UUID, user_id: str) -> DocEditorV2DraftResponse:
        assert document_id == _DOC_ID
        assert user_id == _USER_ID
        return DocEditorV2DraftResponse(
            document_id=document_id,
            status="empty",
            base_document_version=1,
            draft_version=0,
        )

    async def put_draft(
        self,
        document_id: UUID,
        user_id: str,
        request: DocEditorV2DraftRequest,
    ) -> DocEditorV2DraftResponse:
        assert document_id == _DOC_ID
        assert user_id == _USER_ID
        return DocEditorV2DraftResponse(
            document_id=document_id,
            status="stored",
            base_document_version=request.base_document_version,
            draft_version=1,
            content_markdown=request.content_markdown or "",
            plain_text="Draft body",
            updated_at=datetime.now(UTC),
        )

    async def delete_draft(self, document_id: UUID, user_id: str) -> DocEditorV2DraftResponse:
        assert document_id == _DOC_ID
        assert user_id == _USER_ID
        return DocEditorV2DraftResponse(
            document_id=document_id,
            status="deleted",
            base_document_version=1,
            draft_version=1,
        )

    async def import_document(self, user_id: str, request: DocEditorV2ImportRequest) -> DocEditorV2ImportResponse:
        assert user_id == _USER_ID
        assert request.filename == "plan.md"
        return DocEditorV2ImportResponse(document=_document(title="plan.md"), parse_warnings=[])

    async def export_document(
        self,
        document_id: UUID,
        user_id: str,
        request: DocEditorV2ExportRequest,
    ) -> DocEditorV2ExportResponse:
        assert document_id == _DOC_ID
        assert user_id == _USER_ID
        return DocEditorV2ExportResponse(
            document_id=document_id,
            export_format=request.export_format,
            filename=f"Draft.{request.export_format.value}",
            mime_type="text/markdown",
            content_base64="IyBEcmFmdAo=",
        )

    async def get_structure(self, document_id: UUID, user_id: str) -> DocEditorV2StructureResponse:
        assert document_id == _DOC_ID
        assert user_id == _USER_ID
        return DocEditorV2StructureResponse(
            document_id=document_id,
            version=1,
            items=[DocEditorV2StructureItem(id="h-1", title="Draft", level=1, start_offset=0, end_offset=5)],
            summary="Draft",
        )

    async def create_ewa_suggestion(
        self,
        document_id: UUID,
        user_id: str,
        request: DocEditorV2EwaSuggestRequest,
    ) -> DocEditorV2SuggestionResponse:
        assert document_id == _DOC_ID
        assert user_id == _USER_ID
        context = DocEditorV2EwaContextPacket(
            document_id=document_id,
            title="Draft",
            version=1,
            capabilities=DocEditorV2Capabilities(can_read=True, can_edit=True, can_apply_ewa=True),
            source_format=DocEditorV2SourceFormat.MARKDOWN,
        )
        return DocEditorV2SuggestionResponse(
            id="sug-1",
            document_id=document_id,
            action=request.action,
            status=DocEditorV2SuggestionStatus.NEEDS_APPROVAL,
            title="Rewrite selected text",
            explanation=request.instruction,
            replacement_text="Better draft",
            base_document_version=1,
            context_packet=context,
            created_at=datetime.now(UTC),
            created_by=user_id,
        )

    async def apply_ewa_suggestion(
        self,
        document_id: UUID,
        suggestion_id: str,
        user_id: str,
        request: DocEditorV2SuggestionApplyRequest,
    ) -> DocEditorV2SuggestionApplyResponse:
        assert document_id == _DOC_ID
        assert suggestion_id == "sug-1"
        assert user_id == _USER_ID
        context = DocEditorV2EwaContextPacket(
            document_id=document_id,
            title="Draft",
            version=request.expected_version,
            capabilities=DocEditorV2Capabilities(can_read=True, can_edit=True, can_apply_ewa=True),
            source_format=DocEditorV2SourceFormat.MARKDOWN,
        )
        suggestion = DocEditorV2SuggestionResponse(
            id=suggestion_id,
            document_id=document_id,
            action=DocEditorV2EwaAction.REWRITE_SELECTION,
            status=DocEditorV2SuggestionStatus.APPLIED,
            title="Rewrite selected text",
            explanation="Improve",
            replacement_text="Better draft",
            base_document_version=request.expected_version,
            context_packet=context,
            created_at=datetime.now(UTC),
            created_by=user_id,
            applied_at=datetime.now(UTC),
            applied_by=user_id,
        )
        return DocEditorV2SuggestionApplyResponse(suggestion=suggestion, document=_document(version=2))

    async def get_collaboration_state(
        self,
        document_id: UUID,
        user_id: str,
    ) -> DocEditorV2CollaborationStateResponse:
        assert document_id == _DOC_ID
        assert user_id == _USER_ID
        return DocEditorV2CollaborationStateResponse(
            document_id=document_id,
            room_id=f"doc-editor-v2:{document_id}",
            snapshot_version=0,
        )

    async def put_collaboration_snapshot(
        self,
        document_id: UUID,
        user_id: str,
        request: DocEditorV2CollaborationSnapshotRequest,
    ) -> DocEditorV2CollaborationSnapshotResponse:
        assert document_id == _DOC_ID
        assert user_id == _USER_ID
        assert request.snapshot_base64 == "AAAA"
        return DocEditorV2CollaborationSnapshotResponse(
            document_id=document_id,
            snapshot_version=1,
            last_snapshot_at=datetime.now(UTC),
        )


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(router_module.router, prefix="/api/v1/doc-editor-v2")
    app.dependency_overrides[router_module.get_current_user_db_id] = lambda: _USER_ID
    app.dependency_overrides[router_module.get_doc_editor_v2_service] = lambda: _FakeDocEditorV2Service()
    return TestClient(app)


@pytest.mark.unit
def test_doc_editor_v2_health_and_capabilities() -> None:
    client = _client()

    health = client.get("/api/v1/doc-editor-v2/health")
    capabilities = client.get("/api/v1/doc-editor-v2/capabilities")

    assert health.status_code == 200
    assert health.json()["storage_table"] == "unified_content"
    assert health.json()["legacy_documents_table_used"] is False
    assert capabilities.status_code == 200
    assert capabilities.json()["supports_create"] is True
    assert capabilities.json()["supports_import"] is True
    assert capabilities.json()["supports_ewa_suggestions"] is True


@pytest.mark.unit
def test_doc_editor_v2_create_document_contract() -> None:
    response = _client().post(
        "/api/v1/doc-editor-v2/documents",
        json={
            "title": "Plan",
            "content_markdown": "# Plan\n",
            "tags": ["draft", "draft", "  roadmap  "],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["document_id"] == str(_DOC_ID)
    assert body["title"] == "Plan"
    assert body["capabilities"]["can_edit"] is True


@pytest.mark.unit
def test_doc_editor_v2_update_conflict_payload() -> None:
    response = _client().put(
        f"/api/v1/doc-editor-v2/documents/{_DOC_ID}",
        json={"expected_version": 1, "content_markdown": "# Local\n"},
    )

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "version_conflict"
    assert detail["expected_version"] == 1
    assert detail["current_version"] == 2
    assert detail["server_document"]["version"] == 2


@pytest.mark.unit
def test_doc_editor_v2_draft_contract() -> None:
    client = _client()

    empty = client.get(f"/api/v1/doc-editor-v2/documents/{_DOC_ID}/draft")
    stored = client.put(
        f"/api/v1/doc-editor-v2/documents/{_DOC_ID}/draft",
        json={"base_document_version": 1, "content_markdown": "# Draft\n"},
    )
    deleted = client.delete(f"/api/v1/doc-editor-v2/documents/{_DOC_ID}/draft")

    assert empty.status_code == 200
    assert empty.json()["status"] == "empty"
    assert stored.status_code == 200
    assert stored.json()["status"] == "stored"
    assert stored.json()["draft_version"] == 1
    assert deleted.status_code == 200
    assert deleted.json()["status"] == "deleted"


@pytest.mark.unit
def test_doc_editor_v2_import_export_structure_contract() -> None:
    client = _client()

    imported = client.post(
        "/api/v1/doc-editor-v2/import",
        json={"filename": "plan.md", "content_text": "# Plan\n"},
    )
    exported = client.post(
        f"/api/v1/doc-editor-v2/documents/{_DOC_ID}/export",
        json={"export_format": DocEditorV2ExportFormat.MARKDOWN.value},
    )
    structure = client.get(f"/api/v1/doc-editor-v2/documents/{_DOC_ID}/structure")

    assert imported.status_code == 201
    assert imported.json()["status"] == "imported"
    assert imported.json()["document"]["document_id"] == str(_DOC_ID)
    assert exported.status_code == 200
    assert exported.json()["content_base64"] == "IyBEcmFmdAo="
    assert structure.status_code == 200
    assert structure.json()["items"][0]["title"] == "Draft"


@pytest.mark.unit
def test_doc_editor_v2_ewa_suggestion_contract() -> None:
    client = _client()

    suggestion = client.post(
        f"/api/v1/doc-editor-v2/documents/{_DOC_ID}/ewa/suggest",
        json={"action": "rewrite_selection", "instruction": "Improve", "selected_range": {"start": 0, "end": 5}},
    )
    applied = client.post(
        f"/api/v1/doc-editor-v2/documents/{_DOC_ID}/suggestions/sug-1/apply",
        json={"expected_version": 1},
    )

    assert suggestion.status_code == 200
    assert suggestion.json()["status"] == "needs_approval"
    assert suggestion.json()["context_packet"]["document_id"] == str(_DOC_ID)
    assert applied.status_code == 200
    assert applied.json()["suggestion"]["status"] == "applied"
    assert applied.json()["document"]["version"] == 2


@pytest.mark.unit
def test_doc_editor_v2_collaboration_contract() -> None:
    client = _client()

    state = client.get(f"/api/v1/doc-editor-v2/documents/{_DOC_ID}/collaboration")
    snapshot = client.put(
        f"/api/v1/doc-editor-v2/documents/{_DOC_ID}/collaboration/snapshot",
        json={"base_document_version": 1, "snapshot_base64": "AAAA"},
    )

    assert state.status_code == 200
    assert state.json()["room_id"] == f"doc-editor-v2:{_DOC_ID}"
    assert snapshot.status_code == 200
    assert snapshot.json()["snapshot_version"] == 1
