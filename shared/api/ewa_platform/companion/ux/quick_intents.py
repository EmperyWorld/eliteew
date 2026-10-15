# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Canonical quick-intent phrases for companion routing (client sends as normal chat messages).
# Keeps built-in chip prompts aligned with server orchestration hints for logs/tests.
# Invariants:
# - No separate HTTP API; phrases map to full user lines for orchestrator/tools.
# - ``prompt_ru`` must stay in sync with ``ewaCompanion.quickPresetDefaults.*.prompt`` (ru i18n).
# Related:
# - documentation/product/ewa/EWA-COMPANION-QUICK-INTENTS.md
# - documentation/product/ewa/EWA-COMPANION-SERVER-PLANS-ADR.md (Phase 5)
# - shared/web/frontend/src/features/ewa/ewaCompanionQuickPresetsUi.ts
# ---

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Final


class QuickIntentId(StrEnum):
    DOCUMENT_LIST = "documentList"
    DOCUMENT_OPEN = "documentOpen"
    DOCUMENT_CREATE = "documentCreate"
    DOCUMENT_REWRITE = "documentRewrite"
    CATALOG_DISCUSS = "catalogDiscuss"
    FILE_RENAME = "fileRename"
    FILE_DELETE = "fileDelete"
    IMAGE_GENERATE = "imageGenerate"
    IMAGE_EDIT = "imageEdit"
    IMAGE_ANALYZE = "imageAnalyze"
    PRESENTATION_CREATE = "presentationCreate"
    PRESENTATION_ON_TOPIC = "presentationOnTopic"
    SOCIAL_POST_COMPOSE = "socialPostCompose"
    MUSIC_GENERATE = "musicGenerate"
    MUSIC_ON_TOPIC = "musicOnTopic"
    MUSIC_STUDIO_OPEN = "musicStudioOpen"
    XL_BASE_INTERACTIVE = "xlBaseInteractive"
    MUSIC_AUTONOMOUS = "musicAutonomous"
    THEME_SET = "themeSet"
    PLAN_WEEK = "planWeek"
    OPERATIONS_STATUS = "operationsStatus"
    OPERATIONS_CANCEL = "operationsCancel"
    DESK_SNAPSHOT = "deskSnapshot"
    # Legacy phrases that may still be present in user-saved presets/history.
    BRIEF_SUMMARY = "briefSummary"
    FOCUS_TODAY = "focusToday"
    CLEARER_WORDS = "clearerWords"
    ENCOURAGE = "encourage"
    NEXT_STEP = "nextStep"
    BREAK_INTO_STEPS = "breakIntoSteps"
    REFLECT_WEEK = "reflectWeek"
    OPEN_CATALOG = "openCatalog"
    LIST_RECENT_DOCS = "listRecentDocs"
    OPEN_DOC_EDITOR = "openDocEditor"


@dataclass(frozen=True, slots=True)
class QuickIntentSpec:
    intent_id: QuickIntentId
    frontend_key: str
    prompt_ru: str
    route_hint: str
    workflow_id: str | None = None


def _normalize_phrase(text: str) -> str:
    return " ".join((text or "").strip().lower().split())


# Canonical RU prompts — sync with ru/marketing.json ``ewaCompanion.quickPresetDefaults``.
QUICK_INTENT_REGISTRY: tuple[QuickIntentSpec, ...] = (
    QuickIntentSpec(
        QuickIntentId.DOCUMENT_LIST,
        "documentList",
        "Покажи список моих документов из каталога прямо в EWA и предложи, какой открыть первым.",
        "catalog_list",
    ),
    QuickIntentSpec(
        QuickIntentId.DOCUMENT_OPEN,
        "documentOpen",
        "Открой нужный документ в рабочей области EWA. Если не хватает имени файла — спроси коротко.",
        "file_open",
    ),
    QuickIntentSpec(
        QuickIntentId.DOCUMENT_CREATE,
        "documentCreate",
        "Создай новый документ в EwaFile: черновик с понятным названием и структурой по моей текущей задаче.",
        "file_create",
    ),
    QuickIntentSpec(
        QuickIntentId.DOCUMENT_REWRITE,
        "documentRewrite",
        "Помоги отредактировать открытый документ: улучши структуру и формулировки, не теряя смысл.",
        "file_rewrite",
    ),
    QuickIntentSpec(
        QuickIntentId.CATALOG_DISCUSS,
        "catalogDiscuss",
        "Разбери релевантный файл из каталога по моей задаче: выдели ключевые мысли и предложи следующий шаг.",
        "catalog_discuss",
    ),
    QuickIntentSpec(
        QuickIntentId.FILE_RENAME,
        "fileRename",
        "Переименуй файл в каталоге: сначала уточни старое и новое имя, затем запроси подтверждение.",
        "file_rename",
    ),
    QuickIntentSpec(
        QuickIntentId.FILE_DELETE,
        "fileDelete",
        "Удали файл из каталога: покажи, что именно удаляется, и попроси подтверждение.",
        "file_delete",
    ),
    QuickIntentSpec(
        QuickIntentId.IMAGE_GENERATE,
        "imageGenerate",
        "Сгенерируй изображение по моей идее. Если идеи нет — предложи 3 коротких варианта промпта.",
        "image_generation",
    ),
    QuickIntentSpec(
        QuickIntentId.IMAGE_EDIT,
        "imageEdit",
        "Измени прикреплённую или последнюю картинку: сохрани главное, но улучши по моей инструкции.",
        "image_generation",
    ),
    QuickIntentSpec(
        QuickIntentId.IMAGE_ANALYZE,
        "imageAnalyze",
        "Опиши прикреплённую картинку и скажи, что с ней можно сделать дальше.",
        "chat_only",
    ),
    QuickIntentSpec(
        QuickIntentId.PRESENTATION_CREATE,
        "presentationCreate",
        "Создай презентацию по текущей теме: 7 слайдов, ясная структура, короткие тезисы.",
        "presentation_generation",
    ),
    QuickIntentSpec(
        QuickIntentId.PRESENTATION_ON_TOPIC,
        "presentationOnTopic",
        "Сделай презентацию на эту тему — возьми тему и контекст из моего последнего ответа Ассистента, подбери оформление.",
        "presentation_generation",
    ),
    QuickIntentSpec(
        QuickIntentId.SOCIAL_POST_COMPOSE,
        "socialPostCompose",
        "Сделай лонгрид для VK по нашей теме: эмодзи в заголовках, жирные подзаголовки, длинный готовый текст для копирования.",
        "social_post_compose",
    ),
    QuickIntentSpec(
        QuickIntentId.MUSIC_GENERATE,
        "musicGenerate",
        "Сгенерируй песню в фоне (XL Turbo): подбери тему и стиль по нашему разговору и запусти без открытия студии.",
        "music_generation",
    ),
    QuickIntentSpec(
        QuickIntentId.MUSIC_ON_TOPIC,
        "musicOnTopic",
        "Сделай песню на эту тему — возьми тему и контекст из моего последнего ответа Ассистента и запусти генерацию в фоне.",
        "music_generation",
    ),
    QuickIntentSpec(
        QuickIntentId.MUSIC_STUDIO_OPEN,
        "musicStudioOpen",
        "Открой музыкальную студию, чтобы запустить генерацию вручную.",
        "music_studio_open",
    ),
    QuickIntentSpec(
        QuickIntentId.XL_BASE_INTERACTIVE,
        "xlBaseInteractive",
        "Открой интерактивный мастер XL Base, чтобы выбрать тему, стиль, вокал и язык перед генерацией.",
        "music_xl_base_interactive",
    ),
    QuickIntentSpec(
        QuickIntentId.MUSIC_AUTONOMOUS,
        "musicAutonomous",
        "Запусти автономную генерацию песни: выбери жанр и настроение по нашей беседе и начни без лишних уточнений.",
        "music_generation_xl_base",
    ),
    QuickIntentSpec(
        QuickIntentId.OPERATIONS_STATUS,
        "operationsStatus",
        "Что сейчас выполняется в фоне? Покажи активные операции и их прогресс.",
        "operations_status",
    ),
    QuickIntentSpec(
        QuickIntentId.OPERATIONS_CANCEL,
        "operationsCancel",
        "Отмени текущую фоновую операцию и покажи обновлённый статус.",
        "operation_cancel",
    ),
    QuickIntentSpec(
        QuickIntentId.PLAN_WEEK,
        "planWeek",
        "Составь план на неделю по моей текущей задаче: цели, шаги и первый маленький результат.",
        "plan_v1",
    ),
    QuickIntentSpec(
        QuickIntentId.THEME_SET,
        "themeSet",
        "Переключи тему рабочего стола на тёмную. Если не уверена — предложи светлую или автоматическую.",
        "theme_set",
    ),
)

# Legacy RU prompts remain matchable for user-saved chips/history, but are not exposed as frontend built-ins.
LEGACY_QUICK_INTENT_REGISTRY: tuple[QuickIntentSpec, ...] = (
    QuickIntentSpec(
        QuickIntentId.BRIEF_SUMMARY,
        "briefSummary",
        "Дай короткий итог того, о чём мы только что говорили, и главный вывод.",
        "chat_only",
    ),
    QuickIntentSpec(
        QuickIntentId.FOCUS_TODAY,
        "focusToday",
        "На что мне сфокусироваться сегодня — одна-две конкретные приоритетные вещи?",
        "chat_only",
    ),
    QuickIntentSpec(
        QuickIntentId.CLEARER_WORDS,
        "clearerWords",
        "Помоги яснее и проще сформулировать мою мысль, не меняя смысл.",
        "chat_only",
    ),
    QuickIntentSpec(
        QuickIntentId.ENCOURAGE,
        "encourage",
        "Одна короткая искренняя поддерживающая фраза — без штампов.",
        "chat_only",
    ),
    QuickIntentSpec(
        QuickIntentId.NEXT_STEP,
        "nextStep",
        "Предложи самый маленький полезный следующий шаг, который я могу сделать в ближайшие минуты.",
        "chat_only",
    ),
    QuickIntentSpec(
        QuickIntentId.BREAK_INTO_STEPS,
        "breakIntoSteps",
        "Разбей мою текущую задачу на шаги — 3–5 конкретных пунктов с приоритетом.",
        "plan_v1",
    ),
    QuickIntentSpec(
        QuickIntentId.REFLECT_WEEK,
        "reflectWeek",
        "Подведи итоги недели",
        "workflow_reflect_week",
    ),
    QuickIntentSpec(
        QuickIntentId.OPEN_CATALOG,
        "openCatalog",
        "Открой менеджер контента с моей библиотекой файлов и кратко опиши, что в каталоге сейчас видно по снимку стола.",
        "app_open",
    ),
    QuickIntentSpec(
        QuickIntentId.LIST_RECENT_DOCS,
        "listRecentDocs",
        "Перечисли мои документы из каталога, которые релевантны открытым окнам, и предложи один файл для правки.",
        "catalog_discuss",
    ),
    QuickIntentSpec(
        QuickIntentId.DESK_SNAPSHOT,
        "deskSnapshot",
        "Кратко: что у меня открыто на рабочем столе и какой один следующий шаг по этим окнам?",
        "desk_context",
    ),
    QuickIntentSpec(
        QuickIntentId.OPEN_DOC_EDITOR,
        "openDocEditor",
        "Открой документ в редакторе документов (Ultimate Doc Editor). Если нужен uc — возьми из контекста стола или спроси имя файла.",
        "app_open",
    ),
)

_REGISTRY_BY_KEY: dict[str, QuickIntentSpec] = {spec.frontend_key: spec for spec in QUICK_INTENT_REGISTRY}
_MATCHABLE_REGISTRY: tuple[QuickIntentSpec, ...] = QUICK_INTENT_REGISTRY + LEGACY_QUICK_INTENT_REGISTRY


def quick_intent_frontend_keys() -> frozenset[str]:
    return frozenset(_REGISTRY_BY_KEY.keys())


def match_quick_intent(user_line: str) -> QuickIntentSpec | None:
    """Return the best matching built-in quick intent for a user line (longest prompt prefix wins)."""

    norm = _normalize_phrase(user_line)
    if not norm:
        return None
    best: QuickIntentSpec | None = None
    best_len = 0
    for spec in _MATCHABLE_REGISTRY:
        prompt_norm = _normalize_phrase(spec.prompt_ru)
        if not prompt_norm:
            continue
        if (norm == prompt_norm or norm.startswith(f"{prompt_norm} ") or norm.startswith(prompt_norm)) and len(
            prompt_norm
        ) > best_len:
            best = spec
            best_len = len(prompt_norm)
    return best


def user_line_matches_quick_intent(user_line: str, intent_id: QuickIntentId) -> bool:
    matched = match_quick_intent(user_line)
    return matched is not None and matched.intent_id == intent_id


class QuickIntentRouteKind(StrEnum):
    """How ``route_hint`` is wired in ``task_orchestrator`` after ``match_quick_intent``."""

    REGISTRY = "registry"
    WORKFLOW = "workflow"
    CHAT_ONLY = "chat_only"


# Chat LLM workflows (not tool-registry probes). ``workflow_reflect_week`` → ``reflect_week`` in chat runner.
QUICK_INTENT_WORKFLOW_ROUTE_HINTS: Final[frozenset[str]] = frozenset({"workflow_reflect_week"})

# Fall through to main companion LLM (``shell_context`` already in prompt for ``desk_context``).
QUICK_INTENT_CHAT_ONLY_ROUTE_HINTS: Final[frozenset[str]] = frozenset({"chat_only", "desk_context"})

_WORKFLOW_ROUTE_TO_WORKFLOW_ID: Final[dict[str, str]] = {
    "workflow_reflect_week": "reflect_week",
}


def all_quick_intent_specs() -> tuple[QuickIntentSpec, ...]:
    return (*QUICK_INTENT_REGISTRY, *LEGACY_QUICK_INTENT_REGISTRY)


def quick_intent_route_kind(route_hint: str) -> QuickIntentRouteKind:
    hint = str(route_hint or "").strip()
    if hint in QUICK_INTENT_WORKFLOW_ROUTE_HINTS:
        return QuickIntentRouteKind.WORKFLOW
    if hint in QUICK_INTENT_CHAT_ONLY_ROUTE_HINTS:
        return QuickIntentRouteKind.CHAT_ONLY
    return QuickIntentRouteKind.REGISTRY


def quick_intent_workflow_id_for_route_hint(route_hint: str) -> str | None:
    return _WORKFLOW_ROUTE_TO_WORKFLOW_ID.get(str(route_hint or "").strip())


def quick_intent_registry_bypass_route_hints() -> frozenset[str]:
    """Registry tool names probed with ``_tool_router_bypass_line_match`` when a quick intent matches."""

    return frozenset(
        spec.route_hint.strip()
        for spec in all_quick_intent_specs()
        if quick_intent_route_kind(spec.route_hint) == QuickIntentRouteKind.REGISTRY
    )


def is_quick_intent_workflow_route_hint(route_hint: str) -> bool:
    return str(route_hint or "").strip() in QUICK_INTENT_WORKFLOW_ROUTE_HINTS


# Legacy tuple for older imports/tests.
QUICK_INTENT_PHRASES: tuple[str, ...] = tuple(spec.prompt_ru for spec in _MATCHABLE_REGISTRY)


__all__ = (
    "QUICK_INTENT_PHRASES",
    "QUICK_INTENT_REGISTRY",
    "LEGACY_QUICK_INTENT_REGISTRY",
    "QUICK_INTENT_WORKFLOW_ROUTE_HINTS",
    "QUICK_INTENT_CHAT_ONLY_ROUTE_HINTS",
    "QuickIntentId",
    "QuickIntentRouteKind",
    "QuickIntentSpec",
    "all_quick_intent_specs",
    "is_quick_intent_workflow_route_hint",
    "match_quick_intent",
    "quick_intent_frontend_keys",
    "quick_intent_registry_bypass_route_hints",
    "quick_intent_route_kind",
    "quick_intent_workflow_id_for_route_hint",
    "user_line_matches_quick_intent",
)
