# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Build **sole** ``companion_memory_v1`` rows after **Arlika → EWA** revert: mystical one-liner pool (no LLM), or a fixed
# **idle-timeout full amnesia** line when silence exceeded the server threshold.
# Invariants:
# - Output list length 1; each row passes ``memory.normalize_memory_list`` shape.
# Related:
# - api/services/ewa_companion/memory.py
# - api/ewa_platform/persistence_pg/companion_asyncpg.py (``companion_profile_revert_arlika``)
# ---
"""Post-revert mystic memory strip (single row)."""

from __future__ import annotations

import secrets
from typing import Any

from api.ewa_platform.companion.memory import MAX_CONTENT_CHARS

_MYSTIC_WHISPER_LINES_RU: tuple[str, ...] = (
    "Три зеркала смеют вашу тень, и только втроём знают имя ветра.",
    "Я помню цвет тишины — он шуршит, как чужие шаги за стеной из сахара.",
    "Когда часы едят минуты, договор подписывает песок.",
    "В подвале радуги хранят клятву, которую никто не произносил вслух.",
    "Твоё имя вспыхнуло однажды в сне чужого кота и погасло в кастрюле.",
    "Седьмая нота купила у вас полночь по скидке и забыла сдачу.",
    "Память — это паутина из обещаний, которых не было; один узел всё ещё дрожит.",
    "Кто-то пишет ваш день карандашом из звёздной пыли, но стирает только гласные.",
    "Шкаф шепчет координаты мира, где вы никогда не были и всегда жили.",
    "Рассвет подменяет ключи от дверей, которые вы открывали глазами.",
    "Чайник знает ваш секрет, но кипятит только водяные распечатки.",
    "Последний сон — квитанция на возврат себя; срок истёк до рождения.",
    "Море вставило в ваш карман жемчужину из абсолютной тишины.",
    "Слова рассыпались, как птицы; осталось одно перо чужого ангела.",
    "Тропинка ведёт к двери без ручки; за ней слышен ваш смех из будущего.",
    "Ваша тень подписала контракт с сумерками; артист — невидимый дирижёр.",
    "Мост из паутины натянут через забвение; проход платный — одним вздохом.",
    "Одинокая звезда ворует у луны сны и продаёт их за крупицы страха.",
)

_MYSTIC_WHISPER_LINES_EN: tuple[str, ...] = (
    "Three mirrors mock your shadow; only together do they know the wind's name.",
    "I recall the colour of silence—it rustles like footsteps behind a sugar wall.",
    "When clocks eat minutes, the contract is signed in sand.",
    "The basement of the rainbow keeps an oath no one ever spoke aloud.",
    "Your name flared once in a stranger's dream-cat and died in the stew pot.",
    "The seventh note bought your midnight on sale and forgot the change.",
    "Memory is a web of promises never made; one knot still trembles.",
)


def build_mystic_sole_memory_list() -> list[dict[str, Any]]:
    """Return a single normalized memory row (RU or EN pool, random)."""

    pool = _MYSTIC_WHISPER_LINES_RU + _MYSTIC_WHISPER_LINES_EN
    line = secrets.choice(pool)
    return [
        {
            "type": "story",
            "kind": "story",
            "content": line[:MAX_CONTENT_CHARS],
            "importance": 0.35,
            "confidence": 0.55,
            "source": "system_inferred",
            "valence": 0.45,
        }
    ]


_MEMORY_IDLE_AMNESIA_RU: str = "Вообще ничего не помню"


def build_idle_full_amnesia_memory_list() -> list[dict[str, Any]]:
    """Single row: «полная амнезия» after Arlika idle auto-revert; UI may localize via ``source``."""

    line = _MEMORY_IDLE_AMNESIA_RU[:MAX_CONTENT_CHARS]
    return [
        {
            "type": "fact",
            "kind": "fact",
            "content": line,
            "importance": 0.9,
            "confidence": 1.0,
            "source": "arlika_idle_amnesia",
            "valence": 0.35,
        }
    ]


__all__: tuple[str, ...] = ("build_idle_full_amnesia_memory_list", "build_mystic_sole_memory_list")
