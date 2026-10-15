# Qdrant: индексация и `indexed_vectors_count`

## Параметр `indexing_threshold`

При создании коллекций EliteEW задаёт **`OptimizersConfigDiff(indexing_threshold=...)`** через константу **`QDRANT_INDEXING_THRESHOLD`** в `shared/api/core/qdrant_defaults.py` (по умолчанию **5000**).

- У Qdrant типичный дефолт порога выше (~20000): до порога векторный индекс (HNSW) может не строиться, и в API коллекции **`indexed_vectors_count`** часто **0** при малом числе точек — это ожидаемо.
- С порогом **5000** индекс начинает строиться раньше на малых/средних коллекциях, что улучшает latency поиска при росте данных.

Коллекции, создаваемые с этим порогом (см. код):

- `marketing_project_rag_service`
- `desktop_chat/rag_service`
- `chat_memory_service`
- `chat_knowledge_base_service`
- `document_service` (`eliteew_documents`, unified semantic path S3)

После remediation S3 `eliteew_documents` стал базовой коллекцией для `SemanticSearchService` (Qdrant-first runtime, `UNIFIED_VECTOR_READ_BACKEND=qdrant`).

**Уже существующие** коллекции не меняются автоматически; смена порога влияет на **новые** `create_collection`. При необходимости обновить существующую коллекцию — операторский шаг в Qdrant (update collection / пересоздание) вне этого репозитория.

## Проверка

```text
GET /collections/{name}
```

Сценарий поиска после батча upsert — убедиться, что запросы выполняются с приемлемой задержкой.
