# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop surface tools: ``theme_set``, ``app_open``, ``music_studio_open``, ``catalog_list``.
# Invariants:
# - Handler module for EWA companion tool registry; behavior matches pre-split ``tool_registry.py``.
# - catalog_list router bypass with mode list forces a browse bundle, same as browse/recent.
# Related:
# - api/ewa_platform/companion/orchestration/tools/registry_core.py
# - api/ewa_platform/companion/orchestration/tool_registry.py
# ---
"""EWA companion tool registry handlers — desktop."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, Final

from api.ewa_platform.companion.orchestration.tools.handlers_common import (
    _looks_like_non_executing_question,
)
from api.ewa_platform.companion.orchestration.tools.handlers_media import (
    _companion_backend_music_generation_enabled,
    _user_line_is_music_feedback_or_praise,
    _user_line_requests_music_creation,
)
from api.ewa_platform.companion.orchestration.tools.registry_helpers import (
    _tool_router_bypass_line_match,
)
from api.ewa_platform.companion.orchestration.tools.registry_types import (
    ToolContext,
    ToolHandler,
    ToolResult,
)

logger = logging.getLogger(__name__)


_THEME_REPLY_RU: Final[dict[str, str]] = {
    "light": "Поставила светлую тему рабочего стола.",
    "dark": "Поставила тёмную тему рабочего стола.",
    "auto": "Поставила автоматическую тему рабочего стола (как в системе).",
}
_THEME_REPLY_EN: Final[dict[str, str]] = {
    "light": "I set the desktop to the light theme.",
    "dark": "I set the desktop to the dark theme.",
    "auto": "I set the desktop to the auto theme (matching the system).",
}


async def _handle_theme_set(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """Server-side desktop theme / accent write (Phase C).

    Two input modes:
        * Explicit: ``args = {"theme": "light"|"dark"|"auto", "accent_color"|"accent": "..."}``.
        * Inferred: no ``theme`` key → falls back to
          ``ux.desktop_theme_inference.infer_theme_from_user_line(...)``;
          accent from RU/EN color words when present.
    """

    from api.ewa_platform.companion.ux.desktop_config_execute import (
        companion_apply_patch_desktop_config_actions,
    )
    from api.ewa_platform.companion.ux.desktop_theme_inference import infer_theme_from_user_line

    _ACCENT_ALIASES: dict[str, str] = {
        "blue": "blue",
        "синий": "blue",
        "синяя": "blue",
        "purple": "purple",
        "violet": "purple",
        "фиолетов": "purple",
        "pink": "pink",
        "розов": "pink",
        "green": "green",
        "зелен": "green",
        "orange": "orange",
        "оранж": "orange",
        "red": "red",
        "красн": "red",
        "cyan": "cyan",
        "бирюз": "cyan",
        "teal": "teal",
        "yellow": "yellow",
        "желт": "yellow",
    }

    def _infer_accent(line: str, explicit: str | None) -> str | None:
        raw = (explicit or "").strip()
        if raw and (
            raw.startswith("#")
            or raw.casefold()
            in {
                "blue",
                "purple",
                "pink",
                "green",
                "orange",
                "red",
                "cyan",
                "teal",
                "yellow",
            }
        ):
            return raw if raw.startswith("#") else raw.casefold()
        low = line.casefold()
        for needle, accent_id in _ACCENT_ALIASES.items():
            if needle in low:
                return accent_id
        return None

    raw_theme = str(args.get("theme") or "").strip().lower() or None
    user_line = str(args.get("user_line") or ctx.user_line or "")
    theme = raw_theme if raw_theme in {"light", "dark", "auto"} else None
    if theme is None:
        theme = infer_theme_from_user_line(user_line, principal_id=ctx.principal_id)
    accent = _infer_accent(
        user_line,
        str(args.get("accent_color") or args.get("accent") or "").strip() or None,
    )
    if theme is None and accent is None:
        return None

    ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)

    if not (ctx.bearer_token or "").strip() or ctx.auth_user is None:
        logger.info(
            "[STEP] companion_tool_theme_set_unavailable reason=missing_auth_context theme=%s accent=%s",
            theme,
            accent,
        )
        return ToolResult(
            tool="theme_set",
            status="unavailable",
            reply=(
                "Сменю тему рабочего стола, как только подгрузится сессия — попроси ещё раз через пару секунд."
                if ru
                else "I'll switch the desktop theme as soon as the session is loaded — please ask again in a moment."
            ),
            actions=[],
            data={"theme": theme, "accent_color": accent},
            task_run=None,
        )

    patch: dict[str, Any] = {}
    if theme is not None:
        patch["theme"] = theme
    if accent is not None:
        patch["accent_color"] = accent
    action_row: dict[str, Any] = {"type": "patch_desktop_config", "patch": patch}
    _, applied = await companion_apply_patch_desktop_config_actions(
        [action_row],
        bearer_token=ctx.bearer_token,
        auth_user=ctx.auth_user,
    )
    if not applied:
        logger.warning(
            "[STEP] companion_tool_theme_set_apply_failed theme=%s accent=%s",
            theme,
            accent,
        )
        return ToolResult(
            tool="theme_set",
            status="error",
            reply=(
                "Не удалось применить тему — попробуй ещё раз чуть позже."
                if ru
                else "I could not apply the theme — please try again in a moment."
            ),
            actions=[],
            data={"theme": theme, "accent_color": accent, "applied": False},
            task_run=None,
        )

    reply_map = _THEME_REPLY_RU if ru else _THEME_REPLY_EN
    from api.ewa_platform.companion.orchestration import tool_registry as _tool_registry

    run_row = await _tool_registry._record_instant_completed_task_run(
        ctx=ctx,
        intent_kind="theme_set",
        user_message=user_line,
        plan_payload={"theme": theme, "accent_color": accent},
        result_payload={"theme": theme, "accent_color": accent, "applied": True},
    )
    theme_reply = reply_map.get(theme or "", "")
    if accent and ru:
        theme_reply = (theme_reply + f" Акцент: {accent}.").strip()
    elif accent:
        theme_reply = (theme_reply + f" Accent: {accent}.").strip()
    if not theme_reply:
        theme_reply = "Обновила оформление рабочего стола." if ru else "I updated the desktop appearance."
    return ToolResult(
        tool="theme_set",
        status="ok",
        reply=theme_reply,
        actions=[],
        data={"theme": theme, "accent_color": accent, "applied": True},
        task_run=run_row,
    )


async def _handle_app_open(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """Server-side desktop app launcher.

    Modes:
        * Explicit: ``args = {"app_component": "MusicGenerator", "payload": {...}}``. Validated against the EWA
          companion allowlist (``actions.allowlist.ALLOWED_APP_COMPONENTS``); unknown components → ``status="error"``
          (intentional, not silent).
        * Inferred: ``args`` does not include ``app_component`` → parses ``ctx.user_line`` for "открой / запусти /
          open / launch <NAME>" patterns and matches against allowlisted aliases (see ``_APP_OPEN_ALIASES`` below).
          Returns ``None`` when the intent does not match (caller falls through).

    Returns a ``ToolResult`` with an allowlisted ``open_app`` action so the SPA opens the window; the LLM is NOT
    invoked for this turn.
    """

    import re as _re

    from api.ewa_platform.companion.actions.allowlist import ALLOWED_APP_COMPONENTS

    user_line = str(args.get("user_line") or ctx.user_line or "")
    requested_component = str(args.get("app_component") or "").strip()
    payload = args.get("payload")

    if not requested_component:
        if _looks_like_non_executing_question(user_line):
            return None
        verb_re = _re.compile(
            r"(?ix)\b(?:открой|открыть|запусти|запустить|покажи\s+(?:приложени|окно)|"
            r"open|launch|show)\s+(?:приложени[ея]?\s+|window\s+|app\s+)?"
            r"(?P<name>[a-z][a-z0-9_\- ]{2,60}|[а-яё][а-яё\s]{2,60})",
        )
        m = verb_re.search(user_line)
        if not m:
            return None
        raw_name = m.group("name").strip().lower()
        resolved = _resolve_app_alias(raw_name)
        if resolved is None:
            return None
        requested_component = resolved

    from api.services.desktop_app_component_legacy import remap_legacy_desktop_app_component

    requested_component = remap_legacy_desktop_app_component(requested_component) or ""

    if requested_component not in ALLOWED_APP_COMPONENTS:
        ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
        return ToolResult(
            tool="app_open",
            status="error",
            reply=(
                f"Не могу открыть «{requested_component}» — это приложение не в разрешённом списке для Ассистента."
                if ru
                else f"I cannot open '{requested_component}' — that component is not on the Assistant allowlist."
            ),
            actions=[],
            data={"requested": requested_component},
            task_run=None,
        )

    from api.ewa_platform.companion.sidecar.shell_context import shell_context_is_mobile

    if shell_context_is_mobile(ctx.shell_norm):
        ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
        if requested_component == "MusicGenerator" and _companion_backend_music_generation_enabled():
            from api.ewa_platform.companion.orchestration import tool_registry as _tool_registry

            return await _tool_registry._handle_music_generation(
                {**dict(args), "user_line": user_line, "_tool_router_bypass_line_match": True},
                ctx,
            )
        return ToolResult(
            tool="app_open",
            status="unavailable",
            reply=(
                f"На телефоне нельзя открыть «{requested_component}» — используй инструменты чата или фоновые операции."
                if ru
                else f"Cannot open '{requested_component}' on mobile — use companion quick tools or background operations."
            ),
            actions=[],
            data={"app_component": requested_component, "client_surface": "mobile"},
            task_run=None,
        )

    action: dict[str, Any] = {"type": "open_app", "app_component": requested_component}
    if isinstance(payload, Mapping):
        for k, v in payload.items():
            if isinstance(k, str) and k not in ("type", "app_component"):
                action[k] = v

    ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
    reply_text = _APP_OPEN_REPLIES.get(
        requested_component,
        f"Открываю «{requested_component}»." if ru else f"Opening '{requested_component}'.",
    )
    if not ru and requested_component in _APP_OPEN_REPLIES_EN:
        reply_text = _APP_OPEN_REPLIES_EN[requested_component]

    logger.info("[STEP] companion_tool_app_open component=%s", requested_component)
    from api.ewa_platform.companion.orchestration import tool_registry as _tool_registry

    run_row = await _tool_registry._record_instant_completed_task_run(
        ctx=ctx,
        intent_kind="app_open",
        user_message=user_line,
        plan_payload={"app_component": requested_component},
        result_payload={
            "app_component": requested_component,
            "action_type": "open_app",
        },
    )
    return ToolResult(
        tool="app_open",
        status="ok",
        reply=reply_text,
        actions=[action],
        data={"app_component": requested_component},
        task_run=run_row,
    )


_APP_OPEN_ALIASES: Final[dict[str, str]] = {
    # Music
    "music": "MusicGenerator",
    "music generator": "MusicGenerator",
    "music studio": "MusicGenerator",
    "студия записи": "MusicGenerator",
    "студию записи": "MusicGenerator",
    "студия звукозаписи": "MusicGenerator",
    "студию звукозаписи": "MusicGenerator",
    "студия музыки": "MusicGenerator",
    "музыкальную студию": "MusicGenerator",
    "музыкальную студия": "MusicGenerator",
    "генератор песен": "MusicGenerator",
    "генератор музыки": "MusicGenerator",
    "music player": "MusicPlayer",
    "плеер": "MusicPlayer",
    "плеер музыки": "MusicPlayer",
    # Image / video
    "image studio": "ImageStudio",
    "студия изображений": "ImageStudio",
    "студию изображений": "ImageStudio",
    "video studio": "VideoStudio",
    "студия видео": "VideoStudio",
    "студию видео": "VideoStudio",
    # Documents
    "doc editor": "DocEditor",
    "document editor": "DocEditor",
    "редактор документов": "DocEditor",
    "ultimate doc editor": "DocEditor",
    "file manager": "ContentManagerPro",
    "файловый менеджер": "ContentManagerPro",
    "files": "ContentManagerPro",
    "файлы": "ContentManagerPro",
    "каталог": "ContentManagerPro",
    # Presentations (EWRP)
    "ewrp": "EWRP",
    "presentations": "EWRP",
    "presentation": "EWRP",
    "презентации": "EWRP",
    "презентацию": "EWRP",
    "презентация": "EWRP",
    "слайды": "EWRP",
    # AI chat & assistant
    "assistant": "AssistantApp",
    "ассистент": "AssistantApp",
    "elite chat": "GAFChatApp",
    "элит чат": "GAFChatApp",
    # EWA / Studio GU
    "ewa": "EwaApp",
    "ewa app": "EwaApp",
    "ewa companion": "EwaApp",
    "studio gu": "StudioGU",
    "студия гу": "StudioGU",
    # Settings
    "settings": "DesktopShellSettings",
    "настройки": "DesktopShellSettings",
    "desktop settings": "DesktopShellSettings",
}


_APP_OPEN_REPLIES: Final[dict[str, str]] = {
    "MusicGenerator": "Открываю Студию записи.",
    "MusicPlayer": "Открываю плеер.",
    "ImageStudio": "Открываю Студию изображений.",
    "VideoStudio": "Открываю Студию видео.",
    "DocEditor": "Открываю редактор документов.",
    "ContentManagerPro": "Открываю каталог файлов.",
    "AssistantApp": "Открываю ассистента.",
    "EwaApp": "Открываю окно EWA.",
    "StudioGU": "Открываю Студию ГУ.",
    "DesktopShellSettings": "Открываю настройки.",
    "GAFChatApp": "Открываю GAF Chat.",
    "EWRP": "Открываю EWRP.",
}

_APP_OPEN_REPLIES_EN: Final[dict[str, str]] = {
    "MusicGenerator": "Opening Music Studio.",
    "MusicPlayer": "Opening Music Player.",
    "ImageStudio": "Opening Image Studio.",
    "VideoStudio": "Opening Video Studio.",
    "DocEditor": "Opening Doc Editor.",
    "ContentManagerPro": "Opening Файловый менеджер.",
    "AssistantApp": "Opening the assistant.",
    "EwaApp": "Opening the EWA window.",
    "StudioGU": "Opening Studio GU.",
    "DesktopShellSettings": "Opening settings.",
    "GAFChatApp": "Opening GAF Chat.",
    "EWRP": "Opening EWRP.",
}


def _resolve_app_alias(raw_name: str) -> str | None:
    """Map a free-form RU/EN app name to a canonical ``app_component`` from the allowlist."""

    s = " ".join((raw_name or "").lower().split())
    if not s:
        return None
    if s in _APP_OPEN_ALIASES:
        return _APP_OPEN_ALIASES[s]
    # tolerate trailing punctuation / one-letter tail
    s2 = s.rstrip(".!?,:;")
    if s2 != s and s2 in _APP_OPEN_ALIASES:
        return _APP_OPEN_ALIASES[s2]
    # fall back to direct component name when user wrote ``open MusicGenerator`` etc
    for canonical in {*_APP_OPEN_ALIASES.values()}:
        if s2 == canonical.lower():
            return canonical
    return None


def _user_line_requests_music_studio_ui_only(user_line: str) -> bool:
    """True when the user explicitly wants the Music Studio UI (not server-side background generation)."""

    s = str(user_line or "").strip().lower()
    if not s:
        return False
    markers = (
        "вручную",
        "manually",
        "music studio",
        "music generator",
        "студию записи",
        "студия записи",
        "музыкальную студию",
        "музыкальная студия",
        "открой студ",
        "open music studio",
        "open the music studio",
        "launch music studio",
    )
    return any(marker in s for marker in markers)


async def _handle_music_studio_open(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """Open the Music Studio (Студия записи) app when the user wants to generate / compose music.

    Matches RU intents «сделай / сгенерируй / запиши / напиши / создай … песню / трек / музыку», «включи студию записи»,
    and EN intents «generate / compose / write / make a song / track / music», «open music studio».

    The actual **audio generation** still happens only in the Music Studio UI (user confirms params → HTTP to
    ``/api/v1/music-generator/...``); this tool **does not** call those endpoints. It only emits
    ``open_app:MusicGenerator`` so the SPA opens the app; widen regex coverage so common RU/EN phrasing hits this path
    instead of falling through to the LLM (which may *say* it is generating while doing nothing).
    When ``EWA_COMPANION_BACKEND_MUSIC_GENERATION`` is enabled, ``music_generation`` runs **before** this branch and may
    call **wizard v2 (XL Turbo)** endpoints server-side; this handler remains the UI-only fallback when the gate is off
    or HTTP fails upstream.
    """

    user_line = str(args.get("user_line") or ctx.user_line or "")
    if not user_line.strip():
        return None
    if _user_line_is_music_feedback_or_praise(user_line):
        logger.info(
            "[STEP] companion_music_studio_open_skip reason=music_feedback_or_praise line_chars=%d",
            len(user_line),
        )
        return None
    if _looks_like_non_executing_question(user_line):
        return None

    if not _user_line_requests_music_creation(user_line, ctx.profile) and not _tool_router_bypass_line_match(args):
        return None

    from api.ewa_platform.companion.sidecar.shell_context import shell_context_is_mobile

    if shell_context_is_mobile(ctx.shell_norm) and _companion_backend_music_generation_enabled():
        from api.ewa_platform.companion.orchestration import tool_registry as _tool_registry

        return await _tool_registry._handle_music_generation(
            {**dict(args), "user_line": user_line, "_tool_router_bypass_line_match": True},
            ctx,
        )

    if (
        _companion_backend_music_generation_enabled()
        and not _user_line_requests_music_studio_ui_only(user_line)
        and not shell_context_is_mobile(ctx.shell_norm)
    ):
        from api.ewa_platform.companion.orchestration import tool_registry as _tool_registry

        delegated = await _tool_registry._handle_music_generation(
            {**dict(args), "user_line": user_line, "_tool_router_bypass_line_match": True},
            ctx,
        )
        if delegated is not None:
            return delegated

    ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
    if shell_context_is_mobile(ctx.shell_norm):
        return ToolResult(
            tool="music_studio_open",
            status="unavailable",
            reply=(
                "На телефоне студия записи недоступна — попроси «сгенерируй песню», и я запущу генерацию в фоне. "
                "Прогресс будет в «Текущих операциях»."
                if ru
                else "Music Studio is not available on mobile — ask me to generate a song and I'll run it in the background. "
                "Track progress under Current operations."
            ),
            actions=[],
            data={"client_surface": "mobile"},
            task_run=None,
        )

    action = {"type": "open_app", "app_component": "MusicGenerator"}
    reply = (
        "Открываю Студию записи — оформим там идею песни."
        if ru
        else "Opening Music Studio — let's shape the song idea there."
    )
    from api.ewa_platform.companion.orchestration import tool_registry as _tool_registry

    run_row = await _tool_registry._record_instant_completed_task_run(
        ctx=ctx,
        intent_kind="music_studio_open",
        user_message=user_line,
        plan_payload={"app_component": "MusicGenerator"},
        result_payload={
            "app_component": "MusicGenerator",
            "action_type": "open_app",
        },
    )
    logger.info("[STEP] companion_tool_music_studio_open")
    return ToolResult(
        tool="music_studio_open",
        status="ok",
        reply=reply,
        actions=[action],
        data={"app_component": "MusicGenerator"},
        task_run=run_row,
    )


async def _resolve_catalog_list_folder_item_id(
    args: Mapping[str, Any],
    *,
    content_user_id: str,
) -> str | None:
    """Optional nested EwaFile task-folder scope for ``catalog_list``."""

    from api.utils.ewa_companion_folder import EWA_COMPANION_FOLDER_ITEM_ID
    from api.utils.ewa_task_folder import is_ewa_task_folder_item_id

    explicit = str(args.get("folder_item_id") or "").strip()
    if explicit:
        if explicit == EWA_COMPANION_FOLDER_ITEM_ID or is_ewa_task_folder_item_id(explicit):
            return explicit
        logger.info(
            "[STEP] companion_catalog_list_folder_ignored reason=invalid_folder_item_id value=%s",
            explicit[:80],
        )
        return None

    label = str(args.get("folder_name") or args.get("folder_label") or "").strip()
    if not label:
        return None
    from api.services.ewa_task_folder_service import find_ewa_task_folder_by_label_for_user

    found = await find_ewa_task_folder_by_label_for_user(user_id=content_user_id, query=label)
    if not found:
        logger.info(
            "[STEP] companion_catalog_list_folder_miss query=%s",
            label[:80],
        )
    return found


async def _handle_catalog_list(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """Server-side EwaFile catalog listing — terminal reply + embedded clickable list surface."""

    from api.ewa_platform.companion.orchestration.flows.catalog_resolve import query_service_or_none
    from api.ewa_platform.companion.storage.catalog_find import (
        build_companion_catalog_find_bundle,
        catalog_find_bundle_output_surface,
        user_intent_companion_catalog_find,
    )
    from api.ewa_platform.gateways.runtime_gateway.catalog_preferences import catalog_preferences_from_profile

    uid = (ctx.content_catalog_user_id or "").strip()
    if not uid:
        return None
    user_line = str(args.get("user_line") or ctx.user_line or "")
    if not user_line.strip():
        return None
    mode = str(args.get("mode") or "").strip().lower()
    has_keyword = bool(str(args.get("file_query") or args.get("query") or args.get("keyword") or "").strip())
    workflow_browse = _tool_router_bypass_line_match(args) and (
        mode in {"browse", "recent", "list", ""} or (mode == "search" and not has_keyword)
    )
    if (
        not workflow_browse
        and not user_intent_companion_catalog_find(user_line)
        and not _tool_router_bypass_line_match(args)
    ):
        return None

    query_svc = await query_service_or_none()
    if query_svc is None:
        if not workflow_browse:
            return None
        ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
        return ToolResult(
            tool="catalog_list",
            status="unavailable",
            reply=(
                "Открываю EwaFile, но сейчас не могу прочитать список файлов автоматически. Проверь каталог вручную."
                if ru
                else "Opening EwaFile, but I cannot read the file list automatically right now. Please review the catalog manually."
            ),
            actions=[{"type": "open_app", "app_component": "EwaFileManager"}],
            data={"orchestration_branch": "catalog_list", "fallback": "query_service_unavailable"},
            task_run=None,
        )

    folder_scope = await _resolve_catalog_list_folder_item_id(args, content_user_id=uid)
    bundle = await build_companion_catalog_find_bundle(
        user_line,
        content_catalog_user_id=uid,
        oauth2_sub=ctx.oauth2_sub_for_content_alternate,
        query_svc=query_svc,
        preferences=catalog_preferences_from_profile(ctx.profile),
        force_browse=workflow_browse,
        folder_item_id=folder_scope,
    )
    if bundle is None:
        if not workflow_browse:
            return None
        ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
        return ToolResult(
            tool="catalog_list",
            status="unavailable",
            reply=(
                "Открываю EwaFile, но не смогла собрать подборку файлов для этого запроса."
                if ru
                else "Opening EwaFile, but I could not build a file shortlist for this request."
            ),
            actions=[{"type": "open_app", "app_component": "EwaFileManager"}],
            data={"orchestration_branch": "catalog_list", "fallback": "bundle_unavailable"},
            task_run=None,
        )

    rows = list(bundle.collected_rows)
    appendix = (bundle.appendix or "").strip()
    if not rows and not appendix:
        if workflow_browse:
            ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
            return ToolResult(
                tool="catalog_list",
                status="ok",
                reply=(
                    "В каталоге EwaFile пока нет файлов для этого запроса. "
                    "Загрузите документы в EwaFile или вставьте ключевой текст в чат."
                    if ru
                    else "No files in EwaFile match this request. Upload documents or paste text into chat."
                ),
                actions=[{"type": "open_app", "app_component": "EwaFileManager"}],
                data={"orchestration_branch": "catalog_list", "row_count": 0, "empty": True},
                task_run=None,
            )
        return None

    catalog_appendix = appendix

    ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
    if rows:
        if folder_scope and folder_scope != "ewa_file":
            head = (
                f"В папке {len(rows)} подходящих файлов." if ru else f"Found {len(rows)} matching files in the folder."
            )
        else:
            head = (
                f"В каталоге EwaFile {len(rows)} подходящих файлов."
                if ru
                else f"Found {len(rows)} matching files in EwaFile."
            )
    else:
        head = "В EwaFile не нашла подходящих файлов." if ru else "No matching files in EwaFile."

    from api.ewa_platform.companion.storage.catalog_find import compact_catalog_hits_from_rows

    catalog_hits = compact_catalog_hits_from_rows(rows, limit=10)

    logger.info(
        "[STEP] companion_tool_catalog_list rows=%s appendix_chars=%s folder=%s",
        len(rows),
        len(catalog_appendix),
        (folder_scope or "ewa_file")[:48],
    )
    return ToolResult(
        tool="catalog_list",
        status="ok",
        reply=head,
        actions=[],
        output_surface=catalog_find_bundle_output_surface(bundle),
        data={
            "catalog_appendix": catalog_appendix,
            "row_count": len(rows),
            "orchestration_branch": "catalog_list",
            "catalog_hits": catalog_hits,
            "folder_item_id": folder_scope or "ewa_file",
        },
        task_run=None,
    )


HANDLERS: Final[dict[str, ToolHandler]] = {
    "theme_set": _handle_theme_set,
    "app_open": _handle_app_open,
    "music_studio_open": _handle_music_studio_open,
    "catalog_list": _handle_catalog_list,
}
