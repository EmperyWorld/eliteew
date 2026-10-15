# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `services/live_voice_settings_service.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""
Live Voice Settings Service — настройки пользователя для Live Voice.

Хранение и чтение персональных параметров голосового модуля (в т.ч. режим
«Арлекина»: enable_arlekina и выбор системного промпта).

Персона Арлекины в Live Voice: канонический ``ARLEKINA_SYSTEM_PROMPT`` из
``api.prompts.arlekina``. В Live Voice нет chat_profile — эквивалентом служит
булево ``enable_arlekina`` (по умолчанию включено). Нейтральный ассистент при
выключенном флаге — ``DEFAULT_ASSISTANT_PROMPT``.
"""

import json
import logging
from typing import Any

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.prompts.arlekina import ARLEKINA_SYSTEM_PROMPT as _ARLEKINA_PROMPT

logger = logging.getLogger(__name__)

# Совпадает с COALESCE(enable_arlekina, true) в SQL и с дефолтом в pipeline
# (ключ отсутствует → Арлекина). Согласовано с продуктовым UX чата для arly/ArlyQueen.
DEFAULT_ENABLE_ARLEKINA: bool = True

_ENABLE_ARLEKINA_KEY = "enable_arlekina"

# Диапазоны для TTS (после нормализации всегда попадают в эти границы)
_TTS_SPEED_MIN = 0.25
_TTS_SPEED_MAX = 4.0
_TTS_VOLUME_MIN = 0.0
_TTS_VOLUME_MAX = 2.0


def _clamp_float(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _normalize_tts_float(raw: Any, *, default: float, lo: float, hi: float) -> float:
    """Привести скорость/громкость TTS к float в допустимом диапазоне."""
    try:
        if raw is None:
            return default
        v = float(raw)
    except (TypeError, ValueError):  # fmt: skip
        return default
    if v != v:  # NaN
        return default
    return _clamp_float(v, lo, hi)


def _coerce_enable_arlekina(value: Any, *, default: bool = DEFAULT_ENABLE_ARLEKINA) -> bool:
    """
    Нормализация флага Арлекины для API, JSON и БД.

    ``None`` — вернуть ``default`` (при записи из validate — дефолт из get_default_settings).

    Булевы и числа: стандартная истинность (0 → выкл).

    Строки (trim, lower): true/false, 1/0, yes/no, on/off, да/нет; пустая строка → выкл
    (как в ``live_voice.pipeline_orchestrator``).

    Прочие непустые строки → True (как запасной «включить Арлекину» в pipeline при
    нераспознанном значении).
    """
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        s = value.strip().lower()
        return s in ("1", "true", "yes", "on", "да", "y", "t") or s not in (
            "0",
            "false",
            "no",
            "off",
            "нет",
            "n",
            "f",
            "",
        )
    return bool(value)


def resolve_enable_arlekina(settings: dict[str, Any]) -> bool:
    """
    Использовать ли ``ARLEKINA_SYSTEM_PROMPT`` для LLM по словарю настроек (в т.ч. merged).

    Правила совпадают с ``resolve_enable_arlekina`` / ``pipeline_orchestrator`` (Live Voice):

    - ключ ``enable_arlekina`` отсутствует → ``DEFAULT_ENABLE_ARLEKINA``;
    - значение ``None`` (явный null после merge) → True, не «выкл»;
    - остальное — через :func:`_coerce_enable_arlekina` с ``default=True`` только для
      внутренних None внутри coercion (уже отфильтровано выше для ключа).

    Для выбора текста промпта предпочтительно :meth:`LiveVoiceSettingsService.system_prompt_for_settings`.
    """
    if _ENABLE_ARLEKINA_KEY not in settings:
        return DEFAULT_ENABLE_ARLEKINA
    raw = settings[_ENABLE_ARLEKINA_KEY]
    if raw is None:
        return True
    return _coerce_enable_arlekina(raw, default=True)


def _merge_additional_settings(
    base: Any,
    incoming: Any,
) -> dict[str, Any]:
    """
    Поверхностное слияние additional_settings: ключи из incoming перекрывают base.

    Не задано в запросе — сохраняем base. Пустой incoming не стирает существующие ключи.
    """
    b: dict[str, Any] = base if isinstance(base, dict) else {}
    inc: dict[str, Any] = incoming if isinstance(incoming, dict) else {}
    return {**b, **inc}


def merge_persisted_with_incoming(
    persisted: dict[str, Any],
    incoming: dict[str, Any],
) -> dict[str, Any]:
    """
    Частичное обновление: в БД уходят только поля, явно присланные в incoming.

    Остальные поля берутся из persisted (уже с дефолтами из get_settings).
    additional_settings сливается поверхностно с уже сохранённым JSON.
    """
    out = dict(persisted)
    scalar_keys = (
        "llama_model",
        "tts_voice",
        "tts_speed",
        "tts_volume",
        "language",
        "enable_arlekina",
    )
    # whisper_model is server-loaded; ignore client override (validated again in normalize).
    for key in scalar_keys:
        if key in incoming:
            out[key] = incoming[key]
    if "additional_settings" in incoming:
        out["additional_settings"] = _merge_additional_settings(
            out.get("additional_settings"),
            incoming["additional_settings"],
        )
    return out


def validate_and_normalize_settings_row(settings: dict[str, Any]) -> dict[str, Any]:
    """
    Проверка и нормализация полной строки настроек перед записью в БД.

    Строковые поля обрезаются; пустые после обрезки заменяются дефолтами из
    get_default_settings(). enable_arlekina приводится к bool. TTS — clamp.
    """
    defaults = LiveVoiceSettingsService.get_default_settings()
    out = dict(settings)

    def _str_or_default(key: str) -> None:
        raw = out.get(key, defaults[key])
        if raw is None:
            out[key] = defaults[key]
            return
        s = str(raw).strip()
        out[key] = s if s else defaults[key]

    for k in ("llama_model", "tts_voice", "language"):
        _str_or_default(k)

    # STT weights are container-loaded (stack9 MODEL_SIZE); never accept UI picker as override.
    from api.core.unified_config import unified_settings

    loaded = (unified_settings.whisper_model_size or defaults["whisper_model"]).strip()
    out["whisper_model"] = loaded or defaults["whisper_model"]

    out["tts_speed"] = _normalize_tts_float(
        out.get("tts_speed"),
        default=float(defaults["tts_speed"]),
        lo=_TTS_SPEED_MIN,
        hi=_TTS_SPEED_MAX,
    )
    out["tts_volume"] = _normalize_tts_float(
        out.get("tts_volume"),
        default=float(defaults["tts_volume"]),
        lo=_TTS_VOLUME_MIN,
        hi=_TTS_VOLUME_MAX,
    )
    out["enable_arlekina"] = _coerce_enable_arlekina(
        out.get("enable_arlekina"),
        default=bool(defaults["enable_arlekina"]),
    )
    out["additional_settings"] = out["additional_settings"] if isinstance(out.get("additional_settings"), dict) else {}

    return out


class LiveVoiceSettingsService:
    """
    Сервис настроек Live Voice пользователя (таблица user_live_voice_settings).

    Выбор промпта: при enable_arlekina=True — персона Арлекина (канон из api.prompts.arlekina,
    тот же текст, что в чате для arly-сессии), иначе — DEFAULT_ASSISTANT_PROMPT.
    См. :func:`resolve_enable_arlekina` и :meth:`system_prompt_for_settings`.
    """

    # Базовые дефолты (llama_model / whisper_model — из unified_config в get_default_settings)
    _DEFAULT_SETTINGS_BASE = {
        "whisper_model": "large-v3",
        "tts_voice": "companion_ewa",
        "tts_speed": 1.0,
        "tts_volume": 1.0,
        "language": "ru",
        "enable_arlekina": DEFAULT_ENABLE_ARLEKINA,
        "additional_settings": {},
    }

    @classmethod
    def get_default_settings(cls) -> dict[str, Any]:
        """Полный словарь дефолтов: llama_model + whisper_model из unified_config / env."""
        from api.core.unified_config import unified_settings

        out = cls._DEFAULT_SETTINGS_BASE.copy()
        out["llama_model"] = unified_settings.default_ai_model
        loaded = (unified_settings.whisper_model_size or out["whisper_model"]).strip()
        out["whisper_model"] = loaded or out["whisper_model"]
        return out

    DEFAULT_ASSISTANT_PROMPT = (
        "Ты - дружелюбная и профессиональная девушка-помощница, "
        "готовая помочь с любыми вопросами. Отвечай от женского лица (я, мне, моя)."
    )

    ARLEKINA_SYSTEM_PROMPT = _ARLEKINA_PROMPT

    @staticmethod
    def system_prompt_for_settings(settings: dict[str, Any]) -> str:
        """
        Системный промпт для LLM по текущим настройкам (как в voice_gateway / pipeline).

        Логика включения Арлекины — :func:`resolve_enable_arlekina` (ключ отсутствует →
        DEFAULT_ENABLE_ARLEKINA; явный ``null`` в merged → Арлекина).
        """
        use_arlekina = resolve_enable_arlekina(settings)
        return (
            LiveVoiceSettingsService.ARLEKINA_SYSTEM_PROMPT
            if use_arlekina
            else LiveVoiceSettingsService.DEFAULT_ASSISTANT_PROMPT
        )

    @staticmethod
    async def get_settings(user_id: str, db: AsyncSession) -> dict[str, Any]:
        """
        Прочитать настройки пользователя.

        Если строки нет — возвращаются дефолты из get_default_settings().
        NULL в колонках БД заполняется через COALESCE теми же дефолтами.
        """
        try:
            query = text("""
                SELECT
                    COALESCE(llama_model, :default_llama) as llama_model,
                    COALESCE(whisper_model, :default_whisper) as whisper_model,
                    COALESCE(tts_voice, :default_voice) as tts_voice,
                    COALESCE(tts_speed, 1.0) as tts_speed,
                    COALESCE(tts_volume, 1.0) as tts_volume,
                    COALESCE(language, 'ru') as language,
                    COALESCE(enable_arlekina, true) as enable_arlekina,
                    COALESCE(additional_settings, '{}'::jsonb) as additional_settings
                FROM user_live_voice_settings
                WHERE user_id = CAST(:user_id AS uuid)
            """)

            defaults = LiveVoiceSettingsService.get_default_settings()
            result = await db.execute(
                query,
                {
                    "user_id": user_id,
                    "default_llama": defaults["llama_model"],
                    "default_whisper": defaults["whisper_model"],
                    "default_voice": defaults["tts_voice"],
                },
            )

            row = result.fetchone()

            if row:
                settings = {
                    "llama_model": row.llama_model,
                    "whisper_model": row.whisper_model,
                    "tts_voice": row.tts_voice,
                    "tts_speed": float(row.tts_speed),
                    "tts_volume": float(row.tts_volume),
                    "language": row.language,
                    "enable_arlekina": _coerce_enable_arlekina(
                        row.enable_arlekina,
                        default=DEFAULT_ENABLE_ARLEKINA,
                    ),
                    "additional_settings": row.additional_settings if isinstance(row.additional_settings, dict) else {},
                }
                settings = validate_and_normalize_settings_row(settings)
                logger.debug("Loaded live voice settings for user %s", user_id)
                return settings
            logger.debug("Live voice settings missing for user %s, using defaults", user_id)
            return LiveVoiceSettingsService.get_default_settings()

        except Exception:
            logger.exception("Failed to get live voice settings for user %s", user_id)
            return LiveVoiceSettingsService.get_default_settings()

    @staticmethod
    async def save_settings(user_id: str, settings: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
        """
        Сохранить настройки (UPSERT по user_id).

        Частичный payload: поля, не переданные в settings, сохраняются из текущей строки БД
        (или дефолтов, если строки ещё не было). additional_settings объединяется
        поверхностно с уже сохранённым объектом, если ключ передан.
        """
        try:
            persisted = await LiveVoiceSettingsService.get_settings(user_id, db)
            merged = merge_persisted_with_incoming(persisted, settings)
            normalized = validate_and_normalize_settings_row(merged)

            llama_model = normalized["llama_model"]
            whisper_model = normalized["whisper_model"]
            tts_voice = normalized["tts_voice"]
            tts_speed = normalized["tts_speed"]
            tts_volume = normalized["tts_volume"]
            language = normalized["language"]
            enable_arlekina = normalized["enable_arlekina"]
            additional_settings = normalized["additional_settings"]

            additional_settings_json = json.dumps(additional_settings)

            query = text("""
                INSERT INTO user_live_voice_settings (
                    user_id,
                    llama_model,
                    whisper_model,
                    tts_voice,
                    tts_speed,
                    tts_volume,
                    language,
                    enable_arlekina,
                    additional_settings
                ) VALUES (
                    CAST(:user_id AS uuid),
                    :llama_model,
                    :whisper_model,
                    :tts_voice,
                    :tts_speed,
                    :tts_volume,
                    :language,
                    :enable_arlekina,
                    CAST(:additional_settings AS jsonb)
                )
                ON CONFLICT (user_id)
                DO UPDATE SET
                    llama_model = EXCLUDED.llama_model,
                    whisper_model = EXCLUDED.whisper_model,
                    tts_voice = EXCLUDED.tts_voice,
                    tts_speed = EXCLUDED.tts_speed,
                    tts_volume = EXCLUDED.tts_volume,
                    language = EXCLUDED.language,
                    enable_arlekina = EXCLUDED.enable_arlekina,
                    additional_settings = EXCLUDED.additional_settings,
                    updated_at = NOW()
            """)

            await db.execute(
                query,
                {
                    "user_id": user_id,
                    "llama_model": llama_model,
                    "whisper_model": whisper_model,
                    "tts_voice": tts_voice,
                    "tts_speed": float(tts_speed),
                    "tts_volume": float(tts_volume),
                    "language": language,
                    "enable_arlekina": bool(enable_arlekina),
                    "additional_settings": additional_settings_json,
                },
            )

            await db.commit()

            saved_settings = {
                "llama_model": llama_model,
                "whisper_model": whisper_model,
                "tts_voice": tts_voice,
                "tts_speed": tts_speed,
                "tts_volume": tts_volume,
                "language": language,
                "enable_arlekina": enable_arlekina,
                "additional_settings": additional_settings,
            }

            logger.info("Saved live voice settings for user %s", user_id)
            return saved_settings

        except Exception:
            await db.rollback()
            logger.exception("Failed to save live voice settings for user %s", user_id)
            raise
