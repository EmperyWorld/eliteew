# Триггеры `ai_services` — keep-list + historical DROP waves

**Статус:** living **keep-list** (§1) + **historical** запись волн DROP (уже применены).  
**Контур:** `stack1-postgres` / `ai_services` на prod-core. EWA/Keycloak PG — вне scope.  
**Legacy BI Airflow:** таблицы `bi_airflow_*` могут оставаться; контур Airflow снят (см. topology Off).

**Не переигрывать** SQL из `shared/api/migrations/drop_triggers_*.sql` / `drop_functions_*.sql` без явного ТЗ оператора — волны ниже уже отражены как applied.

---

## 1. ОСТАВИТЬ (системно нужны — living)

Эти триггеры критичны для безопасности, целостности или кода приложения (версии, счётчики, поиск).

| № | Таблица | Триггер | Зачем оставить |
|---|---------|---------|----------------|
| 1 | **users** | **encrypt_users_pii** | Шифрование PII (email → email_encrypted). Без него — нет шифрования. |
| 2 | users | trigger_users_updated_at | updated_at при UPDATE |
| 3 | users | audit_users | Аудит изменений пользователей (audit_logs) |
| 4 | **user_credit_transactions** | **trigger_prevent_transaction_delete** | Запрет удаления транзакций (целостность) |
| 5 | **user_credit_transactions** | **trigger_prevent_transaction_update** | Запрет изменения транзакций |
| 6 | **unified_content** | **trigger_unified_content_versioning** | Заполнение content_versions при UPDATE (используется API) |
| 7 | unified_content | trigger_update_unified_content_updated_at | updated_at |
| 8 | **unified_content** | **unified_content_search_update** | Полнотекстовый поиск (tsvector) |
| 9 | **ultimate_documents** | **trigger_ultimate_doc_versioning** | Заполнение ultimate_document_versions при UPDATE (Ultimate Doc Editor) |
| 10 | ultimate_documents | trigger_ultimate_docs_updated_at | updated_at |
| 11 | **user_sessions** | **trigger_user_session_login** | Обновление last_login_at, login_count в users при INSERT сессии |
| 12 | **chat_messages** | trigger_chat_message_stats_delete | Пересчёт статистики сессии при DELETE сообщения |
| 13 | chat_messages | trigger_chat_message_stats_insert | Пересчёт при INSERT |
| 14 | chat_messages | trigger_chat_message_stats_update | Пересчёт при UPDATE |
| 15 | **documents** | **trigger_document_upload_security** | virus_scan_status = 'pending', запись в system_metrics при загрузке |
| 16 | **system_metrics** | **system_metrics_set_id_trigger** | Установка id при INSERT |

Плюс **один** триггер `updated_at` на таблицах, которые активно трогает API (desktop_*, chat_sessions, companies, projects, presentations, generation_*, …), если он ещё не снят финальной волной.

Проверка фактического набора на prod:

```bash
ssh 192.168.1.111 'podman exec stack1-postgres psql -U ai_user -d ai_services -c "
SELECT event_object_table, trigger_name
FROM information_schema.triggers
WHERE trigger_schema = '\''public'\''
ORDER BY 1, 2;"'
```

---

## 2. Historical — волны DROP (уже применены)

Живой playbook «удалить кандидатов» **снят** из канона (2026-07-18): повторный DROP опасен. Источник truth — SQL в репозитории:

| Волна | Файл | Смысл |
|-------|------|--------|
| 1 | `shared/api/migrations/drop_triggers_first_wave.sql` | дубликат updated_at, NOTIFY refresh, audit≠users, logging, AI/alert, часть domain |
| 2 | `…/drop_triggers_second_wave.sql` | дубликаты updated_at на competitors/financial/swot |
| 3 | `…/drop_functions_third_wave.sql` | сиротские функции после волн 1–2 |
| 4 | `…/drop_triggers_fourth_wave.sql` + `drop_functions_fourth_wave.sql` | updated_at на доменных таблицах + orphans |
| final | `…/drop_triggers_final_wave.sql` + `drop_functions_final_wave.sql` | оставить только системный keep-list §1 |

Диагностика сирот: `shared/api/migrations/list_orphan_trigger_functions.sql`.

**Не** генерировать новый массовый DROP из этого документа без отдельного audit + backup + явного approval оператора.
