# Desktop Ensemble Plan Authoring

Короткая спецификация для создания и правки шаблонов `blueprint` в групповом чате так, чтобы они:

- давали чистый joint-документ без editor leakage;
- реально распределялись между героями по компетенции;
- не ломали default-trio `Ликий / Арли Квиновна / Аким Борисович`;
- масштабировались на ростер **3–6** через `min_roster` (ядро ≤3, расширение 4–6 под новых героев);
- не плодили дублирующие built-in templates.

## Где править

- каталог built-in: `shared/api/services/desktop_chat_ensemble/plan_templates/`
- список и keywords picker: `manifest.json`
- slot assignment: `shared/api/services/desktop_chat_ensemble/blueprint/assign.py`
- профили и slot axes героев: `shared/api/services/desktop_chat_ensemble/heroes.py`
- сборка документа: `shared/api/services/desktop_chat_ensemble/blueprint/assemble.py`
- финальная проверка: `shared/api/services/desktop_chat_ensemble/blueprint/artifact_finalizer.py` (validation → максимум один repair → deterministic fallback)
- mid-turn research probes (Wave 1): `shared/api/services/desktop_chat_ensemble/actions/` — канон [DESKTOP-ENSEMBLE-ACTIONS.md](DESKTOP-ENSEMBLE-ACTIONS.md); `research_plan_v1` выполняет pack после шага `rp1`
- предварительная зачистка/редактура: `shared/api/services/desktop_chat_ensemble/speaker_output.py`, `archive/legacy_freeform/joint_polish.py`
- smoke/unit tests: `shared/api/tests/test_desktop_chat_ensemble_*.py`
- **IDE typing lock:** `blueprint/stream_turn.py` (`stream_blueprint_turn`) — только один typed `except Exception` (узкие типы через `isinstance`). Доп. typed handlers на этом async generator дают ложный basedpyright `reportUnused*` каскад по всему файлу; регрессия — `test_stream_blueprint_turn_typed_except_budget`.

## Когда добавлять новый шаблон, а когда нет

Добавляй новый template только если одновременно выполняются оба условия:

- у запроса есть **устойчивая форма артефакта**: например `business plan`, `research plan`, `release checklist`;
- эту форму нельзя качественно получить безопасным follow-up к существующему template.

Не добавляй новый template, если:

- это тот же артефакт, но с другим названием;
- различается только тон, а не структура;
- разница решается правкой `instruction_for_model` или slot-требований существующего template.

Если built-in почти не используется, конфликтует с соседним или не имеет своего чёткого контракта, лучше **удалить из manifest**, чем держать “на всякий случай”.

## Каркас template-файла

```json
{
  "schema_version": 1,
  "id": "business_plan_v1",
  "version": 1,
  "title": "Бизнес-план",
  "description": "Что это за артефакт и где он полезен.",
  "slots": {},
  "max_steps_per_hero": 2,
  "allow_mermaid": false,
  "steps": [
    {
      "step_id": "bp1",
      "title": "Резюме",
      "instruction_for_model": "Что писать и что не писать.",
      "required_slots": { "rigor": 3, "product": 2 },
      "min_roster": 1
    }
  ],
  "document_outline": [
    { "heading": "Резюме", "step_ids": ["bp1"] }
  ]
}
```

Поле **`min_roster`** (1–6, default `1`): шаг входит в активный план только если `|desktop_ensemble_ids| ≥ min_roster`. Ядро артефакта держите с `min_roster ≤ 3` (или без поля). Шаги расширения для 4–6 участников — `min_roster: 4|5|6`. Runtime: `select_steps_for_roster` + `filter_outline_for_steps` в `blueprint/assign.py`, вызывается из `blueprint/stream_turn.py` до assignment.
## Обязательные правила authoring

### 0. Сценарий — это контракт бизнес-артефакта

Blueprint template должен описывать не “тему разговора”, а узнаваемый рабочий артефакт:

- `artifact_type` — тип результата (`marketing_brief`, `campaign_plan`, `sales_onepager`, `research_plan`, `business_plan`, …).
- `required_context` — какие входные данные нужны для сильного результата: цель, продукт, аудитория, доказательства, бюджет, ограничения.
- `quality_rubric` — 3–5 критериев качества, по которым можно проверить ответ.
- `output_sections` — ожидаемые крупные блоки результата.
- `scope_fence` на шаге — положительная граница: что именно писать в этом шаге, а не только список запретов.
- `output_format` на шаге — желаемая форма: `Факты`, `Гипотезы`, `Нужно добрать`, `Positioning statement`, `KPI model` и т.п.

Профессиональный marketing/business blueprint обязан начинаться с цели и входных данных, а не с канального списка. Если фактов мало, результат должен быть preliminary brief / assumptions memo, а не “финальный план” без источников.

Минимальная рубрика для business/marketing:

- цель бизнеса или решение, ради которого делается артефакт;
- аудитория/ICP/сегмент и контекст покупки/использования;
- что известно как факт, что является гипотезой, чего не хватает;
- рекомендация или структура артефакта, пригодная для работы команды;
- риски формулировок, проверки и следующие доказательные данные.

### 1. Один шаг = одна смысловая задача

Плохо:

- “рынок, экономика, риски, план продаж и операционка” в одном шаге.

Хорошо:

- один шаг про рынок и ценность;
- отдельный шаг про rollout и ownership;
- отдельный шаг про деньги и риски.

### 2. В step instructions запрещай editor leakage явно

Минимум:

- не вставлять имена героев;
- не вставлять `Личный вклад`, `Удалено`, `Контекст запроса`, `Примечание`, `Запрос пользователя`;
- не писать “в этом разделе были убраны дубли...”;
- не дублировать heading из `document_outline`.

Ассемблер и cleanup уже режут часть мусора, но template не должен надеяться на “авось потом почистится”.

### 3. Факты и гипотезы разделяй в самом контракте

Если шаблон касается бизнеса, рынка, экономики или исследований:

- прямо требуй отделять факт от гипотезы;
- запрещай придумывать MQL, SEO, CAC, LTV, сегменты, каналы, бюджеты и цифры без входных данных;
- проси перечислить **какие данные надо добрать**, а не писать “полный план невозможен”.
- если шаг не про rollout или next steps, прямо запрещай `План дальнейших действий`, roadmap и action-plan creep.

### 4. `required_slots` должны отражать реальную специализацию героев

Текущие рабочие оси:

- `brand_voice`
- `rigor`
- `legal_edge`
- `engineering`
- `creative`
- `product`
- `operations`
- `finance`
- `behavioral`
- `growth`
- `research`

Правило:

- если template массовый и должен хорошо работать на default-trio, проверь руками, кто получает каждый шаг **после** `select_steps_for_roster(..., 3)`;
- шаги с `min_roster` 4–6 должны иметь `required_slots`, которые реально открывают новых героев (Марк/Елена/Кристиан/Артур/Диана/Виктор Львович/Николас и др. по `HERO_SLOT_PROFILE`);
- если step должен доставаться узкому герою, у этого героя должен быть **реальный** exact match или заведомо лучший fallback;
- если новый герой не может естественно получать шаги ни в одном template, значит либо template недооформлен, либо герой лишний.

### 5. `document_outline` не должен спорить со step body

Плохо:

- heading `Резюме`, а step body начинается с `Резюме` или `## Резюме`.

Хорошо:

- outline держит структуру;
- step body пишет только содержание раздела.

### 6. Keywords в `manifest.json` нужны для формы артефакта, а не для всей темы мира

Плохо:

- `бизнес`, `идея`, `маркетинг`.

Хорошо:

- `бизнес-план`, `unit economics`, `release checklist`, `custdev`, `one-pager`.

Иначе picker начинает перехватывать почти любой рабочий вопрос в документный режим.

## Каталог рекомендуемых форматов

Актуальный список built-in задаётся **`plan_templates/manifest.json`** (сейчас **26** файла `.json`: 20 общих + 6 IT). Ниже — соответствие документу и назначение; при добавлении шаблона обновляйте и этот список.

| id | Кратко |
|----|--------|
| `business_plan_v1` | Бизнес-план: ядро bp1–bp4; при ростере 4–6 — продажи, орг/талант, capital/экспансия. |
| `marketing_brief_v1` | Маркетинговый бриф: ядро m1–m3; при 4–6 — креатив, sales enablement, ROI. |
| `project_audit_v1` | Аудит: ядро pa1–pa3; при 4–6 — ROI, talent, expansion lenses. |
| `strategy_options_v1` | Стратегии: ядро so1–so3; при 4–6 — capital, expansion, talent fit. |
| `product_spec_v1` | Продуктовая спецификация: проблема, сценарии, объём и приёмка. |
| `code_architecture_audit_v1` | Code-grounded architecture audit: domain lock → EXISTS/PARTIAL/MISSING → Keep/Change/Kill → gap-only MVP; finalizer: `inventory_status_missing`, `domain_surface_lock_missing`, `keep_change_kill_missing`, `reinvents_existing`. Не greenfield PRD. |
| `research_plan_v1` | План исследования: ядро rp1–rp3; при 4–6 — market-entry, behavioral, capital go/no-go. **Wave 1 actions:** после `rp1` — bounded probes (web/RAG/vault/KBSEW) → findings в rp2+; см. [DESKTOP-ENSEMBLE-ACTIONS.md](DESKTOP-ENSEMBLE-ACTIONS.md). |
| `interview_prep_v1` | Карточка комнаты: **Тема** + **Цель** + **Панель интервью** (`hero_id` + роль) + **Гайд для панели** (`artifact_type` `interview_prep`). Picker wins on room-card phrasing («тема интервью», «карточку интервью»), not bare «интервью» in a research plan. **Пройти интервью** starts Discussion with the card’s panel roster and injects the guide into speech context. |
| `sales_onepager_v1` | Sales one-pager: ядро so1–so3; при 4–6 — воронка, procurement, ROI proof. |
| `release_checklist_v1` | Чеклист релиза: объём, проверки, коммуникации. |
| `tech_plan_v1` | Технический план: цели/границы, архитектура (+ mermaid), риски (`s1`–`s3` + заборы). |
| `meeting_notes_v1` | Протокол встречи: контекст, решения, действия. |
| `content_brief_v1` | Бриф на контент: канал, структура, CTA. |
| `incident_postmortem_v1` | Разбор инцидента: хронология, причины, меры. |
| `onboarding_guide_v1` | Гайд по онбордингу: шаги, материалы, поддержка. |
| `knowledge_faq_v1` | FAQ и база знаний: темы, Q&A, пробелы. |
| `job_posting_v1` | Вакансия: ядро jp1–jp3; при 4–6 — hiring bar, first-90, compensation frame. |
| `workshop_program_v1` | Программа воркшопа: аудитория, тайминг, материалы. |
| `campaign_plan_v1` | Campaign plan: ядро cp1–cp3; при 4–6 — sales ops, owners/talent, capital gates. |
| `integration_spec_v1` | Спецификация интеграции: стороны, точки обмена, надёжность. |
| `it_adr_v1` | IT ADR: варианты, влияние на контракты, решение + откат (`artifact_type` `it_adr`). |
| `it_api_change_v1` | IT пакет изменения API: контракт → FE impact → миграция; при roster≥4 — authz/secrets. |
| `it_ui_states_v1` | IT journey + честные UI-состояния + data contract + scope. |
| `it_release_runbook_v1` | IT release/hotfix runbook: шаги/rollback → smoke → go/no-go; ≥4 — secrets/env. |
| `it_threat_model_v1` | IT threat model lite: активы/угрозы → API authz → client trust boundary. |
| `it_incident_brief_v1` | IT incident recovery brief: симптом/слой → mitigation → blast/prevent (не wide postmortem). |

Подробности IT-паков, keywords isolation и слоты IT-героев — §[IT department templates](#it-department-templates-2026-08-09).

Добавлять **новые** templates имеет смысл только если у них есть отдельный контракт (см. раздел «Когда добавлять новый шаблон» выше), например:

- operating model / rollout plan
- unit economics memo
- board memo / decision memo
- partnership brief

## Проверка перед shipping

1. Template описывает **один узнаваемый тип документа**.
2. `manifest.json` keywords не конфликтуют с соседними built-in.
3. `required_slots` дают осмысленное распределение на типовом ростере.
4. В инструкциях явно запрещены hero labels и editor leakage.
5. Для бизнесовых шагов запрещены выдуманные цифры и side-initiatives.
6. `document_outline.heading` и `output_sections` согласованы: finalizer проверяет обязательные секции по **активному** outline (после `min_roster` filter); fuzzy-match игнорирует emoji/markdown в заголовках.
7. Artifact-specific критерии отражены в `quality_rubric`: варианты стратегии реально различаются, ICE считается как `I×C×E` (арифметика валидируется на любом артефакте с ICE-строками), citations входят только в source registry; бренды с цифрами без входа пользователя → `invented_brand`.
8. Compound-запрос (несколько артефактов в одном сообщении): primary template wins; остальные → `deferred_plan_templates` (не смешивать outline).
9. Есть unit/smoke test хотя бы на assignment, validation или cleanup, если менялась логика.
10. Ручной smoke:
   - первичный запрос под template;
   - colloquial «с аудита начнём» → `project_audit_v1`;
   - compound campaign+strategy+research → primary + deferred list;
   - follow-up к уже joint-документу;
   - запрос с `каждый в своей компетенции`;
   - запрос с competence cue вроде `НЛП`, `финмодель`, `handoff`.

## Шпаргалка по частым ошибкам этой сессии

- Слишком широкий шаг делает generic “простыню” и провоцирует повторы.
- Плохой base prompt героя протекает в blueprint даже после compact prompt режима.
- Новый герой без slot axis или template-step так и остаётся декоративным.
- Слишком общие keywords в manifest отправляют диалог в документ там, где нужен обычный чат.
- Если не прогнать short social / direct ping / joint follow-up, баг вернётся не в шаблоне, а на стыке routing + cleanup + roster assignment.
# Групповой Ассистент: диалог vs план и создание шаблонов (blueprint)

## Почему «сразу пишут план», а не отвечают от имени

В коде для группы (`desktop_chat_mode: ensemble`) диспетчер — `shared/api/services/desktop_chat_ensemble/stream_turn.py`: он выбирает движок по `desktop_ensemble_engine` в настройках чата и в **defaults** админки (`desktop_ai_chat_config`).

- **`blueprint` (значение по умолчанию, если ключ нигде не задан)** — сначала смысловая маршрутизация в `conversational_route.py`, затем picker (`blueprint/picker.py`) и пошаговая генерация (`blueprint/stream_turn.py`) только для document intent. Короткая длина не отменяет явную форму `project audit`, `strategy options` или research deliverable. Для `research_plan_v1` / analysis-intent Wave 1 добавляет mid-turn probes (`actions/`) — см. [DESKTOP-ENSEMBLE-ACTIONS.md](DESKTOP-ENSEMBLE-ACTIONS.md); это не отдельный solo `run_tool_loop` на каждого героя.
- **`legacy_freeform`** — отдельный оркестратор `plan_ensemble_speakers` (`archive/legacy_freeform/orchestrator.py`): содержательная задача нескольких героев становится одним joint-артефактом с заголовками из `task_blocks`; `separate` остаётся для social/direct ping и явной просьбы о независимых репликах/дискуссии.

Ожидаемое «каждый персонаж отвечает отдельным сообщением» требует явной conversational формулировки («каждый отдельно», «по очереди», дискуссия). Для рабочей задачи default — один согласованный результат команды, даже если маршрут остался `legacy_freeform`.

### Быстрый операторский обходной путь (без правок кода)

1. **Глобально для новых чатов:** `PATCH /api/v1/desktop/admin/ai-chat/config` — в `defaults` добавить:

   `"desktop_ensemble_engine": "legacy_freeform"`

2. **Один чат:** `PATCH /api/v1/desktop/ai-chat/chats/{id}` — в `settings` то же поле.

3. После смены только файловых builtin-шаблонов перезапустите API: `get_plan_catalog()` кэшируется (`lru_cache`).

### Маршрут «диалог vs blueprint» (гибрид)

При **`desktop_ensemble_engine: blueprint`** (`stream_ensemble_turn`): фаза **`heuristic_ensemble_route_phase`** — быстро blueprint / legacy / **uncertain**. Для **uncertain** при включённом **`ensemble_route_llm_enabled`** (по умолчанию true) — один вызов **`llm_classify_blueprint_intent`** (JSON `intent` + `confidence`). Итог в логах: `ensemble_route -> blueprint` или `blueprint_engine -> legacy_freeform` с пометкой `heuristic_*` / `llm …`.

Отключить только LLM: **`ensemble_route_llm_enabled`: `false`**. Отключить эвристический fallback полностью (всегда blueprint): **`ensemble_blueprint_conversational_fallback`: `false`**.

В **`settings` чата** (и опционально в admin `defaults`): **`desktop_ensemble_routing_mode`** — `auto` \| `semi` \| `chat_only` \| `blueprint_only` (`resolve_ensemble_routing_mode` в `settings.py`). Режим **`semi`**: перед blueprint клиент получает SSE **`ensemble_document_confirm`**, затем повторный `POST .../stream` с **`ensemble_document_confirm`** + **`ref_user_message_id`** (см. **`DESKTOP-LLAMA-CHAT.md`**).

---

## Как устроен шаблон плана (схема `PlanTemplate`)

Валидация: Pydantic `PlanTemplate` в `shared/api/services/desktop_chat_ensemble/blueprint/catalog.py`. Ошибки при сохранении черновика в админке — тело ответа 400 с деталями валидации.

### Корневой объект

| Поле | Назначение |
|------|------------|
| `schema_version` | Сейчас `1`. |
| `id` | Уникальный строковый id шаблона (совпадает с записью в `manifest.json` и с `template_id` в БД). |
| `version` | Версия смысла шаблона (число). |
| `title`, `description` | Заголовок и описание для UI / SSE. |
| `slots` | Опционально: метаданные шаблона (не то же, что `required_slots` у шага). |
| `max_steps_per_hero` | Сколько шагов подряд может делать один герой (1–10), см. `assign.py`. |
| `allow_mermaid` | Разрешить инструкциям упоминать диаграммы; не включает mermaid автоматически. |
| `steps` | Упорядоченный список шагов генерации. |
| `document_outline` | Как склеить итог: секции `##` и какие `step_id` в какой секции. |

### Шаг: `PlanStep`

| Поле | Назначение |
|------|------------|
| `step_id` | Уникален в шаблоне (например `s1`, `m2`). Используется в `document_outline`. Границу шага задавайте через `scope_fence`; legacy `_STEP_SCOPE_FENCE` в `blueprint/stream_turn.py` остаётся fallback для старых встроенных id. |
| `title` | Человекочитаемое имя; второй и далее шаг в одной секции outline даёт `### title` при сборке. |
| `instruction_for_model` | Основная инструкция герою на этот шаг (язык, запреты, формат). Просить не выводить верхний `##` — заголовки секций задаёт сборщик. |
| `required_slots` | Словарь **осей** → требуемое значение 1–3. Оси должны совпадать с ключами `HERO_SLOT_PROFILE` в `heroes.py`: `brand_voice`, `rigor`, `legal_edge`, `engineering`, `creative`, `product`, `operations`, `finance`, `behavioral`. Назначение шага герою — в `assign.py` (точное совпадение профиля или минимум L1). |

### Секция outline: `DocumentOutlineSection`

| Поле | Назначение |
|------|------------|
| `heading` | Текст для `## {heading}` в итоговом markdown. |
| `id` | Опционально; стабильный ключ для `stream_prefix_before_step` (первый шаг секции выводит `##`, следующие — `###`). |
| `step_ids` | Порядок шагов внутри секции. Все id должны существовать в `steps`. |
| `subsections` | Опционально; ссылки на шаги для более сложной структуры (валидатор проверяет `step_id`). |

### Сборка в рантайме

1. `assemble_document` (`blueprint/assemble.py`) — склеивает тела по `outline`.
2. Перед каждым шагом в SSE может уйти префикс `##` / `###` через `stream_prefix_before_step`.
3. Уже выполненные шаги кратко инжектятся в следующий промпт (`_inject_completed_steps`), чтобы не дублировать объём.

### Жёсткие «заборы» по `step_id`

В новых шаблонах граница шага живёт в поле `scope_fence` самого `PlanStep`. В `stream_turn.py` словарь `_STEP_SCOPE_FENCE` оставлен как legacy fallback для старых встроенных id (`s1`–`s3`, `m1`–`m3`, `bp1`–`bp4`) и не должен расширяться для новых сценариев без отдельной причины.

---

## Регистрация шаблона

### Встроенный (файлы в репозитории)

1. Каталог: `shared/api/services/desktop_chat_ensemble/plan_templates/`.
2. Файл `<id>.json` — тело по схеме выше, поле `id` = `<id>`.
3. В `manifest.json` добавить элемент:

   ```json
   {
     "id": "<id>",
     "file": "<id>.json",
     "keywords": ["слово1", "слово2"],
     "example_command": "Один пример пользовательского запроса, в котором есть подстроки из keywords (smoke, документация, админка GET …/builtins)."
   }
   ```

   Поле **`example_command`** опционально для парсера, но для built-in рекомендуется: оно попадает в ответ `GET …/ensemble-plan-templates/builtins` и не влияет на picker, пока пользователь не отправит такой текст в чат.

   Подстроки ключевых слов считаются по тексту пользователя (нижний регистр). При нулевом совпадении эвристика берёт **первый** шаблон в списке manifest — для разнообразия важен порядок и качество keywords.

4. Перезапуск API после изменения файлов (кэш каталога).

### Черновик в БД (без деплоя кода)

- API: `/api/v1/desktop/admin/ai-chat/ensemble-plan-templates` (admin); `GET .../builtins/{id}` (полное тело встроенного); `POST .../validate` (проверка JSON против `PlanTemplate`).
- `POST .../duplicate-builtin` — скопировать существующий файл в БД под новым `template_id`, затем править.
- Активные строки с тем же `template_id`, что у файла, **перекрывают** файл при `get_plan_catalog_for_session`.

Поля строки БД: `template_id`, `keywords`, `body` (полный JSON шаблона), `is_active`, `sort_order`.

### Опциональный LLM-выбор шаблона

Если эвристика слабая, в defaults включите ключи из `blueprint/picker.py`:
`ensemble_blueprint_llm_picker_enabled`, `ensemble_blueprint_llm_picker_min_keywords`, `ensemble_blueprint_llm_picker_min_confidence`, `ensemble_blueprint_llm_picker_max_tokens`.

---

## IT department templates (2026-08-09)

Runtime-first packs for IT cohort heroes (`it_kernel`…`it_relay`). `artifact_type` uses `it_*` (not marketing evidence-sensitive types). Slot axes align with `heroes_it_dept_data.py`.

| `id` | Artifact | Core steps | Expansion (`min_roster≥4`) |
|------|----------|------------|----------------------------|
| `it_adr_v1` | ADR | context/options → contract impact → decision+rollback | — |
| `it_api_change_v1` | API change pack | contract → FE impact → migration | authz/secrets |
| `it_ui_states_v1` | Journey + UI states | journey/states → data contract → scope | — |
| `it_release_runbook_v1` | Release/hotfix runbook | steps+rollback → smoke → go/no-go | secrets/env |
| `it_threat_model_v1` | Threat model lite | assets/threats → API authz → client boundary | — |
| `it_incident_brief_v1` | Incident recovery brief | symptom/layer → mitigation → blast/prevent | — |

Keywords are narrow (see `manifest.json`): positive picks for IT `example_command`s, plus locks that `tech_plan_v1` / `integration_spec_v1` / `incident_postmortem_v1` keep their own example phrasing (no `openapi diff` / bare `recovery brief` on IT entries). Compound mashups may still surface via `compound_deferred_templates`. After file changes restart API (`get_plan_catalog` LRU). Locks: `test_desktop_chat_ensemble_blueprint.py` (`test_it_*`).

---

## Связанные документы

- Общий обзор чата и SSE: `product/DESKTOP-LLAMA-CHAT.md`.
- Профили героев и оси слотов: `shared/api/services/desktop_chat_ensemble/heroes.py` (+ IT: `heroes_it_dept_data.py`).
- Админ UI черновиков: `shared/web/frontend/src/pages/Admin/DesktopEnsemblePlanAdminSection.tsx` и модуль редактора `shared/web/frontend/src/pages/Admin/ensemblePlan/`. Стабильный вход формы — `DesktopEnsemblePlanFormEditor.tsx` (тонкий оркестратор); секции UI — `ensemblePlan/ensemblePlanForm/` (basics / steps / outline / advanced / chrome / JSON). Atomization lock: `ensemblePlanForm/__tests__/DesktopEnsemblePlanFormEditor.atomization.contract.test.ts`.
