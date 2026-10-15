# Модуль · `amka_llm_runtime.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_llm_runtime.py`

## Назначение

Прямые HTTP-вызовы к **stack2 text LLM** (`LLAMA_URL`, обычно `stack2-llama-chat:8080`) для AMKA **без** зависимости от `AmkaService` или UGS: structured JSON (plan, audit, autofill) и произвольный markdown-текст (final assessment, prose).

Все вызовы идут через **`httpx_compat_generate_json`** → **`api/utils/llm_openai_compat_http.py`**, с gate **`stack2_text_llm_slot`** (зеркало **`LLAMA_CHAT_PARALLEL`**).

## Конфигурация

| Источник | Ключ | Обязательность |
|----------|------|----------------|
| `unified_settings` | **`llama_url`** | да |
| `unified_settings` | **`llama_model_marketing`** → fallback **`marketing_cabinet_router_model`** | да |

Stack2 env (не в этом модуле, но влияют на поведение): **`LLAMA_CHAT_PARALLEL`**, опционально **`STACK2_LLM_DEBUG_SAVE_DIR`**.

## Функции

| Функция | `json_format` | HTTP path (stack2 llama-server) | Таймаут read / connect |
|---------|---------------|----------------------------------|-------------------------|
| **`amka_llm_json_with_parse_meta`** | `True` | `/v1/chat/completions` или native `/api/chat` с `format=json` | 300 s / 10 s |
| **`amka_llm_json`** | `True` | то же | — |
| **`amka_llm_json_raw`** | `True` | то же; сырой JSON-текст для document-autofill / project autofill | 360 s / 10 s |
| **`amka_llm_text`** | `False` | **`/v1/chat/completions`** (не legacy `/v1/completions` — health-ok shortcut) | 360 s / 10 s |

Параметры генерации: `temperature`, `num_predict` ≥ max(512, `max_tokens`).

### Маршрутизация (важно для операторов)

1. Probe **`GET /health` ok** → stack0 **не** шлёт AMKA prose в **`/v1/completions`** (избегает HTTP 500 `Failed to parse input at pos 0` на длинном markdown).
2. **`json_format=True`** → structured JSON через chat path + native `format=json` где применимо.
3. Парсинг dict — **`amka_parse_model_json_detail`** (`amka_llm_json*`); autofill raw string — downstream **`extract_json_payload`** в mutation service.

## Ошибки

| Условие | Исключение / результат |
|---------|------------------------|
| Нет base URL или model | **`RuntimeError("LLM is not configured for AMKA")`** |
| Пустой ответ в **`amka_llm_text`** | **`RuntimeError("AMKA model returned empty response")`** |
| Пустой ответ в **`amka_llm_json_raw`** | **`RuntimeError("AMKA model returned empty structured JSON response")`** |
| Пустой / невалидный JSON в **`amka_llm_json_with_parse_meta`** | `{}` + meta reason (`empty_model_response`, parse reason) — **не** raise |

## Зависимости

- **`httpx_compat_generate_json`** — см. **`documentation/platform/docker-re_doc/STACK0-LLM-OVERVIEW.md`** §7.
- **`amka_parse_model_json_detail`** — `amka_llm_json.py`.

## Тесты

- **`shared/api/tests/test_amka_llm_json_mode.py`**
- **`shared/api/tests/test_llm_chat_compat.py`** (`test_httpx_compat_generate_json_plain_text_amka_skips_completions_on_health_ok`)
- **`shared/api/tests/test_stack2_text_llm_slot.py`**

## Миграции

**Нет.** Контракт только в коде HTTP-слоя и AMKA runtime.
