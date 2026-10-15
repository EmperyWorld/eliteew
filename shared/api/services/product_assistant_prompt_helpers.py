# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Чистые хелперы промпта справочника: история чата, FAQ по релевантности, RAG-источники.
# Invariants:
# - Без I/O; бюджеты символов согласованы с product_desktop._compose_assistant_prompt.
# Related:
# - api/routers/product_desktop.py
# ---

from __future__ import annotations

import re

from api.utils.llm_json_extract import strip_llm_channel_markup, strip_llm_thinking_prefix

ASSISTANT_CHAT_HISTORY_MAX_TURNS = 6
ASSISTANT_CHAT_HISTORY_MAX_CHARS = 8_000
ASSISTANT_FAQ_PROMPT_MAX_ENTRIES = 16
ASSISTANT_REPLY_MAX_CHARS = 4_500
ASSISTANT_LLAMA_NUM_PREDICT = 1_024
ASSISTANT_DEGENERATE_FALLBACK = (
    "Не удалось сформировать ответ. Попробуйте переформулировать вопрос короче "
    "или выберите подсказку в «Частые вопросы» слева. "
    "Если тема срочная — откройте приложение «Обращения» на рабочем столе."
)
_FAQ_TOKEN_RE = re.compile(r"[\w\u0400-\u04FF]{3,}", re.UNICODE)
_ASSISTANT_ROLE_PREFIX_RE = re.compile(
    r"^(?:помощник|ответ)\s*:\s*",
    re.IGNORECASE,
)
_ECHO_NEXT_USER_TURN_RE = re.compile(r"\n\s*Пользователь\s*:", re.IGNORECASE)
_ECHO_NEXT_ASSISTANT_TURN_RE = re.compile(r"\n\s*Помощник\s*:", re.IGNORECASE)
_DEGENERATE_ERROR_SPAM_RE = re.compile(
    r"(?:error_error|app_error|struction/app_error|struction_error)",
    re.IGNORECASE,
)
_DEGENERATE_R_SPAM_RE = re.compile(
    r"(?:\br\s+){8,}|(?:\br/\s*){6,}|(?:/\s*r/){4,}|(?:r/\s*r/){4,}",
    re.IGNORECASE,
)
_DEGENERATE_COMPONENT_SPAM_RE = re.compile(
    r"(?:MusicForgeApp|AppStore|DesktopAiChatApp|MusicPlayer|AssistantApp)"
    r"(?:,\s*(?:MusicForgeApp|AppStore|DesktopAiChatApp|MusicPlayer|AssistantApp)){2,}",
    re.IGNORECASE,
)
_DEGENERATE_PATH_NOISE_RE = re.compile(
    r"generation/generation|__eliteew-desktop-open-r-app__|__eliteew-desktop-r_"
    r"|/r/r/r|con\s+f\s+r",
    re.IGNORECASE,
)
_DEGENERATE_JSON_LEAK_RE = re.compile(
    r"```\s*json|^\s*\{\s*\"reply_markdown\"|\"reply_markdown\"\s*:",
    re.IGNORECASE | re.MULTILINE,
)
_DEGENERATE_UNDERSCORE_CHAR_SPAM_RE = re.compile(
    r"(?:_р_а_м_){3,}|(?:_р_){6,}",
    re.IGNORECASE,
)
_DEGENERATE_UNDERSCORE_TOKEN_RE = re.compile(
    r"_[\u0400-\u04FFa-z]_",
    re.IGNORECASE,
)
_DEGENERATE_HYPHEN_TOKEN_LOOP_RE = re.compile(
    r"(?:\b[A-Za-z\u00C0-\u024F\u0400-\u04FF]{1,12}-){8,}",
)
_DEGENERATE_S_S_SPAM_RE = re.compile(r"(?:\bS-S-){8,}", re.IGNORECASE)
_ASSISTANT_JSON_FENCE_RE = re.compile(r"```(?:json|JSON)?\s*([\s\S]*?)```?", re.IGNORECASE)
_RAG_TITLE_LEAK_RE = re.compile(r"\[AI\s+Ч", re.IGNORECASE)
_DESKTOP_LINK_PATH_TYPO = "__eliteew-desktop-desktop-open-app__"
_SINGLE_CHAR_TOKEN_RE = re.compile(r"\S+")


def _assistant_single_char_token_ratio(text: str) -> float:
    tokens = _SINGLE_CHAR_TOKEN_RE.findall(text or "")
    if len(tokens) < 40:
        return 0.0
    singles = sum(1 for token in tokens if len(token) == 1)
    return singles / len(tokens)


def is_assistant_history_content_usable(content: str, *, role: str) -> bool:
    """Skip poisoned assistant turns so they are not re-fed into the prompt."""
    text = (content or "").strip()
    if not text:
        return False
    if role == "assistant":
        if text in ("?", "??", "???"):
            return False
        if len(text) > 2_500:
            return False
        if is_assistant_reply_degenerate(text):
            return False
        if text.count("Пользователь:") >= 1:
            return False
    return True


def is_assistant_reply_degenerate(text: str) -> bool:
    """Detect llama-server / Gemma runaway completions (error spam, dialog echo, hangul noise)."""
    raw = (text or "").strip()
    if not raw:
        return True
    if raw in ("?", "??", "???"):
        return True
    if raw.startswith("?") and len(raw) > 12:
        return True
    if len(raw) > ASSISTANT_REPLY_MAX_CHARS:
        return True
    if _DEGENERATE_ERROR_SPAM_RE.search(raw):
        return True
    if _DEGENERATE_R_SPAM_RE.search(raw):
        return True
    if _DEGENERATE_COMPONENT_SPAM_RE.search(raw):
        return True
    if _DEGENERATE_PATH_NOISE_RE.search(raw):
        return True
    if _DEGENERATE_JSON_LEAK_RE.search(raw):
        return True
    if _DEGENERATE_UNDERSCORE_CHAR_SPAM_RE.search(raw):
        return True
    if len(raw) >= 24 and len(_DEGENERATE_UNDERSCORE_TOKEN_RE.findall(raw)) >= 8:
        return True
    if _DEGENERATE_HYPHEN_TOKEN_LOOP_RE.search(raw):
        return True
    if _DEGENERATE_S_S_SPAM_RE.search(raw):
        return True
    if _RAG_TITLE_LEAK_RE.search(raw) and len(raw) > 120:
        return True
    if _assistant_single_char_token_ratio(raw) > 0.28:
        return True
    if raw.count("error") >= 8:
        return True
    if raw.count("Пользователь:") >= 2:
        return True
    if raw.count("Помощник:") >= 2:
        return True
    return bool(re.search(r"[\uac00-\ud7af]{3,}.*(?:error|_어)", raw))


def truncate_assistant_reply_echo_continuations(text: str) -> str:
    """Cut when the model starts imitating the next chat turn or leaking RAG titles."""
    raw = (text or "").strip()
    if not raw:
        return raw
    leak = _RAG_TITLE_LEAK_RE.search(raw)
    if leak and leak.start() > 8:
        raw = raw[: leak.start()].strip()
    for pattern in (_ECHO_NEXT_USER_TURN_RE, _ECHO_NEXT_ASSISTANT_TURN_RE):
        match = pattern.search(raw)
        if match and match.start() > 8:
            raw = raw[: match.start()].strip()
    return raw


def normalize_assistant_desktop_markdown_links(text: str) -> str:
    """Fix common model typos in desktop deep-link paths."""
    if not text:
        return text
    out = text.replace(_DESKTOP_LINK_PATH_TYPO, "__eliteew-desktop-open-app__")
    out = out.replace("/__eliteew-desktop-open ", "/__eliteew-desktop-open-app__/")
    return out


def contextual_assistant_degraded_fallback(user_message: str) -> str:
    """Short helpful fallback when LLM output is unusable but intent is clear."""
    user_lower = (user_message or "").lower()
    music_link = "[Студия песен](/__eliteew-desktop-open-app__/MusicForgeApp)"
    if any(k in user_lower for k in ("песн", "музык", "music generator", "генератор музыки", "сделать песню")):
        return (
            "Не удалось получить ответ от модели. Для создания песни откройте "
            f"{music_link} на рабочем столе "
            "или уточните вопрос в «Частые вопросы» слева."
        )
    if any(k in user_lower for k in ("картин", "изображ", "image studio", "фото")):
        return (
            "Не удалось получить ответ от модели. Для создания изображения откройте "
            "[Студию изображений](/__eliteew-desktop-open-app__/ImageStudio) "
            "или уточните вопрос в «Частые вопросы»."
        )
    if any(k in user_lower for k in ("позвон", "звонок", "видеозвон", "созвон", "meet", "jitsi")):
        return (
            "Не удалось получить ответ от модели. Для видеозвонка откройте "
            "[GAF Chat](/__eliteew-desktop-open-app__/GAFChatApp), выберите диалог "
            "и нажмите «Начать видеозвонок» в шапке чата. "
            "Также можно открыть [Видеозвонки](/__eliteew-desktop-open-app__/VideoCallApp)."
        )
    return ASSISTANT_DEGENERATE_FALLBACK


def guard_assistant_reply_quality(text: str, *, user_message: str = "") -> str:
    """Return fallback copy when sanitized text is still unusable for end users."""
    cleaned = (text or "").strip()
    if not cleaned or is_assistant_reply_degenerate(cleaned):
        return contextual_assistant_degraded_fallback(user_message)
    return cleaned


def format_assistant_chat_history_block(
    rows: list[dict[str, str]],
    *,
    max_turns: int = ASSISTANT_CHAT_HISTORY_MAX_TURNS,
    max_chars: int = ASSISTANT_CHAT_HISTORY_MAX_CHARS,
) -> str:
    """Сформировать блок prior chat для промпта (role/content, хронология от старых к новым)."""
    if not rows:
        return ""
    trimmed_rows = rows[-max(1, max_turns * 2) :]
    lines: list[str] = []
    total = 0
    for row in trimmed_rows:
        role = (row.get("role") or "").strip().lower()
        content = (row.get("content") or "").strip()
        if role not in ("user", "assistant") or not content:
            continue
        if not is_assistant_history_content_usable(content, role=role):
            continue
        label = "Пользователь" if role == "user" else "Помощник"
        line = f"{label}: {content}"
        sep = "\n\n" if lines else ""
        add_len = len(sep) + len(line)
        if total + add_len > max_chars:
            break
        lines.append(line)
        total += add_len
    return "\n\n".join(lines)


def build_assistant_rag_query(user_text: str, history_rows: list[dict[str, str]]) -> str:
    """Обогатить RAG-запрос последним вопросом пользователя для коротких уточнений."""
    q = (user_text or "").strip()
    if not q or not history_rows:
        return q
    last_user = ""
    for row in reversed(history_rows):
        if (row.get("role") or "").strip().lower() == "user":
            last_user = (row.get("content") or "").strip()
            break
    if not last_user or last_user == q:
        return q
    combined = f"{last_user}\n{q}"
    return combined[:2000]


def strip_assistant_json_envelope(raw: str) -> str:
    """Remove leaked JSON fences / wrapper objects before sanitize."""
    text = strip_llm_thinking_prefix(strip_llm_channel_markup(raw or "")).strip()
    if not text:
        return text
    fenced = _ASSISTANT_JSON_FENCE_RE.findall(text)
    if fenced:
        return "\n\n".join(part.strip() for part in fenced if part.strip()).strip()
    if '"reply_markdown"' in text:
        start = text.find("{")
        if start >= 0:
            text = text[start:]
    return text.strip()


def sanitize_assistant_model_reply(raw: str) -> str:
    """Strip control tokens, role prefixes, dialog echo, and fix desktop links."""
    text = strip_assistant_json_envelope(raw)
    if is_assistant_reply_degenerate(text):
        return ""
    text = _ASSISTANT_ROLE_PREFIX_RE.sub("", text)
    text = truncate_assistant_reply_echo_continuations(text)
    text = normalize_assistant_desktop_markdown_links(text)
    if is_assistant_reply_degenerate(text):
        return ""
    if len(text) > ASSISTANT_REPLY_MAX_CHARS:
        text = text[: ASSISTANT_REPLY_MAX_CHARS - 1].rstrip() + "…"
    return text.strip()


def _faq_match_tokens(text: str) -> set[str]:
    return {m.group(0).lower() for m in _FAQ_TOKEN_RE.finditer(text or "")}


def extract_keyword_snippet(body: str, query: str, *, max_len: int = 900) -> str:
    """Фрагмент текста KB с максимальным пересечением токенов запроса (для keyword-RAG)."""
    text = (body or "").strip()
    if not text:
        return ""
    if len(text) <= max_len:
        return text
    tokens = _faq_match_tokens(query)
    if not tokens:
        return text[: max_len - 1] + "…"
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        return text[: max_len - 1] + "…"
    best = max(paragraphs, key=lambda p: sum(1 for t in tokens if t in p.lower()))
    if len(best) <= max_len:
        return best
    return best[: max_len - 1] + "…"


def score_faq_entry_relevance(query: str, question: str, answer: str) -> int:
    """Число совпадающих токенов запроса с FAQ (простой keyword-boost)."""
    tokens = _faq_match_tokens(query)
    if not tokens:
        return 0
    hay = f"{question} {answer}".lower()
    return sum(1 for t in tokens if t in hay)


def merge_rag_content_id_order(
    primary_ids: list[str],
    supplement_ids: list[str],
    *,
    limit: int,
) -> list[str]:
    """Vector-first порядок document_id без дубликатов (для гибридного RAG)."""
    seen: set[str] = set()
    out: list[str] = []
    for doc_id in primary_ids:
        key = (doc_id or "").strip()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(key)
        if len(out) >= limit:
            return out
    for doc_id in supplement_ids:
        key = (doc_id or "").strip()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(key)
        if len(out) >= limit:
            break
    return out


def select_faq_entries_for_prompt(
    entries: list[dict[str, str]],
    query: str,
    *,
    limit: int = ASSISTANT_FAQ_PROMPT_MAX_ENTRIES,
) -> list[dict[str, str]]:
    """FAQ по релевантности к запросу; при нулевом score — порядок как в БД."""
    if not entries:
        return []
    if not (query or "").strip():
        return entries[:limit]
    scored: list[tuple[int, int, dict[str, str]]] = []
    for idx, entry in enumerate(entries):
        q = entry.get("question") or ""
        a = entry.get("answer") or ""
        scored.append((score_faq_entry_relevance(query, q, a), idx, entry))
    if max(s[0] for s in scored) <= 0:
        return entries[:limit]
    scored.sort(key=lambda item: (-item[0], item[1]))
    picked = [entry for score, _, entry in scored if score > 0][:limit]
    return picked or entries[:limit]


def build_faq_context_block(
    entries: list[dict[str, str]],
    query: str,
    *,
    limit: int = ASSISTANT_FAQ_PROMPT_MAX_ENTRIES,
    max_chars: int = 12_000,
) -> str:
    """Сформировать блок FAQ для промпта с учётом релевантности запроса."""
    selected = select_faq_entries_for_prompt(entries, query, limit=limit)
    lines: list[str] = []
    total = 0
    for entry in selected:
        line = f"Q: {entry.get('question') or ''}\nA: {entry.get('answer') or ''}"
        sep = "\n\n" if lines else ""
        add_len = len(sep) + len(line)
        if total + add_len > max_chars:
            break
        lines.append(line)
        total += add_len
    return "\n\n".join(lines)


def collect_rag_source_labels(source_labels: list[str | None]) -> list[str]:
    """Уникальные заголовки документов KB для блока «Источники»."""
    out: list[str] = []
    seen: set[str] = set()
    for raw in source_labels:
        label = (raw or "").strip()
        if not label:
            continue
        key = label.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(label)
    return out


def format_assistant_rag_sources_footer(source_labels: list[str]) -> str:
    """Markdown-футер с перечнем документов KB (до 5 названий)."""
    labels = collect_rag_source_labels(source_labels)
    if not labels:
        return ""
    shown = labels[:5]
    parts = "; ".join(f"«{label}»" for label in shown)
    suffix = f" (+{len(labels) - len(shown)} ещё)" if len(labels) > len(shown) else ""
    return f"\n\n---\n*Источники справочника:* {parts}{suffix}"


def maybe_append_rag_sources_footer(reply: str, source_labels: list[str | None]) -> str:
    """Дописать источники, если модель не указала их и RAG дал фрагменты."""
    text = (reply or "").strip()
    if not text or not source_labels:
        return reply
    lower = text.lower()
    if "источник" in lower or "источники справочника" in lower:
        return reply
    footer = format_assistant_rag_sources_footer(source_labels)
    return f"{text}{footer}" if footer else reply
