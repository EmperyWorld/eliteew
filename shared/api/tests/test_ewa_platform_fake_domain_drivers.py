# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for ``FakeUgsControlDriver``, ``FakeDocumentsWorkspaceDriver``, ``FakeContentManagerDriver`` and registry wiring.
# Invariants:
# - No network; ``clear_driver_registry`` before registry assertions.
# Related:
# - shared/api/ewa_platform/testing/fake_domain_drivers.py
# - shared/api/ewa_platform/drivers/content_manager.py
# - shared/api/ewa_platform/drivers/documents_workspace.py
# - shared/api/ewa_platform/drivers/ugs_control.py
# - shared/api/ewa_platform/drivers/registry.py
# ---
from __future__ import annotations

import asyncio

from api.ewa_platform.contracts.domain_driver_snapshots import (
    DomainActionRiskTier,
    domain_action_risk_tier_allows_read_only,
)
from api.ewa_platform.drivers.content_manager import ContentManagerDriver
from api.ewa_platform.drivers.documents_workspace import DocumentsWorkspaceDriver
from api.ewa_platform.drivers.registry import (
    CONTENT_MANAGER_DRIVER_ID,
    DOCUMENTS_WORKSPACE_DRIVER_ID,
    UGS_CONTROL_DRIVER_ID,
    clear_driver_registry,
    get_driver,
    register_driver,
)
from api.ewa_platform.drivers.ugs_control import UgsControlDriver
from api.ewa_platform.testing.fake_domain_drivers import (
    FakeContentManagerDriver,
    FakeDocumentsWorkspaceDriver,
    FakeUgsControlDriver,
)


def test_fake_ugs_satisfies_protocol() -> None:
    async def body() -> None:
        d = FakeUgsControlDriver(hint={"tier": "test"})
        assert isinstance(d, UgsControlDriver)
        assert d.driver_id == UGS_CONTROL_DRIVER_ID
        ping = await d.ping()
        assert ping["ok"] is True
        hint = await d.read_configuration_hint()
        assert hint["tier"] == "test"

    asyncio.run(body())


def test_fake_documents_satisfies_protocol() -> None:
    async def body() -> None:
        d = FakeDocumentsWorkspaceDriver(documents=[{"doc_id": "a1", "title": "Doc"}])
        assert isinstance(d, DocumentsWorkspaceDriver)
        assert d.max_supported_risk_tier == DomainActionRiskTier.READ_ONLY
        snap = await d.describe_open_documents_snapshot()
        assert snap.items[0].doc_id == "a1"
        desc = await d.describe_open_documents_hint()
        assert desc["open_document_count"] == 1
        assert desc["source"] == "fake_in_memory"
        assert desc["items"][0]["doc_id"] == "a1"

    asyncio.run(body())


def test_fake_content_manager_satisfies_protocol() -> None:
    async def body() -> None:
        d = FakeContentManagerDriver(roots=["root-a"])
        assert isinstance(d, ContentManagerDriver)
        assert d.max_supported_risk_tier == DomainActionRiskTier.READ_ONLY
        snap = await d.list_entity_roots_snapshot()
        assert list(snap.roots) == ["root-a"]
        roots = await d.list_entity_roots_hint()
        assert roots["roots"] == ["root-a"]
        assert roots["source"] == "fake_in_memory"

    asyncio.run(body())


def test_domain_action_risk_tier_read_only_guard() -> None:
    assert domain_action_risk_tier_allows_read_only(DomainActionRiskTier.READ_ONLY)
    assert not domain_action_risk_tier_allows_read_only(DomainActionRiskTier.LOW_RISK_MUTATION)


def test_register_fake_domain_drivers() -> None:
    clear_driver_registry()
    ugs = FakeUgsControlDriver()
    docs = FakeDocumentsWorkspaceDriver()
    cm = FakeContentManagerDriver()
    register_driver(ugs)
    register_driver(docs)
    register_driver(cm)
    try:
        assert get_driver(UGS_CONTROL_DRIVER_ID) is ugs
        assert get_driver(DOCUMENTS_WORKSPACE_DRIVER_ID) is docs
        assert get_driver(CONTENT_MANAGER_DRIVER_ID) is cm
    finally:
        clear_driver_registry()
