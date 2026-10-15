# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Optional LLM polish of stitched joint markdown; on refusal/error/over-shrink
# return deterministic section-dedupe fallback (never raw duplicated stitch).
# Invariants:
# - Compression revert uses ``dedupe_joint_markdown``, not the pre-dedupe raw.
# - Skip compression retries when pre-polish already dropped duplicate sections (Wave B).
# Related:
# - api/services/desktop_chat_ensemble/joint_section_dedupe.py
# - documentation/product/DESKTOP-LLAMA-CHAT.md
# ---

"""Шлифовка склеенного joint-markdown (аналог concat_polish ИМК, без новых фактов)."""

from __future__ import annotations

import logging
import re
from typing import Any

from api.services.desktop_chat.llm.runtime import desktop_chat_completion
from api.services.desktop_chat_ensemble import ensemble_audit_log
from api.services.desktop_chat_ensemble.joint_polish_limits import (
    compute_joint_polish_min_post,
    joint_polish_compression_retry_enabled,
    joint_polish_truncation_retryable,
    resolve_large_pre_threshold,
)
from api.services.desktop_chat_ensemble.joint_section_dedupe import dedupe_joint_markdown
from api.services.desktop_chat_ensemble.speaker_output import strip_ensemble_editorial_noise

logger = logging.getLogger(__name__)


def _safe_fallback_markdown(stitched: str) -> str:
    """Wave A: never ship raw duplicated stitch on polish revert/error."""
    cleaned, notes = dedupe_joint_markdown(stitched)
    if notes:
        logger.info("[STEP] ensemble joint_polish fallback_dedupe notes=%s", notes)
    return cleaned or (stitched or "").strip()


# Потолок num_predict для шага polish (символы ≠ токены; для длинных склеек нужен запас).
_DEFAULT_PREDICT_CAP = 32_768
_PREDICT_CAP_HARD_MAX = 131_072


def _resolve_predict_cap(defaults: dict[str, Any]) -> int:
    raw = defaults.get("ensemble_joint_polish_predict_cap")
    try:
        cap = int(raw) if raw is not None and str(raw).strip() != "" else _DEFAULT_PREDICT_CAP
    except (TypeError, ValueError):  # fmt: skip
        cap = _DEFAULT_PREDICT_CAP
    return max(4096, min(cap, _PREDICT_CAP_HARD_MAX))


def _looks_like_refusal(text: str) -> bool:
    t = (text or "").strip().casefold()
    if len(t) < 80:
        return True
    needles = (
        "не могу выполнить",
        "не могу помочь",
        "выполнить ваш запрос",
        "нарушает политику",
        "извините",
        "как языковая модель",
    )
    return any(n in t for n in needles)


def _looks_like_instruction_echo(text: str) -> bool:
    """Модель иногда повторяет заголовки из промпта вместо тела ответа."""
    head = (text or "").strip()[:900].casefold()
    return (
        ("контекст запроса" in head and "## контекст" in head)
        or head.startswith("## контекст")
        or head.startswith("### контекст")
        or "для тона, не дублируй" in head
        or "исходный текст (верни" in head
    )


JOINT_POLISH_SYSTEM = "\n".join(
    [
        "Ты — технический редактор markdown. На входе один склеенный ответ панели персонажей (несколько секций `##`, разделители `---`).",
        "**Объём и плотность:** сохраняй развёрнутость исходника. Не пересказывай короче, не сжимай списки и абзацы «в одну строку», не выкидывай пункты ради лаконичности. Цель — тот же информационный вес, что в исходнике.",
        "Убери только **дословные или почти дословные** повторы одной и той же мысли в разных секциях `##` (оставь один полный вариант в лучшем месте). Если сомневаешься, дубль не трогай.",
        "Сгладь формулировки и переходы без потери смысла; лишний дублирующий `##` можно понизить до `###` только если структура остаётся ясной.",
        "Fenced-блоки ```mermaid ... ``` не переписывай и не ломай синтаксис: оставь граф как в исходнике; правь только прозу вокруг диаграммы.",
        "Запрещено: новые факты, цифры, имена и обещания, которых не было в исходнике; преамбулы редактора; разделы «Контекст запроса», «Исходный текст» и любые заголовки из этой инструкции.",
        "Удали технический мусор и служебные хвосты, если они просочились в исходник: строки `Реплика участника ...`, `[label=...]`, standalone `#`, фразы про отсутствие доступа к данным, если дальше уже есть содержательное тело ответа.",
        "Вывод: **только** исправленный markdown тела ответа, с первой строки — как в исходнике (обычно `## Имя` или `---`).",
    ]
)


def _compression_retry_user_suffix(*, min_post: int, pre_chars: int, attempt: int) -> str:
    pct = max(65, min(92, int(round(100 * min_post / max(pre_chars, 1)))))
    if attempt <= 0:
        return (
            "\n\n---\n\n"
            "КРИТИЧНО (повтор запроса): прошлый вариант **несоразмерно сжал** исходник. "
            "На этот раз **сохрани развёрнутость**: все содержательные разделы `##`/`###`, списки и абзацы из исходника должны остаться; "
            "не делай краткого пересказа вместо полного текста. "
            f"Ориентир по объёму: итог **не короче ~{min_post} символов** (~{pct}% от длины исходника по символам), "
            "если только ты не удаляешь **дословные** дубли между секциями. "
            "Новых фактов не добавляй."
        )
    return (
        "\n\n---\n\n"
        f"ПОВТОР {attempt + 1}: ты снова выдал сжатый пересказ вместо полного документа. "
        "**Запрещено** заменять исходник тезисами, «кратким содержанием» или одним-двумя абзацами на раздел. "
        "Работай **по всему** блоку ИСХОДНИК: для каждого `##`/`###` сохрани **подавляющее большинство** строк и пунктов; "
        "убирай только явные **дословные** повторы между разными секциями. "
        f"Целевой минимум объёма: **≥ {min_post} символов** (~{pct}% от исходника). "
        "Вывод — один сплошной markdown как в инструкции системы."
    )


def build_joint_polish_user_message(stitched_markdown: str, *, user_query: str) -> str:
    uq = (user_query or "").strip() or "(без отдельного брифа)"
    return "\n".join(
        [
            "Краткий бриф пользователя (только для тона, **не** создавай под этим отдельный раздел в ответе):",
            uq[:6000],
            "",
            "---",
            "",
            "ИСХОДНИК (отредактируй и верни целиком одним markdown-документом):",
            stitched_markdown.strip(),
        ]
    )


def _cleanup_joint_markdown(text: str) -> str:
    lines: list[str] = []
    for line in text.splitlines():
        s = line.strip()
        low = s.casefold()
        if re.fullmatch(r"#{1,6}", s):
            continue
        if low.startswith("реплика участника "):
            continue
        if "[label=" in low or low.startswith("label="):
            continue
        lines.append(line)
    out = "\n".join(lines)
    out = strip_ensemble_editorial_noise(out)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


def _pre_polish_has_dropped_duplicates(notes: list[str] | None) -> bool:
    if not notes:
        return False
    return any(str(n).startswith("dropped_duplicate_section:") for n in notes)


async def polish_joint_concat(
    *,
    model: str,
    stitched: str,
    user_excerpt: str,
    defaults: dict[str, Any],
    pre_polish_dedupe_notes: list[str] | None = None,
    out_stats: dict[str, Any] | None = None,
) -> str:
    """Return polished markdown; on refusal/error/over-shrink return deduped stitch (not raw dupes)."""
    stats = out_stats if out_stats is not None else {}
    stats.setdefault("polish_reverted", False)
    stats.setdefault("compression_skipped", False)

    raw = (stitched or "").strip()
    if not raw:
        return raw
    enabled = defaults.get("ensemble_joint_polish_enabled")
    if enabled is False:
        stats["polish_reverted"] = True
        return _safe_fallback_markdown(raw)

    skip_compression = _pre_polish_has_dropped_duplicates(pre_polish_dedupe_notes)
    if skip_compression:
        stats["compression_skipped"] = True
        logger.info(
            "[STEP] ensemble joint_polish skip_compression_retry reason=pre_polish_dedupe notes=%s",
            pre_polish_dedupe_notes,
        )

    predict_cap = _resolve_predict_cap(defaults)
    raw_np = defaults.get("ensemble_joint_polish_num_predict")
    try:
        num_predict = int(raw_np) if raw_np is not None and raw_np != "" else 0
    except (TypeError, ValueError):  # fmt: skip
        num_predict = 0
    # Длинный склей: шлифовке нужен больший num_predict, иначе обрыв посреди документа.
    large_pre = resolve_large_pre_threshold(defaults)
    if num_predict <= 0:
        # Больше headroom, чем len//2+1024: крупные ответы и кириллица → больше токенов на символ.
        num_predict = min(predict_cap, max(4096, (len(raw) * 2) // 3 + 2048))
    if len(raw) >= large_pre:
        num_predict = max(num_predict, min(predict_cap, len(raw) // 4 + 4096))

    user_msg = build_joint_polish_user_message(raw, user_query=user_excerpt[:8000])
    base_messages: list[dict[str, str]] = [
        {"role": "system", "content": JOINT_POLISH_SYSTEM},
        {"role": "user", "content": user_msg},
    ]

    max_tok = min(predict_cap, max(1024, num_predict))

    async def _call_polish(
        mt: int,
        *,
        msgs: list[dict[str, str]] | None = None,
        temperature: float = 0.15,
        audit_kind: str = "joint_polish",
    ) -> dict[str, Any]:
        used = msgs if msgs is not None else base_messages
        out = await desktop_chat_completion(
            messages=used,
            model=model,
            defaults=defaults,
            max_tokens=mt,
            temperature=temperature,
        )
        compat = {
            "text": str(out.get("response", "") or ""),
            "error": None,
            "model": model,
            "prompt_tokens": out.get("prompt_eval_count", 0),
            "completion_tokens": out.get("eval_count", 0),
            "finish_reason": out.get("finish_reason"),
        }
        await ensemble_audit_log.log_llm_chat(
            audit_kind,
            messages=used,
            model=model,
            max_tokens=mt,
            temperature=temperature,
            response=compat,
        )
        return compat

    try:
        result = await _call_polish(max_tok, audit_kind="joint_polish_initial")
    except Exception as ex:
        logger.warning("[STEP] ensemble joint_polish failed: %s", ex)
        stats["polish_reverted"] = True
        return _safe_fallback_markdown(raw)
    if result.get("error"):
        logger.warning("[STEP] ensemble joint_polish error: %s", result.get("error"))
        stats["polish_reverted"] = True
        return _safe_fallback_markdown(raw)
    polished = (result.get("text") or "").strip()
    if not polished or _looks_like_refusal(polished):
        logger.info("[STEP] ensemble joint_polish reverted (empty or refusal)")
        stats["polish_reverted"] = True
        return _safe_fallback_markdown(raw)
    if _looks_like_instruction_echo(polished):
        logger.warning("[STEP] ensemble joint_polish reverted (instruction echo)")
        stats["polish_reverted"] = True
        return _safe_fallback_markdown(raw)
    post = len(polished)
    pre = len(raw)
    min_post = compute_joint_polish_min_post(pre, defaults)
    if post < min_post and joint_polish_truncation_retryable(result, max_tok):
        retry_tok = min(predict_cap, int(max_tok * 1.5))
        if retry_tok > max_tok:
            logger.info(
                "[STEP] ensemble joint_polish retry after truncation hint "
                "pre_chars=%s post_chars=%s min_post=%s max_tok=%s retry_tok=%s finish_reason=%s",
                pre,
                post,
                min_post,
                max_tok,
                retry_tok,
                result.get("finish_reason"),
            )
            try:
                result = await _call_polish(retry_tok, audit_kind="joint_polish_truncation_retry")
            except Exception as ex:
                logger.warning("[STEP] ensemble joint_polish retry failed: %s", ex)
                stats["polish_reverted"] = True
                return _safe_fallback_markdown(raw)
            if result.get("error"):
                logger.warning("[STEP] ensemble joint_polish retry error: %s", result.get("error"))
                stats["polish_reverted"] = True
                return _safe_fallback_markdown(raw)
            polished = (result.get("text") or "").strip()
            if not polished or _looks_like_refusal(polished):
                logger.info("[STEP] ensemble joint_polish retry reverted (empty or refusal)")
                stats["polish_reverted"] = True
                return _safe_fallback_markdown(raw)
            if _looks_like_instruction_echo(polished):
                logger.warning("[STEP] ensemble joint_polish retry reverted (instruction echo)")
                stats["polish_reverted"] = True
                return _safe_fallback_markdown(raw)
            post = len(polished)
    if post < min_post and joint_polish_compression_retry_enabled(defaults) and not skip_compression:
        raw_passes = defaults.get("ensemble_joint_polish_compression_passes")
        try:
            n_comp = int(raw_passes) if raw_passes is not None and str(raw_passes).strip() != "" else 2
        except (TypeError, ValueError):  # fmt: skip
            n_comp = 2
        n_comp = max(1, min(3, n_comp))
        for comp_i in range(n_comp):
            comp_tok = min(
                predict_cap,
                max(
                    max_tok,
                    int(max_tok * (1.45 + 0.35 * comp_i)),
                    pre // 2 + 4096 + 2048 * comp_i,
                    min_post * 2 + 4096,
                ),
            )
            user_retry = user_msg + _compression_retry_user_suffix(min_post=min_post, pre_chars=pre, attempt=comp_i)
            comp_messages = [
                {"role": "system", "content": JOINT_POLISH_SYSTEM},
                {"role": "user", "content": user_retry},
            ]
            logger.info(
                "[STEP] ensemble joint_polish compression_retry pass=%s/%s pre_chars=%s post_chars=%s min_post=%s comp_tok=%s",
                comp_i + 1,
                n_comp,
                pre,
                post,
                min_post,
                comp_tok,
            )
            try:
                cr = await _call_polish(
                    comp_tok,
                    msgs=comp_messages,
                    temperature=0.08 if comp_i else 0.1,
                    audit_kind=f"joint_polish_compression_pass_{comp_i + 1}",
                )
            except Exception as ex:
                logger.warning("[STEP] ensemble joint_polish compression_retry failed: %s", ex)
                break
            if cr.get("error"):
                logger.warning("[STEP] ensemble joint_polish compression_retry error: %s", cr.get("error"))
                break
            cand = (cr.get("text") or "").strip()
            if cand and not _looks_like_refusal(cand) and not _looks_like_instruction_echo(cand):
                polished = cand
                post = len(polished)
            if post >= min_post:
                break
    if post < min_post:
        logger.warning(
            "[STEP] ensemble joint_polish reverted pre_chars=%s post_chars=%s min_post=%s compression_enabled=%s",
            pre,
            post,
            min_post,
            joint_polish_compression_retry_enabled(defaults) and not skip_compression,
        )
        stats["polish_reverted"] = True
        return _safe_fallback_markdown(raw)
    # Убрать обёртку ```markdown если модель всунула fenced целиком
    fence = re.match(r"^```(?:markdown)?\s*\n(?P<body>.*)\n```\s*$", polished, re.DOTALL)
    if fence:
        polished = fence.group("body").strip()
    polished = _cleanup_joint_markdown(polished)
    logger.info("[STEP] ensemble joint_polish applied pre_chars=%s post_chars=%s", pre, post)
    return polished
