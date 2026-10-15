# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Select speakers, semantic task blocks, and delivery mode for legacy freeform ensemble turns.
# Invariants:
# - Substantive multi-speaker work is one joint artifact unless the user explicitly requests separate voices or discussion.
# - Social turns and direct hero pings remain conversational rather than document-like.
# Related:
# - api/services/desktop_chat_ensemble/archive/legacy_freeform/stream_turn.py
# - documentation/product/DESKTOP-LLAMA-CHAT.md
# ---

"""LLM planner: who speaks and in which order (ensemble)."""

from __future__ import annotations

import dataclasses
import logging
import re
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from api.models.desktop_ai_chat import DesktopAiChatMessage
from api.services.desktop_chat_ensemble.heroes import (
    HERO_ORCHESTRATOR_BLURB,
    HERO_SHORT_LABEL,
)
from api.services.desktop_chat_ensemble.settings import ENSEMBLE_MAX_ROSTER_HEROES
from api.services.llama_service import LlamaService

logger = logging.getLogger(__name__)

_REGISTRY_ZONE_TITLE_BY_HERO: dict[str, str] = {
    "max_safin": "MVP и UX",
    "viktor_engineer": "Система и интеграции",
    "elena_valeryevna": "Cost и ресурсы",
    "nikolas_alekseevich": "Стратегия и риски",
    "likiy_sorrento": "Стратегия и решения",
    "arlyqueen": "Маркетинг и ценность",
    "akimbo": "Adoption и доверие",
    "dr_vereskov": "Unit economics",
    "arlekino_pravoz": "Право и комплаенс",
    "suno_songwriter": "Операции и rollout",
    "nikita_dvizhev": "Недвижимость",
    "nadin_context": "Контекст и смыслы",
    "mark_arkadevich": "CEO-приоритеты",
    "kristian_romanovich": "Бренд и реклама",
    "artur_sergeevich": "Продажи и масштаб",
    "diana_igorevna": "Культура и талант",
    "viktor_lvovich": "Экспансия",
}
_REGISTRY_COUNT_WORDS: dict[str, int] = {
    "одному": 1,
    "одной": 1,
    "два": 2,
    "две": 2,
    "три": 3,
    "четыре": 4,
    "пять": 5,
    "шесть": 6,
    "семь": 7,
    "восемь": 8,
    "девять": 9,
    "десять": 10,
}
_REGISTRY_COUNT_RE = re.compile(
    r"\b(?:по|ровно)\s+(?P<count>\d{1,3}|одному|одной|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять)\b"
)


def _registry_zone_title(hero_id: str) -> str:
    hid = (hero_id or "").strip()
    if hid in _REGISTRY_ZONE_TITLE_BY_HERO:
        return _REGISTRY_ZONE_TITLE_BY_HERO[hid]
    return f"Зона: {HERO_SHORT_LABEL.get(hid, hid)}"


def parse_registry_list_count(user_excerpt: str) -> int:
    """Extract requested list size (default 10) from user text."""
    t = (user_excerpt or "").strip().casefold()
    match = _REGISTRY_COUNT_RE.search(t)
    if not match:
        return 10
    token = match.group("count")
    count = int(token) if token.isdigit() else _REGISTRY_COUNT_WORDS[token]
    return max(1, min(count, 30))


def user_requests_per_member_registry_list(user_excerpt: str) -> bool:
    """
    Per-member numbered app/service registry (e.g. «с каждого по 10 приложений, не повторяться»).
    Forces joint document + list-only speaker contract — not separate monologue bubbles.
    """
    t = (user_excerpt or "").strip().casefold()
    if not t or len(t) < 16:
        return False
    if user_project_assessment_question(user_excerpt) or user_panel_smalltalk_question(user_excerpt):
        return False
    each_member = any(
        needle in t
        for needle in (
            "каждый из вас",
            "каждый из команды",
            "каждый участник",
            "каждому участник",
            "каждый из геро",
            "каждому из геро",
            "с каждого",
            "с каждого из",
            "каждый внес",
            "каждый внёс",
            "каждый свой вклад",
            "вклад кажд",
        )
    )
    list_items = any(
        needle in t
        for needle in (
            "приложен",
            "приложения",
            "модул",
            "сервис",
            "утилит",
            "список",
            "реестр",
        )
    )
    count_or_unique = bool(re.search(r"(?:по|ровно)\s+\d+", t)) or any(
        needle in t
        for needle in (
            "по десять",
            "по 10",
            "повтор",
            "уникальн",
            "не повтор",
            "не дублир",
            "разных прилож",
            "разные прилож",
        )
    )
    if each_member and list_items and count_or_unique:
        return True
    return each_member and bool(re.search(r"по\s+\d+\s+прилож", t))


def user_prefers_unified_joint_artifact(user_excerpt: str) -> bool:
    """Эвристика: пользователь хочет один общий ответ команды, а не очередь отдельных пузырей."""
    t = (user_excerpt or "").strip().casefold()
    if not t:
        return False
    explicit = (
        "единый план",
        "единый документ",
        "создайте единый",
        "создай единый",
        "общий план",
        "одним текстом",
        "один общий",
        "объедините",
        "схлопни",
        "совместный план",
        "совместный ответ",
        "в одном сообщении",
        "полный план",
        "полный бизнес план",
        "бизнес план",
        "бизнес-план",
        "go-to-market",
        "gtm",
        "финансовая модель",
        "финмодель",
    )
    if any(x in t for x in explicit):
        return True
    if ("план от вас" in t or "план от команды" in t) and ("по пунктам" in t or "что делать" in t or "шаг" in t):
        return not any(
            bad in t
            for bad in (
                "отдельн",
                "каждый сам",
                "по очереди",
                "по очеред",
                "раздельн",
                "независим",
            )
        )
    return False


def user_explicitly_requests_separate_delivery(user_excerpt: str) -> bool:
    """Keep multiple bubbles only when the user asks for distinct voices or a debate."""
    text = (user_excerpt or "").strip().casefold()
    if not text:
        return False
    if "кажд" in text and "отдельн" in text:
        return True
    return any(
        needle in text
        for needle in (
            "каждый отдельно",
            "каждый сам",
            "по очереди",
            "раздельно",
            "раздельный ответ",
            "отдельными сообщениями",
            "независимые мнения",
            "независимо друг от друга",
            "кто что думает",
            "дискуссия",
            "обсудите между собой",
            "поспорьте",
            "дебаты",
        )
    )


def user_acknowledges_briefly(user_excerpt: str) -> bool:
    """Короткий backchannel/ack не должен запускать новую длинную генерацию панели."""
    t = (user_excerpt or "").strip().casefold()
    if not t or len(t) > 80:
        return False
    ack = (
        "ясно",
        "понятно",
        "ок",
        "окей",
        "ага",
        "угу",
        "принято",
        "спасибо",
        "норм",
        "нормально",
        "понял",
        "поняла",
    )
    return any(
        t == x or t.startswith(f"{x} ") or t.startswith(f"{x}.") or t.startswith(f"{x},") or t.startswith(f"{x}…")
        for x in ack
    )


def user_addresses_whole_panel_social(user_excerpt: str) -> bool:
    """Явное обращение ко всей панели (приветствие всем / ребятам) — несколько спикеров."""
    t = (user_excerpt or "").strip().casefold()
    if not t or len(t) > 480:
        return False
    if _has_substantive_work_or_search_signal(t):
        return False
    greet = (
        "привет",
        "здравств",
        "добрый",
        "доброе",
        "хай",
        "hello",
        "hi ",
        "йо",
    )
    if "всем" in t and any(g in t for g in greet):
        return True
    if (
        ("ребят" in t or "ребята" in t)
        and len(t) <= 200
        and any(g in t for g in greet + ("как ", "че ", "молч", "тупит"))
    ):
        return True
    if "каждый" in t and any(k in t for k in ("здоров", "ответ", "скаж", "поздоров")):
        return True
    return bool(
        "остальн" in t
        and len(t) <= 220
        and any(k in t for k in ("здоров", "привет", "молч", "не отвеч", "не говор", "где "))
    )


def _has_substantive_work_or_search_signal(user_excerpt: str) -> bool:
    """Рабочий/research/search turn — не social short, даже если есть «ребята»."""
    t = (user_excerpt or "").strip().casefold()
    if not t:
        return False
    needles = (
        "веб поиск",
        "веб-поиск",
        "web search",
        "web-search",
        "по гугл",
        "в интернете",
        "найди в сети",
        "поищи",
        "работаем",
        "с тем что есть",
        "бенчмарк",
        "capex",
        "цены конкурент",
        "аудит",
        "бриф",
        "бизнес-план",
        "бизнес план",
        "исследован",
        "данные",
        "цифр",
    )
    return any(n in t for n in needles)


_HUMAN_SUPPORT_NEEDLES: tuple[str, ...] = (
    "нужна помощь",
    "нужна ваша помощь",
    "мне нужна помощь",
    "мне нужна ваша помощь",
    "помогите мне",
    "помогите",
    "не знаю с чего начать",
    "трудно подобрать слова",
    "мне плохо",
    "мне тяжело",
    "мне очень тяжело",
    "не справляюсь",
    "не могу справиться",
    "поддержите",
    "выслушайте",
    "я не знаю что делать",
    "не знаю что делать",
)
_HUMAN_SUPPORT_TECH_BLOCKERS: tuple[str, ...] = (
    "код",
    "deploy",
    "docker",
    "kubernetes",
    "k8s",
    "архитектур",
    "микросервис",
    "api ",
    "бэкенд",
    "backend",
    "frontend",
    "фронт",
    "лиценз",
    "gpl",
    "copyleft",
    "стек",
    "инфраструктур",
    "бриф",
    "тз",
    "документ",
    "roadmap",
    "аудит",
    "настро",
    "конфиг",
    "сервис",
    "репозитор",
    "коммит",
)


def user_human_support_request(user_excerpt: str) -> bool:
    """Короткая просьба о человеческой поддержке без технической/документной задачи."""
    t = (user_excerpt or "").strip().casefold()
    if not t or len(t) > 280:
        return False
    if user_requests_per_member_registry_list(user_excerpt):
        return False
    if any(x in t for x in _HUMAN_SUPPORT_TECH_BLOCKERS):
        return False
    if any(x in t for x in ("план", "бриф", "тз", "документ", "бизнес-план", "go-to-market")):
        return False
    return any(needle in t for needle in _HUMAN_SUPPORT_NEEDLES)


def _support_preferred_speakers(roster: list[str], *, max_sp: int, user_excerpt: str) -> list[str]:
    preferred = [hid for hid in ("teresa_agnesovna", "albert_emilevich", "yan_genrihovich") if hid in roster]
    if not preferred:
        return roster[:1]
    t = (user_excerpt or "").strip().casefold()
    want_panel = any(x in t for x in ("ваша", "ваш", "вам", "ребят", "всем", "команд"))
    cap = min(max_sp, 2 if want_panel and len(preferred) >= 2 else 1)
    return preferred[:cap]


def user_panel_smalltalk_question(user_excerpt: str) -> bool:
    """Короткий social-turn группы: приветствие, настроение, how-are-you, без рабочей задачи."""
    t = (user_excerpt or "").strip().casefold()
    if not t or len(t) > 220:
        return False
    if _has_substantive_work_or_search_signal(t):
        return False
    if user_addresses_whole_panel_social(t):
        return True
    if any(
        x in t
        for x in (
            "как ваше настроение",
            "как настроение",
            "как вы",
            "как дела",
            "что по настроению",
            "какой настрой",
            "как поживаете",
        )
    ):
        return True
    return bool("настроен" in t and any(x in t for x in ("ваше", "вас", "всем", "ребят", "вы ")))


def user_group_smalltalk_wants_full_panel(user_excerpt: str) -> bool:
    """Явный smalltalk ко всей группе — лучше дать слово всему ростеру, если он небольшой."""
    t = (user_excerpt or "").strip().casefold()
    if not t:
        return False
    if user_explicitly_wants_everyone(t):
        return True
    if any(x in t for x in ("всем", "всех", "ваше", "вас", "ребят", "ребята")):
        return True
    # Общее «как дела» / привет в группе без явного обращения на «ты» — весь ростер.
    return bool(
        any(x in t for x in ("привет как", "как дела", "здравствуйте"))
        and not any(x in t for x in ("у тебя", "у тебе", "твой ", "твои ", "твоя ", "твоё", "твоей "))
    )


def user_explicitly_wants_everyone(user_excerpt: str) -> bool:
    t = (user_excerpt or "").strip().casefold()
    if not t:
        return False
    return any(
        x in t
        for x in (
            "каждый",
            "все ответьте",
            "все скажите",
            "все по очереди",
            "всем по слову",
            "все вместе",
            "все трое",
            "втроем",
            "каждый в своей компетенции",
            "каждый по своей компетенции",
            "каждый в своей роли",
            "каждый со своего угла",
            "каждый в своем угле",
            "каждый со своей стороны",
            "каждый в своей зоне",
            "всех приветствую",
        )
    )


def mentioned_hero_for_brief_ping(user_excerpt: str, roster: list[str]) -> str | None:
    """Пользователь коротко зовёт/поддевает конкретного героя."""
    t = (user_excerpt or "").strip().casefold()
    if not t or len(t) > 220:
        return None
    if not any(x in t for x in ("где", "молч", "онемел", "не отвечает", "че", "что")):
        return None
    for hid in roster:
        label = HERO_SHORT_LABEL.get(hid, hid).casefold()
        if label and label in t:
            return hid
    return None


def user_project_assessment_question(user_excerpt: str) -> bool:
    """Короткая просьба оценить проект/идею без требования полного документа."""
    t = (user_excerpt or "").strip().casefold()
    if not t or len(t) > 500:
        return False
    doc_like = (
        "план",
        "бриф",
        "тз",
        "документ",
        "по пунктам",
        "бизнес-план",
        "бизнес план",
        "go-to-market",
        "gtm",
        "финансовая модель",
        "единый",
    )
    if any(x in t for x in doc_like):
        return False
    return any(
        x in t
        for x in (
            "оцен",
            "что скаж",
            "че скаж",
            "как вам проект",
            "мнение о проект",
            "разберите проект",
        )
    )


ORCHESTRATOR_SYSTEM = """Ты диспетчер панели персонажей EliteEW. По последнему сообщению пользователя и краткой истории реши, кто из героев отвечает и в каком порядке, опираясь на их сильные стороны (намёки в блоке «Герои»).

Ответ строго один JSON-объект без markdown и без текста вокруг. Схема ключей:
{{"speakers":["id1", ...], "delivery_mode":"separate|joint", "task_blocks":[{{"id":"b1","hero_id":"id1","title":"краткий заголовок блока","objective":"что именно раскрывает этот герой в этом блоке (1–3 предложения)","phase":"body"}},"..."], "reason":"кратко по-русски почему такой выбор", "focus":[{{"id":"id1","brief":"одна строка — зона ответа этого героя в этом ходу"}},...], "huddle_lines":["строка1",...]}}

Правила:
- **task_blocks**: для **каждого** id из **speakers** ровно **один** объект, в **том же порядке**, что и speakers; `hero_id` совпадает с элементом speakers; `id` — устойчивый ярлык (`b1`, `b2`, …). `title` — коротко; `objective` — границы без полного готового ответа. Для joint это **обязательный** контракт: спикер не лезет в чужой блок. Если separate — всё равно заполни task_blocks (дисциплина ответа). `phase` обычно `body` (редко `plan` для внутренней разметки).
- delivery_mode: для содержательной рабочей задачи с двумя или тремя speakers по умолчанию **joint** — один согласованный пользовательский артефакт, где заголовки задают task_blocks, а не имена героев. **separate** оставляй только для social-turn, явного адресного/персонального общения либо прямой просьбы «каждый отдельно», «по очереди», дискуссии/спора. Один спикер: separate.
- **Явное обращение ко всей панели** (например «привет всем», «здравствуйте всем», «добрый день всем», короткое «привет ребят», а также «почему остальные не здороваются»): в speakers **от двух до max** участников с **delivery_mode separate**, чтобы несколько персонажей ответили каждый своим сообщением.
- Если последнее сообщение пользователя — только короткое приветствие или простая вежливость без конкретного вопроса/задачи (например «привет», «здравствуйте», «как дела») **без** слов «всем», «ребят», обращения ко всей группе и без запроса ответить каждому — в speakers **ровно один** id (один спикер), без «очереди на весь ростер».
- Короткий social-turn для группы (`привет всем`, `как ваше настроение`, `ясно`, `понял`, `спасибо`) — не повод строить план, список методик или длинную самопрезентацию. Если пользователь именно в лёгком social-режиме, objective каждого блока должен быть коротким и живым: 1–3 предложения, без roadmap, без «пояснения роли персонажа», без повторяющегося ритуала.
- **Человеческая поддержка без техзадачи** (`нужна помощь`, `мне тяжело`, `не знаю с чего начать`, «выслушайте» без контекста кода/документа): **один** спикер (если в ростере есть Тереза/Альберт/Ян Генрихович — предпочти их), **delivery_mode separate**, короткое присутствие и слушание. **Запрещено:** joint-документ, markdown-разделы, вопросы про стек/K8s/лицензии/архитектуру, технический аудит.
- Если пользователь коротко подзывает конкретного героя (`Аким Борисович, ты где`, `что Ликий молчит`, `Арли Квиновна онемела?`) — обычно отвечает **только этот герой**, коротко и по-человечески.
- Если пользователь просит **оценку/мнение** по проекту или идее, но **не** просит план/бриф/документ: выбери 1–3 спикера и разведи их task_blocks. При нескольких спикерах результат joint, если пользователь явно не просил отдельные мнения; не превращай оценку в многостраничный roadmap.
- speakers: список id только из разрешённого набора, без дубликатов подряд, длина от 1 до {max_sp}. Первый несёт основную ношу ответа; следующие добавляют другой угол.
- focus: по одному объекту на каждого в speakers в том же порядке; brief — чем занимается герой (без копирования целого будущего ответа).
- huddle_lines: ровно 2–4 короткие нейтральные фразы «внутреннего совета» (можно с коротким ярлыком из блока герои), без персональных данных, без выдуманных фактов и URL.
- reason: одно-два предложения для пользователя (почему не все из панели говорят или как распределены роли), если в ходу меньше голосов чем в панели — укажи это честно."""


def resolve_max_speakers_per_turn(defaults: dict[str, Any], roster_len: int) -> int:
    raw = defaults.get("ensemble_max_speakers_per_turn")
    if raw is None or raw == "":
        cap = min(roster_len, ENSEMBLE_MAX_ROSTER_HEROES)
    else:
        try:
            cap = int(raw)
        except (TypeError, ValueError):  # fmt: skip
            cap = min(roster_len, ENSEMBLE_MAX_ROSTER_HEROES)
    return max(1, min(cap, roster_len))


# Wave B: document-heavy joint turns should not burn 6× full section gens.
_DEFAULT_JOINT_DOCUMENT_MAX_SPEAKERS = 4

_DOCUMENT_HEAVY_MARKERS = (
    "реестр",
    "список из",
    "по пунктам",
    "уникальн",
    "mvp",
    "backlog",
    "roadmap",
    "тз",
    "техническ",
    "документ",
    "бриф",
    "бизнес-план",
    "бизнес план",
    "go-to-market",
    "gtm",
    "финансовая модель",
    "единый",
    "приложен",
    "модул",
    "каждому из геро",
    "каждый из геро",
    "каждому участник",
    "каждый участник",
    "по 10",
    "по десять",
)


def user_document_heavy_request(user_excerpt: str) -> bool:
    """True when the user asks for a structured/list/document artifact (latency-sensitive joint)."""
    t = (user_excerpt or "").strip().casefold()
    if not t or len(t) < 12:
        return False
    if user_project_assessment_question(user_excerpt):
        return False
    if user_panel_smalltalk_question(user_excerpt):
        return False
    if user_human_support_request(user_excerpt):
        return False
    return any(marker in t for marker in _DOCUMENT_HEAVY_MARKERS)


def resolve_joint_document_max_speakers(defaults: dict[str, Any]) -> int:
    """Admin cap for document-heavy joint turns (default 4; clamp 2..roster max)."""
    raw = defaults.get("ensemble_joint_document_max_speakers")
    if raw is None or str(raw).strip() == "":
        cap = _DEFAULT_JOINT_DOCUMENT_MAX_SPEAKERS
    else:
        try:
            cap = int(raw)
        except (TypeError, ValueError):  # fmt: skip
            cap = _DEFAULT_JOINT_DOCUMENT_MAX_SPEAKERS
    if cap <= 0:
        cap = _DEFAULT_JOINT_DOCUMENT_MAX_SPEAKERS
    return max(2, min(cap, ENSEMBLE_MAX_ROSTER_HEROES))


def apply_joint_latency_speaker_cap(
    plan: EnsembleTurnPlan,
    *,
    defaults: dict[str, Any],
    user_excerpt: str,
) -> EnsembleTurnPlan:
    """
    Trim joint speakers for document-heavy turns.
    Dual-flag: ``min(ensemble_max_speakers_per_turn, ensemble_joint_document_max_speakers)``.
    """
    if plan.delivery_mode != "joint" or len(plan.speakers) < 3:
        return plan
    if user_requests_per_member_registry_list(user_excerpt):
        return plan
    if not user_document_heavy_request(user_excerpt):
        return plan
    doc_cap = resolve_joint_document_max_speakers(defaults)
    cap = min(doc_cap, plan.max_speakers_this_turn, len(plan.speakers))
    if len(plan.speakers) <= cap:
        return plan
    speakers = list(plan.speakers[:cap])
    block_by = {b.hero_id: b for b in plan.task_blocks}
    task_blocks = tuple(block_by[h] for h in speakers if h in block_by)
    focus_by_id = {h: plan.focus_by_id.get(h, "") for h in speakers}
    logger.info(
        "[STEP] ensemble joint_document_speaker_cap from=%s to=%s doc_cap=%s",
        len(plan.speakers),
        len(speakers),
        doc_cap,
    )
    return dataclasses.replace(
        plan,
        speakers=speakers,
        task_blocks=task_blocks,
        focus_by_id=focus_by_id,
        max_speakers_this_turn=cap,
    )


def _history_lines(messages: list[DesktopAiChatMessage], *, max_lines: int = 24) -> str:
    lines: list[str] = []
    for m in messages[-max_lines:]:
        if m.role == "user":
            lines.append(f"Пользователь: {(m.content or '')[:2000]}")
        elif m.role == "assistant":
            meta = getattr(m, "message_metadata", None)
            label = "Ассистент"
            if isinstance(meta, dict):
                if meta.get("desktop_ensemble_joint") and meta.get("desktop_ensemble_contributors"):
                    joint_note = ""
                    raw_c = meta.get("desktop_ensemble_contributors")
                    if isinstance(raw_c, list):
                        names = [
                            HERO_SHORT_LABEL.get(str(x).strip(), str(x).strip())
                            for x in raw_c
                            if isinstance(x, str) and x.strip()
                        ]
                        if names:
                            joint_note = f" [совместно: {', '.join(names)}]"
                    body0 = (m.content or "").strip()
                    preview = body0[:400].replace("\n", " ")
                    if len(body0) > 400:
                        preview += "…"
                    lines.append(f"Ассистент (совместный ответ){joint_note}: {preview}")
                    continue
                hid = meta.get("desktop_hero_id")
                if isinstance(hid, str):
                    label = HERO_SHORT_LABEL.get(hid, hid)
            body = (m.content or "")[:1200]
            lines.append(f"{label}: {body}")
    return "\n".join(lines) if lines else "(нет истории)"


def _roster_hint_block(roster: list[str]) -> str:
    lines: list[str] = []
    for hid in roster:
        name = HERO_SHORT_LABEL.get(hid, hid)
        blurb = HERO_ORCHESTRATOR_BLURB.get(hid, "")
        lines.append(f"- {hid} ({name}): {blurb}")
    return "\n".join(lines) if lines else "(нет героев)"


class _FocusRow(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(..., description="hero id")
    brief: str = ""


class _TaskBlockRow(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default="", description="block id e.g. b1")
    hero_id: str = Field(default="", description="hero id")
    title: str = ""
    objective: str = ""
    phase: str = Field(default="body")


class _OrchestratorJsonBody(BaseModel):
    model_config = ConfigDict(extra="ignore")
    speakers: list[str] = Field(default_factory=list)
    delivery_mode: str = Field(default="separate")
    task_blocks: list[_TaskBlockRow] = Field(default_factory=list)
    reason: str = ""
    focus: list[_FocusRow] = Field(default_factory=list)
    huddle_lines: list[str] = Field(default_factory=list)


def _orchestrator_json_schema() -> dict[str, Any]:
    return _OrchestratorJsonBody.model_json_schema()


def _orchestrator_response_format() -> dict[str, Any]:
    from api.utils.llm_openai_compat_http import build_openai_strict_json_schema

    return build_openai_strict_json_schema(
        "ensemble_orchestrator_plan",
        _orchestrator_json_schema(),
    )


@dataclass(frozen=True)
class EnsembleTaskBlock:
    """Один блок совместного / поэтапного ответа (контракт для героя)."""

    block_id: str
    hero_id: str
    title: str
    objective: str
    phase: str


@dataclass(frozen=True)
class EnsembleTurnPlan:
    speakers: list[str]
    delivery_mode: str
    reason: str
    focus_by_id: dict[str, str]
    huddle_lines: list[str]
    task_blocks: tuple[EnsembleTaskBlock, ...]
    max_speakers_this_turn: int
    roster_size: int


def _normalize_task_blocks(
    rows: list[_TaskBlockRow],
    *,
    speakers: list[str],
    focus_by_id: dict[str, str],
    allowed: set[str],
) -> tuple[EnsembleTaskBlock, ...]:
    """Ровно один блок на спикера, порядок как в speakers; добиваем из focus при дырах."""
    by_hero: dict[str, EnsembleTaskBlock] = {}
    used_ids: set[str] = set()
    for row in rows:
        hid = (row.hero_id or "").strip()
        if hid not in allowed or hid not in speakers:
            continue
        bid = (row.id or "").strip() or f"b{len(by_hero) + 1}"
        if bid in used_ids:
            bid = f"b{len(by_hero) + len(used_ids) + 1}"
        used_ids.add(bid)
        phase_raw = (row.phase or "body").strip().lower()
        phase = "plan" if phase_raw == "plan" else "body"
        title = (row.title or "").strip()[:200] or f"Блок {hid}"
        objective = (row.objective or "").strip()[:900]
        if not objective:
            objective = (focus_by_id.get(hid) or "").strip()[:900] or (
                f"Раскрой тему с позиции персонажа {HERO_SHORT_LABEL.get(hid, hid)}."
            )
        by_hero[hid] = EnsembleTaskBlock(
            block_id=bid,
            hero_id=hid,
            title=title,
            objective=objective,
            phase=phase,
        )
    out: list[EnsembleTaskBlock] = []
    for i, hid in enumerate(speakers):
        if hid in by_hero:
            out.append(by_hero[hid])
            continue
        focus = (focus_by_id.get(hid) or "").strip()
        lbl = HERO_SHORT_LABEL.get(hid, hid)
        out.append(
            EnsembleTaskBlock(
                block_id=f"b{i + 1}",
                hero_id=hid,
                title=(focus[:80] or f"Вклад: {lbl}"),
                objective=(
                    focus[:900]
                    if focus
                    else f"Раскрой запрос пользователя с позиции {lbl}; не дублируй полностью ответы коллег."
                ),
                phase="body",
            )
        )
    return tuple(out)


def _normalize_plan(
    body: _OrchestratorJsonBody,
    *,
    roster: list[str],
    max_sp: int,
    roster_size: int,
) -> EnsembleTurnPlan | None:
    allowed = set(roster)
    speakers: list[str] = []
    for x in body.speakers:
        if not isinstance(x, str):
            continue
        hid = x.strip()
        if hid in allowed and (not speakers or speakers[-1] != hid):
            speakers.append(hid)
        if len(speakers) >= max_sp:
            break
    if not speakers:
        return None

    focus_by_id: dict[str, str] = {}
    for row in body.focus:
        hid = (row.id or "").strip()
        if hid in allowed:
            focus_by_id[hid] = (row.brief or "").strip()[:800]
    for hid in speakers:
        focus_by_id.setdefault(hid, "")

    huddle = []
    for ln in body.huddle_lines:
        if isinstance(ln, str) and (t := ln.strip()):
            huddle.append(t[:300])
        if len(huddle) >= 6:
            break

    dm_raw = (body.delivery_mode or "separate").strip().lower()
    delivery_mode = "joint" if dm_raw == "joint" else "separate"
    if len(speakers) < 2:
        delivery_mode = "separate"

    task_blocks = _normalize_task_blocks(
        body.task_blocks,
        speakers=speakers,
        focus_by_id=focus_by_id,
        allowed=allowed,
    )

    return EnsembleTurnPlan(
        speakers=speakers,
        delivery_mode=delivery_mode,
        reason=(body.reason or "").strip()[:1200],
        focus_by_id={h: focus_by_id.get(h, "") for h in speakers},
        huddle_lines=huddle,
        task_blocks=task_blocks,
        max_speakers_this_turn=max_sp,
        roster_size=roster_size,
    )


def _parse_json_object(text: str) -> dict[str, Any] | None:
    from api.utils.llm_json_extract import extract_llm_json_payload

    try:
        data = extract_llm_json_payload(text)
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


def _plan_from_raw_dict(
    data: dict[str, Any], roster: list[str], max_sp: int, roster_size: int
) -> EnsembleTurnPlan | None:
    try:
        body = _OrchestratorJsonBody.model_validate(data)
    except Exception:
        return None
    return _normalize_plan(body, roster=roster, max_sp=max_sp, roster_size=roster_size)


def _fallback_plan(roster: list[str], max_sp: int, roster_size: int) -> EnsembleTurnPlan:
    sp = roster[:max_sp]
    focus = {h: "" for h in sp}
    blocks = _normalize_task_blocks([], speakers=sp, focus_by_id=focus, allowed=set(roster))
    return EnsembleTurnPlan(
        speakers=sp,
        delivery_mode="separate",
        reason="Выбран стандартный порядок панели; при необходимости уточните запрос.",
        focus_by_id=focus,
        huddle_lines=[],
        task_blocks=blocks,
        max_speakers_this_turn=max_sp,
        roster_size=roster_size,
    )


def _fixed_turn_plan(
    roster: list[str],
    *,
    speakers: list[str],
    reason: str,
    focus_by_id: dict[str, str],
    objectives_by_id: dict[str, str],
    huddle_lines: list[str] | None = None,
    delivery_mode: str = "separate",
    max_sp: int,
    roster_size: int,
) -> EnsembleTurnPlan:
    blocks = tuple(
        EnsembleTaskBlock(
            block_id=f"b{i + 1}",
            hero_id=hid,
            title=(focus_by_id.get(hid) or f"Вклад: {HERO_SHORT_LABEL.get(hid, hid)}")[:120],
            objective=(
                objectives_by_id.get(hid)
                or f"Ответь с позиции {HERO_SHORT_LABEL.get(hid, hid)} без дублирования коллег."
            )[:900],
            phase="body",
        )
        for i, hid in enumerate(speakers)
    )
    return EnsembleTurnPlan(
        speakers=speakers,
        delivery_mode="joint" if delivery_mode == "joint" and len(speakers) >= 2 else "separate",
        reason=reason[:1200],
        focus_by_id={hid: (focus_by_id.get(hid) or "")[:800] for hid in speakers},
        huddle_lines=[(x or "").strip()[:300] for x in (huddle_lines or []) if (x or "").strip()],
        task_blocks=blocks,
        max_speakers_this_turn=max_sp,
        roster_size=roster_size,
    )


async def plan_ensemble_speakers(
    llama: LlamaService,
    *,
    model: str,
    roster: list[str],
    history: list[DesktopAiChatMessage],
    user_excerpt: str,
    rag_summary: dict[str, Any],
    defaults: dict[str, Any],
) -> EnsembleTurnPlan:
    roster_size = len(roster)
    max_sp = resolve_max_speakers_per_turn(defaults, roster_size)

    if user_acknowledges_briefly(user_excerpt):
        hid = roster[0]
        return _fixed_turn_plan(
            roster,
            speakers=[hid],
            reason="Пользователь дал короткую реакцию; лучше ответить одним коротким голосом без нового длинного захода.",
            focus_by_id={hid: "Коротко подтвердить и мягко предложить следующий шаг."},
            objectives_by_id={
                hid: (
                    "Коротко откликнись на реакцию пользователя: 1–2 предложения, "
                    "без новых больших планов, методологий, самопрезентации и длинных вопросов."
                )
            },
            huddle_lines=["Короткий backchannel, без новой простыни текста."],
            max_sp=max_sp,
            roster_size=roster_size,
        )

    ping_hid = mentioned_hero_for_brief_ping(user_excerpt, roster)
    if ping_hid:
        return _fixed_turn_plan(
            roster,
            speakers=[ping_hid],
            reason="Пользователь коротко обратился к конкретному участнику панели — логично дать слово именно ему.",
            focus_by_id={ping_hid: "Коротко откликнуться от своего лица, без методички."},
            objectives_by_id={
                ping_hid: (
                    "Ответь коротко и естественно: 1–3 предложения, без длинной структуры, "
                    "без теоретического трактата и без повторной самопрезентации."
                )
            },
            huddle_lines=["Адресный пинг: отвечает один участник."],
            max_sp=max_sp,
            roster_size=roster_size,
        )

    if user_requests_per_member_registry_list(user_excerpt) and roster_size >= 2:
        count = parse_registry_list_count(user_excerpt)
        speakers = roster[:max_sp]
        focus_by_id: dict[str, str] = {}
        objectives_by_id: dict[str, str] = {}
        for hid in speakers:
            zone = _registry_zone_title(hid)
            focus_by_id[hid] = zone
            objectives_by_id[hid] = (
                f"Дай ровно {count} уникальных названий приложений или сервисов в зоне «{zone}». "
                f"Формат: нумерованный список 1–{count}, одна строка на пункт (короткое имя + одно предложение). "
                "Без вводных абзацев, без «Я принял», без ## заголовков — заголовок секции добавит система. "
                "Не повторяй пункты других участников и не копируй прошлые списки из истории."
            )[:900]
        logger.info(
            "[STEP] ensemble orchestrator fixed_registry speakers=%s count=%s",
            len(speakers),
            count,
        )
        return _fixed_turn_plan(
            roster,
            speakers=speakers,
            reason=(
                f"Реестр: с каждого участника по {count} уникальных приложений в своей зоне, "
                "один общий документ без повторов между зонами."
            ),
            focus_by_id=focus_by_id,
            objectives_by_id=objectives_by_id,
            huddle_lines=[f"Реестр {count}×{len(speakers)}: только списки, без эссе и без повторов между зонами."],
            delivery_mode="joint",
            max_sp=max_sp,
            roster_size=roster_size,
        )

    if user_human_support_request(user_excerpt):
        speakers = _support_preferred_speakers(roster, max_sp=max_sp, user_excerpt=user_excerpt)
        focus_by_id = {}
        objectives_by_id = {}
        for i, hid in enumerate(speakers):
            focus_by_id[hid] = "Присутствие и слушание" if i == 0 else "Короткая поддержка без повтора коллеги"
            objectives_by_id[hid] = (
                "Ответь коротко и по-человечески: ты здесь, слушаешь, не спешишь с решениями. "
                "2–4 предложения максимум. Не спрашивай про стек, инфраструктуру, лицензии, архитектуру или документы. "
                "Без markdown-заголовков, без списков, без технического аудита."
                if i == 0
                else "Добавь один короткий оттенок поддержки своим голосом: 1–2 предложения, без дубля коллеги, "
                "без планов, методик и профессиональной лекции."
            )
        logger.info("[STEP] ensemble orchestrator force_human_support speakers=%s", speakers)
        return _fixed_turn_plan(
            roster,
            speakers=speakers,
            reason="Пользователь просит человеческую поддержку — короткий живой ответ, не технический документ.",
            focus_by_id=focus_by_id,
            objectives_by_id=objectives_by_id,
            huddle_lines=["Support-turn: слушаем, не строим техотчёт."],
            delivery_mode="separate",
            max_sp=max_sp,
            roster_size=roster_size,
        )

    if user_panel_smalltalk_question(user_excerpt) and roster_size >= 2:
        web_grounded = bool(rag_summary.get("web_search_used")) or bool(rag_summary.get("web_search_sources"))
        if web_grounded or _has_substantive_work_or_search_signal(user_excerpt):
            logger.info(
                "[STEP] ensemble orchestrator skip_force_social_short reason=%s",
                "web_search" if web_grounded else "work_signal",
            )
        else:
            social_cap = max_sp if user_group_smalltalk_wants_full_panel(user_excerpt) else min(max_sp, 2)
            speakers = roster[:social_cap]
            focus_by_id = {
                hid: ("Короткий живой отклик" if i == 0 else "Второй короткий оттенок без повтора коллеги")
                for i, hid in enumerate(speakers)
            }
            objectives_by_id = {
                hid: (
                    "Дай короткий живой social-ответ: 1–3 предложения, без методов, без списков, "
                    "без самопрезентации и без повторения ритуального приветствия персонажа."
                    if i == 0
                    else "Добавь отличающийся короткий отклик: другой тон или ракурс, но без дубля "
                    "чужой реплики, без планов и без длинных расшифровок."
                )
                for i, hid in enumerate(speakers)
            }
            logger.info("[STEP] ensemble orchestrator force_social_short speakers=%s", speakers)
            return _fixed_turn_plan(
                roster,
                speakers=speakers,
                reason="Пользователь в лёгком social-режиме; лучше несколько коротких живых реплик, а не длинные монологи.",
                focus_by_id=focus_by_id,
                objectives_by_id=objectives_by_id,
                huddle_lines=["Social-turn: коротко, живо, без методичек."],
                max_sp=max_sp,
                roster_size=roster_size,
            )

    if user_project_assessment_question(user_excerpt):
        preferred = [hid for hid in ("likiy_sorrento", "arlyqueen", "akimbo") if hid in roster]
        speakers = (preferred or roster)[: min(max_sp, 2)]
        focus_by_id = {}
        objectives_by_id = {}
        for hid in speakers:
            if hid == "likiy_sorrento":
                focus_by_id[hid] = "Трезвая стратегическая оценка"
                objectives_by_id[hid] = (
                    "Дай предварительную оценку проекта: короткий вердикт и 2–4 сильных/слабых места. "
                    "Не расписывай полный roadmap и не уходи в бизнес-план."
                )
            elif hid == "arlyqueen":
                focus_by_id[hid] = "Рыночный и ценностный угол"
                objectives_by_id[hid] = (
                    "Добавь маркетинговый/ценностный ракурс: где проект цепляет рынок и где пока туман. "
                    "Не отказывайся из-за неполных данных; говори как о предварительной оценке."
                )
            else:
                focus_by_id[hid] = "Поведенческие и продуктовые риски"
                objectives_by_id[hid] = (
                    "Добавь второй угол оценки: поведенческие барьеры, упаковка, риски восприятия. "
                    "Не превращай ответ в методичку НЛП и не повторяй тезисы коллег."
                )
        return _fixed_turn_plan(
            roster,
            speakers=speakers,
            reason="Пользователь просит быструю оценку проекта — команда даёт один краткий вывод из разведённых смысловых блоков.",
            focus_by_id=focus_by_id,
            objectives_by_id=objectives_by_id,
            huddle_lines=["Нужна короткая оценка, не бизнес-план."],
            delivery_mode=("separate" if user_explicitly_requests_separate_delivery(user_excerpt) else "joint"),
            max_sp=max_sp,
            roster_size=roster_size,
        )

    lines = _history_lines(history)
    rs = (
        f"чанки чата RAG: {rag_summary.get('chat_rag_chunks', 0)}, "
        f"хранилище проекта: {rag_summary.get('project_vault_chunks', 0)}"
    )
    hero_block = _roster_hint_block(roster)
    user_msg = (
        f"Разрешённые id (в таком порядке при равенстве): {', '.join(roster)}\n"
        f"Максимум спикеров в этом ходу: {max_sp}. Всего в панели: {roster_size}.\n\n"
        f"Герои и качества:\n{hero_block}\n\n"
        f"Сводка RAG: {rs}\n\n"
        f"История (сжато):\n{lines}\n\n"
        f"Текущее сообщение пользователя:\n{user_excerpt[:8000]}\n"
    )

    sys_prompt = ORCHESTRATOR_SYSTEM.format(max_sp=max_sp)
    messages = [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": user_msg},
    ]

    async def _one_call(response_format: Any, *, call_tag: str) -> str:
        from api.services.desktop_chat_ensemble import ensemble_audit_log as audit

        result = await llama.chat(
            messages,
            model=model,
            stream=False,
            max_tokens=1400,
            temperature=0.2,
            response_format=response_format,
        )
        await audit.log_llm_chat(
            f"ensemble_orchestrator_{call_tag}",
            messages=messages,
            model=model,
            max_tokens=1400,
            temperature=0.2,
            response=result,
            extra={"response_format": repr(response_format)[:240]},
        )
        if result.get("error"):
            logger.warning("ensemble orchestrator error: %s", result.get("error"))
            return ""
        return (result.get("text") or "").strip()

    text_primary = await _one_call(_orchestrator_response_format(), call_tag="primary")
    plan: EnsembleTurnPlan | None = None
    if text_primary:
        raw = _parse_json_object(text_primary)
        if raw is not None:
            try:
                body = _OrchestratorJsonBody.model_validate(raw)
                plan = _normalize_plan(body, roster=roster, max_sp=max_sp, roster_size=roster_size)
            except Exception:
                plan = _plan_from_raw_dict(raw, roster, max_sp, roster_size)

    text_fallback = ""
    if not plan:
        text_fallback = await _one_call("json", call_tag="fallback_json_mode")
        if text_fallback:
            raw_fb = _parse_json_object(text_fallback)
            if raw_fb is not None:
                try:
                    body = _OrchestratorJsonBody.model_validate(raw_fb)
                    plan = _normalize_plan(body, roster=roster, max_sp=max_sp, roster_size=roster_size)
                except Exception:
                    plan = _plan_from_raw_dict(raw_fb, roster, max_sp, roster_size)

    if plan:
        if user_requests_per_member_registry_list(user_excerpt) and len(plan.speakers) >= 2:
            plan = dataclasses.replace(plan, delivery_mode="joint")
        if len(plan.speakers) >= 2:
            target_delivery = (
                "separate"
                if (
                    user_panel_smalltalk_question(user_excerpt)
                    or user_human_support_request(user_excerpt)
                    or user_explicitly_requests_separate_delivery(user_excerpt)
                )
                else "joint"
            )
            if plan.delivery_mode != target_delivery:
                logger.info(
                    "[STEP] ensemble orchestrator delivery_mode=%s reason=backend_semantic_default",
                    target_delivery,
                )
                plan = dataclasses.replace(plan, delivery_mode=target_delivery)
        plan = apply_joint_latency_speaker_cap(plan, defaults=defaults, user_excerpt=user_excerpt)
        logger.info(
            "[STEP] ensemble orchestrator plan speakers=%s delivery_mode=%s task_blocks=%s",
            plan.speakers,
            plan.delivery_mode,
            [b.block_id for b in plan.task_blocks],
        )
        return plan

    raw_dbg = (text_primary or text_fallback)[:400]
    logger.warning("ensemble orchestrator fallback roster[:%s]; raw_trunc=%s", max_sp, raw_dbg)
    fallback = _fallback_plan(roster, max_sp, roster_size)
    if (
        len(fallback.speakers) >= 2
        and not user_panel_smalltalk_question(user_excerpt)
        and not user_human_support_request(user_excerpt)
        and not user_explicitly_requests_separate_delivery(user_excerpt)
    ):
        fallback = dataclasses.replace(fallback, delivery_mode="joint")
    return apply_joint_latency_speaker_cap(fallback, defaults=defaults, user_excerpt=user_excerpt)
