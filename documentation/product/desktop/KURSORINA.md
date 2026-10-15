# Курсорина (Kursorina)

**Status:** living SoT (backend-owned Celery run + public UI view)  
**Edition:** cloud (manifest enable) · **Pack:** shared-only Desktop app  
**App id:** `kursorina` · **Component:** `KursorinaApp`  
**Not:** Desktop AI Chat / Experts / EWA `call_expert_chat` / `research_plan_v1` — those stay untouched.

## 1. Intent

Курсорина — **общий работник-расследователь** пользователя EliteEW: одна механика на любую цель.

```text
goal → (backend) observe / library / docs / web / note evidence → revise → answer or blocked
```

Не генератор «красивого отчёта» и не шаблон жанра. Документ — опциональный export поверх улик, не позвоночник пайплайна.

**Identity (locked):** per-user worker. Primary world → user Content Manager / library (`search_library` / `list_folder` / `read_content`). Platform docs/code — secondary. Web — external channel. Not a monorepo CI agent.

## 2. Non-goals (v1)

- Не чинить и не вызывать Ассистент / Experts ensemble / agentic research_plan.
- Не council / heroes / long-compose min chars.
- Не обещать consulting-grade market research без внешних данных — честный `blocked` или ответ с gaps.
- Не показывать пользователю tool names / decide kitchen.
- Не крутить длинный цикл в HTTP request path или FE tick-loop.

## 3. Mission state

| Field | Meaning |
|-------|---------|
| `goal` | User task text |
| `status` | `queued` \| `running` \| `completed` \| `blocked` \| `cancelled` |
| `steps[]` | Worker-only append-only tool ledger (not in product API) |
| `evidence[]` | Worker ledger; product maps subset → `results[]` |
| `answer` | Final prose when `completed` |
| `block_reason` | When `blocked` / cancel |
| `step_budget` | Default **16** (hard stop → finish if evidence else block) |
| `cancel_requested` | Soft cancel between loop steps |
| `celery_task_id` | Optional Celery id after enqueue |

**Complete** only when the worker decides the goal is answered from evidence (or explicitly notes gaps in the answer). При исчерпании веб-квоты или лимита шагов при наличии содержательных улик расследование гарантированно завершается через `finish` с передачей всех фактов на серверный синтез глубокого отчета.  
**Blocked** when required material cannot be obtained — not when markdown is short, и никогда не блокируется преждевременно, если в реестре есть содержательные материалы или не исчерпан бюджет шагов.

Persistence: Postgres table `kursorina_missions` (migration `20260905_01_kursorina_missions.sql`; runtime `ensure_schema()` safety net). Principal-scoped.

**Storefront:** catalog row `app-kursorina` / `KursorinaApp` via `20260905_02_desktop_app_catalog_kursorina.sql` (+ Default access group).

## 4. Runtime ownership

1. `POST /missions` → capacity check → row `queued` → Celery `short` queue → `201` **MissionPublicView**.  
2. Worker (`api.tasks.kursorina.run_kursorina_mission`) drives `tick_mission` until terminal or cancel.  
   **Реал-тайм персистентность (Per-Step Persistence):** после каждого отдельного вызова инструмента (`run_tool`, `run_python`, `save_to_library`, `read_content`, `read_path`) воркер немедленно выполняет `await save_mission(mission)`, обновляя шаги, накопленные улики и карточки находок в PostgreSQL.
   **Гарантированное сохранение терминального состояния:** перед любым выходом из цикла шагов (`finish`, `block`, исчерпание бюджета, отмена пользователем), а также безусловно по завершении Celery-задачи в `jobs.py` вызывается `await save_mission(mission)`, что исключает зависание статуса `running` в БД при завершившемся воркере.
3. FE опрашивает `GET /missions/{id}` (~1.5s) и сразу получает живые обновления:
   - `progress`: динамический статус с отображением текущего исполняемого действия (аудит стандартов, анализ рисков, чтение библиотеки, изучение конкретного веб-хоста) и актуального счетчика источников.
   - `results`: живой список карточек находок (вкладка «Источники и факты» и счетчик «Находок в журнале»), наполняющийся по мере работы воркера, а не в конце задачи.  
   List refresh (`GET /missions?limit=30`) is **merge-by-id** with AbortController: a late/empty list must not wipe a just-created selection or stop poll. Composer auto-opens only when history is empty **and** nothing is selected.  
4. `POST .../cancel` sets `cancel_requested` (queued → cancelled immediately).  
5. `DELETE /missions/{id}` deletes a user-owned mission record (`204 No Content`).
6. `POST .../tick` — **debug/sync only**; product UI must not call it.

### Desktop UI Surface (`KursorinaApp`)

- **Sidebar (История расследований):** список предыдущих задач пользователя, строка быстрого поиска, бейджи статусов (`В очереди`, `В работе`, `Готово`, `Остановка`, `Отменено`), счетчик находок, удаление.
- **Composer (Постановка цели):** готовые бизнес-шаблоны (рыночный анализ, реестры ПО, юнит-экономика, корпоративная библиотека), горячие клавиши `Ctrl+Enter`, счетчик символов.
- **Report View (Аналитический отчет):** честный трекер статуса (очередь → в работе → готово/остановка) + backend `progress`; Markdown через **`KursorinaReportMarkdown`**; ` ```mermaid gantt ` → **`RoadmapTimeline`**; `flowchart`/`graph` → **`ProcessFlow`**; `sequenceDiagram` → **`SequenceFlow`** (`features/diagrams/sequence-flow`); прочий Mermaid — `presentation=document`; SWOT/risk GFM-таблицы → editorial **SwotMatrix** / **RiskMatrix**; PNG-галерея; экспорт `.MD`.
- **Findings View (Источники и факты):** фильтрация по типам (веб, библиотека, Python), сниппеты, безопасный переход по внешним ссылкам; для PNG-артефактов библиотеки — **превью изображения** (тот же authenticated download), без произвольных remote `<img>`.
- **Layout:** основная колонка `max-w-[min(100%,88rem)]` (`kursorinaLayout.ts`) — заполняет ultrawide без bleed на 4K; findings на xl — 2 колонки.
- **Goal View (Параметры цели):** инспекция исходного промпта, технических метаданных и клонирование задачи.

### Concurrency

| Env | Default | Role |
|-----|---------|------|
| `KURSORINA_MAX_PER_USER` | `1` | Active (`queued`+`running`) per principal |
| `KURSORINA_MAX_GLOBAL` | `32` | Active across tenants |

Over limit → HTTP **429** with human message. Create path also rechecks after insert and cancels the overflow row if caps were raced; recheck failure is fail-closed (**503**, mission `blocked` — no enqueue).

Celery: queue `short`; soft 600s / hard 660s. Worker terminalizes on uncaught errors (capacity unlock). Soft cancel is re-read from DB **before** each tick batch. Queued→running uses an atomic claim that refuses cancelled / `cancel_requested` rows. Debug `POST .../tick` returns **409** while a Celery-owned mission is `queued`/`running`.

Residual: rare dual Celery delivery on the same already-`running` mission is not lease-fenced in v1 (acks_late resume preferred over stuck-after-crash).

## 5. Tools (worker v1)

| Tool | Role |
|------|------|
| `search_library` | Hybrid catalogue search via `ContentQueryService.list_content` (ACL; `owner_only=False`) |
| `list_folder` | Folder / unassigned listing (`folder_item_id` / `folder_unassigned`) |
| `read_content` | Read one content row after ACL (`get_content` → `extracted_text`) |
| `note` | Append a short worker note to the evidence ledger |
| `search_docs` | Find paths under `documentation/` (rg + name fallback) — secondary |
| `search_code` | Find paths under `shared/api/**/*.py` (allowlisted) — secondary |
| `read_path` | Read an allowlisted platform file/dir (size-capped) |
| `web_search` | **Yandex Search API** via `run_web_search_with_sources` + desktop surface |
| `fetch_url` | Open an **http(s) evidence URL** via Desktop SSRF-safe fetcher; store page text as `web` evidence (≤3 default / ≤5 when python/file deliverables); **ranked by goal-token overlap**; **PDF extraction via PyMuPDF**; **verified TLS with no insecure fallback**; **null-byte stripping** |
| `run_python` | Only fixed built-in unit-economics / technical-readiness models with empty `code`; custom Python and the `script` alias are blocked pending an isolated executor. Built-in calculations use ordinary functions (no `exec`) and retain Pillow PNG → Content Manager + physical export in `/app/generated_files/kursorina/{mission_id}/` |
| `save_to_library` | Optional export: create a **private** markdown document in the user's Content Manager (≤1 / mission; auto after finish when goal asks to save, names `*.md`, or requests tables/analytical reports) + physical export in `/app/generated_files/kursorina/{mission_id}/` |
| `knowledge_base_search` | Корпоративный RAG-поиск по бочкам знаний **KBSEW** (индексированные регламенты, стандарты, ГОСТы, политики организации); автоматический выбор подходящей бочки по домену |
| `search_projects` | Поиск по внутренним проектам, дорожным картам и инициативам организации в PostgreSQL (статусы, приоритеты, дескрипшены, компании) |
| `search_companies` | Поиск зарегистрированных компаний, клиентских организаций и профилей предприятий в PostgreSQL (отрасли, масштаб, сайты, тарифы) |
| `generate_diagram` | Построение визуальных архитектурных и процессных схем **Mermaid** (`flowchart`, `sequenceDiagram`, `erDiagram`, `mindmap`, `timeline`) с сохранением файла `.mermaid`/`.svg` в библиотеке и на диске |
| `extract_table_data` | Аналитическое структурирование данных в форматированные Markdown/CSV матрицы с автоматическим расчетом агрегатов (сумма $\Sigma$, среднее avg) по числовым колонкам |
| `calculate_financial_metrics` | Детерминированный расчёт метрик **только из явных `inputs`** (CAGR/LTV/CAC/Payback/Runway/NPV). Пустые/дефолтные входы → честный gap, без шаблонного CAC/CAGR |
| `swot_matrix_analysis` | Построение формальной 4-квадрантной матрицы **SWOT** с синтезом перекрестных стратегических инициатив (SO, WO, ST, WT стратегии) |
| `export_file` | Прямая выгрузка структурированных deliverables (`.csv`, `.json`, `.svg`, `.md`, `.txt`) в Content Manager и локальную файловую систему пользователя |
| `export_executive_html` | Генерация автономного представительского **HTML-досье** (Executive Dossier / Whitepaper) с адаптивной версткой, карточками KPI и стилизацией под печать/PDF |
| `extract_key_entities` | Структурированное извлечение и категоризация сущностей (организации, числовые/валютные метрики, даты/периоды, стандарты ГОСТ/ISO) из накопленных улик |
| `risk_matrix_assessment` | Оценка рисков проекта с расчетом индекса критичности ($P \times I$), ранжированием уровней (Критический/Высокий/Средний/Низкий) и выработкой превентивных стратегий митигации |
| `competitor_benchmark_matrix` | Взвешенный бенчмарк **только при явных `scores`** (критерии: `str`\|`dict`). Без scores — gap MD, без RNG и фейкового «лидерства» subject |
| `generate_timeline_roadmap` | Формирование поэтапной дорожной карты реализации (фазы, кварталы, вехи, итоговые deliverables) с генерацией синтаксически валидной диаграммы Ганта **Mermaid Gantt** |
| `verify_compliance_standards` | Аудит регуляторного и технического соответствия нормативным требованиям (**152-ФЗ**, **ГОСТ Р 57580.1**, **ФСТЭК №17/21**, **ISO/IEC 27001**) с расчетом индекса готовности |
| `aggregate_market_statistics` | Детерминированный статистический анализ числовых рядов (Min, Max, Mean, Median, Std Dev, процентили $P_{25}/P_{75}/P_{90}$, межквартильный размах IQR, детектирование выбросов) |
| `finish` | Set `completed` + **grounded synthesize** from evidence (not ledger dump) |
| `block` | Set `blocked` + reason |

Path allowlist (platform tools only): `documentation/`, `shared/apps/`, `shared/api/services/`, `shared/api/routers/` (and domain packages under services) — never secrets/env/`trash/`.

Library tools never accept `user_id` from tool args — only `ToolRuntime.user_id` from the mission principal.

**Dual-flag:** `list_folder` — if both `folder_item_id` and `unassigned` are set, **folder wins** (`unassigned` ignored).

**Evidence kinds (product `results[]`):** `library_hit`, `library`, `folder`, `note`, `web`, `file`, `code`, `kbsew`, `project`, `diagram`, `table`, `finance`, `swot`, `company`, `entities`, `html_report`, `risk`, `benchmark`, `roadmap`, `compliance`, `statistics` (skips `doc_hit` / `code_hit` / `dir`). `note` is ledger-only for worker scratch — **not** enough alone to `finish`.

### Decide policy (heuristic + LLM guards)

**Identity:** investigator orchestra — **not** a Yandex bot. Web is one channel among many.

1. **Hard gate:** first tool is always `search_library` (LLM cannot skip).  
2. **Investigation plan** (`plan.py`): facets from goal cues. **Never** replace a company/standards hit with a default market+competitors+economics pack because of bare «бизнес». Market pack merges only on real marketish cues (рынок/конкурент/CAGR/…).  
3. After library probe → **`_internal_probe_action`**: `search_companies` (компания/ООО) → `knowledge_base_search` (регламенты/ГОСТ) → `search_docs`/`read_path` when EliteEW/platform/closed OS cues → `search_projects`. **Then** optional targeted `web_search` only if `_needs_web_channel`.  
4. Market / «в сети» / топ-N / competitor research → library probe → internals → facet `web_search` (budget ≤6 when facets pending) — **do not** force-read every library hit before switching tools.  
5. **Library thrash guard:** duplicate/empty `search_library` → shorten / read / switch / finish (`guard_library_thrash_*`).  
6. Diagram / table tools **only** on explicit visualization/table-structure asks with real evidence — **no sample mermaid/table theatre** to «cover» architecture prose.  
7–18. Goal-regex deliverables (finance/SWOT/risk/benchmark/roadmap/compliance/stats/python/export) unchanged honesty rules — finance/benchmark only with real inputs/scores.  
19. After SERP: **`fetch_url`** on goal-overlapping refs; internals still beat more SERP when pending.  
20–24. Non-external library/folder/platform/code paths unchanged.  
25. Evidence → `finish` → **`synthesize_answer`**. **`rewrite_premature_finish`**: **internal probes → facet deliverables → deepen → goal tools → web last** → **`goal_ready_for_finish`** (else honest `block` / `read_content`).  
26. Save-to-library after finish when asked.  
27. Exhausted + empty / incomplete investigation → `block` (never fake `completed`).

**Finish gate (`goal_ready_for_finish`):** unread `library_hit` → `read_content` first; open facets → not ready; thin `kbsew` alone does not count as substance; **brief / question-list** goals need depth ≥2 (library read, company row, deep web ≥1500 chars, or substantial docs/KB/compliance/risk/diagram/table/roadmap). Empty `search_docs` / `search_code` → `ok=False` (no fake facet cover). Empty `search_companies` CRM miss → `ok=True` (probe done; covers companies facet; guard seamlessly switches to targeted web search `q деятельность продукты стек`).  
**No premature block:** missions with step budget remaining do not block early, actively pursuing analytical deliverable tools or targeted web search.  
**Full prompt preservation:** `goal_intent_text` retains up to 8,000 characters without early 800-char clipping.  
**Deep synthesis:** `num_predict: 8192`, evidence extracts up to 3500 chars for deliverables/docs/web, final report ceiling 48k chars. Exhaustive, fundamental business briefs with domain-structured questions, impact analysis, and artifact integration.  
**Temporal grounding:** Real-world current date/year (`current_date_context`) dynamically injected into `_DECISION_SYSTEM` and `_SYNTH_SYSTEM` prompts. LLM operates strictly in the current year, preventing 2024 cutoff hallucinations. `polish_product_answer` replaces obsolete pre-training date headers with the current calendar date.  
**Clean search queries & deduplication:** `strip_markdown_decorations` and `clean_web_search_query` remove markdown scaffolding (`#`, `*`, `[]()`, quotes) from search queries. `guard_llm_action` alternates to fresh facet queries or fetch/python/finish rather than re-attempting identical failed queries.  
**Frontend render integrity:** Table delimiter parsing supports any valid GFM separator (1, 2, 3+ dashes with or without colons: `:--`, `:-:`, `---`), preventing GFM tables from being broken into raw pipe paragraphs. Architectural Mermaid diagrams with `subgraph` are cleanly parsed into topological steps and rendered via EliteEW's custom `ProcessFlow` editorial component (numbered cards with dependency badges and desktop design tokens), eliminating fallback to raw Mermaid SVG rectangles. LaTeX math formulas and arrow symbols are normalized to clean Unicode characters (`→`, `×`, `≤`, `≥`, `P × I`) both in backend report polish and frontend markdown normalization.
**Enterprise Technical Readiness & Python Visuals:** The built-in runner directly computes the fixed technical-readiness model without compiling or executing Python source when `code` is empty for technical/architecture/readiness goals. The Pillow chart engine renders dark-slate executive charts with domain readiness scores (0-100%), gridlines, and labels, saving PNG artifacts to Content Manager. `synthesize.py` instructs the LLM and automatically embeds saved PNG charts via `/api/v1/content/<content_id>/download` directly into the analytical report.

Facet coverage: **companies** via `search_companies` / kind `company` (**not** SERP-only); **standards** via KB/docs ≥200 chars or compliance; **architecture** via diagram **or** doc/path evidence — empty docs search does not cover. **strategy/economics/roadmap/risks** as before. Synthesize is **deliverable-first** (бриф/вопросы); «Пробелы» ≤3 short bullets — not Рекомендации+Пробелы as the product.

`step_budget` defaults to **16**, or **24** when the goal names python/png/md deliverables.

`guard_llm_action` rewrites unsafe LLM picks (early web without library/internal probe, web when channel not needed, library thrash, web dedupe, finish-before-probes, fetch URL from ledger, mid-loop save). **Decide `reason`** is snake_case.

Decide/synthesize chat uses `unified_settings.default_ai_model` (`LLAMA_MODEL`); OpenAI-compat resolve maps basename / sentinel `local` to the live `/v1/models` id (e.g. `/models/….gguf`).

- Product `answer` is **never** the worker ledger dump (`Цель` / `Улики` / `library=`). That dump remains only as `answer_from_evidence` for debug.
- Synthesize polish: strip greetings/persona, dynamic current date injection (never 2024 training cutoff), doubled ATX (`## ##`), LaTeX math & arrow normalization to Unicode; soft goal-token coverage or explicit «Пробелы» — else deterministic `structured_user_answer`.
- **`evidence_for_synthesize`** drops off-topic `web` rows (intent token overlap); deliverable kinds stay prioritized.
- **Deep Synthesis Scale & Questionnaire Engine:** `_SYNTH_SYSTEM` enforces an 8-chapter structure and mandates at least 4–6 questions per domain (25–35+ questions total in Section 3) with option variants (A/B/C/D), metrics, purpose, and architectural impact. Token output limit is expanded to 12,288 tokens (up to 64,000 characters).
- **Library Echo Shield:** `tool_search_library` deduplicates results by normalized title; `_unread_library_hits` in `decide.py` skips duplicate titles and caps `read_content` steps to a maximum of 2 distinct files per mission.
- **Safe PDF & Evidence Cleansing:** `fetch_url.py` prevents raw binary byte fallback on failed PDF extraction; `tool_fetch_url` rejects binary streams (`%PDF-`) from entering the evidence ledger.
- **Company Tech Stack Discovery:** `query_for_facet` for companies detects tech stack, DBMS, and architecture requirements, targeting IT infrastructure, vacancies, and architectural profiles.
- No inventing metrics/URLs outside evidence.
- `fetch_url` only for ledger http(s) refs; private/loopback blocked by Desktop fetcher SSRF; failed fetches log `err_type` + `repr`; failed hosts are not re-deepened in the same mission.
- `save_to_library` uses `ContentStorageService.create_content` with `user_id` from `ToolRuntime` only; visibility private.

## 6. Product API shape

Prefix: `/api/v1/kursorina`  
Response model: **`MissionPublicView`** — `id`, `goal`, `status`, `progress`, `results[]`, `answer`, `block_reason`, timestamps. **No `steps`.**

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/missions` | Enqueue mission |
| `GET` | `/missions/{id}` | Poll public view |
| `GET` | `/missions` | Recent for principal |
| `POST` | `/missions/{id}/cancel` | Soft cancel |
| `POST` | `/missions/{id}/tick` | Debug only |

Auth: desktop authenticated user. Principal-scoped rows only.

## 7. Failure / edge

| Axis | Behavior |
|------|----------|
| Offline / LLM down | Heuristic library→(external: facet web)→read→docs/code→web→finish/block; never invent market metrics |
| Yandex down / quota | Honest observation; may `block` — no fake hits |
| Library ACL deny | Honest observation (`access denied` / empty); continue or `block` |
| Dual-flag | No call into Experts / agentic research_plan |
| Permission | Auth required; library via ContentQueryService ACL; path allowlist deny → observation |
| Capacity | 429 per-user / global active caps |
| Cancel | Soft between steps; queued cancelled immediately |
| Scale | Celery short queue — not HTTP long-poll body |
| Regression | `tests/test_kursorina_*.py` + `verify-app-factory.sh kursorina` |

## 8. UI

Minimal Desktop window: goal → Start → status/progress → findings → answer/block. Cancel while active. Poll only — no «Ещё шаг», no tool list.

## 9. Related

- Manifest: `shared/apps/kursorina/app.manifest.yaml`
- Service: `shared/api/services/kursorina/` (`jobs.py`, `library.py`, `loop.py`, `decide.py`, `plan.py`, `synthesize.py`, …)
- Celery: `shared/api/tasks/kursorina.py`
- Router: `shared/api/routers/kursorina.py`
- FE: `shared/web/frontend/src/pages/Desktop/apps/KursorinaApp.tsx`
- Migration: `shared/api/migrations/applied/20260905_01_kursorina_missions.sql`
- Catalog: `shared/api/migrations/applied/20260905_02_desktop_app_catalog_kursorina.sql`
- Library: `api/services/unified_content/content_query_service.py`
- Web stack: `api/services/desktop_chat/tools/web_search_tool.py` → `search_service` (Yandex)
- Fixed-errors: `documentation/reference/fixed-errors/kursorina/` (consult before kursorina code)
- Solution readiness: `documentation/reference/solution-readiness/` (READY projection before cause-layer edits)
- Editions: `documentation/platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md`

### Untrusted URL transport

Desktop/Kursorina and BI URL documents use `shared/api/services/safe_url_transport.py`. Each redirect resolves all addresses, rejects any non-public result, and connects only to the selected numeric IP with the original Host and TLS SNI. Environment proxies are disabled. Per-hop clients avoid TLS connection reuse across different names sharing an IP. A single deadline covers DNS, redirects and streaming.

Desktop retains a bounded text prefix and its truncation marker. BI URL downloads reject bodies over 20 MiB and use a 45-second total download deadline (Tika extraction has its separate existing timeout). HTTP content encoding is requested as identity; unexpected gzip/br/deflate representations are rejected before reading to avoid decompression amplification. File-format compression, such as a downloaded ZIP archive without HTTP Content-Encoding, is not HTTP transport compression. Invalid certificates are reported as failures. Internal configured Tika service traffic remains on its existing client.
