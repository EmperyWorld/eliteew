"""Опциональный второй проход «председатель» для согласования скелета joint-хода."""

from __future__ import annotations

import logging

from api.services.desktop_chat_ensemble import ensemble_audit_log
from api.services.llama_service import LlamaService

logger = logging.getLogger(__name__)

CHAIR_SYSTEM = """Ты — нейтральный председатель панели экспертов EliteEW (не персонаж-герой).
По запросу пользователя и черновику раскладки блоков дай **короткое согласование** (3–8 предложений по-русски):
- подтверди порядок блоков или предложи минимальную перестановку, если логичнее;
- укажи, чего не должно дублироваться между блоками;
- без новых фактов о продукте и выдуманных цифр.

Ответ — обычный текст или markdown без преамбулы «я председатель»."""


async def chair_refine_joint_blueprint(
    llama: LlamaService,
    *,
    model: str,
    user_excerpt_tail: str,
    draft_blueprint_markdown: str,
    max_tokens: int = 512,
) -> str:
    """Возвращает короткие замечания председателя или пустую строку при ошибке."""
    draft = (draft_blueprint_markdown or "").strip()
    if not draft:
        return ""
    user_msg = (
        f"## Запрос пользователя (сжато)\n{user_excerpt_tail[:6000]}\n\n## Черновик раскладки блоков\n{draft[:12000]}\n"
    )
    messages = [
        {"role": "system", "content": CHAIR_SYSTEM},
        {"role": "user", "content": user_msg},
    ]
    mt = max(128, min(max_tokens, 1024))
    try:
        result = await llama.chat(
            messages,
            model=model,
            stream=False,
            max_tokens=mt,
            temperature=0.15,
        )
    except Exception as ex:
        logger.warning("ensemble chair call failed: %s", ex)
        return ""
    await ensemble_audit_log.log_llm_chat(
        "joint_chair_blueprint",
        messages=messages,
        model=model,
        max_tokens=mt,
        temperature=0.15,
        response=result,
    )
    if result.get("error"):
        logger.warning("ensemble chair error: %s", result.get("error"))
        return ""
    text = (result.get("text") or "").strip()
    return text[:4000]
