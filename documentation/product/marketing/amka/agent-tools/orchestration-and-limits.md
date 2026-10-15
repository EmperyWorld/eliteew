# AMKA · оркестрация marketing tool-agent и лимиты

## Цепочка вызовов

1. **`amka_phase_execute_misc.run_marketing_tool_agent_for_section`** (или общий **`run_marketing_tool_agent_for_project`** в `marketing_tool_agent_core.py`).
2. Идемпотентность: **`ensure_marketing_idempotency("tool_agent", …)`** для защиты от дублей.
3. **Llama** `/api/chat` с массивом **`tools=MARKETING_AGENT_TOOLS_LLAMA`**, **`tool_choice="required"`** — модель обязана вернуть tool_calls.
4. **`parse_llama_tool_calls(llama_chat_result)`** — нормализация `tool_calls[].function.name` / `arguments` (строка JSON или dict).
5. **`execute_marketing_agent_tools(db_pool, project_id, user_id, planned)`** — последовательное исполнение whitelist, сбор текста и **`tool_traces`**.

## Константы (`marketing_agent_tools.py`)

| Константа | Значение | Смысл |
|-----------|----------|--------|
| `MAX_AGENT_TOOL_RESULTS_CHARS` | 16_000 | Обрезка объединённого текста результатов перед передачей в синтез |
| `MAX_ROUTER_TOOL_CALLS` | 6 | Максимум вызовов, извлекаемых из ответа роутера |

## Формат `planned`

Список словарей: `{"name": str, "arguments": dict}`. Имена вне whitelist обрабатываются как «Неизвестный инструмент (игнор)», без raise.

## `tool_traces` (элемент)

- `name` — имя function.
- `ok: true` — успех; тогда **`result_preview`** (≤1200 символов).
- `ok: false` — исключение; поле **`error`**.

## Объединённый текст для синтеза

Блоки вида:

```markdown
### Результат инструмента `name` (#i)
<полный текст результата>
```

При ошибке — блок «### Ошибка инструмента …».

## Связь с UGS

После tool-calls **`marketing_tool_agent_core`** собирает промпт с результатами инструментов и вызывает контур **UGS** (маркетинговая генерация) для финального текста шага; пустой ответ UGS → HTTP/логическая ошибка уровня сервиса (см. код вокруг `UGS вернул пустой ответ`).

## Безопасность

- Все запросы к БД через **`project_id`** сеанса; нет произвольного SQL из аргументов модели.
- Инструменты только читающие (в текущем whitelist нет INSERT/UPDATE).

## См. также

- [README.md](README.md) — оглавление инструментов.
- `shared/api/services/marketing_cabinet/amka_phase_execute_misc.py` — встраивание в шаг AMKA.
