# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Realtor Pro domain: showings tasks.
# Invariants:
# - Every mutation checks ownership via user_id on the owning row.
# - Read helpers return [] when the parent row is not owned.
# Related:
# - api/services/professional_worlds/realtor_pro.py
# - api/services/professional_worlds/service_realtor_delegations.py
# ---

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.services.professional_worlds.realtor_pro_common import _json, _rows
from api.services.professional_worlds.realtor_pro_ownership import (
    _client_owned,
    _deal_owned,
    _property_owned,
    _showing_owned,
)

_SHOWING_COLUMNS = (
    "id, user_id, property_id, client_id, scheduled_at, status, notes, "
    "duration_minutes, location_notes, deal_id, created_at, updated_at"
)


async def list_property_showings(
    db: AsyncSession,
    user_id: UUID,
    *,
    property_id: UUID | None = None,
    scheduled_from=None,
    scheduled_to=None,
) -> list[dict[str, Any]]:
    clauses = ["user_id = :uid"]
    params: dict[str, Any] = {"uid": user_id}
    if property_id is not None:
        clauses.append("property_id = :pid")
        params["pid"] = property_id
    if scheduled_from is not None:
        clauses.append("scheduled_at >= :sf")
        params["sf"] = scheduled_from
    if scheduled_to is not None:
        clauses.append("scheduled_at <= :st")
        params["st"] = scheduled_to
    where_sql = " AND ".join(clauses)
    result = await db.execute(
        text(
            f"""
            SELECT {_SHOWING_COLUMNS}
            FROM realtor_property_showings
            WHERE {where_sql}
            ORDER BY scheduled_at ASC
            """
        ),
        params,
    )
    return _rows(list(result.mappings().all()))


async def get_property_showing(db: AsyncSession, user_id: UUID, showing_id: UUID) -> dict[str, Any] | None:
    result = await db.execute(
        text(
            f"""
            SELECT {_SHOWING_COLUMNS}
            FROM realtor_property_showings
            WHERE id = :sid AND user_id = :uid
            """
        ),
        {"sid": showing_id, "uid": user_id},
    )
    row = result.mappings().one_or_none()
    return dict(row) if row else None


async def create_property_showing(
    db: AsyncSession,
    user_id: UUID,
    *,
    property_id: UUID,
    client_id: UUID | None,
    scheduled_at,
    status: str,
    notes: str | None,
    duration_minutes: int | None,
    location_notes: str | None,
    deal_id: UUID | None,
) -> dict[str, Any] | None:
    if not await _property_owned(db, user_id, property_id):
        return None
    if client_id is not None and not await _client_owned(db, user_id, client_id):
        return None
    if deal_id is not None and not await _deal_owned(db, user_id, deal_id):
        return None
    result = await db.execute(
        text(
            f"""
            INSERT INTO realtor_property_showings (
                user_id, property_id, client_id, scheduled_at, status, notes,
                duration_minutes, location_notes, deal_id
            )
            VALUES (
                :uid, :pid, :cid, :sched, :st, :notes,
                :dur, :loc, :did
            )
            RETURNING {_SHOWING_COLUMNS}
            """
        ),
        {
            "uid": user_id,
            "pid": property_id,
            "cid": client_id,
            "sched": scheduled_at,
            "st": status,
            "notes": notes,
            "dur": duration_minutes,
            "loc": location_notes,
            "did": deal_id,
        },
    )
    await db.commit()
    return dict(result.mappings().one())


async def update_property_showing(
    db: AsyncSession,
    user_id: UUID,
    showing_id: UUID,
    *,
    scheduled_at=None,
    status: str | None = None,
    notes: str | None = None,
    duration_minutes: int | None = None,
    location_notes: str | None = None,
    client_id: UUID | None = None,
    deal_id: UUID | None = None,
    unset_client: bool = False,
    unset_deal: bool = False,
) -> dict[str, Any] | None:
    cur = await db.execute(
        text(
            f"""
            SELECT {_SHOWING_COLUMNS}
            FROM realtor_property_showings
            WHERE id = :sid AND user_id = :uid
            """
        ),
        {"sid": showing_id, "uid": user_id},
    )
    row = cur.mappings().one_or_none()
    if row is None:
        return None
    data = dict(row)
    if scheduled_at is not None:
        data["scheduled_at"] = scheduled_at
    if status is not None:
        data["status"] = status
    if notes is not None:
        data["notes"] = notes
    if duration_minutes is not None:
        data["duration_minutes"] = duration_minutes
    if location_notes is not None:
        data["location_notes"] = location_notes
    if unset_client:
        data["client_id"] = None
    elif client_id is not None:
        if not await _client_owned(db, user_id, client_id):
            return None
        data["client_id"] = client_id
    if unset_deal:
        data["deal_id"] = None
    elif deal_id is not None:
        if not await _deal_owned(db, user_id, deal_id):
            return None
        data["deal_id"] = deal_id

    res = await db.execute(
        text(
            f"""
            UPDATE realtor_property_showings
            SET scheduled_at = :sched, status = :st, notes = :notes,
                duration_minutes = :dur, location_notes = :loc,
                client_id = :cid, deal_id = :did, updated_at = now()
            WHERE id = :sid AND user_id = :uid
            RETURNING {_SHOWING_COLUMNS}
            """
        ),
        {
            "sid": showing_id,
            "uid": user_id,
            "sched": data["scheduled_at"],
            "st": data["status"],
            "notes": data["notes"],
            "dur": data["duration_minutes"],
            "loc": data["location_notes"],
            "cid": data["client_id"],
            "did": data["deal_id"],
        },
    )
    await db.commit()
    out = res.mappings().one_or_none()
    return dict(out) if out else None


async def delete_property_showing(db: AsyncSession, user_id: UUID, showing_id: UUID) -> bool:
    res = await db.execute(
        text(
            """
            DELETE FROM realtor_property_showings
            WHERE id = :sid AND user_id = :uid
            RETURNING id
            """
        ),
        {"sid": showing_id, "uid": user_id},
    )
    await db.commit()
    return res.mappings().first() is not None


# --- Realtor tasks ---


_TASK_COLUMNS = (
    "id, user_id, title, status, priority, due_at, reminder_at, next_action, notes, "
    "property_id, client_id, showing_id, deal_id, task_meta, created_at, updated_at"
)


async def list_realtor_tasks(
    db: AsyncSession,
    user_id: UUID,
    *,
    status: str | None = None,
    property_id: UUID | None = None,
    due_before=None,
    due_after=None,
) -> list[dict[str, Any]]:
    clauses = ["user_id = :uid"]
    params: dict[str, Any] = {"uid": user_id}
    if status is not None:
        clauses.append("status = :st")
        params["st"] = status
    if property_id is not None:
        clauses.append("property_id = :pid")
        params["pid"] = property_id
    if due_before is not None:
        clauses.append("(due_at IS NOT NULL AND due_at <= :db)")
        params["db"] = due_before
    if due_after is not None:
        clauses.append("(due_at IS NOT NULL AND due_at >= :da)")
        params["da"] = due_after
    where_sql = " AND ".join(clauses)
    result = await db.execute(
        text(
            f"""
            SELECT {_TASK_COLUMNS}
            FROM realtor_tasks
            WHERE {where_sql}
            ORDER BY due_at NULLS LAST, updated_at DESC
            """
        ),
        params,
    )
    return _rows(list(result.mappings().all()))


async def get_realtor_task(db: AsyncSession, user_id: UUID, task_id: UUID) -> dict[str, Any] | None:
    result = await db.execute(
        text(
            f"""
            SELECT {_TASK_COLUMNS}
            FROM realtor_tasks
            WHERE id = :tid AND user_id = :uid
            """
        ),
        {"tid": task_id, "uid": user_id},
    )
    row = result.mappings().one_or_none()
    return dict(row) if row else None


async def create_realtor_task(
    db: AsyncSession,
    user_id: UUID,
    *,
    title: str,
    status: str,
    priority: str,
    due_at,
    reminder_at,
    next_action: str | None,
    notes: str | None,
    property_id: UUID | None,
    client_id: UUID | None,
    showing_id: UUID | None,
    deal_id: UUID | None,
    task_meta: dict[str, Any],
) -> dict[str, Any] | None:
    if property_id is not None and not await _property_owned(db, user_id, property_id):
        return None
    if client_id is not None and not await _client_owned(db, user_id, client_id):
        return None
    if deal_id is not None and not await _deal_owned(db, user_id, deal_id):
        return None
    if showing_id is not None and not await _showing_owned(db, user_id, showing_id):
        return None
    result = await db.execute(
        text(
            f"""
            INSERT INTO realtor_tasks (
                user_id, title, status, priority, due_at, reminder_at, next_action, notes,
                property_id, client_id, showing_id, deal_id, task_meta
            )
            VALUES (
                :uid, :title, :status, :prio, :due_at, :rem_at, :next_action, :notes,
                :pid, :cid, :sid, :did, CAST(:meta AS jsonb)
            )
            RETURNING {_TASK_COLUMNS}
            """
        ),
        {
            "uid": user_id,
            "title": title,
            "status": status,
            "prio": priority,
            "due_at": due_at,
            "rem_at": reminder_at,
            "next_action": next_action,
            "notes": notes,
            "pid": property_id,
            "cid": client_id,
            "sid": showing_id,
            "did": deal_id,
            "meta": _json(task_meta),
        },
    )
    await db.commit()
    return dict(result.mappings().one())


async def update_realtor_task(
    db: AsyncSession,
    user_id: UUID,
    task_id: UUID,
    *,
    title: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    due_at=None,
    reminder_at=None,
    next_action: str | None = None,
    notes: str | None = None,
    property_id: UUID | None = None,
    client_id: UUID | None = None,
    showing_id: UUID | None = None,
    deal_id: UUID | None = None,
    task_meta: dict[str, Any] | None = None,
    unset_property: bool = False,
    unset_client: bool = False,
    unset_showing: bool = False,
    unset_deal: bool = False,
) -> dict[str, Any] | None:
    cur = await db.execute(
        text(
            f"""
            SELECT {_TASK_COLUMNS}
            FROM realtor_tasks
            WHERE id = :tid AND user_id = :uid
            """
        ),
        {"tid": task_id, "uid": user_id},
    )
    row = cur.mappings().one_or_none()
    if row is None:
        return None
    data = dict(row)
    if title is not None:
        data["title"] = title
    if status is not None:
        data["status"] = status
    if priority is not None:
        data["priority"] = priority
    if due_at is not None:
        data["due_at"] = due_at
    if reminder_at is not None:
        data["reminder_at"] = reminder_at
    if next_action is not None:
        data["next_action"] = next_action
    if notes is not None:
        data["notes"] = notes
    if unset_property:
        data["property_id"] = None
    elif property_id is not None:
        if not await _property_owned(db, user_id, property_id):
            return None
        data["property_id"] = property_id
    if unset_client:
        data["client_id"] = None
    elif client_id is not None:
        if not await _client_owned(db, user_id, client_id):
            return None
        data["client_id"] = client_id
    if unset_showing:
        data["showing_id"] = None
    elif showing_id is not None:
        if not await _showing_owned(db, user_id, showing_id):
            return None
        data["showing_id"] = showing_id
    if unset_deal:
        data["deal_id"] = None
    elif deal_id is not None:
        if not await _deal_owned(db, user_id, deal_id):
            return None
        data["deal_id"] = deal_id
    if task_meta is not None:
        data["task_meta"] = task_meta

    res = await db.execute(
        text(
            f"""
            UPDATE realtor_tasks
            SET title = :title, status = :status, priority = :prio,
                due_at = :due_at, reminder_at = :rem_at,
                next_action = :next_action, notes = :notes,
                property_id = :pid, client_id = :cid, showing_id = :sid, deal_id = :did,
                task_meta = CAST(:meta AS jsonb), updated_at = now()
            WHERE id = :tid AND user_id = :uid
            RETURNING {_TASK_COLUMNS}
            """
        ),
        {
            "tid": task_id,
            "uid": user_id,
            "title": data["title"],
            "status": data["status"],
            "prio": data["priority"],
            "due_at": data["due_at"],
            "rem_at": data["reminder_at"],
            "next_action": data["next_action"],
            "notes": data["notes"],
            "pid": data["property_id"],
            "cid": data["client_id"],
            "sid": data["showing_id"],
            "did": data["deal_id"],
            "meta": _json(data["task_meta"]),
        },
    )
    await db.commit()
    out = res.mappings().one_or_none()
    return dict(out) if out else None


async def delete_realtor_task(db: AsyncSession, user_id: UUID, task_id: UUID) -> bool:
    res = await db.execute(
        text(
            """
            DELETE FROM realtor_tasks
            WHERE id = :tid AND user_id = :uid
            RETURNING id
            """
        ),
        {"tid": task_id, "uid": user_id},
    )
    await db.commit()
    return res.mappings().first() is not None
