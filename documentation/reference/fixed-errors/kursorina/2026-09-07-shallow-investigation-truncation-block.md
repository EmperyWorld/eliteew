# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed error — shallow investigation, prompt truncation, missing analytical tool orchestration, and premature block.
# ---

# Курсорина: устранение обрезки промпта, блока на шаге 7 и поверхностного отчета

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-07` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **evidence** | Mission `a38252be` prematurely blocked at step 7; mission `75afec1b` thin 798-word answer; pytest 104 passed |

## Symptom

1. Длинные детальные бизнес-промпты пользователя обрезались до 800 символов, теряя ключевые требования к архитектуре, безопасности и формату опросника.
2. Миссия блокировалась на шаге 7 из-за отсутствия дальнейших действий после промаха во внутренней CRM, хотя оставался бюджет шагов.
3. Аналитические инструменты (`verify_compliance_standards`, `risk_matrix_assessment`, `generate_diagram`, `extract_table_data`, `generate_timeline_roadmap`) оставались пассивными fallback-ветками.
4. Итоговый отчет синтезировался с лимитом 2500 токенов и обрезкой улик до 600 символов, выдавая короткий поверхностный результат (~798 слов).

## Failure layers

1. **`plan.py (goal_intent_text)`**: жесткое ограничение `max_chars=800` отрезало до 80% контекста сложного ТЗ.
2. **`decide.py (_finish_or_incomplete)`**: при невозможности завершить расследование сразу переходил к `block`, не проверяя оставшийся бюджет шагов и наличие аналитических инструментов/веб-поиска.
3. **`decide.py (guard_llm_action)`**: после пустого промаха `search_companies` не перенаправлял расследование на внешний веб-профиль компании.
4. **`synthesize.py`**: лимиты `num_predict: 2500` и `extract[:600]` душили полноту синтеза.

## Root cause

Фрагментарная координация инструментов расследования: плановик терял хвост цели из-за раннего среза, охранник цикла сваливался в блок при первом затруднении, а синтез был ограничен низкими лимитами токенов и размера улик.

## What we did

- `plan.py`: `goal_intent_text` расширен до 8000 символов; расширены триггеры фасет (`companies`, `architecture`, `standards`, `risks`, `roadmap`); добавлены целевые запросы для компаний и стандартов.
- `tools.py`: отфильтрованы ложные сообщения об ошибках KBSEW; улучшен поиск по документации платформы.
- `decide.py`: активно оркеструет `verify_compliance_standards`, `risk_matrix_assessment`, `generate_diagram`, `extract_table_data`; при промахе CRM переключается на веб-поиск деятельности/продуктов компании; `_finish_or_incomplete` не блокирует при наличии шагов в бюджете.
- `synthesize.py`: поднят лимит генерации до 8192 токенов, длина экстрактов ключевых улик увеличена до 3500 символов, лимит отчета поднят до 48k символов, внедрен фундаментальный системный промпт для глубоких бизнес-брифов.
- `tests`: добавлены регрессионные тесты (104 passed).

## Recommendations

- Не занижать длину цели в `goal_intent_text`: сложные enterprise-цели требуют полного контекста.
- Сохранять баланс: внутренние пробы → аналитические инструменты → целевой веб.

## Verification

```text
pytest tests/test_kursorina_worker.py -q
# → 104 passed
```
