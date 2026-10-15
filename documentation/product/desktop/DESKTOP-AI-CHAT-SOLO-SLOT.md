# Solo Ассистент — слот времени (сервер)

Соло-чаты (`settings.desktop_chat_mode` не `ensemble`) требуют **активной сессии с энергией** (слот времени на сервере): время хранится в PostgreSQL как UTC.

## Поля API (GET/PATCH/POST чата)


| Поле                       | Смысл                                            |
| -------------------------- | ------------------------------------------------ |
| `solo_slot_ends_at`        | ISO UTC или `null`                               |
| `solo_slot_started_at`     | Начало текущего блока (аудит), может быть `null` |
| `solo_slot_duration_hours` | Последняя купленная длительность (1 / 2 / 12)    |
| `solo_slot_active`         | `solo_slot_ends_at > now()` на сервере           |


## Эндпоинты

- `GET /api/v1/desktop/ai-chat/solo-slot-tariffs`  
Публичный справочник цен для UI: минимум за час, скидка на 12 ч, `by_hero` с суммами для 1 / 2 / 12 ч (согласовано с биллингом POST).
- `POST /api/v1/desktop/ai-chat/chats/{chat_id}/solo-slot`  
Тело: `{ "duration_hours": 1 \| 2 \| 12, "hero_id": "<optional>" }`  
Списание энергии и продление `solo_slot_ends_at` в одной транзакции.  
Ошибки: `402` + `insufficient_credits`, `400` для неверной длительности / группового чата.
- `POST /api/v1/desktop/ai-chat/chats/{chat_id}/solo-slot/release`  
Снять слот без возврата: обнуляет слот и очищает `system_prompt_override`, `llama_model`, `desktop_hero_id` в настройках.

## Стрим

`POST .../chats/{chat_id}/stream` для соло без активного слота: **403** с `detail`: `solo_slot_required` или `solo_slot_expired`. Групповой чат (ensemble) не проверяется.

В `shared/api/main.py` эти строки входят в `_PLAIN_403_FORBIDDEN_STRING_DETAILS`, чтобы глобальный обработчик **не** оборачивал ответ в `{ reason, action: login }` и SPA не уводила пользователя на Keycloak.

Групповой чат без установленного «Маркетингового кабинета»: **400** `marketing_cabinet_required_for_group_chat` (раньше был 403).

## Фронт

Таймер «осталось времени» в шапке соло-чата по `solo_slot_ends_at`; при истечении список чатов обновляется. Перехватчик `apiClient` не делает redirect на логин по 403 для путей `/desktop/ai-chat` и известных строк `detail`.

**Единый UX (создание соло-чата и покупка слота):** в модалке «Новый чат» для режима «Один герой» пользователь выбирает персону и длительность (1 / 2 / 12 ч) с отображением стоимости из `GET .../solo-slot-tariffs`, при необходимости видит баланс UGS (`GET .../ugs/billing/stats` → `available_credits`). Шаг «Далее» → экран подтверждения списания → `POST .../chats` и сразу `POST .../chats/{id}/solo-slot`. Отдельная модалка «Поделитесь энергией» для уже существующего чата использует тот же карточный выбор персоны (не `<select>`), два шага: выбор → подтверждение → `POST .../solo-slot`.

## Энергия

Логика в `api/services/desktop_chat/solo_slot.py`: базовая ставка **не ниже 1000 энергии за час**, множитель по герою (`SOLO_HERO_COMPETENCE_MULTIPLIER`), блоки 1 ч и 2 ч линейно, **12 ч** — скидка **20%** от суммы 12 почасовых ставок для выбранной персоны.

## Фон

Celery Beat (раз в 5 минут): задача `cleanup_expired_solo_slot_heroes` очищает героя/промпт у истёкших слотов (см. `api/tasks/desktop_ai_solo_slot_cleanup.py`).