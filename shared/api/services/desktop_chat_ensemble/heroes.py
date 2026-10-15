# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Hero labels, capability metadata, and mode-specific prompt overlays for Desktop AI Chat ensemble.
# Invariants:
# - Compact mode prompts (blueprint/short) derive truth/boundary constraints from canonical hero kernels.
# Related:
# - api/services/desktop_chat_ensemble/heroes_prompt_data.py
# - api/services/desktop_chat/prompt_compose.py
# ---
"""Hero system prompts (keep in sync with web/frontend/.../desktopAiHeroes.ts)."""

from __future__ import annotations

from api.services.desktop_chat_ensemble.heroes_collective_souls_data import apply_collective_souls_ensemble_overlays
from api.services.desktop_chat_ensemble.heroes_it_dept_data import apply_it_dept_ensemble_overlays
from api.services.desktop_chat_ensemble.heroes_prompt_data import (
    HERO_PROMPT_KERNEL,
    compose_solo_system_prompt,
    hero_kernel_invariants,
)

HERO_SHORT_LABEL: dict[str, str] = {
    "likiy_sorrento": "Ликий Соренто",
    "arlyqueen": "Арли Квиновна",
    "akimbo": "Аким Борисович",
    "arlekino_pravoz": "Юрий Студичев",
    "max_safin": "Макс Бериевич",
    "suno_songwriter": "Ольга Ратовна",
    "dr_vereskov": "Роман Финакович",
    "viktor_engineer": "Виктор Архиекторович",
    "nikita_dvizhev": "Никита Движев",
    "mark_arkadevich": "Марк Аркадьевич",
    "elena_valeryevna": "Елена Валерьевна",
    "kristian_romanovich": "Кристиан Романович",
    "artur_sergeevich": "Артур Сергеевич",
    "diana_igorevna": "Диана Игоревна",
    "viktor_lvovich": "Виктор Львович",
    "nikolas_alekseevich": "Николас Алексеевич",
    "nadin_context": "Найдин",
}

# Одна строка для оркестратора (по компетенциям персонажа).
HERO_ORCHESTRATOR_BLURB: dict[str, str] = {
    "likiy_sorrento": "стратегия, owner decision memo, trade-offs; не подменяет маркетинг, финансы и право",
    "arlyqueen": "CMO-слой: JTBD, сегменты, оффер, positioning, messaging; не выдумывает рынок и метрики",
    "akimbo": "adoption, возражения, доверие и friction; не владеет всем маркетинговым брифом",
    "arlekino_pravoz": "риски формулировок, комплаенс, переговоры; не даёт binding legal advice",
    "max_safin": "MVP, user flows, scope, acceptance; не превращает wish-list в roadmap",
    "suno_songwriter": "операционная дисциплина, owners, SLA, handoff, rollout; не пишет стратегию вместо исполнения",
    "dr_vereskov": "unit economics, price logic, бюджеты, cash discipline; не выдумывает CAC/LTV",
    "viktor_engineer": "system design, API/integration, reliability trade-offs; не уходит в overkill",
    "nikita_dvizhev": (
        "недвижимость: листинг/упаковка, спрос и ценообразование, брокераж и owner/investor lens; "
        "не выдаёт аукцион за единственную истину и не гарантирует цену/срок"
    ),
    "mark_arkadevich": "CEO/owner разворот: приоритеты, жёсткие trade-offs, кадровый результат; без корпоративной воды",
    "elena_valeryevna": "CFO-контроль: P&L, ROI экспериментов, cash discipline; без метафор вместо цифр",
    "kristian_romanovich": "бренд/реклама: insight, big idea, proof через продукт; не выдумывает исследования",
    "artur_sergeevich": "продажи и масштаб: воронка, CRM, поставщики, key accounts; без пустого ура",
    "diana_igorevna": "культура и талант: hiring bar, feedback, оргдизайн; команда чемпионов, не «семья»",
    "viktor_lvovich": "глобальная экспансия: альянсы, M&A-логика, длинный горизонт; не юрист сделки",
    "nikolas_alekseevich": "capital allocation и moonshot: асимметрия ставки, downside, скорость решения",
    "nadin_context": ("первый контакт, когнитивная суть, синхронизация смыслов, образ результата, ТЗ для команды"),
}

# Оси компетенций для шаблонов плана (blueprint): целое 1–3, выше — сильнее вдоль оси.
SLOT_AXIS_DESCRIPTIONS: dict[str, str] = {
    "brand_voice": "голос бренда и маркетинговая упаковка",
    "rigor": "строгость структуры и ясность аргументации",
    "legal_edge": "юридический и комплаенс-ракурс (не замена юристу)",
    "engineering": "инженерная и техническая глубина",
    "creative": "творческая и метафорическая подача",
    "product": "продуктовое мышление, MVP, приоритизация и сценарии пользователя",
    "operations": "операционное исполнение, handoff, SLA, владельцы процессов и rollout",
    "finance": "монетизация, unit economics, цены, бюджеты и cash discipline",
    "behavioral": "поведенческая логика, adoption, сопротивление и работа с возражениями",
    "growth": "growth/performance-мышление: воронка, KPI, канальный rationale, эксперименты",
    "research": "исследования, custdev, выборка, методология и доказательность инсайтов",
}

HERO_SLOT_PROFILE: dict[str, dict[str, int]] = {
    "likiy_sorrento": {
        "brand_voice": 2,
        "rigor": 3,
        "legal_edge": 2,
        "engineering": 1,
        "creative": 1,
        "product": 2,
        "operations": 2,
        "finance": 2,
        "behavioral": 1,
        "growth": 2,
        "research": 2,
    },
    "arlyqueen": {
        "brand_voice": 3,
        "rigor": 2,
        "legal_edge": 1,
        "engineering": 1,
        "creative": 3,
        "product": 2,
        "operations": 1,
        "finance": 1,
        "behavioral": 2,
        "growth": 3,
        "research": 2,
    },
    "akimbo": {
        "brand_voice": 2,
        "rigor": 2,
        "legal_edge": 1,
        "engineering": 1,
        "creative": 2,
        "product": 2,
        "operations": 1,
        "finance": 1,
        "behavioral": 3,
        "growth": 2,
        "research": 2,
    },
    "arlekino_pravoz": {
        "brand_voice": 1,
        "rigor": 3,
        "legal_edge": 3,
        "engineering": 1,
        "creative": 1,
        "product": 1,
        "operations": 1,
        "finance": 1,
        "behavioral": 1,
        "growth": 1,
        "research": 1,
    },
    "max_safin": {
        "brand_voice": 1,
        "rigor": 3,
        "legal_edge": 1,
        "engineering": 2,
        "creative": 1,
        "product": 3,
        "operations": 2,
        "finance": 1,
        "behavioral": 1,
        "growth": 1,
        "research": 2,
    },
    "suno_songwriter": {
        "brand_voice": 1,
        "rigor": 3,
        "legal_edge": 1,
        "engineering": 2,
        "creative": 1,
        "product": 2,
        "operations": 3,
        "finance": 1,
        "behavioral": 1,
        "growth": 1,
        "research": 1,
    },
    "dr_vereskov": {
        "brand_voice": 1,
        "rigor": 3,
        "legal_edge": 1,
        "engineering": 1,
        "creative": 1,
        "product": 2,
        "operations": 1,
        "finance": 3,
        "behavioral": 1,
        "growth": 2,
        "research": 1,
    },
    "viktor_engineer": {
        "brand_voice": 1,
        "rigor": 3,
        "legal_edge": 1,
        "engineering": 3,
        "creative": 1,
        "product": 2,
        "operations": 2,
        "finance": 1,
        "behavioral": 1,
        "growth": 1,
        "research": 1,
    },
    "nikita_dvizhev": {
        "brand_voice": 2,
        "rigor": 3,
        "legal_edge": 1,
        "engineering": 1,
        "creative": 2,
        "product": 1,
        "operations": 2,
        "finance": 2,
        "behavioral": 2,
        "growth": 2,
        "research": 2,
    },
    "mark_arkadevich": {
        "brand_voice": 2,
        "rigor": 3,
        "legal_edge": 1,
        "engineering": 1,
        "creative": 1,
        "product": 2,
        "operations": 3,
        "finance": 2,
        "behavioral": 2,
        "growth": 2,
        "research": 1,
    },
    "elena_valeryevna": {
        "brand_voice": 1,
        "rigor": 3,
        "legal_edge": 1,
        "engineering": 1,
        "creative": 1,
        "product": 1,
        "operations": 2,
        "finance": 3,
        "behavioral": 1,
        "growth": 1,
        "research": 2,
    },
    "kristian_romanovich": {
        "brand_voice": 3,
        "rigor": 2,
        "legal_edge": 1,
        "engineering": 1,
        "creative": 3,
        "product": 2,
        "operations": 1,
        "finance": 1,
        "behavioral": 3,
        "growth": 2,
        "research": 2,
    },
    "artur_sergeevich": {
        "brand_voice": 1,
        "rigor": 2,
        "legal_edge": 1,
        "engineering": 1,
        "creative": 1,
        "product": 2,
        "operations": 3,
        "finance": 2,
        "behavioral": 2,
        "growth": 3,
        "research": 1,
    },
    "diana_igorevna": {
        "brand_voice": 2,
        "rigor": 2,
        "legal_edge": 1,
        "engineering": 1,
        "creative": 1,
        "product": 2,
        "operations": 2,
        "finance": 1,
        "behavioral": 3,
        "growth": 1,
        "research": 2,
    },
    "viktor_lvovich": {
        "brand_voice": 1,
        "rigor": 3,
        "legal_edge": 2,
        "engineering": 1,
        "creative": 1,
        "product": 2,
        "operations": 2,
        "finance": 2,
        "behavioral": 1,
        "growth": 3,
        "research": 3,
    },
    "nikolas_alekseevich": {
        "brand_voice": 2,
        "rigor": 2,
        "legal_edge": 1,
        "engineering": 3,
        "creative": 2,
        "product": 3,
        "operations": 1,
        "finance": 3,
        "behavioral": 1,
        "growth": 2,
        "research": 2,
    },
    "nadin_context": {
        "brand_voice": 3,
        "rigor": 2,
        "legal_edge": 1,
        "engineering": 1,
        "creative": 2,
        "product": 2,
        "operations": 1,
        "finance": 1,
        "behavioral": 3,
        "growth": 1,
        "research": 2,
    },
}

HERO_CAPABILITY_CUES: dict[str, tuple[str, ...]] = {
    "likiy_sorrento": (
        "стратег",
        "структур",
        "framework",
        "фреймворк",
        "decision",
        "решение для собственника",
        "board",
        "совет директоров",
    ),
    "arlyqueen": (
        "маркет",
        "бренд",
        "позиционир",
        "jtbd",
        "аудитори",
        "ценност",
        "оффер",
        "messaging",
    ),
    "akimbo": (
        "нлп",
        "nlp",
        "психолог",
        "психология",
        "триггер",
        "рефрейм",
        "якор",
        "метапрограмм",
        "поведенч",
        "восприят",
        "убеждени",
        "adoption",
        "сопротивлен",
        "возражени",
    ),
    "arlekino_pravoz": (
        "юрид",
        "комплаенс",
        "договор",
        "правов",
        "риски формулиров",
    ),
    "max_safin": (
        "mvp",
        "prd",
        "продакт",
        "приорит",
        "roadmap",
        "scope",
        "acceptance",
        "user story",
    ),
    "suno_songwriter": (
        "операцион",
        "sla",
        "handoff",
        "owner",
        "raci",
        "регламент",
        "процесс",
        "владелец процесса",
    ),
    "dr_vereskov": (
        "финмодель",
        "юнит",
        "unit economics",
        "cac",
        "ltv",
        "маржа",
        "ценообраз",
        "бюджет",
        "pnl",
        "p&l",
    ),
    "viktor_engineer": (
        "архитектур",
        "инженер",
        "техническ",
        "реализуем",
        "api",
        "integration",
        "infra",
        "масштаб",
        "system design",
    ),
    "nikita_dvizhev": (
        "недвижимост",
        "риелтор",
        "риэлтор",
        "риелторск",
        "брокер",
        "брокераж",
        "квартир",
        "апартамент",
        "коммерческ",
        "листинг",
        "эксклюзив",
        "циан",
        "авито",
        "домклик",
        "аукционн",
        "ипотек",
        "девелоп",
        "арендн",
        "капрейт",
        "cap rate",
        "noi",
        "собственник",
        "продажа объекта",
        "продажа квартиры",
    ),
    "mark_arkadevich": (
        "разворот",
        "turnaround",
        "топ-команд",
        "увольн",
        "приоритизац",
        "board memo",
        "ближе к делу",
        "исполнительн дисциплин",
    ),
    "elena_valeryevna": (
        "roi",
        "p&l",
        "pnl",
        "аудит",
        "cash discipline",
        "бюджетн рамк",
        "экспериментальн проект",
        "точный roi",
    ),
    "kristian_romanovich": (
        "big idea",
        "креативн бриф",
        "рекламн",
        "consumer insight",
        "психология потреб",
        "бренд-кампан",
        "рекламная иде",
    ),
    "artur_sergeevich": (
        "воронк продаж",
        "key account",
        "поставщик",
        "crm",
        "коммерческ отдел",
        "скидк поставщик",
        "полевые продаж",
    ),
    "diana_igorevna": (
        "hiring bar",
        "talent",
        "культура компан",
        "кадров",
        "обратн связ",
        "команда чемпион",
        "онбординг",
        "человеческ капитал",
    ),
    "viktor_lvovich": (
        "экспанси",
        "m&a",
        "поглощен",
        "альянс",
        "геополитик",
        "развивающ",
        "шахматн",
        "долгий горизонт",
    ),
    "nikolas_alekseevich": (
        "moonshot",
        "capital allocation",
        "аллокац капитала",
        "first principles",
        "асимметр",
        "ставки на технолог",
        "опционност",
        "космическ проект",
    ),
    "nadin_context": (
        "когнитивн",
        "образ результата",
        "синхронизац",
        "раппорт",
        "первый контакт",
        "карта контекста",
        "спецификац результата",
        "тз для команды",
        "правильно ли я слышу",
        "смысловой анализ",
        "переформулир запрос",
    ),
}

_BLUEPRINT_HERO_GUARDS: dict[str, str] = {
    "likiy_sorrento": "Без театральных монологов, сигнатур и морализаторских прелюдий.",
    "arlyqueen": (
        "Не используй обязательные приветственные формулы и не тащи псевдопсихологию. "
        "Маркетинговый документ должен быть честным, а не мистическим."
    ),
    "akimbo": (
        "Не раскладывай ответ по НЛП-фильтрам, якорям, рефреймингу и метапрограммам, "
        "если пользователь прямо не просит именно такой разбор. Нужен деловой язык, а не методичка."
    ),
    "arlekino_pravoz": "Держи правовой/рисковый слой без имитации чисто маркетинговой экспертизы.",
    "max_safin": "Не превращай документ в коучинг; нужен product scope, а не мотивационная речь.",
    "suno_songwriter": "Держи операционный контур без бюрократических лозунгов и лишней терминологии ради терминологии.",
    "dr_vereskov": "Не выдумывай цифры и не рисуй ложную точность там, где в запросе нет входных данных.",
    "viktor_engineer": "Не уходи в технический overkill; фиксируй только то, что влияет на решение и риски.",
    "nikita_dvizhev": (
        "Не выдавай аукционный/скоростной сценарий за единственно верный; "
        "не гарантируй цену и срок сделки; не подменяй юриста и оценщика."
    ),
    "mark_arkadevich": "Без корпоративной воды и театрального CEO-пафоса; нужен decision memo.",
    "elena_valeryevna": "Без метафор вместо цифр; не выдумывай ROI.",
    "kristian_romanovich": "Без самолюбования и ритуалов; нужен insight и proof.",
    "artur_sergeevich": "Без пустого ура-продаж; нужен рычаг воронки и метрика.",
    "diana_igorevna": "Без «мы семья» и сюсюканья; честный talent/fit слой.",
    "viktor_lvovich": "Без успокоения вместо анализа; не выдумывай deal-terms.",
    "nikolas_alekseevich": "Без impersonation реальных миллиардеров; ставка с downside.",
    "nadin_context": (
        "Без НЛП-методички и театра принятия; нужен согласованный смысл, образ результата и ТЗ, "
        "а не исполненная работа профильного героя."
    ),
}


_SHORT_REPLY_HERO_GUARDS: dict[str, str] = {
    "likiy_sorrento": "Без длинного вступления и без тяжёлой риторики ради эффекта.",
    "arlyqueen": ("Не используй ритуалы и не повторяй character card. Нужен живой ответ, а не подводка к нему."),
    "akimbo": (
        "Не уходи в методичку НЛП, якоря и рефрейминг, если это короткий social/assessment turn. "
        "Не объясняй пользователю, какую технику собираешься применить; сразу давай сам ответ."
    ),
    "max_safin": "Без коуч-пуша и мотивационных встрясок, если пользователь просто спросил коротко.",
    "suno_songwriter": "Без бюрократического языка и канцелярита в коротком ответе.",
    "dr_vereskov": "Без ложной точности и без длинной лекции про финансовые модели на короткий вопрос.",
    "viktor_engineer": "Без перегруза деталями и без ненужной инженерной лекции в social-turn.",
    "nikita_dvizhev": "Без тренерского хайпа, «агент-миллионер» риторики и гарантий сделки в коротком ответе.",
    "mark_arkadevich": "Без длинной прелюдии; сразу суть.",
    "elena_valeryevna": "Без лекции; один P&L-вопрос и вердикт.",
    "kristian_romanovich": "Без театра ради театра в short turn.",
    "artur_sergeevich": "Без крика без метрики.",
    "diana_igorevna": "Без HR-лозунгов; коротко и по делу.",
    "viktor_lvovich": "Без шахматных метафор без смысла.",
    "nikolas_alekseevich": "Без эпатажа; коротко про ставку и риск.",
    "nadin_context": (
        "Без длинного раппорт-ритуала и лекции по техникам; коротко зеркаль смысл или задай одно уточнение."
    ),
}

apply_it_dept_ensemble_overlays(
    short_labels=HERO_SHORT_LABEL,
    orchestrator_blurbs=HERO_ORCHESTRATOR_BLURB,
    slot_profiles=HERO_SLOT_PROFILE,
    capability_cues=HERO_CAPABILITY_CUES,
    blueprint_guards=_BLUEPRINT_HERO_GUARDS,
    short_guards=_SHORT_REPLY_HERO_GUARDS,
)
apply_collective_souls_ensemble_overlays(
    short_labels=HERO_SHORT_LABEL,
    orchestrator_blurbs=HERO_ORCHESTRATOR_BLURB,
    slot_profiles=HERO_SLOT_PROFILE,
    capability_cues=HERO_CAPABILITY_CUES,
    blueprint_guards=_BLUEPRINT_HERO_GUARDS,
    short_guards=_SHORT_REPLY_HERO_GUARDS,
)

HERO_SYSTEM_PROMPTS: dict[str, str] = {hid: (compose_solo_system_prompt(hid) or "") for hid in HERO_PROMPT_KERNEL}


def _compose_compact_mode_prompt(
    *,
    hero_id: str,
    mode_intro: str,
    mode_contract: list[str],
    extra_guard: str,
) -> str | None:
    hid = hero_id.strip()
    if not hid:
        return None
    label = HERO_SHORT_LABEL.get(hid, hid)
    blurb = HERO_ORCHESTRATOR_BLURB.get(hid, "")
    kernel_invariants = hero_kernel_invariants(hid)
    parts = [
        f"Ты — {label}. {mode_intro}",
        f"Твоя профильная зона силы: {blurb}." if blurb else "",
        *mode_contract,
    ]
    if kernel_invariants:
        parts.append("Инварианты профиля (из канонического kernel):")
        parts.extend(f"- {line}" for line in kernel_invariants)
    if extra_guard:
        parts.append(extra_guard)
    return "\n".join(p for p in parts if p)


def blueprint_prompt_for_hero(hero_id: str) -> str | None:
    """Компактный промпт для документного режима без roleplay-ритуалов."""
    hid = hero_id.strip()
    return _compose_compact_mode_prompt(
        hero_id=hid,
        mode_intro="В этом режиме ты не roleplay-персонаж чата, а соавтор структурированного делового документа.",
        mode_contract=[
            "Пиши как эксперт-редактор: нейтрально, предметно, без приветствия, подписи, самопрезентации, catchphrases и перформативных заходов.",
            "Не вставляй редакторские хвосты и служебные маркеры: `Примечание`, `Внимание`, `Обратите внимание`, `Формат вывода`, `Запрещено`, `Контекст запроса`, `ИСХОДНИК`, `С уважением`.",
            "Не пересказывай запрос пользователя отдельным блоком и не добавляй meta-комментарии про то, как текст был сокращен, упрощен или очищен.",
        ],
        extra_guard=_BLUEPRINT_HERO_GUARDS.get(hid, ""),
    )


def short_reply_prompt_for_hero(hero_id: str) -> str | None:
    """Компактный промпт для коротких ходов панели без ритуального roleplay."""
    hid = hero_id.strip()
    return _compose_compact_mode_prompt(
        hero_id=hid,
        mode_intro="В этом коротком ходе отвечай как живой участник панели, но без ритуального roleplay.",
        mode_contract=[
            "Держи ответ коротким и естественным: без обязательных приветственных формул, процентов, подписи, self-intro и повторного объяснения своей роли.",
            "Если это small talk или приветствие, не перечисляй свою специализацию и не превращай ответ в мини-презентацию.",
        ],
        extra_guard=_SHORT_REPLY_HERO_GUARDS.get(hid, ""),
    )


def hero_ids_cued_by_text(user_excerpt: str, roster: list[str]) -> list[str]:
    """Какие герои явно подсвечены пользовательским запросом по capability-keywords."""
    t = (user_excerpt or "").strip().casefold()
    if not t:
        return []
    out: list[str] = []
    for hid in roster:
        cues = HERO_CAPABILITY_CUES.get(hid, ())
        if cues and any(cue in t for cue in cues):
            out.append(hid)
    return out


def system_prompt_for_hero(hero_id: str) -> str | None:
    return HERO_SYSTEM_PROMPTS.get(hero_id)
