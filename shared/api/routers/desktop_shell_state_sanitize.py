# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop shell state JSON sanitizers and caps for shell_state persistence.
# Invariants:
# - Pure functions; no FastAPI or DB dependencies.
# Related:
# - api/routers/desktop_shell_state_routes.py
# ---
"""Desktop shell state JSON sanitizers."""

import logging
import re
from typing import Any

from api.schemas.user_profile import DesktopIconStyle, DesktopWindowStyle

logger = logging.getLogger(__name__)

MAX_RECENT_APP_IDS = 24
MAX_RECENT_FILE_IDS = 24
MAX_RECENT_APP_DESKTOP_KEYS = 32
MAX_SHELL_TIMEZONE_LEN = 80
MAX_WINDOWS_SNAPSHOT_WINDOWS = 32
MAX_WINDOWS_SNAPSHOT_PATH = 16
MAX_WINDOWS_SNAPSHOT_PAYLOAD_KEYS = 40
MAX_WINDOWS_SNAPSHOT_STRING = 2_000
MAX_VIRTUAL_DESKTOPS = 16
MAX_VIRTUAL_DESKTOP_WINDOWS = 32
MAX_VIRTUAL_DESKTOP_NAME_LEN = 120
MAX_VIRTUAL_DESKTOP_ID_LEN = 120
MAX_VISUAL_STYLE_PRESETS = 24
MAX_VISUAL_STYLE_PRESET_NAME_LEN = 120
MAX_VISUAL_STYLE_PRESET_ID_LEN = 120
MAX_VISUAL_STYLE_WALLPAPER_REF_LEN = 50_000
_ALLOWED_VISUAL_PRESET_THEMES = frozenset({"dark", "light", "auto"})
_ALLOWED_VISUAL_PRESET_WINDOW_STYLES = frozenset(m.value for m in DesktopWindowStyle)
_ALLOWED_VISUAL_PRESET_ICON_STYLES = frozenset(m.value for m in DesktopIconStyle)

_MAX_CLIPBOARD_SHELL_ITEMS = 25
_MAX_CLIPBOARD_SHELL_STRING = 120_000
_CLIPBOARD_SHELL_KEYS = frozenset({"id", "type", "content", "preview", "timestamp", "pinned", "source"})
_WINDOWS_SNAPSHOT_STRING_KEYS = frozenset({"folderId", "appComponent", "title", "desktopId", "id"})
_WINDOWS_SNAPSHOT_BOOL_KEYS = frozenset({"isMinimized", "isMaximized"})
_WINDOW_ID_PATTERN = re.compile(r"^w-[a-zA-Z0-9_-]{1,118}$")


def _sanitize_window_id(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    s = value.strip()
    if not s or len(s) > MAX_WINDOWS_SNAPSHOT_STRING:
        return None
    if not _WINDOW_ID_PATTERN.match(s):
        return None
    return s


def _sanitize_windows_snapshot_scalar(value: object) -> object | None:
    if isinstance(value, str):
        return value[:MAX_WINDOWS_SNAPSHOT_STRING]
    if isinstance(value, bool | int | float):
        return value
    if value is None:
        return None
    return None


def _sanitize_windows_snapshot_initial_payload(raw: object) -> dict[str, object] | None:
    if not isinstance(raw, dict):
        return None
    cleaned: dict[str, object] = {}
    for key, value in raw.items():
        if len(cleaned) >= MAX_WINDOWS_SNAPSHOT_PAYLOAD_KEYS:
            break
        if not isinstance(key, str) or not key.strip():
            continue
        sanitized = _sanitize_windows_snapshot_scalar(value)
        if sanitized is not None:
            cleaned[key[:120]] = sanitized
    return cleaned or None


def _sanitize_windows_snapshot_rect(raw: object) -> dict[str, float] | None:
    if not isinstance(raw, dict):
        return None
    x_or_w = raw.get("x", raw.get("width"))
    y_or_h = raw.get("y", raw.get("height"))
    if not isinstance(x_or_w, int | float) or not isinstance(y_or_h, int | float):
        return None
    if "width" in raw or "height" in raw:
        width = max(120.0, min(float(x_or_w), 5_000.0))
        height = max(80.0, min(float(y_or_h), 5_000.0))
        return {"width": width, "height": height}
    x = max(-5_000.0, min(float(x_or_w), 10_000.0))
    y = max(-5_000.0, min(float(y_or_h), 10_000.0))
    return {"x": x, "y": y}


def _sanitize_windows_snapshot(raw: object) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    raw_windows = raw.get("windows")
    if not isinstance(raw_windows, list):
        return None
    windows: list[dict[str, Any]] = []
    for item in raw_windows[:MAX_WINDOWS_SNAPSHOT_WINDOWS]:
        if not isinstance(item, dict):
            continue
        window_type = item.get("type")
        if window_type not in ("app", "folder"):
            continue
        position = _sanitize_windows_snapshot_rect(item.get("position"))
        size = _sanitize_windows_snapshot_rect(item.get("size"))
        if position is None or size is None:
            continue
        cleaned: dict[str, Any] = {
            "type": window_type,
            "position": position,
            "size": size,
        }
        for key in _WINDOWS_SNAPSHOT_STRING_KEYS:
            value = item.get(key)
            if key == "id":
                wid = _sanitize_window_id(value)
                if wid:
                    cleaned["id"] = wid
                continue
            if isinstance(value, str) and value.strip():
                cleaned[key] = value.strip()[:MAX_WINDOWS_SNAPSHOT_STRING]
        for key in _WINDOWS_SNAPSHOT_BOOL_KEYS:
            value = item.get(key)
            if isinstance(value, bool):
                cleaned[key] = value
        z_index = item.get("zIndex")
        if isinstance(z_index, int | float):
            cleaned["zIndex"] = int(max(0, min(float(z_index), 1_000_000.0)))
        path = item.get("path")
        if isinstance(path, list):
            cleaned["path"] = [
                entry.strip()[:MAX_WINDOWS_SNAPSHOT_STRING]
                for entry in path[:MAX_WINDOWS_SNAPSHOT_PATH]
                if isinstance(entry, str) and entry.strip()
            ]
        payload = _sanitize_windows_snapshot_initial_payload(item.get("initialPayload"))
        if payload:
            cleaned["initialPayload"] = payload
        windows.append(cleaned)
    active = raw.get("activeDesktopId")
    out: dict[str, Any] = {"windows": windows}
    if isinstance(active, str) and active.strip():
        out["activeDesktopId"] = active.strip()[:120]
    return out


def _sanitize_recent_app_ids_by_desktop(raw: object) -> dict[str, list[str]]:
    """Per-virtual-desktop MRU app ids (shell_state JSON). Caps keys and list sizes."""
    if not isinstance(raw, dict):
        return {}
    out: dict[str, list[str]] = {}
    for k, v in raw.items():
        if len(out) >= MAX_RECENT_APP_DESKTOP_KEYS:
            break
        if not isinstance(k, str):
            continue
        dk = k.strip()
        if not dk or len(dk) > 120:
            continue
        if not isinstance(v, list):
            continue
        ids: list[str] = []
        for x in v:
            if isinstance(x, str) and x.strip():
                s = x.strip()
                if len(s) <= 120 and s not in ids:
                    ids.append(s)
            if len(ids) >= MAX_RECENT_APP_IDS:
                break
        if ids:
            out[dk] = ids
    return out


def _sanitize_clipboard_shell_history(raw: object) -> list[dict[str, Any]]:
    """Strip unknown keys and cap size for JSON stored in shell_state."""
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for item in raw[:_MAX_CLIPBOARD_SHELL_ITEMS]:
        if not isinstance(item, dict):
            continue
        cleaned: dict[str, Any] = {}
        for key in _CLIPBOARD_SHELL_KEYS:
            if key not in item:
                continue
            val = item[key]
            if key in ("content", "preview") and isinstance(val, str):
                cleaned[key] = val[:_MAX_CLIPBOARD_SHELL_STRING]
            elif key == "id" and isinstance(val, str):
                cleaned[key] = val[:160]
            elif key == "type" and isinstance(val, str) and val in ("text", "image", "html"):
                cleaned[key] = val
            elif key == "timestamp" and isinstance(val, str):
                cleaned[key] = val[:80]
            elif key == "pinned" and isinstance(val, bool):
                cleaned[key] = val
            elif key == "source" and isinstance(val, str):
                cleaned[key] = val[:500]
        if "id" in cleaned and "type" in cleaned and "content" in cleaned:
            out.append(cleaned)
    return out


_MAX_NOW_PLAYING_TIME_S = float(24 * 3600)
_MUSIC_REPEAT_VALUES = {"none", "all", "one"}
_MAX_MUSIC_QUEUE_ITEMS = 256


def _sanitize_now_playing_shell(raw: object) -> dict[str, Any] | None:
    """Resume queue state for desktop music (content id + position + volume)."""
    if raw is None:
        return None
    if not isinstance(raw, dict):
        return None
    if not raw:
        return None
    track_raw = raw.get("track")
    track_out: dict[str, Any] | None = None
    if track_raw is None:
        track_out = None
    elif isinstance(track_raw, dict):
        tid = track_raw.get("id")
        tname = track_raw.get("name")
        if isinstance(tid, str) and tid.strip() and isinstance(tname, str) and tname.strip():
            track_out = {
                "id": tid.strip()[:120],
                "name": tname.strip()[:500],
            }
            tu = track_raw.get("thumbnail_url")
            if tu is None or tu == "":
                track_out["thumbnail_url"] = None
            elif isinstance(tu, str):
                track_out["thumbnail_url"] = tu.strip()[:2048]
            tv = track_raw.get("version")
            if tv is None or tv == "":
                track_out["version"] = None
            elif isinstance(tv, str):
                track_out["version"] = tv.strip()[:256]
    ct_raw = raw.get("current_time")
    if ct_raw is None and "currentTime" in raw:
        ct_raw = raw.get("currentTime")
    try:
        current_time = float(ct_raw) if ct_raw is not None else 0.0
    except (TypeError, ValueError):  # fmt: skip
        current_time = 0.0
    current_time = max(0.0, min(current_time, _MAX_NOW_PLAYING_TIME_S))
    vol_raw = raw.get("volume")
    try:
        volume = float(vol_raw) if vol_raw is not None else 1.0
    except (TypeError, ValueError):  # fmt: skip
        volume = 1.0
    volume = max(0.0, min(1.0, volume))
    return {"track": track_out, "current_time": current_time, "volume": volume}


def _sanitize_music_playback_queue_row(raw: object) -> dict[str, Any] | None:
    """Queue item row for shell_state.music_playback.queue."""
    if isinstance(raw, str):
        tid = raw.strip()[:_MUSIC_CONTENT_ID_MAX_LEN]
        if not tid:
            return None
        return {"id": tid, "name": tid, "thumbnail_url": None, "version": None}
    if not isinstance(raw, dict):
        return None
    tid_raw = raw.get("id")
    if not isinstance(tid_raw, str) or not tid_raw.strip():
        tid_raw = raw.get("track_id")
    if not isinstance(tid_raw, str) or not tid_raw.strip():
        tid_raw = raw.get("content_id")
    if not isinstance(tid_raw, str) or not tid_raw.strip():
        tid_raw = raw.get("unified_content_id")
    if not isinstance(tid_raw, str) or not tid_raw.strip():
        return None
    tid = tid_raw.strip()[:_MUSIC_CONTENT_ID_MAX_LEN]
    name_raw = raw.get("name")
    if not isinstance(name_raw, str) or not name_raw.strip():
        name_raw = raw.get("track_name")
    name = name_raw.strip()[:_MUSIC_PLAYLIST_NAME_MAX_LEN] if isinstance(name_raw, str) and name_raw.strip() else tid
    out: dict[str, Any] = {
        "id": tid,
        "name": name,
        "thumbnail_url": None,
        "version": None,
    }
    thumb_raw = raw.get("thumbnail_url")
    if thumb_raw is None and "thumbnailUrl" in raw:
        thumb_raw = raw.get("thumbnailUrl")
    if thumb_raw is None or thumb_raw == "":
        out["thumbnail_url"] = None
    elif isinstance(thumb_raw, str):
        out["thumbnail_url"] = thumb_raw.strip()[:2048]
    ver_raw = raw.get("version")
    if ver_raw is None or ver_raw == "":
        out["version"] = None
    elif isinstance(ver_raw, str):
        out["version"] = ver_raw.strip()[:256]
    return out


def _sanitize_music_playback_shell(raw: object) -> dict[str, Any] | None:
    """Playback mode + queue persisted for desktop music domain restart."""
    if raw is None or not isinstance(raw, dict) or not raw:
        return None
    out: dict[str, Any] = {}

    rate_raw = raw.get("playback_rate")
    if rate_raw is None and "playbackRate" in raw:
        rate_raw = raw.get("playbackRate")
    if rate_raw is None and "rate" in raw:
        rate_raw = raw.get("rate")
    if rate_raw is not None:
        try:
            rate = float(rate_raw)
        except (TypeError, ValueError):  # fmt: skip
            rate = 1.0
        out["playback_rate"] = max(0.5, min(2.0, rate))

    shuffle_raw = raw.get("shuffle")
    if shuffle_raw is None and "is_shuffle" in raw:
        shuffle_raw = raw.get("is_shuffle")
    if shuffle_raw is None and "isShuffle" in raw:
        shuffle_raw = raw.get("isShuffle")
    if isinstance(shuffle_raw, bool):
        out["shuffle"] = shuffle_raw

    repeat_raw = raw.get("repeat")
    if repeat_raw is None and "repeat_mode" in raw:
        repeat_raw = raw.get("repeat_mode")
    if repeat_raw is None and "repeatMode" in raw:
        repeat_raw = raw.get("repeatMode")
    repeat_val = ""
    if isinstance(repeat_raw, str):
        repeat_val = repeat_raw.strip().lower()
    if repeat_val in _MUSIC_REPEAT_VALUES:
        out["repeat"] = repeat_val
    else:
        repeat_one_raw = raw.get("repeat_one")
        if repeat_one_raw is None and "repeatOne" in raw:
            repeat_one_raw = raw.get("repeatOne")
        repeat_all_raw = raw.get("repeat_all")
        if repeat_all_raw is None and "repeatAll" in raw:
            repeat_all_raw = raw.get("repeatAll")
        if isinstance(repeat_one_raw, bool) and repeat_one_raw:
            out["repeat"] = "one"
        elif isinstance(repeat_all_raw, bool) and repeat_all_raw:
            out["repeat"] = "all"

    queue_raw = raw.get("queue")
    if queue_raw is None:
        queue_raw = raw.get("queue_items")
    if queue_raw is None:
        queue_raw = raw.get("queue_track_ids")
    if queue_raw is None:
        queue_raw = raw.get("queueTrackIds")
    if isinstance(queue_raw, list):
        queue_out: list[dict[str, Any]] = []
        seen_ids: set[str] = set()
        for row in queue_raw:
            item = _sanitize_music_playback_queue_row(row)
            if not item:
                continue
            tid = item["id"]
            if tid in seen_ids:
                continue
            queue_out.append(item)
            seen_ids.add(tid)
            if len(queue_out) >= _MAX_MUSIC_QUEUE_ITEMS:
                break
        out["queue"] = queue_out

    if not out:
        return None
    return out


_MUSIC_FAVORITES_PLAYLIST_ID = "eliteew-music-favorites"
_MUSIC_PLAYLIST_ID_MAX_LEN = 120
_MUSIC_PLAYLIST_NAME_MAX_LEN = 100
_MUSIC_CONTENT_ID_MAX_LEN = 120
_MAX_MUSIC_PLAYLISTS = 64
_MAX_TRACK_IDS_PER_PLAYLIST = 2000
_MAX_TOTAL_TRACK_ID_ENTRIES = 20000


def _sanitize_music_playlists_shell(raw: object) -> list[dict[str, Any]]:
    """
    Music player playlists in shell_state (JSONB); scoped by desktop_configs.user_id.
    Accepts snake_case track_ids or legacy camelCase trackIds from clients.
    """
    if not isinstance(raw, list):
        raw = []
    buckets: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        pid = item.get("id")
        if not isinstance(pid, str) or not pid.strip():
            continue
        pid = pid.strip()[:_MUSIC_PLAYLIST_ID_MAX_LEN]
        pname = item.get("name")
        if not isinstance(pname, str):
            pname = ""
        pname = pname.strip()[:_MUSIC_PLAYLIST_NAME_MAX_LEN] or "Плейлист"
        tids_raw = item.get("track_ids")
        if tids_raw is None:
            tids_raw = item.get("trackIds")
        tids: list[str] = []
        if isinstance(tids_raw, list):
            for tid in tids_raw:
                if not isinstance(tid, str) or not tid.strip():
                    continue
                s = tid.strip()[:_MUSIC_CONTENT_ID_MAX_LEN]
                if s not in tids:
                    tids.append(s)
                if len(tids) >= _MAX_TRACK_IDS_PER_PLAYLIST:
                    break
        if pid not in buckets:
            if len(buckets) >= _MAX_MUSIC_PLAYLISTS:
                continue
            buckets[pid] = {"id": pid, "name": pname, "track_ids": tids}
            order.append(pid)
        else:
            merged = buckets[pid]
            merged["name"] = pname or merged["name"]
            seen = set(merged["track_ids"])
            for tid in tids:
                if tid in seen:
                    continue
                merged["track_ids"].append(tid)
                seen.add(tid)
                if len(merged["track_ids"]) >= _MAX_TRACK_IDS_PER_PLAYLIST:
                    break
    fav = buckets.pop(_MUSIC_FAVORITES_PLAYLIST_ID, None)
    rest_order = [x for x in order if x != _MUSIC_FAVORITES_PLAYLIST_ID]
    out_list: list[dict[str, Any]] = []
    if fav is None:
        out_list.append(
            {
                "id": _MUSIC_FAVORITES_PLAYLIST_ID,
                "name": "Любимые",
                "track_ids": [],
            }
        )
    else:
        fav["name"] = "Любимые"
        out_list.append(fav)
    for pid in rest_order:
        if pid in buckets:
            out_list.append(buckets[pid])
    if len(out_list) > _MAX_MUSIC_PLAYLISTS:
        out_list = out_list[:_MAX_MUSIC_PLAYLISTS]
    total = 0
    for pl in out_list:
        kept: list[str] = []
        for tid in pl["track_ids"]:
            if total >= _MAX_TOTAL_TRACK_ID_ENTRIES:
                break
            kept.append(tid)
            total += 1
        pl["track_ids"] = kept
    return out_list


def _sanitize_visual_style_presets_shell(raw: Any) -> list[dict[str, Any]]:
    """Named desktop visual bundles (Wave 8); capped list for shell_state JSON."""
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for entry in raw[:MAX_VISUAL_STYLE_PRESETS]:
        if not isinstance(entry, dict):
            continue
        preset_id = str(entry.get("id", "")).strip()[:MAX_VISUAL_STYLE_PRESET_ID_LEN]
        name = str(entry.get("name", "")).strip()[:MAX_VISUAL_STYLE_PRESET_NAME_LEN]
        if not preset_id or not name:
            continue
        theme = str(entry.get("theme", "dark")).strip().lower()
        if theme not in _ALLOWED_VISUAL_PRESET_THEMES:
            theme = "dark"
        accent_follows = bool(entry.get("accentFollows"))

        wi_raw = entry.get("wallpaperIndex")
        wi: int | None
        if isinstance(wi_raw, (int, float)) and not isinstance(wi_raw, bool):  # noqa: SIM108
            wi = int(wi_raw)
        else:
            wi = None
        if wi is None or wi < 1 or wi > 199:
            wi = 1

        wref_raw = entry.get("wallpaperRef")
        wallpaper_ref = ""
        if isinstance(wref_raw, str):
            wallpaper_ref = wref_raw.strip()[:MAX_VISUAL_STYLE_WALLPAPER_REF_LEN]

        accent_raw = entry.get("accent")
        accent_token = ""
        if isinstance(accent_raw, str):
            accent_token = accent_raw.strip()[:80]

        ws = str(entry.get("windowStyle", "glass")).strip().lower()
        if ws not in _ALLOWED_VISUAL_PRESET_WINDOW_STYLES:
            ws = DesktopWindowStyle.GLASS.value

        ts = entry.get("taskbarStyle")
        taskbar_style = ws
        if isinstance(ts, str) and ts.strip().lower() in _ALLOWED_VISUAL_PRESET_WINDOW_STYLES:
            taskbar_style = ts.strip().lower()

        ico = entry.get("iconStyle")
        icon_style = ws
        if isinstance(ico, str) and ico.strip().lower() in _ALLOWED_VISUAL_PRESET_ICON_STYLES:
            icon_style = ico.strip().lower()

        wg = entry.get("widgetsStyle")
        widgets_style = ws
        if isinstance(wg, str) and wg.strip().lower() in _ALLOWED_VISUAL_PRESET_WINDOW_STYLES:
            widgets_style = wg.strip().lower()

        panel_opacity: float | None = None
        pop = entry.get("desktopPanelOpacity")
        if isinstance(pop, (int, float)) and not isinstance(pop, bool):
            panel_opacity = max(0.35, min(1.0, float(pop)))

        ui_scale: float | None = None
        us_raw = entry.get("desktopUiScale")
        if isinstance(us_raw, (int, float)) and not isinstance(us_raw, bool):
            ui_scale = max(0.5, min(1.5, float(us_raw)))

        created_at_raw = entry.get("createdAt")
        created_at = ""
        if isinstance(created_at_raw, str):
            created_at = created_at_raw.strip()[:80]

        blob: dict[str, Any] = {
            "id": preset_id,
            "name": name,
            "theme": theme,
            "accentFollows": accent_follows,
            "wallpaperIndex": wi,
            "windowStyle": ws,
            "taskbarStyle": taskbar_style,
            "iconStyle": icon_style,
            "widgetsStyle": widgets_style,
        }
        if wallpaper_ref:
            blob["wallpaperRef"] = wallpaper_ref
        if accent_token:
            blob["accent"] = accent_token
        if panel_opacity is not None:
            blob["desktopPanelOpacity"] = panel_opacity
        if ui_scale is not None:
            blob["desktopUiScale"] = ui_scale
        if created_at:
            blob["createdAt"] = created_at
        out.append(blob)
    return out


def _window_ids_from_sanitized_snapshot(
    windows_snapshot: dict[str, Any] | None,
) -> frozenset[str]:
    if not windows_snapshot:
        return frozenset()
    raw_windows = windows_snapshot.get("windows")
    if not isinstance(raw_windows, list):
        return frozenset()
    ids: list[str] = []
    for item in raw_windows:
        if not isinstance(item, dict):
            continue
        wid = _sanitize_window_id(item.get("id"))
        if wid:
            ids.append(wid)
    return frozenset(ids)


def _sanitize_virtual_desktops(
    raw: object,
    windows_snapshot: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    raw_desktops = raw.get("desktops")
    if not isinstance(raw_desktops, list) or len(raw_desktops) == 0:
        return None

    live_ids = _window_ids_from_sanitized_snapshot(windows_snapshot)
    orphans_dropped = 0
    desktops: list[dict[str, Any]] = []
    seen_desktop_ids: set[str] = set()

    for entry in raw_desktops[:MAX_VIRTUAL_DESKTOPS]:
        if not isinstance(entry, dict):
            continue
        desktop_id_raw = entry.get("id")
        if not isinstance(desktop_id_raw, str):
            continue
        desktop_id = desktop_id_raw.strip()[:MAX_VIRTUAL_DESKTOP_ID_LEN]
        if not desktop_id or desktop_id in seen_desktop_ids:
            continue
        seen_desktop_ids.add(desktop_id)

        raw_windows = entry.get("windows")
        wins: list[str] = []
        seen_window_ids: set[str] = set()
        if isinstance(raw_windows, list):
            for window_id in raw_windows:
                if not isinstance(window_id, str):
                    continue
                wid = window_id.strip()[:MAX_WINDOWS_SNAPSHOT_STRING]
                if not wid or wid in seen_window_ids:
                    continue
                if live_ids and wid not in live_ids:
                    orphans_dropped += 1
                    continue
                seen_window_ids.add(wid)
                wins.append(wid)
                if len(wins) >= MAX_VIRTUAL_DESKTOP_WINDOWS:
                    break

        name_raw = entry.get("name")
        name = (
            name_raw.strip()[:MAX_VIRTUAL_DESKTOP_NAME_LEN]
            if isinstance(name_raw, str) and name_raw.strip()
            else desktop_id
        )
        wallpaper_raw = entry.get("wallpaper")
        wallpaper = (
            wallpaper_raw.strip()[:MAX_WINDOWS_SNAPSHOT_STRING]
            if isinstance(wallpaper_raw, str) and wallpaper_raw.strip()
            else None
        )
        is_active = entry.get("isActive")
        desktop: dict[str, Any] = {
            "id": desktop_id,
            "name": name,
            "isActive": bool(is_active),
            "windows": wins,
        }
        if wallpaper:
            desktop["wallpaper"] = wallpaper
        desktops.append(desktop)

    if not desktops:
        return None

    active_raw = raw.get("activeDesktopId")
    active_id = (
        active_raw.strip()[:MAX_VIRTUAL_DESKTOP_ID_LEN]
        if isinstance(active_raw, str) and active_raw.strip()
        else desktops[0]["id"]
    )
    if active_id not in seen_desktop_ids:
        active_id = desktops[0]["id"]

    if orphans_dropped:
        logger.debug(
            "[STEP] vd_membership_orphans_dropped count=%s live_snapshot_ids=%s",
            orphans_dropped,
            len(live_ids),
        )

    return {
        "desktops": desktops,
        "activeDesktopId": active_id,
    }
