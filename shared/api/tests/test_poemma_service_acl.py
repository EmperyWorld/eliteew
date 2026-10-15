# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for POEMMA service ACL and backup payload guards.
# Invariants:
# - Owner-only mutations stay forbidden for non-owner roles.
# - Non-owner payload merge cannot wipe/change owner-protected namespaces.
# - Backup import rejects foreign userId payloads.
# - Role PATCH is denied for non-owner members without platform admin.
# Related:
# - api/services/poemma_service.py
# ---

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

from api.services.poemma_service import (
    can_poemma_actor_change_role,
    can_poemma_role_mutate,
    extract_poemma_org_id_from_payload,
    is_poemma_platform_admin,
    merge_poemma_storage_payload_for_role,
    normalize_poemma_role,
    poemma_storage_key_namespace,
    validate_poemma_backup_payload,
)


def test_poemma_owner_can_mutate_owner_only_action() -> None:
    assert can_poemma_role_mutate("owner", "saveFinanceSnapshot") is True


def test_poemma_team_cannot_mutate_owner_only_action() -> None:
    assert can_poemma_role_mutate("team", "saveFinanceSnapshot") is False
    assert can_poemma_role_mutate("manager", "saveFinanceSnapshot") is False


def test_poemma_team_can_mutate_team_action() -> None:
    for role in ("team", "manager", "smm", "production"):
        assert can_poemma_role_mutate(role, "saveInitiative") is True


def test_poemma_unknown_mutation_denied_for_non_owner() -> None:
    assert can_poemma_role_mutate("team", "unknownMutation") is False
    assert can_poemma_role_mutate("owner", "unknownMutation") is True


def test_extract_poemma_org_id_from_payload() -> None:
    payload = {
        "poemma:v1:user-x:org": {"id": "org-abc"},
        "poemma:v1:user-x:periods": [],
    }
    assert extract_poemma_org_id_from_payload(payload) == "org-abc"


def test_normalize_poemma_role_fallback() -> None:
    assert normalize_poemma_role("manager") == "manager"
    assert normalize_poemma_role("weird") == "team"


def test_is_poemma_platform_admin() -> None:
    assert is_poemma_platform_admin("admin") is True
    assert is_poemma_platform_admin("emperyworld_admin") is True
    assert is_poemma_platform_admin("user") is False
    assert is_poemma_platform_admin(None) is False


def test_can_poemma_actor_change_role_owner_ok() -> None:
    owner_id = uuid4()
    workspace = SimpleNamespace(owner_user_id=owner_id)
    assert (
        can_poemma_actor_change_role(
            actor_user_id=owner_id,
            workspace=workspace,  # type: ignore[arg-type]
            platform_role="user",
        )
        is True
    )


def test_can_poemma_actor_change_role_team_member_denied() -> None:
    owner_id = uuid4()
    member_id = uuid4()
    workspace = SimpleNamespace(owner_user_id=owner_id)
    assert (
        can_poemma_actor_change_role(
            actor_user_id=member_id,
            workspace=workspace,  # type: ignore[arg-type]
            platform_role="user",
        )
        is False
    )


def test_can_poemma_actor_change_role_platform_admin_ok() -> None:
    owner_id = uuid4()
    member_id = uuid4()
    workspace = SimpleNamespace(owner_user_id=owner_id)
    assert (
        can_poemma_actor_change_role(
            actor_user_id=member_id,
            workspace=workspace,  # type: ignore[arg-type]
            platform_role="emperyworld_admin",
        )
        is True
    )


def test_can_poemma_actor_change_role_bootstrap_without_workspace() -> None:
    assert (
        can_poemma_actor_change_role(
            actor_user_id=uuid4(),
            workspace=None,
            platform_role="user",
        )
        is True
    )


def test_poemma_storage_key_namespace() -> None:
    assert poemma_storage_key_namespace("poemma:v1:user-a:finance:p1") == "finance"
    assert poemma_storage_key_namespace("poemma:v1:user-a:initiatives:p1") == "initiatives"
    assert poemma_storage_key_namespace("bad") == ""


def test_merge_team_save_initiative_preserves_finance() -> None:
    existing = {
        "poemma:v1:user-a:finance:p1": {"revenue": 100},
        "poemma:v1:user-a:initiatives:p1": [{"id": "old"}],
        "poemma:v1:user-a:promotions:p1": [{"id": "promo"}],
    }
    incoming = {
        "poemma:v1:user-a:finance:p1": {"revenue": 100},
        "poemma:v1:user-a:initiatives:p1": [{"id": "new"}],
        "poemma:v1:user-a:promotions:p1": [{"id": "promo"}],
    }
    merged = merge_poemma_storage_payload_for_role(
        role="team",
        mutation="saveInitiative",
        existing=existing,
        incoming=incoming,
    )
    assert merged["poemma:v1:user-a:finance:p1"] == {"revenue": 100}
    assert merged["poemma:v1:user-a:promotions:p1"] == [{"id": "promo"}]
    assert merged["poemma:v1:user-a:initiatives:p1"] == [{"id": "new"}]


def test_merge_team_save_initiative_rejects_finance_tamper() -> None:
    existing = {
        "poemma:v1:user-a:finance:p1": {"revenue": 100},
        "poemma:v1:user-a:initiatives:p1": [],
    }
    incoming = {
        "poemma:v1:user-a:finance:p1": {"revenue": 999},
        "poemma:v1:user-a:initiatives:p1": [{"id": "x"}],
    }
    with pytest.raises(PermissionError, match="poemma_forbidden_owner_namespace"):
        merge_poemma_storage_payload_for_role(
            role="team",
            mutation="saveInitiative",
            existing=existing,
            incoming=incoming,
        )


def test_merge_team_cannot_introduce_owner_namespace() -> None:
    existing = {"poemma:v1:user-a:initiatives:p1": []}
    incoming = {
        "poemma:v1:user-a:initiatives:p1": [{"id": "x"}],
        "poemma:v1:user-a:org": {"id": "stolen"},
    }
    with pytest.raises(PermissionError, match="poemma_forbidden_owner_namespace"):
        merge_poemma_storage_payload_for_role(
            role="manager",
            mutation="saveInitiative",
            existing=existing,
            incoming=incoming,
        )


def test_merge_owner_full_replace() -> None:
    existing = {"poemma:v1:user-a:finance:p1": {"revenue": 1}}
    incoming = {"poemma:v1:user-a:org": {"id": "org-1"}}
    merged = merge_poemma_storage_payload_for_role(
        role="owner",
        mutation="saveOrg",
        existing=existing,
        incoming=incoming,
    )
    assert merged == incoming


def test_validate_poemma_backup_payload_rejects_foreign_user() -> None:
    actor_user_id = uuid4()
    backup = {
        "version": "v1",
        "userId": "foreign-user",
        "entries": {},
    }
    with pytest.raises(ValueError, match="poemma_backup_wrong_user"):
        validate_poemma_backup_payload(backup, actor_user_id)
