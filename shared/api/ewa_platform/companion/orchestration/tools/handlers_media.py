# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Media generation tools and music pipeline helpers: music/image/presentation + background jobs.
# Invariants:
# - Handler module for EWA companion tool registry; behavior matches pre-split ``tool_registry.py``.
# - Trust T2: presentation async enqueue enforces catalog capacity before run create.
# - Trust T4 / V-L1: music background completion always publishes ``task_completed`` before workflow advance returns.
# Related:
# - api/ewa_platform/companion/orchestration/tools/registry_core.py
# - api/ewa_platform/companion/orchestration/tool_registry.py
# - documentation/product/ewa/EWA-TRUST-RESTORATION-PROGRAM-2026-07-09.md
# ---
"""EWA companion tool registry handlers — media."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import re
import socket
from collections.abc import Mapping
from typing import Any, Final

import asyncpg

from api.ewa_platform.companion.orchestration.tools.handlers_common import (
    _looks_like_non_executing_question,
)
from api.ewa_platform.companion.orchestration.tools.registry_helpers import (
    _tool_router_bypass_line_match,
    companion_pg,
)
from api.ewa_platform.companion.orchestration.tools.registry_types import (
    ToolContext,
    ToolHandler,
    ToolResult,
    ToolStatus,
)
from api.routers.music_generator_constants import (
    MAX_EWA_COMPANION_CONTEXT_CHARS,
    MAX_LYRICS_LENGTH,
    MAX_WIZARD_THEME_CHARS,
)

logger = logging.getLogger(__name__)


_MUSIC_CREATION_USER_LINE_RE: Final[re.Pattern[str]] = re.compile(
    r"(?ix)(?:"
    r"(?:сдела(?:й|ть|ем)|сгенер(?:ируй|ировать|им|ируем|ить)|запиш(?:и|ать|ем)|"
    r"напиш(?:и|ать|ем)|созда(?:й|ть|дим)|сочин(?:и|ить|им)|подбер[иь]|подобрать)\s+"
    r"(?:мне\s+)?(?:новую\s+)?(?:песн[юаяи]?|тр[еэ]к(?:и)?|музык[уи]?|композиц(?:ию|ии)?|мелоди[юи])"
    r"|(?:сделать|сгенерировать|создать|написать|сочинить|записать|сгенерить)\s+"
    r"(?:мне\s+)?(?:новую\s+)?(?:песн[юаяи]?|тр[еэ]к(?:и)?|музык[уи]?|композиц(?:ию|ии)?|мелоди[юи])"
    r"|(?:можешь|можно|нужно|надо|пожалуйста)\s+(?:мне\s+)?"
    r"(?:сделать|сгенерировать|создать|написать|сочинить|записать|сгенерить)\s+"
    r"(?:[^.?!\n]{0,60})?(?:песн[юаяи]?|тр[еэ]к|музык[уи]?|мелоди[юи]|композиц)"
    r"|(?:песн[юаяи]?|тр[еэ]к(?:а|и)?|музык[уи]?|композици[юию]|мелоди[юию])\s+"
    r"(?:сдела(?:й|ть|ем)|сгенер(?:ируй|ировать|им|ируем)|созда(?:й|ть|дим)|"
    r"напиш(?:и|ать|ем)|сочин(?:и|ить|им))(?:\s+мне)?"
    r"|(?:хочу|хотел[ауы]?\s+бы)\s+(?:мне\s+)?(?:новую\s+)?"
    r"(?:песн[юаяи]?|тр[еэ]к|музык[уи]?|композици[юию])"
    r"|(?:нужн[аоы]?\s+)?(?:новую\s+)?(?:песн[юаяи]?|тр[еэ]к)\s+про\s+"
    r"|давай\s+(?:сгенер(?:им|ируем)|сдела(?:ем|й)|напиш(?:ем|и)|создадим|сочиним)\s+"
    r"(?:мне\s+)?(?:новую\s+)?(?:песн[юаяи]?|тр[еэ]к(?:и)?|музык[уи]?|композиц(?:ию|ии)?|мелоди[юи])"
    r"|(?:давай|давайте)\s+(?:мне\s+)?(?:новую\s+)?(?:песн[юаяи]?|тр[еэ]к(?:и)?|музык[уи]?)"
    r"|(?:запусти|запустить|начни|начать)\s+генерац\w*\s+"
    r"(?:песн\w*|музык\w*|тр[еэ]к\w*|мелоди\w*|композиц\w*)"
    r"|(?:запусти|запустить)\s+(?:генератор|мастер)\s+(?:песен|музык|треков)"
    r"|включ(?:и|ить)\s+студи[юя]?\s+(?:записи|звукозаписи|музыки)"
    r"|открой\s+студи[юя]?\s+(?:записи|звукозаписи|музыки)"
    r"|generate\s+(?:a|an|the|new|me)\s+(?:a|an|the|new|me)?\s*(?:song|track|tune|music)"
    r"|generate\s+(?:song|track|tune|music)"
    r"|compose\s+(?:a|an|the|new|me)?\s*(?:song|track|tune|music)"
    r"|make\s+(?:me\s+)?(?:a|an|the|new)?\s*(?:song|track|tune)"
    r"|write\s+(?:me\s+)?(?:a|an|the|new)?\s*(?:song|track|tune)"
    r"|\bcan\s+you\s+(?:make|write|compose|generate)\s+(?:me\s+)?(?:a|an|the|new)?\s*(?:song|track|tune)\b"
    r"|\bi\s+want\s+(?:a|an|the|my|new)\s+(?:song|track|tune)\b"
    r"|open\s+(?:the\s+)?(?:music|recording)\s+studio"
    r")",
)

_MUSIC_ANOTHER_ONE_USER_LINE_RE: Final[re.Pattern[str]] = re.compile(
    r"(?ix)(?:"
    r"(?:давай|давайте|davay|davai|davaj|davayte)\s+"
    r"(?:ещ[ёе]|eshe|e[sh]?e|eshche|esche)\s+"
    r"(?:один|одну|одна|одного|odin|odna|odnu|odny|one)\b"
    r"|(?:ещ[ёе]|eshe|e[sh]?e|eshche|esche)\s+"
    r"(?:один|одну|одна|odin|odna|odnu|odny)\b"
    r"(?:\s+(?:песн\w*|тр[еэ]k\w*|song|track|music))?"
    r"|\banother\s+(?:one|song|track)\b"
    r"|\bone\s+more\s+(?:song|track)?\b"
    r")",
)

_MUSIC_ANOTHER_ONE_PREFIX_RE: Final[re.Pattern[str]] = re.compile(
    r"(?ix)^\s*(?:"
    r"(?:давай|давайте|davay|davai|davaj|davayte)\s+"
    r"(?:ещ[ёе]|eshe|e[sh]?e|eshche|esche)\s+"
    r"(?:один|одну|одна|одного|odin|odna|odnu|odny|one)"
    r"|(?:ещ[ёе]|eshe|e[sh]?e|eshche|esche)\s+"
    r"(?:один|одну|одна|odin|odna|odnu|odny)"
    r"(?:\s+(?:песн\w*|тр[еэ]k\w*|song|track|music))?"
    r"|another\s+(?:one|song|track)"
    r"|one\s+more\s+(?:song|track)?"
    r")\s*",
)

_MUSIC_RETRY_USER_LINE_RE: Final[re.Pattern[str]] = re.compile(
    r"(?ix)(?:"
    r"(?:перезап(?:уск(?:а|и|ить|у)?|усти(?:ть)?)|заново|снова|повтор(?:и(?:ть|те)?|ить)\b|"
    r"ещё\s+раз|еще\s+раз|retry|regenerate|try\s+again)"
    r"(?:\s+(?:генера\w*|песн\w*|тр[еэ]к\w*|музык\w*|generation|song|track|music))?"
    r"|(?:сгенер(?:ируй|i)|запусти|начни)\s+(?:заново|снова|ещё\s+раз|еще\s+раз|again|retry)"
    r"|генерац\w*\s+(?:упала|упал|сбо(?:й|ила)|ошибк\w*|failed|не\s+получил\w*)"
    r"|(?:та|она|он)\s+упала\s+(?:с\s+)?(?:ошибк\w*|error)"
    r")",
)

_MUSIC_FEEDBACK_OR_PRAISE_USER_LINE_RE: Final[re.Pattern[str]] = re.compile(
    r"(?ix)(?:"
    r"\b(?:ах\w*|офиген\w*|классн\w*|крут\w*|отличн\w*|супер|топ|огонь|зач[её]т|шикарн\w*|"
    r"бомб\w*|пушк\w*|awesome|great|amazing|fire|dope|incredible|fantastic)\b"
    r".{0,48}?\b(?:песн\w*|тр[еэ]к\w*|музык\w*|мелоди\w*|song|track|tune)\b"
    r"|\b(?:песн\w*|тр[еэ]к\w*|музык\w*|мелоди\w*|song|track|tune)\b"
    r".{0,48}?\b(?:ах\w*|офиген\w*|классн\w*|крут\w*|отличн\w*|супер|топ|огонь|зач[её]т|шикарн\w*|"
    r"awesome|great|amazing|fire|dope|incredible|fantastic)\b"
    r"|\b(?:спасибо|благодар\w*|thanks|thank\s+you)\b.{0,56}?\b(?:песн\w*|тр[еэ]к\w*|музык\w*|song|track)\b"
    r"|\b(?:понравил\w*|нравит\w*|love[ds]?|liked?)\b.{0,48}?\b(?:песн\w*|тр[еэ]к\w*|song|track)\b"
    r"|\b(?:ты|вы|you)\b.{0,24}?\b(?:сдела(?:л[аи]?|ли)|написа(?:л[аи]?|ли)|"
    r"сгенерир\w+|созда(?:л[аи]?|ли)|записа(?:л[аи]?|ли)|composed?|wrote|made|generated)\b"
    r"|\b(?:песн\w*|тр[еэ]к\w*|музык\w*|мелоди\w*|song|track)\b.{0,32}?\b(?:ты|вы|you)\b"
    r".{0,24}?\b(?:сдела(?:л[аи]?|ли)|написа(?:л[аи]?|ли)|сгенерир\w+|созда(?:л[аи]?|ли))\b"
    r")",
)


def _user_line_is_music_feedback_or_praise(user_line: str) -> bool:
    """True when the user praises or reviews an existing track — must not start generation."""

    s = str(user_line or "")
    if not _MUSIC_FEEDBACK_OR_PRAISE_USER_LINE_RE.search(s):
        return False
    if _MUSIC_CREATION_USER_LINE_RE.search(s):
        return False
    if _user_line_requests_music_retry(s):
        return False
    return not _user_line_requests_music_another_one(s)


def _user_line_requests_music_retry(user_line: str) -> bool:
    """True when the user asks to re-run a failed or interrupted music generation."""

    return bool(_MUSIC_RETRY_USER_LINE_RE.search(str(user_line or "")))


def _user_line_requests_music_another_one(user_line: str) -> bool:
    """True when the user asks for another track (often after a successful generation)."""

    return bool(_MUSIC_ANOTHER_ONE_USER_LINE_RE.search(str(user_line or "")))


def _user_line_requests_music_creation(
    user_line: str,
    profile: Mapping[str, Any] | None = None,
) -> bool:
    """True when the user line should trigger ``music_generation`` / ``music_studio_open``."""

    from api.ewa_platform.companion.orchestration.companion_music_xl_base import (
        user_line_requests_music_xl_base_autonomous,
    )
    from api.ewa_platform.companion.orchestration.instruction_guards import (
        user_line_is_memory_or_plan_meta_instruction,
    )
    from api.ewa_platform.companion.orchestration.turn_context_guards import (
        side_effect_tools_suppressed_for_turn,
    )

    s = str(user_line or "")
    if side_effect_tools_suppressed_for_turn(s, profile):
        return False
    if user_line_is_memory_or_plan_meta_instruction(s):
        return False
    if _user_line_is_music_feedback_or_praise(s):
        return False
    if user_line_requests_music_xl_base_autonomous(s, profile):
        return False
    return (
        bool(_MUSIC_CREATION_USER_LINE_RE.search(s))
        or _user_line_requests_music_retry(s)
        or _user_line_requests_music_another_one(s)
    )


def _clamp_companion_pipeline_lyrics(lyrics: str) -> str:
    """Keep wizard HTTP payloads within ``MAX_LYRICS_LENGTH`` (UGS/suggest reject longer bodies)."""

    text = str(lyrics or "").strip()
    if len(text) <= MAX_LYRICS_LENGTH:
        return text
    clipped = text[:MAX_LYRICS_LENGTH].rstrip()
    logger.info(
        "[STEP] companion_music_lyrics_truncated original_chars=%d clipped_chars=%d",
        len(text),
        len(clipped),
    )
    return clipped


_MUSIC_WIZARD_LEADING_CMD_RE: Final[re.Pattern[str]] = re.compile(
    r"(?is)^\s*(?:"
    r"сдела(?:й|ть|ем)|сгенер(?:ируй|ировать|им|ируем|ить)|запиш(?:и|ать|ем)|"
    r"напиш(?:и|ать|ем)|созда(?:й|ть|дим)|сочин(?:и|ить|им)|"
    r"create|make|generate|compose|write"
    r")\s+(?:мне\s+)?(?:"
    r"песн[юяюи]|тр[еэ]к(?:а|и)?|музык[уи]|композиц(?:ию|ии)|мелоди[юи]|"
    r"song|track|tune|music"
    r")\s*(?:на\s+тему|про|about|on|for)?\s*[:—-]?\s*"
)

_MUSIC_GENERATION_AUTOPLAY_RE: Final[re.Pattern[str]] = re.compile(
    r"(?ix)"
    r"(?:\bи\s+)?включ(?:ай|и)(?:\s+(?:её|его|её|its?))?"
    r"|(?:\bи\s+)?сразу\s+включ"
    r"|сразу\s+игра"
    r"|включ(?:ай|и)\s+сразу"
    r"|включ(?:ай|и)\s+как\s+(?:будет\s+)?готово"
    r"|как\s+(?:будет|только\s+будет)\s+готово"
    r"|как\s+только\s+(?:будет\s+)?готово"
    r"|автоматически\s+включ"
    r"|не\s+спрашив"
    r"|без\s+вопрос"
    r"|сразу\s+в\s+фон"
    r"|в\s+фоне\s+сразу"
    r"|play\s+when\s+ready"
    r"|as\s+soon\s+as\s+(?:it['\u2019]s\s+)?ready"
    r"|start\s+(?:playing\s+)?automatically"
    r"|auto[\s-]*play"
    r"|without\s+asking"
)


def _music_generation_autoplay_requested(user_line: str, args: Mapping[str, Any]) -> bool:
    """True when user asked to start background playback without a confirm step (phrase or explicit args)."""

    for key in ("autoplay", "play_when_ready", "immediate_play", "play_immediately"):
        if key not in args:
            continue
        raw = args.get(key)
        if isinstance(raw, bool):
            return raw
        if raw is None:
            continue
        s = str(raw).strip().lower()
        if s in ("1", "true", "yes", "on"):
            return True
        if s in ("0", "false", "no", "off"):
            return False
    return bool(_MUSIC_GENERATION_AUTOPLAY_RE.search(user_line))


def _companion_backend_music_generation_enabled() -> bool:
    try:
        from api.ewa_platform.settings.service import get_cached_setting_bool, is_settings_cache_loaded

        if is_settings_cache_loaded():
            return get_cached_setting_bool("EWA_COMPANION_BACKEND_MUSIC_GENERATION", default=False)
    except Exception as exc:  # noqa: BLE001 — settings shim optional during bootstrap
        logger.debug("[STEP] companion_music_gate_settings_cache_skip err=%s", exc)
    return os.environ.get("EWA_COMPANION_BACKEND_MUSIC_GENERATION", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def _music_generation_api_base_url(*, for_remote_worker: bool = False) -> str:
    """Base URL ``…/api/v1/music-generator`` for the **Основной** wizard path (v2 XL Turbo).

    ``EWA_COMPANION_MUSIC_GENERATION_HTTP_URL`` may end with ``/generate`` or legacy ``/v3/generate``; those suffixes are
    stripped so ``/lyrics``, ``/generate-style``, ``/generate`` share one prefix.

    When ``for_remote_worker`` is True (Celery on .141), prefer ``ELITEEW_LAN_WORKER_HTTP_BASE_URL`` so the job does
    not embed loopback ``127.0.0.1`` from punisher API.
    """

    if for_remote_worker:
        lan_base = os.environ.get("ELITEEW_LAN_WORKER_HTTP_BASE_URL", "").strip().rstrip("/")
        if lan_base:
            return f"{lan_base}/api/v1/music-generator"

    raw = os.environ.get("EWA_COMPANION_MUSIC_GENERATION_HTTP_URL", "").strip()
    if raw:
        u = raw.rstrip("/")
        if u.endswith("/generate"):
            u = u[: -len("/generate")]
        if u.endswith("/v3"):
            u = u[: -len("/v3")]
        return u
    from api.core.unified_config import unified_settings

    return f"{unified_settings.eliteew_self_http_base_url.rstrip('/')}/api/v1/music-generator"


def _local_stack0_music_generation_base_url() -> str | None:
    """Container-DNS base for local stack0 Celery workers in the same Podman network."""

    try:
        socket.getaddrinfo("stack0-eliteew-api-prod", 8000)
    except OSError:
        return None
    return "http://stack0-eliteew-api-prod:8000/api/v1/music-generator"


def _resolve_music_job_base_url(job_payload: Mapping[str, Any] | None) -> str:
    """Pick music-generator HTTP base for Celery worker; rewrite loopback from punisher enqueue."""

    payload = dict(job_payload or {})
    raw = str(payload.get("base_url") or "").strip()
    local_stack0_base = _local_stack0_music_generation_base_url()
    if local_stack0_base and raw:
        lan_base = os.environ.get("ELITEEW_LAN_WORKER_HTTP_BASE_URL", "").strip().rstrip("/")
        if "127.0.0.1" in raw or "localhost" in raw.lower() or (lan_base and raw.startswith(lan_base)):
            return local_stack0_base
    if raw and "127.0.0.1" not in raw and "localhost" not in raw.lower():
        return raw.rstrip("/")
    if local_stack0_base:
        return local_stack0_base
    return _music_generation_api_base_url(for_remote_worker=True)


_WIZARD_LLM_TEMPERATURE = 0.85
_WIZARD_LLM_CFG = 2.0
_WIZARD_LLM_TOP_P = 0.9
_DEFAULT_PIPELINE_BPM = 120

_MUSIC_XL_BPM_GUARDS: Final[dict[str, tuple[int, int]]] = {
    "drum and bass": (168, 182),
    "dubstep": (132, 148),
    "hardstyle": (145, 155),
    "eurodance": (134, 142),
    "trance": (134, 142),
    "techno": (126, 136),
    "edm": (124, 132),
    "future_bass": (140, 155),
    "ballad": (60, 92),
    "country_pop": (88, 106),
    "luna": (110, 122),
}

_MUSIC_XL_FALLBACK_BPM: Final[dict[str, int]] = {
    "drum and bass": 174,
    "dubstep": 140,
    "hardstyle": 150,
    "eurodance": 138,
    "trance": 138,
    "techno": 130,
    "edm": 128,
    "future_bass": 150,
    "ballad": 72,
    "country_pop": 96,
    "luna": 118,
}


def _clamp_suggest_llm(t: float, c: float, p: float) -> tuple[float, float, float]:
    return (
        max(0.0, min(1.0, float(t))),
        max(1.0, min(4.0, float(c))),
        max(0.8, min(0.98, float(p))),
    )


def _coerce_music_xl_bpm_for_style(style_key: str, bpm: int, *, fallback_bpm: int = _DEFAULT_PIPELINE_BPM) -> int:
    sk = (style_key or "pop").strip().lower() or "pop"
    fb = max(10, min(300, int(round(_MUSIC_XL_FALLBACK_BPM.get(sk, fallback_bpm)))))
    n = max(10, min(300, int(round(bpm))))
    guard = _MUSIC_XL_BPM_GUARDS.get(sk)
    if not guard:
        return n
    lo, hi = guard
    if n < lo or n > hi:
        return fb
    return n


def _normalize_main_vocal(raw: str) -> str:
    v = (raw or "female").strip().lower()
    return v if v in ("male", "female", "duet") else "female"


def _companion_ugs_workflow_v2(args: Mapping[str, Any]) -> str:
    w = str(args.get("ugs_workflow") or args.get("ace_workflow") or "v2").strip().lower()
    return w if w in ("v2", "v2_base", "v2_sft") else "v2"


def _companion_voice_diversity(args: Mapping[str, Any]) -> str:
    return str(args.get("voice_diversity") or "balanced").strip().lower() or "balanced"


def _companion_luna_mode(args: Mapping[str, Any]) -> str | None:
    lm = str(args.get("luna_mode") or "").strip().lower()
    return lm if lm in ("classic", "experimental") else None


def _companion_music_wizard_theme(user_line: str, args: Mapping[str, Any]) -> str:
    """Theme for ``POST /music-generator/lyrics`` (autoplay / repeat phrases stripped)."""

    explicit = str(args.get("theme") or "").strip()
    if explicit:
        return explicit[:MAX_WIZARD_THEME_CHARS]
    s = (user_line or "").strip()
    m = _MUSIC_GENERATION_AUTOPLAY_RE.search(s)
    if m:
        s = (s[: m.start()] + s[m.end() :]).strip()
    s = _MUSIC_ANOTHER_ONE_PREFIX_RE.sub("", s, count=1).strip()
    s = _MUSIC_WIZARD_LEADING_CMD_RE.sub("", s, count=1).strip()
    s = re.sub(r"\s+", " ", s)
    from api.ewa_platform.companion.orchestration.companion_music_creative_context import (
        strip_deictic_music_preset_tail,
    )

    s = strip_deictic_music_preset_tail(s)
    return (s or "")[:MAX_WIZARD_THEME_CHARS]


async def _companion_resolve_music_generation_inputs(
    *,
    pool: asyncpg.Pool | None,
    principal_id: str,
    user_line: str,
    args: Mapping[str, Any],
    intent_kind: str = "music_generation_background",
    profile: Mapping[str, Any] | None = None,
) -> tuple[str, str, str, str | None, str, str]:
    """Resolve theme/style/voice/language for music wizard; reuse prior run on retry / another-one phrases."""

    is_retry = _user_line_requests_music_retry(user_line)
    is_another = _user_line_requests_music_another_one(user_line)
    reuse_prior = is_retry or is_another
    prior_plan: Mapping[str, Any] = {}
    if reuse_prior and pool is not None:
        prior_run: dict[str, Any] | None = None
        if is_another:
            prior_run = await companion_pg.companion_task_find_latest_completed_by_intent(
                pool,
                principal_id=principal_id,
                intent_kind=intent_kind,
            )
            if prior_run is None:
                prior_run = await companion_pg.companion_task_find_latest_failed_by_intent(
                    pool,
                    principal_id=principal_id,
                    intent_kind=intent_kind,
                )
        elif is_retry:
            prior_run = await companion_pg.companion_task_find_latest_failed_by_intent(
                pool,
                principal_id=principal_id,
                intent_kind=intent_kind,
            )
        if prior_run is not None:
            raw_plan = prior_run.get("plan_payload")
            if isinstance(raw_plan, Mapping):
                prior_plan = raw_plan

    style_key = str(args.get("style") or args.get("genre") or prior_plan.get("style") or "pop").strip().lower() or "pop"
    vocal_eff = _normalize_main_vocal(str(args.get("vocal") or "female"))
    luna_mode = _companion_luna_mode(args) or (
        str(prior_plan.get("luna_mode") or "").strip().lower() or None
        if str(prior_plan.get("luna_mode") or "").strip().lower() in ("classic", "experimental")
        else None
    )
    voice_diversity = (
        str(args.get("voice_diversity") or prior_plan.get("voice_diversity") or "balanced").strip().lower()
    )
    if not voice_diversity:
        voice_diversity = "balanced"

    theme = _companion_music_wizard_theme(user_line, args)
    ewa_companion_context = str(args.get("ewa_companion_context") or "").strip()[:MAX_EWA_COMPANION_CONTEXT_CHARS]
    prior_theme = str(prior_plan.get("theme_preview") or "").strip()
    if (
        reuse_prior
        and prior_theme
        and (
            not theme
            or (is_retry and (len(theme) < 12 or _user_line_requests_music_retry(theme)))
            or (is_another and len(theme) < 8)
        )
    ):
        theme = prior_theme[:MAX_WIZARD_THEME_CHARS]

    from api.ewa_platform.companion.orchestration.companion_deictic_turn_context import (
        resolve_deictic_turn_context,
    )

    resolved = resolve_deictic_turn_context(user_line, profile, stripped_topic=theme)
    from api.ewa_platform.companion.orchestration.companion_music_creative_context import (
        build_music_companion_creative_context,
        companion_deictic_wizard_theme,
    )

    ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
    built_context = build_music_companion_creative_context(
        user_line=user_line,
        args=args,
        profile=profile,
        deictic=resolved,
        ru=ru,
    )
    if resolved is not None:
        theme = companion_deictic_wizard_theme(resolved, ru=ru)
    if built_context.strip():
        if not ewa_companion_context:
            ewa_companion_context = built_context
        elif built_context not in ewa_companion_context:
            ewa_companion_context = f"{built_context}\n\n{ewa_companion_context}"[:MAX_EWA_COMPANION_CONTEXT_CHARS]
        else:
            ewa_companion_context = built_context[:MAX_EWA_COMPANION_CONTEXT_CHARS]

    return theme, style_key, vocal_eff, luna_mode, voice_diversity, ewa_companion_context


def _companion_parse_bpm_duration(args: Mapping[str, Any]) -> tuple[int | None, int | None]:
    bpm: int | None = None
    bpm_raw = args.get("bpm")
    if bpm_raw is not None and str(bpm_raw).strip():
        try:
            bpm = max(10, min(300, int(float(bpm_raw))))
        except (TypeError, ValueError):  # fmt: skip
            bpm = None
    duration_seconds: int | None = None
    duration_raw = args.get("duration") or args.get("duration_seconds")
    if duration_raw is not None and str(duration_raw).strip():
        try:
            duration_seconds = max(30, min(300, int(float(duration_raw))))
        except (TypeError, ValueError):  # fmt: skip
            duration_seconds = None
    return bpm, duration_seconds


def _music_track_descriptions_for_companion(*, track_name: str, style: str, lyrics_sample: str) -> tuple[str, str]:
    """RU/EN summaries after Music Generator wizard (v2 XL Turbo path) returns — before optional playback confirm."""

    excerpt = (lyrics_sample or "").strip().replace("\n", " ")
    if len(excerpt) > 220:
        excerpt = excerpt[:217] + "…"
    tn = track_name.strip()
    safe_style = (style or "pop").strip()
    safe_ru = tn or "новый трек"
    safe_en = tn or "new track"
    desc_ru = f"Готова: сгенерировала трек «{safe_ru}» (стиль: {safe_style})."
    desc_en = f"Done: I generated “{safe_en}” (style: {safe_style})."
    if excerpt:
        desc_ru += f" Замысел / текст: {excerpt}"
        desc_en += f" Lyrics idea: {excerpt}"
    return desc_ru, desc_en


_BACKGROUND_MUSIC_TASKS: set[asyncio.Task[Any]] = set()


def _remember_background_music_task(task: asyncio.Task[Any]) -> None:
    """Keep a strong reference for detached music tasks and log terminal failures."""

    _BACKGROUND_MUSIC_TASKS.add(task)

    def _done(fut: asyncio.Task[Any]) -> None:
        _BACKGROUND_MUSIC_TASKS.discard(fut)
        try:
            fut.result()
        except Exception as exc:  # noqa: BLE001
            logger.exception("[STEP] companion_music_generation_background_crash err=%s", exc)

    task.add_done_callback(_done)


async def _run_background_music_generation_job(
    *,
    companion_pool: asyncpg.Pool,
    principal_id: str,
    run_id: str,
    step_id: str,
    catalog_user_id: str = "",
    base_url: str = "",
    headers: Mapping[str, str] | None = None,
    style_key: str,
    vocal_eff: str,
    language_e: str,
    ugs_wf: str,
    theme: str,
    lyrics_arg: str,
    voice_diversity: str,
    luna_mode: str | None,
    bpm_override: int | None,
    duration_override: int | None,
    name_arg: str,
    explicit_tags: str,
    skip_lyrics_validation: bool,
    autoplay_requested: bool,
    billing_mode: str = "wizard",
    ksampler_use_comfy_template: bool = False,
    ewa_companion_context: str = "",
) -> None:
    """Execute full music wizard pipeline in background and persist run status."""

    _ = base_url, headers  # legacy Celery payloads; pipeline uses direct service calls

    from api.core.http_clients import init_http_clients

    await init_http_clients()

    async def _mark_failed(
        *,
        message: str,
        stage: str,
        http_status: int | None = None,
        body_prefix: str = "",
        exception_name: str = "",
    ) -> None:
        fail_payload: dict[str, Any] = {
            "message": message[:500],
            "stage": stage[:80],
        }
        if http_status is not None:
            fail_payload["http_status"] = int(http_status)
        if body_prefix:
            fail_payload["body_prefix"] = body_prefix[:800]
        if exception_name:
            fail_payload["exception"] = exception_name[:120]
        from api.ewa_platform.companion.jobs.music_pipeline_progress import (
            music_stage_index,
            publish_music_pipeline_step,
            publish_music_task_failed,
        )

        ru_locale = str(language_e or "ru").strip().lower().startswith("ru")
        stage_idx = music_stage_index(stage)
        if stage_idx is not None:
            await publish_music_pipeline_step(
                principal_id=principal_id,
                run_id=run_id,
                stage_index=stage_idx,
                status="failed",
                ru=ru_locale,
            )
        from api.ewa_platform.companion.orchestration.run_lifecycle import apply_companion_run_terminal

        run_row = await companion_pg.companion_task_run_fetch(companion_pool, run_id=run_id)
        if run_row is None:
            return
        updated = await apply_companion_run_terminal(
            companion_pool,
            run=run_row,
            status="failed",
            context="music_job_fail",
            error_payload=fail_payload,
        )
        if updated is None:
            return
        await companion_pg.companion_task_step_update(
            companion_pool,
            step_id=step_id,
            status="failed",
            error_payload=fail_payload,
        )
        await publish_music_task_failed(
            principal_id=principal_id,
            run_id=run_id,
            error_payload=fail_payload,
            stage=stage,
        )
        from api.ewa_platform.agentic.jobs.child_reconcile import (
            maybe_complete_agentic_awaiting_child_from_run,
        )

        await maybe_complete_agentic_awaiting_child_from_run(
            companion_pool,
            child_run_id=run_id,
            principal_id=principal_id,
        )

    try:
        from api.ewa_platform.companion.jobs.music_pipeline_progress import (
            publish_music_pipeline_step,
            publish_music_task_completed,
        )
        from api.services.companion_music_pipeline import (
            CompanionMusicPipelineError,
            execute_companion_music_wizard,
        )

        ru_locale = str(language_e or "ru").strip().lower().startswith("ru")
        w_temp, w_cfg, w_top = _WIZARD_LLM_TEMPERATURE, _WIZARD_LLM_CFG, _WIZARD_LLM_TOP_P
        suggest_t, suggest_c, suggest_p = _clamp_suggest_llm(w_temp, w_cfg, w_top)
        uid = str(catalog_user_id or principal_id or "").strip()

        async def _on_stage(stage_index: int, status: str) -> None:
            await publish_music_pipeline_step(
                principal_id=principal_id,
                run_id=run_id,
                stage_index=stage_index,
                status=status,
                ru=ru_locale,
            )

        pipeline_result = await execute_companion_music_wizard(
            catalog_user_id=uid,
            run_id=run_id,
            step_id=step_id,
            principal_id=principal_id,
            style_key=style_key,
            vocal_eff=vocal_eff,
            language_e=language_e,
            ugs_wf=ugs_wf,
            theme=theme,
            lyrics_arg=lyrics_arg,
            voice_diversity=voice_diversity,
            luna_mode=luna_mode,
            bpm_override=bpm_override,
            duration_override=duration_override,
            name_arg=name_arg,
            explicit_tags=explicit_tags,
            skip_lyrics_validation=skip_lyrics_validation,
            billing_mode=billing_mode,
            ksampler_use_comfy_template=ksampler_use_comfy_template,
            ewa_companion_context=ewa_companion_context,
            w_temp=w_temp,
            w_cfg=w_cfg,
            w_top=w_top,
            suggest_t=suggest_t,
            suggest_c=suggest_c,
            suggest_p=suggest_p,
            default_pipeline_bpm=_DEFAULT_PIPELINE_BPM,
            clamp_lyrics=_clamp_companion_pipeline_lyrics,
            coerce_bpm_for_style=_coerce_music_xl_bpm_for_style,
            on_stage=_on_stage,
        )
        content_id = pipeline_result.content_id
        track_name = pipeline_result.track_name
        next_lyrics = pipeline_result.next_lyrics
        desc_ru, desc_en = _music_track_descriptions_for_companion(
            track_name=track_name,
            style=style_key,
            lyrics_sample=next_lyrics,
        )
        result_payload = {
            "content_id": content_id,
            "track_name": track_name or content_id,
            "description_ru": desc_ru,
            "description_en": desc_en,
            "style": style_key,
            "autoplay_requested": bool(autoplay_requested),
            "bpm": pipeline_result.gen_bpm,
            "duration_seconds": pipeline_result.gen_duration_seconds,
        }
        from api.ewa_platform.companion.orchestration.run_lifecycle import apply_companion_run_terminal

        # E2: OCC first — cancel wins; do not mark step completed if run terminalize skipped.
        run_row = await companion_pg.companion_task_run_fetch(companion_pool, run_id=run_id)
        if run_row is None:
            return
        updated = await apply_companion_run_terminal(
            companion_pool,
            run=run_row,
            status="completed",
            context="music_job_complete",
            result_payload=result_payload,
        )
        if updated is None:
            return
        await companion_pg.companion_task_step_update(
            companion_pool,
            step_id=step_id,
            status="completed",
            output_payload=result_payload,
        )
        from api.ewa_platform.agentic.jobs.child_reconcile import (
            maybe_complete_agentic_awaiting_child_from_run,
        )
        from api.ewa_platform.companion.workflows.action.advance import (
            maybe_advance_workflow_after_music_step,
        )
        from api.ewa_platform.companion.workflows.dag.dag_async_resume import maybe_advance_workflow_from_child_run

        # Trust T4 / V-L1: always emit child ``task_completed`` before workflow advance early-returns.
        await maybe_complete_agentic_awaiting_child_from_run(
            companion_pool,
            child_run_id=run_id,
            principal_id=principal_id,
        )
        await publish_music_pipeline_step(
            principal_id=principal_id,
            run_id=run_id,
            stage_index=4,
            status="completed",
            ru=ru_locale,
        )
        await publish_music_task_completed(
            principal_id=principal_id,
            run_id=run_id,
            result_payload=result_payload,
        )

        if await maybe_advance_workflow_from_child_run(
            companion_pool,
            child_run_id=run_id,
            result_payload=result_payload,
        ):
            logger.info(
                "[STEP] companion_music_generation_background_completed run_id=%s content_id=%s workflow=declarative_advanced",
                run_id,
                content_id,
            )
            return

        if await maybe_advance_workflow_after_music_step(
            companion_pool,
            run_id=run_id,
            principal_id=principal_id,
            result_payload=result_payload,
            ru_locale=ru_locale,
        ):
            logger.info(
                "[STEP] companion_music_generation_background_completed run_id=%s content_id=%s workflow=advanced",
                run_id,
                content_id,
            )
            return
        logger.info(
            "[STEP] companion_music_generation_background_completed run_id=%s content_id=%s",
            run_id,
            content_id,
        )
    except CompanionMusicPipelineError as exc:
        await _mark_failed(
            message=exc.message,
            stage=exc.stage,
            http_status=exc.http_status,
            body_prefix=exc.body_prefix,
        )
        return
    except Exception as exc:  # noqa: BLE001 — detached background boundary
        logger.exception("[STEP] companion_music_generation_background_failed run_id=%s err=%s", run_id, exc)
        try:
            await _mark_failed(
                message=str(exc)[:500] or "music_generation_background_exception",
                stage="background-exception",
                exception_name=type(exc).__name__,
            )
        except Exception as run_exc:  # noqa: BLE001
            logger.warning("[STEP] companion_music_generation_background_run_update_failed err=%s", run_exc)


async def _handle_music_generation(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """Queue Music Generator **Версия 2 / XL Turbo** pipeline as a durable background operation.

    The chat turn returns immediately after creating a task-run and one running step; the full wizard chain
    (``/lyrics`` → ``/suggest-production-params`` → ``/generate-style`` → ``/generate``) executes in
    ``_run_background_music_generation_job`` so the user can continue chatting without blocking.
    """

    if not _companion_backend_music_generation_enabled():
        return None

    user_line = str(args.get("user_line") or ctx.user_line or "")
    if not user_line.strip():
        return None
    if _user_line_is_music_feedback_or_praise(user_line):
        logger.info(
            "[STEP] companion_music_generation_skip reason=music_feedback_or_praise line_chars=%d",
            len(user_line),
        )
        return None
    if _looks_like_non_executing_question(user_line) and not _tool_router_bypass_line_match(args):
        return None
    if not _user_line_requests_music_creation(user_line, ctx.profile) and not _tool_router_bypass_line_match(args):
        logger.info(
            "[STEP] companion_music_generation_skip reason=line_no_match line_chars=%d",
            len(user_line),
        )
        return None

    ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
    language_e = str(args.get("language") or ("ru" if ru else "en")).strip() or ("ru" if ru else "en")
    token = (ctx.bearer_token or "").strip()
    if not token or ctx.auth_user is None:
        logger.info("[STEP] companion_tool_music_generation_unavailable reason=missing_auth_context")
        return ToolResult(
            tool="music_generation",
            status="unavailable",
            reply=(
                "Запущу генерацию трека, как только подгрузится сессия — попроси ещё раз через пару секунд."
                if ru
                else "I'll start track generation once the session is loaded — please ask again in a moment."
            ),
            actions=[],
            data={},
            task_run=None,
        )

    ugs_wf = _companion_ugs_workflow_v2(args)
    bpm_override, duration_override = _companion_parse_bpm_duration(args)
    lyrics_arg = str(args.get("lyrics") or "").strip()
    pool = ctx.companion_pool
    (
        theme,
        style_key,
        vocal_eff,
        luna_mode,
        voice_diversity,
        ewa_companion_context,
    ) = await _companion_resolve_music_generation_inputs(
        pool=pool,
        principal_id=ctx.principal_id,
        user_line=user_line,
        args=args,
        profile=ctx.profile if isinstance(ctx.profile, Mapping) else None,
    )
    if not lyrics_arg and not theme:
        if _user_line_requests_music_retry(user_line):
            reply = (
                "Не смогла подтянуть тему последней неудачной генерации — опиши тему или попроси новую песню целиком."
                if ru
                else "I could not reuse the last failed generation theme — describe the topic or ask for a new song."
            )
        elif _user_line_requests_music_another_one(user_line):
            reply = (
                "Не нашла тему прошлого трека — напиши, о чём новая песня, или повтори тему целиком."
                if ru
                else "I could not reuse the previous track theme — describe the new song topic."
            )
        else:
            reply = (
                "Нужна тема или текст песни — опиши, о чём трек."
                if ru
                else "I need a theme or lyrics — describe what the track should be about."
            )
        return ToolResult(
            tool="music_generation",
            status="error",
            reply=reply,
            actions=[],
            data={},
            task_run=None,
        )

    voice_diversity = voice_diversity or _companion_voice_diversity(args)
    name_arg = str(args.get("name") or "").strip()
    explicit_tags = str(args.get("tags") or "").strip()
    skip_lyrics_validation = bool(args.get("skip_lyrics_validation"))
    from api.ewa_platform.companion.jobs.config import companion_async_music_enabled

    use_celery_music = companion_async_music_enabled()
    base = _music_generation_api_base_url(for_remote_worker=use_celery_music).rstrip("/")
    http_headers = {"Authorization": f"Bearer {token}"}

    autoplay = _music_generation_autoplay_requested(user_line, args)
    if pool is None:
        logger.warning("[STEP] companion_music_generation_skip reason=no_companion_pool")
        return ToolResult(
            tool="music_generation",
            status="error",
            reply=(
                "Не смогла сохранить фоновую операцию генерации — попробуй ещё раз."
                if ru
                else "I could not save the background generation operation — please try again."
            ),
            actions=[],
            data={},
            task_run=None,
        )

    if use_celery_music:
        from api.ewa_platform.companion.jobs.run_capacity import (
            companion_music_capacity_exceeded,
            music_busy_reply,
        )

        if await companion_music_capacity_exceeded(pool, principal_id=ctx.principal_id):
            return ToolResult(
                tool="music_generation",
                status="unavailable",
                reply=music_busy_reply(ru=ru),
                actions=[],
                data={},
                task_run=None,
            )

    plan: dict[str, Any] = {
        "kind": "music_generation_background",
        "style": style_key,
        "theme_preview": theme[:MAX_WIZARD_THEME_CHARS],
        "lyrics_preview": lyrics_arg[:500],
        "voice_diversity": voice_diversity,
        "luna_mode": luna_mode or "",
        "autoplay_requested": bool(autoplay),
    }
    from api.ewa_platform.companion.workflows.user.workflow_parent_link import merge_workflow_parent_plan

    merge_workflow_parent_plan(plan, args)
    from api.ewa_platform.companion.jobs.enqueue import enqueue_companion_run

    run_row = await companion_pg.companion_task_run_create(
        pool,
        principal_id=ctx.principal_id,
        intent_kind="music_generation_background",
        user_message=user_line,
        plan_payload=plan,
        confirmation_state={},
        status="running",
        execution_mode="async" if use_celery_music else "sync",
    )
    step_row = await companion_pg.companion_task_step_create(
        pool,
        run_id=str(run_row["id"]),
        step_index=1,
        step_kind="music_generation_pipeline_v2",
        title="Run music wizard pipeline in background",
        input_payload={
            "style": style_key,
            "style_key": style_key,
            "theme": theme,
            "theme_preview": theme[:MAX_WIZARD_THEME_CHARS],
            "vocal_eff": vocal_eff,
            "language_e": language_e,
            "ugs_wf": ugs_wf,
            "lyrics_supplied": bool(lyrics_arg),
            "lyrics_arg": lyrics_arg,
            "voice_diversity": voice_diversity,
            "luna_mode": luna_mode,
            "bpm_override": bpm_override,
            "duration_seconds_override": duration_override,
            "duration_override": duration_override,
            "name_arg": name_arg,
            "explicit_tags": explicit_tags,
            "skip_lyrics_validation": skip_lyrics_validation,
            "autoplay_requested": bool(autoplay),
            "base_url": base,
            "ewa_companion_context": ewa_companion_context,
        },
        status="running",
    )

    job_payload = {
        "step_id": str(step_row["id"]),
        "principal_id": ctx.principal_id,
        "catalog_user_id": (ctx.content_catalog_user_id or ctx.principal_id or "").strip(),
        "base_url": base,
        "headers": dict(http_headers),
        "style_key": style_key,
        "vocal_eff": vocal_eff,
        "language_e": language_e,
        "ugs_wf": ugs_wf,
        "theme": theme,
        "lyrics_arg": lyrics_arg,
        "voice_diversity": voice_diversity,
        "luna_mode": luna_mode,
        "bpm_override": bpm_override,
        "duration_override": duration_override,
        "name_arg": name_arg,
        "explicit_tags": explicit_tags,
        "skip_lyrics_validation": skip_lyrics_validation,
        "autoplay_requested": autoplay,
        "ewa_companion_context": ewa_companion_context,
    }

    terminal_status: ToolStatus = "ok"
    if use_celery_music:
        celery_id = enqueue_companion_run(
            run_id=str(run_row["id"]),
            step_index=1,
            job_payload=job_payload,
        )
        if celery_id is None:
            logger.warning("[STEP] companion_music_generation_celery_enqueue_failed run_id=%s", run_row.get("id"))
            await companion_pg.companion_task_step_update(
                pool,
                step_id=str(step_row["id"]),
                status="failed",
                error_payload={"message": "music_generation_enqueue_failed", "stage": "enqueue"},
            )
            await companion_pg.companion_task_run_update(
                pool,
                run_id=str(run_row["id"]),
                principal_id=ctx.principal_id,
                status="failed",
                error_payload={"message": "music_generation_enqueue_failed", "stage": "enqueue"},
            )
            return ToolResult(
                tool="music_generation",
                status="error",
                reply=(
                    "Не смогла поставить генерацию в очередь — попробуй ещё раз."
                    if ru
                    else "I could not queue track generation — please try again."
                ),
                actions=[],
                data={},
                task_run=run_row,
            )
        terminal_status = "accepted"
        logger.info(
            "[STEP] companion_tool_music_generation_enqueued_celery run_id=%s celery_task_id=%s autoplay=%s",
            str(run_row.get("id") or ""),
            celery_id,
            "true" if autoplay else "false",
        )
    else:
        bg_task = asyncio.create_task(
            _run_background_music_generation_job(
                companion_pool=pool,
                principal_id=ctx.principal_id,
                run_id=str(run_row["id"]),
                step_id=str(step_row["id"]),
                base_url=base,
                headers=dict(http_headers),
                style_key=style_key,
                vocal_eff=vocal_eff,
                language_e=language_e,
                ugs_wf=ugs_wf,
                theme=theme,
                lyrics_arg=lyrics_arg,
                voice_diversity=voice_diversity,
                luna_mode=luna_mode,
                bpm_override=bpm_override,
                duration_override=duration_override,
                name_arg=name_arg,
                explicit_tags=explicit_tags,
                skip_lyrics_validation=skip_lyrics_validation,
                autoplay_requested=autoplay,
                ewa_companion_context=ewa_companion_context,
            )
        )
        _remember_background_music_task(bg_task)
        logger.info(
            "[STEP] companion_tool_music_generation_started_background run_id=%s autoplay=%s",
            str(run_row.get("id") or ""),
            "true" if autoplay else "false",
        )

    reply = (
        "Запустила генерацию трека в фоне. Можно продолжать диалог без ожидания.\n\n"
        "Статус и результат появятся в блоке «Текущие операции». Когда трек будет готов, можно написать: "
        "«вижу, что песня готова — включай её»."
        if ru
        else "I started track generation in the background. You can continue chatting without waiting.\n\n"
        "Status and completion will appear in the Current operations panel. When it is ready, you can say: "
        '"I see the song is ready — play it."'
    )

    return ToolResult(
        tool="music_generation",
        status=terminal_status,
        reply=reply,
        actions=[],
        data={
            "run_id": str(run_row.get("id") or ""),
            "autoplay_requested": bool(autoplay),
            "background": True,
            "execution_mode": "async" if use_celery_music else "sync",
        },
        task_run=run_row,
    )


async def _handle_image_generation(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """Queue UGS image generation as a durable background operation."""

    from api.ewa_platform.companion.orchestration.companion_image_generation import (
        IMAGE_EDIT_INTENT,
        IMAGE_GENERATION_INTENT,
        IMAGE_STEP_KIND,
        IMAGE_TOOL_MODE_EDIT,
        companion_image_generation_enabled,
        extract_image_edit_prompt,
        extract_image_prompt,
        extract_source_content_id,
        persist_companion_image_attachment_source,
        resolve_companion_image_operation_mode,
        run_companion_image_generation_job,
        user_line_requests_attachment_image_edit,
        user_line_requests_image_analysis,
        user_line_requests_image_generation,
    )

    if not companion_image_generation_enabled():
        return None

    user_line = str(args.get("user_line") or ctx.user_line or "")
    if not user_line.strip():
        return None
    if user_line_requests_image_analysis(user_line):
        return None
    if _looks_like_non_executing_question(user_line) and not _tool_router_bypass_line_match(args):
        return None
    from api.ewa_platform.companion.orchestration.turn_context_guards import side_effect_tools_suppressed_for_turn

    if side_effect_tools_suppressed_for_turn(user_line, ctx.profile):
        return None
    if (
        not user_line_requests_image_generation(user_line)
        and not _tool_router_bypass_line_match(args)
        and not (ctx.image_attachment is not None and user_line_requests_attachment_image_edit(user_line))
    ):
        return None

    ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
    catalog_uid = (ctx.content_catalog_user_id or "").strip()
    if not catalog_uid:
        return ToolResult(
            tool="image_generation",
            status="unavailable",
            reply=(
                "Не смогла определить ваш каталог — попробуй ещё раз через пару секунд."
                if ru
                else "I could not resolve your content catalog — please try again in a moment."
            ),
            actions=[],
            data={},
            task_run=None,
        )

    operation_mode = resolve_companion_image_operation_mode(
        user_line,
        args,
        has_source_image=ctx.image_attachment is not None,
    )
    source_content_id = extract_source_content_id(user_line=user_line, args=args)
    if operation_mode == IMAGE_TOOL_MODE_EDIT and not source_content_id and ctx.image_attachment is not None:
        try:
            source_content_id = await persist_companion_image_attachment_source(
                catalog_user_id=catalog_uid,
                image_attachment=ctx.image_attachment,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("[STEP] companion_tool_image_source_persist_failed err=%s", exc)
            return ToolResult(
                tool="image_generation",
                status="error",
                reply=(
                    "Не смогла сохранить исходное изображение для редактирования."
                    if ru
                    else "I could not save the source image for editing."
                ),
                actions=[],
                data={"exception": exc.__class__.__name__, "message": str(exc)[:300]},
                task_run=None,
            )

    prompt = (
        extract_image_edit_prompt(user_line, args)
        if operation_mode == IMAGE_TOOL_MODE_EDIT
        else extract_image_prompt(user_line, args)
    )
    if len(prompt.strip()) < 3:
        prompt_error_reply = (
            (
                "Опиши, что сделать с изображением."
                if operation_mode == IMAGE_TOOL_MODE_EDIT
                else "Опиши, что нарисовать — тему или сюжет картинки."
            )
            if ru
            else (
                "Describe how to edit the image."
                if operation_mode == IMAGE_TOOL_MODE_EDIT
                else "Describe what to draw — the subject or scene for the image."
            )
        )
        return ToolResult(
            tool="image_generation",
            status="error",
            reply=prompt_error_reply,
            actions=[],
            data={},
            task_run=None,
        )
    if operation_mode == IMAGE_TOOL_MODE_EDIT and not source_content_id:
        return ToolResult(
            tool="image_generation",
            status="error",
            reply=(
                "Для редактирования нужна исходная картинка: прикрепи изображение или укажи `uc=<id>` готового файла."
                if ru
                else "Image editing needs a source image: attach one or provide `uc=<id>` for an existing file."
            ),
            actions=[],
            data={"image_tool_mode": operation_mode, "reason": "source_image_required"},
            task_run=None,
        )

    pool = ctx.companion_pool
    if pool is None:
        return ToolResult(
            tool="image_generation",
            status="error",
            reply=(
                "Не смогла сохранить фоновую операцию — попробуй ещё раз."
                if ru
                else "I could not save the background operation — please try again."
            ),
            actions=[],
            data={},
            task_run=None,
        )

    aspect_ratio = str(args.get("aspect_ratio") or "1:1").strip() or "1:1"
    intent_kind = IMAGE_EDIT_INTENT if operation_mode == IMAGE_TOOL_MODE_EDIT else IMAGE_GENERATION_INTENT
    plan: dict[str, Any] = {
        "kind": intent_kind,
        "image_tool_mode": operation_mode,
        "operation_mode": operation_mode,
        "prompt_preview": prompt[:240],
        "aspect_ratio": aspect_ratio,
    }
    if source_content_id:
        plan["source_content_id"] = source_content_id
        plan["source_unified_content_id"] = source_content_id
    from api.ewa_platform.companion.workflows.user.workflow_parent_link import merge_workflow_parent_plan

    merge_workflow_parent_plan(plan, args)
    from api.ewa_platform.companion.jobs.config import companion_async_jobs_enabled
    from api.ewa_platform.companion.jobs.enqueue import enqueue_companion_run

    use_celery = companion_async_jobs_enabled()
    if use_celery:
        from api.ewa_platform.companion.jobs.run_capacity import (
            companion_image_capacity_exceeded,
            image_busy_reply,
        )

        if await companion_image_capacity_exceeded(pool, principal_id=ctx.principal_id):
            return ToolResult(
                tool="image_generation",
                status="unavailable",
                reply=image_busy_reply(ru=ru),
                actions=[],
                data={},
                task_run=None,
            )

    run_row = await companion_pg.companion_task_run_create(
        pool,
        principal_id=ctx.principal_id,
        intent_kind=intent_kind,
        user_message=user_line,
        plan_payload=plan,
        confirmation_state={},
        status="running",
        execution_mode="async" if use_celery else "sync",
    )
    step_row = await companion_pg.companion_task_step_create(
        pool,
        run_id=str(run_row["id"]),
        step_index=1,
        step_kind=IMAGE_STEP_KIND,
        title="Edit image via UGS" if operation_mode == IMAGE_TOOL_MODE_EDIT else "Generate image via UGS",
        input_payload={
            "catalog_user_id": catalog_uid,
            "image_tool_mode": operation_mode,
            "operation_mode": operation_mode,
            "prompt": prompt,
            "prompt_preview": prompt[:240],
            "aspect_ratio": aspect_ratio,
            "negative_prompt": "",
            **({"source_content_id": source_content_id} if source_content_id else {}),
        },
        status="running",
    )

    job_payload: dict[str, Any] = {
        "catalog_user_id": catalog_uid,
        "prompt": prompt,
        "aspect_ratio": aspect_ratio,
        "operation_mode": operation_mode,
        "source_content_id": source_content_id,
    }
    terminal_status: str = "ok"
    if use_celery:
        celery_id = enqueue_companion_run(
            run_id=str(run_row["id"]),
            step_index=1,
            job_payload=job_payload,
        )
        if celery_id is None:
            await companion_pg.companion_task_step_update(
                pool,
                step_id=str(step_row["id"]),
                status="failed",
                error_payload={"message": "image_generation_enqueue_failed", "stage": "enqueue"},
            )
            await companion_pg.companion_task_run_update(
                pool,
                run_id=str(run_row["id"]),
                principal_id=ctx.principal_id,
                status="failed",
                error_payload={"message": "image_generation_enqueue_failed", "stage": "enqueue"},
            )
            return ToolResult(
                tool="image_generation",
                status="error",
                reply=(
                    "Не смогла поставить генерацию картинки в очередь — попробуй ещё раз."
                    if ru
                    else "I could not queue image generation — please try again."
                ),
                actions=[],
                data={},
                task_run=run_row,
            )
        terminal_status = "accepted"
        logger.info(
            "[STEP] companion_tool_image_generation_enqueued_celery run_id=%s celery_task_id=%s",
            str(run_row.get("id") or ""),
            celery_id,
        )
    else:
        bg_task = asyncio.create_task(
            run_companion_image_generation_job(
                companion_pool=pool,
                principal_id=ctx.principal_id,
                run_id=str(run_row["id"]),
                step_id=str(step_row["id"]),
                catalog_user_id=catalog_uid,
                prompt=prompt,
                aspect_ratio=aspect_ratio,
                operation_mode=operation_mode,
                source_content_id=source_content_id,
            )
        )

        def _log_image_task_done(task: asyncio.Task[None]) -> None:
            with contextlib.suppress(asyncio.CancelledError, Exception):
                task.result()

        bg_task.add_done_callback(_log_image_task_done)
        logger.info(
            "[STEP] companion_tool_image_generation_started_background run_id=%s prompt_chars=%d",
            str(run_row.get("id") or ""),
            len(prompt),
        )

    if operation_mode == IMAGE_TOOL_MODE_EDIT:
        reply = (
            "Запустила редактирование изображения в фоне. Готовый вариант появится в «Текущих операциях»."
            if ru
            else "I started image editing in the background. The edited image will appear in Current operations."
        )
    else:
        reply = (
            "Запустила генерацию картинки в фоне. Можно продолжать диалог.\n\n"
            "Готовое изображение появится в блоке «Текущие операции» — там можно увеличить, скачать, "
            "отправить в GAF или прикрепить ко мне для анализа."
            if ru
            else "I started image generation in the background. You can keep chatting.\n\n"
            "When it is ready, it will appear in Current operations — enlarge, download, share to GAF, "
            "or attach it here for analysis."
        )

    return ToolResult(
        tool="image_generation",
        status=terminal_status,
        reply=reply,
        actions=[],
        data={
            "run_id": str(run_row.get("id") or ""),
            "background": True,
            "image_tool_mode": operation_mode,
            "prompt_preview": prompt[:240],
            **({"source_content_id": source_content_id} if source_content_id else {}),
        },
        task_run=run_row,
    )


async def _handle_presentation_generation(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """Queue existing EWRP presentation generation as a durable companion operation."""

    from api.ewa_platform.companion.orchestration.companion_presentation_generation import (
        PRESENTATION_GENERATION_INTENT,
        PRESENTATION_STEP_KIND,
        companion_presentation_generation_enabled,
        extract_presentation_slide_count,
        extract_presentation_theme,
        extract_presentation_title,
        extract_presentation_web_search_quality,
        presentation_generation_api_base_url,
        resolve_presentation_topic_and_context,
        run_companion_presentation_generation_job,
        user_line_requests_presentation_generation,
    )

    if not companion_presentation_generation_enabled():
        return None
    user_line = str(args.get("user_line") or ctx.user_line or "")
    if not user_line.strip():
        return None
    if _looks_like_non_executing_question(user_line) and not _tool_router_bypass_line_match(args):
        return None
    from api.ewa_platform.companion.orchestration.turn_context_guards import side_effect_tools_suppressed_for_turn

    if side_effect_tools_suppressed_for_turn(user_line, ctx.profile):
        return None
    if not user_line_requests_presentation_generation(user_line) and not _tool_router_bypass_line_match(args):
        return None

    ru = any("\u0400" <= ch <= "\u04ff" for ch in user_line)
    token = (ctx.bearer_token or "").strip()
    if not token or ctx.auth_user is None:
        return ToolResult(
            tool="presentation_generation",
            status="unavailable",
            reply=(
                "Запущу презентацию, как только подгрузится сессия — попроси ещё раз через пару секунд."
                if ru
                else "I'll start the presentation once the session is loaded — please ask again in a moment."
            ),
            actions=[],
            data={},
            task_run=None,
        )
    pool = ctx.companion_pool
    if pool is None:
        return ToolResult(
            tool="presentation_generation",
            status="error",
            reply=(
                "Не смогла сохранить фоновую операцию презентации — попробуй ещё раз."
                if ru
                else "I could not save the presentation operation — please try again."
            ),
            actions=[],
            data={},
            task_run=None,
        )

    topic, extra_context = resolve_presentation_topic_and_context(
        user_line,
        ctx.profile if isinstance(ctx.profile, Mapping) else None,
        args,
    )
    if len(topic.strip()) < 2:
        return ToolResult(
            tool="presentation_generation",
            status="error",
            reply=(
                "Нужна тема презентации — напиши, о чём сделать слайды."
                if ru
                else "I need a presentation topic — describe what the slides should be about."
            ),
            actions=[],
            data={},
            task_run=None,
        )
    title = extract_presentation_title(user_line, topic, args)
    num_slides = extract_presentation_slide_count(user_line, args)
    presentation_theme = extract_presentation_theme(user_line, args)
    web_search_quality = extract_presentation_web_search_quality(args)
    default_slide_layout = str(args.get("default_slide_layout") or args.get("slide_layout") or "").strip()[:32]

    from api.ewa_platform.companion.jobs.config import companion_async_jobs_enabled
    from api.ewa_platform.companion.jobs.enqueue import enqueue_companion_run
    from api.ewa_platform.companion.workflows.user.workflow_parent_link import merge_workflow_parent_plan

    use_celery = companion_async_jobs_enabled()
    if use_celery:
        from api.ewa_platform.companion.jobs.run_capacity import (
            companion_presentation_capacity_exceeded,
            presentation_busy_reply,
        )

        if await companion_presentation_capacity_exceeded(pool, principal_id=ctx.principal_id):
            return ToolResult(
                tool="presentation_generation",
                status="unavailable",
                reply=presentation_busy_reply(ru=ru),
                actions=[],
                data={},
                task_run=None,
            )

    base_url = presentation_generation_api_base_url(for_remote_worker=use_celery)
    plan: dict[str, Any] = {
        "kind": PRESENTATION_GENERATION_INTENT,
        "topic_preview": topic[:240],
        "title": title[:240],
        "num_slides": num_slides,
        "presentation_theme": presentation_theme,
    }
    merge_workflow_parent_plan(plan, args)
    step_input_payload: dict[str, Any] = {
        "topic": topic,
        "title": title,
        "num_slides": num_slides,
        "extra_context": extra_context,
        "presentation_theme": presentation_theme,
        "default_slide_layout": default_slide_layout,
        "web_search_quality": web_search_quality,
        "base_url": base_url,
    }

    run_row = await companion_pg.companion_task_run_create(
        pool,
        principal_id=ctx.principal_id,
        intent_kind=PRESENTATION_GENERATION_INTENT,
        user_message=user_line,
        plan_payload=plan,
        confirmation_state={},
        status="running",
        execution_mode="async" if use_celery else "sync",
    )
    step_row = await companion_pg.companion_task_step_create(
        pool,
        run_id=str(run_row["id"]),
        step_index=1,
        step_kind=PRESENTATION_STEP_KIND,
        title="Generate EWRP presentation",
        input_payload=step_input_payload,
        status="running",
    )

    job_payload: dict[str, Any] = {
        "principal_id": ctx.principal_id,
        "catalog_user_id": (ctx.content_catalog_user_id or ctx.principal_id or "").strip(),
        "headers": {"Authorization": f"Bearer {token}"},
    }
    terminal_status: ToolStatus = "ok"
    if use_celery:
        celery_id = enqueue_companion_run(
            run_id=str(run_row["id"]),
            step_index=1,
            job_payload=job_payload,
        )
        if celery_id is None:
            from api.ewa_platform.companion.orchestration.run_lifecycle import apply_companion_run_terminal

            enqueue_err = {
                "message": "presentation_generation_enqueue_failed",
                "stage": "enqueue",
            }
            # V-C2: OCC terminalize so a concurrent cancel cannot be overwritten.
            updated = await apply_companion_run_terminal(
                pool,
                run=run_row,
                status="failed",
                context="presentation_enqueue_fail",
                error_payload=enqueue_err,
            )
            if updated is not None:
                await companion_pg.companion_task_step_update(
                    pool,
                    step_id=str(step_row["id"]),
                    status="failed",
                    error_payload=enqueue_err,
                )
            return ToolResult(
                tool="presentation_generation",
                status="error",
                reply=(
                    "Не смогла поставить презентацию в очередь — попробуй ещё раз."
                    if ru
                    else "I could not queue presentation generation — please try again."
                ),
                actions=[],
                data={},
                task_run=updated or run_row,
            )
        terminal_status = "accepted"
        logger.info(
            "[STEP] companion_tool_presentation_generation_enqueued_celery run_id=%s celery_task_id=%s",
            str(run_row.get("id") or ""),
            celery_id,
        )
    else:
        bg_task = asyncio.create_task(
            run_companion_presentation_generation_job(
                companion_pool=pool,
                principal_id=ctx.principal_id,
                run_id=str(run_row["id"]),
                step_id=str(step_row["id"]),
                catalog_user_id=(ctx.content_catalog_user_id or ctx.principal_id or "").strip(),
                headers={"Authorization": f"Bearer {token}"},
                **step_input_payload,
            )
        )

        def _log_presentation_task_done(task: asyncio.Task[None]) -> None:
            with contextlib.suppress(asyncio.CancelledError, Exception):
                task.result()

        bg_task.add_done_callback(_log_presentation_task_done)
        logger.info(
            "[STEP] companion_tool_presentation_generation_started_background run_id=%s topic_chars=%d",
            str(run_row.get("id") or ""),
            len(topic),
        )

    reply = (
        "Запустила EWRP-презентацию в фоне. Можно продолжать диалог — прогресс и готовый PDF появятся "
        "в «Текущих операциях»."
        if ru
        else "I started an EWRP presentation in the background. You can keep chatting — progress and the PDF will "
        "appear in Current operations."
    )
    return ToolResult(
        tool="presentation_generation",
        status=terminal_status,
        reply=reply,
        actions=[],
        data={
            "run_id": str(run_row.get("id") or ""),
            "background": True,
            "topic_preview": topic[:240],
            "title": title[:240],
            "num_slides": num_slides,
            "presentation_theme": presentation_theme,
        },
        task_run=run_row,
    )


HANDLERS: Final[dict[str, ToolHandler]] = {
    "music_generation": _handle_music_generation,
    "image_generation": _handle_image_generation,
    "image_tool": _handle_image_generation,
    "presentation_generation": _handle_presentation_generation,
}

# Re-exported via ``tool_registry`` shim / tests (legacy Celery job URL resolver).
_SHIM_EXPORTS = (_resolve_music_job_base_url,)
