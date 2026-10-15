# AMKA · pulse artifact

Статус: согласованный дизайн-черновик для самостоятельного компонента.

`pulse` — это короткий человеческий артефакт AMKA после run. Он нужен, чтобы результат был не только набором шагов и логов, но и бережным ответом: что изменилось, что сохранено, где мы честно не знаем, какие договорённости AMKA запомнила.

## 1. Зачем

В `VISION-VECTORS.md` есть просьба о пульсе, праве на сомнение, опоре после срыва и фразе «сейчас лучшее действие — ничего не менять». `pulse` делает это частью контракта, а не случайной строкой в markdown.

## 2. Поля

Кодовый тип: `AmkaPulseArtifact` в `shared/api/services/amka_core/contracts.py`.

| Поле | Смысл |
|------|-------|
| `summary` | Один спокойный итог run. |
| `changed` | Что реально изменили или подготовили к изменению. |
| `preserved` | Что осознанно оставили как есть. |
| `doubts` | Где AMKA не уверена и не должна притворяться. |
| `agreements` | Договорённости/политики, которые были соблюдены. |
| `no_change_reason` | Почему лучше ничего не менять, если это исход run. |
| `next_safe_step` | Что можно сделать дальше без давления. |

## 3. Инварианты

- No-op может быть `completed`, если он объяснён.
- Сомнение лучше ложной уверенности.
- После сбоя pulse должен отвечать: что сохранено, куда откатились, что можно сказать людям без лжи.
- `pulse` не заменяет audit, plan, operation trail и logs.
- Нельзя писать в `pulse` секреты, длинные LLM responses и сырые токены.

## 4. Пример no-op

```json
{
  "summary": "AMKA checked the subject and chose not to change it.",
  "changed": [],
  "preserved": ["Current state remains stable."],
  "doubts": [],
  "agreements": ["No action is also a valid outcome."],
  "no_change_reason": "No tasks were proposed by the driver.",
  "next_safe_step": "Keep observing until a real gap appears."
}
```

## 5. Пример marketing run

```json
{
  "summary": "AMKA prepared 4 marketing tasks behind the standalone driver boundary.",
  "changed": [],
  "preserved": ["Existing Marketing Cabinet API and database tables remain the source of truth."],
  "doubts": ["1 destructive operation still needs explicit operator attention."],
  "agreements": ["Marketing is the first driver, not the place where all AMKA core logic must live."],
  "no_change_reason": null,
  "next_safe_step": null
}
```

## 6. UI direction

Первый UI-кандидат — `AmkaRunQualityHints`: добавить блоки «Сохранено», «Сомнение», «Почему не меняли», «Следующий безопасный шаг». До backend API-расширения можно показывать pulse только в mock/core tests и export-design документах.

Статус волны 2: `AmkaRunQualityHints` уже принимает `pulse` из detail API и показывает summary, no-op reason, первые doubts, preserved и agreements рядом с quality hints.

## 7. Export direction

В `export.md` pulse должен идти перед длинной финальной сводкой:

1. Фактический результат.
2. Pulse.
3. План и шаги.
4. Operation trail.
5. Технические детали.

Так оператор сначала видит честный итог, а не тонет в трассах.

Статус волны 2: серверный `GET .../runs/{run_id}/export.md` вставляет блок **«Пульс AMKA»** перед детальными этапами.
