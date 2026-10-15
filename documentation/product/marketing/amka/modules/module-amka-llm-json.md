# Модуль · `amka_llm_json.py`

## Расположение

`shared/api/services/marketing_cabinet/amka_llm_json.py`

## Назначение

**Устойчивый разбор JSON** из ответов маркетинговой LLM (маркдаун-ограждения, мусор вокруг объектов).

## Функции

| Функция | Назначение |
|---------|------------|
| `amka_first_balanced_json_segment(text)` | Найти первый сбалансированный `{…}` или `[…]` с учётом строк и escape |
| `amka_parse_model_json_detail(raw_text)` | Вернуть `(dict, reason)` — `reason` вроде `ok`, `empty_input`, `extract_non_object`, `json_decode_error`, `no_json_segment` |
| `amka_parse_model_json_dict(raw_text)` | Обёртка: только dict или `{}` |

## Зависимости

- **`extract_json_payload`** из `api/routers/marketing_cabinet/common.py` — снимает fenced blocks, лёгкая JSONC-нормализация.

## Связь

Используется **`amka_llm_runtime`** и любыми вызовами, где ответ модели должен стать **dict** (аудит структурированный, план, autofill JSON).
