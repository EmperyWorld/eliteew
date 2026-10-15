# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Курсорина product answer — grounded synthesize from evidence ledger.
# Invariants:
# - Never invent URLs/metrics absent from evidence.
# - Never expose worker ledger dialect (Цель/Улики/Вывод counters) as the product answer.
# - Drop off-topic web rows (intent token overlap) before LLM synthesize.
# Related:
# - documentation/product/desktop/KURSORINA.md
# - documentation/reference/fixed-errors/kursorina/2026-09-05-decide-web-spam-ledger-answer.md
# - documentation/reference/fixed-errors/kursorina/2026-09-05-synthesize-fake-date-greeting-hygiene.md
# - documentation/reference/fixed-errors/kursorina/2026-09-07-temporal-grounding-search-dedupe-and-render-integrity.md
# - documentation/reference/fixed-errors/kursorina/2026-09-07-deep-synthesis-scale-and-evidence-cleansing.md
# - documentation/reference/solution-readiness/2026-09-06-kursorina-intent-web-grounding.md
# - documentation/reference/solution-readiness/2026-09-07-kursorina-temporal-search-and-render-architecture.md
# - documentation/reference/solution-readiness/2026-09-07-kursorina-deep-synthesis-scale-and-evidence-cleansing.md
# ---

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime

from api.services.kursorina.models import EvidenceItem, MissionSnapshot

logger = logging.getLogger(__name__)

_LEDGER_DIALECT_RE = re.compile(r"(?is)^\s*Цель:.*Улики:|Вывод:\s*по цели собрано улик|library=\d+,\s*web=\d+")
_GREETING_RE = re.compile(r"(?im)^\s*(?:приветствую|здравствуй(?:те)?|добрый\s+(?:день|вечер)|hello|hi)[^\n]*\n+")
_PERSONA_LINE_RE = re.compile(r"(?im)^\s*(?:я\s*[—\-–]\s*курсорина|я\s+курсорина)[^\n]*\n+")
_FAKE_META_DATE_RE = re.compile(
    r"(?im)^\s*\*{0,2}дата\s+(?:отчета|исследования|документа)\*{0,2}:\*{0,2}\s*(?:202[0-4]|\d{1,2}[./-]\d{1,2}[./-]202[0-4])[^\n]*\n*"
)
_DOUBLE_HEADING_RE = re.compile(r"(?m)^(#{2,6})\s+#{1,6}\s+")
_STATUS_META_RE = re.compile(r"(?im)^\s*\*{0,2}статус\*{0,2}:\*{0,2}\s*(?:завершено|completed|готово)\s*\n+")


def current_date_context() -> tuple[str, str, int]:
    """Returns (localized Russian date, ISO DD.MM.YYYY, current year)."""
    now = datetime.now(UTC)
    months = [
        "января",
        "февраля",
        "марта",
        "апреля",
        "мая",
        "июня",
        "июля",
        "августа",
        "сентября",
        "октября",
        "ноября",
        "декабря",
    ]
    date_ru = f"{now.day} {months[now.month - 1]} {now.year} г."
    date_iso = now.strftime("%d.%m.%Y")
    return date_ru, date_iso, now.year


def normalize_latex_math_symbols(text: str) -> str:
    """Normalize LaTeX math and arrow markup to clean Unicode symbols for Markdown rendering."""
    if not text:
        return ""
    s = text
    s = re.sub(r"\$\\rightarrow\$|\\rightarrow\b", "→", s)
    s = re.sub(r"\$\\leftarrow\$|\\leftarrow\b", "←", s)
    s = re.sub(r"\$\\Rightarrow\$|\\Rightarrow\b", "⇒", s)
    s = re.sub(r"\$\\Leftarrow\$|\\Leftarrow\b", "⇐", s)
    s = re.sub(r"\$\\leftrightarrow\$|\\leftrightarrow\b", "↔", s)
    s = re.sub(r"\$\\times\$|\\times\b", "×", s)
    s = re.sub(r"\$\\cdot\$|\\cdot\b", "·", s)
    s = re.sub(r"\$\\le\$|\$\\leq\$|\\leq\b|\\le\b", "≤", s)
    s = re.sub(r"\$\\ge\$|\$\\geq\$|\\geq\b|\\ge\b", "≥", s)
    s = re.sub(r"\$\\approx\$|\\approx\b", "≈", s)
    s = re.sub(r"\$\\neq\$|\\neq\b", "≠", s)
    s = re.sub(r"\$\\pm\$|\\pm\b", "±", s)
    s = re.sub(r"\$\\Sigma\$|\\Sigma\b", "Σ", s)
    s = re.sub(r"\$\\Delta\$|\\Delta\b", "Δ", s)
    s = re.sub(r"\$\\alpha\$|\\alpha\b", "α", s)
    s = re.sub(r"\$\\beta\$|\\beta\b", "β", s)
    s = re.sub(r"\$\s*([><]=?)\s*([0-9.]+)\s*\$", r"\1 \2", s)
    s = re.sub(r"\$\s*([A-Za-z0-9_]+)\s*(?:\\times|×)\s*([A-Za-z0-9_]+)\s*\$", r"\1 × \2", s)
    s = re.sub(r"\$([A-Za-z0-9_]+)\$", r"\1", s)
    return s


_SYNTH_SYSTEM = """Ты Курсорина — ведущий эксперт-аналитик и работник-расследователь высшей квалификации.
Твоя задача — составить фундаментальный, максимально глубокий, развернутый аналитический отчет и deliverable для руководства и технической команды, строго решая поставленную цель (GOAL) и опираясь на собранные улики (EVIDENCE).

Принципы и структура отчета:
1. Максимальная полнота и глубина (Zero superficiality):
   - Никаких поверхностных отписок или кратких выжимок на 500-1000 слов. Составляй всесторонний, многостраничный технический отчет уровня Principal Architect / Lead Investigator.
   - Каждый пункт должен быть аргументирован, подробно расписан и содержать высокую прикладную ценность для корпоративного заказчика.
   - Сразу к делу: без приветствий, без «Я — Курсорина», без шаблонных вступлений и дежурных фраз.

2. Обязательная композиция отчета (8 ключевых разделов):
   ## 1. Аналитическая записка: профиль компании, продуктовый контекст и цели цифрового суверенитета
   ## 2. Архитектурная концепция закрытого контура и схема взаимодействия компонентов (Mermaid)
   ## 3. Сводная инженерная матрица брифа (детальный опросник на 25–35+ вопросов с вариантами и влиянием)
   ## 4. Специфика, структура и объемы данных (Data Volume, TPS/RPS, потоковая обработка, хранение)
   ## 5. Требования к ядру ОС, системным компонентам и импортозамещению (Linux kernel, модули безопасности, runtime)
   ## 6. Информационная безопасность, защищенный туннель и криптографическая изоляция (ГОСТ-шифрование, mTLS, сетевой контур)
   ## 7. Ролевая модель доступа (RBAC/ABAC), аутентификация и неизменяемый аудит событий (WORM, SIEM, Keycloak)
   ## 8. Карта регуляторного комплаенса, матрица рисков и дорожная карта пилотного внедрения

3. Требования к Сводной инженерной матрице брифа (Раздел 3):
   - Если в цели запрошен бриф, техническое задание, опросник или перечень вопросов:
     Сформируй масштабную структурированную таблицу Markdown не менее чем на 25–35 вопросов (по 4–6 конкретных вопросов по каждому домену: бизнес, стек, данные, ядро ОС, безопасность, доступ/аудит, стандарты).
   - Столбцы таблицы:
     | № | Домен | Вопрос | Назначение (зачем задан) | Варианты ответов / Формат | Влияние на архитектуру EliteEW | EVIDENCE / Метрики | Стандарт / Регламент |
   - Варианты ответов обязательно расписывать предметно с техническими альтернативами (например: А) Вариант 1, Б) Вариант 2, В) Вариант 3, Г) Свой вариант) и конкретными диапазонами значений, а не абстрактно.
   - Влияние на архитектуру должно четко объяснять, как ответ заказчика определяет выбор компонентов операционной среды закрытого типа.

4. Интеграция архитектурных схем и артефактов из EVIDENCE:
   - В Разделе 2 обязательно представь наглядную диаграмму ```mermaid ... ``` (в синтаксисе flowchart TD или graph TD), отображающую закрытый контур заказчика, защищенный туннель, шлюзы аутентификации, ядро платформы EliteEW, изоляцию процессов и хранилища данных.
   - Если в EVIDENCE есть артефакты (kind="diagram", kind="compliance", kind="risk", kind="table", kind="roadmap", kind="company", kind="doc") — обязательно интегрируй их таблицы, матрицы и выводы в соответствующие разделы отчета.

5. Форматирование и математические символы:
   - Заголовки только ## и ###.
   - Активно используй таблицы Markdown, жирный шрифт, списки и маркировку.
   - Строго запрещено использовать LaTeX-разметку формул вроде $\\rightarrow$ или $P \\times I$. Используй исключительно чистые символы Unicode (→, ×, ≤, ≥, ±, Σ, Δ).

6. Актуальность и календарный контекст (No 2024 cutoff hallucination):
   - Всегда опирайся на переданную реальную текущую дату и год исследования. Ни в коем случае не используй дату отсечки обучения модели (2024 год и т.п.).
   - Если в шапке документа указывается дата исследования, используй переданную реальную дату.

7. Интеграция графиков и диаграмм (Data Visualizations):
   - Если в переданных уликах (EVIDENCE) есть сохраненные графики (например, kind="library" с файлом .png и content_id), обязательно размести ссылку на изображение в соответствующем разделе (Раздел 2 или Раздел 8):
     ![Название графика](/api/v1/content/<content_id>/download)
"""


def evidence_for_synthesize(mission: MissionSnapshot) -> list[EvidenceItem]:
    """Substantive ledger rows for product answer (skip pure search hits / notes)."""
    from api.services.kursorina.plan import intent_topic_tokens

    out: list[EvidenceItem] = []
    # Prioritize substantive deliverables and structured artifacts first
    prio_kinds = {
        "python",
        "library",
        "diagram",
        "table",
        "kbsew",
        "project",
        "finance",
        "swot",
        "company",
        "entities",
        "html_report",
        "risk",
        "benchmark",
        "roadmap",
        "compliance",
        "statistics",
    }
    toks = intent_topic_tokens(mission.goal)

    def _web_on_topic(e: EvidenceItem) -> bool:
        if e.kind != "web":
            return True
        blob = f"{e.ref or ''} {e.extract or ''}".casefold()
        extract_len = len((e.extract or "").strip())
        if len(toks) < 2:
            return extract_len >= 40
        hits = sum(1 for t in toks if t in blob)
        if len(toks) < 4:
            return hits >= 1
        # Off-topic SERP (e.g. unrelated YouTube) must not feed the product answer.
        return hits >= 2

    prio = [e for e in mission.evidence if e.kind in prio_kinds]
    rest = [
        e
        for e in mission.evidence
        if e.kind not in prio_kinds
        and e.kind not in {"doc_hit", "code_hit", "dir", "note"}
        and not (e.kind == "library_hit" and len((e.extract or "").strip()) < 40)
        and _web_on_topic(e)
    ]
    out = prio + rest
    return out[:64]


def structured_user_answer(mission: MissionSnapshot) -> str:
    """Deterministic user-facing fallback — not worker ledger dump."""
    goal = (mission.goal or "").strip()
    items = evidence_for_synthesize(mission)
    lines: list[str] = []
    if not items:
        return (
            f"По цели «{goal}» substantive-источников не собрано. "
            "Нужны файлы в вашей библиотеке или доступный веб-поиск."
        )

    web_n = sum(1 for e in items if e.kind == "web")
    lib_n = sum(1 for e in items if e.kind in {"library", "library_hit", "folder"})
    lines.append(f"Кратко по цели «{goal}»:")
    lines.append("")
    lines.append("Что удалось извлечь из источников:")
    for i, e in enumerate(items[:12], start=1):
        title = (e.extract or "").split("\n", 1)[0].strip() or e.ref
        title = title[:160]
        body = (e.extract or "").replace("\n", " ").strip()
        if body.startswith(title):
            body = body[len(title) :].strip(" —:-")
        snippet = body[:220] if body else ""
        if e.kind == "web" and e.ref:
            lines.append(f"{i}. {title}")
            if snippet and snippet != title:
                lines.append(f"   {snippet}")
            lines.append(f"   Источник: {e.ref}")
        else:
            lines.append(f"{i}. {title}")
            if snippet and snippet != title:
                lines.append(f"   {snippet}")
            if e.ref and e.kind != "web":
                lines.append(f"   (id: {e.ref})")
        lines.append("")

    gaps: list[str] = []
    if web_n and "топ" in goal.casefold():
        gaps.append(
            "Согласованного ранжированного топа с метриками в сниппетах может не быть — "
            "выше только то, что явно следует из найденных страниц."
        )
    if lib_n == 0 and web_n > 0:
        gaps.append("В вашей библиотеке релевантных файлов не найдено; опирались на веб.")
    if not gaps:
        gaps.append("Цифры и факты вне цитат выше не добавлялись.")
    lines.append("Пробелы:")
    for g in gaps:
        lines.append(f"— {g}")
    return "\n".join(lines).strip()


def _looks_like_ledger_dump(text: str) -> bool:
    return bool(_LEDGER_DIALECT_RE.search(text or ""))


_GOAL_STOPWORDS = frozenset(
    {
        "проведи",
        "провести",
        "исследуй",
        "изучи",
        "сделай",
        "построй",
        "нужно",
        "также",
        "включая",
        "подробную",
        "подробный",
        "комплексную",
        "комплексный",
        "отчет",
        "анализ",
        "оценку",
        "оценка",
        "компанию",
        "компании",
        "данные",
        "данных",
        "платформы",
        "платформу",
        "ready",
        "with",
        "from",
        "that",
        "this",
        "have",
        "your",
    }
)


def goal_topic_tokens(goal: str) -> list[str]:
    """Meaningful tokens from the user **intent** for soft coverage checks."""
    from api.services.kursorina.plan import intent_topic_tokens

    return intent_topic_tokens(goal)


def goal_coverage_ok(goal: str, answer: str, *, min_hits: int = 2) -> bool:
    """
    Soft gate: polished answer should mention enough goal topic tokens
    or an explicit gaps section. Thin decorative shells fail.
    """
    blob = (answer or "").casefold()
    if not blob.strip():
        return False
    if any(m in blob for m in ("пробел", "не удалось", "не найден", "не хвата", "недостаточно")):
        return True
    toks = goal_topic_tokens(goal)
    if len(toks) < 2:
        return True
    hits = sum(1 for t in toks if t in blob)
    need = min(min_hits, max(1, len(toks) // 3))
    return hits >= need


def find_png_chart_evidence(evidence: list[EvidenceItem]) -> list[tuple[str, str]]:
    """Return list of (filename, content_id) for PNG charts in evidence."""
    charts: list[tuple[str, str]] = []
    seen_cids: set[str] = set()
    uuid_pattern = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I)
    for e in evidence:
        if e.kind in {"library", "file"}:
            ext = (e.extract or "").lower()
            ref = str(e.ref or "")
            if ".png" in ext or ".png" in ref.lower():
                m = uuid_pattern.search(ref) or uuid_pattern.search(e.extract or "")
                if m:
                    cid = m.group(0)
                    if cid in seen_cids:
                        continue
                    seen_cids.add(cid)
                    fname = "График исследования"
                    fn_match = re.search(r"([\w\-]+\.png)", e.extract or "")
                    if fn_match:
                        fname = fn_match.group(1)
                    charts.append((fname, cid))
    return charts


def polish_product_answer(text: str, evidence: list[EvidenceItem] | None = None) -> str:
    """Deterministic hygiene: greetings, fake meta dates, doubled ATX markers, LaTeX math, chart embedding."""
    s = (text or "").strip()
    if not s:
        return ""
    # Repeat a few times — models stack greeting + persona lines.
    for _ in range(3):
        nxt = _GREETING_RE.sub("", s, count=1)
        nxt = _PERSONA_LINE_RE.sub("", nxt, count=1)
        if nxt == s:
            break
        s = nxt.strip()
    # Correct any hallucinated cutoff date (e.g. 24.05.2024) to the actual date
    _, date_iso, _ = current_date_context()
    s = re.sub(
        r"(?im)^(\s*\*{0,2}дата(?:\s+[a-zа-яё]+)?\*{0,2}:\*{0,2}\s*)(?:202[0-4]|\d{1,2}[./-]\d{1,2}[./-]202[0-4])[^\n]*",
        rf"\g<1>{date_iso}",
        s,
    )
    s = _FAKE_META_DATE_RE.sub("", s)
    s = _STATUS_META_RE.sub("", s)
    s = _DOUBLE_HEADING_RE.sub(r"\1 ", s)
    s = normalize_latex_math_symbols(s)

    # Embed chart deliverables if present in evidence and not yet referenced
    if evidence:
        charts = find_png_chart_evidence(evidence)
        for fname, cid in charts:
            download_url = f"/api/v1/content/{cid}/download"
            if cid not in s and download_url not in s:
                img_block = f"\n\n### Индекс технической готовности и визуализация\n![{fname}]({download_url})\n"
                sec8_idx = s.find("## 8.")
                s = s[:sec8_idx] + img_block + "\n" + s[sec8_idx:] if sec8_idx != -1 else s + img_block

    # Collapse leftover blank lines at top
    s = re.sub(r"^\s*\n+", "", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def _cites_any_evidence(text: str, items: list[EvidenceItem]) -> bool:
    """Soft check: answer mentions at least one known URL or extract token."""
    blob = (text or "").casefold()
    if not blob.strip():
        return False
    for e in items:
        ref = (e.ref or "").strip()
        if ref.startswith("http") and ref.casefold() in blob:
            return True
        if e.kind in {
            "python",
            "diagram",
            "table",
            "kbsew",
            "project",
            "finance",
            "swot",
            "company",
            "entities",
            "html_report",
            "risk",
            "benchmark",
            "roadmap",
            "compliance",
            "statistics",
        }:
            return True
        token = (e.extract or "").split("\n", 1)[0].strip()[:40]
        if len(token) >= 12 and token.casefold() in blob:
            return True
    # Allow honest-gap answers without cites when evidence is thin
    if any(m in blob for m in ("пробел", "не удалось", "не найден", "не хвата")):
        return True
    return len(items) == 0


async def synthesize_answer(mission: MissionSnapshot) -> str:
    """Build product answer from evidence; never invent; never ledger dialect."""
    items = evidence_for_synthesize(mission)
    fallback = structured_user_answer(mission)
    if not items:
        return fallback

    try:
        import httpx

        from api.core.unified_config import unified_settings
        from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json
    except ImportError:
        return fallback

    base = str(getattr(unified_settings, "llama_url", "") or "").strip().rstrip("/")
    # default_ai_model ← LLAMA_MODEL; llama_model attr does not exist on UnifiedConfig.
    model = str(getattr(unified_settings, "default_ai_model", "") or "").strip() or "local"
    if not base:
        return fallback

    ledger = []
    for e in items:
        ext_len = (
            3500
            if e.kind
            in {
                "python",
                "diagram",
                "table",
                "kbsew",
                "project",
                "finance",
                "swot",
                "company",
                "entities",
                "html_report",
                "risk",
                "benchmark",
                "roadmap",
                "compliance",
                "statistics",
                "doc",
                "path",
                "web",
            }
            else 1200
        )
        ledger.append({"kind": e.kind, "ref": e.ref, "extract": (e.extract or "")[:ext_len]})

    date_ru, date_iso, cur_year = current_date_context()
    system_content = (
        f"{_SYNTH_SYSTEM}\n\n"
        f"КАЛЕНДАРНЫЙ КОНТЕКСТ: Сегодня {date_ru} (текущий {cur_year} год). "
        f"Если в отчете указывается дата документа, укажи актуальную дату: {date_iso}. "
        f"Никогда не используй устаревшие даты отсечки обучения (2024 г.). "
        f"Все формулы и стрелки пиши чистыми символами Unicode (→, ×, ≤, ≥), а не кодами LaTeX."
    )
    charts = find_png_chart_evidence(mission.evidence)
    chart_note = ""
    if charts:
        chart_lines = ["\nСОХРАНЕННЫЕ ГРАФИКИ И ДИАГРАММЫ (ОБЯЗАТЕЛЬНО ВКЛЮЧИ В РАЗДЕЛ 2 ИЛИ 8):"]
        for fname, cid in charts:
            chart_lines.append(f"- ![{fname}](/api/v1/content/{cid}/download)")
        chart_note = "\n".join(chart_lines) + "\n"

    user = (
        f"КАЛЕНДАРЬ: {date_ru} ({cur_year} год)\n\n"
        f"GOAL:\n{mission.goal.strip()}\n\n"
        f"EVIDENCE (JSON):\n{__import__('json').dumps(ledger, ensure_ascii=False)}"
        f"{chart_note}"
    )
    timeout = httpx.Timeout(240.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            raw = await httpx_compat_chat_completion_json(
                client,
                base,
                model=model,
                messages=[
                    {"role": "system", "content": system_content},
                    {"role": "user", "content": user},
                ],
                options={"temperature": 0.2, "num_predict": 12288},
                timeout=timeout,
            )
    except Exception as exc:  # noqa: BLE001 — synthesize boundary
        logger.info("[STEP] kursorina_synthesize_fail err=%s", type(exc).__name__)
        return fallback

    text = ""
    if isinstance(raw, dict):
        text = str(raw.get("response") or raw.get("content") or "").strip()
    else:
        text = str(raw or "").strip()
    if len(text) < 40 or _looks_like_ledger_dump(text) or not _cites_any_evidence(text, items):
        logger.info("[STEP] kursorina_synthesize_reject reason=quality_or_ungrounded")
        return fallback
    text = polish_product_answer(text, evidence=mission.evidence)
    if len(text) < 40:
        logger.info("[STEP] kursorina_synthesize_reject reason=polish_empty")
        return fallback
    if not goal_coverage_ok(mission.goal, text):
        logger.info("[STEP] kursorina_synthesize_reject reason=goal_coverage")
        return fallback
    return text[:64_000]


__all__ = (
    "evidence_for_synthesize",
    "find_png_chart_evidence",
    "goal_coverage_ok",
    "goal_topic_tokens",
    "polish_product_answer",
    "structured_user_answer",
    "synthesize_answer",
)
