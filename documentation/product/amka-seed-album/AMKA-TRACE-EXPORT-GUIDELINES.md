# AMKA trace and export payloads — field guidelines

Статус: операторская памятка после волн 15–17 (trace serialization, export.md).  
Связано: `shared/api/services/amka_core/trace_serialization.py`, `marketing_cabinet` export, [RFC-001 §10](RFC-001-amka-driver-contract.md).

## Цель

События **`AmkaTraceEvent`** и производные структуры в **core-alignment** / **export** должны помогать отладке и аудиту **без** превращения экспорта в дамп PII или внутренних секретов. Серверная нормализация: `redact_amka_trace_payload` в `trace_serialization.py` (вызывается из `serialize_amka_trace_events`). Эвристика по подстрокам имён ключей (`_SENSITIVE_KEY_HINTS`) дополняется узко (PII, prompt/completion и т.д.) по мере полевых кейсов; регрессия в `shared/api/tests/test_amka_trace_serialization.py`.

## Принципы

1. **Идентификаторы, не содержимое**  
   В trace предпочитать: стадии, ключи задач, хэши/короткие префиксы текстов, длины буферов, имена инструментов.  
   Не класть: полные промпты пользователя, необрезанные ответы LLM, полные тексты писем/контрактов, токены, пароли, приватные URL.

2. **Секции с пометкой объёма**  
   Если нужен фрагмент для расследования — ограничить **жёстким лимитом символов** (как в существующих truncates для аудита) и явно помечать `truncated: true` в sibling payload, а не только в trace.

3. **Согласованность с маркетинговым export**  
   Блок «трасса» в `export.md` наследует те же правила redaction, что и остальной отчёт: если поле в деталях шага уже санитизировано, trace не должен «обходить» санитизацию дублирующим полным текстом. Серверный `build_amka_run_export_markdown` перед JSON-блоком **core_alignment** прогоняет `traces[].payload` через `redact_amka_trace_payload` (паритет с API).

4. **Драйвер-специфика**  
   - **Marketing cabinet**: опираться на существующие step `report_payload` / audit метрики; не дублировать большие markdown тела в trace.  
   - **UGS / read-only**: держать snapshot на уровне счётчиков маршрутов и флагов здоровья, не список всех моделей провайдера с лицензионными метаданными.

5. **Эволюция по полевым кейсам**  
   После прогонов фиксировать в worklog: какие события не хватило, **добавлять** узкие поля (класс ошибки, retry count), а не «сырой» стек или полный HTTP ответ апстрима.

## Анти-паттерны

- Передавать в `details` trace **полный** `context_payload` или snapshot проекта.
- Логировать **refresh_token** / **Keycloak** артефакты в AMKA trace (принадлежат auth-слою, не домену AMKA).
- Раздувать JSON alignment так, что клиенты начинают получать мегабайтные ответы — для глубокой отладки использовать серверные логи с структурой `[STEP]`, см. `logging-standards.mdc`.
