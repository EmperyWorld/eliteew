# Реестр таблиц — living Postgres (prod-core)

**Status:** living registry (not a full schema dump). Hub: [README.md](README.md). App code/migrations under `shared/api/` (Wave 4 pack mid — not the retired EliteEW/api mid-alias).

Краткий справочник по **живым** контурам. Источник схемы:

- App: `shared/api/migrations/` (+ `applied/`) — [`README`](../../shared/api/migrations/README.md)
- EWA: `shared/api/ewa_platform/migrations/applied/` — хвост **035** (`chat_condense_min_messages`); [`EWA-POSTGRES-RUNBOOK`](../platform/docker-re_doc/EWA-POSTGRES-RUNBOOK.md)
- Keycloak: схема продукта Keycloak (не app-миграции) — [`KEYCLOAK-ELITEEW`](../platform/docker-re_doc/KEYCLOAK-ELITEEW.md)

Хост runtime: **prod-core** `192.168.1.111`. Отдельные БД DEWA/EWGen **не** living.

---

## 1. `ai_services` — `stack1-postgres`

DSN приложения: **`DATABASE_URL`**. На том же инстансе могут жить sidecar DB (например Paperless) — см. [`STACK1-POSTGRES-TUNING`](../platform/docker-re_doc/STACK1-POSTGRES-TUNING.md).

### Критичные и часто используемые

| Таблица | Назначение | Модель / модуль | Примечание |
|---------|------------|-----------------|------------|
| users | Пользователи, учётные записи, PII (email_encrypted) | database_models.User | Триггер `encrypt_users_pii` |
| user_sessions | JWT-сессии, токены | database_models.UserSession | |
| chat_sessions | Сессии чата с AI | database_models.ChatSession | |
| chat_messages | Сообщения чата | database_models.ChatMessage | |
| chat_session_documents | Документы, привязанные к сессии чата | database_models.ChatSessionDocument | |
| unified_content | Единый контент (файлы, папки) | database_models.UnifiedContent | blobs → SeaweedFS / BYTEA; `storage_integrity_status` (`ok`/`NULL`, `broken_quarantined`, `blob_missing`); `storage_broken_at`, `storage_broken_reason`, `storage_last_checked_at`; WebP paths in metadata |
| content_shares | Явный share unified_content | ShareService | `expires_at` опционально |
| content_user_library_removals | Скрытие чужого контента только у получателя | ShareService.leave_shared_content | PK `(user_id, content_id)` |
| content_versions | Версии контента | database_models.ContentVersion | |
| unified_content_comment_threads | Ветки комментариев | database_models.UnifiedContentCommentThread | |
| unified_content_comments | Комментарии к контенту | database_models.UnifiedContentComment | |
| documents | Документы (загрузки, метаданные) | database_models.Document | |
| ultimate_documents | Ultimate Doc Editor | ultimate_doc_editor.UltimateDocument | |
| ultimate_document_versions | Версии редактора | ultimate_doc_editor.UltimateDocumentVersion | |
| desktop_configs | Конфиг рабочего стола | desktop.DesktopConfig | |
| desktop_items | Элементы рабочего стола | desktop.DesktopItem | |
| app_access_groups | Группы доступа к приложениям | desktop.AppAccessGroup | |
| desktop_app_catalog | Каталог приложений | desktop.DesktopAppCatalog | `20260913_01` first rewrite (in `schema_migrations`); Mode 1 VALUES follow-up `applied/20260915_01_desktop_app_catalog_descriptions_mode1.sql` |
| desktop_app_catalog_access_groups | M2M каталог ↔ группы | desktop + migrations | entitlement / storefront |
| desktop_calendar_events | Личные события CalendarApp | desktop.DesktopCalendarEvent | `20260819_01`; не план Ассистента |
| kursorina_missions | Курсорина: mission goal/status + JSON steps/evidence | `services.kursorina.store` | `20260905_01_kursorina_missions.sql`; principal-scoped |
| user_installed_apps | Установленные приложения | desktop.UserInstalledApp | |
| user_desktop_app_entitlements | Entitlements desktop-приложений | desktop.UserDesktopAppEntitlement | |
| api_logs | Логи запросов API | database_models.APILog | |
| ewrp_jobs | Задачи EWRP (презентации) | ewrp.EwrpJob | |
| gaf_chats / gaf_messages | 1:1 чаты (GAF) | — | `gaf_chat_tables.sql` |
| gaf_message_keys | E2E session key envelopes | — | `gaf_chat_tables.sql` / keys DDL |
| gaf_user_public_keys | Wire RSA public keys (`rsa_oaep_sha256`) | — | `applied/20260903_01_gaf_user_public_keys.sql` (runner `20260903_01`) |
| friendships, friend_requests | Друзья / заявки | — | Social Hub / friends |
| generation_requests, generation_queue, generation_cache, generation_templates, generation_types, generation_providers | UGS / генерации | database_models.* | |
| ugs_settings | Настройки UGS | database_models.UGSSettings | |
| sso_user_sessions | Реестр живых SSO (browser/mobile/desktop) | SSO registry | `client_class` incl. `desktop` |
| web_sso_recovery_capsules | Continuity W3 encrypted recovery capsules (principal-bound, 7d, single-use) | Web SSO Continuity | Fernet ciphertext; no bearer tokens |
| sso_session_audit_events | Аудит SSO replace/logout | SSO registry | diagnostics |
| desktop_client_licenses | Seat/license rows (hash, modes `allow_offline`/`allow_online`, email bind) | `desktop_client.license_service` facade (`license_enroll` / `license_ops` / `license_runtime`) | `20260807_03` + capabilities `20260808_01`; plaintext key never stored |
| desktop_client_devices | Device bind per license (pubkey / fingerprint) | same | redeem / prove / assert |
| desktop_client_portal_peers | Portal WG peers for cloud seats | `desktop_client.portal_peer_service` | `20260807` portal peers mig |
| desktop_client_runtime_presence | Client heartbeat (version, WG-up, peer slug) for Admin Users Desktop channel | `admin_directory_enrich.upsert_runtime_presence` | `20260808_04`; `POST /api/v1/desktop-client/runtime/presence`; applied prod-core 2026-08-08 |
| desktop_client_soft_revokes | Soft revoke SoT for OTA denylist | `desktop_client` / Admin platform-ops | `applied/20260808_desktop_client_soft_revokes.sql` |
| desktop_client_denylist_publish | Denylist publish metadata | same | paired with soft_revokes; Admin publish → signed `denylist.json` |
| desktop_client_enrollment_requests | Hand-to-hand `device_request_v1` + Capsule v2 activation hash + `issued_peer_slug` | `desktop_client.enrollment_service` | `20260811_01` + activation cols `20260812_01` + peer slug `20260813_01`; applied prod-core 2026-08-11/12 (fleet mig pending apply) |
| desktop_client_air_enroll_sessions | One-code pre-license FSM, exact port/SG lease, hash-only credentials, issuance/delivery/cleanup links | `desktop_client.air_enroll_service` | `20260910_02`; one live lease per port; plaintext code and Capsule forbidden in events/logs |
| desktop_client_air_enroll_events | Append-only sanitized Air issuance and cleanup checkpoints | `desktop_client.air_enroll_service` | `20260910_02`; no selector/secret/token/key/channel material |
| desktop_client_fleet_migration | Wave 9 Capsule v2 fleet cutover per license (grace/exception/completed) | `desktop_client.fleet_migration_service` | `20260813_01` `applied/20260813_desktop_client_fleet_migration.sql` |
| desktop_client_identity_bindings | Atomic `sub ↔ license ↔ device ↔ DPoP JKT` for native OIDC | `desktop_client.auth_binding` | `20260813_02`; `rebind_allowed_until` / `last_risk_at` `20260814_01`; applied prod-core 2026-08-13 (risk cols pending apply) |
| desktop_client_auth_tickets | Pre-OIDC binding tickets (hash only; no plaintext) | `desktop_client.auth_binding` | `20260813_02`; `transcript_jti` `20260814_01` |
| desktop_client_auth_risk_events | Auth-risk / admin-recovery audit (no license status mutation) | `desktop_client.auth_risk` | `20260814_01` |
| desktop_client_admin_recovery_actions | Idempotent admin recovery outcomes (PK = `{binding_id}:{action}:{idempotency_key}`) | `desktop_client.auth_binding_recovery` | `20260814_01` |
| schema_migrations | Учёт применённых app-миграций | — | `apply-eliteew-migrations.sh` |

### Прочие таблицы `ai_services`

Доменные/legacy префиксы (`medical_*`, `telegram_*`, `emperyworld_*`, `jtbd_*`, `marketing_*`, `swot_*`, `research_*`, `workflow_*`, `competitive_*`, `agent_*`, `audit_*`, …) — уточнять по коду и миграциям. Не путать с таблицами EWA PG (префикс `ewa_*` живёт на **другом** инстансе).

---

## 2. `ewa` — `stack-ewa-postgres`

DSN: **`EWA_DATABASE_URL`**. Не смешивать с `DATABASE_URL`. Idempotent SQL в `ewa_platform/migrations/applied/` (нет общей таблицы «применено» — только idempotent apply + verify-скрипты).

| Таблица | Назначение | Миграция / модуль |
|---------|------------|-------------------|
| ewa_orchestration_session / ewa_orchestration_event | Desktop orchestration session/events | `001` |
| ewa_companion_profile / ewa_companion_profile_audit | Профиль спутника | `003` |
| ewa_companion_prompt_block / ewa_companion_prompt_block_audit | Редактируемые platform prompt blocks | `034` |
| ewa_companion_task_runs / ewa_companion_task_steps | Durable companion task runs | `004` (+ `009`/`011`/`018`/`021`/`031`) |
| ewa_companion_quick_action_presets | Quick-action presets | `004` |
| ewa_companion_episodes / ewa_companion_episode_link | HCM episodic + граф | `005` / `006` |
| ewa_atom / ewa_atom_edge | Atom layer | `007` |
| ewa_companion_plans / ewa_companion_plan_goals / ewa_companion_plan_tasks | Server-first plans | `008` |
| ewa_companion_turn_dedup | Idempotent chat turns | `010` |
| ewa_companion_workflow_catalog (+ audit) | Operator workflow catalog | `012` |
| ewa_platform_setting / ewa_platform_setting_audit | DB-backed `EWA_*` flags | `013` (+ seed `014`–`032`) |
| ewa_companion_user_workflows | End-user workflows | `015` |
| ewa_agentic_sessions / ewa_agentic_task_tree / ewa_agentic_checkpoint_logs / ewa_agentic_inbound_messages | Agentic substrate | `023` (+ `028`/`030`/`033`) |

Продуктовый канон настроек: [`product/ewa/EWA-PLATFORM-SETTINGS-DB.md`](../product/ewa/EWA-PLATFORM-SETTINGS-DB.md).

---

## 3. `keycloak` — `stack6-keycloak-postgres`

БД только для **Keycloak** (`KC_DB_URL` → `stack6-keycloak-postgres:5432/keycloak`). App/EWA **не** пишут сюда напрямую. Пользователи/роли realm `empery` — источник SSO; зеркало сессий приложения — `sso_user_sessions` в `ai_services`.

Операторские изменения — Admin Console / `keycloak-harden-empery-realm.sh`, не SQL app-миграции.


### desktop_client_enrollment_requests (2026-08-11)

Wave 3 hand-to-hand `device_request_v1` rows for sealed `/seats/issue` idempotency.
Wave 4 adds `activation_token_hash` + `activation_consumed_at` (`20260812_01`).
Wave 9 adds `issued_peer_slug` (`20260813_01`) for keep-peer hint after activation.
Migration `20260811_01` applied on prod-core `stack1-postgres` / `ai_services` (2026-08-11).

### desktop_client_air_enroll_sessions / events (2026-09-10)

Migration `20260910_02` adds the one-code pre-license state machine and immutable sanitized checkpoint history. Session rows own one port `62200–63200`, selector/secret hashes, policy snapshot, exact dedicated-SG rule identity, expiry/attempt timestamps, request/license/enrollment/Capsule digests, delivery state and separately observable local/SG cleanup state. A partial unique index prevents concurrent live ownership of one port.

**Applied on prod-core** `stack1-postgres` / `ai_services` (2026-09-10); `schema_migrations` records `20260910_02` / `desktop_client_air_enroll`. Repo hygiene: keep SQL under `migrations/pending/` until the next bake-clean move to `applied/` + `apply-eliteew-migrations.sh` entry (do not leave dual SoT).

License, peer, enrollment activation hash, sealed Capsule payload/digest and Air linkage commit atomically. Redelivery may reuse that exact payload for the same recipient but never reissue entitlement or activation material. Product/protocol SoT: [`DESKTOP-CLIENT-AIR-ENROLL.md`](../product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md).

### desktop_client_fleet_migration (2026-08-13)

Wave 9 per-license Capsule v2 cutover tracking (`pending`/`grace`/`completed`/`quarantined`/`exception`).
No FK to `desktop_client_licenses` (UUID PK only). Admin summary: `GET /api/v1/desktop/admin/platform-ops/fleet-migration`.

**Not** Desktop Atomic Conditional Access Wave 6. Atomic binding fleet migrate writes `desktop_client_identity_bindings` (restricted + pending PoP) from existing `bound_keycloak_sub`; admin: `GET|POST /api/v1/desktop/admin/platform-ops/atomic-binding-fleet*`. Live uniqueness: `20260814_02` `idx_desktop_client_identity_bindings_live_license_client` (`state <> 'revoked'`).
