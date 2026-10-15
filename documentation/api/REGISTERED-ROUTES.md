# Registered Python HTTP and WebSocket routes

Reference · static registration trace dated 2026-10-11. This catalog traces the checked-out main API and KBSEW router composition, including child aggregators, literal `add_api_route` loops and `register_*_routes(router)` functions. It contains **1,853 main-API traces and 14 KBSEW traces**, with legacy aliases and overlapping declarations retained. Counts are registration traces, not unique URLs or tested endpoints.

Read [SOURCE-HTTP-REFERENCE.md](SOURCE-HTTP-REFERENCE.md) before using these paths. Source parameter/default/type expressions and directly raised HTTP statuses are in [SOURCE-CONTRACT-INVENTORY.json](SOURCE-CONTRACT-INVENTORY.json); machine registration chains are in [REGISTERED-ROUTES.snapshot.json](REGISTERED-ROUTES.snapshot.json).

## Scope and method

The trace follows `main.py` domain registrars, direct maintenance mounts, the EWA facade, imported routers, literal bounded loops, split registrar functions and parent-router prefixes. It does not import application modules or access configured databases. Of 1,388 selected decorator declarations, 1,381 are reachable through these composition roots; Two literal proxy-registration call sites add 12 method declarations, and main API `api_route` methods are expanded individually; the remaining seven decorator declarations belong to the host-based Site Studio app and two worker sidecars. Their interfaces are described in the HTTP reference.

Feature/condition expressions in the snapshot are not evaluated. Ingress rewrites, middleware, authorization, deployed versions and serialization are not runtime-verified. Request/response types below are source annotations/model expressions, not fully resolved JSON Schema. Socket.IO events, Olenti Express routes and Next.js routes are separate interfaces.

`GET /api/profile/me` and `GET /api/version` have overlapping declarations. Preserve registration order when interpreting them; this catalog intentionally lists both.

## Route groups

- [/api/admin (legacy or unversioned)](#apiadmin-legacy-or-unversioned) — 5 traces
- [/api/api (legacy or unversioned)](#apiapi-legacy-or-unversioned) — 26 traces
- [/api/audio-transcription (legacy or unversioned)](#apiaudio-transcription-legacy-or-unversioned) — 4 traces
- [/api/audio-transcription-local (legacy or unversioned)](#apiaudio-transcription-local-legacy-or-unversioned) — 5 traces
- [/api/auth (legacy or unversioned)](#apiauth-legacy-or-unversioned) — 15 traces
- [/api/business-intelligence (legacy or unversioned)](#apibusiness-intelligence-legacy-or-unversioned) — 8 traces
- [/api/companies (legacy or unversioned)](#apicompanies-legacy-or-unversioned) — 7 traces
- [/api/content (legacy or unversioned)](#apicontent-legacy-or-unversioned) — 64 traces
- [/api/database (legacy or unversioned)](#apidatabase-legacy-or-unversioned) — 1 traces
- [/api/doc-editor (legacy or unversioned)](#apidoc-editor-legacy-or-unversioned) — 63 traces
- [/api/elite-editor (legacy or unversioned)](#apielite-editor-legacy-or-unversioned) — 26 traces
- [/api/friends (legacy or unversioned)](#apifriends-legacy-or-unversioned) — 23 traces
- [/api/health (legacy or unversioned)](#apihealth-legacy-or-unversioned) — 1 traces
- [/api/marketing-cabinet (legacy or unversioned)](#apimarketing-cabinet-legacy-or-unversioned) — 146 traces
- [/api/mobile-app (legacy or unversioned)](#apimobile-app-legacy-or-unversioned) — 8 traces
- [/api/monitoring (legacy or unversioned)](#apimonitoring-legacy-or-unversioned) — 1 traces
- [/api/profile (legacy or unversioned)](#apiprofile-legacy-or-unversioned) — 26 traces
- [/api/projects (legacy or unversioned)](#apiprojects-legacy-or-unversioned) — 10 traces
- [/api/tts (legacy or unversioned)](#apitts-legacy-or-unversioned) — 3 traces
- [/api/ugs (legacy or unversioned)](#apiugs-legacy-or-unversioned) — 32 traces
- [/api/unified-content (legacy or unversioned)](#apiunified-content-legacy-or-unversioned) — 2 traces
- [/api/v1/api](#apiv1api) — 26 traces
- [/api/v1/audio-transcription](#apiv1audio-transcription) — 4 traces
- [/api/v1/audio-transcription-local](#apiv1audio-transcription-local) — 5 traces
- [/api/v1/auth](#apiv1auth) — 14 traces
- [/api/v1/cache](#apiv1cache) — 6 traces
- [/api/v1/companies](#apiv1companies) — 7 traces
- [/api/v1/content](#apiv1content) — 64 traces
- [/api/v1/desktop](#apiv1desktop) — 300 traces
- [/api/v1/desktop-client](#apiv1desktop-client) — 25 traces
- [/api/v1/diagnostics](#apiv1diagnostics) — 3 traces
- [/api/v1/doc-editor](#apiv1doc-editor) — 63 traces
- [/api/v1/doc-editor-v2](#apiv1doc-editor-v2) — 15 traces
- [/api/v1/ebrowser](#apiv1ebrowser) — 3 traces
- [/api/v1/elite-editor](#apiv1elite-editor) — 26 traces
- [/api/v1/ewa](#apiv1ewa) — 86 traces
- [/api/v1/ewrp](#apiv1ewrp) — 12 traces
- [/api/v1/floating-widgets](#apiv1floating-widgets) — 8 traces
- [/api/v1/friends](#apiv1friends) — 23 traces
- [/api/v1/gaf-chat](#apiv1gaf-chat) — 26 traces
- [/api/v1/health](#apiv1health) — 1 traces
- [/api/v1/image-studio](#apiv1image-studio) — 10 traces
- [/api/v1/kbsew](#apiv1kbsew) — 12 traces
- [/api/v1/kursorina](#apiv1kursorina) — 6 traces
- [/api/v1/live-voice](#apiv1live-voice) — 12 traces
- [/api/v1/marketing-cabinet](#apiv1marketing-cabinet) — 146 traces
- [/api/v1/mobile-app](#apiv1mobile-app) — 8 traces
- [/api/v1/mobile-devices](#apiv1mobile-devices) — 17 traces
- [/api/v1/monitoring](#apiv1monitoring) — 1 traces
- [/api/v1/music-evolution](#apiv1music-evolution) — 7 traces
- [/api/v1/music-forge](#apiv1music-forge) — 31 traces
- [/api/v1/music-generator](#apiv1music-generator) — 24 traces
- [/api/v1/paperless](#apiv1paperless) — 4 traces
- [/api/v1/ping](#apiv1ping) — 1 traces
- [/api/v1/product-desktop](#apiv1product-desktop) — 62 traces
- [/api/v1/professional-worlds](#apiv1professional-worlds) — 162 traces
- [/api/v1/profile](#apiv1profile) — 25 traces
- [/api/v1/projects](#apiv1projects) — 10 traces
- [/api/v1/social-hub](#apiv1social-hub) — 4 traces
- [/api/v1/system](#apiv1system) — 1 traces
- [/api/v1/system-info](#apiv1system-info) — 1 traces
- [/api/v1/text-to-voice](#apiv1text-to-voice) — 1 traces
- [/api/v1/tts](#apiv1tts) — 3 traces
- [/api/v1/ugs](#apiv1ugs) — 68 traces
- [/api/v1/unified-content](#apiv1unified-content) — 2 traces
- [/api/v1/video-calls](#apiv1video-calls) — 6 traces
- [/api/v1/video-studio](#apiv1video-studio) — 3 traces
- [/api/v1/voice-center](#apiv1voice-center) — 3 traces
- [/api/v1/voice-commands](#apiv1voice-commands) — 3 traces
- [/api/v1/voice-gateway](#apiv1voice-gateway) — 8 traces
- [/api/v1/vr-pilot](#apiv1vr-pilot) — 1 traces
- [/api/version (legacy or unversioned)](#apiversion-legacy-or-unversioned) — 3 traces
- [/api/voice-center (legacy or unversioned)](#apivoice-center-legacy-or-unversioned) — 9 traces
- [/api/vr-pilot (legacy or unversioned)](#apivr-pilot-legacy-or-unversioned) — 1 traces
- [KBSEW service](#kbsew-service) — 14 traces
- [Root / non-versioned paths](#root--non-versioned-paths) — 5 traces

## /api/admin (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `DELETE` | `/api/admin/system/maintenance` | [clear_maintenance_window](../../shared/api/routers/system_maintenance.py#L95) | `MaintenanceStatus` |
| `GET` | `/api/admin/system/maintenance/defaults` | [get_maintenance_deploy_defaults](../../shared/api/routers/system_maintenance.py#L106) | `dict[str, Any]` |
| `PUT` | `/api/admin/system/maintenance/defaults` | [put_maintenance_deploy_defaults](../../shared/api/routers/system_maintenance.py#L115) | `MaintenanceDeployDefaults` |
| `POST` | `/api/admin/system/maintenance/phase/{phase}` | [set_maintenance_phase](../../shared/api/routers/system_maintenance.py#L78) | `MaintenanceStatus` |
| `POST` | `/api/admin/system/maintenance/schedule` | [schedule_maintenance_window](../../shared/api/routers/system_maintenance.py#L66) | `MaintenanceStatus` |

## /api/api (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `DELETE` | `/api/api/ai-business/cleanup` | [cleanup_old_files](../../shared/api/routers/ai_business_generator.py#L1522) | `dict[str, Any]` |
| `GET` | `/api/api/ai-business/download/{session_id}/{file_name}` | [download_file](../../shared/api/routers/ai_business_generator.py#L1466) | `FileResponse` |
| `POST` | `/api/api/ai-business/generate` | [start_generation](../../shared/api/routers/ai_business_generator.py#L1396) | `dict[str, Any]` |
| `GET` | `/api/api/ai-business/health` | [health_check](../../shared/api/routers/ai_business_generator.py#L1281) | `dict[str, Any]` |
| `GET` | `/api/api/ai-business/models` | [get_available_models](../../shared/api/routers/ai_business_generator.py#L1300) | `dict[str, Any]` |
| `POST` | `/api/api/ai-business/session/{session_id}/cancel` | [cancel_session](../../shared/api/routers/ai_business_generator.py#L1453) | `dict[str, Any]` |
| `GET` | `/api/api/ai-business/session/{session_id}/status` | [get_session_status](../../shared/api/routers/ai_business_generator.py#L1429) | `dict[str, Any]` |
| `POST` | `/api/api/ai-business/upload` | [upload_files](../../shared/api/routers/ai_business_generator.py#L1336) | `dict[str, Any]` |
| `WEBSOCKET` | `/api/api/ai-business/ws/{session_id}` | [websocket_endpoint](../../shared/api/routers/ai_business_generator.py#L1485) | `None` |
| `GET` | `/api/api/unified-editor/documents` | [list_documents](../../shared/api/routers/unified_editor.py#L435) | `dict[str, Any]` |
| `POST` | `/api/api/unified-editor/documents` | [create_document](../../shared/api/routers/unified_editor.py#L335) | `dict[str, Any]` |
| `DELETE` | `/api/api/unified-editor/documents/{document_id}` | [delete_document](../../shared/api/routers/unified_editor.py#L411) | `dict[str, Any]` |
| `GET` | `/api/api/unified-editor/documents/{document_id}` | [get_document](../../shared/api/routers/unified_editor.py#L360) | `dict[str, Any]` |
| `PATCH` | `/api/api/unified-editor/documents/{document_id}` | [update_document](../../shared/api/routers/unified_editor.py#L384) | `dict[str, Any]` |
| `POST` | `/api/api/unified-editor/export` | [export_document](../../shared/api/routers/unified_editor.py#L463) | `dict[str, Any]` |
| `GET` | `/api/api/unified-editor/health` | [health_check](../../shared/api/routers/unified_editor.py#L222) | `dict[str, Any]` |
| `POST` | `/api/api/unified-editor/process` | [process_document](../../shared/api/routers/unified_editor.py#L279) | `ProcessedDocument` |
| `GET` | `/api/api/v1/themes/active` | [get_active_theme](../../shared/api/routers/themes.py#L335) | `ThemeActiveOut` |
| `POST` | `/api/api/v1/themes/apply-preset` | [apply_preset_theme](../../shared/api/routers/themes.py#L580) | `ThemeMutationOut` |
| `POST` | `/api/api/v1/themes/create` | [create_custom_theme](../../shared/api/routers/themes.py#L376) | `ThemeCreateOut` |
| `GET` | `/api/api/v1/themes/my` | [get_my_themes](../../shared/api/routers/themes.py#L305) | `ThemesListResponse` |
| `GET` | `/api/api/v1/themes/presets` | [get_preset_themes](../../shared/api/routers/themes.py#L296) | `ThemePresetsOut` |
| `GET` | `/api/api/v1/themes/stats` | [get_theme_stats](../../shared/api/routers/themes.py#L632) | `ThemeStatsOut` |
| `DELETE` | `/api/api/v1/themes/{theme_id}` | [delete_theme](../../shared/api/routers/themes.py#L528) | `ThemeDeleteOut` |
| `PUT` | `/api/api/v1/themes/{theme_id}` | [update_theme](../../shared/api/routers/themes.py#L474) | `ThemeMutationOut` |
| `PUT` | `/api/api/v1/themes/{theme_id}/activate` | [activate_theme](../../shared/api/routers/themes.py#L422) | `ThemeMutationOut` |

## /api/audio-transcription (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/audio-transcription/` | [service_info](../../shared/api/routers/audio_transcription.py#L562) | `dict[str, Any]` |
| `GET` | `/api/audio-transcription/formats` | [list_supported_formats](../../shared/api/routers/audio_transcription.py#L541) | `dict[str, Any]` |
| `GET` | `/api/audio-transcription/health` | [health_check](../../shared/api/routers/audio_transcription.py#L495) | `HealthCheckResponse` |
| `POST` | `/api/audio-transcription/transcribe` | [transcribe_audio](../../shared/api/routers/audio_transcription.py#L268) | `TranscriptionResponse` |

## /api/audio-transcription-local (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/audio-transcription-local/` | [service_info](../../shared/api/routers/audio_transcription_local.py#L444) | `dict[str, Any]` |
| `GET` | `/api/audio-transcription-local/config` | [get_configuration](../../shared/api/routers/audio_transcription_local.py#L427) | `dict[str, Any]` |
| `GET` | `/api/audio-transcription-local/formats` | [list_supported_formats](../../shared/api/routers/audio_transcription_local.py#L408) | `dict[str, Any]` |
| `GET` | `/api/audio-transcription-local/health` | [health_check](../../shared/api/routers/audio_transcription_local.py#L366) | `HealthCheckResponse` |
| `POST` | `/api/audio-transcription-local/transcribe` | [transcribe_audio](../../shared/api/routers/audio_transcription_local.py#L253) | `TranscriptionResponse` |

## /api/auth (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/auth/logout` | [logout](../../shared/api/routers/auth_logout.py#L33) | `RedirectResponse` |
| `GET` | `/api/auth/mobile-embedded/webview-shell` | [mobile_embedded_webview_shell](../../shared/api/routers/auth_mobile_embedded.py#L177) | `HTMLResponse` |
| `POST` | `/api/auth/refresh` | [auth_refresh](../../shared/api/routers/auth_refresh.py#L43) | `dict[str, Any]` |
| `POST` | `/api/auth/sso/callback` | [sso_callback](../../shared/api/routers/auth_keycloak.py#L289) | `dict[str, Any]` |
| `GET` | `/api/auth/sso/login` | [sso_login](../../shared/api/routers/auth_keycloak.py#L245) | `RedirectResponse` |
| `POST` | `/api/auth/sso/logout` | [sso_logout](../../shared/api/routers/auth_keycloak.py#L445) | `dict[str, Any]` |
| `POST` | `/api/auth/sso/migrate-user` | [migrate_user_to_keycloak](../../shared/api/routers/auth_keycloak.py#L521) | `dict[str, Any]` |
| `DELETE` | `/api/auth/sso/recovery-capsule` | [delete_web_sso_recovery_capsule](../../shared/api/routers/auth_keycloak.py#L233) | `None` |
| `GET` | `/api/auth/sso/recovery-capsule` | [get_web_sso_recovery_capsule](../../shared/api/routers/auth_keycloak.py#L217) | `WebSsoRecoveryCapsuleGetResponse` |
| `PUT` | `/api/auth/sso/recovery-capsule` | [put_web_sso_recovery_capsule](../../shared/api/routers/auth_keycloak.py#L198) | `WebSsoRecoveryCapsulePutResponse` |
| `POST` | `/api/auth/sso/refresh` | [sso_refresh_token](../../shared/api/routers/auth_keycloak.py#L413) | `dict[str, Any]` |
| `GET` | `/api/auth/sso/session-policy` | [sso_session_policy](../../shared/api/routers/auth_keycloak.py#L175) | `WebBrowserSsoSessionPolicyResponse` |
| `GET` | `/api/auth/sso/test-token` | [test_token_validation](../../shared/api/routers/auth_keycloak.py#L562) | `dict[str, Any]` |
| `GET` | `/api/auth/sso/userinfo` | [sso_userinfo](../../shared/api/routers/auth_keycloak.py#L472) | `dict[str, Any]` |
| `POST` | `/api/auth/sso/validate` | [validate_sso_token](../../shared/api/routers/auth_keycloak.py#L495) | `dict[str, Any]` |

## /api/business-intelligence (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `POST` | `/api/business-intelligence/admin/cleanup` | [cleanup_old_files](../../shared/api/routers/business_intelligence.py#L796) | `dict[str, Any]` |
| `GET` | `/api/business-intelligence/download/{session_id}/{file_name}` | [download_document](../../shared/api/routers/business_intelligence.py#L706) | `FileResponse` |
| `POST` | `/api/business-intelligence/generate` | [generate_analysis](../../shared/api/routers/business_intelligence.py#L229) | `GenerationResult` |
| `GET` | `/api/business-intelligence/health` | [health_check](../../shared/api/routers/business_intelligence.py#L145) | `SystemHealth` |
| `GET` | `/api/business-intelligence/models` | [list_models](../../shared/api/routers/business_intelligence.py#L204) | `list[ModelInfo]` |
| `POST` | `/api/business-intelligence/search` | [search_analyses](../../shared/api/routers/business_intelligence.py#L623) | `list[SearchResult]` |
| `GET` | `/api/business-intelligence/session/{session_id}` | [get_session_status](../../shared/api/routers/business_intelligence.py#L542) | `GenerationResult` |
| `GET` | `/api/business-intelligence/statistics` | [get_user_statistics](../../shared/api/routers/business_intelligence.py#L660) | `UserStatistics` |

## /api/companies (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/companies` | [list_companies](../../shared/api/routers/companies.py#L205) | `list[CompanyResponse]` |
| `POST` | `/api/companies` | [create_company](../../shared/api/routers/companies.py#L111) | `CompanyResponse` |
| `GET` | `/api/companies/slug/{slug}` | [get_company_by_slug](../../shared/api/routers/companies.py#L382) | `CompanyResponse` |
| `DELETE` | `/api/companies/{company_id}` | [delete_company](../../shared/api/routers/companies.py#L508) | `CompanyDeleteOut` |
| `GET` | `/api/companies/{company_id}` | [get_company](../../shared/api/routers/companies.py#L343) | `CompanyResponse` |
| `PUT` | `/api/companies/{company_id}` | [update_company](../../shared/api/routers/companies.py#L421) | `CompanyResponse` |
| `GET` | `/api/companies/{company_id}/stats` | [get_company_stats](../../shared/api/routers/companies.py#L582) | `CompanyStatsOut` |

## /api/content (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/content` | [list_content](../../shared/api/routers/unified_content_query.py#L322) | `ContentListResponse \| ContentListCompactResponse` |
| `POST` | `/api/content` | [upload_content](../../shared/api/routers/unified_content_upload.py#L78) | `Content` |
| `POST` | `/api/content/admin/hard-purge-soft-deleted` | [admin_hard_purge_soft_deleted](../../shared/api/routers/unified_content_admin.py#L384) | `dict[str, Any]` |
| `POST` | `/api/content/admin/migrate-pg-blobs` | [admin_migrate_pg_blobs](../../shared/api/routers/unified_content_admin.py#L352) | `dict[str, Any]` |
| `POST` | `/api/content/admin/scan-missing-blobs` | [admin_scan_missing_blobs](../../shared/api/routers/unified_content_admin.py#L311) | `dict[str, Any]` |
| `GET` | `/api/content/batch` | [get_content_batch](../../shared/api/routers/unified_content_query.py#L792) | `dict[str, Content]` |
| `POST` | `/api/content/batch-download` | [batch_download_content](../../shared/api/routers/unified_content_download.py#L779) | `StreamingResponse` |
| `GET` | `/api/content/batch-download-by-ticket` | [batch_download_by_ticket](../../shared/api/routers/unified_content_download.py#L744) | `StreamingResponse` |
| `POST` | `/api/content/batch-download-ticket` | [create_batch_download_ticket](../../shared/api/routers/unified_content_download.py#L701) | `ContentDownloadTicketResponse` |
| `GET` | `/api/content/broken` | [list_broken_content](../../shared/api/routers/unified_content_broken.py#L42) | `dict[str, Any]` |
| `POST` | `/api/content/broken/scan` | [scan_broken_content](../../shared/api/routers/unified_content_broken.py#L58) | `dict[str, Any]` |
| `GET` | `/api/content/debug` | [get_content_list](../../shared/api/routers/unified_content_query.py#L72) | `tuple[list[Content], int]` |
| `POST` | `/api/content/download-owned-archive` | [download_owned_archive](../../shared/api/routers/unified_content_download.py#L833) | `StreamingResponse` |
| `GET` | `/api/content/download-owned-archive-by-ticket` | [download_owned_archive_by_ticket](../../shared/api/routers/unified_content_download.py#L902) | `StreamingResponse` |
| `POST` | `/api/content/download-owned-archive-ticket` | [create_owned_archive_download_ticket](../../shared/api/routers/unified_content_download.py#L871) | `ContentDownloadTicketResponse` |
| `GET` | `/api/content/duplicates` | [find_duplicates](../../shared/api/routers/unified_content_admin.py#L44) | `dict[str, Any]` |
| `GET` | `/api/content/folder-previews` | [get_content_folder_previews](../../shared/api/routers/unified_content_query.py#L219) | `dict[str, Any]` |
| `GET` | `/api/content/folder-totals` | [get_content_folder_totals](../../shared/api/routers/unified_content_query.py#L161) | `dict[str, Any]` |
| `GET` | `/api/content/folder-view` | [get_content_folder_view](../../shared/api/routers/unified_content_query.py#L102) | `FolderViewResponse` |
| `GET` | `/api/content/manager/activity` | [get_manager_activity](../../shared/api/routers/unified_content_query.py#L873) | `dict[str, Any]` |
| `GET` | `/api/content/me` | [get_content_me](../../shared/api/routers/unified_content_query.py#L852) | `dict[str, str]` |
| `GET` | `/api/content/multi-version` | [list_content_multi_version](../../shared/api/routers/unified_content_query.py#L949) | `ContentListResponse` |
| `GET` | `/api/content/quota/me` | [get_content_quota_me](../../shared/api/routers/unified_content_query.py#L860) | `dict[str, int \| float \| str]` |
| `POST` | `/api/content/reindex-all` | [reindex_all_content](../../shared/api/routers/unified_content_admin.py#L180) | `dict` |
| `GET` | `/api/content/search` | [search_content](../../shared/api/routers/unified_content_search.py#L310) | `SearchResponse` |
| `POST` | `/api/content/search/advanced` | [advanced_search](../../shared/api/routers/unified_content_search.py#L448) | `SearchResponse` |
| `GET` | `/api/content/shares/received` | [list_received_shares](../../shared/api/routers/unified_content_shares.py#L240) | `list[ShareResponse]` |
| `DELETE` | `/api/content/shares/{share_id}` | [delete_share](../../shared/api/routers/unified_content_shares.py#L201) | `JSONResponse` |
| `PATCH` | `/api/content/shares/{share_id}` | [update_share](../../shared/api/routers/unified_content_shares.py#L160) | `Share` |
| `POST` | `/api/content/shares/{share_id}/access` | [track_share_access](../../shared/api/routers/unified_content_shares.py#L275) | `Share` |
| `GET` | `/api/content/statistics` | [get_statistics](../../shared/api/routers/unified_content_query.py#L512) | `dict[str, Any]` |
| `POST` | `/api/content/tags/batch-update` | [batch_update_tags](../../shared/api/routers/unified_content_query.py#L698) | `dict[str, Any]` |
| `GET` | `/api/content/tags/popular` | [get_popular_tags](../../shared/api/routers/unified_content_query.py#L581) | `dict[str, Any]` |
| `GET` | `/api/content/tags/recent` | [get_recent_tags](../../shared/api/routers/unified_content_query.py#L656) | `dict[str, Any]` |
| `POST` | `/api/content/tags/reconcile` | [reconcile_tag_counters](../../shared/api/routers/unified_content_query.py#L640) | `dict[str, Any]` |
| `GET` | `/api/content/tags/suggest` | [suggest_tags](../../shared/api/routers/unified_content_search.py#L553) | `TagSuggestResponse` |
| `GET` | `/api/content/versions/{version_id}/download` | [download_version](../../shared/api/routers/unified_content_versions.py#L526) | `StreamingResponse` |
| `GET` | `/api/content/versions/{version_id}/download-by-ticket` | [download_version_by_ticket](../../shared/api/routers/unified_content_versions.py#L286) | `StreamingResponse` |
| `POST` | `/api/content/versions/{version_id}/download-ticket` | [create_version_download_ticket](../../shared/api/routers/unified_content_versions.py#L256) | `VersionDownloadTicketResponse` |
| `DELETE` | `/api/content/view-history` | [clear_view_history](../../shared/api/routers/unified_content_query.py#L916) | `dict[str, bool]` |
| `GET` | `/api/content/view-history` | [get_view_history](../../shared/api/routers/unified_content_query.py#L890) | `dict[str, Any]` |
| `DELETE` | `/api/content/{content_id:uuid}` | [delete_content](../../shared/api/routers/unified_content_crud.py#L312) | `None` |
| `GET` | `/api/content/{content_id:uuid}` | [get_content](../../shared/api/routers/unified_content_crud.py#L73) | `Content` |
| `POST` | `/api/content/{content_id:uuid}/comment` | [add_comment](../../shared/api/routers/unified_content_comments.py#L44) | `dict[str, Any]` |
| `DELETE` | `/api/content/{content_id:uuid}/comment/{comment_id}` | [delete_comment](../../shared/api/routers/unified_content_comments.py#L101) | `dict[str, Any]` |
| `POST` | `/api/content/{content_id:uuid}/copy` | [copy_content](../../shared/api/routers/unified_content_crud.py#L368) | `Content` |
| `GET` | `/api/content/{content_id:uuid}/document-body` | [get_content_document_body](../../shared/api/routers/unified_content_crud.py#L97) | `UnifiedContentDocumentBodyResponse` |
| `GET` | `/api/content/{content_id:uuid}/document-structure` | [get_content_document_structure](../../shared/api/routers/unified_content_crud.py#L143) | `UnifiedContentDocumentStructureResponse` |
| `GET` | `/api/content/{content_id:uuid}/download` | [download_content](../../shared/api/routers/unified_content_download.py#L389) | `Response` |
| `GET` | `/api/content/{content_id:uuid}/download-by-ticket` | [download_content_by_ticket](../../shared/api/routers/unified_content_download.py#L361) | `Response` |
| `POST` | `/api/content/{content_id:uuid}/download-ticket` | [create_content_download_ticket](../../shared/api/routers/unified_content_download.py#L324) | `ContentDownloadTicketResponse` |
| `POST` | `/api/content/{content_id:uuid}/permanent-delete` | [permanent_delete_content](../../shared/api/routers/unified_content_broken.py#L102) | `dict[str, Any]` |
| `POST` | `/api/content/{content_id:uuid}/record-view` | [record_content_view](../../shared/api/routers/unified_content_query.py#L931) | `dict[str, bool]` |
| `POST` | `/api/content/{content_id:uuid}/restore` | [restore_content](../../shared/api/routers/unified_content_crud.py#L446) | `Content` |
| `POST` | `/api/content/{content_id:uuid}/storage-recheck` | [storage_recheck_content](../../shared/api/routers/unified_content_broken.py#L78) | `dict[str, Any]` |
| `GET` | `/api/content/{content_id:uuid}/thumbnail` | [get_content_thumbnail](../../shared/api/routers/unified_content_download.py#L417) | `StreamingResponse` |
| `PATCH` | `/api/content/{content_id}` | [update_content](../../shared/api/routers/unified_content_crud.py#L190) | `Content` |
| `POST` | `/api/content/{content_id}/replace-file` | [replace_content_file](../../shared/api/routers/unified_content_upload.py#L324) | `Content` |
| `POST` | `/api/content/{content_id}/reprocess` | [reprocess_content](../../shared/api/routers/unified_content_processing.py#L58) | `ReprocessQueuedResponse` |
| `POST` | `/api/content/{content_id}/revert/{version_number}` | [revert_to_version](../../shared/api/routers/unified_content_versions.py#L463) | `VersionResponse` |
| `GET` | `/api/content/{content_id}/shares` | [list_content_shares](../../shared/api/routers/unified_content_shares.py#L125) | `list[Share]` |
| `POST` | `/api/content/{content_id}/shares` | [create_share](../../shared/api/routers/unified_content_shares.py#L80) | `Share` |
| `GET` | `/api/content/{content_id}/versions` | [list_versions](../../shared/api/routers/unified_content_versions.py#L337) | `VersionListResponse` |
| `POST` | `/api/content/{content_id}/versions` | [create_manual_version](../../shared/api/routers/unified_content_versions.py#L398) | `VersionResponse` |

## /api/database (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/database/health` | [database_health](../../shared/api/main.py#L718) | `dict[str, Any]` |

## /api/doc-editor (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `POST` | `/api/doc-editor/ai/analyze` | [ai_analyze_document](../../shared/api/routers/doc_editor.py#L3099) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/ai/complete` | [ai_complete](../../shared/api/routers/doc_editor.py#L3004) | `None` |
| `POST` | `/api/doc-editor/ai/image` | [generate_image](../../shared/api/routers/doc_editor.py#L3140) | `dict[str, Any]` |
| `GET` | `/api/doc-editor/ai/image/view` | [proxy_comfyui_image](../../shared/api/routers/doc_editor.py#L3235) | `StreamingResponse` |
| `GET` | `/api/doc-editor/ai/image/{job_id}/status` | [check_image_status](../../shared/api/routers/doc_editor.py#L3183) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/ai/pre-insert-check` | [ai_pre_insert_check](../../shared/api/routers/doc_editor.py#L2985) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/chart/generate` | [generate_chart](../../shared/api/routers/doc_editor.py#L3997) | `dict[str, Any]` |
| `WEBSOCKET` | `/api/doc-editor/collaboration/{document_id}` | [yjs_collaboration_websocket](../../shared/api/routers/doc_editor.py#L4062) | `None` |
| `POST` | `/api/doc-editor/convert` | [convert_document](../../shared/api/routers/doc_editor.py#L3525) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/convert/batch` | [batch_convert_documents](../../shared/api/routers/doc_editor.py#L3738) | `dict[str, Any]` |
| `DELETE` | `/api/doc-editor/convert/cache` | [invalidate_conversion_cache](../../shared/api/routers/doc_editor.py#L3864) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/convert/detect` | [detect_file_format](../../shared/api/routers/doc_editor.py#L3707) | `dict[str, Any]` |
| `GET` | `/api/doc-editor/convert/formats` | [get_supported_formats](../../shared/api/routers/doc_editor.py#L3687) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/convert/upload` | [convert_uploaded_file](../../shared/api/routers/doc_editor.py#L3621) | `dict[str, Any]` |
| `GET` | `/api/doc-editor/documents` | [list_documents](../../shared/api/routers/doc_editor.py#L586) | `DocumentListResponse` |
| `POST` | `/api/doc-editor/documents` | [create_document](../../shared/api/routers/doc_editor.py#L548) | `DocumentResponse` |
| `DELETE` | `/api/doc-editor/documents/{document_id}` | [delete_document](../../shared/api/routers/doc_editor.py#L771) | `None` |
| `GET` | `/api/doc-editor/documents/{document_id}` | [get_document](../../shared/api/routers/doc_editor.py#L663) | `DocumentResponse` |
| `PUT` | `/api/doc-editor/documents/{document_id}` | [update_document](../../shared/api/routers/doc_editor.py#L700) | `DocumentResponse` |
| `GET` | `/api/doc-editor/documents/{document_id}/comments` | [list_document_comments](../../shared/api/routers/doc_editor.py#L1295) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/documents/{document_id}/comments/threads` | [create_comment_thread](../../shared/api/routers/doc_editor.py#L1452) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/documents/{document_id}/comments/threads/bulk-reopen` | [reopen_comment_threads_bulk](../../shared/api/routers/doc_editor.py#L1678) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/documents/{document_id}/comments/threads/bulk-resolve` | [resolve_comment_threads_bulk](../../shared/api/routers/doc_editor.py#L1630) | `dict[str, Any]` |
| `PATCH` | `/api/doc-editor/documents/{document_id}/comments/threads/{thread_id}/assign` | [assign_comment_thread_reviewer](../../shared/api/routers/doc_editor.py#L1745) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/documents/{document_id}/comments/threads/{thread_id}/comments` | [add_comment](../../shared/api/routers/doc_editor.py#L1494) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/documents/{document_id}/comments/threads/{thread_id}/follow` | [follow_comment_thread](../../shared/api/routers/doc_editor.py#L1848) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/documents/{document_id}/comments/threads/{thread_id}/mark-read` | [mark_comment_thread_read](../../shared/api/routers/doc_editor.py#L1886) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/documents/{document_id}/comments/threads/{thread_id}/pin` | [pin_comment_thread](../../shared/api/routers/doc_editor.py#L1794) | `dict[str, Any]` |
| `PATCH` | `/api/doc-editor/documents/{document_id}/comments/threads/{thread_id}/reopen` | [reopen_comment_thread](../../shared/api/routers/doc_editor.py#L1593) | `dict[str, str]` |
| `PATCH` | `/api/doc-editor/documents/{document_id}/comments/threads/{thread_id}/resolve` | [resolve_comment_thread](../../shared/api/routers/doc_editor.py#L1556) | `dict[str, str]` |
| `POST` | `/api/doc-editor/documents/{document_id}/comments/threads/{thread_id}/unfollow` | [unfollow_comment_thread](../../shared/api/routers/doc_editor.py#L1867) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/documents/{document_id}/comments/threads/{thread_id}/unpin` | [unpin_comment_thread](../../shared/api/routers/doc_editor.py#L1821) | `dict[str, Any]` |
| `DELETE` | `/api/doc-editor/documents/{document_id}/draft` | [discard_server_draft](../../shared/api/routers/doc_editor.py#L869) | `dict[str, Any]` |
| `GET` | `/api/doc-editor/documents/{document_id}/draft` | [get_server_draft](../../shared/api/routers/doc_editor.py#L812) | `dict[str, Any]` |
| `PUT` | `/api/doc-editor/documents/{document_id}/draft` | [upsert_server_draft](../../shared/api/routers/doc_editor.py#L829) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/documents/{document_id}/draft/publish` | [publish_server_draft](../../shared/api/routers/doc_editor.py#L886) | `DocumentResponse` |
| `GET` | `/api/doc-editor/documents/{document_id}/invites` | [list_document_invites](../../shared/api/routers/doc_editor.py#L2824) | `list[dict[str, Any]]` |
| `POST` | `/api/doc-editor/documents/{document_id}/invites` | [create_collaboration_invite](../../shared/api/routers/doc_editor.py#L2780) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/documents/{document_id}/restore/{version_number}` | [restore_version](../../shared/api/routers/doc_editor.py#L2938) | `DocumentResponse` |
| `GET` | `/api/doc-editor/documents/{document_id}/versions` | [get_versions](../../shared/api/routers/doc_editor.py#L2908) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/export/{document_id}` | [export_document](../../shared/api/routers/doc_editor.py#L3344) | `StreamingResponse` |
| `GET` | `/api/doc-editor/health` | [health_check](../../shared/api/routers/doc_editor.py#L4032) | `dict[str, Any]` |
| `GET` | `/api/doc-editor/invites` | [list_my_pending_invites](../../shared/api/routers/doc_editor.py#L2838) | `list[dict[str, Any]]` |
| `DELETE` | `/api/doc-editor/invites/{invite_id}` | [revoke_collaboration_invite](../../shared/api/routers/doc_editor.py#L2886) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/invites/{invite_id}/accept` | [accept_collaboration_invite](../../shared/api/routers/doc_editor.py#L2851) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/invites/{invite_id}/decline` | [decline_collaboration_invite](../../shared/api/routers/doc_editor.py#L2869) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/ocr` | [perform_ocr](../../shared/api/routers/doc_editor.py#L3916) | `dict[str, Any]` |
| `GET` | `/api/doc-editor/plugins` | [list_doc_editor_plugins](../../shared/api/routers/doc_editor.py#L2301) | `dict[str, Any]` |
| `GET` | `/api/doc-editor/plugins/admin` | [list_doc_editor_plugins_admin](../../shared/api/routers/doc_editor.py#L2375) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/plugins/admin` | [create_doc_editor_plugin_admin](../../shared/api/routers/doc_editor.py#L2440) | `dict[str, Any]` |
| `DELETE` | `/api/doc-editor/plugins/admin/{plugin_id}` | [disable_doc_editor_plugin_admin](../../shared/api/routers/doc_editor.py#L2689) | `dict[str, Any]` |
| `PATCH` | `/api/doc-editor/plugins/admin/{plugin_id}` | [update_doc_editor_plugin_admin](../../shared/api/routers/doc_editor.py#L2566) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/plugins/admin/{plugin_id}/enable` | [enable_doc_editor_plugin_admin](../../shared/api/routers/doc_editor.py#L2727) | `dict[str, Any]` |
| `DELETE` | `/api/doc-editor/plugins/{plugin_id}/install` | [uninstall_doc_editor_plugin](../../shared/api/routers/doc_editor.py#L2348) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/plugins/{plugin_id}/install` | [install_doc_editor_plugin](../../shared/api/routers/doc_editor.py#L2323) | `dict[str, Any]` |
| `GET` | `/api/doc-editor/prompts` | [list_prompts](../../shared/api/routers/doc_editor.py#L3469) | `list[PromptResponse]` |
| `POST` | `/api/doc-editor/prompts` | [save_prompt](../../shared/api/routers/doc_editor.py#L3442) | `PromptResponse` |
| `DELETE` | `/api/doc-editor/prompts/{prompt_id}` | [delete_prompt](../../shared/api/routers/doc_editor.py#L3497) | `None` |
| `GET` | `/api/doc-editor/search` | [search_documents](../../shared/api/routers/doc_editor.py#L3409) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/table/insert` | [insert_table](../../shared/api/routers/doc_editor.py#L3962) | `dict[str, Any]` |
| `GET` | `/api/doc-editor/templates` | [list_doc_editor_templates](../../shared/api/routers/doc_editor.py#L1978) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/templates/preflight` | [preflight_doc_editor_template_apply](../../shared/api/routers/doc_editor.py#L1992) | `dict[str, Any]` |
| `POST` | `/api/doc-editor/upload` | [upload_document](../../shared/api/routers/doc_editor.py#L3283) | `dict[str, Any]` |

## /api/elite-editor (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `POST` | `/api/elite-editor/ai/analyze` | [analyze_with_ai](../../shared/api/routers/elite_editor.py#L1229) | `dict[str, Any]` |
| `POST` | `/api/elite-editor/ai/speech-to-text` | [speech_to_text](../../shared/api/routers/elite_editor.py#L1278) | `dict[str, Any]` |
| `GET` | `/api/elite-editor/analytics/stats` | [get_analytics_stats](../../shared/api/routers/elite_editor.py#L1314) | `dict[str, Any]` |
| `POST` | `/api/elite-editor/convert` | [convert_document](../../shared/api/routers/elite_editor.py#L1150) | `dict[str, Any]` |
| `GET` | `/api/elite-editor/documents` | [list_documents](../../shared/api/routers/elite_editor.py#L546) | `list[DocumentResponse]` |
| `POST` | `/api/elite-editor/documents` | [create_document](../../shared/api/routers/elite_editor.py#L515) | `DocumentResponse` |
| `DELETE` | `/api/elite-editor/documents/{document_id}` | [delete_document](../../shared/api/routers/elite_editor.py#L636) | `dict[str, Any]` |
| `GET` | `/api/elite-editor/documents/{document_id}` | [get_document](../../shared/api/routers/elite_editor.py#L579) | `DocumentResponse` |
| `PATCH` | `/api/elite-editor/documents/{document_id}` | [update_document](../../shared/api/routers/elite_editor.py#L600) | `DocumentResponse` |
| `POST` | `/api/elite-editor/documents/{document_id}/ai-fill` | [ai_fill_document_fields](../../shared/api/routers/elite_editor.py#L807) | `AIFillResponse` |
| `GET` | `/api/elite-editor/documents/{document_id}/export` | [export_document_get](../../shared/api/routers/elite_editor.py#L899) | `Not annotated` |
| `GET` | `/api/elite-editor/documents/{document_id}/fields` | [get_document_fillable_fields](../../shared/api/routers/elite_editor.py#L760) | `list[FieldInfo]` |
| `POST` | `/api/elite-editor/documents/{document_id}/revert-to-original` | [revert_to_original](../../shared/api/routers/elite_editor.py#L1405) | `DocumentResponse` |
| `GET` | `/api/elite-editor/documents/{document_id}/revisions` | [get_document_revisions](../../shared/api/routers/elite_editor.py#L704) | `list[RevisionResponse]` |
| `POST` | `/api/elite-editor/documents/{document_id}/revisions/{revision_number}/restore` | [restore_document_revision](../../shared/api/routers/elite_editor.py#L730) | `DocumentResponse` |
| `PUT` | `/api/elite-editor/documents/{document_id}/tables/{table_index}` | [update_document_table](../../shared/api/routers/elite_editor.py#L662) | `DocumentResponse` |
| `POST` | `/api/elite-editor/export` | [export_document](../../shared/api/routers/elite_editor.py#L1105) | `FileResponse` |
| `GET` | `/api/elite-editor/health` | [health_check](../../shared/api/routers/elite_editor.py#L333) | `dict[str, Any]` |
| `GET` | `/api/elite-editor/integrations/minio/list` | [list_minio_documents](../../shared/api/routers/elite_editor.py#L1369) | `dict[str, list[MinioDocumentResponse]]` |
| `POST` | `/api/elite-editor/integrations/paperless/import/{paperless_id}` | [import_from_paperless](../../shared/api/routers/elite_editor.py#L1338) | `DocumentResponse` |
| `GET` | `/api/elite-editor/models` | [get_available_models](../../shared/api/routers/elite_editor.py#L1494) | `dict[str, Any]` |
| `POST` | `/api/elite-editor/ocr` | [perform_ocr](../../shared/api/routers/elite_editor.py#L1191) | `dict[str, Any]` |
| `POST` | `/api/elite-editor/process` | [process_document](../../shared/api/routers/elite_editor.py#L376) | `ProcessedDocumentResponse` |
| `POST` | `/api/elite-editor/search` | [search_documents](../../shared/api/routers/elite_editor.py#L859) | `dict[str, Any]` |
| `GET` | `/api/elite-editor/services/status` | [get_services_status](../../shared/api/routers/elite_editor.py#L358) | `dict[str, Any]` |
| `POST` | `/api/elite-editor/upload` | [upload_document_file](../../shared/api/routers/elite_editor.py#L460) | `ProcessedDocumentResponse` |

## /api/friends (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/friends` | [list_friends](../../shared/api/routers/friends.py#L338) | `list[FriendUser]` |
| `GET` | `/api/friends/admin/reports` | [admin_list_social_reports](../../shared/api/routers/friends_admin_reports.py#L71) | `SocialReportAdminListOut` |
| `GET` | `/api/friends/admin/reports/{report_id}` | [admin_get_social_report](../../shared/api/routers/friends_admin_reports.py#L95) | `SocialReportAdminItem` |
| `PATCH` | `/api/friends/admin/reports/{report_id}` | [admin_patch_social_report](../../shared/api/routers/friends_admin_reports.py#L110) | `SocialReportAdminItem` |
| `GET` | `/api/friends/circles` | [list_friend_circles](../../shared/api/routers/friends.py#L468) | `list[FriendCircleItem]` |
| `POST` | `/api/friends/circles` | [create_friend_circle](../../shared/api/routers/friends.py#L477) | `FriendCircleItem` |
| `DELETE` | `/api/friends/circles/{circle_id}` | [delete_friend_circle](../../shared/api/routers/friends.py#L511) | `dict` |
| `PATCH` | `/api/friends/circles/{circle_id}` | [update_friend_circle](../../shared/api/routers/friends.py#L490) | `FriendCircleItem` |
| `GET` | `/api/friends/overview` | [get_friends_overview](../../shared/api/routers/friends.py#L351) | `FriendsOverviewResponse` |
| `GET` | `/api/friends/referral` | [get_friends_referral_invite](../../shared/api/routers/friends.py#L382) | `FriendsReferralInviteResponse` |
| `GET` | `/api/friends/referral/preview` | [preview_friends_referral_code](../../shared/api/routers/friends.py#L394) | `FriendsReferralPreviewResponse` |
| `POST` | `/api/friends/request` | [send_friend_request](../../shared/api/routers/friends.py#L406) | `FriendRequestSendResponse` |
| `POST` | `/api/friends/request/by-user/{user_id}` | [send_friend_request_to_user](../../shared/api/routers/friends.py#L437) | `FriendRequestSendResponse` |
| `GET` | `/api/friends/requests` | [list_incoming_requests](../../shared/api/routers/friends.py#L561) | `list[IncomingRequestItem]` |
| `GET` | `/api/friends/requests/sent` | [list_sent_requests](../../shared/api/routers/friends.py#L570) | `list[SentRequestItem]` |
| `POST` | `/api/friends/requests/{request_id}/accept` | [accept_request](../../shared/api/routers/friends.py#L579) | `dict` |
| `POST` | `/api/friends/requests/{request_id}/cancel` | [cancel_request](../../shared/api/routers/friends.py#L633) | `dict` |
| `POST` | `/api/friends/requests/{request_id}/reject` | [reject_request](../../shared/api/routers/friends.py#L610) | `dict` |
| `GET` | `/api/friends/users/search` | [search_friend_users](../../shared/api/routers/friends.py#L371) | `list[FriendSearchCandidate]` |
| `DELETE` | `/api/friends/{user_id}` | [remove_friend](../../shared/api/routers/friends.py#L656) | `dict` |
| `GET` | `/api/friends/{user_id}/profile` | [get_friend_profile](../../shared/api/routers/friends.py#L525) | `FriendProfileResponse` |
| `PATCH` | `/api/friends/{user_id}/relationship` | [update_friend_relationship](../../shared/api/routers/friends.py#L538) | `FriendProfileResponse` |
| `POST` | `/api/friends/{user_id}/report` | [report_friend_user](../../shared/api/routers/friends.py#L678) | `FriendReportResponse` |

## /api/health (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/health` | [api_health_check](../../shared/api/main.py#L640) | `dict[str, Any]` |

## /api/marketing-cabinet (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `POST` | `/api/marketing-cabinet/ai/assist` | [assist_with_ai](../../shared/api/routers/marketing_cabinet/ai.py#L503) | `MarketingAiAssistResponse` |
| `POST` | `/api/marketing-cabinet/ai/assist/stream` | [assist_with_ai_stream](../../shared/api/routers/marketing_cabinet/ai.py#L556) | `StreamingResponse` |
| `GET` | `/api/marketing-cabinet/ai/runs` | [list_ai_runs](../../shared/api/routers/marketing_cabinet/ai.py#L356) | `MarketingAiRunListResponse` |
| `GET` | `/api/marketing-cabinet/ai/runs/{run_id}` | [get_ai_run_detail](../../shared/api/routers/marketing_cabinet/ai.py#L440) | `MarketingAiRunDetailResponse` |
| `POST` | `/api/marketing-cabinet/ai/tool-agent` | [marketing_tool_agent](../../shared/api/routers/marketing_cabinet/ai.py#L646) | `MarketingToolAgentResponse` |
| `GET` | `/api/marketing-cabinet/amka/operator-config` | [get_amka_operator_config](../../shared/api/routers/marketing_cabinet/amka.py#L109) | `AmkaOperatorConfigBundleOut` |
| `PUT` | `/api/marketing-cabinet/amka/operator-config` | [put_amka_operator_config](../../shared/api/routers/marketing_cabinet/amka.py#L124) | `AmkaOperatorConfigBundleOut` |
| `GET` | `/api/marketing-cabinet/amka/preset-templates` | [list_amka_preset_templates](../../shared/api/routers/marketing_cabinet/amka.py#L141) | `AmkaPresetTemplateListResponse` |
| `GET` | `/api/marketing-cabinet/amka/presets` | [list_amka_presets](../../shared/api/routers/marketing_cabinet/amka.py#L150) | `AmkaPresetListResponse` |
| `POST` | `/api/marketing-cabinet/amka/presets` | [create_amka_preset](../../shared/api/routers/marketing_cabinet/amka.py#L160) | `AmkaPresetOneResponse` |
| `DELETE` | `/api/marketing-cabinet/amka/presets/{preset_id}` | [remove_amka_preset](../../shared/api/routers/marketing_cabinet/amka.py#L223) | `Response` |
| `GET` | `/api/marketing-cabinet/amka/presets/{preset_id}` | [get_amka_preset](../../shared/api/routers/marketing_cabinet/amka.py#L186) | `AmkaPresetOneResponse` |
| `PUT` | `/api/marketing-cabinet/amka/presets/{preset_id}` | [update_amka_preset](../../shared/api/routers/marketing_cabinet/amka.py#L198) | `AmkaPresetOneResponse` |
| `GET` | `/api/marketing-cabinet/amka/project/{project_id}/runs` | [list_amka_runs](../../shared/api/routers/marketing_cabinet/amka.py#L239) | `AmkaRunListResponse` |
| `POST` | `/api/marketing-cabinet/amka/runs` | [create_amka_run](../../shared/api/routers/marketing_cabinet/amka.py#L388) | `AmkaAsyncStartResponse` |
| `GET` | `/api/marketing-cabinet/amka/runs/{run_id}` | [get_amka_run_detail](../../shared/api/routers/marketing_cabinet/amka.py#L251) | `AmkaRunDetailResponse` |
| `POST` | `/api/marketing-cabinet/amka/runs/{run_id}/approve` | [approve_amka_run](../../shared/api/routers/marketing_cabinet/amka.py#L427) | `EwaApproveResponse` |
| `POST` | `/api/marketing-cabinet/amka/runs/{run_id}/cancel` | [cancel_amka_run](../../shared/api/routers/marketing_cabinet/amka.py#L483) | `AmkaCancelResponse` |
| `POST` | `/api/marketing-cabinet/amka/runs/{run_id}/continue-step` | [continue_amka_step](../../shared/api/routers/marketing_cabinet/amka.py#L467) | `AmkaContinueStepResponse` |
| `GET` | `/api/marketing-cabinet/amka/runs/{run_id}/core-alignment` | [get_amka_run_core_alignment](../../shared/api/routers/marketing_cabinet/amka.py#L266) | `AmkaCoreAlignmentOut` |
| `GET` | `/api/marketing-cabinet/amka/runs/{run_id}/events` | [stream_amka_run_events](../../shared/api/routers/marketing_cabinet/amka.py#L348) | `StreamingResponse` |
| `GET` | `/api/marketing-cabinet/amka/runs/{run_id}/export.md` | [export_amka_run_markdown](../../shared/api/routers/marketing_cabinet/amka.py#L288) | `Response` |
| `POST` | `/api/marketing-cabinet/amka/runs/{run_id}/resume` | [resume_amka_run](../../shared/api/routers/marketing_cabinet/amka.py#L447) | `AmkaResumeResponse` |
| `GET` | `/api/marketing-cabinet/analysis/swot` | [list_swot_analyses](../../shared/api/routers/marketing_cabinet/analysis.py#L325) | `MarketingSwotListResponse` |
| `POST` | `/api/marketing-cabinet/analysis/swot` | [create_swot_analysis](../../shared/api/routers/marketing_cabinet/analysis.py#L611) | `MarketingSwotOut` |
| `POST` | `/api/marketing-cabinet/analysis/swot/generate` | [generate_swot_analysis](../../shared/api/routers/marketing_cabinet/analysis.py#L757) | `MarketingSwotOut` |
| `POST` | `/api/marketing-cabinet/analysis/swot/generate/async` | [start_generate_swot_analysis_async](../../shared/api/routers/marketing_cabinet/analysis.py#L642) | `MarketingAiAsyncStartResponse` |
| `DELETE` | `/api/marketing-cabinet/analysis/swot/{analysis_id}` | [delete_swot_analysis](../../shared/api/routers/marketing_cabinet/analysis.py#L366) | `DeleteSwotAnalysisResponse` |
| `GET` | `/api/marketing-cabinet/analysis/swot/{analysis_id}` | [get_swot_analysis](../../shared/api/routers/marketing_cabinet/analysis.py#L407) | `MarketingSwotOut` |
| `PATCH` | `/api/marketing-cabinet/analysis/swot/{analysis_id}` | [update_swot_analysis](../../shared/api/routers/marketing_cabinet/analysis.py#L429) | `MarketingSwotOut` |
| `POST` | `/api/marketing-cabinet/autofill` | [preview_or_apply_document_autofill](../../shared/api/routers/marketing_cabinet/document_autofill.py#L2490) | `MarketingDocumentAutofillResponse` |
| `POST` | `/api/marketing-cabinet/autofill/async` | [start_document_autofill_preview_async](../../shared/api/routers/marketing_cabinet/document_autofill.py#L2305) | `MarketingAiAsyncStartResponse` |
| `POST` | `/api/marketing-cabinet/autofill/generate-from-project/async` | [start_document_autofill_from_project_async](../../shared/api/routers/marketing_cabinet/document_autofill.py#L2457) | `MarketingAiAsyncStartResponse` |
| `GET` | `/api/marketing-cabinet/campaigns` | [list_campaigns](../../shared/api/routers/marketing_cabinet/campaigns.py#L113) | `MarketingCampaignListResponse` |
| `POST` | `/api/marketing-cabinet/campaigns` | [create_campaign](../../shared/api/routers/marketing_cabinet/campaigns.py#L148) | `MarketingCampaignOut` |
| `DELETE` | `/api/marketing-cabinet/campaigns/{campaign_id}` | [delete_campaign](../../shared/api/routers/marketing_cabinet/campaigns.py#L290) | `DeleteMarketingCampaignResponse` |
| `PATCH` | `/api/marketing-cabinet/campaigns/{campaign_id}` | [update_campaign](../../shared/api/routers/marketing_cabinet/campaigns.py#L233) | `MarketingCampaignOut` |
| `GET` | `/api/marketing-cabinet/chat/history` | [get_marketing_chat_history](../../shared/api/routers/marketing_cabinet/chat.py#L398) | `MarketingChatHistoryResponse` |
| `POST` | `/api/marketing-cabinet/chat/message` | [send_marketing_chat_message](../../shared/api/routers/marketing_cabinet/chat.py#L453) | `MarketingChatMessageResponse` |
| `POST` | `/api/marketing-cabinet/chat/message/stream` | [send_marketing_chat_message_stream](../../shared/api/routers/marketing_cabinet/chat.py#L536) | `StreamingResponse` |
| `GET` | `/api/marketing-cabinet/client-interaction/chat-bridge` | [get_chat_bridge](../../shared/api/routers/marketing_cabinet/client_interaction.py#L164) | `ClientChatBridgeOut` |
| `GET` | `/api/marketing-cabinet/client-interaction/context` | [get_interaction_context](../../shared/api/routers/marketing_cabinet/client_interaction.py#L128) | `ClientInteractionContextOut` |
| `GET` | `/api/marketing-cabinet/client-interaction/customer-facing-summary` | [get_customer_facing_summary](../../shared/api/routers/marketing_cabinet/client_interaction.py#L211) | `CustomerFacingSummaryGetOut` |
| `PUT` | `/api/marketing-cabinet/client-interaction/customer-facing-summary` | [put_customer_facing_summary](../../shared/api/routers/marketing_cabinet/client_interaction.py#L247) | `MarketingOkOut` |
| `GET` | `/api/marketing-cabinet/client-interaction/documents` | [list_document_approvals](../../shared/api/routers/marketing_cabinet/client_interaction.py#L282) | `list[MarketingClientDocApprovalOut]` |
| `POST` | `/api/marketing-cabinet/client-interaction/documents` | [send_documents_for_approval](../../shared/api/routers/marketing_cabinet/client_interaction.py#L355) | `MarketingClientDocCountOut` |
| `POST` | `/api/marketing-cabinet/client-interaction/documents/{approval_id}/approve` | [approve_document](../../shared/api/routers/marketing_cabinet/client_interaction.py#L402) | `MarketingClientApprovalActionOut` |
| `GET` | `/api/marketing-cabinet/client-interaction/documents/{approval_id}/file` | [download_approval_document_for_review](../../shared/api/routers/marketing_cabinet/client_interaction.py#L429) | `Not annotated` |
| `POST` | `/api/marketing-cabinet/client-interaction/documents/{approval_id}/request-removal` | [request_document_removal](../../shared/api/routers/marketing_cabinet/client_interaction.py#L542) | `MarketingClientRemovalIdOut` |
| `GET` | `/api/marketing-cabinet/client-interaction/ewrp-jobs` | [list_ewrp_jobs_for_project](../../shared/api/routers/marketing_cabinet/client_interaction.py#L657) | `list[ClientEwrpJobListItemOut]` |
| `GET` | `/api/marketing-cabinet/client-interaction/presentations` | [list_presentation_shares](../../shared/api/routers/marketing_cabinet/client_interaction.py#L741) | `list[ClientPresShareOut]` |
| `POST` | `/api/marketing-cabinet/client-interaction/presentations/share` | [share_presentation](../../shared/api/routers/marketing_cabinet/client_interaction.py#L693) | `MarketingClientShareIdOut` |
| `DELETE` | `/api/marketing-cabinet/client-interaction/presentations/{share_id}` | [revoke_presentation_share](../../shared/api/routers/marketing_cabinet/client_interaction.py#L770) | `MarketingOkOut` |
| `GET` | `/api/marketing-cabinet/client-interaction/presentations/{share_id}/html` | [get_shared_presentation_html](../../shared/api/routers/marketing_cabinet/client_interaction.py#L805) | `Not annotated` |
| `GET` | `/api/marketing-cabinet/client-interaction/presentations/{share_id}/pdf` | [get_shared_presentation_pdf](../../shared/api/routers/marketing_cabinet/client_interaction.py#L839) | `Not annotated` |
| `POST` | `/api/marketing-cabinet/client-interaction/removal-requests/{removal_id}/cancel` | [cancel_removal](../../shared/api/routers/marketing_cabinet/client_interaction.py#L625) | `MarketingOkOut` |
| `POST` | `/api/marketing-cabinet/client-interaction/removal-requests/{removal_id}/confirm` | [confirm_removal](../../shared/api/routers/marketing_cabinet/client_interaction.py#L591) | `MarketingOkOut` |
| `GET` | `/api/marketing-cabinet/companies/{company_id}/live-jobs-summary` | [get_company_live_jobs_summary](../../shared/api/routers/marketing_cabinet/live_jobs_summary.py#L38) | `MarketingProjectLiveJobsSummaryResponse` |
| `GET` | `/api/marketing-cabinet/competitors` | [list_competitors](../../shared/api/routers/marketing_cabinet/competitors.py#L212) | `MarketingCompetitorListResponse` |
| `POST` | `/api/marketing-cabinet/competitors` | [create_competitor](../../shared/api/routers/marketing_cabinet/competitors.py#L251) | `MarketingCompetitorOut` |
| `DELETE` | `/api/marketing-cabinet/competitors/{competitor_id}` | [delete_competitor](../../shared/api/routers/marketing_cabinet/competitors.py#L381) | `DeleteCompetitorResponse` |
| `PATCH` | `/api/marketing-cabinet/competitors/{competitor_id}` | [update_competitor](../../shared/api/routers/marketing_cabinet/competitors.py#L317) | `MarketingCompetitorOut` |
| `GET` | `/api/marketing-cabinet/dashboard-layout-templates` | [list_dashboard_layout_templates](../../shared/api/routers/marketing_cabinet/dashboard_layout_templates.py#L60) | `DashboardLayoutListResponse` |
| `POST` | `/api/marketing-cabinet/dashboard-layout-templates/from-project/{project_id}` | [save_dashboard_layout_template_from_project](../../shared/api/routers/marketing_cabinet/dashboard_layout_templates.py#L76) | `DashboardLayoutResponse` |
| `DELETE` | `/api/marketing-cabinet/dashboard-layout-templates/{template_id}` | [delete_dashboard_layout_template](../../shared/api/routers/marketing_cabinet/dashboard_layout_templates.py#L96) | `None` |
| `GET` | `/api/marketing-cabinet/funnels` | [list_funnels](../../shared/api/routers/marketing_cabinet/funnels.py#L155) | `MarketingFunnelListResponse` |
| `POST` | `/api/marketing-cabinet/funnels` | [create_funnel](../../shared/api/routers/marketing_cabinet/funnels.py#L212) | `MarketingFunnelOut` |
| `DELETE` | `/api/marketing-cabinet/funnels/{funnel_id}` | [delete_funnel](../../shared/api/routers/marketing_cabinet/funnels.py#L320) | `DeleteMarketingFunnelResponse` |
| `PATCH` | `/api/marketing-cabinet/funnels/{funnel_id}` | [update_funnel](../../shared/api/routers/marketing_cabinet/funnels.py#L262) | `MarketingFunnelOut` |
| `GET` | `/api/marketing-cabinet/imc/company/{company_id}/researches` | [list_imc_researches_for_company](../../shared/api/routers/marketing_cabinet/imc.py#L246) | `ImcResearchListResponse` |
| `GET` | `/api/marketing-cabinet/imc/project/{project_id}/rag-hints` | [get_imc_project_rag_hints](../../shared/api/routers/marketing_cabinet/imc.py#L79) | `ImcRagHintsResponse` |
| `GET` | `/api/marketing-cabinet/imc/project/{project_id}/researches` | [list_imc_researches_for_project](../../shared/api/routers/marketing_cabinet/imc.py#L271) | `ImcResearchListResponse` |
| `POST` | `/api/marketing-cabinet/imc/research/run` | [run_imc_research](../../shared/api/routers/marketing_cabinet/imc.py#L98) | `ImcRunResearchResponse` |
| `DELETE` | `/api/marketing-cabinet/imc/research/{research_id}` | [delete_imc_research](../../shared/api/routers/marketing_cabinet/imc.py#L317) | `ImcResearchDeleteResponse` |
| `GET` | `/api/marketing-cabinet/imc/research/{research_id}` | [get_imc_research](../../shared/api/routers/marketing_cabinet/imc.py#L233) | `ImcResearchRunDetail` |
| `POST` | `/api/marketing-cabinet/imc/research/{research_id}/cancel` | [cancel_imc_research](../../shared/api/routers/marketing_cabinet/imc.py#L296) | `ImcCancelResponse` |
| `POST` | `/api/marketing-cabinet/imc/research/{research_id}/rerun` | [rerun_imc_research](../../shared/api/routers/marketing_cabinet/imc.py#L168) | `ImcRunResearchResponse` |
| `GET` | `/api/marketing-cabinet/imc/research/{research_id}/status` | [get_imc_research_status](../../shared/api/routers/marketing_cabinet/imc.py#L220) | `ImcResearchStatusResponse` |
| `GET` | `/api/marketing-cabinet/imc/types` | [list_imc_types](../../shared/api/routers/marketing_cabinet/imc.py#L71) | `ImcResearchTypesResponse` |
| `POST` | `/api/marketing-cabinet/jtbd/extract` | [extract_job_stories](../../shared/api/routers/marketing_cabinet/jtbd.py#L847) | `MarketingJobStoryListResponse` |
| `POST` | `/api/marketing-cabinet/jtbd/extract/async` | [start_extract_job_stories_async](../../shared/api/routers/marketing_cabinet/jtbd.py#L722) | `MarketingAiAsyncStartResponse` |
| `GET` | `/api/marketing-cabinet/jtbd/job-stories` | [list_job_stories](../../shared/api/routers/marketing_cabinet/jtbd.py#L490) | `MarketingJobStoryListResponse` |
| `POST` | `/api/marketing-cabinet/jtbd/job-stories` | [create_job_story](../../shared/api/routers/marketing_cabinet/jtbd.py#L563) | `MarketingJobStoryOut` |
| `DELETE` | `/api/marketing-cabinet/jtbd/job-stories/{story_id}` | [delete_job_story](../../shared/api/routers/marketing_cabinet/jtbd.py#L696) | `DeleteJobStoryResponse` |
| `PATCH` | `/api/marketing-cabinet/jtbd/job-stories/{story_id}` | [update_job_story](../../shared/api/routers/marketing_cabinet/jtbd.py#L592) | `MarketingJobStoryOut` |
| `GET` | `/api/marketing-cabinet/operations/alerts` | [list_alerts](../../shared/api/routers/marketing_cabinet/operations.py#L460) | `MarketingAlertListResponse` |
| `POST` | `/api/marketing-cabinet/operations/alerts` | [create_alert](../../shared/api/routers/marketing_cabinet/operations.py#L505) | `MarketingAlertOut` |
| `DELETE` | `/api/marketing-cabinet/operations/alerts/{alert_id}` | [delete_alert](../../shared/api/routers/marketing_cabinet/operations.py#L606) | `DeleteMarketingAlertResponse` |
| `PATCH` | `/api/marketing-cabinet/operations/alerts/{alert_id}` | [update_alert](../../shared/api/routers/marketing_cabinet/operations.py#L563) | `MarketingAlertOut` |
| `POST` | `/api/marketing-cabinet/operations/remediation-actions` | [create_remediation_actions](../../shared/api/routers/marketing_cabinet/operations.py#L626) | `MarketingRemediationActionResponse` |
| `GET` | `/api/marketing-cabinet/operations/tasks` | [list_tasks](../../shared/api/routers/marketing_cabinet/operations.py#L294) | `MarketingTaskListResponse` |
| `POST` | `/api/marketing-cabinet/operations/tasks` | [create_task](../../shared/api/routers/marketing_cabinet/operations.py#L335) | `MarketingTaskOut` |
| `DELETE` | `/api/marketing-cabinet/operations/tasks/{task_id}` | [delete_task](../../shared/api/routers/marketing_cabinet/operations.py#L440) | `DeleteMarketingTaskResponse` |
| `PATCH` | `/api/marketing-cabinet/operations/tasks/{task_id}` | [update_task](../../shared/api/routers/marketing_cabinet/operations.py#L396) | `MarketingTaskOut` |
| `GET` | `/api/marketing-cabinet/projects/{project_id}/customer-diagnostic/admin/overview` | [get_diagnostic_admin_overview](../../shared/api/routers/marketing_cabinet/customer_diagnostic.py#L1110) | `DiagnosticOverviewResponse` |
| `POST` | `/api/marketing-cabinet/projects/{project_id}/customer-diagnostic/full-reset` | [full_diagnostic_reset](../../shared/api/routers/marketing_cabinet/customer_diagnostic.py#L965) | `MarketingDiagnosticFullResetOut` |
| `GET` | `/api/marketing-cabinet/projects/{project_id}/customer-diagnostic/history` | [get_diagnostic_history](../../shared/api/routers/marketing_cabinet/customer_diagnostic.py#L1183) | `DiagnosticHistoryResponse` |
| `POST` | `/api/marketing-cabinet/projects/{project_id}/customer-diagnostic/retake-request` | [create_retake_request](../../shared/api/routers/marketing_cabinet/customer_diagnostic.py#L823) | `RetakeRequestItem` |
| `POST` | `/api/marketing-cabinet/projects/{project_id}/customer-diagnostic/retake-requests/{request_id}/resolve` | [resolve_retake_request](../../shared/api/routers/marketing_cabinet/customer_diagnostic.py#L900) | `RetakeRequestItem` |
| `GET` | `/api/marketing-cabinet/projects/{project_id}/customer-diagnostic/session` | [get_customer_diagnostic_session](../../shared/api/routers/marketing_cabinet/customer_diagnostic.py#L629) | `CustomerDiagnosticSessionResponse` |
| `PATCH` | `/api/marketing-cabinet/projects/{project_id}/customer-diagnostic/session` | [patch_customer_diagnostic_session](../../shared/api/routers/marketing_cabinet/customer_diagnostic.py#L712) | `CustomerDiagnosticSessionResponse` |
| `GET` | `/api/marketing-cabinet/projects/{project_id}/customer-diagnostic/settings` | [get_customer_diagnostic_settings](../../shared/api/routers/marketing_cabinet/customer_diagnostic.py#L555) | `CustomerDiagnosticSettingsResponse` |
| `PATCH` | `/api/marketing-cabinet/projects/{project_id}/customer-diagnostic/settings` | [patch_customer_diagnostic_settings](../../shared/api/routers/marketing_cabinet/customer_diagnostic.py#L576) | `CustomerDiagnosticSettingsResponse` |
| `GET` | `/api/marketing-cabinet/projects/{project_id}/dashboard` | [get_project_dashboard](../../shared/api/routers/marketing_cabinet/projects.py#L110) | `MarketingProjectDashboardResponse` |
| `GET` | `/api/marketing-cabinet/projects/{project_id}/dashboard-layouts` | [list_dashboard_layouts](../../shared/api/routers/marketing_cabinet/dashboard.py#L112) | `DashboardLayoutListResponse` |
| `POST` | `/api/marketing-cabinet/projects/{project_id}/dashboard-layouts` | [create_dashboard_layout](../../shared/api/routers/marketing_cabinet/dashboard.py#L208) | `DashboardLayoutResponse` |
| `GET` | `/api/marketing-cabinet/projects/{project_id}/dashboard-layouts/active` | [get_active_dashboard_layout](../../shared/api/routers/marketing_cabinet/dashboard.py#L133) | `DashboardLayoutResponse \| None` |
| `POST` | `/api/marketing-cabinet/projects/{project_id}/dashboard-layouts/from-preset` | [create_dashboard_layout_from_preset](../../shared/api/routers/marketing_cabinet/dashboard.py#L143) | `DashboardLayoutResponse` |
| `POST` | `/api/marketing-cabinet/projects/{project_id}/dashboard-layouts/from-template` | [apply_dashboard_layout_template](../../shared/api/routers/marketing_cabinet/dashboard.py#L189) | `DashboardLayoutResponse` |
| `POST` | `/api/marketing-cabinet/projects/{project_id}/dashboard-layouts/import` | [import_dashboard_layout](../../shared/api/routers/marketing_cabinet/dashboard.py#L163) | `DashboardLayoutResponse` |
| `POST` | `/api/marketing-cabinet/projects/{project_id}/dashboard-layouts/widgets` | [add_dashboard_widget](../../shared/api/routers/marketing_cabinet/dashboard.py#L313) | `WidgetResponse` |
| `DELETE` | `/api/marketing-cabinet/projects/{project_id}/dashboard-layouts/{layout_id}` | [delete_dashboard_layout](../../shared/api/routers/marketing_cabinet/dashboard.py#L261) | `None` |
| `GET` | `/api/marketing-cabinet/projects/{project_id}/dashboard-layouts/{layout_id}` | [get_dashboard_layout](../../shared/api/routers/marketing_cabinet/dashboard.py#L226) | `DashboardLayoutResponse` |
| `PATCH` | `/api/marketing-cabinet/projects/{project_id}/dashboard-layouts/{layout_id}` | [update_dashboard_layout](../../shared/api/routers/marketing_cabinet/dashboard.py#L242) | `DashboardLayoutResponse` |
| `POST` | `/api/marketing-cabinet/projects/{project_id}/dashboard-layouts/{layout_id}/activate` | [activate_dashboard_layout](../../shared/api/routers/marketing_cabinet/dashboard.py#L278) | `DashboardActivateResponse` |
| `POST` | `/api/marketing-cabinet/projects/{project_id}/dashboard-layouts/{layout_id}/clone` | [clone_dashboard_layout](../../shared/api/routers/marketing_cabinet/dashboard.py#L295) | `DashboardCloneResponse` |
| `GET` | `/api/marketing-cabinet/projects/{project_id}/dashboard-presets` | [list_dashboard_presets](../../shared/api/routers/marketing_cabinet/dashboard.py#L100) | `MarketingDashboardPresetListResponse` |
| `GET` | `/api/marketing-cabinet/projects/{project_id}/dashboard-usage-stats` | [get_dashboard_usage_stats](../../shared/api/routers/marketing_cabinet/dashboard.py#L403) | `DashboardUsageStats` |
| `POST` | `/api/marketing-cabinet/projects/{project_id}/dashboard-widgets/cleanup-duplicates` | [cleanup_dashboard_duplicate_widgets](../../shared/api/routers/marketing_cabinet/dashboard.py#L390) | `DashboardCleanupDuplicatesResponse` |
| `DELETE` | `/api/marketing-cabinet/projects/{project_id}/dashboard-widgets/{widget_id}` | [delete_dashboard_widget](../../shared/api/routers/marketing_cabinet/dashboard.py#L368) | `None` |
| `PATCH` | `/api/marketing-cabinet/projects/{project_id}/dashboard-widgets/{widget_id}` | [update_dashboard_widget](../../shared/api/routers/marketing_cabinet/dashboard.py#L349) | `WidgetResponse` |
| `GET` | `/api/marketing-cabinet/projects/{project_id}/graph` | [get_project_graph](../../shared/api/routers/marketing_cabinet/projects.py#L210) | `MarketingProjectGraphResponse` |
| `GET` | `/api/marketing-cabinet/projects/{project_id}/health` | [get_project_health](../../shared/api/routers/marketing_cabinet/projects.py#L90) | `MarketingProjectHealthResponse` |
| `GET` | `/api/marketing-cabinet/projects/{project_id}/live-jobs-summary` | [get_project_live_jobs_summary](../../shared/api/routers/marketing_cabinet/projects.py#L73) | `MarketingProjectLiveJobsSummaryResponse` |
| `GET` | `/api/marketing-cabinet/projects/{project_id}/overview` | [get_project_overview](../../shared/api/routers/marketing_cabinet/projects.py#L100) | `MarketingProjectOverviewResponse` |
| `GET` | `/api/marketing-cabinet/projects/{project_id}/performance-dashboard` | [get_project_performance_dashboard](../../shared/api/routers/marketing_cabinet/projects.py#L159) | `MarketingPerformanceDashboardResponse` |
| `GET` | `/api/marketing-cabinet/projects/{project_id}/rag-sources` | [get_project_rag_sources](../../shared/api/routers/marketing_cabinet/project_rag_sources.py#L46) | `MarketingRagSourceListResponse` |
| `PATCH` | `/api/marketing-cabinet/projects/{project_id}/rag-sources/content/{content_id}` | [patch_project_rag_source](../../shared/api/routers/marketing_cabinet/project_rag_sources.py#L99) | `PatchMarketingRagSourceResponse` |
| `POST` | `/api/marketing-cabinet/projects/{project_id}/rag-sources/from-imc-run/{imc_research_run_id}` | [post_imc_run_to_project_rag](../../shared/api/routers/marketing_cabinet/project_rag_sources.py#L139) | `PostImcRunToProjectRagResponse` |
| `GET` | `/api/marketing-cabinet/projects/{project_id}/rag-sources/semantic-search` | [semantic_search_project_rag](../../shared/api/routers/marketing_cabinet/project_rag_sources.py#L59) | `MarketingRagSemanticSearchResponse` |
| `GET` | `/api/marketing-cabinet/researches` | [list_researches](../../shared/api/routers/marketing_cabinet/researches.py#L309) | `MarketingResearchListResponse` |
| `POST` | `/api/marketing-cabinet/researches` | [create_research](../../shared/api/routers/marketing_cabinet/researches.py#L356) | `MarketingResearchOut` |
| `GET` | `/api/marketing-cabinet/researches/types` | [list_research_types](../../shared/api/routers/marketing_cabinet/researches.py#L302) | `ResearchTypesResponse` |
| `DELETE` | `/api/marketing-cabinet/researches/{research_id}` | [delete_research](../../shared/api/routers/marketing_cabinet/researches.py#L841) | `DeleteResearchResponse` |
| `PATCH` | `/api/marketing-cabinet/researches/{research_id}` | [update_research](../../shared/api/routers/marketing_cabinet/researches.py#L421) | `MarketingResearchOut` |
| `POST` | `/api/marketing-cabinet/researches/{research_id}/run` | [run_research](../../shared/api/routers/marketing_cabinet/researches.py#L705) | `MarketingResearchOut` |
| `POST` | `/api/marketing-cabinet/researches/{research_id}/run/async` | [run_research_async](../../shared/api/routers/marketing_cabinet/researches.py#L492) | `MarketingAiAsyncStartResponse` |
| `GET` | `/api/marketing-cabinet/segments` | [list_segments](../../shared/api/routers/marketing_cabinet/segments.py#L88) | `MarketingSegmentListResponse` |
| `POST` | `/api/marketing-cabinet/segments` | [create_segment](../../shared/api/routers/marketing_cabinet/segments.py#L123) | `MarketingSegmentOut` |
| `DELETE` | `/api/marketing-cabinet/segments/{segment_id}` | [delete_segment](../../shared/api/routers/marketing_cabinet/segments.py#L259) | `DeleteMarketingSegmentResponse` |
| `PATCH` | `/api/marketing-cabinet/segments/{segment_id}` | [update_segment](../../shared/api/routers/marketing_cabinet/segments.py#L198) | `MarketingSegmentOut` |
| `GET` | `/api/marketing-cabinet/value-propositions` | [list_value_propositions](../../shared/api/routers/marketing_cabinet/value_proposition.py#L224) | `MarketingValuePropositionListResponse` |
| `POST` | `/api/marketing-cabinet/value-propositions` | [create_value_proposition](../../shared/api/routers/marketing_cabinet/value_proposition.py#L282) | `MarketingValuePropositionOut` |
| `DELETE` | `/api/marketing-cabinet/value-propositions/{value_prop_id}` | [delete_value_proposition](../../shared/api/routers/marketing_cabinet/value_proposition.py#L447) | `DeleteValuePropositionResponse` |
| `GET` | `/api/marketing-cabinet/value-propositions/{value_prop_id}` | [get_value_proposition](../../shared/api/routers/marketing_cabinet/value_proposition.py#L265) | `MarketingValuePropositionOut` |
| `PATCH` | `/api/marketing-cabinet/value-propositions/{value_prop_id}` | [update_value_proposition](../../shared/api/routers/marketing_cabinet/value_proposition.py#L365) | `MarketingValuePropositionOut` |

## /api/mobile-app (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/mobile-app/download` | [download_mobile_apk](../../shared/api/routers/mobile_app.py#L404) | `FileResponse` |
| `GET` | `/api/mobile-app/download-by-ticket` | [download_mobile_apk_by_ticket](../../shared/api/routers/mobile_app.py#L499) | `FileResponse` |
| `POST` | `/api/mobile-app/download-ticket` | [create_mobile_apk_download_ticket](../../shared/api/routers/mobile_app.py#L420) | `MobileAppDownloadTicketResponse` |
| `GET` | `/api/mobile-app/overview` | [mobile_app_overview](../../shared/api/routers/mobile_app.py#L313) | `MobileAppOverviewResponse` |
| `GET` | `/api/mobile-app/profile` | [read_mobile_profile](../../shared/api/routers/mobile_app.py#L474) | `MobileProfileResponse` |
| `PATCH` | `/api/mobile-app/profile` | [patch_mobile_profile](../../shared/api/routers/mobile_app.py#L486) | `MobileProfileResponse` |
| `PUT` | `/api/mobile-app/realtime-state` | [put_mobile_realtime_state](../../shared/api/routers/mobile_app.py#L461) | `MobileAppRealtimeStateResponse` |
| `POST` | `/api/mobile-app/support-reports` | [submit_mobile_support_report](../../shared/api/routers/mobile_app.py#L435) | `MobileSupportReportResponse` |

## /api/monitoring (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `POST` | `/api/monitoring/logs` | [ingest_client_logs](../../shared/api/main.py#L675) | `dict[str, Any]` |

## /api/profile (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/profile/activity` | [get_activity_log](../../shared/api/routers/user_profile.py#L664) | `ActivityLogResponse` |
| `DELETE` | `/api/profile/avatar` | [delete_avatar](../../shared/api/routers/user_profile.py#L299) | `dict[str, Any]` |
| `GET` | `/api/profile/avatar` | [get_current_avatar](../../shared/api/routers/user_profile.py#L262) | `AvatarUploadResponse` |
| `POST` | `/api/profile/avatar` | [upload_avatar](../../shared/api/routers/user_profile.py#L224) | `AvatarUploadResponse` |
| `GET` | `/api/profile/avatar/history` | [get_avatar_history](../../shared/api/routers/user_profile.py#L313) | `list[AvatarHistoryItem]` |
| `POST` | `/api/profile/change-password` | [change_password](../../shared/api/routers/user_profile.py#L556) | `dict[str, Any]` |
| `GET` | `/api/profile/export/history` | [get_export_history](../../shared/api/routers/user_profile.py#L711) | `list[DataExportResponse]` |
| `GET` | `/api/profile/health` | [profile_health_check](../../shared/api/routers/user_profile.py#L726) | `dict[str, str]` |
| `GET` | `/api/profile/me` | [get_oauth2_proxy_profile_me](../../shared/api/routers/profile.py#L33) | `dict[str, str \| bool \| None \| dict[str, str]]` |
| `GET` | `/api/profile/me` | [get_current_user_profile](../../shared/api/routers/user_profile.py#L158) | `UserProfileResponse` |
| `PATCH` | `/api/profile/me` | [update_current_user_profile](../../shared/api/routers/user_profile.py#L173) | `UserProfileResponse` |
| `GET` | `/api/profile/me/privacy` | [get_profile_privacy_settings](../../shared/api/routers/user_profile.py#L200) | `ProfilePrivacyResponse` |
| `PATCH` | `/api/profile/me/privacy` | [update_profile_privacy_settings](../../shared/api/routers/user_profile.py#L209) | `ProfilePrivacyResponse` |
| `DELETE` | `/api/profile/mobile-push-token` | [delete_mobile_push_token](../../shared/api/routers/user_profile.py#L501) | `Response` |
| `PUT` | `/api/profile/mobile-push-token` | [put_mobile_push_token](../../shared/api/routers/user_profile.py#L479) | `Response` |
| `GET` | `/api/profile/notification-center` | [get_notification_center](../../shared/api/routers/user_profile.py#L391) | `NotificationCenterGetResponse` |
| `PUT` | `/api/profile/notification-center` | [put_notification_center](../../shared/api/routers/user_profile.py#L451) | `NotificationCenterGetResponse` |
| `GET` | `/api/profile/notification-center/delta` | [get_notification_center_delta](../../shared/api/routers/user_profile.py#L413) | `NotificationCenterDeltaResponse` |
| `GET` | `/api/profile/preferences` | [get_user_preferences](../../shared/api/routers/user_profile.py#L330) | `UserPreferences` |
| `PATCH` | `/api/profile/preferences` | [update_user_preferences](../../shared/api/routers/user_profile.py#L350) | `UserPreferences` |
| `PATCH` | `/api/profile/preferences/language` | [update_language](../../shared/api/routers/user_profile.py#L525) | `UserPreferences` |
| `GET` | `/api/profile/security` | [get_security_settings](../../shared/api/routers/user_profile.py#L544) | `SecuritySettings` |
| `GET` | `/api/profile/sessions` | [list_active_sessions](../../shared/api/routers/user_profile.py#L584) | `list[UserSessionInfo]` |
| `POST` | `/api/profile/sessions/revoke-all` | [revoke_all_sessions](../../shared/api/routers/user_profile.py#L618) | `dict[str, Any]` |
| `DELETE` | `/api/profile/sessions/{session_id}` | [revoke_session](../../shared/api/routers/user_profile.py#L597) | `dict[str, Any]` |
| `GET` | `/api/profile/statistics` | [get_user_statistics](../../shared/api/routers/user_profile.py#L642) | `UserStatistics` |

## /api/projects (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/projects` | [list_projects](../../shared/api/routers/projects.py#L587) | `list[ProjectResponse]` |
| `POST` | `/api/projects` | [create_project](../../shared/api/routers/projects.py#L453) | `ProjectResponse` |
| `DELETE` | `/api/projects/{project_id}` | [delete_project](../../shared/api/routers/projects.py#L858) | `dict[str, str]` |
| `GET` | `/api/projects/{project_id}` | [get_project](../../shared/api/routers/projects.py#L720) | `ProjectResponse` |
| `PUT` | `/api/projects/{project_id}` | [update_project](../../shared/api/routers/projects.py#L760) | `ProjectResponse` |
| `GET` | `/api/projects/{project_id}/members` | [list_project_members](../../shared/api/routers/projects.py#L1077) | `ProjectMembersListResponse` |
| `POST` | `/api/projects/{project_id}/members` | [add_project_member](../../shared/api/routers/projects.py#L1142) | `ProjectMemberResponse` |
| `DELETE` | `/api/projects/{project_id}/members/{member_id}` | [remove_project_member](../../shared/api/routers/projects.py#L1279) | `dict[str, str]` |
| `PUT` | `/api/projects/{project_id}/members/{member_id}` | [update_project_member](../../shared/api/routers/projects.py#L1212) | `ProjectMemberResponse` |
| `POST` | `/api/projects/{project_id}/transfer-lead` | [transfer_project_lead](../../shared/api/routers/projects.py#L1326) | `ProjectResponse` |

## /api/tts (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/tts/kokoro/health` | [kokoro_health_check](../../shared/api/routers/tts_kokoro.py#L202) | `dict[str, Any]` |
| `POST` | `/api/tts/kokoro/synthesize` | [synthesize_kokoro_tts](../../shared/api/routers/tts_kokoro.py#L74) | `StreamingResponse` |
| `GET` | `/api/tts/kokoro/voices` | [get_kokoro_voices](../../shared/api/routers/tts_kokoro.py#L174) | `dict[str, Any]` |

## /api/ugs (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/ugs/admin/llama-models` | [get_llama_models](../../shared/api/routers/ugs_admin/providers_routes.py#L179) | `dict[str, list[str]]` |
| `GET` | `/api/ugs/admin/providers` | [list_generation_providers](../../shared/api/routers/ugs_admin/providers_routes.py#L47) | `list[GenerationProviderResponse]` |
| `POST` | `/api/ugs/admin/providers` | [create_generation_provider](../../shared/api/routers/ugs_admin/providers_routes.py#L69) | `GenerationProviderResponse` |
| `POST` | `/api/ugs/admin/providers/bootstrap-runtime` | [bootstrap_runtime_generation_providers](../../shared/api/routers/ugs_admin/providers_routes.py#L131) | `dict[str, Any]` |
| `DELETE` | `/api/ugs/admin/providers/{provider_name}` | [delete_generation_provider](../../shared/api/routers/ugs_admin/providers_routes.py#L115) | `Response` |
| `GET` | `/api/ugs/admin/providers/{provider_name}` | [get_generation_provider](../../shared/api/routers/ugs_admin/providers_routes.py#L56) | `GenerationProviderResponse` |
| `PUT` | `/api/ugs/admin/providers/{provider_name}` | [update_generation_provider](../../shared/api/routers/ugs_admin/providers_routes.py#L90) | `GenerationProviderResponse` |
| `GET` | `/api/ugs/admin/queue-ops` | [get_ugs_queue_ops_snapshot](../../shared/api/routers/ugs_admin/queue_ops_routes.py#L41) | `UGSQueueOpsSnapshotResponse` |
| `GET` | `/api/ugs/admin/settings` | [list_ugs_settings](../../shared/api/routers/ugs_admin/settings_routes.py#L43) | `UGSSettingListResponse` |
| `POST` | `/api/ugs/admin/settings` | [create_ugs_setting](../../shared/api/routers/ugs_admin/settings_routes.py#L70) | `UGSSettingResponse` |
| `DELETE` | `/api/ugs/admin/settings/{setting_id}` | [delete_ugs_setting](../../shared/api/routers/ugs_admin/settings_routes.py#L117) | `Response` |
| `PUT` | `/api/ugs/admin/settings/{setting_id}` | [update_ugs_setting](../../shared/api/routers/ugs_admin/settings_routes.py#L96) | `UGSSettingResponse` |
| `GET` | `/api/ugs/admin/types` | [list_generation_types](../../shared/api/routers/ugs_admin/types_routes.py#L42) | `list[AdminGenerationTypeResponse]` |
| `POST` | `/api/ugs/admin/types` | [create_generation_type](../../shared/api/routers/ugs_admin/types_routes.py#L69) | `AdminGenerationTypeResponse` |
| `DELETE` | `/api/ugs/admin/types/{type_key}` | [delete_generation_type](../../shared/api/routers/ugs_admin/types_routes.py#L109) | `Response` |
| `GET` | `/api/ugs/admin/types/{type_key}` | [get_generation_type](../../shared/api/routers/ugs_admin/types_routes.py#L56) | `AdminGenerationTypeResponse` |
| `PUT` | `/api/ugs/admin/types/{type_key}` | [update_generation_type](../../shared/api/routers/ugs_admin/types_routes.py#L85) | `AdminGenerationTypeResponse` |
| `GET` | `/api/ugs/admin/users` | [list_admin_users](../../shared/api/routers/ugs_admin/users_routes.py#L48) | `list[AdminUserResponse]` |
| `GET` | `/api/ugs/admin/users/{user_id}` | [get_admin_user](../../shared/api/routers/ugs_admin/users_routes.py#L57) | `AdminUserResponse` |
| `PATCH` | `/api/ugs/admin/users/{user_id}/admin-badge` | [set_user_admin_badge](../../shared/api/routers/ugs_admin/users_routes.py#L97) | `AdminUserResponse` |
| `POST` | `/api/ugs/admin/users/{user_id}/credits` | [top_up_user_credits](../../shared/api/routers/ugs_admin/users_routes.py#L133) | `AdminUserResponse` |
| `PUT` | `/api/ugs/admin/users/{user_id}/limits` | [update_user_limits](../../shared/api/routers/ugs_admin/users_routes.py#L173) | `AdminUserResponse` |
| `PATCH` | `/api/ugs/admin/users/{user_id}/trusted` | [set_user_trusted](../../shared/api/routers/ugs_admin/users_routes.py#L70) | `AdminUserResponse` |
| `POST` | `/api/ugs/admin/v2/bulk` | [ugs_admin_v2_bulk_apply](../../shared/api/routers/ugs_admin/v2_routes.py#L67) | `UgsAdminV2BulkApplyResult` |
| `GET` | `/api/ugs/admin/v2/snapshot` | [ugs_admin_v2_get_snapshot](../../shared/api/routers/ugs_admin/v2_routes.py#L51) | `UgsAdminV2SnapshotResponse` |
| `POST` | `/api/ugs/admin/v2/validate` | [ugs_admin_v2_validate](../../shared/api/routers/ugs_admin/v2_routes.py#L58) | `list[UgsAdminV2ValidationIssue]` |
| `GET` | `/api/ugs/admin/workflows` | [list_comfyui_workflows](../../shared/api/routers/ugs_admin/workflows_routes.py#L42) | `list[ComfyUIWorkflowResponse]` |
| `POST` | `/api/ugs/admin/workflows` | [create_comfyui_workflow](../../shared/api/routers/ugs_admin/workflows_routes.py#L70) | `ComfyUIWorkflowResponse` |
| `POST` | `/api/ugs/admin/workflows/import-from-disk` | [import_comfyui_workflows](../../shared/api/routers/ugs_admin/workflows_routes.py#L90) | `dict[str, Any]` |
| `DELETE` | `/api/ugs/admin/workflows/{slug}` | [delete_comfyui_workflow](../../shared/api/routers/ugs_admin/workflows_routes.py#L130) | `Response` |
| `GET` | `/api/ugs/admin/workflows/{slug}` | [get_comfyui_workflow](../../shared/api/routers/ugs_admin/workflows_routes.py#L57) | `ComfyUIWorkflowResponse` |
| `PUT` | `/api/ugs/admin/workflows/{slug}` | [update_comfyui_workflow](../../shared/api/routers/ugs_admin/workflows_routes.py#L106) | `ComfyUIWorkflowResponse` |

## /api/unified-content (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/unified-content/{content_id}/download` | [download_content_legacy](../../shared/api/routers/unified_content_download.py#L572) | `Response` |
| `GET` | `/api/unified-content/{content_id}/thumbnail` | [get_content_thumbnail_legacy](../../shared/api/routers/unified_content_download.py#L556) | `StreamingResponse` |

## /api/v1/api

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `DELETE` | `/api/v1/api/ai-business/cleanup` | [cleanup_old_files](../../shared/api/routers/ai_business_generator.py#L1522) | `dict[str, Any]` |
| `GET` | `/api/v1/api/ai-business/download/{session_id}/{file_name}` | [download_file](../../shared/api/routers/ai_business_generator.py#L1466) | `FileResponse` |
| `POST` | `/api/v1/api/ai-business/generate` | [start_generation](../../shared/api/routers/ai_business_generator.py#L1396) | `dict[str, Any]` |
| `GET` | `/api/v1/api/ai-business/health` | [health_check](../../shared/api/routers/ai_business_generator.py#L1281) | `dict[str, Any]` |
| `GET` | `/api/v1/api/ai-business/models` | [get_available_models](../../shared/api/routers/ai_business_generator.py#L1300) | `dict[str, Any]` |
| `POST` | `/api/v1/api/ai-business/session/{session_id}/cancel` | [cancel_session](../../shared/api/routers/ai_business_generator.py#L1453) | `dict[str, Any]` |
| `GET` | `/api/v1/api/ai-business/session/{session_id}/status` | [get_session_status](../../shared/api/routers/ai_business_generator.py#L1429) | `dict[str, Any]` |
| `POST` | `/api/v1/api/ai-business/upload` | [upload_files](../../shared/api/routers/ai_business_generator.py#L1336) | `dict[str, Any]` |
| `WEBSOCKET` | `/api/v1/api/ai-business/ws/{session_id}` | [websocket_endpoint](../../shared/api/routers/ai_business_generator.py#L1485) | `None` |
| `GET` | `/api/v1/api/unified-editor/documents` | [list_documents](../../shared/api/routers/unified_editor.py#L435) | `dict[str, Any]` |
| `POST` | `/api/v1/api/unified-editor/documents` | [create_document](../../shared/api/routers/unified_editor.py#L335) | `dict[str, Any]` |
| `DELETE` | `/api/v1/api/unified-editor/documents/{document_id}` | [delete_document](../../shared/api/routers/unified_editor.py#L411) | `dict[str, Any]` |
| `GET` | `/api/v1/api/unified-editor/documents/{document_id}` | [get_document](../../shared/api/routers/unified_editor.py#L360) | `dict[str, Any]` |
| `PATCH` | `/api/v1/api/unified-editor/documents/{document_id}` | [update_document](../../shared/api/routers/unified_editor.py#L384) | `dict[str, Any]` |
| `POST` | `/api/v1/api/unified-editor/export` | [export_document](../../shared/api/routers/unified_editor.py#L463) | `dict[str, Any]` |
| `GET` | `/api/v1/api/unified-editor/health` | [health_check](../../shared/api/routers/unified_editor.py#L222) | `dict[str, Any]` |
| `POST` | `/api/v1/api/unified-editor/process` | [process_document](../../shared/api/routers/unified_editor.py#L279) | `ProcessedDocument` |
| `GET` | `/api/v1/api/v1/themes/active` | [get_active_theme](../../shared/api/routers/themes.py#L335) | `ThemeActiveOut` |
| `POST` | `/api/v1/api/v1/themes/apply-preset` | [apply_preset_theme](../../shared/api/routers/themes.py#L580) | `ThemeMutationOut` |
| `POST` | `/api/v1/api/v1/themes/create` | [create_custom_theme](../../shared/api/routers/themes.py#L376) | `ThemeCreateOut` |
| `GET` | `/api/v1/api/v1/themes/my` | [get_my_themes](../../shared/api/routers/themes.py#L305) | `ThemesListResponse` |
| `GET` | `/api/v1/api/v1/themes/presets` | [get_preset_themes](../../shared/api/routers/themes.py#L296) | `ThemePresetsOut` |
| `GET` | `/api/v1/api/v1/themes/stats` | [get_theme_stats](../../shared/api/routers/themes.py#L632) | `ThemeStatsOut` |
| `DELETE` | `/api/v1/api/v1/themes/{theme_id}` | [delete_theme](../../shared/api/routers/themes.py#L528) | `ThemeDeleteOut` |
| `PUT` | `/api/v1/api/v1/themes/{theme_id}` | [update_theme](../../shared/api/routers/themes.py#L474) | `ThemeMutationOut` |
| `PUT` | `/api/v1/api/v1/themes/{theme_id}/activate` | [activate_theme](../../shared/api/routers/themes.py#L422) | `ThemeMutationOut` |

## /api/v1/audio-transcription

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/audio-transcription/` | [service_info](../../shared/api/routers/audio_transcription.py#L562) | `dict[str, Any]` |
| `GET` | `/api/v1/audio-transcription/formats` | [list_supported_formats](../../shared/api/routers/audio_transcription.py#L541) | `dict[str, Any]` |
| `GET` | `/api/v1/audio-transcription/health` | [health_check](../../shared/api/routers/audio_transcription.py#L495) | `HealthCheckResponse` |
| `POST` | `/api/v1/audio-transcription/transcribe` | [transcribe_audio](../../shared/api/routers/audio_transcription.py#L268) | `TranscriptionResponse` |

## /api/v1/audio-transcription-local

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/audio-transcription-local/` | [service_info](../../shared/api/routers/audio_transcription_local.py#L444) | `dict[str, Any]` |
| `GET` | `/api/v1/audio-transcription-local/config` | [get_configuration](../../shared/api/routers/audio_transcription_local.py#L427) | `dict[str, Any]` |
| `GET` | `/api/v1/audio-transcription-local/formats` | [list_supported_formats](../../shared/api/routers/audio_transcription_local.py#L408) | `dict[str, Any]` |
| `GET` | `/api/v1/audio-transcription-local/health` | [health_check](../../shared/api/routers/audio_transcription_local.py#L366) | `HealthCheckResponse` |
| `POST` | `/api/v1/audio-transcription-local/transcribe` | [transcribe_audio](../../shared/api/routers/audio_transcription_local.py#L253) | `TranscriptionResponse` |

## /api/v1/auth

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/auth/logout` | [logout](../../shared/api/routers/auth_logout.py#L33) | `RedirectResponse` |
| `GET` | `/api/v1/auth/mobile-embedded/webview-shell` | [mobile_embedded_webview_shell](../../shared/api/routers/auth_mobile_embedded.py#L177) | `HTMLResponse` |
| `POST` | `/api/v1/auth/sso/callback` | [sso_callback](../../shared/api/routers/auth_keycloak.py#L289) | `dict[str, Any]` |
| `GET` | `/api/v1/auth/sso/login` | [sso_login](../../shared/api/routers/auth_keycloak.py#L245) | `RedirectResponse` |
| `POST` | `/api/v1/auth/sso/logout` | [sso_logout](../../shared/api/routers/auth_keycloak.py#L445) | `dict[str, Any]` |
| `POST` | `/api/v1/auth/sso/migrate-user` | [migrate_user_to_keycloak](../../shared/api/routers/auth_keycloak.py#L521) | `dict[str, Any]` |
| `DELETE` | `/api/v1/auth/sso/recovery-capsule` | [delete_web_sso_recovery_capsule](../../shared/api/routers/auth_keycloak.py#L233) | `None` |
| `GET` | `/api/v1/auth/sso/recovery-capsule` | [get_web_sso_recovery_capsule](../../shared/api/routers/auth_keycloak.py#L217) | `WebSsoRecoveryCapsuleGetResponse` |
| `PUT` | `/api/v1/auth/sso/recovery-capsule` | [put_web_sso_recovery_capsule](../../shared/api/routers/auth_keycloak.py#L198) | `WebSsoRecoveryCapsulePutResponse` |
| `POST` | `/api/v1/auth/sso/refresh` | [sso_refresh_token](../../shared/api/routers/auth_keycloak.py#L413) | `dict[str, Any]` |
| `GET` | `/api/v1/auth/sso/session-policy` | [sso_session_policy](../../shared/api/routers/auth_keycloak.py#L175) | `WebBrowserSsoSessionPolicyResponse` |
| `GET` | `/api/v1/auth/sso/test-token` | [test_token_validation](../../shared/api/routers/auth_keycloak.py#L562) | `dict[str, Any]` |
| `GET` | `/api/v1/auth/sso/userinfo` | [sso_userinfo](../../shared/api/routers/auth_keycloak.py#L472) | `dict[str, Any]` |
| `POST` | `/api/v1/auth/sso/validate` | [validate_sso_token](../../shared/api/routers/auth_keycloak.py#L495) | `dict[str, Any]` |

## /api/v1/cache

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/cache/analytics` | [get_cache_analytics_endpoint](../../shared/api/routers/cache_management.py#L65) | `dict[str, Any]` |
| `POST` | `/api/v1/cache/cleanup` | [cleanup_cache](../../shared/api/routers/cache_management.py#L128) | `dict[str, Any]` |
| `GET` | `/api/v1/cache/hot-data` | [get_hot_data](../../shared/api/routers/cache_management.py#L151) | `dict[str, Any]` |
| `POST` | `/api/v1/cache/optimize` | [optimize_cache](../../shared/api/routers/cache_management.py#L103) | `dict[str, Any]` |
| `GET` | `/api/v1/cache/recommendations` | [get_optimization_recommendations](../../shared/api/routers/cache_management.py#L85) | `dict[str, Any]` |
| `GET` | `/api/v1/cache/stats` | [get_cache_stats](../../shared/api/routers/cache_management.py#L48) | `dict[str, Any]` |

## /api/v1/companies

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/companies` | [list_companies](../../shared/api/routers/companies.py#L205) | `list[CompanyResponse]` |
| `POST` | `/api/v1/companies` | [create_company](../../shared/api/routers/companies.py#L111) | `CompanyResponse` |
| `GET` | `/api/v1/companies/slug/{slug}` | [get_company_by_slug](../../shared/api/routers/companies.py#L382) | `CompanyResponse` |
| `DELETE` | `/api/v1/companies/{company_id}` | [delete_company](../../shared/api/routers/companies.py#L508) | `CompanyDeleteOut` |
| `GET` | `/api/v1/companies/{company_id}` | [get_company](../../shared/api/routers/companies.py#L343) | `CompanyResponse` |
| `PUT` | `/api/v1/companies/{company_id}` | [update_company](../../shared/api/routers/companies.py#L421) | `CompanyResponse` |
| `GET` | `/api/v1/companies/{company_id}/stats` | [get_company_stats](../../shared/api/routers/companies.py#L582) | `CompanyStatsOut` |

## /api/v1/content

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/content` | [list_content](../../shared/api/routers/unified_content_query.py#L322) | `ContentListResponse \| ContentListCompactResponse` |
| `POST` | `/api/v1/content` | [upload_content](../../shared/api/routers/unified_content_upload.py#L78) | `Content` |
| `POST` | `/api/v1/content/admin/hard-purge-soft-deleted` | [admin_hard_purge_soft_deleted](../../shared/api/routers/unified_content_admin.py#L384) | `dict[str, Any]` |
| `POST` | `/api/v1/content/admin/migrate-pg-blobs` | [admin_migrate_pg_blobs](../../shared/api/routers/unified_content_admin.py#L352) | `dict[str, Any]` |
| `POST` | `/api/v1/content/admin/scan-missing-blobs` | [admin_scan_missing_blobs](../../shared/api/routers/unified_content_admin.py#L311) | `dict[str, Any]` |
| `GET` | `/api/v1/content/batch` | [get_content_batch](../../shared/api/routers/unified_content_query.py#L792) | `dict[str, Content]` |
| `POST` | `/api/v1/content/batch-download` | [batch_download_content](../../shared/api/routers/unified_content_download.py#L779) | `StreamingResponse` |
| `GET` | `/api/v1/content/batch-download-by-ticket` | [batch_download_by_ticket](../../shared/api/routers/unified_content_download.py#L744) | `StreamingResponse` |
| `POST` | `/api/v1/content/batch-download-ticket` | [create_batch_download_ticket](../../shared/api/routers/unified_content_download.py#L701) | `ContentDownloadTicketResponse` |
| `GET` | `/api/v1/content/broken` | [list_broken_content](../../shared/api/routers/unified_content_broken.py#L42) | `dict[str, Any]` |
| `POST` | `/api/v1/content/broken/scan` | [scan_broken_content](../../shared/api/routers/unified_content_broken.py#L58) | `dict[str, Any]` |
| `GET` | `/api/v1/content/debug` | [get_content_list](../../shared/api/routers/unified_content_query.py#L72) | `tuple[list[Content], int]` |
| `POST` | `/api/v1/content/download-owned-archive` | [download_owned_archive](../../shared/api/routers/unified_content_download.py#L833) | `StreamingResponse` |
| `GET` | `/api/v1/content/download-owned-archive-by-ticket` | [download_owned_archive_by_ticket](../../shared/api/routers/unified_content_download.py#L902) | `StreamingResponse` |
| `POST` | `/api/v1/content/download-owned-archive-ticket` | [create_owned_archive_download_ticket](../../shared/api/routers/unified_content_download.py#L871) | `ContentDownloadTicketResponse` |
| `GET` | `/api/v1/content/duplicates` | [find_duplicates](../../shared/api/routers/unified_content_admin.py#L44) | `dict[str, Any]` |
| `GET` | `/api/v1/content/folder-previews` | [get_content_folder_previews](../../shared/api/routers/unified_content_query.py#L219) | `dict[str, Any]` |
| `GET` | `/api/v1/content/folder-totals` | [get_content_folder_totals](../../shared/api/routers/unified_content_query.py#L161) | `dict[str, Any]` |
| `GET` | `/api/v1/content/folder-view` | [get_content_folder_view](../../shared/api/routers/unified_content_query.py#L102) | `FolderViewResponse` |
| `GET` | `/api/v1/content/manager/activity` | [get_manager_activity](../../shared/api/routers/unified_content_query.py#L873) | `dict[str, Any]` |
| `GET` | `/api/v1/content/me` | [get_content_me](../../shared/api/routers/unified_content_query.py#L852) | `dict[str, str]` |
| `GET` | `/api/v1/content/multi-version` | [list_content_multi_version](../../shared/api/routers/unified_content_query.py#L949) | `ContentListResponse` |
| `GET` | `/api/v1/content/quota/me` | [get_content_quota_me](../../shared/api/routers/unified_content_query.py#L860) | `dict[str, int \| float \| str]` |
| `POST` | `/api/v1/content/reindex-all` | [reindex_all_content](../../shared/api/routers/unified_content_admin.py#L180) | `dict` |
| `GET` | `/api/v1/content/search` | [search_content](../../shared/api/routers/unified_content_search.py#L310) | `SearchResponse` |
| `POST` | `/api/v1/content/search/advanced` | [advanced_search](../../shared/api/routers/unified_content_search.py#L448) | `SearchResponse` |
| `GET` | `/api/v1/content/shares/received` | [list_received_shares](../../shared/api/routers/unified_content_shares.py#L240) | `list[ShareResponse]` |
| `DELETE` | `/api/v1/content/shares/{share_id}` | [delete_share](../../shared/api/routers/unified_content_shares.py#L201) | `JSONResponse` |
| `PATCH` | `/api/v1/content/shares/{share_id}` | [update_share](../../shared/api/routers/unified_content_shares.py#L160) | `Share` |
| `POST` | `/api/v1/content/shares/{share_id}/access` | [track_share_access](../../shared/api/routers/unified_content_shares.py#L275) | `Share` |
| `GET` | `/api/v1/content/statistics` | [get_statistics](../../shared/api/routers/unified_content_query.py#L512) | `dict[str, Any]` |
| `POST` | `/api/v1/content/tags/batch-update` | [batch_update_tags](../../shared/api/routers/unified_content_query.py#L698) | `dict[str, Any]` |
| `GET` | `/api/v1/content/tags/popular` | [get_popular_tags](../../shared/api/routers/unified_content_query.py#L581) | `dict[str, Any]` |
| `GET` | `/api/v1/content/tags/recent` | [get_recent_tags](../../shared/api/routers/unified_content_query.py#L656) | `dict[str, Any]` |
| `POST` | `/api/v1/content/tags/reconcile` | [reconcile_tag_counters](../../shared/api/routers/unified_content_query.py#L640) | `dict[str, Any]` |
| `GET` | `/api/v1/content/tags/suggest` | [suggest_tags](../../shared/api/routers/unified_content_search.py#L553) | `TagSuggestResponse` |
| `GET` | `/api/v1/content/versions/{version_id}/download` | [download_version](../../shared/api/routers/unified_content_versions.py#L526) | `StreamingResponse` |
| `GET` | `/api/v1/content/versions/{version_id}/download-by-ticket` | [download_version_by_ticket](../../shared/api/routers/unified_content_versions.py#L286) | `StreamingResponse` |
| `POST` | `/api/v1/content/versions/{version_id}/download-ticket` | [create_version_download_ticket](../../shared/api/routers/unified_content_versions.py#L256) | `VersionDownloadTicketResponse` |
| `DELETE` | `/api/v1/content/view-history` | [clear_view_history](../../shared/api/routers/unified_content_query.py#L916) | `dict[str, bool]` |
| `GET` | `/api/v1/content/view-history` | [get_view_history](../../shared/api/routers/unified_content_query.py#L890) | `dict[str, Any]` |
| `DELETE` | `/api/v1/content/{content_id:uuid}` | [delete_content](../../shared/api/routers/unified_content_crud.py#L312) | `None` |
| `GET` | `/api/v1/content/{content_id:uuid}` | [get_content](../../shared/api/routers/unified_content_crud.py#L73) | `Content` |
| `POST` | `/api/v1/content/{content_id:uuid}/comment` | [add_comment](../../shared/api/routers/unified_content_comments.py#L44) | `dict[str, Any]` |
| `DELETE` | `/api/v1/content/{content_id:uuid}/comment/{comment_id}` | [delete_comment](../../shared/api/routers/unified_content_comments.py#L101) | `dict[str, Any]` |
| `POST` | `/api/v1/content/{content_id:uuid}/copy` | [copy_content](../../shared/api/routers/unified_content_crud.py#L368) | `Content` |
| `GET` | `/api/v1/content/{content_id:uuid}/document-body` | [get_content_document_body](../../shared/api/routers/unified_content_crud.py#L97) | `UnifiedContentDocumentBodyResponse` |
| `GET` | `/api/v1/content/{content_id:uuid}/document-structure` | [get_content_document_structure](../../shared/api/routers/unified_content_crud.py#L143) | `UnifiedContentDocumentStructureResponse` |
| `GET` | `/api/v1/content/{content_id:uuid}/download` | [download_content](../../shared/api/routers/unified_content_download.py#L389) | `Response` |
| `GET` | `/api/v1/content/{content_id:uuid}/download-by-ticket` | [download_content_by_ticket](../../shared/api/routers/unified_content_download.py#L361) | `Response` |
| `POST` | `/api/v1/content/{content_id:uuid}/download-ticket` | [create_content_download_ticket](../../shared/api/routers/unified_content_download.py#L324) | `ContentDownloadTicketResponse` |
| `POST` | `/api/v1/content/{content_id:uuid}/permanent-delete` | [permanent_delete_content](../../shared/api/routers/unified_content_broken.py#L102) | `dict[str, Any]` |
| `POST` | `/api/v1/content/{content_id:uuid}/record-view` | [record_content_view](../../shared/api/routers/unified_content_query.py#L931) | `dict[str, bool]` |
| `POST` | `/api/v1/content/{content_id:uuid}/restore` | [restore_content](../../shared/api/routers/unified_content_crud.py#L446) | `Content` |
| `POST` | `/api/v1/content/{content_id:uuid}/storage-recheck` | [storage_recheck_content](../../shared/api/routers/unified_content_broken.py#L78) | `dict[str, Any]` |
| `GET` | `/api/v1/content/{content_id:uuid}/thumbnail` | [get_content_thumbnail](../../shared/api/routers/unified_content_download.py#L417) | `StreamingResponse` |
| `PATCH` | `/api/v1/content/{content_id}` | [update_content](../../shared/api/routers/unified_content_crud.py#L190) | `Content` |
| `POST` | `/api/v1/content/{content_id}/replace-file` | [replace_content_file](../../shared/api/routers/unified_content_upload.py#L324) | `Content` |
| `POST` | `/api/v1/content/{content_id}/reprocess` | [reprocess_content](../../shared/api/routers/unified_content_processing.py#L58) | `ReprocessQueuedResponse` |
| `POST` | `/api/v1/content/{content_id}/revert/{version_number}` | [revert_to_version](../../shared/api/routers/unified_content_versions.py#L463) | `VersionResponse` |
| `GET` | `/api/v1/content/{content_id}/shares` | [list_content_shares](../../shared/api/routers/unified_content_shares.py#L125) | `list[Share]` |
| `POST` | `/api/v1/content/{content_id}/shares` | [create_share](../../shared/api/routers/unified_content_shares.py#L80) | `Share` |
| `GET` | `/api/v1/content/{content_id}/versions` | [list_versions](../../shared/api/routers/unified_content_versions.py#L337) | `VersionListResponse` |
| `POST` | `/api/v1/content/{content_id}/versions` | [create_manual_version](../../shared/api/routers/unified_content_versions.py#L398) | `VersionResponse` |

## /api/v1/desktop

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/desktop/admin/access-groups` | [admin_list_access_groups](../../shared/api/routers/desktop_admin.py#L290) | `list[AccessGroupResponse]` |
| `POST` | `/api/v1/desktop/admin/access-groups` | [admin_create_access_group](../../shared/api/routers/desktop_admin.py#L300) | `AccessGroupResponse` |
| `DELETE` | `/api/v1/desktop/admin/access-groups/{group_id}` | [admin_delete_access_group](../../shared/api/routers/desktop_admin.py#L350) | `Not annotated` |
| `GET` | `/api/v1/desktop/admin/access-groups/{group_id}` | [admin_get_access_group](../../shared/api/routers/desktop_admin.py#L314) | `AccessGroupResponse` |
| `PATCH` | `/api/v1/desktop/admin/access-groups/{group_id}` | [admin_update_access_group](../../shared/api/routers/desktop_admin.py#L328) | `AccessGroupResponse` |
| `GET` | `/api/v1/desktop/admin/ai-chat/config` | [get_ai_chat_config](../../shared/api/routers/desktop_admin_ai_chat.py#L85) | `dict[str, Any]` |
| `PATCH` | `/api/v1/desktop/admin/ai-chat/config` | [patch_ai_chat_config](../../shared/api/routers/desktop_admin_ai_chat.py#L155) | `dict[str, Any]` |
| `GET` | `/api/v1/desktop/admin/ai-chat/ensemble-plan-templates` | [list_ensemble_plan_templates](../../shared/api/routers/desktop_admin_ai_chat.py#L390) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/admin/ai-chat/ensemble-plan-templates` | [create_ensemble_plan_template](../../shared/api/routers/desktop_admin_ai_chat.py#L418) | `dict[str, Any]` |
| `GET` | `/api/v1/desktop/admin/ai-chat/ensemble-plan-templates/builtins` | [list_ensemble_plan_builtins](../../shared/api/routers/desktop_admin_ai_chat.py#L323) | `dict[str, Any]` |
| `GET` | `/api/v1/desktop/admin/ai-chat/ensemble-plan-templates/builtins/{source_id}` | [get_ensemble_plan_builtin_detail](../../shared/api/routers/desktop_admin_ai_chat.py#L343) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/admin/ai-chat/ensemble-plan-templates/duplicate-builtin` | [duplicate_builtin_ensemble_plan](../../shared/api/routers/desktop_admin_ai_chat.py#L450) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/admin/ai-chat/ensemble-plan-templates/validate` | [validate_ensemble_plan_payload](../../shared/api/routers/desktop_admin_ai_chat.py#L374) | `dict[str, Any]` |
| `DELETE` | `/api/v1/desktop/admin/ai-chat/ensemble-plan-templates/{row_id}` | [delete_ensemble_plan_template](../../shared/api/routers/desktop_admin_ai_chat.py#L537) | `None` |
| `GET` | `/api/v1/desktop/admin/ai-chat/ensemble-plan-templates/{row_id}` | [get_ensemble_plan_template](../../shared/api/routers/desktop_admin_ai_chat.py#L405) | `dict[str, Any]` |
| `PATCH` | `/api/v1/desktop/admin/ai-chat/ensemble-plan-templates/{row_id}` | [patch_ensemble_plan_template](../../shared/api/routers/desktop_admin_ai_chat.py#L491) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/admin/ai-chat/probe` | [post_ai_chat_probe](../../shared/api/routers/desktop_admin_ai_chat.py#L97) | `dict[str, Any]` |
| `GET` | `/api/v1/desktop/admin/ai-chat/prompt-templates` | [list_prompt_templates](../../shared/api/routers/desktop_admin_ai_chat.py#L177) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/admin/ai-chat/prompt-templates` | [create_prompt_template](../../shared/api/routers/desktop_admin_ai_chat.py#L192) | `dict[str, Any]` |
| `DELETE` | `/api/v1/desktop/admin/ai-chat/prompt-templates/{template_id}` | [delete_prompt_template](../../shared/api/routers/desktop_admin_ai_chat.py#L244) | `None` |
| `PATCH` | `/api/v1/desktop/admin/ai-chat/prompt-templates/{template_id}` | [patch_prompt_template](../../shared/api/routers/desktop_admin_ai_chat.py#L217) | `dict[str, Any]` |
| `GET` | `/api/v1/desktop/admin/catalog` | [admin_list_catalog](../../shared/api/routers/desktop_admin.py#L130) | `list[CatalogAppResponse]` |
| `POST` | `/api/v1/desktop/admin/catalog` | [admin_create_catalog_app](../../shared/api/routers/desktop_admin.py#L145) | `CatalogAppResponse` |
| `DELETE` | `/api/v1/desktop/admin/catalog/{app_id}` | [admin_delete_catalog_app](../../shared/api/routers/desktop_admin.py#L272) | `Not annotated` |
| `GET` | `/api/v1/desktop/admin/catalog/{app_id}` | [admin_get_catalog_app](../../shared/api/routers/desktop_admin.py#L207) | `CatalogAppResponse` |
| `PATCH` | `/api/v1/desktop/admin/catalog/{app_id}` | [admin_update_catalog_app](../../shared/api/routers/desktop_admin.py#L225) | `CatalogAppResponse` |
| `POST` | `/api/v1/desktop/admin/content-e2e/seed` | [post_content_e2e_seed](../../shared/api/routers/desktop_admin_content_e2e_fixtures.py#L65) | `ContentE2ESeedResponse` |
| `DELETE` | `/api/v1/desktop/admin/content-e2e/teardown` | [delete_content_e2e_teardown](../../shared/api/routers/desktop_admin_content_e2e_fixtures.py#L80) | `ContentE2ETeardownResponse` |
| `GET` | `/api/v1/desktop/admin/content-ops/diagnostics` | [get_content_ops_diagnostics](../../shared/api/routers/desktop_admin_content_ops.py#L170) | `ContentOpsDiagnosticsResponse` |
| `POST` | `/api/v1/desktop/admin/content-ops/hard-purge-soft-deleted` | [post_content_ops_hard_purge_soft_deleted](../../shared/api/routers/desktop_admin_content_ops.py#L300) | `ContentStorageHardPurgeResponse` |
| `GET` | `/api/v1/desktop/admin/content-ops/meta` | [get_content_ops_meta](../../shared/api/routers/desktop_admin_content_ops.py#L179) | `ContentOpsMetaResponse` |
| `GET` | `/api/v1/desktop/admin/content-ops/metrics` | [get_content_performance_metrics](../../shared/api/routers/desktop_admin_content_ops.py#L225) | `ContentMetricsResponse` |
| `POST` | `/api/v1/desktop/admin/content-ops/migrate-pg-blobs` | [post_content_ops_migrate_pg_blobs](../../shared/api/routers/desktop_admin_content_ops.py#L273) | `ContentStorageMigrateResponse` |
| `GET` | `/api/v1/desktop/admin/content-ops/overview` | [get_content_ops_overview](../../shared/api/routers/desktop_admin_content_ops.py#L151) | `ContentOpsOverviewResponse` |
| `POST` | `/api/v1/desktop/admin/content-ops/probe` | [post_content_ops_probe](../../shared/api/routers/desktop_admin_content_ops.py#L161) | `ContentProbeResponse` |
| `GET` | `/api/v1/desktop/admin/content-ops/processing-failures` | [get_content_processing_failures](../../shared/api/routers/desktop_admin_content_ops.py#L214) | `ContentProcessingFailuresResponse` |
| `GET` | `/api/v1/desktop/admin/content-ops/quota/users` | [get_content_user_quota_page](../../shared/api/routers/desktop_admin_content_ops.py#L189) | `ContentUserQuotaPageResponse` |
| `GET` | `/api/v1/desktop/admin/content-ops/quota/users/{user_id}` | [get_content_user_quota](../../shared/api/routers/desktop_admin_content_ops.py#L201) | `ContentUserQuotaRow` |
| `POST` | `/api/v1/desktop/admin/content-ops/scan-missing-blobs` | [post_content_ops_scan_missing_blobs](../../shared/api/routers/desktop_admin_content_ops.py#L233) | `ContentStorageScanMissingResponse` |
| `POST` | `/api/v1/desktop/admin/factory/assembly/evaluate` | [evaluate_assembly](../../shared/api/routers/desktop_admin_factory.py#L89) | `dict[str, Any]` |
| `GET` | `/api/v1/desktop/admin/factory/intentions` | [list_intentions](../../shared/api/routers/desktop_admin_factory.py#L124) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/admin/factory/intentions` | [enqueue_intention](../../shared/api/routers/desktop_admin_factory.py#L133) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/admin/factory/intentions/kill-all` | [kill_all_intentions](../../shared/api/routers/desktop_admin_factory.py#L106) | `dict[str, Any]` |
| `GET` | `/api/v1/desktop/admin/factory/intentions/{intention_id}` | [get_intention](../../shared/api/routers/desktop_admin_factory.py#L162) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/admin/factory/intentions/{intention_id}/cancel` | [cancel_intention](../../shared/api/routers/desktop_admin_factory.py#L250) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/admin/factory/intentions/{intention_id}/pause` | [pause_intention](../../shared/api/routers/desktop_admin_factory.py#L174) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/admin/factory/intentions/{intention_id}/resume` | [resume_intention](../../shared/api/routers/desktop_admin_factory.py#L189) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/admin/factory/intentions/{intention_id}/tick` | [tick_intention](../../shared/api/routers/desktop_admin_factory.py#L204) | `dict[str, Any]` |
| `GET` | `/api/v1/desktop/admin/factory/status` | [factory_status](../../shared/api/routers/desktop_admin_factory.py#L67) | `dict[str, Any]` |
| `GET` | `/api/v1/desktop/admin/i18n-rewrite/meta` | [get_i18n_rewrite_meta](../../shared/api/routers/desktop_admin_i18n_rewrite.py#L49) | `dict` |
| `POST` | `/api/v1/desktop/admin/i18n-rewrite/preview` | [preview_i18n_rewrite](../../shared/api/routers/desktop_admin_i18n_rewrite.py#L56) | `dict` |
| `POST` | `/api/v1/desktop/admin/i18n-rewrite/run-batch` | [run_i18n_rewrite_batch](../../shared/api/routers/desktop_admin_i18n_rewrite.py#L74) | `dict` |
| `GET` | `/api/v1/desktop/admin/platform-ops/air-enroll/sessions` | [list_air_enroll_sessions](../../shared/api/routers/desktop_admin_air_enroll.py#L142) | `AirEnrollSessionListResponse` |
| `POST` | `/api/v1/desktop/admin/platform-ops/air-enroll/sessions` | [create_air_enroll_session](../../shared/api/routers/desktop_admin_air_enroll.py#L119) | `AirEnrollSessionResponse` |
| `GET` | `/api/v1/desktop/admin/platform-ops/air-enroll/sessions/{session_id}` | [get_air_enroll_session](../../shared/api/routers/desktop_admin_air_enroll.py#L161) | `AirEnrollSessionResponse` |
| `POST` | `/api/v1/desktop/admin/platform-ops/air-enroll/sessions/{session_id}/cancel` | [cancel_air_enroll_session](../../shared/api/routers/desktop_admin_air_enroll.py#L197) | `AirEnrollSessionResponse` |
| `POST` | `/api/v1/desktop/admin/platform-ops/air-enroll/sessions/{session_id}/reissue` | [reissue_air_enroll_session](../../shared/api/routers/desktop_admin_air_enroll.py#L215) | `AirEnrollSessionResponse` |
| `POST` | `/api/v1/desktop/admin/platform-ops/air-enroll/sessions/{session_id}/reveal` | [reveal_air_enroll_code](../../shared/api/routers/desktop_admin_air_enroll.py#L177) | `AirEnrollRevealResponse` |
| `GET` | `/api/v1/desktop/admin/platform-ops/atomic-binding-fleet` | [admin_atomic_binding_fleet_inventory](../../shared/api/routers/desktop_admin_platform_ops.py#L771) | `AtomicBindingFleetInventoryResponse` |
| `POST` | `/api/v1/desktop/admin/platform-ops/atomic-binding-fleet/migrate` | [admin_atomic_binding_fleet_migrate](../../shared/api/routers/desktop_admin_platform_ops.py#L784) | `AtomicBindingFleetMigrateResponse` |
| `POST` | `/api/v1/desktop/admin/platform-ops/auth-bindings/{binding_id}/actions` | [admin_auth_binding_action](../../shared/api/routers/desktop_admin_platform_ops.py#L726) | `AuthBindingRecoveryActionResponse` |
| `GET` | `/api/v1/desktop/admin/platform-ops/denylist` | [admin_denylist_status](../../shared/api/routers/desktop_admin_platform_ops.py#L479) | `DenylistStatusResponse` |
| `POST` | `/api/v1/desktop/admin/platform-ops/denylist/entries` | [admin_denylist_add_entry](../../shared/api/routers/desktop_admin_platform_ops.py#L500) | `SoftRevokeEntryResponse` |
| `DELETE` | `/api/v1/desktop/admin/platform-ops/denylist/entries/{license_id}` | [admin_denylist_remove_entry](../../shared/api/routers/desktop_admin_platform_ops.py#L520) | `OpsAckResponse` |
| `POST` | `/api/v1/desktop/admin/platform-ops/denylist/publish` | [admin_denylist_publish](../../shared/api/routers/desktop_admin_platform_ops.py#L536) | `DenylistPublishResponse` |
| `GET` | `/api/v1/desktop/admin/platform-ops/egress-status` | [platform_ops_egress_status](../../shared/api/routers/desktop_admin_platform_ops.py#L172) | `dict[str, Any]` |
| `GET` | `/api/v1/desktop/admin/platform-ops/fleet-migration` | [admin_fleet_migration_summary](../../shared/api/routers/desktop_admin_platform_ops.py#L653) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/admin/platform-ops/fleet-migration/{license_id}/exception` | [admin_fleet_migration_exception](../../shared/api/routers/desktop_admin_platform_ops.py#L662) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/admin/platform-ops/fleet-migration/{license_id}/start-grace` | [admin_fleet_migration_start_grace](../../shared/api/routers/desktop_admin_platform_ops.py#L683) | `dict[str, Any]` |
| `GET` | `/api/v1/desktop/admin/platform-ops/licenses` | [admin_list_licenses](../../shared/api/routers/desktop_admin_platform_ops.py#L301) | `LicenseListResponse` |
| `GET` | `/api/v1/desktop/admin/platform-ops/licenses/{license_id}` | [admin_get_license](../../shared/api/routers/desktop_admin_platform_ops.py#L333) | `LicenseCapabilitiesResponse` |
| `PATCH` | `/api/v1/desktop/admin/platform-ops/licenses/{license_id}` | [admin_patch_license](../../shared/api/routers/desktop_admin_platform_ops.py#L349) | `LicenseCapabilitiesResponse` |
| `GET` | `/api/v1/desktop/admin/platform-ops/licenses/{license_id}/auth-bindings` | [admin_list_auth_bindings](../../shared/api/routers/desktop_admin_platform_ops.py#L713) | `AuthBindingRecoveryListResponse` |
| `GET` | `/api/v1/desktop/admin/platform-ops/licenses/{license_id}/devices` | [admin_list_license_devices](../../shared/api/routers/desktop_admin_platform_ops.py#L412) | `LicenseDeviceListResponse` |
| `POST` | `/api/v1/desktop/admin/platform-ops/licenses/{license_id}/devices/{device_id}/revoke` | [admin_revoke_license_device](../../shared/api/routers/desktop_admin_platform_ops.py#L431) | `OpsAckResponse` |
| `POST` | `/api/v1/desktop/admin/platform-ops/licenses/{license_id}/revoke` | [admin_revoke_license](../../shared/api/routers/desktop_admin_platform_ops.py#L384) | `OpsAckResponse` |
| `GET` | `/api/v1/desktop/admin/platform-ops/portal-peers` | [admin_list_portal_peers](../../shared/api/routers/desktop_admin_platform_ops.py#L180) | `PortalPeerListResponse` |
| `POST` | `/api/v1/desktop/admin/platform-ops/portal-peers` | [admin_create_portal_peer](../../shared/api/routers/desktop_admin_platform_ops.py#L565) | `PortalPeerCreateResponse` |
| `POST` | `/api/v1/desktop/admin/platform-ops/portal-peers/sync` | [admin_sync_portal_peers](../../shared/api/routers/desktop_admin_platform_ops.py#L624) | `PortalPeerSyncResponse` |
| `POST` | `/api/v1/desktop/admin/platform-ops/portal-peers/{peer_id}/revoke` | [admin_revoke_portal_peer](../../shared/api/routers/desktop_admin_platform_ops.py#L598) | `PortalPeerViewResponse` |
| `POST` | `/api/v1/desktop/admin/platform-ops/seats/issue` | [admin_issue_seat](../../shared/api/routers/desktop_admin_platform_ops.py#L189) | `SeatIssueResponse` |
| `GET` | `/api/v1/desktop/admin/platform-ops/stack0-status` | [platform_ops_stack0_status](../../shared/api/routers/desktop_admin_platform_ops.py#L164) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/admin/presence/command` | [admin_presence_user_command](../../shared/api/routers/desktop_admin.py#L917) | `dict[str, Any]` |
| `GET` | `/api/v1/desktop/admin/presence/online` | [admin_presence_online](../../shared/api/routers/desktop_admin.py#L870) | `dict[str, Any]` |
| `GET` | `/api/v1/desktop/admin/search-config/audit` | [get_search_admin_audit](../../shared/api/routers/desktop_admin_search_config.py#L471) | `SearchAuditListResponse` |
| `GET` | `/api/v1/desktop/admin/search-config/config` | [get_search_runtime_config](../../shared/api/routers/desktop_admin_search_config.py#L165) | `SearchConfigResponse` |
| `PATCH` | `/api/v1/desktop/admin/search-config/config` | [patch_search_runtime_config](../../shared/api/routers/desktop_admin_search_config.py#L175) | `SearchConfigResponse` |
| `POST` | `/api/v1/desktop/admin/search-config/config/bootstrap-env` | [bootstrap_search_runtime_from_env](../../shared/api/routers/desktop_admin_search_config.py#L203) | `SearchConfigResponse` |
| `GET` | `/api/v1/desktop/admin/search-config/effective` | [get_search_runtime_effective](../../shared/api/routers/desktop_admin_search_config.py#L223) | `SearchEffectiveResponse` |
| `GET` | `/api/v1/desktop/admin/search-config/meta` | [get_search_admin_meta](../../shared/api/routers/desktop_admin_search_config.py#L415) | `SearchMetaResponse` |
| `POST` | `/api/v1/desktop/admin/search-config/probe` | [post_search_admin_probe](../../shared/api/routers/desktop_admin_search_config.py#L425) | `SearchProbeResponse` |
| `POST` | `/api/v1/desktop/admin/search-config/query-preview` | [post_search_query_preview](../../shared/api/routers/desktop_admin_search_config.py#L500) | `SearchQueryPreviewResponse` |
| `GET` | `/api/v1/desktop/admin/search-config/stats` | [get_search_admin_stats](../../shared/api/routers/desktop_admin_search_config.py#L489) | `SearchStatsResponse` |
| `POST` | `/api/v1/desktop/admin/search-config/test-search` | [post_search_admin_test_search](../../shared/api/routers/desktop_admin_search_config.py#L440) | `SearchTestSearchResponse` |
| `POST` | `/api/v1/desktop/admin/shell/section-select` | [post_admin_shell_section_select](../../shared/api/routers/desktop_admin_shell_telemetry.py#L74) | `Response` |
| `GET` | `/api/v1/desktop/admin/system-gaf/broadcast-preview` | [get_system_gaf_broadcast_preview](../../shared/api/routers/system_gaf_admin.py#L220) | `dict[str, Any]` |
| `GET` | `/api/v1/desktop/admin/system-gaf/instruction` | [get_system_gaf_instruction](../../shared/api/routers/system_gaf_admin.py#L79) | `SystemGafInstructionResponse` |
| `PUT` | `/api/v1/desktop/admin/system-gaf/instruction` | [put_system_gaf_instruction](../../shared/api/routers/system_gaf_admin.py#L101) | `SystemGafInstructionResponse` |
| `POST` | `/api/v1/desktop/admin/system-gaf/send` | [post_system_gaf_send](../../shared/api/routers/system_gaf_admin.py#L157) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/admin/system-gaf/send-broadcast` | [post_system_gaf_send_broadcast](../../shared/api/routers/system_gaf_admin.py#L242) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/admin/system-gaf/send-test` | [post_system_gaf_send_test](../../shared/api/routers/system_gaf_admin.py#L129) | `dict[str, Any]` |
| `GET` | `/api/v1/desktop/admin/topology` | [platform_topology_graph](../../shared/api/routers/desktop_admin_topology.py#L32) | `dict[str, Any]` |
| `GET` | `/api/v1/desktop/admin/users` | [admin_list_users_app_access](../../shared/api/routers/desktop_admin.py#L406) | `list[UserAppAccessGroupResponse]` |
| `GET` | `/api/v1/desktop/admin/users/directory` | [admin_users_directory](../../shared/api/routers/desktop_admin.py#L417) | `AdminUserDirectoryPage` |
| `PATCH` | `/api/v1/desktop/admin/users/{user_id}` | [admin_update_user_app_access_group](../../shared/api/routers/desktop_admin.py#L734) | `UserAppAccessGroupResponse` |
| `PATCH` | `/api/v1/desktop/admin/users/{user_id}/ew-balance` | [admin_set_user_ew_balance](../../shared/api/routers/desktop_admin.py#L846) | `UserAppAccessGroupResponse` |
| `GET` | `/api/v1/desktop/admin/users/{user_id}/sso-overview` | [admin_user_sso_overview](../../shared/api/routers/desktop_admin.py#L706) | `AdminUserSsoOverview` |
| `PATCH` | `/api/v1/desktop/admin/users/{user_id}/ugs-credits` | [admin_set_user_ugs_credits](../../shared/api/routers/desktop_admin.py#L758) | `UserAppAccessGroupResponse` |
| `GET` | `/api/v1/desktop/admin/users/{user_id}/web-search-quota` | [admin_get_user_web_search_quota](../../shared/api/routers/desktop_admin.py#L804) | `WebSearchQuotaStatusResponse` |
| `PATCH` | `/api/v1/desktop/admin/users/{user_id}/web-search-quota` | [admin_patch_user_web_search_quota](../../shared/api/routers/desktop_admin.py#L817) | `WebSearchQuotaStatusResponse` |
| `POST` | `/api/v1/desktop/admin/workers-ops/purge-queue` | [workers_ops_purge_queue](../../shared/api/routers/desktop_admin_workers_ops.py#L93) | `WorkersOpsActionResponse` |
| `POST` | `/api/v1/desktop/admin/workers-ops/revoke` | [workers_ops_revoke](../../shared/api/routers/desktop_admin_workers_ops.py#L65) | `WorkersOpsActionResponse` |
| `GET` | `/api/v1/desktop/admin/workers-ops/snapshot` | [workers_ops_snapshot](../../shared/api/routers/desktop_admin_workers_ops.py#L56) | `dict[str, Any]` |
| `GET` | `/api/v1/desktop/ai-chat/chats` | [list_chats](../../shared/api/routers/desktop_ai_chat_chats_routes.py#L63) | `DesktopAiChatListOut` |
| `POST` | `/api/v1/desktop/ai-chat/chats` | [create_chat](../../shared/api/routers/desktop_ai_chat_chats_routes.py#L84) | `DesktopAiChatOut` |
| `DELETE` | `/api/v1/desktop/ai-chat/chats/{chat_id}` | [delete_chat](../../shared/api/routers/desktop_ai_chat_chats_routes.py#L227) | `None` |
| `GET` | `/api/v1/desktop/ai-chat/chats/{chat_id}` | [get_chat](../../shared/api/routers/desktop_ai_chat_chats_routes.py#L145) | `DesktopAiChatOut` |
| `PATCH` | `/api/v1/desktop/ai-chat/chats/{chat_id}` | [patch_chat](../../shared/api/routers/desktop_ai_chat_chats_routes.py#L163) | `DesktopAiChatOut` |
| `GET` | `/api/v1/desktop/ai-chat/chats/{chat_id}/attachments` | [list_attachments](../../shared/api/routers/desktop_ai_chat_attachments_routes.py#L47) | `DesktopAiAttachmentListOut` |
| `POST` | `/api/v1/desktop/ai-chat/chats/{chat_id}/attachments` | [add_attachment](../../shared/api/routers/desktop_ai_chat_attachments_routes.py#L75) | `DesktopAiAttachmentUpsertOut` |
| `DELETE` | `/api/v1/desktop/ai-chat/chats/{chat_id}/attachments/{attachment_id}` | [remove_attachment](../../shared/api/routers/desktop_ai_chat_attachments_routes.py#L150) | `None` |
| `POST` | `/api/v1/desktop/ai-chat/chats/{chat_id}/discussion/start` | [start_discussion](../../shared/api/routers/desktop_ai_chat_discussion_routes.py#L88) | `DiscussionSessionOut` |
| `GET` | `/api/v1/desktop/ai-chat/chats/{chat_id}/discussion/{session_id}` | [get_discussion](../../shared/api/routers/desktop_ai_chat_discussion_routes.py#L116) | `DiscussionSessionOut` |
| `POST` | `/api/v1/desktop/ai-chat/chats/{chat_id}/discussion/{session_id}/cancel` | [cancel_discussion](../../shared/api/routers/desktop_ai_chat_discussion_routes.py#L260) | `DiscussionSessionOut` |
| `POST` | `/api/v1/desktop/ai-chat/chats/{chat_id}/discussion/{session_id}/continue` | [continue_discussion](../../shared/api/routers/desktop_ai_chat_discussion_routes.py#L217) | `DiscussionSessionOut` |
| `GET` | `/api/v1/desktop/ai-chat/chats/{chat_id}/discussion/{session_id}/events` | [discussion_events](../../shared/api/routers/desktop_ai_chat_discussion_routes.py#L130) | `StreamingResponse` |
| `POST` | `/api/v1/desktop/ai-chat/chats/{chat_id}/discussion/{session_id}/finish` | [finish_discussion](../../shared/api/routers/desktop_ai_chat_discussion_routes.py#L239) | `DiscussionSessionOut` |
| `POST` | `/api/v1/desktop/ai-chat/chats/{chat_id}/discussion/{session_id}/generate-document` | [generate_document](../../shared/api/routers/desktop_ai_chat_discussion_routes.py#L281) | `DiscussionSessionOut` |
| `POST` | `/api/v1/desktop/ai-chat/chats/{chat_id}/discussion/{session_id}/interjections` | [add_interjection](../../shared/api/routers/desktop_ai_chat_discussion_routes.py#L192) | `DiscussionInterjectionOut` |
| `POST` | `/api/v1/desktop/ai-chat/chats/{chat_id}/discussion/{session_id}/raise-hand` | [raise_hand](../../shared/api/routers/desktop_ai_chat_discussion_routes.py#L171) | `DiscussionSessionOut` |
| `POST` | `/api/v1/desktop/ai-chat/chats/{chat_id}/leave` | [leave_collaborative_chat](../../shared/api/routers/desktop_ai_chat_collaboration_routes.py#L172) | `None` |
| `GET` | `/api/v1/desktop/ai-chat/chats/{chat_id}/members` | [list_chat_members](../../shared/api/routers/desktop_ai_chat_collaboration_routes.py#L97) | `DesktopAiChatMemberListOut` |
| `POST` | `/api/v1/desktop/ai-chat/chats/{chat_id}/members/invite` | [invite_chat_member](../../shared/api/routers/desktop_ai_chat_collaboration_routes.py#L112) | `DesktopAiChatMemberOut` |
| `POST` | `/api/v1/desktop/ai-chat/chats/{chat_id}/members/{target_user_id}/remove` | [remove_chat_member](../../shared/api/routers/desktop_ai_chat_collaboration_routes.py#L149) | `DesktopAiChatMemberOut` |
| `POST` | `/api/v1/desktop/ai-chat/chats/{chat_id}/memory-cells/extract` | [extract_memory_cell](../../shared/api/routers/desktop_ai_chat_memory_routes.py#L114) | `DesktopAiMemoryCellOut` |
| `GET` | `/api/v1/desktop/ai-chat/chats/{chat_id}/messages` | [list_messages](../../shared/api/routers/desktop_ai_chat_messages_routes.py#L53) | `DesktopAiMessageListOut` |
| `DELETE` | `/api/v1/desktop/ai-chat/chats/{chat_id}/messages/{message_id}` | [delete_messages_from_user_message](../../shared/api/routers/desktop_ai_chat_messages_routes.py#L116) | `DesktopAiMessagesDeleteOut` |
| `POST` | `/api/v1/desktop/ai-chat/chats/{chat_id}/solo-slot` | [purchase_solo_slot](../../shared/api/routers/desktop_ai_chat_solo_slot_routes.py#L54) | `DesktopAiChatOut` |
| `POST` | `/api/v1/desktop/ai-chat/chats/{chat_id}/solo-slot/release` | [release_solo_slot](../../shared/api/routers/desktop_ai_chat_solo_slot_routes.py#L89) | `DesktopAiChatOut` |
| `POST` | `/api/v1/desktop/ai-chat/chats/{chat_id}/stream` | [stream_message](../../shared/api/routers/desktop_ai_chat_stream_routes.py#L76) | `StreamingResponse` |
| `DELETE` | `/api/v1/desktop/ai-chat/chats/{chat_id}/stream-lock` | [release_stale_stream_lock](../../shared/api/routers/desktop_ai_chat_stream_routes.py#L247) | `None` |
| `GET` | `/api/v1/desktop/ai-chat/chats/{chat_id}/stream-lock` | [get_stream_lock_status](../../shared/api/routers/desktop_ai_chat_stream_routes.py#L266) | `DesktopAiStreamLockPeekOut` |
| `POST` | `/api/v1/desktop/ai-chat/chats/{chat_id}/stream-lock/release` | [release_stale_stream_lock_post](../../shared/api/routers/desktop_ai_chat_stream_routes.py#L256) | `None` |
| `POST` | `/api/v1/desktop/ai-chat/chats/{chat_id}/verify-context` | [verify_context](../../shared/api/routers/desktop_ai_chat_attachments_routes.py#L174) | `DesktopAiVerifyContextOut` |
| `GET` | `/api/v1/desktop/ai-chat/discussion/participant-profile` | [get_discussion_participant_profile](../../shared/api/routers/desktop_ai_chat_discussion_routes.py#L76) | `DiscussionParticipantProfileOut` |
| `GET` | `/api/v1/desktop/ai-chat/discussion/presets` | [list_discussion_presets](../../shared/api/routers/desktop_ai_chat_discussion_routes.py#L68) | `DiscussionPresetListOut` |
| `GET` | `/api/v1/desktop/ai-chat/effective-settings` | [effective_settings](../../shared/api/routers/desktop_ai_chat_config_routes.py#L38) | `DesktopAiEffectiveSettingsOut` |
| `GET` | `/api/v1/desktop/ai-chat/ensemble-blueprint-commands` | [ensemble_blueprint_commands](../../shared/api/routers/desktop_ai_chat_config_routes.py#L48) | `EnsembleBlueprintCommandsOut` |
| `GET` | `/api/v1/desktop/ai-chat/heroes` | [list_heroes](../../shared/api/routers/desktop_ai_chat_config_routes.py#L73) | `DesktopAiHeroCatalogOut` |
| `GET` | `/api/v1/desktop/ai-chat/invites/pending` | [list_pending_collaboration_invites](../../shared/api/routers/desktop_ai_chat_collaboration_routes.py#L51) | `DesktopAiChatMemberListOut` |
| `POST` | `/api/v1/desktop/ai-chat/invites/{member_id}/accept` | [accept_collaboration_invite](../../shared/api/routers/desktop_ai_chat_collaboration_routes.py#L61) | `DesktopAiChatMemberOut` |
| `POST` | `/api/v1/desktop/ai-chat/invites/{member_id}/decline` | [decline_collaboration_invite](../../shared/api/routers/desktop_ai_chat_collaboration_routes.py#L79) | `DesktopAiChatMemberOut` |
| `GET` | `/api/v1/desktop/ai-chat/me` | [desktop_ai_chat_me](../../shared/api/routers/desktop_ai_chat_messages_routes.py#L45) | `DesktopAiChatMeOut` |
| `GET` | `/api/v1/desktop/ai-chat/memory-cells` | [list_memory_cells](../../shared/api/routers/desktop_ai_chat_memory_routes.py#L43) | `DesktopAiMemoryCellListOut` |
| `DELETE` | `/api/v1/desktop/ai-chat/memory-cells/{cell_id}` | [delete_memory_cell](../../shared/api/routers/desktop_ai_chat_memory_routes.py#L95) | `None` |
| `GET` | `/api/v1/desktop/ai-chat/memory-cells/{cell_id}` | [get_memory_cell](../../shared/api/routers/desktop_ai_chat_memory_routes.py#L55) | `DesktopAiMemoryCellOut` |
| `PATCH` | `/api/v1/desktop/ai-chat/memory-cells/{cell_id}` | [patch_memory_cell](../../shared/api/routers/desktop_ai_chat_memory_routes.py#L70) | `DesktopAiMemoryCellOut` |
| `GET` | `/api/v1/desktop/ai-chat/solo-slot-tariffs` | [solo_slot_tariffs](../../shared/api/routers/desktop_ai_chat_solo_slot_routes.py#L48) | `DesktopAiSoloSlotTariffsOut` |
| `GET` | `/api/v1/desktop/calendar/events` | [get_calendar_events](../../shared/api/routers/desktop_calendar.py#L106) | `list[CalendarEventResponse]` |
| `POST` | `/api/v1/desktop/calendar/events` | [post_calendar_event](../../shared/api/routers/desktop_calendar.py#L124) | `CalendarEventResponse` |
| `DELETE` | `/api/v1/desktop/calendar/events/{event_id}` | [delete_calendar_event_route](../../shared/api/routers/desktop_calendar.py#L169) | `None` |
| `PATCH` | `/api/v1/desktop/calendar/events/{event_id}` | [patch_calendar_event](../../shared/api/routers/desktop_calendar.py#L144) | `CalendarEventResponse` |
| `GET` | `/api/v1/desktop/config` | [get_config](../../shared/api/routers/desktop_shell_config_routes.py#L243) | `DesktopConfigResponse` |
| `PATCH` | `/api/v1/desktop/config` | [update_config](../../shared/api/routers/desktop_shell_config_routes.py#L298) | `DesktopConfigResponse` |
| `POST` | `/api/v1/desktop/config` | [create_config](../../shared/api/routers/desktop_shell_config_routes.py#L260) | `DesktopConfigResponse` |
| `PUT` | `/api/v1/desktop/config` | [replace_config](../../shared/api/routers/desktop_shell_config_routes.py#L347) | `DesktopConfigResponse` |
| `GET` | `/api/v1/desktop/ew-wallet` | [get_ew_wallet](../../shared/api/routers/desktop_store.py#L426) | `EwWalletResponse` |
| `GET` | `/api/v1/desktop/favorites` | [get_dashboard_favorites](../../shared/api/routers/desktop_widgets.py#L374) | `list[DashboardFavoriteResponse]` |
| `POST` | `/api/v1/desktop/favorites` | [create_dashboard_favorite](../../shared/api/routers/desktop_widgets.py#L401) | `DashboardFavoriteResponse` |
| `PATCH` | `/api/v1/desktop/favorites/reorder` | [reorder_dashboard_favorites](../../shared/api/routers/desktop_widgets.py#L439) | `Not annotated` |
| `DELETE` | `/api/v1/desktop/favorites/{favorite_id}` | [delete_dashboard_favorite](../../shared/api/routers/desktop_widgets.py#L469) | `Not annotated` |
| `GET` | `/api/v1/desktop/install-profile` | [get_desktop_install_profile](../../shared/api/routers/desktop_install_profile.py#L71) | `DesktopInstallProfileResponse` |
| `GET` | `/api/v1/desktop/installed` | [get_installed](../../shared/api/routers/desktop_store.py#L590) | `InstalledResponse` |
| `POST` | `/api/v1/desktop/installed` | [install_app](../../shared/api/routers/desktop_store.py#L615) | `Not annotated` |
| `DELETE` | `/api/v1/desktop/installed/{app_id}` | [uninstall_app](../../shared/api/routers/desktop_store.py#L675) | `Not annotated` |
| `GET` | `/api/v1/desktop/items` | [get_items](../../shared/api/routers/desktop_items.py#L396) | `DesktopItemsResponse` |
| `POST` | `/api/v1/desktop/items` | [create_item](../../shared/api/routers/desktop_items.py#L406) | `DesktopItemResponse` |
| `PUT` | `/api/v1/desktop/items` | [replace_items](../../shared/api/routers/desktop_items.py#L692) | `DesktopItemsResponse` |
| `DELETE` | `/api/v1/desktop/items/{item_id}` | [delete_item](../../shared/api/routers/desktop_items.py#L553) | `Not annotated` |
| `PATCH` | `/api/v1/desktop/items/{item_id}` | [update_item](../../shared/api/routers/desktop_items.py#L496) | `DesktopItemResponse` |
| `PUT` | `/api/v1/desktop/items/{item_id}` | [upsert_item](../../shared/api/routers/desktop_items.py#L598) | `DesktopItemResponse` |
| `GET` | `/api/v1/desktop/kirs/client/projects/{project_id}/site` | [get_kirs_client_site_context](../../shared/api/routers/kirs.py#L984) | `KirsClientSiteContext` |
| `POST` | `/api/v1/desktop/kirs/client/projects/{project_id}/site/approval` | [update_kirs_client_site_approval](../../shared/api/routers/kirs.py#L1032) | `KirsClientSiteContext` |
| `GET` | `/api/v1/desktop/kirs/operator-projects` | [list_kirs_operator_projects](../../shared/api/routers/kirs.py#L370) | `list[KirsOperatorProjectRow]` |
| `DELETE` | `/api/v1/desktop/kirs/projects/{project_id}/instance` | [delete_kirs_project_instance](../../shared/api/routers/kirs.py#L548) | `Response` |
| `GET` | `/api/v1/desktop/kirs/projects/{project_id}/instance` | [get_kirs_project_instance](../../shared/api/routers/kirs.py#L428) | `SiteStudioInstanceResponse \| None` |
| `PATCH` | `/api/v1/desktop/kirs/projects/{project_id}/instance` | [update_kirs_project_instance](../../shared/api/routers/kirs.py#L494) | `SiteStudioInstanceResponse` |
| `POST` | `/api/v1/desktop/kirs/projects/{project_id}/instance` | [create_kirs_project_instance](../../shared/api/routers/kirs.py#L447) | `SiteStudioInstanceResponse` |
| `POST` | `/api/v1/desktop/kirs/projects/{project_id}/instance/admin-session` | [kirs_create_admin_session](../../shared/api/routers/kirs.py#L933) | `SiteStudioAdminSessionResponse` |
| `PATCH` | `/api/v1/desktop/kirs/projects/{project_id}/instance/client-access` | [update_kirs_client_access](../../shared/api/routers/kirs.py#L516) | `SiteStudioInstanceResponse` |
| `GET` | `/api/v1/desktop/kirs/projects/{project_id}/instance/domains` | [list_kirs_domain_bindings](../../shared/api/routers/kirs.py#L798) | `list[SiteStudioDomainBindingResponse]` |
| `POST` | `/api/v1/desktop/kirs/projects/{project_id}/instance/domains` | [create_kirs_domain_binding](../../shared/api/routers/kirs.py#L814) | `SiteStudioDomainBindingResponse` |
| `POST` | `/api/v1/desktop/kirs/projects/{project_id}/instance/domains/{binding_id}/activate` | [activate_kirs_domain_binding](../../shared/api/routers/kirs.py#L885) | `SiteStudioDomainBindingResponse` |
| `POST` | `/api/v1/desktop/kirs/projects/{project_id}/instance/domains/{binding_id}/disable` | [disable_kirs_domain_binding](../../shared/api/routers/kirs.py#L909) | `SiteStudioDomainBindingResponse` |
| `POST` | `/api/v1/desktop/kirs/projects/{project_id}/instance/domains/{binding_id}/request-route` | [request_kirs_domain_route](../../shared/api/routers/kirs.py#L861) | `SiteStudioDomainBindingResponse` |
| `POST` | `/api/v1/desktop/kirs/projects/{project_id}/instance/domains/{binding_id}/verify` | [verify_kirs_domain_binding](../../shared/api/routers/kirs.py#L837) | `SiteStudioDomainBindingResponse` |
| `GET` | `/api/v1/desktop/kirs/projects/{project_id}/instance/health` | [kirs_instance_health](../../shared/api/routers/kirs.py#L721) | `SiteStudioHealthResponse` |
| `POST` | `/api/v1/desktop/kirs/projects/{project_id}/instance/jobs/{job_id}/cancel` | [cancel_kirs_lifecycle_job](../../shared/api/routers/kirs.py#L746) | `SiteStudioLifecycleJobResponse` |
| `POST` | `/api/v1/desktop/kirs/projects/{project_id}/instance/jobs/{job_id}/retry` | [retry_kirs_lifecycle_job](../../shared/api/routers/kirs.py#L762) | `SiteStudioActionResponse` |
| `POST` | `/api/v1/desktop/kirs/projects/{project_id}/instance/provision` | [provision_kirs_instance](../../shared/api/routers/kirs.py#L621) | `SiteStudioActionResponse` |
| `POST` | `/api/v1/desktop/kirs/projects/{project_id}/instance/redeploy` | [redeploy_kirs_instance](../../shared/api/routers/kirs.py#L696) | `SiteStudioActionResponse` |
| `POST` | `/api/v1/desktop/kirs/projects/{project_id}/instance/start` | [start_kirs_instance](../../shared/api/routers/kirs.py#L646) | `SiteStudioActionResponse` |
| `POST` | `/api/v1/desktop/kirs/projects/{project_id}/instance/stop` | [stop_kirs_instance](../../shared/api/routers/kirs.py#L671) | `SiteStudioActionResponse` |
| `DELETE` | `/api/v1/desktop/kirs/projects/{project_id}/proxy/{path:path}` | [kirs_proxy_site_studio_request](../../shared/api/routers/kirs.py#L958) | `Response` |
| `GET` | `/api/v1/desktop/kirs/projects/{project_id}/proxy/{path:path}` | [kirs_proxy_site_studio_request](../../shared/api/routers/kirs.py#L958) | `Response` |
| `OPTIONS` | `/api/v1/desktop/kirs/projects/{project_id}/proxy/{path:path}` | [kirs_proxy_site_studio_request](../../shared/api/routers/kirs.py#L958) | `Response` |
| `PATCH` | `/api/v1/desktop/kirs/projects/{project_id}/proxy/{path:path}` | [kirs_proxy_site_studio_request](../../shared/api/routers/kirs.py#L958) | `Response` |
| `POST` | `/api/v1/desktop/kirs/projects/{project_id}/proxy/{path:path}` | [kirs_proxy_site_studio_request](../../shared/api/routers/kirs.py#L958) | `Response` |
| `PUT` | `/api/v1/desktop/kirs/projects/{project_id}/proxy/{path:path}` | [kirs_proxy_site_studio_request](../../shared/api/routers/kirs.py#L958) | `Response` |
| `POST` | `/api/v1/desktop/local-service-proxy-session` | [create_local_service_proxy_session](../../shared/api/routers/desktop_shell_proxy.py#L124) | `Response` |
| `DELETE` | `/api/v1/desktop/local-service-proxy/` | [proxy_local_service_app](../../shared/api/routers/desktop_shell_proxy.py#L161) | `Response` |
| `GET` | `/api/v1/desktop/local-service-proxy/` | [proxy_local_service_app](../../shared/api/routers/desktop_shell_proxy.py#L161) | `Response` |
| `HEAD` | `/api/v1/desktop/local-service-proxy/` | [proxy_local_service_app](../../shared/api/routers/desktop_shell_proxy.py#L161) | `Response` |
| `OPTIONS` | `/api/v1/desktop/local-service-proxy/` | [proxy_local_service_app](../../shared/api/routers/desktop_shell_proxy.py#L161) | `Response` |
| `PATCH` | `/api/v1/desktop/local-service-proxy/` | [proxy_local_service_app](../../shared/api/routers/desktop_shell_proxy.py#L161) | `Response` |
| `POST` | `/api/v1/desktop/local-service-proxy/` | [proxy_local_service_app](../../shared/api/routers/desktop_shell_proxy.py#L161) | `Response` |
| `PUT` | `/api/v1/desktop/local-service-proxy/` | [proxy_local_service_app](../../shared/api/routers/desktop_shell_proxy.py#L161) | `Response` |
| `DELETE` | `/api/v1/desktop/local-service-proxy/{proxied_path:path}` | [proxy_local_service_app](../../shared/api/routers/desktop_shell_proxy.py#L161) | `Response` |
| `GET` | `/api/v1/desktop/local-service-proxy/{proxied_path:path}` | [proxy_local_service_app](../../shared/api/routers/desktop_shell_proxy.py#L161) | `Response` |
| `HEAD` | `/api/v1/desktop/local-service-proxy/{proxied_path:path}` | [proxy_local_service_app](../../shared/api/routers/desktop_shell_proxy.py#L161) | `Response` |
| `OPTIONS` | `/api/v1/desktop/local-service-proxy/{proxied_path:path}` | [proxy_local_service_app](../../shared/api/routers/desktop_shell_proxy.py#L161) | `Response` |
| `PATCH` | `/api/v1/desktop/local-service-proxy/{proxied_path:path}` | [proxy_local_service_app](../../shared/api/routers/desktop_shell_proxy.py#L161) | `Response` |
| `POST` | `/api/v1/desktop/local-service-proxy/{proxied_path:path}` | [proxy_local_service_app](../../shared/api/routers/desktop_shell_proxy.py#L161) | `Response` |
| `PUT` | `/api/v1/desktop/local-service-proxy/{proxied_path:path}` | [proxy_local_service_app](../../shared/api/routers/desktop_shell_proxy.py#L161) | `Response` |
| `GET` | `/api/v1/desktop/poemma/workspace` | [get_poemma_workspace](../../shared/api/routers/poemma.py#L93) | `PoemmaWorkspaceResponse` |
| `PUT` | `/api/v1/desktop/poemma/workspace` | [put_poemma_workspace](../../shared/api/routers/poemma.py#L103) | `PoemmaWorkspaceResponse` |
| `POST` | `/api/v1/desktop/poemma/workspace/import-local-backup` | [import_poemma_local_backup](../../shared/api/routers/poemma.py#L129) | `PoemmaWorkspaceResponse` |
| `PATCH` | `/api/v1/desktop/poemma/workspace/role` | [patch_poemma_workspace_role](../../shared/api/routers/poemma.py#L161) | `PoemmaWorkspaceResponse` |
| `GET` | `/api/v1/desktop/recent-content-feed` | [get_recent_content_feed](../../shared/api/routers/desktop_recents.py#L245) | `DesktopRecentContentFeedResponse` |
| `GET` | `/api/v1/desktop/recent-files` | [get_recent_files](../../shared/api/routers/desktop_recents.py#L230) | `list[DesktopRecentFileRow]` |
| `GET` | `/api/v1/desktop/shell-bootstrap` | [get_desktop_shell_bootstrap](../../shared/api/routers/desktop_shell_bootstrap.py#L61) | `DesktopShellBootstrapResponse` |
| `GET` | `/api/v1/desktop/shell-state` | [get_shell_state](../../shared/api/routers/desktop_shell_state_routes.py#L571) | `DesktopShellStateOut` |
| `PATCH` | `/api/v1/desktop/shell-state` | [patch_shell_state](../../shared/api/routers/desktop_shell_state_routes.py#L599) | `DesktopShellStateOut` |
| `GET` | `/api/v1/desktop/site-manager/ops/audit-events` | [site_manager_ops_audit_events](../../shared/api/routers/site_manager_ops.py#L471) | `list[SiteManagerOpsAuditEventResponse]` |
| `GET` | `/api/v1/desktop/site-manager/ops/dns-outbox` | [site_manager_ops_dns_outbox](../../shared/api/routers/site_manager_ops.py#L364) | `list[SiteManagerOpsDnsOutboxResponse]` |
| `GET` | `/api/v1/desktop/site-manager/ops/dns-outbox/preview` | [site_manager_ops_dns_outbox_preview](../../shared/api/routers/site_manager_ops.py#L374) | `SiteManagerOpsDnsPreviewResponse` |
| `POST` | `/api/v1/desktop/site-manager/ops/dns-outbox/{outbox_id}/mark-applied` | [site_manager_ops_mark_dns_applied](../../shared/api/routers/site_manager_ops.py#L387) | `SiteManagerOpsDnsOutboxResponse` |
| `GET` | `/api/v1/desktop/site-manager/ops/domains` | [site_manager_ops_domains](../../shared/api/routers/site_manager_ops.py#L327) | `list[SiteManagerOpsDomainBindingResponse]` |
| `POST` | `/api/v1/desktop/site-manager/ops/domains/{binding_id}/mark-tls-ready` | [site_manager_ops_mark_tls_ready](../../shared/api/routers/site_manager_ops.py#L402) | `SiteManagerOpsDomainBindingResponse` |
| `GET` | `/api/v1/desktop/site-manager/ops/instances` | [site_manager_ops_instances](../../shared/api/routers/site_manager_ops.py#L337) | `SiteManagerOpsRuntimeInstancesPageResponse` |
| `GET` | `/api/v1/desktop/site-manager/ops/jobs` | [site_manager_ops_jobs](../../shared/api/routers/site_manager_ops.py#L280) | `list[SiteManagerOpsLifecycleJobResponse]` |
| `POST` | `/api/v1/desktop/site-manager/ops/jobs/{job_id}/cancel` | [site_manager_ops_cancel_lifecycle_job](../../shared/api/routers/site_manager_ops.py#L295) | `SiteManagerOpsLifecycleJobResponse` |
| `POST` | `/api/v1/desktop/site-manager/ops/jobs/{job_id}/retry` | [site_manager_ops_retry_lifecycle_job](../../shared/api/routers/site_manager_ops.py#L312) | `SiteManagerOpsActionResponse` |
| `GET` | `/api/v1/desktop/site-manager/ops/kirs/projects/{project_id}/collaboration` | [site_manager_ops_kirs_collaboration](../../shared/api/routers/site_manager_ops.py#L481) | `SiteManagerOpsKirsCollaborationResponse` |
| `PATCH` | `/api/v1/desktop/site-manager/ops/kirs/projects/{project_id}/collaboration` | [site_manager_ops_update_kirs_collaboration](../../shared/api/routers/site_manager_ops.py#L490) | `SiteManagerOpsKirsCollaborationResponse` |
| `GET` | `/api/v1/desktop/site-manager/ops/overview` | [site_manager_ops_overview](../../shared/api/routers/site_manager_ops.py#L272) | `SiteManagerOpsOverviewResponse` |
| `GET` | `/api/v1/desktop/site-manager/ops/reconcile` | [site_manager_ops_reconcile](../../shared/api/routers/site_manager_ops.py#L419) | `SiteManagerOpsReconcileReportResponse` |
| `POST` | `/api/v1/desktop/site-manager/ops/reconcile/{instance_scope}/{instance_id}/mark-failed` | [site_manager_ops_reconcile_mark_failed](../../shared/api/routers/site_manager_ops.py#L430) | `SiteManagerOpsRepairInstanceResponse` |
| `POST` | `/api/v1/desktop/site-manager/ops/smoke/publish` | [site_manager_ops_publish_smoke](../../shared/api/routers/site_manager_ops.py#L456) | `SiteManagerOpsSmokeResponse` |
| `GET` | `/api/v1/desktop/site-manager/ops/templates` | [site_manager_ops_templates](../../shared/api/routers/site_manager_ops.py#L449) | `SiteManagerOpsTemplateRegistryResponse` |
| `POST` | `/api/v1/desktop/site-studio/ai/assist` | [assist_site_studio](../../shared/api/routers/site_studio_ai.py#L340) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/site-studio/ai/assist/stream` | [assist_site_studio_stream](../../shared/api/routers/site_studio_ai.py#L358) | `StreamingResponse` |
| `POST` | `/api/v1/desktop/site-studio/ai/brief/generate` | [generate_site_studio_brief](../../shared/api/routers/site_studio_ai.py#L304) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/site-studio/ai/brief/generate/stream` | [generate_site_studio_brief_stream](../../shared/api/routers/site_studio_ai.py#L322) | `StreamingResponse` |
| `GET` | `/api/v1/desktop/site-studio/ai/catalog` | [get_site_studio_ai_catalog](../../shared/api/routers/site_studio_ai.py#L284) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/site-studio/ai/content/generate` | [generate_site_studio_content_pack](../../shared/api/routers/site_studio_ai.py#L376) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/site-studio/ai/content/generate/stream` | [generate_site_studio_content_pack_stream](../../shared/api/routers/site_studio_ai.py#L394) | `StreamingResponse` |
| `GET` | `/api/v1/desktop/site-studio/ai/drafts` | [get_site_studio_drafts](../../shared/api/routers/site_studio_ai.py#L294) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/site-studio/ai/images/generate/stream` | [generate_site_studio_image_stream](../../shared/api/routers/site_studio_ai.py#L466) | `StreamingResponse` |
| `POST` | `/api/v1/desktop/site-studio/ai/images/save` | [save_site_studio_image_draft](../../shared/api/routers/site_studio_ai.py#L444) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/site-studio/ai/seo/generate` | [generate_site_studio_seo_pack](../../shared/api/routers/site_studio_ai.py#L412) | `dict[str, Any]` |
| `POST` | `/api/v1/desktop/site-studio/ai/seo/generate/stream` | [generate_site_studio_seo_pack_stream](../../shared/api/routers/site_studio_ai.py#L428) | `StreamingResponse` |
| `POST` | `/api/v1/desktop/site-studio/imperorg/launch` | [launch_imperorg_pipeline](../../shared/api/routers/imperorg.py#L105) | `StreamingResponse` |
| `DELETE` | `/api/v1/desktop/site-studio/instance` | [delete_site_studio_instance](../../shared/api/routers/desktop_sites.py#L573) | `Response` |
| `GET` | `/api/v1/desktop/site-studio/instance` | [get_site_studio_instance](../../shared/api/routers/desktop_sites.py#L492) | `SiteStudioInstanceResponse \| None` |
| `PATCH` | `/api/v1/desktop/site-studio/instance` | [update_site_studio_instance](../../shared/api/routers/desktop_sites.py#L551) | `SiteStudioInstanceResponse` |
| `POST` | `/api/v1/desktop/site-studio/instance` | [create_site_studio_instance](../../shared/api/routers/desktop_sites.py#L510) | `SiteStudioInstanceResponse` |
| `POST` | `/api/v1/desktop/site-studio/instance/admin-session` | [create_site_studio_admin_session](../../shared/api/routers/desktop_sites.py#L1000) | `SiteStudioAdminSessionResponse` |
| `GET` | `/api/v1/desktop/site-studio/instance/domains` | [list_site_studio_domain_bindings](../../shared/api/routers/desktop_sites.py#L895) | `list[SiteStudioDomainBindingResponse]` |
| `POST` | `/api/v1/desktop/site-studio/instance/domains` | [create_site_studio_domain_binding](../../shared/api/routers/desktop_sites.py#L905) | `SiteStudioDomainBindingResponse` |
| `POST` | `/api/v1/desktop/site-studio/instance/domains/{binding_id}/activate` | [activate_site_studio_domain_binding](../../shared/api/routers/desktop_sites.py#L962) | `SiteStudioDomainBindingResponse` |
| `POST` | `/api/v1/desktop/site-studio/instance/domains/{binding_id}/disable` | [disable_site_studio_domain_binding](../../shared/api/routers/desktop_sites.py#L981) | `SiteStudioDomainBindingResponse` |
| `POST` | `/api/v1/desktop/site-studio/instance/domains/{binding_id}/request-route` | [request_site_studio_domain_route](../../shared/api/routers/desktop_sites.py#L943) | `SiteStudioDomainBindingResponse` |
| `POST` | `/api/v1/desktop/site-studio/instance/domains/{binding_id}/verify` | [verify_site_studio_domain_binding](../../shared/api/routers/desktop_sites.py#L924) | `SiteStudioDomainBindingResponse` |
| `GET` | `/api/v1/desktop/site-studio/instance/health` | [get_site_studio_health](../../shared/api/routers/desktop_sites.py#L800) | `SiteStudioHealthResponse` |
| `POST` | `/api/v1/desktop/site-studio/instance/jobs/{job_id}/cancel` | [cancel_site_studio_lifecycle_job](../../shared/api/routers/desktop_sites.py#L824) | `SiteStudioLifecycleJobResponse` |
| `POST` | `/api/v1/desktop/site-studio/instance/jobs/{job_id}/retry` | [retry_site_studio_lifecycle_job](../../shared/api/routers/desktop_sites.py#L838) | `SiteStudioActionResponse` |
| `POST` | `/api/v1/desktop/site-studio/instance/provision` | [provision_site_studio_instance](../../shared/api/routers/desktop_sites.py#L684) | `SiteStudioActionResponse` |
| `POST` | `/api/v1/desktop/site-studio/instance/publish` | [publish_site_studio_instance](../../shared/api/routers/desktop_sites.py#L640) | `SiteStudioInstanceResponse` |
| `POST` | `/api/v1/desktop/site-studio/instance/redeploy` | [redeploy_site_studio_instance](../../shared/api/routers/desktop_sites.py#L771) | `SiteStudioActionResponse` |
| `POST` | `/api/v1/desktop/site-studio/instance/start` | [start_site_studio_instance](../../shared/api/routers/desktop_sites.py#L713) | `SiteStudioActionResponse` |
| `POST` | `/api/v1/desktop/site-studio/instance/stop` | [stop_site_studio_instance](../../shared/api/routers/desktop_sites.py#L742) | `SiteStudioActionResponse` |
| `POST` | `/api/v1/desktop/site-studio/instance/unpublish` | [unpublish_site_studio_instance](../../shared/api/routers/desktop_sites.py#L662) | `SiteStudioInstanceResponse` |
| `DELETE` | `/api/v1/desktop/site-studio/proxy/{path:path}` | [proxy_site_studio_request](../../shared/api/routers/desktop_sites.py#L1025) | `Response` |
| `GET` | `/api/v1/desktop/site-studio/proxy/{path:path}` | [proxy_site_studio_request](../../shared/api/routers/desktop_sites.py#L1025) | `Response` |
| `OPTIONS` | `/api/v1/desktop/site-studio/proxy/{path:path}` | [proxy_site_studio_request](../../shared/api/routers/desktop_sites.py#L1025) | `Response` |
| `PATCH` | `/api/v1/desktop/site-studio/proxy/{path:path}` | [proxy_site_studio_request](../../shared/api/routers/desktop_sites.py#L1025) | `Response` |
| `POST` | `/api/v1/desktop/site-studio/proxy/{path:path}` | [proxy_site_studio_request](../../shared/api/routers/desktop_sites.py#L1025) | `Response` |
| `PUT` | `/api/v1/desktop/site-studio/proxy/{path:path}` | [proxy_site_studio_request](../../shared/api/routers/desktop_sites.py#L1025) | `Response` |
| `GET` | `/api/v1/desktop/store` | [get_store](../../shared/api/routers/desktop_store.py#L440) | `StoreResponse` |
| `GET` | `/api/v1/desktop/store/{app_id}` | [get_store_app](../../shared/api/routers/desktop_store.py#L512) | `StoreAppDetailResponse` |
| `GET` | `/api/v1/desktop/widget-notes` | [get_widget_notes](../../shared/api/routers/desktop_widgets.py#L89) | `list[WidgetNoteResponse]` |
| `POST` | `/api/v1/desktop/widget-notes` | [create_widget_note](../../shared/api/routers/desktop_widgets.py#L112) | `WidgetNoteResponse` |
| `DELETE` | `/api/v1/desktop/widget-notes/{note_id}` | [delete_widget_note](../../shared/api/routers/desktop_widgets.py#L177) | `Not annotated` |
| `PATCH` | `/api/v1/desktop/widget-notes/{note_id}` | [update_widget_note](../../shared/api/routers/desktop_widgets.py#L141) | `WidgetNoteResponse` |
| `POST` | `/api/v1/desktop/widget-sync` | [sync_desktop_widgets](../../shared/api/routers/desktop_widgets.py#L491) | `WidgetSyncResponse` |
| `GET` | `/api/v1/desktop/widget-todos` | [get_widget_todos](../../shared/api/routers/desktop_widgets.py#L235) | `list[WidgetTodoResponse]` |
| `POST` | `/api/v1/desktop/widget-todos` | [create_widget_todo](../../shared/api/routers/desktop_widgets.py#L258) | `WidgetTodoResponse` |
| `DELETE` | `/api/v1/desktop/widget-todos/{todo_id}` | [delete_widget_todo](../../shared/api/routers/desktop_widgets.py#L323) | `Not annotated` |
| `PATCH` | `/api/v1/desktop/widget-todos/{todo_id}` | [update_widget_todo](../../shared/api/routers/desktop_widgets.py#L287) | `WidgetTodoResponse` |

## /api/v1/desktop-client

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `POST` | `/api/v1/desktop-client/activation/consume` | [consume_activation](../../shared/api/routers/desktop_client/activation.py#L39) | `CapsuleActivationConsumeResponse` |
| `WEBSOCKET` | `/api/v1/desktop-client/air-enroll/ws` | [air_enroll_websocket](../../shared/api/routers/desktop_client/air_enroll.py#L132) | `None` |
| `POST` | `/api/v1/desktop-client/auth/challenge` | [auth_challenge](../../shared/api/routers/desktop_client/auth_binding.py#L84) | `AuthChallengeResponse` |
| `POST` | `/api/v1/desktop-client/auth/internal/commit` | [auth_internal_commit](../../shared/api/routers/desktop_client/auth_binding.py#L156) | `AuthCommitResponse` |
| `POST` | `/api/v1/desktop-client/auth/internal/precheck` | [auth_internal_precheck](../../shared/api/routers/desktop_client/auth_binding.py#L131) | `AuthPrecheckResponse` |
| `POST` | `/api/v1/desktop-client/auth/internal/refresh-decision` | [auth_internal_refresh_decision](../../shared/api/routers/desktop_client/auth_binding.py#L183) | `AuthRefreshDecisionResponse` |
| `POST` | `/api/v1/desktop-client/auth/ticket` | [auth_ticket_issue](../../shared/api/routers/desktop_client/auth_binding.py#L100) | `AuthTicketIssueResponse` |
| `POST` | `/api/v1/desktop-client/devices/challenge` | [device_challenge](../../shared/api/routers/desktop_client/devices.py#L64) | `DeviceChallengeResponse` |
| `POST` | `/api/v1/desktop-client/devices/prove` | [device_prove](../../shared/api/routers/desktop_client/devices.py#L76) | `DeviceProveResponse` |
| `POST` | `/api/v1/desktop-client/devices/revoke` | [revoke_device](../../shared/api/routers/desktop_client/devices.py#L102) | `OpsAckResponse` |
| `POST` | `/api/v1/desktop-client/license/heartbeat` | [heartbeat_license](../../shared/api/routers/desktop_client/license.py#L191) | `LicenseHeartbeatResponse` |
| `POST` | `/api/v1/desktop-client/license/issue` | [issue_license](../../shared/api/routers/desktop_client/license.py#L217) | `LicenseIssueResponse` |
| `POST` | `/api/v1/desktop-client/license/preflight` | [preflight_license](../../shared/api/routers/desktop_client/license.py#L164) | `LicensePreflightResponse` |
| `POST` | `/api/v1/desktop-client/license/redeem` | [redeem_license](../../shared/api/routers/desktop_client/license.py#L122) | `LicenseRedeemResponse` |
| `POST` | `/api/v1/desktop-client/license/revoke` | [revoke_license](../../shared/api/routers/desktop_client/license.py#L239) | `OpsAckResponse` |
| `GET` | `/api/v1/desktop-client/licenses/{license_id}` | [get_license_capabilities](../../shared/api/routers/desktop_client/license.py#L258) | `LicenseCapabilitiesResponse` |
| `PATCH` | `/api/v1/desktop-client/licenses/{license_id}` | [patch_license_capabilities](../../shared/api/routers/desktop_client/license.py#L275) | `LicenseCapabilitiesResponse` |
| `GET` | `/api/v1/desktop-client/portal-peers` | [list_portal_peers](../../shared/api/routers/desktop_client/portal_peers.py#L94) | `PortalPeerListResponse` |
| `POST` | `/api/v1/desktop-client/portal-peers` | [create_portal_peer](../../shared/api/routers/desktop_client/portal_peers.py#L104) | `PortalPeerCreateResponse` |
| `POST` | `/api/v1/desktop-client/portal-peers/import` | [import_portal_peers_manifest](../../shared/api/routers/desktop_client/portal_peers.py#L132) | `PortalPeerManifestImportResponse` |
| `POST` | `/api/v1/desktop-client/portal-peers/sync` | [sync_portal_peers](../../shared/api/routers/desktop_client/portal_peers.py#L188) | `PortalPeerSyncResponse` |
| `POST` | `/api/v1/desktop-client/portal-peers/{peer_id}/revoke` | [revoke_portal_peer](../../shared/api/routers/desktop_client/portal_peers.py#L161) | `PortalPeerViewResponse` |
| `POST` | `/api/v1/desktop-client/runtime/presence` | [report_runtime_presence](../../shared/api/routers/desktop_client/runtime.py#L45) | `RuntimePresenceReportResponse` |
| `POST` | `/api/v1/desktop-client/seats/issue` | [issue_seat](../../shared/api/routers/desktop_client/seats.py#L63) | `SeatIssueResponse` |
| `POST` | `/api/v1/desktop-client/session/assert` | [assert_desktop_session](../../shared/api/routers/desktop_client/license.py#L311) | `SessionAssertResponse` |

## /api/v1/diagnostics

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `POST` | `/api/v1/diagnostics/quick-check` | [quick_check](../../shared/api/routers/diagnostics.py#L36) | `dict[str, Any]` |
| `GET` | `/api/v1/diagnostics/reports` | [list_reports](../../shared/api/routers/diagnostics.py#L93) | `dict[str, Any]` |
| `POST` | `/api/v1/diagnostics/run` | [run_diagnostics](../../shared/api/routers/diagnostics.py#L62) | `dict[str, Any]` |

## /api/v1/doc-editor

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `POST` | `/api/v1/doc-editor/ai/analyze` | [ai_analyze_document](../../shared/api/routers/doc_editor.py#L3099) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/ai/complete` | [ai_complete](../../shared/api/routers/doc_editor.py#L3004) | `None` |
| `POST` | `/api/v1/doc-editor/ai/image` | [generate_image](../../shared/api/routers/doc_editor.py#L3140) | `dict[str, Any]` |
| `GET` | `/api/v1/doc-editor/ai/image/view` | [proxy_comfyui_image](../../shared/api/routers/doc_editor.py#L3235) | `StreamingResponse` |
| `GET` | `/api/v1/doc-editor/ai/image/{job_id}/status` | [check_image_status](../../shared/api/routers/doc_editor.py#L3183) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/ai/pre-insert-check` | [ai_pre_insert_check](../../shared/api/routers/doc_editor.py#L2985) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/chart/generate` | [generate_chart](../../shared/api/routers/doc_editor.py#L3997) | `dict[str, Any]` |
| `WEBSOCKET` | `/api/v1/doc-editor/collaboration/{document_id}` | [yjs_collaboration_websocket](../../shared/api/routers/doc_editor.py#L4062) | `None` |
| `POST` | `/api/v1/doc-editor/convert` | [convert_document](../../shared/api/routers/doc_editor.py#L3525) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/convert/batch` | [batch_convert_documents](../../shared/api/routers/doc_editor.py#L3738) | `dict[str, Any]` |
| `DELETE` | `/api/v1/doc-editor/convert/cache` | [invalidate_conversion_cache](../../shared/api/routers/doc_editor.py#L3864) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/convert/detect` | [detect_file_format](../../shared/api/routers/doc_editor.py#L3707) | `dict[str, Any]` |
| `GET` | `/api/v1/doc-editor/convert/formats` | [get_supported_formats](../../shared/api/routers/doc_editor.py#L3687) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/convert/upload` | [convert_uploaded_file](../../shared/api/routers/doc_editor.py#L3621) | `dict[str, Any]` |
| `GET` | `/api/v1/doc-editor/documents` | [list_documents](../../shared/api/routers/doc_editor.py#L586) | `DocumentListResponse` |
| `POST` | `/api/v1/doc-editor/documents` | [create_document](../../shared/api/routers/doc_editor.py#L548) | `DocumentResponse` |
| `DELETE` | `/api/v1/doc-editor/documents/{document_id}` | [delete_document](../../shared/api/routers/doc_editor.py#L771) | `None` |
| `GET` | `/api/v1/doc-editor/documents/{document_id}` | [get_document](../../shared/api/routers/doc_editor.py#L663) | `DocumentResponse` |
| `PUT` | `/api/v1/doc-editor/documents/{document_id}` | [update_document](../../shared/api/routers/doc_editor.py#L700) | `DocumentResponse` |
| `GET` | `/api/v1/doc-editor/documents/{document_id}/comments` | [list_document_comments](../../shared/api/routers/doc_editor.py#L1295) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/documents/{document_id}/comments/threads` | [create_comment_thread](../../shared/api/routers/doc_editor.py#L1452) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/documents/{document_id}/comments/threads/bulk-reopen` | [reopen_comment_threads_bulk](../../shared/api/routers/doc_editor.py#L1678) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/documents/{document_id}/comments/threads/bulk-resolve` | [resolve_comment_threads_bulk](../../shared/api/routers/doc_editor.py#L1630) | `dict[str, Any]` |
| `PATCH` | `/api/v1/doc-editor/documents/{document_id}/comments/threads/{thread_id}/assign` | [assign_comment_thread_reviewer](../../shared/api/routers/doc_editor.py#L1745) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/documents/{document_id}/comments/threads/{thread_id}/comments` | [add_comment](../../shared/api/routers/doc_editor.py#L1494) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/documents/{document_id}/comments/threads/{thread_id}/follow` | [follow_comment_thread](../../shared/api/routers/doc_editor.py#L1848) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/documents/{document_id}/comments/threads/{thread_id}/mark-read` | [mark_comment_thread_read](../../shared/api/routers/doc_editor.py#L1886) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/documents/{document_id}/comments/threads/{thread_id}/pin` | [pin_comment_thread](../../shared/api/routers/doc_editor.py#L1794) | `dict[str, Any]` |
| `PATCH` | `/api/v1/doc-editor/documents/{document_id}/comments/threads/{thread_id}/reopen` | [reopen_comment_thread](../../shared/api/routers/doc_editor.py#L1593) | `dict[str, str]` |
| `PATCH` | `/api/v1/doc-editor/documents/{document_id}/comments/threads/{thread_id}/resolve` | [resolve_comment_thread](../../shared/api/routers/doc_editor.py#L1556) | `dict[str, str]` |
| `POST` | `/api/v1/doc-editor/documents/{document_id}/comments/threads/{thread_id}/unfollow` | [unfollow_comment_thread](../../shared/api/routers/doc_editor.py#L1867) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/documents/{document_id}/comments/threads/{thread_id}/unpin` | [unpin_comment_thread](../../shared/api/routers/doc_editor.py#L1821) | `dict[str, Any]` |
| `DELETE` | `/api/v1/doc-editor/documents/{document_id}/draft` | [discard_server_draft](../../shared/api/routers/doc_editor.py#L869) | `dict[str, Any]` |
| `GET` | `/api/v1/doc-editor/documents/{document_id}/draft` | [get_server_draft](../../shared/api/routers/doc_editor.py#L812) | `dict[str, Any]` |
| `PUT` | `/api/v1/doc-editor/documents/{document_id}/draft` | [upsert_server_draft](../../shared/api/routers/doc_editor.py#L829) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/documents/{document_id}/draft/publish` | [publish_server_draft](../../shared/api/routers/doc_editor.py#L886) | `DocumentResponse` |
| `GET` | `/api/v1/doc-editor/documents/{document_id}/invites` | [list_document_invites](../../shared/api/routers/doc_editor.py#L2824) | `list[dict[str, Any]]` |
| `POST` | `/api/v1/doc-editor/documents/{document_id}/invites` | [create_collaboration_invite](../../shared/api/routers/doc_editor.py#L2780) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/documents/{document_id}/restore/{version_number}` | [restore_version](../../shared/api/routers/doc_editor.py#L2938) | `DocumentResponse` |
| `GET` | `/api/v1/doc-editor/documents/{document_id}/versions` | [get_versions](../../shared/api/routers/doc_editor.py#L2908) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/export/{document_id}` | [export_document](../../shared/api/routers/doc_editor.py#L3344) | `StreamingResponse` |
| `GET` | `/api/v1/doc-editor/health` | [health_check](../../shared/api/routers/doc_editor.py#L4032) | `dict[str, Any]` |
| `GET` | `/api/v1/doc-editor/invites` | [list_my_pending_invites](../../shared/api/routers/doc_editor.py#L2838) | `list[dict[str, Any]]` |
| `DELETE` | `/api/v1/doc-editor/invites/{invite_id}` | [revoke_collaboration_invite](../../shared/api/routers/doc_editor.py#L2886) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/invites/{invite_id}/accept` | [accept_collaboration_invite](../../shared/api/routers/doc_editor.py#L2851) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/invites/{invite_id}/decline` | [decline_collaboration_invite](../../shared/api/routers/doc_editor.py#L2869) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/ocr` | [perform_ocr](../../shared/api/routers/doc_editor.py#L3916) | `dict[str, Any]` |
| `GET` | `/api/v1/doc-editor/plugins` | [list_doc_editor_plugins](../../shared/api/routers/doc_editor.py#L2301) | `dict[str, Any]` |
| `GET` | `/api/v1/doc-editor/plugins/admin` | [list_doc_editor_plugins_admin](../../shared/api/routers/doc_editor.py#L2375) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/plugins/admin` | [create_doc_editor_plugin_admin](../../shared/api/routers/doc_editor.py#L2440) | `dict[str, Any]` |
| `DELETE` | `/api/v1/doc-editor/plugins/admin/{plugin_id}` | [disable_doc_editor_plugin_admin](../../shared/api/routers/doc_editor.py#L2689) | `dict[str, Any]` |
| `PATCH` | `/api/v1/doc-editor/plugins/admin/{plugin_id}` | [update_doc_editor_plugin_admin](../../shared/api/routers/doc_editor.py#L2566) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/plugins/admin/{plugin_id}/enable` | [enable_doc_editor_plugin_admin](../../shared/api/routers/doc_editor.py#L2727) | `dict[str, Any]` |
| `DELETE` | `/api/v1/doc-editor/plugins/{plugin_id}/install` | [uninstall_doc_editor_plugin](../../shared/api/routers/doc_editor.py#L2348) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/plugins/{plugin_id}/install` | [install_doc_editor_plugin](../../shared/api/routers/doc_editor.py#L2323) | `dict[str, Any]` |
| `GET` | `/api/v1/doc-editor/prompts` | [list_prompts](../../shared/api/routers/doc_editor.py#L3469) | `list[PromptResponse]` |
| `POST` | `/api/v1/doc-editor/prompts` | [save_prompt](../../shared/api/routers/doc_editor.py#L3442) | `PromptResponse` |
| `DELETE` | `/api/v1/doc-editor/prompts/{prompt_id}` | [delete_prompt](../../shared/api/routers/doc_editor.py#L3497) | `None` |
| `GET` | `/api/v1/doc-editor/search` | [search_documents](../../shared/api/routers/doc_editor.py#L3409) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/table/insert` | [insert_table](../../shared/api/routers/doc_editor.py#L3962) | `dict[str, Any]` |
| `GET` | `/api/v1/doc-editor/templates` | [list_doc_editor_templates](../../shared/api/routers/doc_editor.py#L1978) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/templates/preflight` | [preflight_doc_editor_template_apply](../../shared/api/routers/doc_editor.py#L1992) | `dict[str, Any]` |
| `POST` | `/api/v1/doc-editor/upload` | [upload_document](../../shared/api/routers/doc_editor.py#L3283) | `dict[str, Any]` |

## /api/v1/doc-editor-v2

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/doc-editor-v2/capabilities` | [doc_editor_v2_capabilities](../../shared/api/routers/doc_editor_v2.py#L104) | `DocEditorV2CapabilitiesResponse` |
| `POST` | `/api/v1/doc-editor-v2/documents` | [create_doc_editor_v2_document](../../shared/api/routers/doc_editor_v2.py#L115) | `DocEditorV2DocumentResponse` |
| `GET` | `/api/v1/doc-editor-v2/documents/{document_id}` | [get_doc_editor_v2_document](../../shared/api/routers/doc_editor_v2.py#L129) | `DocEditorV2DocumentResponse` |
| `PUT` | `/api/v1/doc-editor-v2/documents/{document_id}` | [update_doc_editor_v2_document](../../shared/api/routers/doc_editor_v2.py#L143) | `DocEditorV2DocumentResponse` |
| `GET` | `/api/v1/doc-editor-v2/documents/{document_id}/collaboration` | [get_doc_editor_v2_collaboration_state](../../shared/api/routers/doc_editor_v2.py#L278) | `DocEditorV2CollaborationStateResponse` |
| `PUT` | `/api/v1/doc-editor-v2/documents/{document_id}/collaboration/snapshot` | [put_doc_editor_v2_collaboration_snapshot](../../shared/api/routers/doc_editor_v2.py#L295) | `DocEditorV2CollaborationSnapshotResponse` |
| `DELETE` | `/api/v1/doc-editor-v2/documents/{document_id}/draft` | [delete_doc_editor_v2_draft](../../shared/api/routers/doc_editor_v2.py#L187) | `DocEditorV2DraftResponse` |
| `GET` | `/api/v1/doc-editor-v2/documents/{document_id}/draft` | [get_doc_editor_v2_draft](../../shared/api/routers/doc_editor_v2.py#L158) | `DocEditorV2DraftResponse` |
| `PUT` | `/api/v1/doc-editor-v2/documents/{document_id}/draft` | [put_doc_editor_v2_draft](../../shared/api/routers/doc_editor_v2.py#L172) | `DocEditorV2DraftResponse` |
| `POST` | `/api/v1/doc-editor-v2/documents/{document_id}/ewa/suggest` | [create_doc_editor_v2_ewa_suggestion](../../shared/api/routers/doc_editor_v2.py#L244) | `DocEditorV2SuggestionResponse` |
| `POST` | `/api/v1/doc-editor-v2/documents/{document_id}/export` | [export_doc_editor_v2_document](../../shared/api/routers/doc_editor_v2.py#L215) | `DocEditorV2ExportResponse` |
| `GET` | `/api/v1/doc-editor-v2/documents/{document_id}/structure` | [get_doc_editor_v2_structure](../../shared/api/routers/doc_editor_v2.py#L230) | `DocEditorV2StructureResponse` |
| `POST` | `/api/v1/doc-editor-v2/documents/{document_id}/suggestions/{suggestion_id}/apply` | [apply_doc_editor_v2_ewa_suggestion](../../shared/api/routers/doc_editor_v2.py#L262) | `DocEditorV2SuggestionApplyResponse` |
| `GET` | `/api/v1/doc-editor-v2/health` | [doc_editor_v2_health](../../shared/api/routers/doc_editor_v2.py#L97) | `DocEditorV2HealthResponse` |
| `POST` | `/api/v1/doc-editor-v2/import` | [import_doc_editor_v2_document](../../shared/api/routers/doc_editor_v2.py#L201) | `DocEditorV2ImportResponse` |

## /api/v1/ebrowser

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/ebrowser/admin/users/{target_user_id}/policy` | [admin_get_ebrowser_policy](../../shared/api/routers/ebrowser.py#L78) | `EBrowserPolicyResponse` |
| `PUT` | `/api/v1/ebrowser/admin/users/{target_user_id}/policy` | [admin_put_ebrowser_policy](../../shared/api/routers/ebrowser.py#L93) | `EBrowserPolicyResponse` |
| `GET` | `/api/v1/ebrowser/policy` | [get_own_ebrowser_policy](../../shared/api/routers/ebrowser.py#L66) | `EBrowserPolicyResponse` |

## /api/v1/elite-editor

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `POST` | `/api/v1/elite-editor/ai/analyze` | [analyze_with_ai](../../shared/api/routers/elite_editor.py#L1229) | `dict[str, Any]` |
| `POST` | `/api/v1/elite-editor/ai/speech-to-text` | [speech_to_text](../../shared/api/routers/elite_editor.py#L1278) | `dict[str, Any]` |
| `GET` | `/api/v1/elite-editor/analytics/stats` | [get_analytics_stats](../../shared/api/routers/elite_editor.py#L1314) | `dict[str, Any]` |
| `POST` | `/api/v1/elite-editor/convert` | [convert_document](../../shared/api/routers/elite_editor.py#L1150) | `dict[str, Any]` |
| `GET` | `/api/v1/elite-editor/documents` | [list_documents](../../shared/api/routers/elite_editor.py#L546) | `list[DocumentResponse]` |
| `POST` | `/api/v1/elite-editor/documents` | [create_document](../../shared/api/routers/elite_editor.py#L515) | `DocumentResponse` |
| `DELETE` | `/api/v1/elite-editor/documents/{document_id}` | [delete_document](../../shared/api/routers/elite_editor.py#L636) | `dict[str, Any]` |
| `GET` | `/api/v1/elite-editor/documents/{document_id}` | [get_document](../../shared/api/routers/elite_editor.py#L579) | `DocumentResponse` |
| `PATCH` | `/api/v1/elite-editor/documents/{document_id}` | [update_document](../../shared/api/routers/elite_editor.py#L600) | `DocumentResponse` |
| `POST` | `/api/v1/elite-editor/documents/{document_id}/ai-fill` | [ai_fill_document_fields](../../shared/api/routers/elite_editor.py#L807) | `AIFillResponse` |
| `GET` | `/api/v1/elite-editor/documents/{document_id}/export` | [export_document_get](../../shared/api/routers/elite_editor.py#L899) | `Not annotated` |
| `GET` | `/api/v1/elite-editor/documents/{document_id}/fields` | [get_document_fillable_fields](../../shared/api/routers/elite_editor.py#L760) | `list[FieldInfo]` |
| `POST` | `/api/v1/elite-editor/documents/{document_id}/revert-to-original` | [revert_to_original](../../shared/api/routers/elite_editor.py#L1405) | `DocumentResponse` |
| `GET` | `/api/v1/elite-editor/documents/{document_id}/revisions` | [get_document_revisions](../../shared/api/routers/elite_editor.py#L704) | `list[RevisionResponse]` |
| `POST` | `/api/v1/elite-editor/documents/{document_id}/revisions/{revision_number}/restore` | [restore_document_revision](../../shared/api/routers/elite_editor.py#L730) | `DocumentResponse` |
| `PUT` | `/api/v1/elite-editor/documents/{document_id}/tables/{table_index}` | [update_document_table](../../shared/api/routers/elite_editor.py#L662) | `DocumentResponse` |
| `POST` | `/api/v1/elite-editor/export` | [export_document](../../shared/api/routers/elite_editor.py#L1105) | `FileResponse` |
| `GET` | `/api/v1/elite-editor/health` | [health_check](../../shared/api/routers/elite_editor.py#L333) | `dict[str, Any]` |
| `GET` | `/api/v1/elite-editor/integrations/minio/list` | [list_minio_documents](../../shared/api/routers/elite_editor.py#L1369) | `dict[str, list[MinioDocumentResponse]]` |
| `POST` | `/api/v1/elite-editor/integrations/paperless/import/{paperless_id}` | [import_from_paperless](../../shared/api/routers/elite_editor.py#L1338) | `DocumentResponse` |
| `GET` | `/api/v1/elite-editor/models` | [get_available_models](../../shared/api/routers/elite_editor.py#L1494) | `dict[str, Any]` |
| `POST` | `/api/v1/elite-editor/ocr` | [perform_ocr](../../shared/api/routers/elite_editor.py#L1191) | `dict[str, Any]` |
| `POST` | `/api/v1/elite-editor/process` | [process_document](../../shared/api/routers/elite_editor.py#L376) | `ProcessedDocumentResponse` |
| `POST` | `/api/v1/elite-editor/search` | [search_documents](../../shared/api/routers/elite_editor.py#L859) | `dict[str, Any]` |
| `GET` | `/api/v1/elite-editor/services/status` | [get_services_status](../../shared/api/routers/elite_editor.py#L358) | `dict[str, Any]` |
| `POST` | `/api/v1/elite-editor/upload` | [upload_document_file](../../shared/api/routers/elite_editor.py#L460) | `ProcessedDocumentResponse` |

## /api/v1/ewa

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/ewa/admin/companion/chat-workflows` | [list_companion_chat_workflows](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L511) | `CompanionChatWorkflowListOut` |
| `GET` | `/api/v1/ewa/admin/companion/prompt-blocks` | [list_companion_prompt_blocks](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L694) | `CompanionPromptBlockListOut` |
| `GET` | `/api/v1/ewa/admin/companion/prompt-blocks/audit` | [list_companion_prompt_block_audit](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L734) | `CompanionPromptBlockAuditListOut` |
| `PUT` | `/api/v1/ewa/admin/companion/prompt-blocks/{block_key}` | [update_companion_prompt_block](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L749) | `CompanionPromptBlockOut` |
| `GET` | `/api/v1/ewa/admin/companion/settings` | [list_companion_platform_settings](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L597) | `CompanionPlatformSettingsListOut` |
| `GET` | `/api/v1/ewa/admin/companion/settings/audit` | [list_companion_platform_settings_audit](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L642) | `CompanionPlatformSettingAuditListOut` |
| `PUT` | `/api/v1/ewa/admin/companion/settings/{setting_key}` | [update_companion_platform_setting](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L667) | `CompanionPlatformSettingOut` |
| `GET` | `/api/v1/ewa/admin/companion/status` | [companion_admin_status](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L288) | `CompanionAdminStatusOut` |
| `GET` | `/api/v1/ewa/admin/companion/task-runs` | [list_companion_admin_task_runs](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L521) | `CompanionTaskRunsOut` |
| `GET` | `/api/v1/ewa/admin/companion/task-runs/{run_id}` | [get_companion_admin_task_run](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L552) | `CompanionTaskRunOut` |
| `GET` | `/api/v1/ewa/admin/companion/tools` | [list_companion_tools](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L301) | `CompanionToolCatalogOut` |
| `GET` | `/api/v1/ewa/admin/companion/users` | [list_companion_admin_users](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L780) | `CompanionAdminUserListOut` |
| `GET` | `/api/v1/ewa/admin/companion/users/{principal_id}` | [get_companion_admin_user](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L796) | `CompanionAdminUserDetailOut` |
| `PATCH` | `/api/v1/ewa/admin/companion/users/{principal_id}` | [patch_companion_admin_user](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L847) | `CompanionAdminUserDetailOut` |
| `POST` | `/api/v1/ewa/admin/companion/users/{principal_id}/audit-note` | [post_companion_admin_user_audit_note](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L883) | `CompanionAdminUserDetailOut` |
| `POST` | `/api/v1/ewa/admin/companion/users/{principal_id}/clear-namespace` | [clear_companion_admin_user_namespace](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L912) | `CompanionAdminUserDetailOut` |
| `GET` | `/api/v1/ewa/admin/companion/users/{principal_id}/timeline` | [get_companion_admin_user_timeline](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L816) | `CompanionAdminUserTimelineOut` |
| `GET` | `/api/v1/ewa/admin/companion/users/{principal_id}/transcript` | [get_companion_admin_user_transcript](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L829) | `CompanionAdminUserTranscriptOut` |
| `POST` | `/api/v1/ewa/admin/companion/users/{principal_id}/wipe` | [wipe_companion_admin_user](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L957) | `CompanionAdminUserWipeOut` |
| `GET` | `/api/v1/ewa/admin/companion/workflows` | [list_companion_workflows](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L327) | `CompanionWorkflowListOut` |
| `POST` | `/api/v1/ewa/admin/companion/workflows` | [create_companion_workflow_version](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L364) | `CompanionWorkflowDetailOut` |
| `POST` | `/api/v1/ewa/admin/companion/workflows/validate` | [validate_companion_workflow](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L353) | `CompanionWorkflowValidateResponseV1` |
| `GET` | `/api/v1/ewa/admin/companion/workflows/{workflow_id}` | [get_companion_workflow](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L340) | `CompanionWorkflowDetailOut` |
| `GET` | `/api/v1/ewa/admin/companion/workflows/{workflow_id}/audit` | [list_companion_workflow_audit](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L489) | `CompanionWorkflowAuditListOut` |
| `PUT` | `/api/v1/ewa/admin/companion/workflows/{workflow_id}/disable` | [disable_companion_workflow](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L452) | `CompanionWorkflowDetailOut` |
| `PUT` | `/api/v1/ewa/admin/companion/workflows/{workflow_id}/enable` | [enable_companion_workflow_version](../../shared/api/ewa_platform/gateways/routers/companion_admin.py#L408) | `CompanionWorkflowDetailOut` |
| `POST` | `/api/v1/ewa/agentic/sessions` | [create_agentic_session](../../shared/api/ewa_platform/gateways/routers/agentic_sessions.py#L79) | `AgenticSessionCreateOut` |
| `GET` | `/api/v1/ewa/agentic/sessions/{session_id}` | [get_agentic_session](../../shared/api/ewa_platform/gateways/routers/agentic_sessions.py#L119) | `AgenticSessionOut` |
| `POST` | `/api/v1/ewa/agentic/sessions/{session_id}/cancel` | [cancel_agentic_session](../../shared/api/ewa_platform/gateways/routers/agentic_sessions.py#L185) | `AgenticSessionRespondOut` |
| `POST` | `/api/v1/ewa/agentic/sessions/{session_id}/respond` | [respond_agentic_session](../../shared/api/ewa_platform/gateways/routers/agentic_sessions.py#L143) | `AgenticSessionRespondOut` |
| `GET` | `/api/v1/ewa/agentic/sessions/{session_id}/trace` | [get_agentic_session_trace](../../shared/api/ewa_platform/gateways/routers/agentic_sessions.py#L221) | `AgenticTraceOut` |
| `GET` | `/api/v1/ewa/agentic/sessions/{session_id}/tree` | [get_agentic_session_tree](../../shared/api/ewa_platform/gateways/routers/agentic_sessions.py#L266) | `AgenticTreeOut` |
| `POST` | `/api/v1/ewa/companion-chat/message` | [post_companion_chat_message](../../shared/api/ewa_platform/gateways/routers/companion_chat.py#L191) | `CompanionChatMessageOut` |
| `POST` | `/api/v1/ewa/companion-chat/ocr-turn` | [post_companion_chat_ocr_turn](../../shared/api/ewa_platform/gateways/routers/companion_chat.py#L244) | `CompanionChatMessageOut` |
| `POST` | `/api/v1/ewa/companion-chat/stream` | [post_companion_chat_stream](../../shared/api/ewa_platform/gateways/routers/companion_chat.py#L798) | `StreamingResponse` |
| `GET` | `/api/v1/ewa/companion-chat/task-events/stream` | [stream_companion_chat_task_events](../../shared/api/ewa_platform/gateways/routers/companion_chat.py#L340) | `StreamingResponse` |
| `GET` | `/api/v1/ewa/companion-chat/task-runs` | [list_companion_chat_task_runs](../../shared/api/ewa_platform/gateways/routers/companion_chat.py#L288) | `CompanionTaskRunsOut` |
| `GET` | `/api/v1/ewa/companion-chat/task-runs/{run_id}` | [get_companion_chat_task_run](../../shared/api/ewa_platform/gateways/routers/companion_chat.py#L397) | `CompanionTaskRunOut` |
| `POST` | `/api/v1/ewa/companion-chat/task-runs/{run_id}/cancel` | [cancel_companion_chat_task_run](../../shared/api/ewa_platform/gateways/routers/companion_chat.py#L623) | `CompanionTaskRunCancelOut` |
| `POST` | `/api/v1/ewa/companion-chat/task-runs/{run_id}/confirm` | [confirm_companion_chat_task_run](../../shared/api/ewa_platform/gateways/routers/companion_chat.py#L523) | `CompanionTaskRunConfirmOut` |
| `GET` | `/api/v1/ewa/companion-chat/task-runs/{run_id}/events` | [stream_companion_chat_task_run_events](../../shared/api/ewa_platform/gateways/routers/companion_chat.py#L434) | `StreamingResponse` |
| `POST` | `/api/v1/ewa/companion-observation` | [post_companion_observation](../../shared/api/ewa_platform/gateways/routers/companion_chat.py#L847) | `CompanionObservationOut` |
| `GET` | `/api/v1/ewa/companion-plans/active` | [get_active_companion_plan](../../shared/api/ewa_platform/gateways/routers/companion_plans.py#L63) | `CompanionPlanBundleOut` |
| `POST` | `/api/v1/ewa/companion-plans/active/archive` | [archive_active_companion_plan](../../shared/api/ewa_platform/gateways/routers/companion_plans.py#L112) | `CompanionPlanBundleOut` |
| `PATCH` | `/api/v1/ewa/companion-plans/tasks/{task_id}` | [patch_companion_plan_task](../../shared/api/ewa_platform/gateways/routers/companion_plans.py#L151) | `CompanionPlanBundleOut` |
| `POST` | `/api/v1/ewa/companion-plans/tasks/{task_id}/complete` | [complete_companion_plan_task](../../shared/api/ewa_platform/gateways/routers/companion_plans.py#L130) | `CompanionPlanBundleOut` |
| `GET` | `/api/v1/ewa/companion-plans/{plan_id}/summary` | [get_companion_plan_summary](../../shared/api/ewa_platform/gateways/routers/companion_plans.py#L83) | `CompanionPlanSummaryOut` |
| `GET` | `/api/v1/ewa/companion-profile` | [get_companion_profile](../../shared/api/ewa_platform/gateways/routers/companion_profile.py#L146) | `CompanionProfileOut` |
| `PATCH` | `/api/v1/ewa/companion-profile` | [patch_companion_profile](../../shared/api/ewa_platform/gateways/routers/companion_profile.py#L233) | `CompanionProfileOut` |
| `POST` | `/api/v1/ewa/companion-profile/arlika-v2-mode-toggle` | [toggle_arlika_v2_mode](../../shared/api/ewa_platform/gateways/routers/companion_profile.py#L270) | `CompanionArlikaV2ModeToggleOut` |
| `GET` | `/api/v1/ewa/companion-profile/context-anchor` | [get_companion_context_anchor](../../shared/api/ewa_platform/gateways/routers/companion_profile.py#L593) | `CompanionContextAnchorGetOut` |
| `PATCH` | `/api/v1/ewa/companion-profile/context-anchor` | [patch_companion_context_anchor](../../shared/api/ewa_platform/gateways/routers/companion_profile.py#L647) | `CompanionProfileOut` |
| `POST` | `/api/v1/ewa/companion-profile/context-anchor/diagnose` | [post_companion_context_anchor_diagnose](../../shared/api/ewa_platform/gateways/routers/companion_profile.py#L671) | `CompanionContextDiagnoseOut` |
| `POST` | `/api/v1/ewa/companion-profile/context-anchor/refresh` | [post_companion_context_anchor_refresh](../../shared/api/ewa_platform/gateways/routers/companion_profile.py#L616) | `CompanionContextAnchorRefreshOut` |
| `POST` | `/api/v1/ewa/companion-profile/initialize` | [initialize_companion_profile](../../shared/api/ewa_platform/gateways/routers/companion_profile.py#L173) | `CompanionProfileOut` |
| `DELETE` | `/api/v1/ewa/companion-profile/memory/{content_hash}` | [forget_companion_memory](../../shared/api/ewa_platform/gateways/routers/companion_profile.py#L552) | `CompanionProfileOut` |
| `GET` | `/api/v1/ewa/companion-profile/quick-actions` | [list_companion_quick_actions](../../shared/api/ewa_platform/gateways/routers/companion_profile.py#L320) | `list[CompanionQuickPresetOut]` |
| `POST` | `/api/v1/ewa/companion-profile/quick-actions` | [create_companion_quick_action](../../shared/api/ewa_platform/gateways/routers/companion_profile.py#L337) | `CompanionQuickPresetOut` |
| `DELETE` | `/api/v1/ewa/companion-profile/quick-actions/{preset_id}` | [delete_companion_quick_action](../../shared/api/ewa_platform/gateways/routers/companion_profile.py#L389) | `CompanionOkOut` |
| `PATCH` | `/api/v1/ewa/companion-profile/quick-actions/{preset_id}` | [patch_companion_quick_action](../../shared/api/ewa_platform/gateways/routers/companion_profile.py#L361) | `CompanionQuickPresetOut` |
| `GET` | `/api/v1/ewa/companion-profile/story` | [list_companion_story](../../shared/api/ewa_platform/gateways/routers/companion_profile.py#L435) | `list[CompanionStoryRowOut]` |
| `POST` | `/api/v1/ewa/companion-profile/story` | [add_companion_story](../../shared/api/ewa_platform/gateways/routers/companion_profile.py#L455) | `list[CompanionStoryRowOut]` |
| `DELETE` | `/api/v1/ewa/companion-profile/story/{content_hash}` | [delete_companion_story](../../shared/api/ewa_platform/gateways/routers/companion_profile.py#L510) | `list[CompanionStoryRowOut]` |
| `GET` | `/api/v1/ewa/companion-user-workflows` | [list_user_workflows](../../shared/api/ewa_platform/gateways/routers/companion_user_workflows.py#L171) | `list[CompanionUserWorkflowOut]` |
| `POST` | `/api/v1/ewa/companion-user-workflows` | [create_user_workflow](../../shared/api/ewa_platform/gateways/routers/companion_user_workflows.py#L188) | `CompanionUserWorkflowOut` |
| `GET` | `/api/v1/ewa/companion-user-workflows/observation-triggers` | [get_observation_triggers](../../shared/api/ewa_platform/gateways/routers/companion_user_workflows.py#L456) | `CompanionUserWorkflowObservationTriggersOut` |
| `PATCH` | `/api/v1/ewa/companion-user-workflows/observation-triggers` | [patch_observation_triggers_route](../../shared/api/ewa_platform/gateways/routers/companion_user_workflows.py#L478) | `CompanionUserWorkflowObservationTriggersOut` |
| `GET` | `/api/v1/ewa/companion-user-workflows/tool-catalog` | [list_user_workflow_tool_catalog](../../shared/api/ewa_platform/gateways/routers/companion_user_workflows.py#L111) | `list[CompanionUserWorkflowToolCatalogEntry]` |
| `POST` | `/api/v1/ewa/companion-user-workflows/validate` | [validate_user_workflow](../../shared/api/ewa_platform/gateways/routers/companion_user_workflows.py#L123) | `CompanionUserWorkflowValidateOut` |
| `POST` | `/api/v1/ewa/companion-user-workflows/validate-v2` | [validate_user_workflow_v2](../../shared/api/ewa_platform/gateways/routers/companion_user_workflows.py#L155) | `CompanionWorkflowValidateV2Response` |
| `DELETE` | `/api/v1/ewa/companion-user-workflows/{workflow_id}` | [delete_user_workflow](../../shared/api/ewa_platform/gateways/routers/companion_user_workflows.py#L384) | `CompanionDeletedOut` |
| `GET` | `/api/v1/ewa/companion-user-workflows/{workflow_id}` | [get_user_workflow](../../shared/api/ewa_platform/gateways/routers/companion_user_workflows.py#L239) | `CompanionUserWorkflowOut` |
| `PATCH` | `/api/v1/ewa/companion-user-workflows/{workflow_id}` | [patch_user_workflow](../../shared/api/ewa_platform/gateways/routers/companion_user_workflows.py#L261) | `CompanionUserWorkflowOut` |
| `POST` | `/api/v1/ewa/companion-user-workflows/{workflow_id}/disable` | [disable_user_workflow](../../shared/api/ewa_platform/gateways/routers/companion_user_workflows.py#L431) | `CompanionUserWorkflowOut` |
| `POST` | `/api/v1/ewa/companion-user-workflows/{workflow_id}/enable` | [enable_user_workflow](../../shared/api/ewa_platform/gateways/routers/companion_user_workflows.py#L406) | `CompanionUserWorkflowOut` |
| `GET` | `/api/v1/ewa/desktop-orchestration/sessions/{session_id}/events` | [get_desktop_orchestration_session_events](../../shared/api/ewa_platform/gateways/routers/desktop.py#L69) | `StreamingResponse` |
| `POST` | `/api/v1/ewa/desktop-orchestration/turn` | [post_desktop_orchestration_turn](../../shared/api/ewa_platform/gateways/routers/desktop.py#L46) | `EwaDesktopOrchestrationTurnResponse` |
| `GET` | `/api/v1/ewa/driver-catalog` | [get_ewa_driver_catalog](../../shared/api/ewa_platform/gateways/routers/standalone_facade.py#L45) | `list[EwaDriverCatalogEntryOut]` |
| `POST` | `/api/v1/ewa/esp-display/image` | [post_esp_display_image](../../shared/api/ewa_platform/gateways/routers/esp_display.py#L134) | `Response` |
| `POST` | `/api/v1/ewa/esp-display/turn` | [post_esp_display_turn](../../shared/api/ewa_platform/gateways/routers/esp_display.py#L69) | `EspDisplayTurnOut` |
| `POST` | `/api/v1/ewa/runtime-command` | [post_ewa_runtime_command](../../shared/api/ewa_platform/gateways/routers/runtime_command.py#L58) | `EwaRuntimeCommandOut` |
| `GET` | `/api/v1/ewa/runtime-context` | [get_ewa_runtime_context](../../shared/api/ewa_platform/gateways/routers/runtime_context.py#L56) | `EwaRuntimeContextOut` |
| `GET` | `/api/v1/ewa/runtime-context/content` | [get_ewa_runtime_context_content](../../shared/api/ewa_platform/gateways/routers/runtime_context.py#L100) | `EwaRuntimeContentPageOut` |
| `POST` | `/api/v1/ewa/runtime-turn` | [post_ewa_runtime_turn](../../shared/api/ewa_platform/gateways/routers/runtime_command.py#L85) | `EwaRuntimeTurnOut` |
| `GET` | `/api/v1/ewa/ugs/generation-inventory/core-alignment` | [get_ugs_generation_inventory_core_alignment](../../shared/api/ewa_platform/gateways/routers/standalone_facade.py#L84) | `AmkaCoreAlignmentOut` |
| `GET` | `/api/v1/ewa/ugs/model-routing/core-alignment` | [get_ugs_model_routing_core_alignment](../../shared/api/ewa_platform/gateways/routers/standalone_facade.py#L59) | `AmkaCoreAlignmentOut` |

## /api/v1/ewrp

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `POST` | `/api/v1/ewrp` | [create_ewrp](../../shared/api/routers/ewrp.py#L634) | `EwrpCreateResponse` |
| `GET` | `/api/v1/ewrp/jobs` | [list_ewrp_jobs](../../shared/api/routers/ewrp.py#L928) | `list[EwrpJobListItem]` |
| `GET` | `/api/v1/ewrp/quote` | [quote_ewrp_presentation](../../shared/api/routers/ewrp.py#L610) | `EwrpQuoteResponse` |
| `DELETE` | `/api/v1/ewrp/{job_id}` | [delete_ewrp_job](../../shared/api/routers/ewrp.py#L1108) | `Response` |
| `POST` | `/api/v1/ewrp/{job_id}/duplicate` | [duplicate_ewrp_job](../../shared/api/routers/ewrp.py#L747) | `EwrpCreateResponse` |
| `GET` | `/api/v1/ewrp/{job_id}/pdf` | [download_ewrp_pdf](../../shared/api/routers/ewrp.py#L977) | `FileResponse` |
| `POST` | `/api/v1/ewrp/{job_id}/retry` | [retry_ewrp_job](../../shared/api/routers/ewrp.py#L838) | `EwrpCreateResponse` |
| `PUT` | `/api/v1/ewrp/{job_id}/slides` | [update_ewrp_slides](../../shared/api/routers/ewrp.py#L1132) | `EwrpStatusResponse` |
| `GET` | `/api/v1/ewrp/{job_id}/slides/{slide_index}/image` | [download_ewrp_slide_image](../../shared/api/routers/ewrp.py#L1064) | `FileResponse` |
| `POST` | `/api/v1/ewrp/{job_id}/slides/{slide_index}/regenerate-image` | [ewrp_regenerate_slide_image](../../shared/api/routers/ewrp.py#L1300) | `EwrpStatusResponse` |
| `POST` | `/api/v1/ewrp/{job_id}/slides/{slide_index}/regenerate-text` | [ewrp_regenerate_slide_text](../../shared/api/routers/ewrp.py#L1372) | `EwrpStatusResponse` |
| `GET` | `/api/v1/ewrp/{job_id}/status` | [get_ewrp_status](../../shared/api/routers/ewrp.py#L960) | `EwrpStatusResponse` |

## /api/v1/floating-widgets

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/floating-widgets` | [get_user_widgets](../../shared/api/routers/floating_widgets.py#L123) | `list[FloatingWidgetResponse]` |
| `POST` | `/api/v1/floating-widgets` | [create_widget](../../shared/api/routers/floating_widgets.py#L164) | `FloatingWidgetResponse` |
| `POST` | `/api/v1/floating-widgets/from-template` | [create_widget_from_template](../../shared/api/routers/floating_widgets.py#L186) | `FloatingWidgetResponse` |
| `GET` | `/api/v1/floating-widgets/templates` | [get_templates](../../shared/api/routers/floating_widgets.py#L59) | `list[FloatingWidgetTemplateResponse]` |
| `GET` | `/api/v1/floating-widgets/templates/{widget_type}` | [get_template](../../shared/api/routers/floating_widgets.py#L93) | `FloatingWidgetTemplateResponse` |
| `DELETE` | `/api/v1/floating-widgets/{widget_id}` | [delete_widget](../../shared/api/routers/floating_widgets.py#L243) | `dict[str, str]` |
| `GET` | `/api/v1/floating-widgets/{widget_id}` | [get_widget](../../shared/api/routers/floating_widgets.py#L142) | `FloatingWidgetResponse` |
| `PATCH` | `/api/v1/floating-widgets/{widget_id}` | [update_widget](../../shared/api/routers/floating_widgets.py#L217) | `FloatingWidgetResponse` |

## /api/v1/friends

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/friends` | [list_friends](../../shared/api/routers/friends.py#L338) | `list[FriendUser]` |
| `GET` | `/api/v1/friends/admin/reports` | [admin_list_social_reports](../../shared/api/routers/friends_admin_reports.py#L71) | `SocialReportAdminListOut` |
| `GET` | `/api/v1/friends/admin/reports/{report_id}` | [admin_get_social_report](../../shared/api/routers/friends_admin_reports.py#L95) | `SocialReportAdminItem` |
| `PATCH` | `/api/v1/friends/admin/reports/{report_id}` | [admin_patch_social_report](../../shared/api/routers/friends_admin_reports.py#L110) | `SocialReportAdminItem` |
| `GET` | `/api/v1/friends/circles` | [list_friend_circles](../../shared/api/routers/friends.py#L468) | `list[FriendCircleItem]` |
| `POST` | `/api/v1/friends/circles` | [create_friend_circle](../../shared/api/routers/friends.py#L477) | `FriendCircleItem` |
| `DELETE` | `/api/v1/friends/circles/{circle_id}` | [delete_friend_circle](../../shared/api/routers/friends.py#L511) | `dict` |
| `PATCH` | `/api/v1/friends/circles/{circle_id}` | [update_friend_circle](../../shared/api/routers/friends.py#L490) | `FriendCircleItem` |
| `GET` | `/api/v1/friends/overview` | [get_friends_overview](../../shared/api/routers/friends.py#L351) | `FriendsOverviewResponse` |
| `GET` | `/api/v1/friends/referral` | [get_friends_referral_invite](../../shared/api/routers/friends.py#L382) | `FriendsReferralInviteResponse` |
| `GET` | `/api/v1/friends/referral/preview` | [preview_friends_referral_code](../../shared/api/routers/friends.py#L394) | `FriendsReferralPreviewResponse` |
| `POST` | `/api/v1/friends/request` | [send_friend_request](../../shared/api/routers/friends.py#L406) | `FriendRequestSendResponse` |
| `POST` | `/api/v1/friends/request/by-user/{user_id}` | [send_friend_request_to_user](../../shared/api/routers/friends.py#L437) | `FriendRequestSendResponse` |
| `GET` | `/api/v1/friends/requests` | [list_incoming_requests](../../shared/api/routers/friends.py#L561) | `list[IncomingRequestItem]` |
| `GET` | `/api/v1/friends/requests/sent` | [list_sent_requests](../../shared/api/routers/friends.py#L570) | `list[SentRequestItem]` |
| `POST` | `/api/v1/friends/requests/{request_id}/accept` | [accept_request](../../shared/api/routers/friends.py#L579) | `dict` |
| `POST` | `/api/v1/friends/requests/{request_id}/cancel` | [cancel_request](../../shared/api/routers/friends.py#L633) | `dict` |
| `POST` | `/api/v1/friends/requests/{request_id}/reject` | [reject_request](../../shared/api/routers/friends.py#L610) | `dict` |
| `GET` | `/api/v1/friends/users/search` | [search_friend_users](../../shared/api/routers/friends.py#L371) | `list[FriendSearchCandidate]` |
| `DELETE` | `/api/v1/friends/{user_id}` | [remove_friend](../../shared/api/routers/friends.py#L656) | `dict` |
| `GET` | `/api/v1/friends/{user_id}/profile` | [get_friend_profile](../../shared/api/routers/friends.py#L525) | `FriendProfileResponse` |
| `PATCH` | `/api/v1/friends/{user_id}/relationship` | [update_friend_relationship](../../shared/api/routers/friends.py#L538) | `FriendProfileResponse` |
| `POST` | `/api/v1/friends/{user_id}/report` | [report_friend_user](../../shared/api/routers/friends.py#L678) | `FriendReportResponse` |

## /api/v1/gaf-chat

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/gaf-chat/chats` | [list_chats](../../shared/api/gaf_chat/router.py#L380) | `list[ChatListItem]` |
| `POST` | `/api/v1/gaf-chat/chats/by-username` | [get_or_create_chat_by_username](../../shared/api/gaf_chat/router.py#L409) | `ChatByUsernameResponse` |
| `GET` | `/api/v1/gaf-chat/chats/lite` | [list_chats_lite](../../shared/api/gaf_chat/router.py#L394) | `list[ChatListItemLite]` |
| `DELETE` | `/api/v1/gaf-chat/chats/{chat_id}` | [hard_delete_chat](../../shared/api/gaf_chat/router.py#L973) | `OkStatusResponse` |
| `POST` | `/api/v1/gaf-chat/chats/{chat_id}/archive` | [archive_chat](../../shared/api/gaf_chat/router.py#L950) | `OkStatusResponse` |
| `POST` | `/api/v1/gaf-chat/chats/{chat_id}/clear` | [clear_history](../../shared/api/gaf_chat/router.py#L927) | `OkStatusResponse` |
| `GET` | `/api/v1/gaf-chat/chats/{chat_id}/e2ee` | [get_e2ee_status](../../shared/api/gaf_chat/router.py#L478) | `E2eeConsentStatusResponse` |
| `POST` | `/api/v1/gaf-chat/chats/{chat_id}/e2ee/accept` | [accept_e2ee](../../shared/api/gaf_chat/router.py#L519) | `E2eeConsentStatusResponse` |
| `POST` | `/api/v1/gaf-chat/chats/{chat_id}/e2ee/decline` | [decline_e2ee](../../shared/api/gaf_chat/router.py#L543) | `E2eeConsentStatusResponse` |
| `POST` | `/api/v1/gaf-chat/chats/{chat_id}/e2ee/disable` | [disable_e2ee](../../shared/api/gaf_chat/router.py#L567) | `E2eeConsentStatusResponse` |
| `POST` | `/api/v1/gaf-chat/chats/{chat_id}/e2ee/propose` | [propose_e2ee](../../shared/api/gaf_chat/router.py#L495) | `E2eeConsentStatusResponse` |
| `GET` | `/api/v1/gaf-chat/chats/{chat_id}/messages` | [list_messages](../../shared/api/gaf_chat/router.py#L591) | `list[MessageItem]` |
| `POST` | `/api/v1/gaf-chat/chats/{chat_id}/messages` | [send_message](../../shared/api/gaf_chat/router.py#L612) | `MessageItem` |
| `POST` | `/api/v1/gaf-chat/chats/{chat_id}/messages/desktop-app-link` | [send_desktop_app_link_message](../../shared/api/gaf_chat/router.py#L697) | `MessageItem` |
| `DELETE` | `/api/v1/gaf-chat/chats/{chat_id}/messages/{message_id}` | [delete_message](../../shared/api/gaf_chat/router.py#L816) | `OkStatusResponse` |
| `PATCH` | `/api/v1/gaf-chat/chats/{chat_id}/messages/{message_id}` | [edit_message](../../shared/api/gaf_chat/router.py#L780) | `MessageItem` |
| `POST` | `/api/v1/gaf-chat/chats/{chat_id}/messages/{message_id}/accept-attachment` | [accept_attachment](../../shared/api/gaf_chat/router.py#L851) | `AcceptAttachmentResponse` |
| `GET` | `/api/v1/gaf-chat/chats/{chat_id}/messages/{message_id}/attachment` | [download_message_attachment](../../shared/api/gaf_chat/router.py#L882) | `StreamingResponse` |
| `GET` | `/api/v1/gaf-chat/chats/{chat_id}/partner-desktop-apps` | [list_partner_desktop_apps_for_admin](../../shared/api/gaf_chat/router.py#L671) | `GafPartnerDesktopAppsResponse` |
| `POST` | `/api/v1/gaf-chat/chats/{chat_id}/read` | [mark_read](../../shared/api/gaf_chat/router.py#L746) | `OkStatusResponse` |
| `GET` | `/api/v1/gaf-chat/chats/{chat_id}/session-key` | [get_session_key_envelope](../../shared/api/gaf_chat/router.py#L1079) | `SessionKeyEnvelope \| None` |
| `POST` | `/api/v1/gaf-chat/keys/public` | [upload_public_key](../../shared/api/gaf_chat/router.py#L1012) | `PublicKeyInfo` |
| `GET` | `/api/v1/gaf-chat/keys/public/me` | [get_my_public_key](../../shared/api/gaf_chat/router.py#L1048) | `PublicKeyInfo` |
| `GET` | `/api/v1/gaf-chat/keys/public/{user_id}` | [get_user_public_key](../../shared/api/gaf_chat/router.py#L1063) | `PublicKeyInfo` |
| `GET` | `/api/v1/gaf-chat/me` | [get_me](../../shared/api/gaf_chat/router.py#L369) | `GafChatMeResponse` |
| `GET` | `/api/v1/gaf-chat/users/search` | [search_users](../../shared/api/gaf_chat/router.py#L996) | `list[UserSearchItem]` |

## /api/v1/health

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/health` | [api_v1_health_check](../../shared/api/main.py#L646) | `dict[str, Any]` |

## /api/v1/image-studio

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `POST` | `/api/v1/image-studio/image-edit` | [image_edit](../../shared/api/routers/image_studio.py#L99) | `dict[str, Any]` |
| `POST` | `/api/v1/image-studio/image-edit-json` | [image_edit_json](../../shared/api/routers/image_studio.py#L108) | `dict[str, Any]` |
| `POST` | `/api/v1/image-studio/image-edit-json/stream` | [image_edit_json_stream](../../shared/api/routers/image_studio_stream.py#L251) | `StreamingResponse` |
| `POST` | `/api/v1/image-studio/image-edit/stream` | [image_edit_stream](../../shared/api/routers/image_studio_stream.py#L208) | `StreamingResponse` |
| `POST` | `/api/v1/image-studio/image-rotate` | [image_rotate](../../shared/api/routers/image_studio.py#L116) | `dict[str, Any]` |
| `POST` | `/api/v1/image-studio/image-rotate/stream` | [image_rotate_stream](../../shared/api/routers/image_studio_stream.py#L288) | `StreamingResponse` |
| `POST` | `/api/v1/image-studio/suggest-prompt` | [suggest_image_prompt](../../shared/api/routers/image_studio.py#L91) | `dict[str, Any]` |
| `POST` | `/api/v1/image-studio/suggest-prompt/stream` | [suggest_image_prompt_stream](../../shared/api/routers/image_studio_stream.py#L149) | `StreamingResponse` |
| `POST` | `/api/v1/image-studio/text-to-image` | [text_to_image](../../shared/api/routers/image_studio.py#L83) | `dict[str, Any]` |
| `POST` | `/api/v1/image-studio/text-to-image/stream` | [text_to_image_stream](../../shared/api/routers/image_studio_stream.py#L118) | `StreamingResponse` |

## /api/v1/kbsew

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/kbsew/barrels` | [proxy_barrels_list](../../shared/api/routers/kbsew_gateway.py#L267) | `list[KbsewBarrelOut]` |
| `POST` | `/api/v1/kbsew/barrels` | [proxy_barrels_create](../../shared/api/routers/kbsew_gateway.py#L279) | `KbsewBarrelOut` |
| `DELETE` | `/api/v1/kbsew/barrels/{barrel_id}` | [proxy_barrel_delete](../../shared/api/routers/kbsew_gateway.py#L297) | `Response` |
| `POST` | `/api/v1/kbsew/barrels/{barrel_id}/assets/{asset_id}/reindex` | [proxy_asset_reindex](../../shared/api/routers/kbsew_gateway.py#L383) | `KbsewForceReindexAssetOut` |
| `PATCH` | `/api/v1/kbsew/barrels/{barrel_id}/enabled` | [proxy_barrel_enabled](../../shared/api/routers/kbsew_gateway.py#L310) | `KbsewBarrelOut` |
| `POST` | `/api/v1/kbsew/barrels/{barrel_id}/ingest` | [proxy_barrel_ingest](../../shared/api/routers/kbsew_gateway.py#L323) | `KbsewIngestOut` |
| `POST` | `/api/v1/kbsew/barrels/{barrel_id}/ingest/upload` | [proxy_barrel_ingest_upload](../../shared/api/routers/kbsew_gateway.py#L343) | `Response` |
| `POST` | `/api/v1/kbsew/barrels/{barrel_id}/reindex` | [proxy_barrel_reindex](../../shared/api/routers/kbsew_gateway.py#L370) | `KbsewForceReindexBarrelOut` |
| `GET` | `/api/v1/kbsew/barrels/{barrel_id}/status` | [proxy_barrel_status](../../shared/api/routers/kbsew_gateway.py#L357) | `KbsewBarrelStatusOut` |
| `GET` | `/api/v1/kbsew/drivers` | [proxy_drivers](../../shared/api/routers/kbsew_gateway.py#L238) | `KbsewDriversOut` |
| `GET` | `/api/v1/kbsew/ready` | [proxy_ready](../../shared/api/routers/kbsew_gateway.py#L250) | `KbsewReadyOut` |
| `POST` | `/api/v1/kbsew/search` | [admin_kbsew_search](../../shared/api/routers/kbsew_gateway.py#L401) | `AdminKbsewSearchOut` |

## /api/v1/kursorina

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/kursorina/missions` | [kursorina_list_missions](../../shared/api/routers/kursorina.py#L109) | `list[MissionPublicView]` |
| `POST` | `/api/v1/kursorina/missions` | [kursorina_create_mission](../../shared/api/routers/kursorina.py#L57) | `MissionPublicView` |
| `DELETE` | `/api/v1/kursorina/missions/{mission_id}` | [kursorina_delete_mission](../../shared/api/routers/kursorina.py#L156) | `None` |
| `GET` | `/api/v1/kursorina/missions/{mission_id}` | [kursorina_get_mission](../../shared/api/routers/kursorina.py#L118) | `MissionPublicView` |
| `POST` | `/api/v1/kursorina/missions/{mission_id}/cancel` | [kursorina_cancel_mission](../../shared/api/routers/kursorina.py#L137) | `MissionPublicView` |
| `POST` | `/api/v1/kursorina/missions/{mission_id}/tick` | [kursorina_tick_mission](../../shared/api/routers/kursorina.py#L167) | `MissionPublicView` |

## /api/v1/live-voice

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/live-voice/history` | [get_history](../../shared/api/routers/live_voice.py#L406) | `HistoryResponse` |
| `GET` | `/api/v1/live-voice/history/search` | [search_history](../../shared/api/routers/live_voice.py#L464) | `HistoryResponse` |
| `DELETE` | `/api/v1/live-voice/history/{conversation_id}` | [delete_conversation](../../shared/api/routers/live_voice.py#L438) | `dict[str, Any]` |
| `POST` | `/api/v1/live-voice/process` | [process_audio](../../shared/api/routers/live_voice.py#L270) | `ProcessAudioFullResponse` |
| `GET` | `/api/v1/live-voice/settings` | [get_settings](../../shared/api/routers/live_voice.py#L191) | `LiveVoiceSettingsResponse` |
| `PUT` | `/api/v1/live-voice/settings` | [save_settings](../../shared/api/routers/live_voice.py#L213) | `LiveVoiceSettingsResponse` |
| `POST` | `/api/v1/live-voice/speak-text` | [speak_text](../../shared/api/routers/live_voice.py#L521) | `dict[str, Any]` |
| `POST` | `/api/v1/live-voice/start` | [start_session](../../shared/api/routers/live_voice.py#L244) | `dict` |
| `GET` | `/api/v1/live-voice/status/{task_id}` | [get_task_status](../../shared/api/routers/live_voice.py#L369) | `TaskStatusResponse` |
| `POST` | `/api/v1/live-voice/stop` | [stop_session](../../shared/api/routers/live_voice.py#L496) | `dict[str, Any]` |
| `POST` | `/api/v1/live-voice/tts/xtts` | [synthesize_xtts_clone](../../shared/api/routers/live_voice.py#L599) | `XTTSCloneResponse` |
| `WEBSOCKET` | `/api/v1/live-voice/ws/{session_id}` | [live_voice_websocket](../../shared/api/routers/live_voice_websocket.py#L366) | `None` |

## /api/v1/marketing-cabinet

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `POST` | `/api/v1/marketing-cabinet/ai/assist` | [assist_with_ai](../../shared/api/routers/marketing_cabinet/ai.py#L503) | `MarketingAiAssistResponse` |
| `POST` | `/api/v1/marketing-cabinet/ai/assist/stream` | [assist_with_ai_stream](../../shared/api/routers/marketing_cabinet/ai.py#L556) | `StreamingResponse` |
| `GET` | `/api/v1/marketing-cabinet/ai/runs` | [list_ai_runs](../../shared/api/routers/marketing_cabinet/ai.py#L356) | `MarketingAiRunListResponse` |
| `GET` | `/api/v1/marketing-cabinet/ai/runs/{run_id}` | [get_ai_run_detail](../../shared/api/routers/marketing_cabinet/ai.py#L440) | `MarketingAiRunDetailResponse` |
| `POST` | `/api/v1/marketing-cabinet/ai/tool-agent` | [marketing_tool_agent](../../shared/api/routers/marketing_cabinet/ai.py#L646) | `MarketingToolAgentResponse` |
| `GET` | `/api/v1/marketing-cabinet/amka/operator-config` | [get_amka_operator_config](../../shared/api/routers/marketing_cabinet/amka.py#L109) | `AmkaOperatorConfigBundleOut` |
| `PUT` | `/api/v1/marketing-cabinet/amka/operator-config` | [put_amka_operator_config](../../shared/api/routers/marketing_cabinet/amka.py#L124) | `AmkaOperatorConfigBundleOut` |
| `GET` | `/api/v1/marketing-cabinet/amka/preset-templates` | [list_amka_preset_templates](../../shared/api/routers/marketing_cabinet/amka.py#L141) | `AmkaPresetTemplateListResponse` |
| `GET` | `/api/v1/marketing-cabinet/amka/presets` | [list_amka_presets](../../shared/api/routers/marketing_cabinet/amka.py#L150) | `AmkaPresetListResponse` |
| `POST` | `/api/v1/marketing-cabinet/amka/presets` | [create_amka_preset](../../shared/api/routers/marketing_cabinet/amka.py#L160) | `AmkaPresetOneResponse` |
| `DELETE` | `/api/v1/marketing-cabinet/amka/presets/{preset_id}` | [remove_amka_preset](../../shared/api/routers/marketing_cabinet/amka.py#L223) | `Response` |
| `GET` | `/api/v1/marketing-cabinet/amka/presets/{preset_id}` | [get_amka_preset](../../shared/api/routers/marketing_cabinet/amka.py#L186) | `AmkaPresetOneResponse` |
| `PUT` | `/api/v1/marketing-cabinet/amka/presets/{preset_id}` | [update_amka_preset](../../shared/api/routers/marketing_cabinet/amka.py#L198) | `AmkaPresetOneResponse` |
| `GET` | `/api/v1/marketing-cabinet/amka/project/{project_id}/runs` | [list_amka_runs](../../shared/api/routers/marketing_cabinet/amka.py#L239) | `AmkaRunListResponse` |
| `POST` | `/api/v1/marketing-cabinet/amka/runs` | [create_amka_run](../../shared/api/routers/marketing_cabinet/amka.py#L388) | `AmkaAsyncStartResponse` |
| `GET` | `/api/v1/marketing-cabinet/amka/runs/{run_id}` | [get_amka_run_detail](../../shared/api/routers/marketing_cabinet/amka.py#L251) | `AmkaRunDetailResponse` |
| `POST` | `/api/v1/marketing-cabinet/amka/runs/{run_id}/approve` | [approve_amka_run](../../shared/api/routers/marketing_cabinet/amka.py#L427) | `EwaApproveResponse` |
| `POST` | `/api/v1/marketing-cabinet/amka/runs/{run_id}/cancel` | [cancel_amka_run](../../shared/api/routers/marketing_cabinet/amka.py#L483) | `AmkaCancelResponse` |
| `POST` | `/api/v1/marketing-cabinet/amka/runs/{run_id}/continue-step` | [continue_amka_step](../../shared/api/routers/marketing_cabinet/amka.py#L467) | `AmkaContinueStepResponse` |
| `GET` | `/api/v1/marketing-cabinet/amka/runs/{run_id}/core-alignment` | [get_amka_run_core_alignment](../../shared/api/routers/marketing_cabinet/amka.py#L266) | `AmkaCoreAlignmentOut` |
| `GET` | `/api/v1/marketing-cabinet/amka/runs/{run_id}/events` | [stream_amka_run_events](../../shared/api/routers/marketing_cabinet/amka.py#L348) | `StreamingResponse` |
| `GET` | `/api/v1/marketing-cabinet/amka/runs/{run_id}/export.md` | [export_amka_run_markdown](../../shared/api/routers/marketing_cabinet/amka.py#L288) | `Response` |
| `POST` | `/api/v1/marketing-cabinet/amka/runs/{run_id}/resume` | [resume_amka_run](../../shared/api/routers/marketing_cabinet/amka.py#L447) | `AmkaResumeResponse` |
| `GET` | `/api/v1/marketing-cabinet/analysis/swot` | [list_swot_analyses](../../shared/api/routers/marketing_cabinet/analysis.py#L325) | `MarketingSwotListResponse` |
| `POST` | `/api/v1/marketing-cabinet/analysis/swot` | [create_swot_analysis](../../shared/api/routers/marketing_cabinet/analysis.py#L611) | `MarketingSwotOut` |
| `POST` | `/api/v1/marketing-cabinet/analysis/swot/generate` | [generate_swot_analysis](../../shared/api/routers/marketing_cabinet/analysis.py#L757) | `MarketingSwotOut` |
| `POST` | `/api/v1/marketing-cabinet/analysis/swot/generate/async` | [start_generate_swot_analysis_async](../../shared/api/routers/marketing_cabinet/analysis.py#L642) | `MarketingAiAsyncStartResponse` |
| `DELETE` | `/api/v1/marketing-cabinet/analysis/swot/{analysis_id}` | [delete_swot_analysis](../../shared/api/routers/marketing_cabinet/analysis.py#L366) | `DeleteSwotAnalysisResponse` |
| `GET` | `/api/v1/marketing-cabinet/analysis/swot/{analysis_id}` | [get_swot_analysis](../../shared/api/routers/marketing_cabinet/analysis.py#L407) | `MarketingSwotOut` |
| `PATCH` | `/api/v1/marketing-cabinet/analysis/swot/{analysis_id}` | [update_swot_analysis](../../shared/api/routers/marketing_cabinet/analysis.py#L429) | `MarketingSwotOut` |
| `POST` | `/api/v1/marketing-cabinet/autofill` | [preview_or_apply_document_autofill](../../shared/api/routers/marketing_cabinet/document_autofill.py#L2490) | `MarketingDocumentAutofillResponse` |
| `POST` | `/api/v1/marketing-cabinet/autofill/async` | [start_document_autofill_preview_async](../../shared/api/routers/marketing_cabinet/document_autofill.py#L2305) | `MarketingAiAsyncStartResponse` |
| `POST` | `/api/v1/marketing-cabinet/autofill/generate-from-project/async` | [start_document_autofill_from_project_async](../../shared/api/routers/marketing_cabinet/document_autofill.py#L2457) | `MarketingAiAsyncStartResponse` |
| `GET` | `/api/v1/marketing-cabinet/campaigns` | [list_campaigns](../../shared/api/routers/marketing_cabinet/campaigns.py#L113) | `MarketingCampaignListResponse` |
| `POST` | `/api/v1/marketing-cabinet/campaigns` | [create_campaign](../../shared/api/routers/marketing_cabinet/campaigns.py#L148) | `MarketingCampaignOut` |
| `DELETE` | `/api/v1/marketing-cabinet/campaigns/{campaign_id}` | [delete_campaign](../../shared/api/routers/marketing_cabinet/campaigns.py#L290) | `DeleteMarketingCampaignResponse` |
| `PATCH` | `/api/v1/marketing-cabinet/campaigns/{campaign_id}` | [update_campaign](../../shared/api/routers/marketing_cabinet/campaigns.py#L233) | `MarketingCampaignOut` |
| `GET` | `/api/v1/marketing-cabinet/chat/history` | [get_marketing_chat_history](../../shared/api/routers/marketing_cabinet/chat.py#L398) | `MarketingChatHistoryResponse` |
| `POST` | `/api/v1/marketing-cabinet/chat/message` | [send_marketing_chat_message](../../shared/api/routers/marketing_cabinet/chat.py#L453) | `MarketingChatMessageResponse` |
| `POST` | `/api/v1/marketing-cabinet/chat/message/stream` | [send_marketing_chat_message_stream](../../shared/api/routers/marketing_cabinet/chat.py#L536) | `StreamingResponse` |
| `GET` | `/api/v1/marketing-cabinet/client-interaction/chat-bridge` | [get_chat_bridge](../../shared/api/routers/marketing_cabinet/client_interaction.py#L164) | `ClientChatBridgeOut` |
| `GET` | `/api/v1/marketing-cabinet/client-interaction/context` | [get_interaction_context](../../shared/api/routers/marketing_cabinet/client_interaction.py#L128) | `ClientInteractionContextOut` |
| `GET` | `/api/v1/marketing-cabinet/client-interaction/customer-facing-summary` | [get_customer_facing_summary](../../shared/api/routers/marketing_cabinet/client_interaction.py#L211) | `CustomerFacingSummaryGetOut` |
| `PUT` | `/api/v1/marketing-cabinet/client-interaction/customer-facing-summary` | [put_customer_facing_summary](../../shared/api/routers/marketing_cabinet/client_interaction.py#L247) | `MarketingOkOut` |
| `GET` | `/api/v1/marketing-cabinet/client-interaction/documents` | [list_document_approvals](../../shared/api/routers/marketing_cabinet/client_interaction.py#L282) | `list[MarketingClientDocApprovalOut]` |
| `POST` | `/api/v1/marketing-cabinet/client-interaction/documents` | [send_documents_for_approval](../../shared/api/routers/marketing_cabinet/client_interaction.py#L355) | `MarketingClientDocCountOut` |
| `POST` | `/api/v1/marketing-cabinet/client-interaction/documents/{approval_id}/approve` | [approve_document](../../shared/api/routers/marketing_cabinet/client_interaction.py#L402) | `MarketingClientApprovalActionOut` |
| `GET` | `/api/v1/marketing-cabinet/client-interaction/documents/{approval_id}/file` | [download_approval_document_for_review](../../shared/api/routers/marketing_cabinet/client_interaction.py#L429) | `Not annotated` |
| `POST` | `/api/v1/marketing-cabinet/client-interaction/documents/{approval_id}/request-removal` | [request_document_removal](../../shared/api/routers/marketing_cabinet/client_interaction.py#L542) | `MarketingClientRemovalIdOut` |
| `GET` | `/api/v1/marketing-cabinet/client-interaction/ewrp-jobs` | [list_ewrp_jobs_for_project](../../shared/api/routers/marketing_cabinet/client_interaction.py#L657) | `list[ClientEwrpJobListItemOut]` |
| `GET` | `/api/v1/marketing-cabinet/client-interaction/presentations` | [list_presentation_shares](../../shared/api/routers/marketing_cabinet/client_interaction.py#L741) | `list[ClientPresShareOut]` |
| `POST` | `/api/v1/marketing-cabinet/client-interaction/presentations/share` | [share_presentation](../../shared/api/routers/marketing_cabinet/client_interaction.py#L693) | `MarketingClientShareIdOut` |
| `DELETE` | `/api/v1/marketing-cabinet/client-interaction/presentations/{share_id}` | [revoke_presentation_share](../../shared/api/routers/marketing_cabinet/client_interaction.py#L770) | `MarketingOkOut` |
| `GET` | `/api/v1/marketing-cabinet/client-interaction/presentations/{share_id}/html` | [get_shared_presentation_html](../../shared/api/routers/marketing_cabinet/client_interaction.py#L805) | `Not annotated` |
| `GET` | `/api/v1/marketing-cabinet/client-interaction/presentations/{share_id}/pdf` | [get_shared_presentation_pdf](../../shared/api/routers/marketing_cabinet/client_interaction.py#L839) | `Not annotated` |
| `POST` | `/api/v1/marketing-cabinet/client-interaction/removal-requests/{removal_id}/cancel` | [cancel_removal](../../shared/api/routers/marketing_cabinet/client_interaction.py#L625) | `MarketingOkOut` |
| `POST` | `/api/v1/marketing-cabinet/client-interaction/removal-requests/{removal_id}/confirm` | [confirm_removal](../../shared/api/routers/marketing_cabinet/client_interaction.py#L591) | `MarketingOkOut` |
| `GET` | `/api/v1/marketing-cabinet/companies/{company_id}/live-jobs-summary` | [get_company_live_jobs_summary](../../shared/api/routers/marketing_cabinet/live_jobs_summary.py#L38) | `MarketingProjectLiveJobsSummaryResponse` |
| `GET` | `/api/v1/marketing-cabinet/competitors` | [list_competitors](../../shared/api/routers/marketing_cabinet/competitors.py#L212) | `MarketingCompetitorListResponse` |
| `POST` | `/api/v1/marketing-cabinet/competitors` | [create_competitor](../../shared/api/routers/marketing_cabinet/competitors.py#L251) | `MarketingCompetitorOut` |
| `DELETE` | `/api/v1/marketing-cabinet/competitors/{competitor_id}` | [delete_competitor](../../shared/api/routers/marketing_cabinet/competitors.py#L381) | `DeleteCompetitorResponse` |
| `PATCH` | `/api/v1/marketing-cabinet/competitors/{competitor_id}` | [update_competitor](../../shared/api/routers/marketing_cabinet/competitors.py#L317) | `MarketingCompetitorOut` |
| `GET` | `/api/v1/marketing-cabinet/dashboard-layout-templates` | [list_dashboard_layout_templates](../../shared/api/routers/marketing_cabinet/dashboard_layout_templates.py#L60) | `DashboardLayoutListResponse` |
| `POST` | `/api/v1/marketing-cabinet/dashboard-layout-templates/from-project/{project_id}` | [save_dashboard_layout_template_from_project](../../shared/api/routers/marketing_cabinet/dashboard_layout_templates.py#L76) | `DashboardLayoutResponse` |
| `DELETE` | `/api/v1/marketing-cabinet/dashboard-layout-templates/{template_id}` | [delete_dashboard_layout_template](../../shared/api/routers/marketing_cabinet/dashboard_layout_templates.py#L96) | `None` |
| `GET` | `/api/v1/marketing-cabinet/funnels` | [list_funnels](../../shared/api/routers/marketing_cabinet/funnels.py#L155) | `MarketingFunnelListResponse` |
| `POST` | `/api/v1/marketing-cabinet/funnels` | [create_funnel](../../shared/api/routers/marketing_cabinet/funnels.py#L212) | `MarketingFunnelOut` |
| `DELETE` | `/api/v1/marketing-cabinet/funnels/{funnel_id}` | [delete_funnel](../../shared/api/routers/marketing_cabinet/funnels.py#L320) | `DeleteMarketingFunnelResponse` |
| `PATCH` | `/api/v1/marketing-cabinet/funnels/{funnel_id}` | [update_funnel](../../shared/api/routers/marketing_cabinet/funnels.py#L262) | `MarketingFunnelOut` |
| `GET` | `/api/v1/marketing-cabinet/imc/company/{company_id}/researches` | [list_imc_researches_for_company](../../shared/api/routers/marketing_cabinet/imc.py#L246) | `ImcResearchListResponse` |
| `GET` | `/api/v1/marketing-cabinet/imc/project/{project_id}/rag-hints` | [get_imc_project_rag_hints](../../shared/api/routers/marketing_cabinet/imc.py#L79) | `ImcRagHintsResponse` |
| `GET` | `/api/v1/marketing-cabinet/imc/project/{project_id}/researches` | [list_imc_researches_for_project](../../shared/api/routers/marketing_cabinet/imc.py#L271) | `ImcResearchListResponse` |
| `POST` | `/api/v1/marketing-cabinet/imc/research/run` | [run_imc_research](../../shared/api/routers/marketing_cabinet/imc.py#L98) | `ImcRunResearchResponse` |
| `DELETE` | `/api/v1/marketing-cabinet/imc/research/{research_id}` | [delete_imc_research](../../shared/api/routers/marketing_cabinet/imc.py#L317) | `ImcResearchDeleteResponse` |
| `GET` | `/api/v1/marketing-cabinet/imc/research/{research_id}` | [get_imc_research](../../shared/api/routers/marketing_cabinet/imc.py#L233) | `ImcResearchRunDetail` |
| `POST` | `/api/v1/marketing-cabinet/imc/research/{research_id}/cancel` | [cancel_imc_research](../../shared/api/routers/marketing_cabinet/imc.py#L296) | `ImcCancelResponse` |
| `POST` | `/api/v1/marketing-cabinet/imc/research/{research_id}/rerun` | [rerun_imc_research](../../shared/api/routers/marketing_cabinet/imc.py#L168) | `ImcRunResearchResponse` |
| `GET` | `/api/v1/marketing-cabinet/imc/research/{research_id}/status` | [get_imc_research_status](../../shared/api/routers/marketing_cabinet/imc.py#L220) | `ImcResearchStatusResponse` |
| `GET` | `/api/v1/marketing-cabinet/imc/types` | [list_imc_types](../../shared/api/routers/marketing_cabinet/imc.py#L71) | `ImcResearchTypesResponse` |
| `POST` | `/api/v1/marketing-cabinet/jtbd/extract` | [extract_job_stories](../../shared/api/routers/marketing_cabinet/jtbd.py#L847) | `MarketingJobStoryListResponse` |
| `POST` | `/api/v1/marketing-cabinet/jtbd/extract/async` | [start_extract_job_stories_async](../../shared/api/routers/marketing_cabinet/jtbd.py#L722) | `MarketingAiAsyncStartResponse` |
| `GET` | `/api/v1/marketing-cabinet/jtbd/job-stories` | [list_job_stories](../../shared/api/routers/marketing_cabinet/jtbd.py#L490) | `MarketingJobStoryListResponse` |
| `POST` | `/api/v1/marketing-cabinet/jtbd/job-stories` | [create_job_story](../../shared/api/routers/marketing_cabinet/jtbd.py#L563) | `MarketingJobStoryOut` |
| `DELETE` | `/api/v1/marketing-cabinet/jtbd/job-stories/{story_id}` | [delete_job_story](../../shared/api/routers/marketing_cabinet/jtbd.py#L696) | `DeleteJobStoryResponse` |
| `PATCH` | `/api/v1/marketing-cabinet/jtbd/job-stories/{story_id}` | [update_job_story](../../shared/api/routers/marketing_cabinet/jtbd.py#L592) | `MarketingJobStoryOut` |
| `GET` | `/api/v1/marketing-cabinet/operations/alerts` | [list_alerts](../../shared/api/routers/marketing_cabinet/operations.py#L460) | `MarketingAlertListResponse` |
| `POST` | `/api/v1/marketing-cabinet/operations/alerts` | [create_alert](../../shared/api/routers/marketing_cabinet/operations.py#L505) | `MarketingAlertOut` |
| `DELETE` | `/api/v1/marketing-cabinet/operations/alerts/{alert_id}` | [delete_alert](../../shared/api/routers/marketing_cabinet/operations.py#L606) | `DeleteMarketingAlertResponse` |
| `PATCH` | `/api/v1/marketing-cabinet/operations/alerts/{alert_id}` | [update_alert](../../shared/api/routers/marketing_cabinet/operations.py#L563) | `MarketingAlertOut` |
| `POST` | `/api/v1/marketing-cabinet/operations/remediation-actions` | [create_remediation_actions](../../shared/api/routers/marketing_cabinet/operations.py#L626) | `MarketingRemediationActionResponse` |
| `GET` | `/api/v1/marketing-cabinet/operations/tasks` | [list_tasks](../../shared/api/routers/marketing_cabinet/operations.py#L294) | `MarketingTaskListResponse` |
| `POST` | `/api/v1/marketing-cabinet/operations/tasks` | [create_task](../../shared/api/routers/marketing_cabinet/operations.py#L335) | `MarketingTaskOut` |
| `DELETE` | `/api/v1/marketing-cabinet/operations/tasks/{task_id}` | [delete_task](../../shared/api/routers/marketing_cabinet/operations.py#L440) | `DeleteMarketingTaskResponse` |
| `PATCH` | `/api/v1/marketing-cabinet/operations/tasks/{task_id}` | [update_task](../../shared/api/routers/marketing_cabinet/operations.py#L396) | `MarketingTaskOut` |
| `GET` | `/api/v1/marketing-cabinet/projects/{project_id}/customer-diagnostic/admin/overview` | [get_diagnostic_admin_overview](../../shared/api/routers/marketing_cabinet/customer_diagnostic.py#L1110) | `DiagnosticOverviewResponse` |
| `POST` | `/api/v1/marketing-cabinet/projects/{project_id}/customer-diagnostic/full-reset` | [full_diagnostic_reset](../../shared/api/routers/marketing_cabinet/customer_diagnostic.py#L965) | `MarketingDiagnosticFullResetOut` |
| `GET` | `/api/v1/marketing-cabinet/projects/{project_id}/customer-diagnostic/history` | [get_diagnostic_history](../../shared/api/routers/marketing_cabinet/customer_diagnostic.py#L1183) | `DiagnosticHistoryResponse` |
| `POST` | `/api/v1/marketing-cabinet/projects/{project_id}/customer-diagnostic/retake-request` | [create_retake_request](../../shared/api/routers/marketing_cabinet/customer_diagnostic.py#L823) | `RetakeRequestItem` |
| `POST` | `/api/v1/marketing-cabinet/projects/{project_id}/customer-diagnostic/retake-requests/{request_id}/resolve` | [resolve_retake_request](../../shared/api/routers/marketing_cabinet/customer_diagnostic.py#L900) | `RetakeRequestItem` |
| `GET` | `/api/v1/marketing-cabinet/projects/{project_id}/customer-diagnostic/session` | [get_customer_diagnostic_session](../../shared/api/routers/marketing_cabinet/customer_diagnostic.py#L629) | `CustomerDiagnosticSessionResponse` |
| `PATCH` | `/api/v1/marketing-cabinet/projects/{project_id}/customer-diagnostic/session` | [patch_customer_diagnostic_session](../../shared/api/routers/marketing_cabinet/customer_diagnostic.py#L712) | `CustomerDiagnosticSessionResponse` |
| `GET` | `/api/v1/marketing-cabinet/projects/{project_id}/customer-diagnostic/settings` | [get_customer_diagnostic_settings](../../shared/api/routers/marketing_cabinet/customer_diagnostic.py#L555) | `CustomerDiagnosticSettingsResponse` |
| `PATCH` | `/api/v1/marketing-cabinet/projects/{project_id}/customer-diagnostic/settings` | [patch_customer_diagnostic_settings](../../shared/api/routers/marketing_cabinet/customer_diagnostic.py#L576) | `CustomerDiagnosticSettingsResponse` |
| `GET` | `/api/v1/marketing-cabinet/projects/{project_id}/dashboard` | [get_project_dashboard](../../shared/api/routers/marketing_cabinet/projects.py#L110) | `MarketingProjectDashboardResponse` |
| `GET` | `/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts` | [list_dashboard_layouts](../../shared/api/routers/marketing_cabinet/dashboard.py#L112) | `DashboardLayoutListResponse` |
| `POST` | `/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts` | [create_dashboard_layout](../../shared/api/routers/marketing_cabinet/dashboard.py#L208) | `DashboardLayoutResponse` |
| `GET` | `/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts/active` | [get_active_dashboard_layout](../../shared/api/routers/marketing_cabinet/dashboard.py#L133) | `DashboardLayoutResponse \| None` |
| `POST` | `/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts/from-preset` | [create_dashboard_layout_from_preset](../../shared/api/routers/marketing_cabinet/dashboard.py#L143) | `DashboardLayoutResponse` |
| `POST` | `/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts/from-template` | [apply_dashboard_layout_template](../../shared/api/routers/marketing_cabinet/dashboard.py#L189) | `DashboardLayoutResponse` |
| `POST` | `/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts/import` | [import_dashboard_layout](../../shared/api/routers/marketing_cabinet/dashboard.py#L163) | `DashboardLayoutResponse` |
| `POST` | `/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts/widgets` | [add_dashboard_widget](../../shared/api/routers/marketing_cabinet/dashboard.py#L313) | `WidgetResponse` |
| `DELETE` | `/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts/{layout_id}` | [delete_dashboard_layout](../../shared/api/routers/marketing_cabinet/dashboard.py#L261) | `None` |
| `GET` | `/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts/{layout_id}` | [get_dashboard_layout](../../shared/api/routers/marketing_cabinet/dashboard.py#L226) | `DashboardLayoutResponse` |
| `PATCH` | `/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts/{layout_id}` | [update_dashboard_layout](../../shared/api/routers/marketing_cabinet/dashboard.py#L242) | `DashboardLayoutResponse` |
| `POST` | `/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts/{layout_id}/activate` | [activate_dashboard_layout](../../shared/api/routers/marketing_cabinet/dashboard.py#L278) | `DashboardActivateResponse` |
| `POST` | `/api/v1/marketing-cabinet/projects/{project_id}/dashboard-layouts/{layout_id}/clone` | [clone_dashboard_layout](../../shared/api/routers/marketing_cabinet/dashboard.py#L295) | `DashboardCloneResponse` |
| `GET` | `/api/v1/marketing-cabinet/projects/{project_id}/dashboard-presets` | [list_dashboard_presets](../../shared/api/routers/marketing_cabinet/dashboard.py#L100) | `MarketingDashboardPresetListResponse` |
| `GET` | `/api/v1/marketing-cabinet/projects/{project_id}/dashboard-usage-stats` | [get_dashboard_usage_stats](../../shared/api/routers/marketing_cabinet/dashboard.py#L403) | `DashboardUsageStats` |
| `POST` | `/api/v1/marketing-cabinet/projects/{project_id}/dashboard-widgets/cleanup-duplicates` | [cleanup_dashboard_duplicate_widgets](../../shared/api/routers/marketing_cabinet/dashboard.py#L390) | `DashboardCleanupDuplicatesResponse` |
| `DELETE` | `/api/v1/marketing-cabinet/projects/{project_id}/dashboard-widgets/{widget_id}` | [delete_dashboard_widget](../../shared/api/routers/marketing_cabinet/dashboard.py#L368) | `None` |
| `PATCH` | `/api/v1/marketing-cabinet/projects/{project_id}/dashboard-widgets/{widget_id}` | [update_dashboard_widget](../../shared/api/routers/marketing_cabinet/dashboard.py#L349) | `WidgetResponse` |
| `GET` | `/api/v1/marketing-cabinet/projects/{project_id}/graph` | [get_project_graph](../../shared/api/routers/marketing_cabinet/projects.py#L210) | `MarketingProjectGraphResponse` |
| `GET` | `/api/v1/marketing-cabinet/projects/{project_id}/health` | [get_project_health](../../shared/api/routers/marketing_cabinet/projects.py#L90) | `MarketingProjectHealthResponse` |
| `GET` | `/api/v1/marketing-cabinet/projects/{project_id}/live-jobs-summary` | [get_project_live_jobs_summary](../../shared/api/routers/marketing_cabinet/projects.py#L73) | `MarketingProjectLiveJobsSummaryResponse` |
| `GET` | `/api/v1/marketing-cabinet/projects/{project_id}/overview` | [get_project_overview](../../shared/api/routers/marketing_cabinet/projects.py#L100) | `MarketingProjectOverviewResponse` |
| `GET` | `/api/v1/marketing-cabinet/projects/{project_id}/performance-dashboard` | [get_project_performance_dashboard](../../shared/api/routers/marketing_cabinet/projects.py#L159) | `MarketingPerformanceDashboardResponse` |
| `GET` | `/api/v1/marketing-cabinet/projects/{project_id}/rag-sources` | [get_project_rag_sources](../../shared/api/routers/marketing_cabinet/project_rag_sources.py#L46) | `MarketingRagSourceListResponse` |
| `PATCH` | `/api/v1/marketing-cabinet/projects/{project_id}/rag-sources/content/{content_id}` | [patch_project_rag_source](../../shared/api/routers/marketing_cabinet/project_rag_sources.py#L99) | `PatchMarketingRagSourceResponse` |
| `POST` | `/api/v1/marketing-cabinet/projects/{project_id}/rag-sources/from-imc-run/{imc_research_run_id}` | [post_imc_run_to_project_rag](../../shared/api/routers/marketing_cabinet/project_rag_sources.py#L139) | `PostImcRunToProjectRagResponse` |
| `GET` | `/api/v1/marketing-cabinet/projects/{project_id}/rag-sources/semantic-search` | [semantic_search_project_rag](../../shared/api/routers/marketing_cabinet/project_rag_sources.py#L59) | `MarketingRagSemanticSearchResponse` |
| `GET` | `/api/v1/marketing-cabinet/researches` | [list_researches](../../shared/api/routers/marketing_cabinet/researches.py#L309) | `MarketingResearchListResponse` |
| `POST` | `/api/v1/marketing-cabinet/researches` | [create_research](../../shared/api/routers/marketing_cabinet/researches.py#L356) | `MarketingResearchOut` |
| `GET` | `/api/v1/marketing-cabinet/researches/types` | [list_research_types](../../shared/api/routers/marketing_cabinet/researches.py#L302) | `ResearchTypesResponse` |
| `DELETE` | `/api/v1/marketing-cabinet/researches/{research_id}` | [delete_research](../../shared/api/routers/marketing_cabinet/researches.py#L841) | `DeleteResearchResponse` |
| `PATCH` | `/api/v1/marketing-cabinet/researches/{research_id}` | [update_research](../../shared/api/routers/marketing_cabinet/researches.py#L421) | `MarketingResearchOut` |
| `POST` | `/api/v1/marketing-cabinet/researches/{research_id}/run` | [run_research](../../shared/api/routers/marketing_cabinet/researches.py#L705) | `MarketingResearchOut` |
| `POST` | `/api/v1/marketing-cabinet/researches/{research_id}/run/async` | [run_research_async](../../shared/api/routers/marketing_cabinet/researches.py#L492) | `MarketingAiAsyncStartResponse` |
| `GET` | `/api/v1/marketing-cabinet/segments` | [list_segments](../../shared/api/routers/marketing_cabinet/segments.py#L88) | `MarketingSegmentListResponse` |
| `POST` | `/api/v1/marketing-cabinet/segments` | [create_segment](../../shared/api/routers/marketing_cabinet/segments.py#L123) | `MarketingSegmentOut` |
| `DELETE` | `/api/v1/marketing-cabinet/segments/{segment_id}` | [delete_segment](../../shared/api/routers/marketing_cabinet/segments.py#L259) | `DeleteMarketingSegmentResponse` |
| `PATCH` | `/api/v1/marketing-cabinet/segments/{segment_id}` | [update_segment](../../shared/api/routers/marketing_cabinet/segments.py#L198) | `MarketingSegmentOut` |
| `GET` | `/api/v1/marketing-cabinet/value-propositions` | [list_value_propositions](../../shared/api/routers/marketing_cabinet/value_proposition.py#L224) | `MarketingValuePropositionListResponse` |
| `POST` | `/api/v1/marketing-cabinet/value-propositions` | [create_value_proposition](../../shared/api/routers/marketing_cabinet/value_proposition.py#L282) | `MarketingValuePropositionOut` |
| `DELETE` | `/api/v1/marketing-cabinet/value-propositions/{value_prop_id}` | [delete_value_proposition](../../shared/api/routers/marketing_cabinet/value_proposition.py#L447) | `DeleteValuePropositionResponse` |
| `GET` | `/api/v1/marketing-cabinet/value-propositions/{value_prop_id}` | [get_value_proposition](../../shared/api/routers/marketing_cabinet/value_proposition.py#L265) | `MarketingValuePropositionOut` |
| `PATCH` | `/api/v1/marketing-cabinet/value-propositions/{value_prop_id}` | [update_value_proposition](../../shared/api/routers/marketing_cabinet/value_proposition.py#L365) | `MarketingValuePropositionOut` |

## /api/v1/mobile-app

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/mobile-app/download` | [download_mobile_apk](../../shared/api/routers/mobile_app.py#L404) | `FileResponse` |
| `GET` | `/api/v1/mobile-app/download-by-ticket` | [download_mobile_apk_by_ticket](../../shared/api/routers/mobile_app.py#L499) | `FileResponse` |
| `POST` | `/api/v1/mobile-app/download-ticket` | [create_mobile_apk_download_ticket](../../shared/api/routers/mobile_app.py#L420) | `MobileAppDownloadTicketResponse` |
| `GET` | `/api/v1/mobile-app/overview` | [mobile_app_overview](../../shared/api/routers/mobile_app.py#L313) | `MobileAppOverviewResponse` |
| `GET` | `/api/v1/mobile-app/profile` | [read_mobile_profile](../../shared/api/routers/mobile_app.py#L474) | `MobileProfileResponse` |
| `PATCH` | `/api/v1/mobile-app/profile` | [patch_mobile_profile](../../shared/api/routers/mobile_app.py#L486) | `MobileProfileResponse` |
| `PUT` | `/api/v1/mobile-app/realtime-state` | [put_mobile_realtime_state](../../shared/api/routers/mobile_app.py#L461) | `MobileAppRealtimeStateResponse` |
| `POST` | `/api/v1/mobile-app/support-reports` | [submit_mobile_support_report](../../shared/api/routers/mobile_app.py#L435) | `MobileSupportReportResponse` |

## /api/v1/mobile-devices

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/mobile-devices` | [list_trusted_devices](../../shared/api/routers/mobile_trusted_devices.py#L167) | `MobileTrustedDeviceListResponse` |
| `GET` | `/api/v1/mobile-devices/active/tunnel-metadata` | [get_active_tunnel_metadata](../../shared/api/routers/mobile_trusted_devices.py#L182) | `MobileActiveTunnelMetadataResponse` |
| `GET` | `/api/v1/mobile-devices/admin/transfers` | [admin_list_transfer_requests](../../shared/api/routers/mobile_trusted_devices.py#L305) | `MobileDeviceTransferListResponse` |
| `POST` | `/api/v1/mobile-devices/admin/transfers/{transfer_id}/approve` | [admin_approve_transfer_request](../../shared/api/routers/mobile_trusted_devices.py#L317) | `MobileDeviceTransferResponse` |
| `POST` | `/api/v1/mobile-devices/admin/transfers/{transfer_id}/reject` | [admin_reject_transfer_request](../../shared/api/routers/mobile_trusted_devices.py#L335) | `MobileDeviceTransferResponse` |
| `GET` | `/api/v1/mobile-devices/admin/users/{user_id}/audit` | [admin_list_user_trusted_device_audit](../../shared/api/routers/mobile_trusted_devices.py#L295) | `MobileDeviceAuditEventListResponse` |
| `GET` | `/api/v1/mobile-devices/admin/users/{user_id}/devices` | [admin_list_user_trusted_devices](../../shared/api/routers/mobile_trusted_devices.py#L284) | `MobileTrustedDeviceListResponse` |
| `POST` | `/api/v1/mobile-devices/bind` | [bind_trusted_device](../../shared/api/routers/mobile_trusted_devices.py#L150) | `MobileTrustedDeviceBindResponse` |
| `POST` | `/api/v1/mobile-devices/pairing-challenges` | [create_pairing_challenge](../../shared/api/routers/mobile_trusted_devices.py#L112) | `MobileDevicePairingChallengeResponse` |
| `POST` | `/api/v1/mobile-devices/pairing-challenges/resolve` | [resolve_pairing_challenge](../../shared/api/routers/mobile_trusted_devices.py#L132) | `MobileDevicePairingChallengeResolveResponse` |
| `GET` | `/api/v1/mobile-devices/transfer` | [list_transfer_requests](../../shared/api/routers/mobile_trusted_devices.py#L196) | `MobileDeviceTransferListResponse` |
| `POST` | `/api/v1/mobile-devices/transfer/start` | [start_transfer_request](../../shared/api/routers/mobile_trusted_devices.py#L206) | `MobileDeviceTransferResponse` |
| `POST` | `/api/v1/mobile-devices/transfer/{transfer_id}/complete` | [complete_transfer_request](../../shared/api/routers/mobile_trusted_devices.py#L265) | `MobileDeviceTransferCompleteResponse` |
| `POST` | `/api/v1/mobile-devices/transfer/{transfer_id}/confirm-email` | [confirm_transfer_email](../../shared/api/routers/mobile_trusted_devices.py#L245) | `MobileDeviceTransferResponse` |
| `POST` | `/api/v1/mobile-devices/transfer/{transfer_id}/confirm-old` | [confirm_transfer_old_device](../../shared/api/routers/mobile_trusted_devices.py#L225) | `MobileDeviceTransferResponse` |
| `POST` | `/api/v1/mobile-devices/{device_id}/revoke` | [revoke_trusted_device](../../shared/api/routers/mobile_trusted_devices.py#L355) | `MobileTrustedDeviceBindResponse` |
| `POST` | `/api/v1/mobile-devices/{device_id}/rotate-wg` | [rotate_trusted_device_wg_key](../../shared/api/routers/mobile_trusted_devices.py#L397) | `MobileTrustedDeviceRotateWgResponse` |

## /api/v1/monitoring

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `POST` | `/api/v1/monitoring/logs` | [ingest_client_logs](../../shared/api/main.py#L675) | `dict[str, Any]` |

## /api/v1/music-evolution

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/music-evolution/capabilities` | [music_evolution_capabilities](../../shared/api/routers/music_evolution.py#L57) | `MusicEvolutionCapabilitiesOut` |
| `POST` | `/api/v1/music-evolution/runs` | [create_music_evolution_run](../../shared/api/routers/music_evolution.py#L120) | `MusicEvolutionRunCreateOut` |
| `GET` | `/api/v1/music-evolution/runs/{run_id}` | [get_music_evolution_run](../../shared/api/routers/music_evolution.py#L147) | `MusicEvolutionRunOut` |
| `POST` | `/api/v1/music-evolution/runs/{run_id}/cancel` | [cancel_music_evolution_run](../../shared/api/routers/music_evolution.py#L201) | `MusicEvolutionRunOut` |
| `GET` | `/api/v1/music-evolution/runs/{run_id}/events` | [stream_music_evolution_run_events](../../shared/api/routers/music_evolution.py#L187) | `StreamingResponse` |
| `POST` | `/api/v1/music-evolution/runs/{run_id}/feedback` | [record_music_evolution_feedback](../../shared/api/routers/music_evolution.py#L211) | `MusicEvolutionFeedbackOut` |
| `OPTIONS` | `/api/v1/music-evolution/{path:path}` | [options_music_evolution](../../shared/api/routers/music_evolution.py#L231) | `Response` |

## /api/v1/music-forge

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/music-forge/admin/config/revisions` | [music_forge_admin_list_config_revisions](../../shared/api/routers/music_forge_admin.py#L350) | `MusicForgeAdminConfigRevisionListOut` |
| `POST` | `/api/v1/music-forge/admin/config/revisions/draft` | [music_forge_admin_create_config_draft](../../shared/api/routers/music_forge_admin.py#L377) | `MusicForgeAdminConfigRevisionOut` |
| `POST` | `/api/v1/music-forge/admin/config/revisions/purge-retired` | [music_forge_admin_purge_retired_config_revisions](../../shared/api/routers/music_forge_admin.py#L408) | `MusicForgeAdminConfigPurgeRetiredOut` |
| `GET` | `/api/v1/music-forge/admin/config/revisions/{revision_id}` | [music_forge_admin_get_config_revision](../../shared/api/routers/music_forge_admin.py#L458) | `MusicForgeAdminConfigRevisionDetailOut` |
| `POST` | `/api/v1/music-forge/admin/config/revisions/{revision_id}/activate` | [music_forge_admin_activate_config_revision](../../shared/api/routers/music_forge_admin.py#L800) | `MusicForgeAdminConfigActivateOut` |
| `GET` | `/api/v1/music-forge/admin/config/revisions/{revision_id}/diff` | [music_forge_admin_diff_config_revision](../../shared/api/routers/music_forge_admin.py#L491) | `MusicForgeAdminConfigDiffOut` |
| `PATCH` | `/api/v1/music-forge/admin/config/revisions/{revision_id}/lanes/{lane_key}` | [music_forge_admin_patch_config_lane](../../shared/api/routers/music_forge_admin.py#L557) | `MusicForgeAdminLaneOut` |
| `POST` | `/api/v1/music-forge/admin/config/revisions/{revision_id}/modes` | [music_forge_admin_create_config_mode](../../shared/api/routers/music_forge_admin.py#L631) | `MusicForgeAdminModeOut` |
| `DELETE` | `/api/v1/music-forge/admin/config/revisions/{revision_id}/modes/{mode_key}` | [music_forge_admin_delete_config_mode](../../shared/api/routers/music_forge_admin.py#L682) | `MusicForgeAdminModeDeleteOut` |
| `PATCH` | `/api/v1/music-forge/admin/config/revisions/{revision_id}/modes/{mode_key}` | [music_forge_admin_patch_config_mode](../../shared/api/routers/music_forge_admin.py#L661) | `MusicForgeAdminModeOut` |
| `POST` | `/api/v1/music-forge/admin/config/revisions/{revision_id}/modes/{mode_key}/stages` | [music_forge_admin_create_config_stage](../../shared/api/routers/music_forge_admin.py#L724) | `MusicForgeAdminStageOut` |
| `DELETE` | `/api/v1/music-forge/admin/config/revisions/{revision_id}/modes/{mode_key}/stages/{stage_key}` | [music_forge_admin_delete_config_stage](../../shared/api/routers/music_forge_admin.py#L753) | `MusicForgeAdminStageDeleteOut` |
| `PATCH` | `/api/v1/music-forge/admin/config/revisions/{revision_id}/modes/{mode_key}/stages/{stage_key}` | [music_forge_admin_patch_config_stage](../../shared/api/routers/music_forge_admin.py#L701) | `MusicForgeAdminStageOut` |
| `POST` | `/api/v1/music-forge/admin/config/revisions/{revision_id}/preview-audio-payload` | [music_forge_admin_preview_audio_payload](../../shared/api/routers/music_forge_admin.py#L773) | `MusicForgeAdminPreviewAudioOut` |
| `PATCH` | `/api/v1/music-forge/admin/config/revisions/{revision_id}/product` | [music_forge_admin_patch_config_product](../../shared/api/routers/music_forge_admin.py#L537) | `MusicForgeAdminProductOut` |
| `PATCH` | `/api/v1/music-forge/admin/config/revisions/{revision_id}/prompts/{kind}` | [music_forge_admin_patch_config_prompt](../../shared/api/routers/music_forge_admin.py#L578) | `MusicForgeAdminPromptOut` |
| `PATCH` | `/api/v1/music-forge/admin/config/revisions/{revision_id}/styles/{style_key}` | [music_forge_admin_patch_config_style](../../shared/api/routers/music_forge_admin.py#L599) | `MusicForgeAdminStyleOut` |
| `PATCH` | `/api/v1/music-forge/admin/config/revisions/{revision_id}/version` | [music_forge_admin_rename_config_revision](../../shared/api/routers/music_forge_admin.py#L424) | `MusicForgeAdminConfigRevisionOut` |
| `GET` | `/api/v1/music-forge/admin/config/stage-types` | [music_forge_admin_list_stage_types](../../shared/api/routers/music_forge_admin.py#L617) | `MusicForgeAdminStageTypesOut` |
| `GET` | `/api/v1/music-forge/admin/feedback/stats` | [music_forge_admin_feedback_stats](../../shared/api/routers/music_forge_admin.py#L268) | `MusicForgeAdminFeedbackStatsOut` |
| `GET` | `/api/v1/music-forge/admin/probe/comfy` | [music_forge_admin_probe_comfy](../../shared/api/routers/music_forge_admin.py#L318) | `MusicForgeAdminComfyProbeOut` |
| `GET` | `/api/v1/music-forge/admin/runs` | [music_forge_admin_list_runs](../../shared/api/routers/music_forge_admin.py#L176) | `MusicForgeAdminRunListOut` |
| `GET` | `/api/v1/music-forge/admin/runs/{run_id}` | [music_forge_admin_get_run](../../shared/api/routers/music_forge_admin.py#L228) | `MusicForgeAdminRunDetailOut` |
| `GET` | `/api/v1/music-forge/admin/stats/overview` | [music_forge_admin_stats_overview](../../shared/api/routers/music_forge_admin.py#L89) | `MusicForgeAdminOverviewOut` |
| `GET` | `/api/v1/music-forge/capabilities` | [music_forge_capabilities](../../shared/api/routers/music_forge.py#L58) | `MusicForgeCapabilitiesOut` |
| `POST` | `/api/v1/music-forge/runs` | [create_music_forge_run](../../shared/api/routers/music_forge.py#L95) | `MusicForgeRunCreateOut` |
| `GET` | `/api/v1/music-forge/runs/{run_id}` | [get_music_forge_run](../../shared/api/routers/music_forge.py#L167) | `MusicForgeRunOut` |
| `POST` | `/api/v1/music-forge/runs/{run_id}/cancel` | [cancel_music_forge_run](../../shared/api/routers/music_forge.py#L237) | `MusicForgeRunOut` |
| `GET` | `/api/v1/music-forge/runs/{run_id}/events` | [stream_music_forge_run_events](../../shared/api/routers/music_forge.py#L223) | `StreamingResponse` |
| `POST` | `/api/v1/music-forge/runs/{run_id}/feedback` | [record_music_forge_feedback](../../shared/api/routers/music_forge.py#L250) | `MusicForgeFeedbackOut` |
| `POST` | `/api/v1/music-forge/runs/{run_id}/rewrite-lyrics` | [rewrite_music_forge_lyrics](../../shared/api/routers/music_forge.py#L132) | `MusicForgeLyricsRewriteOut` |

## /api/v1/music-generator

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/music-generator/batch-tests/approaches` | [list_music_batch_approaches](../../shared/api/routers/music_batch_tests.py#L115) | `MusicBatchApproachListResponse` |
| `POST` | `/api/v1/music-generator/batch-tests/approaches` | [create_music_batch_approach](../../shared/api/routers/music_batch_tests.py#L56) | `MusicBatchCreateResponse` |
| `POST` | `/api/v1/music-generator/batch-tests/approaches/from-liked-recipes` | [create_music_batch_approach_from_liked_recipes](../../shared/api/routers/music_batch_tests.py#L87) | `MusicBatchCreateResponse` |
| `GET` | `/api/v1/music-generator/batch-tests/approaches/{approach_id}` | [get_music_batch_approach](../../shared/api/routers/music_batch_tests.py#L126) | `MusicBatchApproachDetail` |
| `PATCH` | `/api/v1/music-generator/batch-tests/approaches/{approach_id}` | [rename_music_batch_approach](../../shared/api/routers/music_batch_tests.py#L139) | `MusicBatchApproachSummary` |
| `POST` | `/api/v1/music-generator/batch-tests/approaches/{approach_id}/cancel` | [cancel_music_batch_approach](../../shared/api/routers/music_batch_tests.py#L153) | `MusicBatchApproachSummary` |
| `GET` | `/api/v1/music-generator/batch-tests/capabilities` | [get_music_batch_capabilities](../../shared/api/routers/music_batch_tests.py#L49) | `dict` |
| `PATCH` | `/api/v1/music-generator/batch-tests/generations/{generation_id}/feedback` | [patch_music_batch_generation_feedback](../../shared/api/routers/music_batch_tests.py#L193) | `MusicBatchGenerationSummary` |
| `GET` | `/api/v1/music-generator/batch-tests/generations/{generation_id}/payload` | [get_music_batch_generation_payload](../../shared/api/routers/music_batch_tests.py#L166) | `MusicBatchGenerationPayloadResponse` |
| `GET` | `/api/v1/music-generator/batch-tests/generations/{generation_id}/xl-apply` | [get_music_batch_generation_xl_apply](../../shared/api/routers/music_batch_tests.py#L179) | `MusicBatchXlStudioApplyResponse` |
| `POST` | `/api/v1/music-generator/edit` | [edit_music](../../shared/api/routers/music_generator_generate.py#L771) | `dict` |
| `POST` | `/api/v1/music-generator/generate` | [generate_music](../../shared/api/routers/music_generator_generate.py#L140) | `dict` |
| `POST` | `/api/v1/music-generator/generate-style` | [generate_style](../../shared/api/routers/music_generator.py#L210) | `dict` |
| `POST` | `/api/v1/music-generator/improve-lyrics` | [improve_lyrics](../../shared/api/routers/music_generator_lyrics_routes.py#L454) | `dict` |
| `POST` | `/api/v1/music-generator/lyrics` | [generate_lyrics](../../shared/api/routers/music_generator_lyrics_routes.py#L130) | `dict` |
| `POST` | `/api/v1/music-generator/promo-script` | [generate_promo_script](../../shared/api/routers/music_generator.py#L655) | `dict` |
| `POST` | `/api/v1/music-generator/record-dislike-feedback` | [record_dislike_feedback](../../shared/api/routers/music_generator.py#L566) | `Response` |
| `POST` | `/api/v1/music-generator/record-like-recipe` | [record_like_recipe](../../shared/api/routers/music_generator.py#L537) | `Response` |
| `POST` | `/api/v1/music-generator/suggest-production-params` | [suggest_production_params](../../shared/api/routers/music_generator.py#L447) | `SuggestProductionParamsResponse` |
| `POST` | `/api/v1/music-generator/v3/generate` | [generate_v3_music](../../shared/api/routers/music_generator_v3.py#L413) | `dict[str, str]` |
| `POST` | `/api/v1/music-generator/v3/generate-style` | [generate_v3_style](../../shared/api/routers/music_generator_v3.py#L364) | `dict[str, str]` |
| `POST` | `/api/v1/music-generator/v3/lyrics` | [generate_v3_lyrics](../../shared/api/routers/music_generator_v3.py#L268) | `dict[str, Any]` |
| `POST` | `/api/v1/music-generator/v3/suggest-production-params` | [suggest_v3_production_params](../../shared/api/routers/music_generator_v3.py#L308) | `MusicGeneratorV3SuggestResponse` |
| `POST` | `/api/v1/music-generator/validate-lyrics` | [validate_lyrics_endpoint](../../shared/api/routers/music_generator.py#L518) | `dict` |

## /api/v1/paperless

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/paperless/documents` | [list_paperless_documents](../../shared/api/routers/paperless_integration.py#L75) | `PaperlessDocumentListResponse` |
| `GET` | `/api/v1/paperless/health` | [paperless_health](../../shared/api/routers/paperless_integration.py#L67) | `PaperlessHealthResponse` |
| `POST` | `/api/v1/paperless/import/{paperless_id}/doc-editor-v2` | [import_paperless_to_doc_editor_v2](../../shared/api/routers/paperless_integration.py#L127) | `dict` |
| `POST` | `/api/v1/paperless/import/{paperless_id}/elite-editor` | [import_paperless_to_elite_editor](../../shared/api/routers/paperless_integration.py#L106) | `dict` |

## /api/v1/ping

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/ping` | [api_v1_ping](../../shared/api/main.py#L658) | `dict[str, Any]` |

## /api/v1/product-desktop

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/product-desktop/admin/assistant/faq` | [admin_list_faq](../../shared/api/routers/product_desktop_assistant.py#L923) | `list[AssistantFaqEntryOut]` |
| `POST` | `/api/v1/product-desktop/admin/assistant/faq` | [admin_create_faq](../../shared/api/routers/product_desktop_assistant.py#L940) | `AssistantFaqEntryOut` |
| `DELETE` | `/api/v1/product-desktop/admin/assistant/faq/{faq_id}` | [admin_delete_faq](../../shared/api/routers/product_desktop_assistant.py#L1002) | `None` |
| `PATCH` | `/api/v1/product-desktop/admin/assistant/faq/{faq_id}` | [admin_update_faq](../../shared/api/routers/product_desktop_assistant.py#L961) | `AssistantFaqEntryOut` |
| `GET` | `/api/v1/product-desktop/admin/assistant/kb` | [admin_list_kb_documents](../../shared/api/routers/product_desktop_assistant_kb.py#L363) | `list[AssistantKbDocumentOut]` |
| `POST` | `/api/v1/product-desktop/admin/assistant/kb` | [admin_create_kb_document](../../shared/api/routers/product_desktop_assistant_kb.py#L412) | `AssistantKbDocumentOut` |
| `POST` | `/api/v1/product-desktop/admin/assistant/kb/purge` | [admin_purge_kb_documents_and_rag](../../shared/api/routers/product_desktop_assistant_kb.py#L584) | `AssistantKbPurgeOut` |
| `POST` | `/api/v1/product-desktop/admin/assistant/kb/reindex-all` | [admin_reindex_all_kb_documents](../../shared/api/routers/product_desktop_assistant_kb.py#L653) | `AssistantKbReindexAllOut` |
| `GET` | `/api/v1/product-desktop/admin/assistant/kb/summary` | [admin_kb_summary](../../shared/api/routers/product_desktop_assistant_kb.py#L298) | `AssistantKbSummaryOut` |
| `POST` | `/api/v1/product-desktop/admin/assistant/kb/sync-handbook` | [admin_sync_handbook_kb](../../shared/api/routers/product_desktop_assistant_kb.py#L330) | `AssistantKbSyncHandbookOut` |
| `POST` | `/api/v1/product-desktop/admin/assistant/kb/upload` | [admin_upload_kb_document](../../shared/api/routers/product_desktop_assistant_kb.py#L435) | `AssistantKbDocumentOut` |
| `GET` | `/api/v1/product-desktop/admin/assistant/kb/upload-limits` | [admin_kb_upload_limits](../../shared/api/routers/product_desktop_assistant_kb.py#L381) | `AssistantKbUploadLimitsOut` |
| `POST` | `/api/v1/product-desktop/admin/assistant/kb/uploads` | [admin_upload_kb_documents_bulk](../../shared/api/routers/product_desktop_assistant_kb.py#L454) | `AssistantKbBulkUploadOut` |
| `DELETE` | `/api/v1/product-desktop/admin/assistant/kb/{doc_id:uuid}` | [admin_delete_kb_document](../../shared/api/routers/product_desktop_assistant_kb.py#L573) | `None` |
| `GET` | `/api/v1/product-desktop/admin/assistant/kb/{doc_id:uuid}` | [admin_get_kb_document](../../shared/api/routers/product_desktop_assistant_kb.py#L391) | `AssistantKbDocumentDetailOut` |
| `PATCH` | `/api/v1/product-desktop/admin/assistant/kb/{doc_id:uuid}` | [admin_patch_kb_document](../../shared/api/routers/product_desktop_assistant_kb.py#L504) | `AssistantKbDocumentOut` |
| `POST` | `/api/v1/product-desktop/admin/assistant/kb/{doc_id:uuid}/reindex` | [admin_reindex_kb_document](../../shared/api/routers/product_desktop_assistant_kb.py#L550) | `AssistantKbDocumentOut` |
| `POST` | `/api/v1/product-desktop/admin/assistant/preview` | [admin_preview_assistant_prompt](../../shared/api/routers/product_desktop_assistant.py#L890) | `AssistantPreviewOut` |
| `GET` | `/api/v1/product-desktop/admin/assistant/settings` | [admin_get_assistant_settings](../../shared/api/routers/product_desktop_assistant.py#L870) | `AssistantSettingsOut` |
| `PATCH` | `/api/v1/product-desktop/admin/assistant/settings` | [admin_patch_assistant_settings](../../shared/api/routers/product_desktop_assistant.py#L879) | `AssistantSettingsOut` |
| `GET` | `/api/v1/product-desktop/admin/feedback/tickets` | [admin_list_feedback](../../shared/api/routers/product_desktop_feedback.py#L375) | `FeedbackTicketAdminListOut` |
| `PATCH` | `/api/v1/product-desktop/admin/feedback/tickets/{ticket_id}` | [admin_patch_feedback](../../shared/api/routers/product_desktop_feedback.py#L443) | `FeedbackTicketAdminOut` |
| `POST` | `/api/v1/product-desktop/admin/feedback/tickets/{ticket_id}/close` | [admin_close_feedback](../../shared/api/routers/product_desktop_feedback.py#L490) | `FeedbackTicketAdminOut` |
| `GET` | `/api/v1/product-desktop/admin/news` | [admin_list_news](../../shared/api/routers/product_desktop_news.py#L1019) | `list[CompanyNewsPostAdminOut]` |
| `POST` | `/api/v1/product-desktop/admin/news` | [admin_create_news](../../shared/api/routers/product_desktop_news.py#L1038) | `CompanyNewsPostAdminOut` |
| `POST` | `/api/v1/product-desktop/admin/news/polish-body` | [admin_polish_news_body](../../shared/api/routers/product_desktop_news.py#L1197) | `EwDeskNewsPolishOut` |
| `DELETE` | `/api/v1/product-desktop/admin/news/{post_id}` | [admin_delete_news](../../shared/api/routers/product_desktop_news.py#L1180) | `None` |
| `PATCH` | `/api/v1/product-desktop/admin/news/{post_id}` | [admin_update_news](../../shared/api/routers/product_desktop_news.py#L1093) | `CompanyNewsPostAdminOut` |
| `GET` | `/api/v1/product-desktop/admin/surveys` | [admin_list_surveys](../../shared/api/routers/product_desktop_surveys_admin.py#L65) | `SurveyListAdminOut` |
| `POST` | `/api/v1/product-desktop/admin/surveys` | [admin_create_survey](../../shared/api/routers/product_desktop_surveys_admin.py#L101) | `SurveyAdminOut` |
| `POST` | `/api/v1/product-desktop/admin/surveys/ai/draft` | [admin_survey_ai_draft](../../shared/api/routers/product_desktop_surveys_admin.py#L79) | `SurveyAiDraftOut` |
| `GET` | `/api/v1/product-desktop/admin/surveys/{survey_id}` | [admin_get_survey](../../shared/api/routers/product_desktop_surveys_admin.py#L126) | `SurveyAdminOut` |
| `PATCH` | `/api/v1/product-desktop/admin/surveys/{survey_id}` | [admin_patch_survey](../../shared/api/routers/product_desktop_surveys_admin.py#L138) | `SurveyAdminOut` |
| `POST` | `/api/v1/product-desktop/admin/surveys/{survey_id}/archive` | [admin_archive_survey](../../shared/api/routers/product_desktop_surveys_admin.py#L275) | `SurveyAdminOut` |
| `PUT` | `/api/v1/product-desktop/admin/surveys/{survey_id}/audience` | [admin_replace_audience](../../shared/api/routers/product_desktop_surveys_admin.py#L205) | `SurveyAdminOut` |
| `POST` | `/api/v1/product-desktop/admin/surveys/{survey_id}/gaf-notify` | [admin_queue_survey_gaf_notify](../../shared/api/routers/product_desktop_surveys_admin.py#L295) | `SurveyGafNotifyQueuedOut` |
| `POST` | `/api/v1/product-desktop/admin/surveys/{survey_id}/preview-audience` | [admin_preview_audience](../../shared/api/routers/product_desktop_surveys_admin.py#L224) | `AudiencePreviewOut` |
| `POST` | `/api/v1/product-desktop/admin/surveys/{survey_id}/publish` | [admin_publish_survey](../../shared/api/routers/product_desktop_surveys_admin.py#L239) | `SurveyAdminOut` |
| `PUT` | `/api/v1/product-desktop/admin/surveys/{survey_id}/questions` | [admin_replace_questions](../../shared/api/routers/product_desktop_surveys_admin.py#L186) | `SurveyAdminOut` |
| `GET` | `/api/v1/product-desktop/admin/surveys/{survey_id}/results/responses` | [admin_list_responses](../../shared/api/routers/product_desktop_surveys_admin.py#L343) | `SurveyResponseAdminListOut` |
| `GET` | `/api/v1/product-desktop/admin/surveys/{survey_id}/results/summary` | [admin_results_summary](../../shared/api/routers/product_desktop_surveys_admin.py#L331) | `SurveyResultsSummaryOut` |
| `POST` | `/api/v1/product-desktop/assistant/chat` | [assistant_chat](../../shared/api/routers/product_desktop_assistant.py#L716) | `AssistantChatMessageOut` |
| `POST` | `/api/v1/product-desktop/assistant/chat/stream` | [assistant_chat_stream](../../shared/api/routers/product_desktop_assistant.py#L760) | `StreamingResponse` |
| `GET` | `/api/v1/product-desktop/assistant/faq` | [list_assistant_faq_public](../../shared/api/routers/product_desktop_assistant.py#L658) | `list[AssistantFaqEntryOut]` |
| `DELETE` | `/api/v1/product-desktop/assistant/messages` | [clear_assistant_messages](../../shared/api/routers/product_desktop_assistant.py#L699) | `None` |
| `GET` | `/api/v1/product-desktop/assistant/messages` | [list_assistant_messages](../../shared/api/routers/product_desktop_assistant.py#L676) | `list[AssistantChatMessageOut]` |
| `GET` | `/api/v1/product-desktop/feedback/summary` | [get_feedback_summary](../../shared/api/routers/product_desktop_feedback.py#L262) | `FeedbackSummaryOut` |
| `GET` | `/api/v1/product-desktop/feedback/tickets` | [list_my_feedback](../../shared/api/routers/product_desktop_feedback.py#L323) | `FeedbackTicketListOut` |
| `POST` | `/api/v1/product-desktop/feedback/tickets` | [create_feedback_ticket](../../shared/api/routers/product_desktop_feedback.py#L270) | `FeedbackTicketOut` |
| `GET` | `/api/v1/product-desktop/news` | [list_published_news](../../shared/api/routers/product_desktop_news.py#L473) | `CompanyNewsPostListPageOut` |
| `GET` | `/api/v1/product-desktop/news-linked-audio/{content_id:uuid}` | [stream_news_linked_audio](../../shared/api/routers/product_desktop_news.py#L943) | `StreamingResponse` |
| `GET` | `/api/v1/product-desktop/news-linked-image/{content_id:uuid}` | [stream_news_linked_image](../../shared/api/routers/product_desktop_news.py#L786) | `StreamingResponse` |
| `GET` | `/api/v1/product-desktop/news-linked-video/{content_id:uuid}` | [stream_news_linked_video](../../shared/api/routers/product_desktop_news.py#L867) | `StreamingResponse` |
| `GET` | `/api/v1/product-desktop/news/counts` | [get_news_counts](../../shared/api/routers/product_desktop_news.py#L566) | `EwDeskNewsCountsOut` |
| `GET` | `/api/v1/product-desktop/news/my-state` | [get_news_my_state](../../shared/api/routers/product_desktop_news.py#L659) | `EwDeskNewsUserStateOut` |
| `PATCH` | `/api/v1/product-desktop/news/my-state` | [patch_news_my_state](../../shared/api/routers/product_desktop_news.py#L667) | `EwDeskNewsUserStateOut` |
| `GET` | `/api/v1/product-desktop/news/{post_id}` | [get_published_news](../../shared/api/routers/product_desktop_news.py#L764) | `CompanyNewsPostOut` |
| `GET` | `/api/v1/product-desktop/surveys` | [list_user_surveys](../../shared/api/routers/product_desktop_surveys_user.py#L92) | `SurveyUserListOut` |
| `GET` | `/api/v1/product-desktop/surveys/summary` | [get_survey_summary](../../shared/api/routers/product_desktop_surveys_user.py#L50) | `SurveySummaryOut` |
| `GET` | `/api/v1/product-desktop/surveys/{survey_id}` | [get_user_survey](../../shared/api/routers/product_desktop_surveys_user.py#L153) | `SurveyUserDetailOut` |
| `POST` | `/api/v1/product-desktop/surveys/{survey_id}/responses` | [submit_survey_response](../../shared/api/routers/product_desktop_surveys_user.py#L186) | `SurveySubmitOut` |
| `GET` | `/api/v1/product-desktop/surveys/{survey_id}/responses/me` | [get_my_survey_response](../../shared/api/routers/product_desktop_surveys_user.py#L253) | `SurveyResponseUserOut` |

## /api/v1/professional-worlds

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/professional-worlds/admin/ai-actions` | [admin_list_ai_actions](../../shared/api/routers/professional_worlds_admin.py#L326) | `list[ProfessionalAiActionOut]` |
| `POST` | `/api/v1/professional-worlds/admin/ai-actions` | [admin_create_ai_action](../../shared/api/routers/professional_worlds_admin.py#L338) | `ProfessionalAiActionOut` |
| `PATCH` | `/api/v1/professional-worlds/admin/ai-actions/{action_key}` | [admin_update_ai_action](../../shared/api/routers/professional_worlds_admin.py#L348) | `ProfessionalAiActionOut` |
| `POST` | `/api/v1/professional-worlds/admin/ai-actions/{action_key}/test` | [admin_test_ai_action](../../shared/api/routers/professional_worlds_admin.py#L363) | `ProfessionalAiActionTestOut` |
| `GET` | `/api/v1/professional-worlds/admin/ai-actions/{vertical_slug}/{action_key}/prompt-inspect` | [admin_inspect_ai_action_prompt](../../shared/api/routers/professional_worlds_admin.py#L754) | `ProfessionalAiActionPromptInspectOut` |
| `GET` | `/api/v1/professional-worlds/admin/audit` | [admin_list_audit](../../shared/api/routers/professional_worlds_admin.py#L479) | `list[ProfessionalAdminAuditLogOut]` |
| `GET` | `/api/v1/professional-worlds/admin/evaluation/dashboard` | [admin_evaluation_dashboard](../../shared/api/routers/professional_worlds_admin.py#L905) | `ProfessionalAiEvalDashboardOut` |
| `GET` | `/api/v1/professional-worlds/admin/evaluation/datasets` | [admin_list_evaluation_datasets](../../shared/api/routers/professional_worlds_admin.py#L921) | `list[ProfessionalAiEvalDatasetOut]` |
| `POST` | `/api/v1/professional-worlds/admin/evaluation/datasets` | [admin_create_evaluation_dataset](../../shared/api/routers/professional_worlds_admin.py#L934) | `ProfessionalAiEvalDatasetOut` |
| `DELETE` | `/api/v1/professional-worlds/admin/evaluation/datasets/{dataset_id}` | [admin_delete_evaluation_dataset](../../shared/api/routers/professional_worlds_admin.py#L978) | `None` |
| `PATCH` | `/api/v1/professional-worlds/admin/evaluation/datasets/{dataset_id}` | [admin_patch_evaluation_dataset](../../shared/api/routers/professional_worlds_admin.py#L958) | `ProfessionalAiEvalDatasetOut` |
| `GET` | `/api/v1/professional-worlds/admin/evaluation/runs` | [admin_list_evaluation_runs](../../shared/api/routers/professional_worlds_admin.py#L990) | `list[ProfessionalAiEvalRunOut]` |
| `POST` | `/api/v1/professional-worlds/admin/evaluation/runs` | [admin_execute_evaluation_run](../../shared/api/routers/professional_worlds_admin.py#L1016) | `ProfessionalAiEvalRunOut` |
| `PATCH` | `/api/v1/professional-worlds/admin/evaluation/runs/samples/{sample_id}/human-notes` | [admin_patch_evaluation_sample_human_notes](../../shared/api/routers/professional_worlds_admin.py#L1071) | `ProfessionalAiEvalRunSampleOut` |
| `GET` | `/api/v1/professional-worlds/admin/evaluation/runs/{run_id}` | [admin_get_evaluation_run](../../shared/api/routers/professional_worlds_admin.py#L1002) | `ProfessionalAiEvalRunOut` |
| `PATCH` | `/api/v1/professional-worlds/admin/evaluation/runs/{run_id}/human-notes` | [admin_patch_evaluation_run_human_notes](../../shared/api/routers/professional_worlds_admin.py#L1054) | `ProfessionalAiEvalRunOut` |
| `GET` | `/api/v1/professional-worlds/admin/integrations` | [admin_list_integrations](../../shared/api/routers/professional_worlds_admin.py#L451) | `list[ProfessionalIntegrationBindingOut]` |
| `PATCH` | `/api/v1/professional-worlds/admin/integrations/{integration_key}` | [admin_update_integration](../../shared/api/routers/professional_worlds_admin.py#L464) | `ProfessionalIntegrationBindingOut` |
| `GET` | `/api/v1/professional-worlds/admin/modules` | [admin_list_modules](../../shared/api/routers/professional_worlds_admin.py#L201) | `list[ProfessionalModuleOut]` |
| `POST` | `/api/v1/professional-worlds/admin/modules` | [admin_create_module](../../shared/api/routers/professional_worlds_admin.py#L210) | `ProfessionalModuleOut` |
| `PATCH` | `/api/v1/professional-worlds/admin/modules/{module_key}` | [admin_update_module](../../shared/api/routers/professional_worlds_admin.py#L220) | `ProfessionalModuleOut` |
| `GET` | `/api/v1/professional-worlds/admin/ops/metrics` | [admin_ops_metrics](../../shared/api/routers/professional_worlds_admin.py#L147) | `ProfessionalWorldsOpsMetricsOut` |
| `GET` | `/api/v1/professional-worlds/admin/overview` | [admin_overview](../../shared/api/routers/professional_worlds_admin.py#L138) | `ProfessionalWorldsAdminOverview` |
| `POST` | `/api/v1/professional-worlds/admin/packs/import/jobs` | [admin_create_pack_import_job](../../shared/api/routers/professional_worlds_admin.py#L604) | `ProfessionalPackImportJobCreateOut` |
| `GET` | `/api/v1/professional-worlds/admin/packs/import/jobs/{job_id}` | [admin_get_pack_import_job](../../shared/api/routers/professional_worlds_admin.py#L620) | `ProfessionalPackImportJobOut` |
| `POST` | `/api/v1/professional-worlds/admin/packs/import/jobs/{job_id}/confirm` | [admin_confirm_pack_import_job](../../shared/api/routers/professional_worlds_admin.py#L633) | `ProfessionalPackImportConfirmOut` |
| `POST` | `/api/v1/professional-worlds/admin/packs/releases/{release_id}/approve` | [admin_approve_pack_release](../../shared/api/routers/professional_worlds_admin.py#L656) | `ProfessionalPackReleaseOut` |
| `POST` | `/api/v1/professional-worlds/admin/packs/releases/{release_id}/publish` | [admin_publish_pack_release](../../shared/api/routers/professional_worlds_admin.py#L669) | `ProfessionalPackReleaseOut` |
| `POST` | `/api/v1/professional-worlds/admin/packs/releases/{release_id}/rollback` | [admin_rollback_pack_release](../../shared/api/routers/professional_worlds_admin.py#L681) | `ProfessionalPackReleaseOut` |
| `POST` | `/api/v1/professional-worlds/admin/packs/{vertical_slug}/diff` | [admin_pack_diff_vs_manifest](../../shared/api/routers/professional_worlds_admin.py#L592) | `ProfessionalPackDiffOut` |
| `POST` | `/api/v1/professional-worlds/admin/packs/{vertical_slug}/releases` | [admin_create_pack_release](../../shared/api/routers/professional_worlds_admin.py#L644) | `ProfessionalPackReleaseOut` |
| `GET` | `/api/v1/professional-worlds/admin/packs/{vertical_slug}/versions` | [admin_list_pack_versions](../../shared/api/routers/professional_worlds_admin.py#L561) | `list[ProfessionalVerticalPackVersionOut]` |
| `POST` | `/api/v1/professional-worlds/admin/packs/{vertical_slug}/versions` | [admin_create_pack_version](../../shared/api/routers/professional_worlds_admin.py#L574) | `ProfessionalVerticalPackVersionOut` |
| `GET` | `/api/v1/professional-worlds/admin/photo-presets` | [admin_list_photo_presets](../../shared/api/routers/professional_worlds_admin.py#L386) | `list[ProfessionalPhotoPresetOut]` |
| `POST` | `/api/v1/professional-worlds/admin/photo-presets` | [admin_create_photo_preset](../../shared/api/routers/professional_worlds_admin.py#L399) | `ProfessionalPhotoPresetOut` |
| `PATCH` | `/api/v1/professional-worlds/admin/photo-presets/{preset_key}` | [admin_update_photo_preset](../../shared/api/routers/professional_worlds_admin.py#L411) | `ProfessionalPhotoPresetOut` |
| `POST` | `/api/v1/professional-worlds/admin/photo-presets/{preset_key}/test` | [admin_test_photo_preset](../../shared/api/routers/professional_worlds_admin.py#L426) | `ProfessionalPhotoPresetTestOut` |
| `GET` | `/api/v1/professional-worlds/admin/photo-presets/{vertical_slug}/{preset_key}/prompt-inspect` | [admin_inspect_photo_preset_prompt](../../shared/api/routers/professional_worlds_admin.py#L779) | `ProfessionalPhotoPresetPromptInspectOut` |
| `GET` | `/api/v1/professional-worlds/admin/playbooks/{vertical_slug}` | [admin_list_professional_playbooks](../../shared/api/routers/professional_worlds_admin.py#L800) | `list[AdminProfessionalPlaybookOut]` |
| `POST` | `/api/v1/professional-worlds/admin/playbooks/{vertical_slug}` | [admin_create_professional_playbook](../../shared/api/routers/professional_worlds_admin.py#L853) | `AdminProfessionalPlaybookOut` |
| `PATCH` | `/api/v1/professional-worlds/admin/playbooks/{vertical_slug}/{playbook_key}` | [admin_update_professional_playbook](../../shared/api/routers/professional_worlds_admin.py#L881) | `AdminProfessionalPlaybookOut` |
| `GET` | `/api/v1/professional-worlds/admin/playbooks/{vertical_slug}/{playbook_key}/dry-run` | [admin_dry_run_professional_playbook](../../shared/api/routers/professional_worlds_admin.py#L816) | `ProfessionalPlaybookDryRunOut` |
| `POST` | `/api/v1/professional-worlds/admin/playbooks/{vertical_slug}/{playbook_key}/dry-run` | [admin_dry_run_professional_playbook_with_body](../../shared/api/routers/professional_worlds_admin.py#L833) | `ProfessionalPlaybookDryRunOut` |
| `GET` | `/api/v1/professional-worlds/admin/rollouts` | [admin_list_rollouts](../../shared/api/routers/professional_worlds_admin.py#L693) | `list[ProfessionalVerticalRolloutOut]` |
| `POST` | `/api/v1/professional-worlds/admin/rollouts` | [admin_create_rollout](../../shared/api/routers/professional_worlds_admin.py#L703) | `ProfessionalVerticalRolloutMutateOut` |
| `PATCH` | `/api/v1/professional-worlds/admin/rollouts/{rollout_id}` | [admin_patch_rollout](../../shared/api/routers/professional_worlds_admin.py#L714) | `ProfessionalVerticalRolloutMutateOut` |
| `POST` | `/api/v1/professional-worlds/admin/rollouts/{rollout_id}/pause` | [admin_pause_rollout](../../shared/api/routers/professional_worlds_admin.py#L727) | `ProfessionalVerticalRolloutMutateOut` |
| `POST` | `/api/v1/professional-worlds/admin/rollouts/{rollout_id}/resume` | [admin_resume_rollout](../../shared/api/routers/professional_worlds_admin.py#L739) | `ProfessionalVerticalRolloutMutateOut` |
| `PATCH` | `/api/v1/professional-worlds/admin/schemas/{schema_id}` | [admin_update_schema](../../shared/api/routers/professional_worlds_admin.py#L299) | `ProfessionalVerticalSchemaOut` |
| `POST` | `/api/v1/professional-worlds/admin/schemas/{schema_id}/activate` | [admin_activate_schema](../../shared/api/routers/professional_worlds_admin.py#L313) | `ProfessionalVerticalSchemaOut` |
| `GET` | `/api/v1/professional-worlds/admin/verticals` | [admin_list_verticals](../../shared/api/routers/professional_worlds_admin.py#L156) | `list[AdminProfessionVerticalOut]` |
| `POST` | `/api/v1/professional-worlds/admin/verticals` | [admin_create_vertical](../../shared/api/routers/professional_worlds_admin.py#L165) | `AdminProfessionVerticalOut` |
| `POST` | `/api/v1/professional-worlds/admin/verticals/import` | [admin_import_vertical_pack](../../shared/api/routers/professional_worlds_admin.py#L536) | `VerticalPackImportResult` |
| `POST` | `/api/v1/professional-worlds/admin/verticals/import/dry-run` | [admin_import_vertical_pack_dry_run](../../shared/api/routers/professional_worlds_admin.py#L508) | `VerticalPackImportResult` |
| `DELETE` | `/api/v1/professional-worlds/admin/verticals/{slug}` | [admin_disable_vertical](../../shared/api/routers/professional_worlds_admin.py#L189) | `None` |
| `PATCH` | `/api/v1/professional-worlds/admin/verticals/{slug}` | [admin_update_vertical](../../shared/api/routers/professional_worlds_admin.py#L175) | `AdminProfessionVerticalOut` |
| `GET` | `/api/v1/professional-worlds/admin/verticals/{slug}/export` | [admin_export_vertical_pack](../../shared/api/routers/professional_worlds_admin.py#L495) | `ProfessionalVerticalPackExportOut` |
| `GET` | `/api/v1/professional-worlds/admin/verticals/{slug}/modules` | [admin_list_vertical_modules](../../shared/api/routers/professional_worlds_admin.py#L234) | `list[ProfessionalVerticalModuleOut]` |
| `DELETE` | `/api/v1/professional-worlds/admin/verticals/{slug}/modules/{module_key}` | [admin_disable_module_assignment](../../shared/api/routers/professional_worlds_admin.py#L261) | `None` |
| `POST` | `/api/v1/professional-worlds/admin/verticals/{slug}/modules/{module_key}` | [admin_assign_module](../../shared/api/routers/professional_worlds_admin.py#L246) | `ProfessionalVerticalModuleOut` |
| `GET` | `/api/v1/professional-worlds/admin/verticals/{slug}/schemas` | [admin_list_schemas](../../shared/api/routers/professional_worlds_admin.py#L274) | `list[ProfessionalVerticalSchemaOut]` |
| `POST` | `/api/v1/professional-worlds/admin/verticals/{slug}/schemas` | [admin_create_schema](../../shared/api/routers/professional_worlds_admin.py#L286) | `ProfessionalVerticalSchemaOut` |
| `GET` | `/api/v1/professional-worlds/artifacts` | [list_artifacts](../../shared/api/routers/professional_worlds_learning.py#L76) | `list[ProfessionalArtifactOut]` |
| `DELETE` | `/api/v1/professional-worlds/artifacts/{artifact_id}` | [delete_artifact](../../shared/api/routers/professional_worlds_learning.py#L99) | `None` |
| `GET` | `/api/v1/professional-worlds/clients` | [list_clients](../../shared/api/routers/professional_worlds_crm_lite.py#L43) | `list[ProfessionalClientOut]` |
| `POST` | `/api/v1/professional-worlds/clients` | [create_client](../../shared/api/routers/professional_worlds_crm_lite.py#L54) | `ProfessionalClientOut` |
| `DELETE` | `/api/v1/professional-worlds/clients/{client_id}` | [delete_client](../../shared/api/routers/professional_worlds_crm_lite.py#L78) | `None` |
| `PATCH` | `/api/v1/professional-worlds/clients/{client_id}` | [update_client](../../shared/api/routers/professional_worlds_crm_lite.py#L64) | `ProfessionalClientOut` |
| `POST` | `/api/v1/professional-worlds/coach/simulate/stream` | [coach_simulation_stream](../../shared/api/routers/professional_worlds_ai_streams.py#L147) | `StreamingResponse` |
| `GET` | `/api/v1/professional-worlds/cross-app/drafts` | [list_professional_cross_app_drafts](../../shared/api/routers/professional_worlds_workspace.py#L138) | `list[ProfessionalCrossAppDraftLinkOut]` |
| `POST` | `/api/v1/professional-worlds/cross-app/drafts/{link_id}/refresh` | [refresh_professional_cross_app_draft](../../shared/api/routers/professional_worlds_workspace.py#L158) | `ProfessionalCrossAppDraftLinkOut` |
| `POST` | `/api/v1/professional-worlds/cross-app/drafts/{link_id}/report` | [report_professional_cross_app_draft](../../shared/api/routers/professional_worlds_workspace.py#L173) | `ProfessionalCrossAppDraftLinkOut` |
| `GET` | `/api/v1/professional-worlds/deals` | [list_deals](../../shared/api/routers/professional_worlds_crm_lite.py#L102) | `list[ProfessionalDealOut]` |
| `POST` | `/api/v1/professional-worlds/deals` | [create_deal](../../shared/api/routers/professional_worlds_crm_lite.py#L113) | `ProfessionalDealOut` |
| `POST` | `/api/v1/professional-worlds/deals/backfill-property-links` | [backfill_deal_property_links](../../shared/api/routers/professional_worlds_crm_lite.py#L152) | `ProfessionalDealPropertyLinkBackfillOut` |
| `DELETE` | `/api/v1/professional-worlds/deals/{deal_id}` | [delete_deal](../../shared/api/routers/professional_worlds_crm_lite.py#L137) | `None` |
| `PATCH` | `/api/v1/professional-worlds/deals/{deal_id}` | [update_deal](../../shared/api/routers/professional_worlds_crm_lite.py#L123) | `ProfessionalDealOut` |
| `GET` | `/api/v1/professional-worlds/learning/courses` | [list_learning_courses](../../shared/api/routers/professional_worlds_learning.py#L38) | `list[ProfessionalLearningCourseOut]` |
| `GET` | `/api/v1/professional-worlds/learning/courses/{course_id}` | [get_learning_course](../../shared/api/routers/professional_worlds_learning.py#L49) | `ProfessionalLearningCourseOut` |
| `POST` | `/api/v1/professional-worlds/learning/lessons/{lesson_id}/complete` | [complete_lesson](../../shared/api/routers/professional_worlds_learning.py#L65) | `None` |
| `GET` | `/api/v1/professional-worlds/me/brand-visual-kit` | [get_professional_worlds_brand_visual_kit](../../shared/api/routers/professional_worlds_workspace.py#L113) | `BrandVisualKitOut \| None` |
| `PUT` | `/api/v1/professional-worlds/me/brand-visual-kit` | [put_professional_worlds_brand_visual_kit](../../shared/api/routers/professional_worlds_workspace.py#L124) | `BrandVisualKitOut` |
| `GET` | `/api/v1/professional-worlds/me/profile` | [get_my_profile](../../shared/api/routers/professional_worlds_core.py#L53) | `SpecialistProfileOut \| None` |
| `PUT` | `/api/v1/professional-worlds/me/profile` | [upsert_my_profile](../../shared/api/routers/professional_worlds_core.py#L63) | `SpecialistProfileOut` |
| `GET` | `/api/v1/professional-worlds/me/runtime-config` | [get_my_runtime_config](../../shared/api/routers/professional_worlds_core.py#L76) | `ProfessionalWorldsRuntimeConfig` |
| `GET` | `/api/v1/professional-worlds/me/runtime-configs` | [list_my_runtime_configs](../../shared/api/routers/professional_worlds_core.py#L133) | `ProfessionalWorldsMultiRuntimeConfig` |
| `GET` | `/api/v1/professional-worlds/me/snapshot` | [get_my_professional_worlds_snapshot](../../shared/api/routers/professional_worlds_core.py#L143) | `ProfessionalWorldsSnapshotOut` |
| `GET` | `/api/v1/professional-worlds/me/vertical-activations` | [list_my_vertical_activations](../../shared/api/routers/professional_worlds_core.py#L86) | `list[ProfessionalUserVerticalActivationOut]` |
| `POST` | `/api/v1/professional-worlds/me/vertical-activations/{vertical_slug}` | [upsert_my_vertical_activation](../../shared/api/routers/professional_worlds_core.py#L95) | `ProfessionalUserVerticalActivationOut` |
| `PATCH` | `/api/v1/professional-worlds/me/vertical-activations/{vertical_slug}/onboarding` | [patch_my_vertical_onboarding](../../shared/api/routers/professional_worlds_core.py#L116) | `ProfessionalUserVerticalActivationOut` |
| `GET` | `/api/v1/professional-worlds/media/albums` | [list_professional_worlds_media_albums](../../shared/api/routers/professional_worlds_realtor_media.py#L532) | `list[ProfessionalMediaAlbumOut]` |
| `POST` | `/api/v1/professional-worlds/media/albums` | [create_professional_worlds_media_album](../../shared/api/routers/professional_worlds_realtor_media.py#L543) | `ProfessionalMediaAlbumOut` |
| `DELETE` | `/api/v1/professional-worlds/media/albums/{album_id}` | [delete_professional_worlds_media_album](../../shared/api/routers/professional_worlds_realtor_media.py#L567) | `None` |
| `PATCH` | `/api/v1/professional-worlds/media/albums/{album_id}` | [patch_professional_worlds_media_album](../../shared/api/routers/professional_worlds_realtor_media.py#L553) | `ProfessionalMediaAlbumOut` |
| `GET` | `/api/v1/professional-worlds/playbook-runs` | [list_professional_playbook_runs](../../shared/api/routers/professional_worlds_playbooks.py#L61) | `list[ProfessionalPlaybookRunOut]` |
| `GET` | `/api/v1/professional-worlds/playbook-runs/{run_id}` | [get_professional_playbook_run](../../shared/api/routers/professional_worlds_playbooks.py#L71) | `ProfessionalPlaybookRunOut` |
| `POST` | `/api/v1/professional-worlds/playbook-runs/{run_id}/resume/stream` | [resume_professional_playbook_stream](../../shared/api/routers/professional_worlds_playbooks.py#L143) | `StreamingResponse` |
| `GET` | `/api/v1/professional-worlds/playbooks/{vertical_slug}/{playbook_key}/estimate-cost` | [estimate_professional_playbook_cost_route](../../shared/api/routers/professional_worlds_playbooks.py#L87) | `ProfessionalPlaybookCostEstimateOut` |
| `POST` | `/api/v1/professional-worlds/playbooks/{vertical_slug}/{playbook_key}/stream` | [stream_professional_playbook](../../shared/api/routers/professional_worlds_playbooks.py#L104) | `StreamingResponse` |
| `GET` | `/api/v1/professional-worlds/realtor/buyer-requirements` | [list_buyer_requirements_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L262) | `list[RealtorBuyerRequirementOut]` |
| `POST` | `/api/v1/professional-worlds/realtor/buyer-requirements` | [create_buyer_requirement_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L273) | `RealtorBuyerRequirementOut` |
| `PATCH` | `/api/v1/professional-worlds/realtor/buyer-requirements/{req_id}` | [update_buyer_requirement_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L283) | `RealtorBuyerRequirementOut` |
| `GET` | `/api/v1/professional-worlds/realtor/communication-logs` | [list_communication_logs_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L467) | `list[RealtorCommunicationLogOut]` |
| `POST` | `/api/v1/professional-worlds/realtor/communication-logs` | [create_communication_log_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L483) | `RealtorCommunicationLogOut` |
| `GET` | `/api/v1/professional-worlds/realtor/deals/{deal_id}/events` | [list_deal_events_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L332) | `list[RealtorDealEventOut]` |
| `POST` | `/api/v1/professional-worlds/realtor/deals/{deal_id}/events` | [append_deal_event_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L344) | `RealtorDealEventOut` |
| `GET` | `/api/v1/professional-worlds/realtor/documents` | [list_realtor_documents_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L358) | `list[RealtorProDocumentOut]` |
| `POST` | `/api/v1/professional-worlds/realtor/documents` | [create_realtor_document_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L371) | `RealtorProDocumentOut` |
| `PATCH` | `/api/v1/professional-worlds/realtor/documents/{doc_id}` | [update_realtor_document_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L384) | `RealtorProDocumentOut` |
| `GET` | `/api/v1/professional-worlds/realtor/leads` | [list_realtor_leads](../../shared/api/routers/professional_worlds_realtor_crm.py#L83) | `list[RealtorLeadOut]` |
| `POST` | `/api/v1/professional-worlds/realtor/leads` | [create_realtor_lead_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L92) | `RealtorLeadOut` |
| `POST` | `/api/v1/professional-worlds/realtor/leads/{lead_id}/convert-to-client` | [convert_realtor_lead_to_client_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L105) | `RealtorLeadConvertOut` |
| `GET` | `/api/v1/professional-worlds/realtor/marketing-campaigns` | [list_marketing_campaigns_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L428) | `list[RealtorMarketingCampaignOut]` |
| `POST` | `/api/v1/professional-worlds/realtor/marketing-campaigns` | [create_marketing_campaign_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L440) | `RealtorMarketingCampaignOut` |
| `PATCH` | `/api/v1/professional-worlds/realtor/marketing-campaigns/{campaign_id}` | [update_marketing_campaign_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L453) | `RealtorMarketingCampaignOut` |
| `GET` | `/api/v1/professional-worlds/realtor/objection-replies` | [list_objection_replies_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L493) | `list[RealtorObjectionReplyOut]` |
| `PUT` | `/api/v1/professional-worlds/realtor/objection-replies/{objection_key:path}` | [upsert_objection_reply_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L502) | `RealtorObjectionReplyOut` |
| `GET` | `/api/v1/professional-worlds/realtor/properties` | [list_realtor_properties](../../shared/api/routers/professional_worlds_realtor_crm.py#L588) | `list[RealtorPropertyOut]` |
| `POST` | `/api/v1/professional-worlds/realtor/properties` | [create_realtor_property](../../shared/api/routers/professional_worlds_realtor_crm.py#L597) | `RealtorPropertyOut` |
| `POST` | `/api/v1/professional-worlds/realtor/properties/intake/commit` | [commit_realtor_property_intake](../../shared/api/routers/professional_worlds_realtor_media.py#L180) | `RealtorPropertyOut` |
| `POST` | `/api/v1/professional-worlds/realtor/properties/intake/parse/stream` | [parse_realtor_property_intake_stream](../../shared/api/routers/professional_worlds_realtor_media.py#L157) | `StreamingResponse` |
| `DELETE` | `/api/v1/professional-worlds/realtor/properties/{property_id}` | [delete_realtor_property](../../shared/api/routers/professional_worlds_realtor_crm.py#L634) | `None` |
| `GET` | `/api/v1/professional-worlds/realtor/properties/{property_id}` | [get_realtor_property](../../shared/api/routers/professional_worlds_realtor_crm.py#L607) | `RealtorPropertyOut` |
| `PATCH` | `/api/v1/professional-worlds/realtor/properties/{property_id}` | [update_realtor_property](../../shared/api/routers/professional_worlds_realtor_crm.py#L620) | `RealtorPropertyOut` |
| `POST` | `/api/v1/professional-worlds/realtor/properties/{property_id}/drafts/{draft_kind}` | [create_realtor_property_draft](../../shared/api/routers/professional_worlds_workspace.py#L194) | `ProfessionalArtifactOut` |
| `POST` | `/api/v1/professional-worlds/realtor/properties/{property_id}/generate-content-pack/stream` | [generate_property_content_pack_stream](../../shared/api/routers/professional_worlds_ai_streams.py#L103) | `StreamingResponse` |
| `POST` | `/api/v1/professional-worlds/realtor/properties/{property_id}/generate-description/stream` | [generate_property_description_stream](../../shared/api/routers/professional_worlds_ai_streams.py#L59) | `StreamingResponse` |
| `POST` | `/api/v1/professional-worlds/realtor/properties/{property_id}/listing-quality/recompute` | [recompute_listing_quality_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L562) | `RealtorListingQualityScoreOut` |
| `GET` | `/api/v1/professional-worlds/realtor/properties/{property_id}/listing-quality/scores` | [list_listing_quality_scores_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L578) | `list[RealtorListingQualityScoreOut]` |
| `GET` | `/api/v1/professional-worlds/realtor/properties/{property_id}/media` | [list_realtor_property_media](../../shared/api/routers/professional_worlds_realtor_media.py#L126) | `list[RealtorPropertyMediaOut]` |
| `POST` | `/api/v1/professional-worlds/realtor/properties/{property_id}/media` | [attach_realtor_property_media](../../shared/api/routers/professional_worlds_realtor_media.py#L112) | `RealtorPropertyMediaOut` |
| `POST` | `/api/v1/professional-worlds/realtor/properties/{property_id}/media/enhance/batches` | [create_realtor_media_enhancement_batch](../../shared/api/routers/professional_worlds_realtor_media.py#L415) | `RealtorMediaBatchDetailOut` |
| `GET` | `/api/v1/professional-worlds/realtor/properties/{property_id}/media/enhance/batches/{batch_id}` | [get_realtor_media_enhancement_batch](../../shared/api/routers/professional_worlds_realtor_media.py#L441) | `RealtorMediaBatchDetailOut` |
| `PATCH` | `/api/v1/professional-worlds/realtor/properties/{property_id}/media/enhance/batches/{batch_id}/items/{item_id}/review` | [review_realtor_media_batch_item](../../shared/api/routers/professional_worlds_realtor_media.py#L458) | `RealtorMediaBatchItemOut` |
| `POST` | `/api/v1/professional-worlds/realtor/properties/{property_id}/media/enhance/batches/{batch_id}/run/stream` | [stream_realtor_media_enhancement_batch](../../shared/api/routers/professional_worlds_realtor_media.py#L506) | `StreamingResponse` |
| `POST` | `/api/v1/professional-worlds/realtor/properties/{property_id}/media/enhance/stream` | [enhance_realtor_property_media_stream](../../shared/api/routers/professional_worlds_realtor_media.py#L196) | `StreamingResponse` |
| `GET` | `/api/v1/professional-worlds/realtor/properties/{property_id}/media/enhancements` | [list_realtor_media_enhancement_jobs](../../shared/api/routers/professional_worlds_realtor_media.py#L350) | `list[MediaEnhancementJobOut]` |
| `POST` | `/api/v1/professional-worlds/realtor/properties/{property_id}/media/enhancements/{job_id}/accept` | [accept_realtor_media_enhancement](../../shared/api/routers/professional_worlds_realtor_media.py#L365) | `MediaEnhancementJobOut` |
| `POST` | `/api/v1/professional-worlds/realtor/properties/{property_id}/media/enhancements/{job_id}/reject` | [reject_realtor_media_enhancement](../../shared/api/routers/professional_worlds_realtor_media.py#L392) | `MediaEnhancementJobOut` |
| `POST` | `/api/v1/professional-worlds/realtor/properties/{property_id}/media/upload` | [upload_realtor_property_media](../../shared/api/routers/professional_worlds_realtor_media.py#L294) | `RealtorPropertyMediaOut` |
| `POST` | `/api/v1/professional-worlds/realtor/properties/{property_id}/media/upload-enhance/stream` | [upload_and_enhance_realtor_property_media_stream](../../shared/api/routers/professional_worlds_realtor_media.py#L225) | `StreamingResponse` |
| `DELETE` | `/api/v1/professional-worlds/realtor/properties/{property_id}/media/{media_id}` | [delete_realtor_property_media](../../shared/api/routers/professional_worlds_realtor_media.py#L141) | `None` |
| `GET` | `/api/v1/professional-worlds/realtor/properties/{property_id}/price-snapshots` | [list_price_snapshots_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L400) | `list[RealtorPriceAnalysisSnapshotOut]` |
| `POST` | `/api/v1/professional-worlds/realtor/properties/{property_id}/price-snapshots` | [create_price_snapshot_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L414) | `RealtorPriceAnalysisSnapshotOut` |
| `GET` | `/api/v1/professional-worlds/realtor/properties/{property_id}/publication-channels` | [list_publication_channels_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L516) | `list[RealtorPublicationChannelOut]` |
| `POST` | `/api/v1/professional-worlds/realtor/properties/{property_id}/publication-channels` | [upsert_publication_channel_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L530) | `RealtorPublicationChannelOut` |
| `PATCH` | `/api/v1/professional-worlds/realtor/publication-channels/{channel_id}` | [patch_publication_channel_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L544) | `RealtorPublicationChannelOut` |
| `GET` | `/api/v1/professional-worlds/realtor/quota-summary` | [get_realtor_quota_summary](../../shared/api/routers/professional_worlds_realtor_crm.py#L74) | `RealtorQuotaSummaryOut` |
| `GET` | `/api/v1/professional-worlds/realtor/seller-profiles` | [list_seller_profiles_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L297) | `list[RealtorSellerProfileOut]` |
| `POST` | `/api/v1/professional-worlds/realtor/seller-profiles` | [create_seller_profile_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L308) | `RealtorSellerProfileOut` |
| `PATCH` | `/api/v1/professional-worlds/realtor/seller-profiles/{profile_id}` | [update_seller_profile_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L318) | `RealtorSellerProfileOut` |
| `GET` | `/api/v1/professional-worlds/realtor/showings` | [list_realtor_showings_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L123) | `list[RealtorPropertyShowingOut]` |
| `POST` | `/api/v1/professional-worlds/realtor/showings` | [create_realtor_showing_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L142) | `RealtorPropertyShowingOut` |
| `DELETE` | `/api/v1/professional-worlds/realtor/showings/{showing_id}` | [delete_realtor_showing_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L182) | `None` |
| `GET` | `/api/v1/professional-worlds/realtor/showings/{showing_id}` | [get_realtor_showing_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L155) | `RealtorPropertyShowingOut` |
| `PATCH` | `/api/v1/professional-worlds/realtor/showings/{showing_id}` | [patch_realtor_showing_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L168) | `RealtorPropertyShowingOut` |
| `GET` | `/api/v1/professional-worlds/realtor/tasks` | [list_realtor_tasks_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L194) | `list[RealtorTaskOut]` |
| `POST` | `/api/v1/professional-worlds/realtor/tasks` | [create_realtor_task_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L213) | `RealtorTaskOut` |
| `DELETE` | `/api/v1/professional-worlds/realtor/tasks/{task_id}` | [delete_realtor_task_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L251) | `None` |
| `GET` | `/api/v1/professional-worlds/realtor/tasks/{task_id}` | [get_realtor_task_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L226) | `RealtorTaskOut` |
| `PATCH` | `/api/v1/professional-worlds/realtor/tasks/{task_id}` | [patch_realtor_task_route](../../shared/api/routers/professional_worlds_realtor_crm.py#L238) | `RealtorTaskOut` |
| `GET` | `/api/v1/professional-worlds/verticals` | [list_verticals](../../shared/api/routers/professional_worlds_core.py#L44) | `list[ProfessionVerticalOut]` |

## /api/v1/profile

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/profile/activity` | [get_activity_log](../../shared/api/routers/user_profile.py#L664) | `ActivityLogResponse` |
| `DELETE` | `/api/v1/profile/avatar` | [delete_avatar](../../shared/api/routers/user_profile.py#L299) | `dict[str, Any]` |
| `GET` | `/api/v1/profile/avatar` | [get_current_avatar](../../shared/api/routers/user_profile.py#L262) | `AvatarUploadResponse` |
| `POST` | `/api/v1/profile/avatar` | [upload_avatar](../../shared/api/routers/user_profile.py#L224) | `AvatarUploadResponse` |
| `GET` | `/api/v1/profile/avatar/history` | [get_avatar_history](../../shared/api/routers/user_profile.py#L313) | `list[AvatarHistoryItem]` |
| `POST` | `/api/v1/profile/change-password` | [change_password](../../shared/api/routers/user_profile.py#L556) | `dict[str, Any]` |
| `GET` | `/api/v1/profile/export/history` | [get_export_history](../../shared/api/routers/user_profile.py#L711) | `list[DataExportResponse]` |
| `GET` | `/api/v1/profile/health` | [profile_health_check](../../shared/api/routers/user_profile.py#L726) | `dict[str, str]` |
| `GET` | `/api/v1/profile/me` | [get_current_user_profile](../../shared/api/routers/user_profile.py#L158) | `UserProfileResponse` |
| `PATCH` | `/api/v1/profile/me` | [update_current_user_profile](../../shared/api/routers/user_profile.py#L173) | `UserProfileResponse` |
| `GET` | `/api/v1/profile/me/privacy` | [get_profile_privacy_settings](../../shared/api/routers/user_profile.py#L200) | `ProfilePrivacyResponse` |
| `PATCH` | `/api/v1/profile/me/privacy` | [update_profile_privacy_settings](../../shared/api/routers/user_profile.py#L209) | `ProfilePrivacyResponse` |
| `DELETE` | `/api/v1/profile/mobile-push-token` | [delete_mobile_push_token](../../shared/api/routers/user_profile.py#L501) | `Response` |
| `PUT` | `/api/v1/profile/mobile-push-token` | [put_mobile_push_token](../../shared/api/routers/user_profile.py#L479) | `Response` |
| `GET` | `/api/v1/profile/notification-center` | [get_notification_center](../../shared/api/routers/user_profile.py#L391) | `NotificationCenterGetResponse` |
| `PUT` | `/api/v1/profile/notification-center` | [put_notification_center](../../shared/api/routers/user_profile.py#L451) | `NotificationCenterGetResponse` |
| `GET` | `/api/v1/profile/notification-center/delta` | [get_notification_center_delta](../../shared/api/routers/user_profile.py#L413) | `NotificationCenterDeltaResponse` |
| `GET` | `/api/v1/profile/preferences` | [get_user_preferences](../../shared/api/routers/user_profile.py#L330) | `UserPreferences` |
| `PATCH` | `/api/v1/profile/preferences` | [update_user_preferences](../../shared/api/routers/user_profile.py#L350) | `UserPreferences` |
| `PATCH` | `/api/v1/profile/preferences/language` | [update_language](../../shared/api/routers/user_profile.py#L525) | `UserPreferences` |
| `GET` | `/api/v1/profile/security` | [get_security_settings](../../shared/api/routers/user_profile.py#L544) | `SecuritySettings` |
| `GET` | `/api/v1/profile/sessions` | [list_active_sessions](../../shared/api/routers/user_profile.py#L584) | `list[UserSessionInfo]` |
| `POST` | `/api/v1/profile/sessions/revoke-all` | [revoke_all_sessions](../../shared/api/routers/user_profile.py#L618) | `dict[str, Any]` |
| `DELETE` | `/api/v1/profile/sessions/{session_id}` | [revoke_session](../../shared/api/routers/user_profile.py#L597) | `dict[str, Any]` |
| `GET` | `/api/v1/profile/statistics` | [get_user_statistics](../../shared/api/routers/user_profile.py#L642) | `UserStatistics` |

## /api/v1/projects

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/projects` | [list_projects](../../shared/api/routers/projects.py#L587) | `list[ProjectResponse]` |
| `POST` | `/api/v1/projects` | [create_project](../../shared/api/routers/projects.py#L453) | `ProjectResponse` |
| `DELETE` | `/api/v1/projects/{project_id}` | [delete_project](../../shared/api/routers/projects.py#L858) | `dict[str, str]` |
| `GET` | `/api/v1/projects/{project_id}` | [get_project](../../shared/api/routers/projects.py#L720) | `ProjectResponse` |
| `PUT` | `/api/v1/projects/{project_id}` | [update_project](../../shared/api/routers/projects.py#L760) | `ProjectResponse` |
| `GET` | `/api/v1/projects/{project_id}/members` | [list_project_members](../../shared/api/routers/projects.py#L1077) | `ProjectMembersListResponse` |
| `POST` | `/api/v1/projects/{project_id}/members` | [add_project_member](../../shared/api/routers/projects.py#L1142) | `ProjectMemberResponse` |
| `DELETE` | `/api/v1/projects/{project_id}/members/{member_id}` | [remove_project_member](../../shared/api/routers/projects.py#L1279) | `dict[str, str]` |
| `PUT` | `/api/v1/projects/{project_id}/members/{member_id}` | [update_project_member](../../shared/api/routers/projects.py#L1212) | `ProjectMemberResponse` |
| `POST` | `/api/v1/projects/{project_id}/transfer-lead` | [transfer_project_lead](../../shared/api/routers/projects.py#L1326) | `ProjectResponse` |

## /api/v1/social-hub

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/social-hub/feed` | [get_social_hub_feed](../../shared/api/routers/social_hub.py#L109) | `SocialHubFeedResponse` |
| `GET` | `/api/v1/social-hub/friends/{friend_user_id}/shared-content` | [get_social_hub_shared_content](../../shared/api/routers/social_hub.py#L156) | `SocialHubSharedContentResponse` |
| `GET` | `/api/v1/social-hub/inbox` | [get_social_hub_action_inbox](../../shared/api/routers/social_hub.py#L130) | `SocialHubActionInboxResponse` |
| `GET` | `/api/v1/social-hub/profile/privacy-preview` | [get_social_hub_privacy_preview](../../shared/api/routers/social_hub.py#L145) | `SocialHubPrivacyPreviewResponse` |

## /api/v1/system

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/system/maintenance` | [get_public_maintenance_status](../../shared/api/routers/system_maintenance.py#L60) | `MaintenanceStatus` |

## /api/v1/system-info

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/system-info` | [api_v1_system_info](../../shared/api/main.py#L652) | `dict[str, Any]` |

## /api/v1/text-to-voice

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `POST` | `/api/v1/text-to-voice/process` | [process_text](../../shared/api/routers/text_to_voice.py#L70) | `ProcessTextResponse` |

## /api/v1/tts

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/tts/kokoro/health` | [kokoro_health_check](../../shared/api/routers/tts_kokoro.py#L202) | `dict[str, Any]` |
| `POST` | `/api/v1/tts/kokoro/synthesize` | [synthesize_kokoro_tts](../../shared/api/routers/tts_kokoro.py#L74) | `StreamingResponse` |
| `GET` | `/api/v1/tts/kokoro/voices` | [get_kokoro_voices](../../shared/api/routers/tts_kokoro.py#L174) | `dict[str, Any]` |

## /api/v1/ugs

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/ugs/admin/llama-models` | [get_llama_models](../../shared/api/routers/ugs_admin/providers_routes.py#L179) | `dict[str, list[str]]` |
| `GET` | `/api/v1/ugs/admin/providers` | [list_generation_providers](../../shared/api/routers/ugs_admin/providers_routes.py#L47) | `list[GenerationProviderResponse]` |
| `POST` | `/api/v1/ugs/admin/providers` | [create_generation_provider](../../shared/api/routers/ugs_admin/providers_routes.py#L69) | `GenerationProviderResponse` |
| `POST` | `/api/v1/ugs/admin/providers/bootstrap-runtime` | [bootstrap_runtime_generation_providers](../../shared/api/routers/ugs_admin/providers_routes.py#L131) | `dict[str, Any]` |
| `DELETE` | `/api/v1/ugs/admin/providers/{provider_name}` | [delete_generation_provider](../../shared/api/routers/ugs_admin/providers_routes.py#L115) | `Response` |
| `GET` | `/api/v1/ugs/admin/providers/{provider_name}` | [get_generation_provider](../../shared/api/routers/ugs_admin/providers_routes.py#L56) | `GenerationProviderResponse` |
| `PUT` | `/api/v1/ugs/admin/providers/{provider_name}` | [update_generation_provider](../../shared/api/routers/ugs_admin/providers_routes.py#L90) | `GenerationProviderResponse` |
| `GET` | `/api/v1/ugs/admin/queue-ops` | [get_ugs_queue_ops_snapshot](../../shared/api/routers/ugs_admin/queue_ops_routes.py#L41) | `UGSQueueOpsSnapshotResponse` |
| `GET` | `/api/v1/ugs/admin/settings` | [list_ugs_settings](../../shared/api/routers/ugs_admin/settings_routes.py#L43) | `UGSSettingListResponse` |
| `POST` | `/api/v1/ugs/admin/settings` | [create_ugs_setting](../../shared/api/routers/ugs_admin/settings_routes.py#L70) | `UGSSettingResponse` |
| `DELETE` | `/api/v1/ugs/admin/settings/{setting_id}` | [delete_ugs_setting](../../shared/api/routers/ugs_admin/settings_routes.py#L117) | `Response` |
| `PUT` | `/api/v1/ugs/admin/settings/{setting_id}` | [update_ugs_setting](../../shared/api/routers/ugs_admin/settings_routes.py#L96) | `UGSSettingResponse` |
| `GET` | `/api/v1/ugs/admin/tasks` | [get_admin_ugs_tasks](../../shared/api/routers/ugs/tasks_routes.py#L133) | `list[UGSTaskResponse]` |
| `GET` | `/api/v1/ugs/admin/types` | [list_generation_types](../../shared/api/routers/ugs_admin/types_routes.py#L42) | `list[AdminGenerationTypeResponse]` |
| `POST` | `/api/v1/ugs/admin/types` | [create_generation_type](../../shared/api/routers/ugs_admin/types_routes.py#L69) | `AdminGenerationTypeResponse` |
| `DELETE` | `/api/v1/ugs/admin/types/{type_key}` | [delete_generation_type](../../shared/api/routers/ugs_admin/types_routes.py#L109) | `Response` |
| `GET` | `/api/v1/ugs/admin/types/{type_key}` | [get_generation_type](../../shared/api/routers/ugs_admin/types_routes.py#L56) | `AdminGenerationTypeResponse` |
| `PUT` | `/api/v1/ugs/admin/types/{type_key}` | [update_generation_type](../../shared/api/routers/ugs_admin/types_routes.py#L85) | `AdminGenerationTypeResponse` |
| `GET` | `/api/v1/ugs/admin/users` | [list_admin_users](../../shared/api/routers/ugs_admin/users_routes.py#L48) | `list[AdminUserResponse]` |
| `GET` | `/api/v1/ugs/admin/users/{user_id}` | [get_admin_user](../../shared/api/routers/ugs_admin/users_routes.py#L57) | `AdminUserResponse` |
| `PATCH` | `/api/v1/ugs/admin/users/{user_id}/admin-badge` | [set_user_admin_badge](../../shared/api/routers/ugs_admin/users_routes.py#L97) | `AdminUserResponse` |
| `POST` | `/api/v1/ugs/admin/users/{user_id}/credits` | [top_up_user_credits](../../shared/api/routers/ugs_admin/users_routes.py#L133) | `AdminUserResponse` |
| `PUT` | `/api/v1/ugs/admin/users/{user_id}/limits` | [update_user_limits](../../shared/api/routers/ugs_admin/users_routes.py#L173) | `AdminUserResponse` |
| `PATCH` | `/api/v1/ugs/admin/users/{user_id}/trusted` | [set_user_trusted](../../shared/api/routers/ugs_admin/users_routes.py#L70) | `AdminUserResponse` |
| `POST` | `/api/v1/ugs/admin/v2/bulk` | [ugs_admin_v2_bulk_apply](../../shared/api/routers/ugs_admin/v2_routes.py#L67) | `UgsAdminV2BulkApplyResult` |
| `GET` | `/api/v1/ugs/admin/v2/snapshot` | [ugs_admin_v2_get_snapshot](../../shared/api/routers/ugs_admin/v2_routes.py#L51) | `UgsAdminV2SnapshotResponse` |
| `POST` | `/api/v1/ugs/admin/v2/validate` | [ugs_admin_v2_validate](../../shared/api/routers/ugs_admin/v2_routes.py#L58) | `list[UgsAdminV2ValidationIssue]` |
| `GET` | `/api/v1/ugs/admin/workflows` | [list_comfyui_workflows](../../shared/api/routers/ugs_admin/workflows_routes.py#L42) | `list[ComfyUIWorkflowResponse]` |
| `POST` | `/api/v1/ugs/admin/workflows` | [create_comfyui_workflow](../../shared/api/routers/ugs_admin/workflows_routes.py#L70) | `ComfyUIWorkflowResponse` |
| `POST` | `/api/v1/ugs/admin/workflows/import-from-disk` | [import_comfyui_workflows](../../shared/api/routers/ugs_admin/workflows_routes.py#L90) | `dict[str, Any]` |
| `DELETE` | `/api/v1/ugs/admin/workflows/{slug}` | [delete_comfyui_workflow](../../shared/api/routers/ugs_admin/workflows_routes.py#L130) | `Response` |
| `GET` | `/api/v1/ugs/admin/workflows/{slug}` | [get_comfyui_workflow](../../shared/api/routers/ugs_admin/workflows_routes.py#L57) | `ComfyUIWorkflowResponse` |
| `PUT` | `/api/v1/ugs/admin/workflows/{slug}` | [update_comfyui_workflow](../../shared/api/routers/ugs_admin/workflows_routes.py#L106) | `ComfyUIWorkflowResponse` |
| `GET` | `/api/v1/ugs/analytics` | [get_ugs_analytics](../../shared/api/routers/ugs/stats.py#L131) | `UGSAnalyticsSummaryResponse` |
| `POST` | `/api/v1/ugs/billing/credits/add` | [add_credits](../../shared/api/routers/ugs/billing.py#L106) | `dict[str, str]` |
| `GET` | `/api/v1/ugs/billing/packages` | [get_credit_packages](../../shared/api/routers/ugs/billing.py#L139) | `dict[str, list[dict[str, Any]]]` |
| `POST` | `/api/v1/ugs/billing/packages/{package_name}/purchase` | [purchase_credit_package](../../shared/api/routers/ugs/billing.py#L160) | `dict[str, Any]` |
| `GET` | `/api/v1/ugs/billing/purchase-history` | [get_purchase_history](../../shared/api/routers/ugs/billing.py#L200) | `dict[str, list[dict[str, Any]]]` |
| `GET` | `/api/v1/ugs/billing/stats` | [get_billing_stats](../../shared/api/routers/ugs/billing.py#L42) | `BillingStatsResponse` |
| `DELETE` | `/api/v1/ugs/cancel/{request_id}` | [cancel_generation](../../shared/api/routers/ugs/generation.py#L213) | `dict[str, Any]` |
| `POST` | `/api/v1/ugs/generate` | [generate_content](../../shared/api/routers/ugs/generation.py#L53) | `GenerationResponse` |
| `POST` | `/api/v1/ugs/generate/stream` | [generate_content_stream](../../shared/api/routers/ugs/generation.py#L95) | `StreamingResponse` |
| `GET` | `/api/v1/ugs/health` | [health_check](../../shared/api/routers/ugs/health_metrics.py#L133) | `UGSHealthResponse` |
| `GET` | `/api/v1/ugs/metrics` | [get_generation_metrics](../../shared/api/routers/ugs/health_metrics.py#L180) | `UGSMetricsResponse` |
| `GET` | `/api/v1/ugs/providers` | [list_providers](../../shared/api/routers/ugs/types_providers.py#L182) | `list[ProviderStatusResponse]` |
| `GET` | `/api/v1/ugs/providers/status` | [get_providers_status](../../shared/api/routers/ugs/health_metrics.py#L269) | `UGSProvidersStatusResponse` |
| `GET` | `/api/v1/ugs/providers/{provider_name}/status` | [get_provider_status](../../shared/api/routers/ugs/types_providers.py#L235) | `ProviderStatusResponse` |
| `GET` | `/api/v1/ugs/result/{request_id}` | [get_generation_result](../../shared/api/routers/ugs/generation.py#L184) | `GenerationResultResponse` |
| `GET` | `/api/v1/ugs/stats` | [get_ugs_stats](../../shared/api/routers/ugs/stats.py#L39) | `UGSStatsResponse` |
| `GET` | `/api/v1/ugs/status/{request_id}` | [get_generation_status](../../shared/api/routers/ugs/generation.py#L154) | `GenerationStatusResponse` |
| `GET` | `/api/v1/ugs/tasks` | [get_user_tasks](../../shared/api/routers/ugs/tasks_routes.py#L79) | `list[UGSTaskResponse]` |
| `GET` | `/api/v1/ugs/tasks/tray-summary` | [get_user_tasks_tray_summary](../../shared/api/routers/ugs/tasks_routes.py#L43) | `UGSTraySummaryResponse` |
| `DELETE` | `/api/v1/ugs/tasks/{task_id}` | [delete_user_task](../../shared/api/routers/ugs/tasks_routes.py#L173) | `Response` |
| `GET` | `/api/v1/ugs/types` | [list_generation_types](../../shared/api/routers/ugs/types_providers.py#L57) | `GenerationTypeListResponse` |
| `POST` | `/api/v1/ugs/types` | [create_generation_type](../../shared/api/routers/ugs/types_providers.py#L83) | `GenerationTypeResponse` |
| `DELETE` | `/api/v1/ugs/types/{type_key}` | [deactivate_generation_type](../../shared/api/routers/ugs/types_providers.py#L146) | `dict[str, str]` |
| `PUT` | `/api/v1/ugs/types/{type_key}` | [update_generation_type](../../shared/api/routers/ugs/types_providers.py#L114) | `GenerationTypeResponse` |
| `GET` | `/api/v1/ugs/workflows` | [list_workflows](../../shared/api/routers/ugs/workflows.py#L226) | `UGSWorkflowListResponse` |
| `POST` | `/api/v1/ugs/workflows` | [create_workflow](../../shared/api/routers/ugs/workflows.py#L61) | `UGSWorkflowMutationResponse` |
| `GET` | `/api/v1/ugs/workflows/node-catalog` | [get_workflow_builder_node_catalog](../../shared/api/routers/ugs/workflows.py#L110) | `WorkflowBuilderCatalogResponse` |
| `POST` | `/api/v1/ugs/workflows/validate` | [validate_workflow_graph](../../shared/api/routers/ugs/workflows.py#L268) | `WorkflowValidationResponse` |
| `DELETE` | `/api/v1/ugs/workflows/{workflow_id}` | [delete_workflow](../../shared/api/routers/ugs/workflows.py#L194) | `UGSWorkflowMutationResponse` |
| `GET` | `/api/v1/ugs/workflows/{workflow_id}` | [get_workflow](../../shared/api/routers/ugs/workflows.py#L128) | `UGSWorkflowDetailResponse` |
| `PUT` | `/api/v1/ugs/workflows/{workflow_id}` | [update_workflow](../../shared/api/routers/ugs/workflows.py#L160) | `UGSWorkflowMutationResponse` |
| `POST` | `/api/v1/ugs/workflows/{workflow_id}/duplicate` | [duplicate_workflow](../../shared/api/routers/ugs/workflows.py#L287) | `UGSWorkflowMutationResponse` |
| `POST` | `/api/v1/ugs/workflows/{workflow_id}/execute` | [execute_workflow](../../shared/api/routers/ugs/workflows.py#L407) | `UGSWorkflowExecuteResponse` |
| `GET` | `/api/v1/ugs/workflows/{workflow_id}/executions` | [list_workflow_executions](../../shared/api/routers/ugs/workflows.py#L332) | `UGSWorkflowExecutionsResponse` |
| `GET` | `/api/v1/ugs/workflows/{workflow_id}/executions/{execution_id}` | [get_workflow_execution_detail](../../shared/api/routers/ugs/workflows.py#L373) | `UGSWorkflowExecutionDetailResponse` |

## /api/v1/unified-content

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/unified-content/{content_id}/download` | [download_content_legacy](../../shared/api/routers/unified_content_download.py#L572) | `Response` |
| `GET` | `/api/v1/unified-content/{content_id}/thumbnail` | [get_content_thumbnail_legacy](../../shared/api/routers/unified_content_download.py#L556) | `StreamingResponse` |

## /api/v1/video-calls

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `POST` | `/api/v1/video-calls/gaf-chats/{chat_id}` | [create_gaf_video_call](../../shared/api/video_calls/router.py#L109) | `VideoCallCreateResponse` |
| `POST` | `/api/v1/video-calls/gaf-chats/{chat_id}/group` | [create_gaf_group_video_call](../../shared/api/video_calls/router.py#L179) | `VideoCallCreateResponse` |
| `GET` | `/api/v1/video-calls/pending-incoming` | [list_pending_incoming_video_calls](../../shared/api/video_calls/router.py#L164) | `list[VideoCallPendingIncomingItem]` |
| `POST` | `/api/v1/video-calls/{call_id}/end` | [end_video_call](../../shared/api/video_calls/router.py#L296) | `VideoCallEndResponse` |
| `POST` | `/api/v1/video-calls/{call_id}/invite` | [invite_to_video_call](../../shared/api/video_calls/router.py#L215) | `VideoCallInviteResponse` |
| `POST` | `/api/v1/video-calls/{call_id}/join` | [join_video_call](../../shared/api/video_calls/router.py#L251) | `VideoCallJoinResponse` |

## /api/v1/video-studio

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `POST` | `/api/v1/video-studio/image-to-video` | [image_to_video](../../shared/api/routers/video_studio.py#L311) | `dict[str, Any]` |
| `POST` | `/api/v1/video-studio/image-to-video-json` | [image_to_video_json](../../shared/api/routers/video_studio.py#L365) | `dict[str, Any]` |
| `POST` | `/api/v1/video-studio/suggest-prompt` | [suggest_video_prompt](../../shared/api/routers/video_studio.py#L230) | `dict[str, Any]` |

## /api/v1/voice-center

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/voice-center/health` | [health_check](../../shared/api/routers/voice_center.py#L237) | `dict[str, Any]` |
| `POST` | `/api/v1/voice-center/synthesize` | [synthesize_speech](../../shared/api/routers/voice_center.py#L82) | `VoiceTTSResponse` |
| `GET` | `/api/v1/voice-center/voices` | [get_available_voices](../../shared/api/routers/voice_center.py#L196) | `list[VoiceInfo]` |

## /api/v1/voice-commands

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/voice-commands/audit` | [list_audit_entries](../../shared/api/routers/voice_commands.py#L125) | `list[AuditEntryResponse]` |
| `POST` | `/api/v1/voice-commands/audit` | [create_audit_entry](../../shared/api/routers/voice_commands.py#L58) | `AuditEntryResponse` |
| `GET` | `/api/v1/voice-commands/catalog` | [get_catalog](../../shared/api/routers/voice_commands.py#L117) | `list[dict[str, Any]]` |

## /api/v1/voice-gateway

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/voice-gateway/health` | [health](../../shared/api/routers/voice_gateway.py#L380) | `dict[str, Any]` |
| `POST` | `/api/v1/voice-gateway/map-intent` | [map_intent](../../shared/api/routers/voice_gateway.py#L366) | `MapIntentResponse` |
| `POST` | `/api/v1/voice-gateway/process` | [process_audio](../../shared/api/routers/voice_gateway.py#L302) | `ProcessAudioResponse` |
| `POST` | `/api/v1/voice-gateway/synthesize` | [synthesize](../../shared/api/routers/voice_gateway.py#L273) | `SynthesizeResponse` |
| `POST` | `/api/v1/voice-gateway/transcribe` | [transcribe](../../shared/api/routers/voice_gateway.py#L120) | `TranscribeResponse` |
| `POST` | `/api/v1/voice-gateway/transcribe/async` | [transcribe_async](../../shared/api/routers/voice_gateway.py#L150) | `AsyncTranscribeResponse` |
| `GET` | `/api/v1/voice-gateway/transcribe/status/{transcription_id}` | [transcribe_async_status](../../shared/api/routers/voice_gateway.py#L237) | `AsyncTranscribeStatusResponse` |
| `GET` | `/api/v1/voice-gateway/voices` | [voices](../../shared/api/routers/voice_gateway.py#L296) | `list[dict[str, Any]]` |

## /api/v1/vr-pilot

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `POST` | `/api/v1/vr-pilot/telemetry/events` | [post_vr_pilot_telemetry_events](../../shared/api/routers/vr_pilot_telemetry.py#L95) | `Response` |

## /api/version (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/version` | [get_version](../../shared/api/routers/version.py#L34) | `dict[str, str \| int \| None]` |
| `GET` | `/api/version` | [api_version](../../shared/api/main.py#L563) | `dict[str, Any]` |
| `GET` | `/api/version/domains` | [get_loaded_domains](../../shared/api/routers/version.py#L62) | `dict[str, Any]` |

## /api/voice-center (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/voice-center/health` | [health_check](../../shared/api/routers/voice_center.py#L237) | `dict[str, Any]` |
| `GET` | `/api/voice-center/history` | [get_transcription_history](../../shared/api/routers/voice_center_transcription.py#L446) | `list[VoiceCenterTranscriptionHistoryItemOut]` |
| `GET` | `/api/voice-center/history/{transcription_id}` | [get_transcription_by_id](../../shared/api/routers/voice_center_transcription.py#L498) | `VoiceCenterTranscriptionDetailOut` |
| `GET` | `/api/voice-center/metrics` | [get_transcription_metrics](../../shared/api/routers/voice_center_transcription.py#L546) | `VoiceCenterTranscriptionMetricsOut` |
| `POST` | `/api/voice-center/synthesize` | [synthesize_speech](../../shared/api/routers/voice_center.py#L82) | `VoiceTTSResponse` |
| `POST` | `/api/voice-center/transcribe` | [transcribe_voice_center_audio](../../shared/api/routers/voice_center_transcription.py#L235) | `VoiceCenterTranscriptionResponse` |
| `POST` | `/api/voice-center/transcribe/batch` | [transcribe_voice_center_batch](../../shared/api/routers/voice_center_transcription.py#L633) | `BatchTranscriptionResponse` |
| `GET` | `/api/voice-center/transcribe/batch/{batch_id}` | [get_batch_transcription_status](../../shared/api/routers/voice_center_transcription.py#L812) | `BatchTranscriptionResponse` |
| `GET` | `/api/voice-center/voices` | [get_available_voices](../../shared/api/routers/voice_center.py#L196) | `list[VoiceInfo]` |

## /api/vr-pilot (legacy or unversioned)

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `POST` | `/api/vr-pilot/telemetry/events` | [post_vr_pilot_telemetry_events](../../shared/api/routers/vr_pilot_telemetry.py#L95) | `Response` |

## KBSEW service

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/api/v1/kbsew/barrels` | [list_barrels](../../KBSEW/api/routers/barrels.py#L76) | `list[BarrelResponse]` |
| `POST` | `/api/v1/kbsew/barrels` | [create_barrel](../../KBSEW/api/routers/barrels.py#L84) | `BarrelResponse` |
| `DELETE` | `/api/v1/kbsew/barrels/{barrel_id}` | [delete_barrel](../../KBSEW/api/routers/barrels.py#L102) | `None` |
| `POST` | `/api/v1/kbsew/barrels/{barrel_id}/assets/{asset_id}/reindex` | [reindex_asset](../../KBSEW/api/routers/barrels.py#L244) | `ForceReindexAssetResponse` |
| `PATCH` | `/api/v1/kbsew/barrels/{barrel_id}/enabled` | [set_barrel_enabled](../../KBSEW/api/routers/barrels.py#L112) | `BarrelResponse` |
| `POST` | `/api/v1/kbsew/barrels/{barrel_id}/ingest` | [ingest_document](../../KBSEW/api/routers/barrels.py#L128) | `IngestResponse` |
| `POST` | `/api/v1/kbsew/barrels/{barrel_id}/ingest/upload` | [ingest_upload](../../KBSEW/api/routers/barrels.py#L160) | `IngestResponse` |
| `POST` | `/api/v1/kbsew/barrels/{barrel_id}/reindex` | [reindex_barrel](../../KBSEW/api/routers/barrels.py#L208) | `ForceReindexBarrelResponse` |
| `GET` | `/api/v1/kbsew/barrels/{barrel_id}/status` | [barrel_status](../../KBSEW/api/routers/barrels.py#L275) | `BarrelStatusResponse` |
| `GET` | `/api/v1/kbsew/drivers` | [list_drivers](../../KBSEW/api/routers/barrels.py#L67) | `DriverInfoResponse` |
| `POST` | `/api/v1/kbsew/search` | [search_kbsew_barrel](../../KBSEW/api/routers/search.py#L36) | `SearchResponse` |
| `GET` | `/health` | [health](../../KBSEW/api/main.py#L57) | `dict[str, str]` |
| `GET` | `/metrics` | [metrics](../../KBSEW/api/main.py#L72) | `Response` |
| `GET` | `/ready` | [ready](../../KBSEW/api/main.py#L63) | `dict[str, object]` |

## Root / non-versioned paths

| Method | Registered path | Handler source | Response model / annotation |
|---|---|---|---|
| `GET` | `/` | [root](../../shared/api/main.py#L535) | `dict[str, Any]` |
| `GET` | `/health` | [health_check](../../shared/api/main.py#L552) | `dict[str, Any]` |
| `GET` | `/metrics` | [prometheus_metrics](../../shared/api/main.py#L664) | `Response` |
| `GET` | `/version` | [get_version_short](../../shared/api/routers/version.py#L49) | `dict[str, str]` |
| `GET` | `/ws/health` | [ws_health](../../shared/api/main.py#L748) | `dict[str, Any]` |
