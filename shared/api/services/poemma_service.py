# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Server-side POEMMA workspace service: load/save snapshot payload, membership roles and ACL gates.
# Invariants:
# - Non-owner roles cannot persist owner-only mutations.
# - Non-owner PUT merges only mutation-scoped keys; owner-namespace value changes → 403.
# - Workspace is lazily created for the actor on first write.
# - Backup import accepts only scoped entries from the current user.
# - PATCH role: only workspace owner or platform admin/emperyworld_admin (no self-escalation).
# Related:
# - api/routers/poemma.py
# - api/models/poemma.py
# - documentation/product/desktop/DESKTOP-API-AND-APPS.md
# ---

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.poemma import PoemmaWorkspace, PoemmaWorkspaceMembership
from api.utils.datetime_helpers import utc_now_naive

POEMMA_ALLOWED_ROLES = {"owner", "team", "manager", "smm", "production"}

POEMMA_OWNER_ONLY_MUTATIONS = {
    "activatePeriod",
    "closeActivePeriod",
    "initializeWorkspace",
    "saveChannels",
    "saveFinanceSnapshot",
    "saveOrg",
    "saveOrgSettings",
    "savePeriod",
    "savePeriodGoal",
    "savePeriodReview",
    "savePromotion",
    "saveSegments",
    "saveUtmLink",
}

POEMMA_TEAM_MUTATIONS = {
    "saveCustomerPath",
    "saveHappinessSignal",
    "deleteHappinessSignal",
    "saveInitiative",
    "saveStrategy",
    "saveTeamTask",
}

# Storage key shape: ``poemma:v1:{userId}:{namespace}…`` (see FE ``buildPoemmaStorageKeys``).
# Only these namespaces may be written by non-owner collaborative mutations.
POEMMA_TEAM_STORAGE_NAMESPACES = frozenset(
    {
        "customer-path",
        "happiness-signals",
        "initiatives",
        "strategy",
        "teamTasks",
    }
)

POEMMA_MUTATION_ALLOWED_NAMESPACES: dict[str, frozenset[str]] = {
    "saveCustomerPath": frozenset({"customer-path"}),
    "saveHappinessSignal": frozenset({"happiness-signals"}),
    "deleteHappinessSignal": frozenset({"happiness-signals"}),
    "saveInitiative": frozenset({"initiatives"}),
    "saveStrategy": frozenset({"strategy"}),
    "saveTeamTask": frozenset({"teamTasks"}),
}


@dataclass(slots=True)
class PoemmaWorkspaceState:
    workspace: PoemmaWorkspace | None
    role: str


def normalize_poemma_role(role: str | None) -> str:
    normalized = str(role or "").strip().lower()
    if normalized in POEMMA_ALLOWED_ROLES:
        return normalized
    return "team"


def resolve_poemma_default_role(platform_role: str | None) -> str:
    normalized = str(platform_role or "").strip().lower()
    if normalized in {"admin", "emperyworld_admin"}:
        return "owner"
    if normalized == "ai_agent":
        return "manager"
    return "team"


def can_poemma_role_mutate(role: str, mutation: str | None) -> bool:
    normalized_role = normalize_poemma_role(role)
    if normalized_role == "owner":
        return True
    if mutation is None:
        return False
    if mutation in POEMMA_OWNER_ONLY_MUTATIONS:
        return False
    if mutation in POEMMA_TEAM_MUTATIONS:
        return normalized_role in {"team", "manager", "smm", "production"}
    # Unknown mutation names are treated as privileged writes.
    return False


def is_poemma_platform_admin(platform_role: str | None) -> bool:
    normalized = str(platform_role or "").strip().lower()
    return normalized in {"admin", "emperyworld_admin"}


def can_poemma_actor_change_role(
    *,
    actor_user_id: UUID,
    workspace: PoemmaWorkspace | None,
    platform_role: str | None,
) -> bool:
    """Who may PATCH membership role for the actor on this workspace."""
    if is_poemma_platform_admin(platform_role):
        return True
    if workspace is None:
        # Lazy bootstrap: first writer becomes workspace owner_user_id.
        return True
    # Runtime value is UUID; Mapped/Column stubs type ``==`` as ColumnElement[bool].
    return UUID(str(workspace.owner_user_id)) == actor_user_id


def _normalize_storage_payload(storage_payload: Mapping[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for raw_key, value in storage_payload.items():
        key = str(raw_key or "").strip()
        if not key:
            continue
        normalized[key] = value
    return normalized


def poemma_storage_key_namespace(key: str) -> str:
    """Return namespace segment after ``poemma:v1:{userId}:``; empty if malformed."""
    parts = str(key or "").split(":")
    if len(parts) < 4 or parts[0] != "poemma":
        return ""
    return parts[3]


def is_poemma_owner_protected_namespace(namespace: str) -> bool:
    """Any non-team collaborative namespace is owner-protected (incl. unknown)."""
    ns = str(namespace or "").strip()
    if not ns:
        return True
    return ns not in POEMMA_TEAM_STORAGE_NAMESPACES


def merge_poemma_storage_payload_for_role(
    *,
    role: str,
    mutation: str | None,
    existing: Mapping[str, Any] | None,
    incoming: Mapping[str, Any],
) -> dict[str, Any]:
    """
    Owner: full replace with normalized incoming.
    Non-owner: reject owner-namespace value/key introductions that differ from
    server; merge only keys allowed for ``mutation``.
    """
    incoming_n = _normalize_storage_payload(incoming)
    existing_n = _normalize_storage_payload(existing or {})
    if normalize_poemma_role(role) == "owner":
        return incoming_n

    mutation_name = str(mutation or "").strip()
    allowed_ns = POEMMA_MUTATION_ALLOWED_NAMESPACES.get(mutation_name, frozenset())

    for key, new_val in incoming_n.items():
        ns = poemma_storage_key_namespace(key)
        if not is_poemma_owner_protected_namespace(ns):
            continue
        if key not in existing_n or existing_n[key] != new_val:
            raise PermissionError("poemma_forbidden_owner_namespace")

    merged = dict(existing_n)
    for key, new_val in incoming_n.items():
        ns = poemma_storage_key_namespace(key)
        if ns in allowed_ns:
            merged[key] = new_val
    for key in list(merged.keys()):
        ns = poemma_storage_key_namespace(key)
        if ns in allowed_ns and key not in incoming_n:
            del merged[key]
    return merged


def extract_poemma_org_id_from_payload(storage_payload: Mapping[str, Any]) -> str | None:
    for key, value in storage_payload.items():
        if not isinstance(key, str):
            continue
        if not key.endswith(":org"):
            continue
        if isinstance(value, Mapping):
            candidate = str(value.get("id", "")).strip()
            if candidate:
                return candidate
    return None


async def _resolve_membership_rows(
    db: AsyncSession,
    actor_user_id: UUID,
) -> list[tuple[PoemmaWorkspaceMembership, PoemmaWorkspace]]:
    result = await db.execute(
        select(PoemmaWorkspaceMembership, PoemmaWorkspace)
        .join(
            PoemmaWorkspace,
            PoemmaWorkspace.id == PoemmaWorkspaceMembership.workspace_id,
        )
        .where(PoemmaWorkspaceMembership.user_id == actor_user_id)
    )
    rows = result.all()
    return [(membership, workspace) for membership, workspace in rows]


def _pick_workspace_row(
    rows: list[tuple[PoemmaWorkspaceMembership, PoemmaWorkspace]],
    actor_user_id: UUID,
) -> tuple[PoemmaWorkspaceMembership, PoemmaWorkspace] | None:
    if not rows:
        return None
    for membership, workspace in rows:
        if workspace.owner_user_id == actor_user_id:
            return membership, workspace
    return rows[0]


async def _ensure_owner_membership(
    db: AsyncSession,
    workspace: PoemmaWorkspace,
) -> None:
    result = await db.execute(
        select(PoemmaWorkspaceMembership).where(
            PoemmaWorkspaceMembership.workspace_id == workspace.id,
            PoemmaWorkspaceMembership.user_id == workspace.owner_user_id,
        )
    )
    membership = result.scalar_one_or_none()
    if membership is not None:
        if membership.role != "owner":
            membership.role = "owner"  # type: ignore[assignment]
            membership.updated_at = utc_now_naive()  # type: ignore[assignment]
        return

    db.add(
        PoemmaWorkspaceMembership(
            workspace_id=workspace.id,
            user_id=workspace.owner_user_id,
            role="owner",
        )
    )


async def resolve_poemma_workspace_state(
    db: AsyncSession,
    actor_user_id: UUID,
    platform_role: str | None,
) -> PoemmaWorkspaceState:
    rows = await _resolve_membership_rows(db, actor_user_id)
    selected = _pick_workspace_row(rows, actor_user_id)
    if selected is not None:
        membership, workspace = selected
        return PoemmaWorkspaceState(
            workspace=workspace,
            role=normalize_poemma_role(membership.role),
        )

    result = await db.execute(select(PoemmaWorkspace).where(PoemmaWorkspace.owner_user_id == actor_user_id))
    owned_workspace = result.scalar_one_or_none()
    if owned_workspace is not None:
        await _ensure_owner_membership(db, owned_workspace)
        await db.flush()
        return PoemmaWorkspaceState(workspace=owned_workspace, role="owner")

    return PoemmaWorkspaceState(
        workspace=None,
        role=resolve_poemma_default_role(platform_role),
    )


async def upsert_poemma_workspace_payload(
    db: AsyncSession,
    actor_user_id: UUID,
    platform_role: str | None,
    storage_payload: Mapping[str, Any],
    payload_version: str = "v1",
    org_id: str | None = None,
    mutation: str | None = None,
    migrated_from_local: bool = False,
) -> PoemmaWorkspaceState:
    state = await resolve_poemma_workspace_state(db, actor_user_id, platform_role)
    workspace = state.workspace
    role = state.role

    if workspace is None:
        fallback_org = org_id or extract_poemma_org_id_from_payload(storage_payload)
        workspace = PoemmaWorkspace(
            owner_user_id=actor_user_id,
            org_id=fallback_org or f"org-{actor_user_id}",
            payload_version=(payload_version or "v1").strip() or "v1",
            storage_payload={},
            migrated_from_local=False,
        )
        db.add(workspace)
        await db.flush()
        db.add(
            PoemmaWorkspaceMembership(
                workspace_id=workspace.id,
                user_id=actor_user_id,
                role="owner",
            )
        )
        role = "owner"

    if not can_poemma_role_mutate(role, mutation):
        raise PermissionError("poemma_forbidden_mutation")

    existing_payload = workspace.storage_payload if isinstance(workspace.storage_payload, Mapping) else {}
    workspace.payload_version = (payload_version or "v1").strip() or "v1"  # type: ignore[assignment]
    merged = merge_poemma_storage_payload_for_role(
        role=role,
        mutation=mutation,
        existing=existing_payload,
        incoming=storage_payload,
    )
    if str(mutation or "").strip() == "saveFinanceSnapshot":
        from api.services.poemma_profit_plan import enrich_poemma_finance_snapshots_in_payload

        merged = enrich_poemma_finance_snapshots_in_payload(merged)
    workspace.storage_payload = merged  # type: ignore[assignment]
    if org_id:
        workspace.org_id = org_id.strip() or workspace.org_id  # type: ignore[assignment]
    elif not workspace.org_id:
        extracted_org = extract_poemma_org_id_from_payload(workspace.storage_payload)
        workspace.org_id = extracted_org or f"org-{workspace.owner_user_id}"  # type: ignore[assignment]
    if migrated_from_local:
        workspace.migrated_from_local = True  # type: ignore[assignment]
    workspace.updated_at = utc_now_naive()  # type: ignore[assignment]

    await _ensure_owner_membership(db, workspace)
    await db.commit()
    await db.refresh(workspace)

    return PoemmaWorkspaceState(workspace=workspace, role=role)


async def update_poemma_actor_role(
    db: AsyncSession,
    actor_user_id: UUID,
    platform_role: str | None,
    next_role: str,
) -> PoemmaWorkspaceState:
    normalized_next_role = str(next_role or "").strip().lower()
    if normalized_next_role not in POEMMA_ALLOWED_ROLES:
        raise ValueError("poemma_invalid_role")

    state = await resolve_poemma_workspace_state(db, actor_user_id, platform_role)
    workspace = state.workspace
    if not can_poemma_actor_change_role(
        actor_user_id=actor_user_id,
        workspace=workspace,
        platform_role=platform_role,
    ):
        raise PermissionError("poemma_forbidden_role_change")

    if workspace is None:
        workspace = PoemmaWorkspace(
            owner_user_id=actor_user_id,
            org_id=f"org-{actor_user_id}",
            payload_version="v1",
            storage_payload={},
        )
        db.add(workspace)
        await db.flush()

    result = await db.execute(
        select(PoemmaWorkspaceMembership).where(
            PoemmaWorkspaceMembership.workspace_id == workspace.id,
            PoemmaWorkspaceMembership.user_id == actor_user_id,
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        membership = PoemmaWorkspaceMembership(
            workspace_id=workspace.id,
            user_id=actor_user_id,
            role=normalized_next_role,
        )
        db.add(membership)
    else:
        membership.role = normalized_next_role  # type: ignore[assignment]
        membership.updated_at = utc_now_naive()  # type: ignore[assignment]

    await _ensure_owner_membership(db, workspace)
    await db.commit()
    await db.refresh(workspace)
    return PoemmaWorkspaceState(workspace=workspace, role=normalized_next_role)


def validate_poemma_backup_payload(
    backup_payload: Mapping[str, Any],
    actor_user_id: UUID,
) -> dict[str, Any]:
    user_id = str(backup_payload.get("userId", "")).strip()
    if user_id and user_id != str(actor_user_id):
        raise ValueError("poemma_backup_wrong_user")

    entries_raw = backup_payload.get("entries")
    if not isinstance(entries_raw, Mapping):
        raise ValueError("poemma_backup_entries_required")
    return _normalize_storage_payload(entries_raw)
