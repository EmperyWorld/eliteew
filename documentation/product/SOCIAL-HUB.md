# Связи (Social Hub)

## Назначение

**Связи** — desktop и mobile social-center EliteEW. Он объединяет обзор социальной активности, друзей, заявки, круги, профильную приватность, мобильный статус и safety-действия.

**Living topology (2026-07-18):** Связи UI на `app.eliteew.ru` (edge → Meet WG → prod-core). GAF video media — `meet.eliteew.ru` по тому же Meet WG backhaul (SSH reverse = reserve) — [INTERNAL-VIDEO-CALLS.md](INTERNAL-VIDEO-CALLS.md), [PRODUCTION-TOPOLOGY-STATE.md](../platform/PRODUCTION-TOPOLOGY-STATE.md) §Current. Site Studio storefronts (`{slug}-site.eliteew.ru`) вне scope Связи; `*.sites.empery.world` / `*.sites.eliteew.ru` не используются как active social hosts.

One-shot implementation / UI full-summary dumps (2026-05-29…31) and dated copy note soft-retired → `trash/` — living SoT is **this document**.

## Пользовательские поверхности

- Desktop `SocialHubApp` (`SocialHubShell`): sidebar **Главная**, **Люди** (подразделы **Контакты** / **Списки** / **Заявки**), **Приватность**, **Телефон**. Section eyebrows (sidebar «Разделы «Связи»», Home «Быстрые переходы» / «Сводка») — sentence-case `SH_SECTION_EYEBROW_CLASS` / `SH_SIDEBAR_SECTION_LABEL_CLASS` (не `DesktopAppSectionLabel` uppercase shout); Home KPI labels `SH_KPI_LABEL_CLASS` sentence-case; workspace panel `SH_WORKSPACE_PANEL_CLASS` без accent radial wash; People directory metric row `SH_DIRECTORY_METRIC_ROW_CLASS` sentence-case, panel glow = quiet hairline (не cyan/emerald radial), IA strip без cyan wash; locks `socialHubSidebarChrome.premium.contract.test.ts`, `socialHubHomeChrome.premium.contract.test.ts`, `socialHubPeopleChrome.premium.contract.test.ts` (**2026-08-05**). Legacy deep links `socialHubTab` (`overview`, `inbox`, `friends`, `circles`, `privacy`, `profile`, `mobile-app`) map in `shared/web/frontend/src/features/friends/social-hub/socialHubNavigation.ts`. Product copy and chrome locks live in this document + Vitest premium contracts (dated `SOCIAL-HUB-UI-COPY-*` / desktop UI full-summary one-shots → `trash/`). **UI polish (2026-05):** compact shell below ~940px (horizontal section nav + Arrow keys), workspace panel border, People subnav with request badge and keyboard focus, Home quick-link fieldset, context line `section · subview` on People, lazy Privacy/Phone skeleton, flat section leads via `SocialHubSectionLead` (privacy preview + mobile hub — no gradient heroes). **Premium UX / typography / metric / Phone / People / Friend card waves** — see chrome contracts cited above (`socialHub*Chrome.premium.contract.test.ts`).
- Desktop Action Inbox: `GET /api/v1/social-hub/inbox` возвращает bounded privacy-safe cards for incoming requests, stale sent requests, privacy review, relationship limits and empty circles. Follow-up UI pass: load failures use the shared `DesktopProductStatusBanner` with `role="alert"` / assertive live-region semantics and a retry CTA; action cards show localized type-based titles/summaries, target-section, severity and relative-age chips while still treating backend target tabs as whitelisted hints.
- Desktop Privacy = **interactive Profile Home** (`features/friends/social-hub/profile-home/`): IdentityHero + PrivacyBoard (fields + audiences always visible) + AccountPulse (stats + recent activity) + password disclosure. Identity admin badge (`AdminCustomBadge`) sentence-cases ALL-CAPS labels (e.g. FOUNDER→Founder), no CSS `uppercase`; pulse eyebrows `SH_SECTION_EYEBROW_CLASS`; privacy chips sentence-case / `rounded-md`; locks `adminCustomBadge.premium.contract.test.ts`, `socialHubProfileHomeChrome.premium.contract.test.ts` (**2026-08-05**). One primary CTA **«Настроить видимость»**. Deep editors are **sheets** (visibility / identity / activity) that replace Home — not peer empty rooms or stacked `UserProfile` tabs. Visibility editor: `ProfilePrivacySection` `layout="premium"`. After privacy PATCH, React Query invalidates `['social-hub','privacy-preview']` so PrivacyBoard refreshes.
- Desktop Mobile tab keeps the existing mobile overview API but presents account login, mobile SSO activity, current build, APK size and audit-event count as a compact release/status summary; **W5 (2026-07-16):** `MobileHubOtaObservabilityStrip` surfaces published `version`/`apk_sha256`/`published_at` plus active trusted-device count and edge-sync aggregate (`wg_edge_sync_status` / last `wg_edge_synced_at`). Load failures use the shared assertive product status banner with retry, mobile APK/SSO history events are localized in RU/EN before rendering, non-empty history shows events/types/latest summary cards before the list, and an empty history remains visible with a refresh CTA. **Call target (2026-07-17):** Phone section owns `users.preferences.video_calls.call_target` (`MobileHubCallTargetPanel`); Android Profile shows a read-only mirror — [`INTERNAL-VIDEO-CALLS.md`](INTERNAL-VIDEO-CALLS.md).
- Desktop Friend Card shared-content tab uses the same assertive product status banner with retry for load failures and shows total/from-friend/shared-by-me summary cards before the row list, so shared files/documents stay recoverable and scannable without leaving the friend card; destructive block confirmation uses an assertive status banner, the report form is exposed as a named safety section, reminder placeholder is framed as guidance, empty relationship history now shows an actionable empty state with chat/notes shortcuts instead of passive text, empty private notes offer a local starter template before saving, note draft status shows whether local text changed before save, empty circle assignment is framed as guidance instead of a loose text row, and non-empty circle assignment shows assigned/available summary chips before controls.
- Android Friends Lite: друзья, поиск кандидатов, отправка заявки по user id, входящие заявки, исходящие заявки, отмена исходящих заявок, mobile Связи overview card, relationship controls, friend detail dialog, report dialog и круги из `/api/v1/friends/overview`; membership из `friends[].circles` отображается badge-ами и даёт локальный фильтр списка без Room-миграции. Android Retrofit also declares circle create/update/delete plus Связи inbox/privacy-preview DTOs for parity.
- Android Profile tab редактирует account-scoped profile privacy через `/profile/me/privacy`, включая circle-specific visibility для avatar/name/bio, and shows a local visibility preview card before save.
- Android push/deep links can focus Friends on an incoming request (`request_id`) or open friend detail (`friend_user_id`); backend friend notifications include `social_hub_section` and use `tab=inbox` for incoming-request actions.
- Мессенджер остаётся отдельным приложением для личной переписки; Связи управляет графом друзей и настройками отношений.

## API-контракты

- `GET /api/v1/friends/overview` — bounded snapshot: friends, incoming/sent requests, circles, stats, ETag/304.
- `GET /api/v1/friends/referral` — owner-scoped invite link for mobile/desktop share UI (`referral_code`, `invite_url`, `share_message`).
- `GET /api/v1/friends/referral/preview?code=` — public bounded preview for referral landing (`inviter_display_name` only).
- `GET /api/v1/friends/users/search` — relationship-aware user search for desktop/mobile add-friend flows.
- `POST /api/v1/friends/request` и `POST /api/v1/friends/request/by-user/{user_id}` — отправка заявки с rate-limit guard.
- `POST /api/v1/friends/requests/{request_id}/accept|reject|cancel` — lifecycle заявок. Android Retrofit использует plural `requests`.
- `POST /api/v1/friends/circles`, `PATCH /api/v1/friends/circles/{circle_id}`, `DELETE /api/v1/friends/circles/{circle_id}` — owner-scoped circle create/edit/delete; Android DTOs are additive and tolerate visual metadata.
- `GET /api/v1/friends/{user_id}/profile` — detailed friend card payload for mobile/desktop: relationship controls, circles, private note and relationship timeline timestamps.
- `PATCH /api/v1/friends/{user_id}/relationship` — favorite/mute/block/activity sharing/circles/private note.
- `POST /api/v1/friends/{user_id}/report` — user report into `social_user_reports`; repeated reports by the same reporter for the same user are rejected for 24h without inserting a duplicate row.
- `GET /api/v1/friends/admin/reports` — admin moderation queue (filter `status`, `q`, limit/offset); summary-only rows. Auth: `require_admin_user`.
- `GET /api/v1/friends/admin/reports/{report_id}` — admin report detail.
- `PATCH /api/v1/friends/admin/reports/{report_id}` — status lifecycle `open` → `in_review` → `resolved`|`dismissed` (reopen `dismissed`→`open`); sets `reviewed_at` / `reviewer_user_id`. Unified Admin section `?section=socialReports`.
- `GET/PATCH /api/v1/profile/me/privacy` — owner-only profile discoverability and field visibility (`avatar`, `full_name`, `bio`, optional `*_circle_id`) for Связи search/card redaction.
- `GET /api/v1/social-hub/feed` — privacy-safe feed summaries only; no private notes, message bodies or hidden profile fields. Поддерживает bounded cursor, `types[]` и owner-scoped circle filter; invalid cursor/circle input returns HTTP 400.
- `GET /api/v1/social-hub/inbox` — bounded action cards; no private notes, message bodies or raw profile fields.
- `GET /api/v1/social-hub/profile/privacy-preview` — owner-only visibility outcome matrix for desktop/mobile preview UX.
- `GET /api/v1/social-hub/friends/{friend_user_id}/shared-content` — bounded Friend Card read model over `unified_content` rows visible between the current user and a mutual friend. Requires non-blocked friendship in both directions and returns file/document summaries only.
- `GET /api/v1/friends/referral` — authenticated stable referral code + mobile-app invite URL (`?ref=<code>`) for Friends share UI; persisted in `user_referral_codes`.
- `GET /api/v1/friends/referral/preview?code=<code>` — public landing preview (display name + invite URL only); invalid code → HTTP 404.
- `POST /api/v1/video-calls/gaf-chats/{chat_id}` / `POST /api/v1/video-calls/{call_id}/join` — media escalation from GAF; Связи block semantics must be rechecked before create/join.

## Safety инварианты

- Block suppresses new friend requests and GAF video-call create/join when either side has an active blocked relationship row.
- Friend request send has a 24h bounded guard.
- Report payload is owner-scoped and stores moderation audit separately from private relationship notes.
- Admin report list/patch never returns private friendship notes or chat bodies; non-admin callers receive HTTP 403.
- Desktop and Android report dialogs must collect a non-empty reason and optional details before calling `/friends/{user_id}/report`; one-click blind reports are not allowed.
- Android Friends Lite relationship controls and circle membership must not alter Room schema; live overview flags/circles are mapped into a UI model and the legacy cache keeps only basic friend identity.
- Android Friends Lite detail dialog uses the existing friend profile/relationship contracts for private notes and circle membership. Profile privacy editing stays account-scoped; the friend detail screen only changes viewer-owned relationship metadata.
- Android Profile privacy editor updates account-scoped visibility only; it may read circles for `circle` visibility selection but must not mutate friend relationships, private notes or circle memberships.
- Feed read model exposes relationship/event summaries only, excludes blocked friendships/request counterparts, validates cursors before SQL, and redacts profile fields through `profile_privacy`.
- Feed coverage must assert both SQL boundary filters and serialized profile redaction; invalid cursor/circle input must not acquire a DB connection.
- Desktop feed previews must localize event types (`friendship_created`, `friend_request_*`) before rendering; raw enum labels are support data, not primary copy.
- Связи desktop deep links use typed `WindowInitialPayload` (`socialHubTab`, `socialHubFriendUserId`); `sessionStorage` is only a legacy fallback inside the app.
- Android Friends deep links use intent extras/data keys (`request_id`, `friend_user_id`, `focus`) only as focus hints; the screen refreshes `/friends/overview` before highlighting or opening detail.
- Friend notification metadata is recipient-relative: incoming-request `friend_user_id` is the sender; accepted-request `friend_user_id` is the accepter now visible as a friend.
- Friend request notifications route to the Action Inbox (`tab=inbox`, `focus=incoming`, `social_hub_section=inbox`) while accepted-request notifications keep friend detail focus.
- Action Inbox and privacy preview are read-models only: they must remain bounded, current-user scoped, and summary-only.
- Friend Card shared tab renders real shared-content rows from `unified_content`; relationship-derived sharing signals remain secondary context.
- Friend Card relationship action center (2026-05-29) must keep the next action visible on desktop and Android: blocked > muted > privacy-limited > start-chat > ready. Desktop exposes a named `region` with Chat / Shared / Privacy actions; Android Friends detail uses the same priority model before notes/circles.
- Shared-content read model must not expose private notes, file bodies, message bodies or blocked/non-friend content. SQL guards cover mutual friendship, block flags, direct `content_shares`, `shared_with_user_ids`, `visibility='friends'`, `friend_visibility`, and per-user library removals.

## Код

- Backend routers: `shared/api/routers/friends.py`, `shared/api/routers/friends_admin_reports.py`, `shared/api/routers/social_hub.py`.
- Backend services: `shared/api/services/friends_service.py` (facade) → `shared/api/services/friends/*` (`FriendsServiceBase` + typed mixin chain: overview/graph/circles, requests/search, profile, relationship_controls), `friends_referral_service.py`, `social_hub_feed_service.py`, `api/video_calls/service.py`.
- Observability: `social_hub_*` counters in `shared/api/monitoring/metrics.py`.
- Frontend: `shared/web/frontend/src/features/friends/`; admin queue `pages/Admin/SocialReportsAdminSection.tsx` (`section=socialReports`).
- Android: `pack-cloud/mobile/feature/friends/`, `pack-cloud/mobile/feature/profile/`, `pack-cloud/mobile/core/network/src/main/java/world/empery/mobile/core/network/api/FriendsApiContracts.kt`.
- Migrations runner: `docker/scripts/apply-eliteew-migrations.sh` includes Связи circle metadata and reports migrations.

## Проверки

- API: `bash docker/scripts/run-stack0-api-tests.sh tests/test_friends_api_contract.py tests/test_friends_admin_reports_contract.py tests/test_friends_referral_contract.py tests/test_friends_referral_service.py tests/test_social_hub_feed_api.py tests/test_social_hub_observability_metrics.py tests/test_video_calls_block_contract.py`.
- DB schema guard for circle UI metadata: `SELECT column_name FROM information_schema.columns WHERE table_name = 'friend_circles' AND column_name IN ('color', 'icon') ORDER BY column_name;` must return both `color` and `icon` before `/api/v1/friends/overview` can safely include circle chips.
- Frontend: Biome on changed Связи/Desktop payload files, focused `FriendPersonCard.test.tsx` / `SocialHubApp.test.tsx` / `desktopOpenPayloads.test.ts`, `pnpm run i18n:check`, `pnpm run build:react-compiler`, `node scripts/verify-app-build-id.mjs`.
- Android: `./gradlew :core:network:testDebugUnitTest :feature:friends:testDebugUnitTest :feature:profile:compileDebugKotlin`; release/deploy waves still use `:app:assembleDevDebug` or prod release gates.
