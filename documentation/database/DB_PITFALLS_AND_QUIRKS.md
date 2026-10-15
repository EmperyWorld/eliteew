# Приколы и подводные камни в БД (`ai_services`)

**Статус:** living (Stack1 / `stack1-postgres` на prod-core).  
**Scope:** только app DB `ai_services`. EWA PG и Keycloak PG — отдельные инстансы; их quirks см. [`EWA-POSTGRES-RUNBOOK`](../platform/docker-re_doc/EWA-POSTGRES-RUNBOOK.md) и [`KEYCLOAK-ELITEEW`](../platform/docker-re_doc/KEYCLOAK-ELITEEW.md).  
**Обновление реестра:** 2026-07-18 (host/contour alignment); содержательные пункты ниже сохраняют смысл аудита 2026-03.

**Инвариант:** не подключать скрипты app-миграций к `stack-ewa-postgres` / `stack6-keycloak-postgres` и наоборот. DEWA/EWGen DB — не living.

---

## 1. Разнобой типов `user_id` (частично исправлено)

Унифицированы на **uuid** (миграция `unify_user_id_to_uuid_phase1.sql`): `unified_content`, `content_audit_log`, `content_tags`, `content_upload_sessions`. Представления `user_statistics`, `user_dashboard_stats_mv` и связанные пересозданы с join по uuid.

**Остаются varchar/text:** `emperyworld_chat_folders`, `emperyworld_chats`, `companies`, `elite_documents`, а также таблицы competitor_*, jtbd_*, swot_*, scraping_schedules, offer_ab_tests.

**Подводный камень:** при джойнах между таблицами с разными типами нужно явно кастовать или сравнивать в коде через `str(...)`.

**Рекомендация:** при добавлении новых таблиц/полей придерживаться `uuid` для `user_id`.

---

## 2. SECURITY DEFINER и `search_path` ✅ исправлено

У всех функций с `SECURITY DEFINER` задан `search_path = public` (миграция **api/migrations/secure_definer_search_path.sql**), чтобы исключить подмену схемы.

| Функция | search_path |
|--------|--------------|
| `update_chat_session_stats` | public |
| `audit_trigger_func` | public |
| `decrypt_text` | public |
| `encrypt_text` | public |
| `encrypt_users_pii_trigger` | public |
| `get_encryption_key` | public |

---

## 3. PII: `encryption.pii_key` на соединении

Триггер **encrypt_users_pii** на таблице **users** при INSERT/UPDATE вызывает `get_encryption_key()`. Та читает `current_setting('encryption.pii_key', true)`. Если параметр не задан, функция **кидает исключение**. То же для `decrypt_text` / представлений **users_decrypted** (и связанных masked views).

### Канон runtime (stack0 API)

| Правило | Норма |
|---------|--------|
| Scope | На **pooled** соединении задавать **`SET SESSION encryption.pii_key`** (переживает `COMMIT` внутри сессии приложения). Исторические тексты про `SET LOCAL` относятся к одноразовым psql/миграциям в одной транзакции — не копировать LOCAL в `AsyncSession` open path. |
| Когда | До любого SQL, который читает/пишет encrypted columns `users` или view с decrypt. |
| Как (целевой) | Один раз на физический коннект: SQLAlchemy **pool connect** (`api.core.pii_session.register_sqlalchemy_encryption_pii_key`) и asyncpg `init=` (`_asyncpg_init`). Не полагаться на best-effort try/except вокруг SET в `get_postgres_session`. |
| Pool timeout | Исчерпание QueuePool / timeout checkout — **fail-closed** для запроса (нет yield сессии без ключа, нет «проглотили ERR и поехали»). |
| Soft-skip | **Запрещён:** `except` → `logger.error("Failed to set encryption.pii_key…")` → всё равно `yield session`. |

Код (Wave 2): connect listener ставит `SET SESSION` на каждый physical SQLAlchemy connection; `get_postgres_session` / chat wrapper **не** soft-skip'ают SET. Helper `ensure_encryption_pii_key` — для явных write-путей после commit/switch; при включённом encryption и сбое SET — `EncryptionPiiKeyError` (fail-closed).

### Ручные скрипты / миграции / psql

Перед INSERT/UPDATE `users` или SELECT из `users_decrypted` в **той же** сессии:

```sql
SET SESSION encryption.pii_key = '<ENCRYPTION_MASTER_KEY>';
-- или в однотранзакционном скрипте допустим SET LOCAL …
```

### Связь с нагрузкой Content Manager

Bearer `GET /api/v1/content/{id}/download|thumbnail` после Wave 1 используют short-session auth (SQLAlchemy закрывается до Seaweed stream). Остаточный QueuePool/pii soft-skip закрыт Wave 2 (connect + fail-closed). Process plan: `documentation/plans/platform/API-AUTH-SESSION-POOL-AND-CONTENT-BLOB-PERF-PLAN.md` *[operator-local process plan; gitignored — not living canon]*.

---

## 4. Материализованные представления (MV)

В схеме есть 5 MV:

- **user_dashboard_stats_mv** — дашборд; REFRESH из кода **не вызывается** (кэш дашборда — Redis). Данные в MV могут быть устаревшими.
- **mv_company_analyses_dashboard**, **mv_popular_analyses**, **mv_company_summary**, **mv_company_analyses_summary** — BI; обновляются через `refresh_all_bi_views()` (вызов из benchmark_queries / BI).

**Подводный камень:** если что‑то будет читать статистику напрямую из `user_dashboard_stats_mv` (миграции, отчёты, админка), нужно либо периодически делать `REFRESH MATERIALIZED VIEW CONCURRENTLY user_dashboard_stats_mv`, либо явно считать такие данные устаревшими.

---

## 5. Представления, зависящие от функций

Некоторые представления вызывают функции БД. При удалении/смене сигнатуры функции представление сломается:

- **user_statistics** — использует **get_user_storage_used(u.id)**.
- **users_masked_by_role** — использует **mask_email(...)** (и, возможно, другие функции маскирования).

**Подводный камень:** перед удалением или изменением `get_user_storage_used`, `mask_email` и т.п. нужно проверить `pg_depend` / представления и при необходимости править view или не трогать функцию.

---

## 6. Триггеры на `users`

На таблице **users** висят, в частности:

- **audit_users** → `audit_trigger_func`
- **encrypt_users_pii** → `encrypt_users_pii_trigger` (требует `encryption.pii_key`, см. выше)
- **trigger_users_updated_at** → `update_updated_at_column`

При массовых UPDATE/INSERT по `users` (миграции, импорты) все они выполняются; при отключении API или запуске скриптов без `pii_key` PII-триггер будет падать.

---

## 7. FK без индекса на дочерней колонке ✅ исправлено

Для перечисленных ниже таблиц добавлены индексы по колонкам FK (миграция **api/migrations/add_fk_indexes.sql**), чтобы не было полного скана дочерней таблицы при DELETE/UPDATE родителя и при джойнах.

Охвачены таблицы: `ai_generations`, `user_avatar_history`, `project_members`, `job_stories`, `value_propositions`, `swot_ai_sessions`, `competitor_alerts`, `workflow_*`, `telegram_*`, `research_*`, `jtbd_*`, `porter_analyses`, `competitive_analyses`, `content_comparisons`, `swot_factor`, `system_settings`, `presentation_*`, `user_installed_apps`, `user_credit_transactions`, `alerts`, `unified_content_comment_threads`, `unified_content_comments`, `ewrp_jobs`, `friend_requests`, `friend_request_history`, `gaf_chats`, `gaf_message_keys` и др.

**Для новых FK:** при добавлении внешнего ключа на дочернюю таблицу по возможности сразу создавать индекс по колонке FK (см. чеклист п. 6).

---

## 8. RLS и переменные сессии

На многих таблицах включён **RLS** (Row Level Security): `audit_logs`, `companies`, `documents`, `dashboard_widgets`, `projects`, `tags` и т.д.

На **users** политики завязаны на сессионные переменные:

- `app.current_user_id` — кто «текущий пользователь»;
- `app.current_role` — роль (например `admin`, `ai_agent` для полного доступа).

Если подключение к БД (скрипт, миграция, воркер) **не выставляет** эти переменные, запросы к таким таблицам могут вернуть пустой набор или не дать обновить строку.

**Подводный камень:** любой код или скрипт, который пишет/читает таблицы с RLS не через стандартный API (где выставляются `app.current_user_id` и т.п.), должен в сессии задать нужные переменные или подключаться под суперпользователем/ролью с BYPASSRLS.

---

## 9. Три представления по users

- **users_masked** — маскирование PII по роли.
- **users_masked_by_role** — то же с учётом роли (использует **mask_email**).
- **users_decrypted** — расшифровка PII (вызывает **decrypt_text** → нужен `encryption.pii_key` в сессии).

Разница в назначении и в том, что чтение `users_decrypted` без `pii_key` падает с ошибкой (см. §3).

---

## 10. Что в порядке

- **Таблицы без первичного ключа:** в `public` не найдено.
- **NOT VALID ограничения:** не найдено (все проверенные ограничения валидированы).
- **chat_sessions:** есть PRIMARY KEY по `id`, использование в `update_chat_session_stats` корректно.
- **Ключ PII в API:** перед подстановкой в SQL экранируется (`replace("'", "''")`), риск инъекции через ключ снижен.

---

## Краткий чеклист для новых изменений

1. **user_id:** при джойнах между таблицами проверять типы (uuid vs varchar/text) и при необходимости кастовать.
2. **SECURITY DEFINER:** новые функции с `SECURITY DEFINER` сразу задавать `ALTER FUNCTION ... SET search_path = public` (или в теле функции).
3. **PII:** скрипты/миграции, трогающие `users` или читающие `users_decrypted` — в той же сессии выполнять `SET LOCAL encryption.pii_key = '...'`. См. `shared/api/migrations/README.md`.
4. **Удаление функций:** перед удалением проверять представления и триггеры (`pg_depend`, поиск по коду).
5. **MV:** явно решать, кто и как часто делает REFRESH; не считать MV «живыми» данными без обновления.
6. **FK:** при добавлении новых внешних ключей на «дочернюю» таблицу сразу вешать индекс по колонке FK (миграция add_fk_indexes.sql уже закрыла существующие пробелы).
7. **RLS:** при доступе к таблицам с RLS не через стандартный API — выставлять в сессии `app.current_user_id` / `app.current_role` или подключаться с ролью, у которой BYPASSRLS.
8. **Контур:** `psql` для app — `podman exec stack1-postgres … -d ai_services` (на prod-core через `ssh 192.168.1.111`). EWA — `stack-ewa-postgres` / БД `ewa`. Keycloak — `stack6-keycloak-postgres` / БД `keycloak`.
