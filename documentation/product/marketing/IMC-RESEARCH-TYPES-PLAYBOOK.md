# ИМК: типы исследований в маркетинговом кабинете

Кураторский набор после `20260621_imc_rag_research_types_curated.sql`; пошаговая оркестрация — `20260621_06_imc_rag_orchestrate_reenable.sql`. Провайдер — **`imc_rag_research_provider`**, контекст только **материалы проекта (vault/RAG)**, **без веб-поиска**.

Общий формат ответа: markdown с **«Краткое резюме»**, разделами из `imc_output_sections` и таблицей **факт — цитата — источник**. Если данных нет — явная пометка «Недостаточно материалов», без общих советов.

**Orchestrate включён** (`imc_rag_orchestrate: true`, `imc_prompt_version` ≥ 3) — отчёт по разделам `imc_output_sections` + merge; step/merge `num_predict` заданы в `type_metadata` (8192 / 12288), а не prod `IMC_RAG_NUM_PREDICT` целиком на один вызов.

## Активные типы (15)

| type_key | Название в UI | Когда использовать | Что загрузить |
|----------|---------------|-------------------|---------------|
| `imc_rag_swot` | SWOT-анализ | Стратегическая картина сильных/слабых сторон | Брифы, исследования, внутренние мемо |
| `imc_rag_jtbd` | Задачи клиентов (JTBD) | Какие «работы» решает продукт | Интервью, опросы, транскрипты |
| `imc_rag_competitive` | Конкурентный анализ | Игроки и отличия предложений | Конкурентные обзоры, сравнения, КП |
| `imc_rag_trends_signals` | Тренды и риски рынка | Изменения рынка по вашим документам | Отраслевые отчёты, мемо, слайды |
| `imc_rag_cabinet_analysis` | Сводка по материалам | Быстрый отчёт «что уже знаем» | Любые материалы проекта |
| `imc_rag_target_audience` | Целевая аудитория | Сегменты, ICP, персоны | Интервью, опросы, брифы ЦА |
| `imc_rag_value_proposition` | Ценностное предложение | Ценность для клиента и доказательства | Лендинги, УТП, исследования |
| `imc_rag_voice_of_customer` | Отзывы и опросы клиентов | Темы из NPS/CSAT и отзывов | Экспорты опросов, отзывы |
| `imc_rag_cx_journey` | Путь клиента | Этапы, касания, трения | Воронка, скрипты, обращения |
| `imc_rag_positioning_messaging` | Позиционирование и сообщения | УТП, иерархия сообщений | Брендбук, креативы, брифы |
| `imc_rag_pricing_packaging_rf` | Цены и пакеты | Тарифы и коммерческая логика | Прайсы, КП, договорные выдержки |
| `imc_rag_channel_partner_rf` | Каналы продвижения | Каналы и партнёры | Медиапланы, канальная стратегия |
| `imc_rag_marketing_gtm_plan` | План запуска на рынок | Этапы GTM из внутренних планов | Дорожные карты, брифы запуска |
| `imc_rag_campaign_retrospective` | Разбор кампании | Итоги и learnings кампании | Постмортемы, отчёты кампаний |
| `imc_rag_customer_diagnostic` | Профиль заказчика | Связка диагностики заказчика с проектом | Пройденная клиентская диагностика + vault |

## Сняты с кабинета (rerun через successor)

| type_key | Successor |
|----------|-----------|
| `imc_rag_stakeholder_decision_raci` | `imc_rag_cabinet_analysis` |
| `imc_rag_cx_service_ops_recovery` | `imc_rag_cx_journey` |
| `imc_rag_customer_diagnostic_answers` | `imc_rag_customer_diagnostic` |
| `imc_rag_rf_operating_context` | `imc_rag_trends_signals` |
| `imc_rag_brand_identity_compliance` | `imc_rag_positioning_messaging` |
| `imc_rag_content_comms_strategy` | `imc_rag_marketing_gtm_plan` |
| `imc_rag_deep_market_showcase` | `imc_rag_cabinet_analysis` |

Карта legacy MISO-типов: `api/services/imc/imc_legacy_type_successors.py`.

**AMKA:** эвристика auto-выбора `imc_type_key` и промпт master plan читают активный каталог из `generation_types`; при неоднозначности — пустое поле в режиме auto. Перед запуском ИМК на execute устаревший ключ из сохранённого плана автоматически подменяется на successor (`resolve_amka_imc_type_key_for_execution`, лог **`execute.imc.legacy_type_remapped`**).

См. также: [MARKETING-CABINET.md](MARKETING-CABINET.md), [IMC-MISO-ARCHITECTURE.md](IMC-MISO-ARCHITECTURE.md).
