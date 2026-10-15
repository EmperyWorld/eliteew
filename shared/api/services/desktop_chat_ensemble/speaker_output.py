"""Normalize ensemble model output: strip bracket echoes and other speakers' blocks."""

from __future__ import annotations

import re

from api.services.desktop_chat_ensemble.heroes import HERO_SHORT_LABEL
from api.services.desktop_chat_ensemble.joint_section_dedupe import strip_joint_history_preamble
from api.utils.llm_json_extract import strip_llm_channel_markup, strip_llm_thinking_prefix


def scrub_ensemble_channel_leak(text: str) -> str:
    """Defense-in-depth strip of Gemma/llama ``<|channel>thought`` / ``<channel|>`` markers."""
    return strip_llm_thinking_prefix(strip_llm_channel_markup(text or "")).strip()


_RITUAL_LEAD_PATTERNS = (
    re.compile(r"^\s*Я\s+принял\s+(?:тво[ейё]|ваш[еа])\s+решени[^.?!]*[.?!]\s*", re.IGNORECASE),
    re.compile(
        r"^\s*Чтобы\s+продукт\s+не\s+стал\s+[«\"].+?[»\"][^.?!]*[.?!]\s*",
        re.IGNORECASE | re.DOTALL,
    ),
    re.compile(r"^\s*Готова\s+к\s+партнерству\s+на\s+\d+%\s+честности[^.?!]*[.?!]\s*", re.IGNORECASE),
    re.compile(r"^\s*Уровень\s+остроты\s+языковых\s+настроений[^.?!]*[.?!]\s*", re.IGNORECASE),
    re.compile(r"^\s*Если\s+нужно\s+(?:больше\s+)?жесткости\s+или\s+мягкости[^.?!]*[.?!]\s*", re.IGNORECASE),
    re.compile(r"^\s*Если\s+нужно\s+изменить\s+настройки[^.?!]*[.?!]\s*", re.IGNORECASE),
    re.compile(
        r"^\s*(?:Помни|Помню)\s*:?\s*я\s+здесь\s+не\s+для\s+того,\s+чтобы\s+тебе?\s+понравиться[^.?!]*[.?!]\s*",
        re.IGNORECASE,
    ),
    re.compile(r"^\s*Помню,\s+что\s+(?:цель|моя\s+задача)[^.?!]*[.?!]\s*", re.IGNORECASE),
    re.compile(r'^\s*Вопрос\s+[«"„].+?[»"“][^.?!]*[.?!]\s*', re.IGNORECASE | re.DOTALL),
    re.compile(r"^\s*Ответ\s+будет\s+коротким\s+и\s+конкретным\s*:?\s*", re.IGNORECASE),
)

_EDITORIAL_LEAD_PREFIXES = (
    "примечание",
    "внимание",
    "обратите внимание",
    "запрос пользователя",
    "формат вывода",
    "запрещено",
    "контекст запроса",
    "исходник",
    "с уважением",
    "следует помнить",
    "стоит отметить",
    "удалено",
    "личный вклад",
    "введение данных для дополнительного анализа",
)

_EDITORIAL_BODY_NEEDLES = (
    "ответ предоставлен на основе ограничен",
    "ответ основан на ограничен",
    "ограниченного объема доступной информации",
    "ограниченного количества доступных данных",
    "может быть пересмотрен",
    "может быть скорректирован",
    "это общий скелет бизнес-плана",
    "представлен в сокращенном виде",
    "полноценный бизнес-план потребует",
    "полный бизнес-план не может быть сформирован",
    "без доступа к полным данным",
    "ответ составлен с учетом отсутствия",
    "в тексте были убраны дублирующиеся разделы",
    "технический мусор и служебные хвосты удалены",
    "текст был упрощен и структурирован",
    "для устранения дублирования и улучшения читаемости",
    "были сохранены все ключевые пункты и разделы",
)


def assistant_turn_for_prompt_history(raw: str, label: str) -> str:
    """Format past assistant lines for Llama — avoid ``[Name]`` + newline mimicry."""
    text = (raw or "").strip()
    if not text:
        return text
    return f"Реплика участника «{label}»:\n{text}"


def sanitize_ensemble_model_output(
    text: str,
    *,
    hero_id: str,
    roster_hero_ids: list[str],
) -> str:
    """Strip mimicry of old ``[Имя]`` tags and truncate when another speaker block starts."""
    roster_set = {
        HERO_SHORT_LABEL[h.strip()] for h in roster_hero_ids if isinstance(h, str) and h.strip() in HERO_SHORT_LABEL
    }
    own = HERO_SHORT_LABEL.get(hero_id.strip(), hero_id.strip())
    roster_set.add(own)
    other_labels = sorted({L for L in roster_set if own != L}, key=len, reverse=True)

    t = (text or "").strip()
    if not t:
        return t

    # Gemma 4 prefill leak even with enable_thinking=false (same as companion scrub).
    t = scrub_ensemble_channel_leak(t)
    if not t:
        return t

    # Модель копирует служебный префикс из истории («Реплика участника …»), иногда в **bold**.
    _history_echo = re.compile(
        r"^\s*\*{0,2}\s*Реплика\s+участника\s*[«\"']([^»\"']+)[»\"']\s*:\s*\*{0,2}\s*",
        re.IGNORECASE | re.UNICODE,
    )
    for _ in range(5):
        hm = _history_echo.match(t)
        if not hm:
            break
        t = t[hm.end() :].strip()

    # Joint history echo: «Совместный ответ участников […]:»
    t = strip_joint_history_preamble(t)
    if not t:
        return t
    # Утечки координатора ensemble (промпт содержит [Твой блок `b1`: …] — модель иногда копирует в ответ).
    _coord_block_leak = re.compile(r"\s*\[[Тт]вой\s+блок[^\]]+\]\s*", re.UNICODE)
    t = _coord_block_leak.sub("\n", t).strip()
    t = re.sub(r"\n{3,}", "\n\n", t).strip()

    # Обрезаем, если начинается «вторая реплика» или чужой блок с тем же шаблоном.
    _echo_mid = re.compile(
        r"\n\s*Реплика\s+участника\s*[«\"']",
        re.IGNORECASE | re.UNICODE,
    )
    em = _echo_mid.search(t)
    if em:
        t = t[: em.start()].rstrip()

    own_prefix = re.compile(rf"^\s*\[{re.escape(own)}\]\s*", re.MULTILINE)
    for _ in range(4):
        m2 = own_prefix.match(t)
        if not m2:
            break
        t = t[m2.end() :].strip()
    t = _strip_leading_meta_lines(t, own)

    other_first = re.compile(
        rf"^\s*\[({'|'.join(re.escape(L) for L in other_labels)})\]\s*",
        re.MULTILINE,
    )
    if other_labels:
        om = other_first.match(t)
        if om:
            t = t[om.end() :].strip()

    unknown_tag = re.compile(r"^\s*\[([^\]]+)\]\s*", re.MULTILINE)
    um = unknown_tag.match(t)
    if um:
        inner = um.group(1).strip()
        if inner != own and inner not in roster_set:
            t = t[um.end() :].strip()

    cut = len(t)
    for lab in other_labels:
        esc = re.escape(lab)
        for pattern in (rf"\n\s*\n\s*\[{esc}\]\s*", rf"\n\s*\[{esc}\]\s*"):
            for m in re.finditer(pattern, t):
                if m.start() > 0:
                    cut = min(cut, m.start())
    if cut < len(t):
        t = t[:cut].rstrip()

    for _ in range(3):
        m2 = own_prefix.match(t)
        if not m2:
            break
        t = t[m2.end() :].strip()

    t = strip_ensemble_editorial_noise(t, own=own)
    t = _dedupe_consecutive_paragraphs(t)
    return t


def _strip_leading_meta_lines(text: str, own: str) -> str:
    """Убрать служебные заголовки/лейблы, которые backend уже подставляет сам."""
    lines = text.splitlines()
    own_low = own.casefold()
    while lines:
        raw = lines[0].strip()
        if not raw:
            lines.pop(0)
            continue
        heading_plain = re.sub(r"^#{1,6}\s*", "", raw).strip()
        strong_plain = raw.replace("*", "").strip().rstrip(":").strip()
        low = raw.casefold()
        heading_low = heading_plain.casefold()
        strong_low = strong_plain.casefold()
        if heading_low == own_low or heading_low.startswith(f"ответ {own_low}"):
            lines.pop(0)
            continue
        if strong_low == own_low or strong_low.startswith(f"ответ {own_low}"):
            lines.pop(0)
            continue
        if low.startswith(f"{own_low}:"):
            lines[0] = raw.split(":", 1)[1].strip()
            continue
        if low.startswith("цель секции:"):
            lines.pop(0)
            continue
        if low.startswith("**блок ") or low.startswith("блок ") or low.startswith("**цель секции:"):
            lines.pop(0)
            continue
        break
    return "\n".join(lines).strip()


def _strip_internal_reference_noise(text: str) -> str:
    """Убрать технические хвосты: labels, эхо истории и одиночные строки `#`."""
    cleaned: list[str] = []
    for line in text.splitlines():
        s = line.strip()
        low = s.casefold()
        if not s:
            cleaned.append("")
            continue
        if re.fullmatch(r"#{1,6}", s):
            continue
        if low.startswith("реплика участника "):
            continue
        if "[label=" in low or low.startswith("label="):
            continue
        # Inline RAG-ссылки: (label: pl1.txt, fragment: 1)
        s = re.sub(r"\(\s*label\s*:\s*[^)]+\)", " ", s, flags=re.IGNORECASE)
        s = re.sub(r"\s{2,}", " ", s).strip()
        if not s:
            continue
        cleaned.append(s)
    out = "\n".join(cleaned)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


def strip_ensemble_editorial_noise(text: str, *, own: str | None = None) -> str:
    """Убрать ритуальные вступления, служебные секции и шаблонные постскриптумы."""
    t = _strip_ritual_lead_sentences(text)
    t = _strip_internal_reference_noise(t)
    t = _strip_editorial_paragraphs(t, own=own)
    t = re.sub(r"(?:\n\s*---\s*)+\Z", "", t, flags=re.UNICODE).strip()
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def _strip_ritual_lead_sentences(text: str) -> str:
    t = (text or "").strip()
    if not t:
        return t
    changed = True
    while changed and t:
        changed = False
        for pattern in _RITUAL_LEAD_PATTERNS:
            m = pattern.match(t)
            if not m:
                continue
            t = t[m.end() :].lstrip()
            changed = True
    return t.strip()


def _normalize_editorial_line(text: str) -> str:
    raw = re.sub(r"^#{1,6}\s*", "", text.strip())
    raw = re.sub(r"^[\-\*\d\.\)\s]+", "", raw)
    raw = raw.replace("*", "").replace("`", "").strip()
    return raw.casefold()


def _strip_editorial_paragraphs(text: str, *, own: str | None = None) -> str:
    blocks = [b.strip() for b in re.split(r"\n\s*\n", (text or "").strip()) if b.strip()]
    if not blocks:
        return (text or "").strip()
    own_low = (own or "").strip().casefold()
    hero_names = {name.casefold() for name in HERO_SHORT_LABEL.values()}
    kept: list[str] = []
    for block in blocks:
        lines = [ln for ln in block.splitlines() if ln.strip()]
        if not lines:
            continue
        lead = _normalize_editorial_line(lines[0])
        whole = " ".join(_normalize_editorial_line(ln) for ln in lines)
        if any(lead.startswith(prefix) for prefix in _EDITORIAL_LEAD_PREFIXES):
            continue
        if lead in hero_names:
            continue
        if own_low and whole == own_low:
            continue
        if any(needle in whole for needle in _EDITORIAL_BODY_NEEDLES):
            continue
        if lead.startswith("в заключение"):
            continue
        kept.append(block.strip())
    return "\n\n".join(kept).strip()


def _dedupe_consecutive_paragraphs(text: str) -> str:
    """Сжать подряд идущие дубли абзацев (модель иногда повторяет один и тот же блок)."""
    parts = [p for p in text.split("\n\n") if p.strip()]
    if len(parts) < 2:
        return text.strip()
    out: list[str] = []
    prev_norm = ""
    for p in parts:
        n = p.strip()
        norm = n.casefold()
        if len(n) > 64 and norm == prev_norm:
            continue
        out.append(n)
        if len(n) > 64:
            prev_norm = norm
    return "\n\n".join(out).strip()


def strip_registry_boilerplate(text: str) -> str:
    """Remove recycled registry-turn preambles before document assembly."""
    t = _strip_ritual_lead_sentences(text or "")
    t = re.sub(
        r"(?im)^\s*\(участник:\s*[^)]+\)\s*\n+",
        "",
        t,
    ).strip()
    return t


def dedupe_duplicate_h2_headings(text: str) -> str:
    """Keep the first top-level ``##`` block per normalized title; drop later duplicates."""
    blocks = _split_top_level_h2_for_dedupe(text)
    if len(blocks) <= 1:
        return (text or "").strip()
    kept: list[str] = []
    seen: set[str] = set()
    for heading, body, full in blocks:
        if heading:
            key = " ".join(heading.casefold().split())
            if key in seen:
                continue
            seen.add(key)
            kept.append(full.strip())
        elif body.strip():
            kept.append(body.strip())
    return "\n\n".join(kept).strip()


def _split_top_level_h2_for_dedupe(text: str) -> list[tuple[str, str, str]]:
    heading_re = re.compile(r"(?m)^(#{2})\s+(.+?)\s*$")
    raw = (text or "").strip()
    if not raw:
        return []
    matches = list(heading_re.finditer(raw))
    if not matches:
        return [("", raw, raw)]
    blocks: list[tuple[str, str, str]] = []
    if matches[0].start() > 0:
        lead = raw[: matches[0].start()].strip()
        if lead:
            blocks.append(("", lead, lead))
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(raw)
        chunk = raw[match.start() : end].strip()
        heading = match.group(2).strip()
        body = raw[match.end() : end].strip()
        blocks.append((heading, body, chunk))
    return blocks


def sanitize_speaker_reply_body(text: str, *, canonical_title: str | None = None) -> str:
    """Strip registry boilerplate, duplicate ## headings, and redundant title echoes."""
    body = strip_registry_boilerplate(text or "")
    if canonical_title and canonical_title.strip():
        body = re.sub(r"(?m)^#{1,6}\s+.+$\n?", "", body).strip()
        body = strip_registry_boilerplate(body)
    else:
        body = dedupe_duplicate_h2_headings(body)
    body = re.sub(r"(?:\n\s*---\s*)+\Z", "", body).strip()
    body = re.sub(r"\n{3,}", "\n\n", body).strip()
    return body
