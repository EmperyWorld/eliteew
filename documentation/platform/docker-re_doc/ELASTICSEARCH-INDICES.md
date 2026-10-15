# Elasticsearch: индексы и единая точка обновления

## Инвентаризация имён индексов

Канонические имена: **`shared/api/core/elasticsearch_indices.py`** (`INDEX_*`, `SERVICE_TO_INDEX`).

Типичные индексы:

| Индекс | Назначение |
|--------|------------|
| `eliteew_documents` | Общий поиск документов (редактор и т.п.) |
| `emperyworld_documents` | Document ingest pipeline (`ElasticsearchDocumentService`) |
| `business_documents`, `business_analyses`, `business_sessions` | BI |
| `unified_content` | Файловый менеджер, поиск по unified content |
| `eliteew_logs`, `eliteew_chats`, `eliteew_metrics` | Конфигурационный слой / index manager |

## Алиас `emperyworld_documents` (миграция с дискового лимита)

Пока физический индекс может называться **`brotherhood_documents`**, приложение обращается к каноническому имени **`emperyworld_documents`**. Если из‑за **disk watermark** кластер не выделяет шард под новый индекс, вместо `_reindex` в пустой индекс можно добавить **алиас** (write index) на существующий индекс:

```bash
# учётные данные — как в docker/env_file/.env.stack1 (ELASTICSEARCH_USER / ELASTICSEARCH_PASSWORD)
curl -sS -u "$ELASTICSEARCH_USER:$ELASTICSEARCH_PASSWORD" -X POST "http://<es-host>:9200/_aliases" \
  -H "Content-Type: application/json" \
  -d '{"actions":[{"add":{"index":"brotherhood_documents","alias":"emperyworld_documents","is_write_index":true}}]}'
```

После освобождения места при желании выполните полный `_reindex` в отдельный индекс и переключите алиас.

## Операторский чеклист (пустые индексы)

На кластере (Management API или `curl` к `stack1-elasticsearch:9200`):

```bash
curl -sS -u "$ELASTICSEARCH_USER:$ELASTICSEARCH_PASSWORD" \
  "http://127.0.0.1:<port>/_cat/indices?v&s=index"
```

Сопоставить **`docs.count`** и **`store.size`** с фичами, которые реально пишут в ES. Пустой индекс:

- **оставить** как зарезервированный (задокументировать здесь или в аудите), или
- **удалить** после бэкапа и подтверждения, что ни один сервис его не ожидает.

## Единая точка index/delete для `unified_content`

Пути обновления контента должны проходить через **`ContentStorageService`** (`shared/api/services/unified_content/content_storage_service.py`):

- после создания/обновления вызывается **`search_service.index_content`** (неблокирующе);
- при удалении — снятие из индекса в том же слое (см. методы рядом с `Remove from Elasticsearch` в том же файле).

Поиск по unified content: **`unified_content/content_search_service`** и константа **`INDEX_UNIFIED_CONTENT`**.

Прямые вызовы ES к `unified_content` в обход storage — избегать; новые фичи подключать через `ContentSearchService` / индексы из `elasticsearch_indices.py`.
