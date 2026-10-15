# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed error record — Курсорина tool ecosystem expansion (KBSEW, projects, diagrams, tables, file exports).
# ---

# Курсорина: Расширение инструментария исследователя

| Field | Value |
|---|---|
| **status** | `fixed` |
| **date** | `2026-09-05` |
| **product_id** | `kursorina` |
| **severity** | `medium` |
| **symptom** | Ограниченность исследовательского арсенала агента: отсутствие доступа к корпоративной базе знаний (KBSEW), внутренним проектам организации, невозможность строить архитектурные схемы/диаграммы (Mermaid) и выгружать файлы данных (.csv, .json, .svg). |
| **root_cause** | Воркер Курсорины поддерживал только веб-поиск, чтение библиотеки, запуск скриптов Python и выгрузку итогового markdown-отчета. Корпоративный RAG и схемы не входили в перечень инструментов принятия решений. |

## Failure layers

- **Tool registry (`tools.py`):** отсутствовали обработчики для семантического поиска в KBSEW, запросов к проектам компании, генерации диаграмм Mermaid, табличного парсинга со статистикой и структурированного экспорта файлов.
- **Decision loop (`decide.py`, `plan.py`):** эвристики и промпт планировщика не распознавали потребности в схемах, стандартах ГОСТ, регламентах и роадмапах проектов.
- **Evidence ledger & UI (`models.py`, `KursorinaFindingsView.tsx`):** типы находок `kbsew`, `project`, `diagram`, `table` не мапились в пользовательский интерфейс.

## Cause-layer fix

1. **Новые инструменты в `tools.py`:**
   - `knowledge_base_search`: вызов `run_knowledge_base_search` с авто-выбором бочки KBSEW.
   - `search_projects`: параметризованный SQL-поиск по проектам и компаниям в PostgreSQL.
   - `generate_diagram`: валидация и форматирование Mermaid-диаграмм (`flowchart`, `sequenceDiagram`, `mindmap` и т.д.) с записью на диск и в Библиотеку.
   - `extract_table_data`: разбор Markdown/CSV таблиц с авто-подсчетом сумм и средних по числовым столбцам.
   - `export_file`: экспорт файлов (.csv, .json, .svg, .md, .txt) в Content Manager и локальную файловую систему.
2. **Маршрутизация в `decide.py` & `plan.py`:** добавлены фасеты `architecture` и `standards`, распознавание ключевых слов, вызовы в `heuristic_decide` и поддержка в промпте LLM.
3. **Синтез отчета в `synthesize.py`:** в промпт добавлены правила интеграции Mermaid-блоков, сводных матриц и корпоративного контекста.
4. **Интерфейс в `KursorinaFindingsView.tsx` & `KursorinaComposer.tsx`:** добавлены бейджи, иконки типов находок и готовые шаблоны для схем архитектуры и стандартов KBSEW.

## Verification

- `PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/test_kursorina_worker.py -q` — 61/61 passed.
- `uv run ruff check tests/test_kursorina_worker.py services/kursorina/` — clean.
- `pnpm exec biome check src/pages/Desktop/apps/kursorina/` — clean.
