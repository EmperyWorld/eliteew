# Assistant — семантический поиск по содержимому (P2, аудит дорожной карты)

**Статус:** ориентир для будущего эпика (не связан с текущим keyword-решением через `ContentQueryService.list_content`).  
**Аудитория:** бэкенд / платформа / продукт.  
**См. также:** [STACK2-LLM-CONTRACT.md](../../platform/STACK2-LLM-CONTRACT.md), [DOCKER-STACKS-PROD-OVERVIEW.md](../../platform/DOCKER-STACKS-PROD-OVERVIEW.md), код `shared/api/services/unified_content/semantic_search_service.py`, пайплайн `processing_pipeline.py`, маркетинговые хуки RAG (`delete_marketing_rag_chunks_for_content` в `content_storage_service.py`).

---

## 1. Что уже есть в кодовой базе

| Компонент | Назначение | Связка с компаньоном сегодня |
|-----------|------------|-------------------------------|
| `SemanticSearchService` | Гибрид: вектор (Qdrant) + ключевые слова (Elasticsearch), RRF, фильтры, ACL по `user_id` | Используется в `semantic_catalog_augment.py`; backend переключается через `UNIFIED_VECTOR_READ_BACKEND` (default `qdrant`, legacy `chroma`). |
| `ContentQueryService.list_content` | `ILIKE` по имени/description | Используется DocEditor-augment и **catalog find** (`companion_catalog_find.py`). |
| Маркетинговый RAG chunks | Отдельные таблицы/удаление по проекту | Не смешивать с «личным каталогом» пользователя без явного решения продукта. |

---

## 2. Инфраструктурный аудит перед реализацией

1. **Compose / prod:** проверить, подняты ли Elasticsearch и Qdrant в целевом стеке; какие переменные (`LLAMA_*` / TEI / remote embed — см. `STACK2-LLM-CONTRACT.md`) задают embedding HTTP.  
2. **Идемпотентность индекса:** события unified content (create/update/delete/version) должны ставить задачи переиндексации; удаление контента обязано чистить вектора.  
3. **Раздел аренды:** ключ коллекции/namespace = `catalog_user_id` и/или org; не использовать маркетинговый индекс.  
4. **Форматы:** этап 1 — текстовые типы с детерминированным извлечением; PDF/DOCX — отдельные конвертеры с лимитами размера.  
5. **Компаньон:** новый модуль augment за feature-flag; ответ может оставаться markdown-приложением + опционально `open_app`; гибрид с keyword (`list_content`) для точных имён файлов снижает галлюцинации.

---

## 3. Рекомендуемые этапы внедрения

| Этап | Работы |
|------|--------|
| P2-A | Интеграционный smoke `SemanticSearchService.search()` из API с боевым/стейдж конфигом. |
| P2-B | Celery pipeline: unified_content → extract → chunk → embed → upsert; админские метрики и DLQ. |
| P2-C | Роут read-only под компаньон или внутренний вызов с теми же ACL, что у `list_content`. | **Реализовано (2026-05-20):** `semantic_catalog_augment.py` + hook в `catalog_find.py`; `EWA_COMPANION_SEMANTIC_CATALOG_ENABLED=1` для prod smoke. |
| P2-D | Rerank top-k через HTTP из stack2 контрактов; ограничение токенов в промпт компаньона. |

---

## 4. Осознанный non-goals

- Не переиспользовать маркетинговые RAG-таблицы для пользовательских файлов без миграции ACL.  
- Не отправлять в LLM содержимое файлов без квот / redaction там, где включён enterprise compliance.
