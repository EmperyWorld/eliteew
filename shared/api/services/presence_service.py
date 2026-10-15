#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Redis-backed online presence registry for Socket.IO sessions with per-user channel split (web/mobile).
# Invariants:
# - Presence failures must degrade gracefully (no hard crash of realtime connect/disconnect flow).
# - Channel counters (`sessions_web` / `sessions_mobile`) must classify legacy sid records consistently.
# Related:
# - api.routers.socketio_handler
# - api.routers.desktop_admin
# - documentation/platform/docker-re_doc/KEYCLOAK-ELITEEW.md
# ---
"""
Онлайн-присутствие пользователей портала (Socket.IO).

Хранение в Redis (DB 0): сессии по sid, множество sid на пользователя, множество user_id в сети,
JSON-метаданные. Подключение/отключение и heartbeat не должны ломать сокет при сбое Redis.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any

logger = logging.getLogger(__name__)

_socketio_sid_live_checker: Callable[[str], Awaitable[bool]] | None = None


def register_socketio_sid_live_checker(
    checker: Callable[[str], Awaitable[bool]] | None,
) -> None:
    """Optional hook from ``socketio_handler`` to steal lease from dead Engine.IO sessions."""

    global _socketio_sid_live_checker
    _socketio_sid_live_checker = checker


async def _holder_sid_is_live(holder: str) -> bool:
    if not _socketio_sid_live_checker:
        return True
    try:
        return await _socketio_sid_live_checker(holder)
    except Exception:
        logger.debug("holder_sid_is_live checker failed sid=%s", holder, exc_info=True)
        return True


P = "presence:v1"
# Heartbeat ~60s на клиенте; запас на потерю пакетов
_SID_TTL_SEC = 400
# Single browser Socket.IO lease (SET NX) — closes connect race for multi-tab
_BROWSER_LEASE_TTL_SEC = 120
# Последняя активность socket (ISO с Z) для офлайн-пользователей в админке; meta удаляется при disconnect
_LAST_SEEN_TTL_SEC = 30 * 86400


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _k_sid(sid: str) -> str:
    return f"{P}:sid:{sid}"


def _k_sids(uid: str) -> str:
    return f"{P}:user:{uid}:sids"


def _k_online() -> str:
    return f"{P}:online"


def _k_meta(uid: str) -> str:
    return f"{P}:meta:{uid}"


def _k_last_seen(uid: str) -> str:
    return f"{P}:last_seen:{uid}"


def _k_browser_lease(uid: str) -> str:
    return f"{P}:browser_lease:{uid}"


def encode_presence_sid_record(
    uid: str,
    *,
    client_class: str | None = None,
    user_agent: str | None = None,
    client_id: str | None = None,
) -> str:
    """Redis value for `presence:v1:sid:{sid}`; plain uid string kept for legacy readers."""

    user_id = str(uid).strip()
    if not client_class and not user_agent and not client_id:
        return user_id
    payload: dict[str, Any] = {"uid": user_id}
    if client_class:
        payload["client_class"] = client_class
    if client_id:
        payload["client_id"] = client_id
    if user_agent:
        payload["user_agent"] = str(user_agent)[:256]
    return json.dumps(payload, ensure_ascii=False)


def decode_presence_sid_record(raw: Any) -> dict[str, Any]:
    """Parse sid record (legacy uid string or JSON with uid + channel metadata)."""

    if raw is None:
        return {"uid": "", "client_class": None, "user_agent": None, "client_id": None}
    text = raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else str(raw)
    if text.startswith("{"):
        try:
            data = json.loads(text)
            if isinstance(data, dict) and str(data.get("uid") or "").strip():
                return {
                    "uid": str(data["uid"]).strip(),
                    "client_class": data.get("client_class"),
                    "user_agent": data.get("user_agent"),
                    "client_id": data.get("client_id"),
                }
        except (json.JSONDecodeError, TypeError):  # fmt: skip
            pass
    return {"uid": text.strip(), "client_class": None, "user_agent": None, "client_id": None}


def is_browser_presence_session(detail: dict[str, Any]) -> bool:
    """True for SPA/desktop web Socket.IO (empery-web), not native mobile GAF."""

    cc = str(detail.get("client_class") or "").strip().lower()
    cid = str(detail.get("client_id") or "").strip().lower()
    if cc == "mobile" or cid == "empery-mobile":
        return False
    if cc == "browser" or cid == "empery-web":
        return True
    # Legacy sid records without metadata come from web SPA connects.
    return cc == "" and cid == ""


async def try_claim_browser_socket_lease(user_id: str, sid: str) -> bool:
    """Atomically claim the single browser Socket.IO lease for user (SET NX)."""

    uid = str(user_id or "").strip()
    sid_value = str(sid or "").strip()
    if not uid or not sid_value:
        return False
    try:
        r = await _redis()
        if not r:
            return True
        key = _k_browser_lease(uid)
        claimed = await r.set(key, sid_value, nx=True, ex=_BROWSER_LEASE_TTL_SEC)
        if claimed:
            return True
        raw = await r.get(key)
        holder = raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else str(raw or "")
        if holder == sid_value:
            await r.expire(key, _BROWSER_LEASE_TTL_SEC)
            return True
        if holder and not await r.exists(_k_sid(holder)):
            await r.set(key, sid_value, ex=_BROWSER_LEASE_TTL_SEC)
            return True
        if holder and not await _holder_sid_is_live(holder):
            await r.set(key, sid_value, ex=_BROWSER_LEASE_TTL_SEC)
            logger.info(
                "browser socket lease stolen from dead sid holder=%s new=%s user=%s",
                holder,
                sid_value,
                uid,
            )
            return True
        return False
    except Exception:
        logger.debug("try_claim_browser_socket_lease failed", exc_info=True)
        return True


async def force_claim_browser_socket_lease(user_id: str, sid: str) -> None:
    """Overwrite browser Socket.IO lease so the newest connect wins (supersede older sids)."""

    uid = str(user_id or "").strip()
    sid_value = str(sid or "").strip()
    if not uid or not sid_value:
        return
    try:
        r = await _redis()
        if not r:
            return
        await r.set(_k_browser_lease(uid), sid_value, ex=_BROWSER_LEASE_TTL_SEC)
        logger.info(
            "browser socket lease force-claimed sid=%s user=%s",
            sid_value,
            uid,
        )
    except Exception:
        logger.debug("force_claim_browser_socket_lease failed", exc_info=True)


async def get_browser_socket_lease_sid(user_id: str) -> str | None:
    uid = str(user_id or "").strip()
    if not uid:
        return None
    try:
        r = await _redis()
        if not r:
            return None
        raw = await r.get(_k_browser_lease(uid))
        if not raw:
            return None
        sid = raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else str(raw)
        return sid.strip() or None
    except Exception:
        logger.debug("get_browser_socket_lease_sid failed", exc_info=True)
        return None


async def release_browser_socket_lease(user_id: str, sid: str) -> None:
    uid = str(user_id or "").strip()
    sid_value = str(sid or "").strip()
    if not uid or not sid_value:
        return
    try:
        r = await _redis()
        if not r:
            return
        key = _k_browser_lease(uid)
        raw = await r.get(key)
        if not raw:
            return
        holder = raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else str(raw)
        if holder == sid_value:
            await r.delete(key)
    except Exception:
        logger.debug("release_browser_socket_lease failed", exc_info=True)


async def list_live_browser_presence_sids(user_id: str) -> list[str]:
    """Prune stale entries, then return live browser-class Socket.IO sids for user."""

    uid = str(user_id or "").strip()
    if not uid:
        return []
    try:
        r = await _redis()
        if not r:
            return []
        await _prune_stale_presence_sids(r, uid)
    except Exception:
        logger.debug("list_live_browser_presence_sids prune failed", exc_info=True)
    details = await get_active_sid_details_for_presence_user(uid)
    out: list[str] = []
    for detail in details:
        sid = str(detail.get("sid") or "").strip()
        if sid and is_browser_presence_session(detail):
            out.append(sid)
    return out


async def browser_presence_sids_to_supersede(user_id: str, keep_sid: str) -> list[str]:
    """Older browser-class Socket.IO sids to disconnect when enforcing one web realtime per user."""

    keep = str(keep_sid or "").strip()
    uid = str(user_id or "").strip()
    if not uid or not keep:
        return []
    details = await get_active_sid_details_for_presence_user(uid)
    out: list[str] = []
    for detail in details:
        sid = str(detail.get("sid") or "").strip()
        if not sid or sid == keep:
            continue
        if is_browser_presence_session(detail):
            out.append(sid)
    return out


async def _persist_last_seen_snapshot(r: Any, uid: str, iso_str: str) -> None:
    if not iso_str or not uid:
        return
    await r.setex(_k_last_seen(uid), _LAST_SEEN_TTL_SEC, iso_str)


async def _redis() -> Any:
    from api.core.database_manager import get_database_manager

    manager = await get_database_manager()
    return await manager.get_redis_client()


async def get_active_sid_details_for_presence_user(user_id: str) -> list[dict[str, Any]]:
    """Live Socket.IO sessions with optional channel metadata (browser/mobile)."""

    if not user_id or not str(user_id).strip():
        return []
    try:
        r = await _redis()
        if not r:
            return []
        uid = str(user_id).strip()
        raw_sids = await r.smembers(_k_sids(uid))
        if not raw_sids:
            return []
        out: list[dict[str, Any]] = []
        for rs in raw_sids:
            sid = rs.decode("utf-8") if isinstance(rs, (bytes, bytearray)) else str(rs)
            raw_val = await r.get(_k_sid(sid))
            if not raw_val:
                continue
            rec = decode_presence_sid_record(raw_val)
            if rec.get("uid") != uid:
                continue
            out.append(
                {
                    "sid": sid,
                    "client_class": rec.get("client_class"),
                    "user_agent": rec.get("user_agent"),
                    "client_id": rec.get("client_id"),
                }
            )
        return out
    except Exception:
        logger.debug("get_active_sid_details_for_presence_user failed", exc_info=True)
        return []


def _presence_last_seen_age_sec(last_seen_at: Any) -> float | None:
    text = str(last_seen_at or "").strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return max(0.0, (datetime.now(UTC) - dt).total_seconds())
    except ValueError, TypeError:
        return None


async def mobile_socket_heartbeat_fresh(user_id: str, *, max_age_sec: int = 90) -> bool:
    """True when a live mobile Socket.IO session refreshed presence heartbeat recently."""

    uid = str(user_id or "").strip()
    if not uid or max_age_sec <= 0:
        return False
    details = await get_active_sid_details_for_presence_user(uid)
    if not any(not is_browser_presence_session(detail) for detail in details):
        return False
    try:
        r = await _redis()
        if not r:
            return False
        raw_meta = await r.get(_k_meta(uid))
        if not raw_meta:
            return False
        meta = json.loads(raw_meta)
        if not isinstance(meta, dict):
            return False
        age = _presence_last_seen_age_sec(meta.get("last_seen_at"))
        if age is None:
            return False
        return age <= float(max_age_sec)
    except json.JSONDecodeError, TypeError:
        return False
    except Exception:
        logger.debug("mobile_socket_heartbeat_fresh failed user=%s", uid[:8], exc_info=True)
        return False


async def get_active_sids_for_presence_user(user_id: str) -> list[str]:
    """Живые Socket.IO sid для канонического presence user_id (все realtime-клиенты)."""
    if not user_id or not str(user_id).strip():
        return []
    try:
        r = await _redis()
        if not r:
            return []
        uid = str(user_id).strip()
        raw_sids = await r.smembers(_k_sids(uid))
        if not raw_sids:
            return []
        out: list[str] = []
        for rs in raw_sids:
            sid = rs.decode("utf-8") if isinstance(rs, (bytes, bytearray)) else str(rs)
            if await r.exists(_k_sid(sid)):
                out.append(sid)
        return out
    except Exception:
        logger.debug("get_active_sids_for_presence_user failed", exc_info=True)
        return []


# Лимит команд админа: N запросов на окно (секунд), ключ Redis на admin_id
_ADMIN_CMD_RATE_MAX = 30
_ADMIN_CMD_RATE_WINDOW_SEC = 60


async def assert_presence_target_has_active_sessions(user_id: str) -> None:
    """400 если нет живых Socket.IO сессий (пользователь не в онлайне для presence)."""
    from fastapi import HTTPException, status

    sids = await get_active_sids_for_presence_user(user_id)
    if not sids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь не в списке онлайн или сессия уже закрыта. Обновите список.",
        )


async def assert_presence_admin_command_rate_limit(admin_id: str) -> None:
    """429 при превышении числа команд на окно времени (Redis)."""
    from fastapi import HTTPException, status

    aid = (admin_id or "").strip()
    if not aid:
        return
    try:
        r = await _redis()
        if not r:
            return
        key = f"{P}:admin_cmd_rl:{aid}"
        n = await r.incr(key)
        if n == 1:
            await r.expire(key, _ADMIN_CMD_RATE_WINDOW_SEC)
        if n > _ADMIN_CMD_RATE_MAX:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Слишком много команд. Подождите до минуты и повторите.",
            )
    except HTTPException:
        raise
    except Exception:
        logger.warning("presence admin command rate limit check failed", exc_info=True)


async def _prune_stale_presence_sids(r: Any, uid: str) -> None:
    """Remove sid entries whose TTL keys expired without a clean Socket.IO disconnect."""
    raw_sids = await r.smembers(_k_sids(uid))
    if not raw_sids:
        return
    for rs in raw_sids:
        sid = rs.decode("utf-8") if isinstance(rs, (bytes, bytearray)) else str(rs)
        if not await r.exists(_k_sid(sid)):
            await r.srem(_k_sids(uid), sid)


async def record_connect(
    sid: str,
    *,
    user_id: str,
    email: str | None,
    display_name: str | None,
    client_class: str | None = None,
    client_id: str | None = None,
    user_agent: str | None = None,
) -> None:
    """Зарегистрировать Socket.IO сессию; user_id — UUID из БД или Keycloak sub."""
    if not sid or not user_id:
        return
    try:
        r = await _redis()
        if not r:
            return
        uid = str(user_id).strip()
        sid_value = encode_presence_sid_record(
            uid,
            client_class=client_class,
            client_id=client_id,
            user_agent=user_agent,
        )
        pipe = r.pipeline(transaction=True)
        pipe.set(_k_sid(sid), sid_value, ex=_SID_TTL_SEC)
        pipe.sadd(_k_sids(uid), sid)
        pipe.sadd(_k_online(), uid)
        await pipe.execute()
        await _prune_stale_presence_sids(r, uid)

        raw_meta = await r.get(_k_meta(uid))
        now = _now_iso()
        if raw_meta:
            try:
                meta = json.loads(raw_meta)
            except (json.JSONDecodeError, TypeError):  # fmt: skip
                meta = {}
        else:
            meta = {}
        meta["user_id"] = uid
        meta["email"] = (email or "").strip() or None
        meta["display_name"] = (display_name or "").strip() or None
        meta["last_seen_at"] = now
        meta["sessions"] = int(await r.scard(_k_sids(uid)) or 0)
        if not meta.get("connected_at"):
            meta["connected_at"] = now
        await r.set(_k_meta(uid), json.dumps(meta, ensure_ascii=False))
        await _persist_last_seen_snapshot(r, uid, str(meta.get("last_seen_at") or now))
    except Exception:
        logger.debug("presence record_connect failed", exc_info=True)


async def get_collaborator_display_for_sid(sid: str) -> dict[str, str]:
    """Имя и email для Socket.IO doc editor: из Redis presence meta по sid."""
    out: dict[str, str] = {"username": "", "email": ""}
    if not sid or not str(sid).strip():
        return out
    try:
        r = await _redis()
        if not r:
            return out
        raw_val = await r.get(_k_sid(str(sid).strip()))
        if not raw_val:
            return out
        rec = decode_presence_sid_record(raw_val)
        uid = str(rec.get("uid") or "").strip()
        raw_meta = await r.get(_k_meta(uid))
        if not raw_meta:
            return out
        meta_str = raw_meta.decode("utf-8") if isinstance(raw_meta, (bytes, bytearray)) else str(raw_meta)
        meta = json.loads(meta_str)
    except Exception:
        logger.debug("get_collaborator_display_for_sid failed", exc_info=True)
        return out

    email = (meta.get("email") or "").strip() if isinstance(meta, dict) else ""
    display_name = (meta.get("display_name") or "").strip() if isinstance(meta, dict) else ""
    username = display_name or (email.split("@")[0] if email else "")
    out["email"] = email
    out["username"] = username
    return out


async def record_disconnect(sid: str) -> None:
    if not sid:
        return
    try:
        r = await _redis()
        if not r:
            return
        raw_val = await r.get(_k_sid(sid))
        if not raw_val:
            return
        rec = decode_presence_sid_record(raw_val)
        uid = str(rec.get("uid") or "").strip()
        if not uid:
            return
        await r.delete(_k_sid(sid))
        await r.srem(_k_sids(uid), sid)
        n = int(await r.scard(_k_sids(uid)) or 0)
        if n <= 0:
            await r.delete(_k_sids(uid))
            await r.srem(_k_online(), uid)
            raw_meta = await r.get(_k_meta(uid))
            if raw_meta:
                try:
                    meta = json.loads(raw_meta)
                    ls = meta.get("last_seen_at")
                    if ls:
                        await _persist_last_seen_snapshot(r, uid, str(ls))
                except (json.JSONDecodeError, TypeError):  # fmt: skip
                    pass
            await r.delete(_k_meta(uid))
        await release_browser_socket_lease(uid, sid)
    except Exception:
        logger.debug("presence record_disconnect failed", exc_info=True)


async def touch_heartbeat(sid: str) -> None:
    """Refresh presence TTL and last_seen (client sends ``emperyworld-heartbeat``)."""
    if not sid:
        return
    try:
        r = await _redis()
        if not r:
            return
        raw_val = await r.get(_k_sid(sid))
        if not raw_val:
            return
        rec = decode_presence_sid_record(raw_val)
        uid = str(rec.get("uid") or "").strip()
        if not uid:
            return
        await r.expire(_k_sid(sid), _SID_TTL_SEC)
        raw_meta = await r.get(_k_meta(uid))
        now = _now_iso()
        if raw_meta:
            try:
                meta = json.loads(raw_meta)
            except (json.JSONDecodeError, TypeError):  # fmt: skip
                meta = {"user_id": uid}
        else:
            meta = {"user_id": uid}
        meta["last_seen_at"] = now
        meta["sessions"] = int(await r.scard(_k_sids(uid)) or 0)
        await r.set(_k_meta(uid), json.dumps(meta, ensure_ascii=False))
        await _persist_last_seen_snapshot(r, uid, now)
    except Exception:
        logger.debug("presence touch_heartbeat failed", exc_info=True)


async def list_online() -> dict[str, Any]:
    """Список онлайн-пользователей для админки."""
    try:
        r = await _redis()
        if not r:
            return {"redis_available": False, "users": [], "total": 0}
        uids = await r.smembers(_k_online())
        if not uids:
            return {"redis_available": True, "users": [], "total": 0}
        out: list[dict[str, Any]] = []
        for raw in uids:
            uid = raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else str(raw)
            sids = await r.smembers(_k_sids(uid))
            alive = 0
            if sids:
                for rs in sids:
                    s = rs.decode("utf-8") if isinstance(rs, (bytes, bytearray)) else str(rs)
                    if await r.exists(_k_sid(s)):
                        alive += 1
            raw_meta = await r.get(_k_meta(uid))
            if raw_meta:
                try:
                    meta = json.loads(raw_meta)
                except (json.JSONDecodeError, TypeError):  # fmt: skip
                    meta = {}
            else:
                meta = {}
            if alive == 0:
                # зачистка «зависших» записей без disconnect
                ls_stale = meta.get("last_seen_at")
                if ls_stale:
                    await _persist_last_seen_snapshot(r, uid, str(ls_stale))
                await r.srem(_k_online(), uid)
                await r.delete(_k_sids(uid))
                await r.delete(_k_meta(uid))
                continue
            out.append(
                {
                    "user_id": uid,
                    "email": meta.get("email"),
                    "display_name": meta.get("display_name"),
                    "connected_at": meta.get("connected_at"),
                    "last_seen_at": meta.get("last_seen_at"),
                    "sessions": alive,
                }
            )
        out.sort(key=lambda x: x.get("last_seen_at") or "", reverse=True)
        return {"redis_available": True, "users": out, "total": len(out)}
    except Exception:
        logger.warning("presence list_online failed", exc_info=True)
        return {"redis_available": False, "users": [], "total": 0}


async def get_presence_anomaly_user_ids() -> tuple[bool, set[str]]:
    """
    user_id с более чем одной живой browser Socket.IO сессией (multi-tab / legacy presence).
    Сканирует только пользователей из online-set Redis.
    """
    out: set[str] = set()
    try:
        redis_ok, online = await get_online_presence_user_ids()
        if not redis_ok:
            return False, out
        for uid in online:
            details = await get_active_sid_details_for_presence_user(uid)
            web_n = sum(1 for d in details if is_browser_presence_session(d))
            if web_n > 1:
                out.add(uid)
        return True, out
    except Exception:
        logger.warning("get_presence_anomaly_user_ids failed", exc_info=True)
        return False, set()


async def get_online_presence_user_ids() -> tuple[bool, set[str]]:
    """
    user_id (строки), у которых есть хотя бы одна живая Socket.IO сессия.
    Та же зачистка «зависших» записей, что в list_online.
    """
    out: set[str] = set()
    try:
        r = await _redis()
        if not r:
            return False, out
        uids = await r.smembers(_k_online())
        if not uids:
            return True, out
        for raw in uids:
            uid = raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else str(raw)
            sids = await r.smembers(_k_sids(uid))
            alive = 0
            if sids:
                for rs in sids:
                    s = rs.decode("utf-8") if isinstance(rs, (bytes, bytearray)) else str(rs)
                    if await r.exists(_k_sid(s)):
                        alive += 1
            if alive == 0:
                raw_meta_go = await r.get(_k_meta(uid))
                if raw_meta_go:
                    try:
                        meta_go = json.loads(raw_meta_go)
                        ls_go = meta_go.get("last_seen_at")
                        if ls_go:
                            await _persist_last_seen_snapshot(r, uid, str(ls_go))
                    except (json.JSONDecodeError, TypeError):  # fmt: skip
                        pass
                await r.srem(_k_online(), uid)
                await r.delete(_k_sids(uid))
                await r.delete(_k_meta(uid))
                continue
            out.add(uid)
        return True, out
    except Exception:
        logger.warning("get_online_presence_user_ids failed", exc_info=True)
        return False, set()


async def batch_presence_for_user_ids(user_ids: list[str]) -> tuple[bool, dict[str, dict[str, Any]]]:
    """
    По списку user_id: online, sessions, connected_at, last_seen_at (Redis presence).
    Возвращает (redis_available, map[user_id -> fields]).
    """
    empty_row = {
        "online": False,
        "sessions": 0,
        "sessions_web": 0,
        "sessions_mobile": 0,
        "connected_at": None,
        "last_seen_at": None,
    }
    result: dict[str, dict[str, Any]] = {}
    for raw in user_ids:
        u = str(raw).strip()
        if u:
            result[u] = dict(empty_row)
    if not result:
        return False, {}
    try:
        r = await _redis()
        if not r:
            return False, result
        raw_online = await r.smembers(_k_online())
        online_set: set[str] = set()
        for x in raw_online:
            online_set.add(x.decode("utf-8") if isinstance(x, (bytes, bytearray)) else str(x))
        for uid in result:
            if uid not in online_set:
                raw_off = await r.get(_k_last_seen(uid))
                if raw_off:
                    ls = raw_off.decode("utf-8") if isinstance(raw_off, (bytes, bytearray)) else str(raw_off)
                    result[uid]["last_seen_at"] = ls
                continue
            sid_details = await get_active_sid_details_for_presence_user(uid)
            if not sid_details:
                raw_off = await r.get(_k_last_seen(uid))
                if raw_off:
                    ls = raw_off.decode("utf-8") if isinstance(raw_off, (bytes, bytearray)) else str(raw_off)
                    result[uid]["last_seen_at"] = ls
                continue
            raw_meta = await r.get(_k_meta(uid))
            meta: dict[str, Any] = {}
            if raw_meta:
                try:
                    meta = json.loads(raw_meta)
                except (json.JSONDecodeError, TypeError):  # fmt: skip
                    meta = {}
            row = result[uid]
            row["online"] = True
            row["sessions"] = len(sid_details)
            web_n = 0
            mobile_n = 0
            for detail in sid_details:
                if is_browser_presence_session(detail):
                    web_n += 1
                else:
                    mobile_n += 1
            row["sessions_web"] = web_n
            row["sessions_mobile"] = mobile_n
            row["connected_at"] = meta.get("connected_at")
            row["last_seen_at"] = meta.get("last_seen_at")
            if web_n > 1:
                logger.warning(
                    "presence anomaly: user=%s has %s browser Socket.IO sessions (expected 1); "
                    "check multi-tab desktop or stale sids",
                    uid,
                    web_n,
                )
        return True, result
    except Exception:
        logger.warning("batch_presence_for_user_ids failed", exc_info=True)
        return False, {u: dict(empty_row) for u in result}


def _merge_db_profile(merged: dict[str, Any], row: Any) -> None:
    merged["username"] = row["username"]
    merged["email"] = row["email"] or merged.get("email")
    merged["full_name"] = row["full_name"]
    merged["display_name"] = row["full_name"] or merged.get("display_name") or row["username"]
    merged["avatar_url"] = row["avatar_url"]
    merged["role"] = row["role"]
    merged["is_active"] = row["is_active"]
    lt = row["last_login_at"]
    merged["last_login_at"] = lt.isoformat() if lt is not None else None


async def enrich_presence_users_from_database(users: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Подмешать username, аватар, роль и last_login из PostgreSQL (таблица users)."""
    if not users:
        return users
    from uuid import UUID

    from api.core.database_manager import get_asyncpg_pool

    pool = await get_asyncpg_pool()
    if not pool:
        return users

    uuid_ids: list[str] = []
    for u in users:
        raw = str(u.get("user_id") or "").strip()
        try:
            UUID(raw)
            uuid_ids.append(raw)
        except ValueError:
            continue

    rows_by_id: dict[str, Any] = {}
    rows_by_email_lc: dict[str, Any] = {}

    try:
        async with pool.acquire() as conn:
            if uuid_ids:
                recs = await conn.fetch(
                    """
                    SELECT id, username, email, full_name, avatar_url, role, is_active, last_login_at
                    FROM users
                    WHERE id = ANY($1::uuid[])
                    """,
                    uuid_ids,
                )
                for row in recs:
                    rows_by_id[str(row["id"])] = row

            emails_lower: list[str] = []
            for u in users:
                uid = str(u.get("user_id") or "").strip()
                if uid in rows_by_id:
                    continue
                em = (u.get("email") or "").strip().lower()
                if em:
                    emails_lower.append(em)
            emails_lower = list(dict.fromkeys(emails_lower))

            if emails_lower:
                recs_e = await conn.fetch(
                    """
                    SELECT id, username, email, full_name, avatar_url, role, is_active, last_login_at
                    FROM users
                    WHERE lower(email) = ANY($1::text[])
                    """,
                    emails_lower,
                )
                for row in recs_e:
                    rows_by_email_lc[row["email"].lower()] = row
    except Exception:
        logger.warning("presence enrich_presence_users_from_database failed", exc_info=True)
        return users

    enriched: list[dict[str, Any]] = []
    for u in users:
        merged = dict(u)
        uid = str(u.get("user_id") or "").strip()
        row = rows_by_id.get(uid)
        if row is None:
            em = (u.get("email") or "").strip().lower()
            if em:
                row = rows_by_email_lc.get(em)
        if row is not None:
            _merge_db_profile(merged, row)
        else:
            merged.setdefault("username", None)
            merged.setdefault("full_name", None)
            merged.setdefault("avatar_url", None)
            merged.setdefault("role", None)
            merged.setdefault("is_active", None)
            merged.setdefault("last_login_at", None)
        enriched.append(merged)

    return enriched
