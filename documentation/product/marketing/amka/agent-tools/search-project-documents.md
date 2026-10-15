# Инструмент · `search_project_documents`

## Назначение

Семантический поиск по текстам материалов проекта, проиндексированным в **маркетинговом RAG** (Qdrant). Используется tool-agent’ом, когда счётчиков и карточек из других инструментов недостаточно для фактов/цитат.

## Исходный код

- Объявление схемы для Llama: **`MARKETING_AGENT_TOOLS_LLAMA`** — элемент с `"name": "search_project_documents"`.
- Исполнитель: **`_tool_search_project_documents`** в `shared/api/routers/marketing_cabinet/marketing_agent_tools.py`.
- Диспетчер: **`execute_marketing_agent_tools`** — ветка `name == "search_project_documents"`.

## Контракт параметров (OpenAI-style)

| Поле | Тип | Обязательность | Описание |
|------|-----|------------------|----------|
| `query` | string | **required** | Смысловой запрос (RU/EN), до **2000** символов на входе в сервис |

## Поведение

1. Если `query` короче 2 символов — возвращается строка-ошибка для модели: *«нужен непустой query»*.
2. Вызов **`search_marketing_project_rag_chunks`** (`api/services/marketing_project_rag_service.py`):
   - `limit=16`
   - `min_score=0.22`
   - `project_id`, `user_id` — из контекста вызова агента (проверка доступа к проекту до входа в агента).
3. Результат форматируется **`format_rag_chunks_for_prompt`** с потолком **`max_chars=8000`** для текста блока.
4. Если релевантных чанков нет — фиксированное сообщение про пустой индекс / отсутствие попаданий.

## Выход

- **Строка** markdown/текста для последующего синтеза UGS/LLM (не JSON).
- В **`execute_marketing_agent_tools`** в **`tool_traces`** попадает объект с `name`, `ok: true`, `result_preview` (до **1200** символов).

## Инварианты

- Только данные **текущего** `project_id`; межпроектный доступ невозможен через этот инструмент.
- Лимиты чанков и порог score согласованы с другими вызовами RAG в кабинете (см. [MARKETING-PROJECT-RAG.md](../../MARKETING-PROJECT-RAG.md)).

## Ошибки

- Исключения при БД/RAG ловятся в **`execute_marketing_agent_tools`**: в трассе `ok: false`, `error: str(exc)`; в объединённый текст попадает блок «Ошибка инструмента».
