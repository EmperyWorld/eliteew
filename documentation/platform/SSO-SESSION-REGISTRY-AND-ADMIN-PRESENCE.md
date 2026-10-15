# SSO session registry, presence и админка «онлайн по каналам»

Канон для операторов и разработчиков: как EliteEW различает **SSO Keycloak** (`browser` / `mobile` / `desktop` / **`fofline`**), **Socket.IO presence** и **окна рабочего стола** — три независимых слоя, которые нельзя смешивать в UI и логах.

> **Текущая production-политика (2026-08-02, `keycloak-auth-001`):** запрет «N вкладок = N полноценных REST-клиентов» — **wontfix** (общий JWT). Политика «1 browser Socket.IO» — hygiene (leader-tab + Redis lease); подробности в этом документе и [REALTIME-SOCKETIO-AND-WS.md](REALTIME-SOCKETIO-AND-WS.md) (dated bug note soft-retired → `trash/`). В админке `веб: N` при здоровом SSO — **не** авария Keycloak. Proposed replacement: [WEB-SSO-SESSION-CONTINUITY-CONTRACT.md](WEB-SSO-SESSION-CONTINUITY-CONTRACT.md) + `documentation/plans/platform/BROWSER-TAB-SESSION-OWNERSHIP-PLAN.md` *[operator-local process plan; gitignored — not living canon]*; this policy stays active until their explicit transition release.

Связанные документы:

- Keycloak clients и harden: **`platform/docker-re_doc/KEYCLOAK-ELITEEW.md`**
- Мобильный OAuth flow: **`product/mobile/ANDROID-DEVELOPER-HANDBOOK.md`** (раздел SSO)
- Код реестра: `shared/api/services/sso_session_registry.py` (facade) → `sso_session_claims.py` (claims/enrich/confirm), `sso_session_registry_enforce.py` (enforce + notify hook), `sso_session_registry_query.py` (admin batch/history)
- Presence (Redis): `shared/api/services/presence_service.py`
- Админ UI: `shared/web/frontend/src/pages/Admin/AdminUsersHubSection.tsx`, `AdminUserDetailPanel.tsx` (facade) + `adminUserDetail/` (sessions/overview tabs), `adminUserRoles.ts`

---

## Три слоя «сессии» (не путать)

| Слой | Что измеряет | Где хранится | Админка (Users hub) |
|------|----------------|--------------|---------------------|
| **Socket.IO presence** | Живые **realtime** Socket.IO sid (браузер + нативное приложение) | Redis `presence:v1:*` | «Веб · Socket.IO» → **веб: N · моб: M** |
| **SSO Keycloak registry** | Текущая KC-сессия по классу `browser` / `mobile` / `desktop` / `fofline` (один `sid` на класс) | Postgres `sso_user_sessions` | «Веб · SSO Keycloak» / «Мобильное · SSO» / «Desktop · SSO» / «FoFline · SSO» (N/5 chips); license/peer/WG version — enrich + heartbeat |
| **Desktop shell snapshot** | Открытые **окна** рабочего стола | Postgres `shell_state.windows_snapshot` | Toast «Окна рабочего стола восстановлены (N)» — **не** SSO и не Socket.IO |

**Политика «1 browser + 1 mobile + 1 desktop» (Keycloak + SSO registry)** ограничивает **логин Keycloak** (`userClientLimit=1` на `empery-web` / `empery-mobile`; `empery-desktop` — отдельный `client_class=desktop`), а **не** число вкладок Chrome и **не** число окон desktop shell.

**Политика «1 realtime desktop на пользователя в браузере» (2026-05-23+, hygiene — не SSO):**

- На фронте: **leader-tab** — только одна вкладка `#/desktop` держит `Services.socket`; остальные получают GAF-события через `BroadcastChannel` relay (`desktopRealtimeLeader.ts`, `GAFChatProvider`).
- На API: при browser Socket.IO connect **newest-wins** — `force_claim_browser_socket_lease` + disconnect older live sids (`presence_superseded` на старый sid). Newcomer **не** отклоняется (раньше `reject duplicate` давал клиентские `Connection rejected by server`).
- **Админка:** `веб: N` — счётчик Socket.IO, **не** Keycloak sessions. При `presence_sessions_web > 1` и здоровом SSO chips/overview/diagnostic явно говорят «не Keycloak» (`anomalyNotKeycloak`). Цель hygiene: `веб: 1` (+ `моб: 1` при Android). Multi-tab full REST/UI — **CLOSED wontfix** (shared JWT); living policy in this doc + [REALTIME-SOCKETIO-AND-WS.md](REALTIME-SOCKETIO-AND-WS.md).

**N вкладок `#/desktop` без leader-tab (legacy):** каждая вкладка → отдельный `record_connect` → `presence_sessions_web = N`, при этом **SSO browser остаётся 1** (общий `localStorage` токен). Это не противоречие SSO — это отдельный слой presence.

**«веб: 2» при desktop + mobile app** — норма: один browser Socket.IO + один mobile (`empery-mobile`), не «две вкладки Chrome».

---

## SSO session registry

### Назначение

После успешного OAuth EliteEW фиксирует **текущий Keycloak session id (`sid`)** отдельно для:

- **`browser`** — клиент `empery-web` (SPA / WebView shell)
- **`mobile`** — клиент `empery-mobile` (MobileAndroid in-app SSO WebView + backend callback)
- **`desktop`** — клиент `empery-desktop` (Tauri обменивает authorization code сам; первый Bearer/Socket.IO boundary регистрирует `sid` только после JWT validation и current-binding PEP)
- **`fofline`** (**W1 living in registry + harden**; **W3 Admin chip Partial**) — клиент `empery-fofline`. Product: [`DESKTOP-FOFLINE-EDITION.md`](../product/desktop/DESKTOP-FOFLINE-EDITION.md) — **target** local SPA pack; remote Start = **dev-only** (`VITE_FOFLINE_REMOTE_START` + `ELITEEW_FOFLINE_REMOTE_START`), forbidden when pack ready (L5). **XOR vs `browser`:** `SSO_FOFLINE_BROWSER_XOR_POLICY` = `displace` (default) | `deny` | `off`. Admin directory `sso_fofline_*` + «FoFline · SSO» card (session chip ≠ seat entitlement / ≠ SPA pack downloaded).

Миграции constraint: `shared/api/migrations/applied/20260807_sso_client_class_desktop.sql` (**applied on prod-core** 2026-08-07); FoFline additive `shared/api/migrations/applied/20260809_sso_client_class_fofline.sql` (apply on prod with W1 release).
При входе с **новым** `sid` того же класса:

- заменить текущий `sid` может OAuth callback `POST /api/v1/auth/sso/callback`, первый запрос с **проверенным current native binding** (`desktop` / `fofline`) или Socket.IO connect с browser-confirm;
- для `browser` callback сначала требует **явного подтверждения takeover** (`409`, reason `session_replace_confirmation_required`); совпадение User-Agent не считается подтверждением;
- native auto-replace разрешён только в порядке `JWT validation → binding claims → DB current-binding PEP → SSO registry`; stale/revoked binding не может переписать registry, browser/mobile semantics не меняются;
- после подтверждения новый `sid` заменяет старый;
- старый браузер затем получает `401`, reason `session_replaced`; Socket.IO с не-current `sid` отклоняется с `auth:session_replaced` **на connect**;
- **активные** Socket.IO, уже подключённые со старым Keycloak `sid`, получают **`auth_error`** (`reason=session_replaced`) и **немедленный disconnect** через `socket_sso_session_watch.notify_sso_session_replaced` (лог `[SESSION_KILL]`, **R-01**); `emperyworld-heartbeat` дополнительно сверяет binding с `lookup_current_session_id` (read-only SELECT, без row lock).

Подтверждение передаётся заголовком `X-SSO-Replace-Confirm: 1` из frontend после пользовательского диалога (HTTP) **или** полем `sso_replace_confirm: 1` в Socket.IO handshake auth (`authenticatedSocketAuth.ts` → `buildSocketAuthPayload`).
При успешном connect с confirm сервер эмитит **`sso_replace_confirmed`** (`status=ok`) на новый sid; клиент (`useSocketConnection`) слушает **`auth_error`** mid-connection и запускает token refresh / reconnect без ручного F5.
**SPA UX (2026-06):** вместо `window.confirm` — desktop-styled modal (`SsoSessionReplaceConfirmHost` + `desktopUi.sessionAuth.*`); отмена показывает toast «вход отменён», другая сессия сохраняется. Канон: `product/FRONTEND-AUTH.md` §Session Replacement UX.
Frontend держит окно «confirm accepted» в `sessionStorage` (`eliteew.auth.sessionReplaceConfirmedUntil.v1`): **~30 с** после mid-session modal; **15 мин** когда `LoginPageFallback` вооружает confirm **до** auto-SSO / «Войти» (`SESSION_REPLACE_CONFIRM_OAUTH_WINDOW_MS`), чтобы первый PKCE callback уже нёс `X-SSO-Replace-Confirm: 1` и не требовал второго входа при stale browser `sid`. Если confirm не был armed и callback получил `409 session_replace_confirmation_required`, одноразовый `code` не retry'ится: UI на login fallback, следующий явный «Войти» — новый PKCE уже с confirm (+ `forceFreshAuth` при pending markers).
Socket.IO **не инициирует** takeover сам по себе: connect без confirm отклоняется при stale `sid`; с confirm — тот же `enforce_current_session`, что и HTTP bearer, с `allow_session_replace=True`.

### Обязательные claims

Реестр **не пишет** строку и **не обновляет** `last_seen_at`, если в payload нет **обоих**:

1. **`sub`** — Keycloak user id
2. **`sid`** (или legacy `session_state`)

Симптом в логах API:

```text
SSO registry skipped: missing sid/session_state (sub=None azp=empery-mobile ...)
```

Callback при этом может вернуть **200** — это не баг HTTP, а пропуск side-effect реестра.

### OAuth callback (мобильный и веб) и native first-use

Путь: `POST /api/v1/auth/sso/callback`

1. Web SPA / MobileAndroid получают authorization `code` через свой PKCE transport и передают его в backend callback. Web не меняет code на tokens напрямую в браузере; MobileAndroid login transport is in-app WebView, not Chrome/Custom Tabs.
2. `exchange_code_for_token` → access + refresh + **id_token**
3. `get_user_info(access_token)` → гарантированный `sub`
4. `validate_token(access_token)` → JWT/introspection payload
5. **`enrich_sso_payload_for_registry`** — объединяет access + **id_token** + **userinfo** (см. `sso_session_registry.py`)
6. `enforce_current_session(..., oauth_client_id=empery-web|empery-mobile, allow_session_replace=True)`
7. Backend возвращает tokens; web дополнительно проверяет `id_token.nonce` против сохранённого PKCE state перед сохранением tokens.

`oauth_client_id` берётся из **`redirect_uri`** (`world.empery.mobile:*` → mobile), а не только из `azp` токена.

Tauri `empery-desktop` / `empery-fofline` не отправляет одноразовый code в этот callback: Rust выполняет PAR + PKCE/DPoP token exchange напрямую. Поэтому первый API или Socket.IO запрос с новым native token обязан сначала пройти current-binding PEP, а затем вызвать `enforce_current_session(..., allow_session_replace=True)`. Без этого handoff новый Keycloak `sid` ошибочно отвергается как `session_replaced`, хотя credential + binding commit уже успешны.

### Keycloak: требования к `empery-mobile`

Скрипт **`docker/scripts/keycloak-harden-empery-realm.sh`** (идемпотентно):

| Элемент | Зачем |
|---------|--------|
| Default scope **`basic`** | Базовые OIDC-claims в access token (Keycloak 26; отдельного scope `openid` в списке client-scopes нет) |
| Default scopes `profile`, `email`, `roles`, `web-origins` | Scope `openid profile email` в запросе мобилки без `invalid_scope` |
| Protocol mapper **`sub-access-token`** | `sub` в access + introspection |
| Protocol mapper **`session-id-access-token`** | `sid` в access + introspection + id_token |
| Mapper **`audience-empery-api`** | Audience для API |
| Redirect URIs **только** на `empery-mobile` | Иначе KC выдаёт `azp=empery-web` для mobile callback |

**После изменения scopes/mappers** пользователь должен **полностью выйти из мобильного приложения и войти снова** — старые access token без `sub`/`sid` не попадут в реестр.

Проверка в Keycloak Admin:

```text
Clients → empery-mobile → Client scopes → default: basic, profile, email, roles, web-origins
Clients → empery-mobile → Client scopes → Evaluate → generated access token → есть sub и sid
```

### Активность в админке

Два порога для SSO-канала:

| Статус UI | Условие | Смысл |
|-----------|---------|--------|
| **онлайн** (зелёный) | `last_seen_at` ≤ **3 мин** (`SSO_SESSION_LIVE_WINDOW`) | Клиент **сейчас** шлёт API с токеном этого канала |
| **недавно** (янтарный) | ≤ **30 мин** (`SSO_SESSION_ACTIVE_WINDOW`), но > 3 мин | Сессия ещё «теплая», но клиент мог отключиться (режим полёта, закрыто приложение) |
| **нет** (серый) | > 30 мин или нет строки | Канал неактивен |

**User-Agent в карточке SSO** — главный индикатор устройства:

- `Mozilla/… Chrome/…` — браузер (desktop)
- `okhttp/…` — MobileAndroid HTTP-клиент

**Важно:** если в канале «Веб · SSO» UA = `okhttp`, мобильное приложение шлёт API с токеном **`empery-web`** (ошибка клиента). В логах API: `SSO registry: browser channel touch from native mobile HTTP client`. Исправление: re-login в мобилке после harden `empery-mobile`; убедиться, что приложение хранит токены **`empery-mobile`**, не web.

**Mobile client guard (2026-07-17):** `AuthRepository` + `MobileAccessTokenClientGuard` отказывают persist / `hasSession`, если access JWT `azp` ≠ ожидаемый `empery-mobile` client id — телефон не должен жить в browser-слоте registry.

**Один IP** (например `31.200.239.94`) у web и mobile — норма за NAT; IP **не** различает устройства.

### Socket.IO presence в админке

Строка «**веб: N · моб: M**» — разбивка живых Socket.IO по `azp` токена при connect (`empery-web` → веб, `empery-mobile` → моб).

| `sessions_web` | Интерпретация |
|----------------|---------------|
| **0** | Нет browser realtime (desktop закрыт или follower-tab без leader) |
| **1** | **Норма** — один leader-tab или один browser-клиент |
| **>1** | **Аномалия** — несколько параллельных browser Socket.IO; API логирует `presence anomaly`; UI: «ожидается 1 веб (несколько вкладок?)» |

Legacy-соединения без metadata считаются browser web до переподключения.

### Leader-tab (один realtime desktop)

Код:

- `shared/web/frontend/src/pages/Desktop/utils/desktopRealtimeLeader.ts` — Web Locks (`eliteew-desktop-realtime:{userId}`) + BC handoff при смене видимой вкладки.
- `GAFChatProvider` — connect только на leader; relay GAF/video events на `eliteew-desktop-realtime-v1`.
- `useSocketConnection` (`App.tsx`) — тот же lock на admin/не-desktop; follower-вкладки без `io()`.
- `socketio_handler.connect` — **newest browser connect wins**: `try_claim_browser_socket_lease` (NX + steal dead holder); if lease still held by a live sid, **`force_claim_browser_socket_lease`** then disconnect older sids (`presence: takeover` / `presence: superseding`). Do **not** reject the newcomer as duplicate (that caused client `Connection rejected by server` storms).
- Client (`EmperyworldSocketService` + `GAFChatProvider`): on `presence_superseded` with `reason=single_browser_realtime` **retry connect** without teardown storm; `connection-restored` on every successful connect syncs UI; probe 60 s, skip when `connecting`. **Transport policy:** all SPA Socket.IO clients use `['websocket','polling']` via `socketIoClientPolicy.ts`. After **transport close / ping timeout** the client **reuses the Engine.IO sid** (built-in reconnect). `forceNew: true` only after stale Engine.IO **HTTP 400**, then a short delay so Redis `browser_lease` can release. **API:** `try_claim_browser_socket_lease` retries once (~150 ms) and steals when the holder Engine.IO transport is `closing`/`closed` (`is_socketio_sid_live`); otherwise force-claim.
- `VideoCallApp`: reuse window per `call_id` (one Jitsi iframe, not N× «я» в meet).

Событие клиенту: `presence_superseded` / `single_browser_realtime` → панель «Живая связь с задержкой» может мигать до успешного reconnect; после деплоя 2026-06-22 клиент сам догоняет lease (probe каждые 30 с, retry через 5 с). Hard refresh всех вкладок — если зависло часами на старом bundle.

### Приёмка (оператор / QA)

1. Залогиниться на `app.eliteew.ru/#/desktop`.
2. Открыть **6 вкладок** с тем же desktop под одним пользователем.
3. **После деплоя leader-tab + server supersede:**
   - Redis / админка: **`веб: 1`** (не 6).
   - SSO browser: **1** (как и раньше).
   - `ss -tn sport = :443` на машине оператора: **один** долгоживущий Socket.IO/WebSocket к edge (плюс обычный HTTP), не шесть параллельных realtime.
4. Закрыть leader-вкладку → другая вкладка забирает lock → `веб: 1` сохраняется.
5. Логи API при аномалии: `presence anomaly: user=… has N browser Socket.IO sessions`.

Wave D note (2026-07-28): latest code cleanup covered nginx `/ws` retire plus BE/FE god-file split; acceptance above must be re-run on prod after the next baked release before removing the OPEN bug marker.

### Пример диагностики (2026-05-23)

| Пользователь | Факт | SSO browser UA | SSO mobile | Интерпретация |
|--------------|------|----------------|------------|---------------|
| **lady_boss** | только телефон | `okhttp` (недавно) | `okhttp` (онлайн) | Mobile OK; browser row — legacy/mis-token, устареет |
| **poet** | телефон offline, только ПК | `Chrome` (онлайн) | `okhttp` (**недавно**, ~5 мин) | Web live; mobile «недавно», не «онлайн» после UI fix |

---

## Socket.IO presence

### Назначение

Redis-счётчик **живых Socket.IO sid** на пользователя. Используется для:

- списка «онлайн» в админке;
- команд reload/logout через presence (доставка события во все sid).

### Источники соединений (типично)

| Клиент | Когда подключается | Лимит |
|--------|-------------------|--------|
| **`Services.socket`** (leader-tab в `GAFChatProvider`) | Одна вкладка `#/desktop` на browser profile | **1** web sid на user (server supersede) |
| **`useSocketConnection`** (`App.tsx`) | Admin и прочие **не-desktop** маршруты (leader-tab) | **1** web sid на user (тот же lock, что desktop) |
| **MobileAndroid** `RealtimeChatBridge` | Нативное приложение | 1 mobile sid (+ 1 web если desktop открыт) |

### Зачистка

- При `disconnect` — `record_disconnect`
- При connect — `_prune_stale_presence_sids` (удаляет sid из set, если TTL-ключ истёк без disconnect)
- TTL sid-ключа: **400 с** (~ heartbeat 60 с + запас)

---

## Админка Users hub — четыре карточки канала

| Карточка | Источник данных | Поля |
|----------|-----------------|------|
| Веб · Socket.IO | `batch_presence_for_user_ids` | `presence_online`, `presence_sessions`, `presence_sessions_web`, `presence_sessions_mobile`, `presence_last_seen_at` |
| Веб · SSO Keycloak | `batch_sso_sessions_for_user_ids` → `client_class=browser` | KC client, IP, UA, `sso_browser_active`, `sso_browser_live` |
| Мобильное · SSO | то же → `client_class=mobile` | KC client, IP, UA, `sso_mobile_active`, `sso_mobile_live` |
| Desktop · SSO | то же → `client_class=desktop` + license/peer enrich + `desktop_client_runtime_presence` | KC client, IP, UA; license/peer by `bound_keycloak_sub`; app version / WG-up from client heartbeat |

Детальная история: `GET /api/v1/desktop/admin/users/{user_id}/sso-overview` (browser/mobile/**desktop**).

Heartbeat: `POST /api/v1/desktop-client/runtime/presence` (active `license_id`+`device_id`; optional OIDC). Enrich: `api/services/desktop_client/admin_directory_enrich.py` (license/peer by `bound_keycloak_sub` + runtime row). Migration `applied/20260808_desktop_client_runtime_presence.sql` — runner `20260808_04|desktop_client_runtime_presence` — **applied on prod-core** 2026-08-08 (`schema_migrations`). API/SPA code still needs stack0 bake or dev-bind for Admin chips to appear in public runtime.

**CORS:** Tauri WebView preflight (`OPTIONS` + `Origin: https://tauri.localhost` / siblings) must succeed (`200`); stack0 merges desktop-client origins in `api.core.cors_origins` (see `product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md`). `OAuth2ProtectionMiddleware` already skips `OPTIONS`; failure mode historically was Starlette CORS `400`, not Bearer.

### Каталог Users hub (UI, 2026-05+)

- **Компактные каналы** — переключатель в панели фильтров; в строке `N/4` и четыре индикатора (Socket.IO / SSO веб / SSO моб / SSO Desktop). При `веб > 1` — маркер `!` (аномалия presence).
- **Фильтры API:** `role=emperyworld_member` включает и `brotherhood_member` в Postgres; `app_access_group_id` (UUID или `__none__`); поиск по UUID в `search`.
- **Deep link / share URL:** query `section=users` + фильтры (`q`, `role`, `active`, `trusted`, `verified`, `online`, `group`, `anomaly`, `ssoBrowser`, `ssoMobile`, `ssoDesktop`, `sort`, `page`, `userId`). Кнопка **Ссылка** копирует текущий URL. Приоритет при открытии: URL → localStorage last-filters.
- **Сортировка:** выпадающий список и клик по заголовкам (Пользователь, Email, Регистрация, Вход, EW).
- **Карточка:** вкладки Обзор · Магазин · UGS · Сессии; копирование ID/email; ссылка **Keycloak** (поиск по email); кнопка **Отчёт** (текст для тикета).
- **Массовые действия:** «Все по фильтру» (до 200), назначение группы с прогрессом и частичными ошибками, экспорт выбранных в CSV.
- **Пресет «Аномалии presence»** — API `presence_anomaly_only=true` (Redis: >1 browser Socket.IO по всему каталогу).
- **Сортировка** — `sort_by` / `sort_dir`: `created_at`, `last_login_at`, `username`, `email`, `ew_balance`.
- **CSV по фильтру** — экспорт до 200 строк с теми же query-параметрами, что и каталог.
- **Фильтры БД:** `is_trusted`, `is_verified` (как `is_active`).
- **Пресеты:** именованные пресеты в `localStorage` + автосохранение последних фильтров при возврате в раздел.
- **Сводка каталога (API `summary`):** при доступном Redis ответ `GET …/users/directory` содержит `summary.online_matching_total` и `summary.presence_anomaly_matching_total` — пересечение текущих SQL-фильтров с множествами Socket.IO online и presence-аномалий; в UI строка «Онлайн по фильтру» / «Аномалии по фильтру».
- **Колонки таблицы:** пресеты **Компакт** / **Полная** (`eliteew.admin.users.tableColumns`) — скрывают email, даты, socket activity, флаги; email в компактном режиме под именем в колонке «Пользователь»; меню **Колонки…** — поштучные чекбоксы.
- **Вкладки hub:** **Каталог** | **Онлайн (Socket.IO)** — встроенный `AdminPresenceSection` (`view=online` в URL); кнопка **Каталог** в строке онлайн открывает карточку в каталоге.
- **Сводка кликабельна:** «Онлайн по фильтру» / «Аномалии по фильтру» включают соответствующие фильтры каталога.
- **Автообновление каталога:** чекбокс «Автообновление (30 с)» (`eliteew.admin.users.autoRefresh`), refetch React Query.
- **SSO в сводке каталога (API `summary`):** `sso_browser_active_matching_total`, `sso_mobile_active_matching_total`, `sso_desktop_active_matching_total` (Postgres `sso_user_sessions`, окно 30 мин); клик включает фильтры `sso_browser_active_only` / `sso_mobile_active_only` / `sso_desktop_active_only`. URL: `ssoBrowser=1`, `ssoMobile=1`, `ssoDesktop=1`.
- **Рассинхрон каналов:** маркер `⇄` в компактной колонке каналов (`adminUserChannelMismatch.ts`) — SSO веб без Socket.IO или наоборот; эвристика совпадает с `api/core/admin_user_channel_mismatch.py` (Desktop SSO — отдельный chip, не часть Socket.IO mismatch).
- **CSV:** колонки `presence_sessions_web/mobile`, `sso_browser_active`, `sso_mobile_active` (Desktop SSO / enrich — в каталоге и overview, **не** в CSV export на 2026-08-08); опциональные поля (email, даты, группа) — по видимости колонок таблицы.
- **Deep link карточки:** `userTab=sessions|store|ugs` (вместе с `userId`); вкладка синхронизируется с URL.
- **Фильтр «⇄ расхождение каналов»:** URL `mismatch=1` → API `channel_mismatch_only=true` (батч-скан каталога, cap 5000 id); сводка `summary.channel_mismatch_matching_total`; выпадающий список в панели фильтров; чип-переключатель. Клик **«⇄ на странице»** в summary (если есть строки на странице) включает тот же серверный фильтр.

---

## Диагностика (оператор)

### Мобильное SSO «нет», callback 200

1. Логи API: `podman logs stack0-eliteew-api-prod 2>&1 | rg 'SSO registry|sso/callback|empery-mobile'`
2. Искать `missing sid/session_state` или `registry incomplete after enrich`
3. Keycloak: Evaluate token для `empery-mobile` — есть ли `sub` и `sid`
4. Harden: `./docker/scripts/keycloak-harden-empery-realm.sh docker/env_file/.env.stack6`
5. Мобилка: logout → login

### SPOF: stack1 Postgres down (fail-closed)

Registry storage is **stack1** `ai_services.sso_user_sessions`. When Postgres is unreachable:

| Layer | Behavior |
|-------|----------|
| API | Short **transient** retries (connection/timeout only) inside `enforce_current_session`, then **`SsoSessionRegistryUnavailable`** |
| HTTP | **503** body: `error=service_unavailable`, `reason=sso_registry_unavailable`, `action=retry` (`build_sso_registry_unavailable_detail`) — callback, bearer middleware, deps |
| WS | Close / auth error with the same reason (unchanged fail-closed posture) |
| SPA | Axios **does not** map this 503 to unplanned-maintenance overlay; OAuth callback shows retry copy (`keycloak.ts`) |

**Not in product:** Redis sid cache, read-replica, or `SSO_REGISTRY_MODE=degrade` / fail-open. Availability = restore stack1 quickly (ops runbook below).

Operator triage: **[docker-re_doc/STACK1-POSTGRES-STUCK-CONTAINER.md](docker-re_doc/STACK1-POSTGRES-STUCK-CONTAINER.md)** — detect (`podman ps`, `pg_isready`), safe stop/rm, recreate, smoke = ready + login callback + one authenticated API.

Regression: `shared/api/tests/test_sso_registry_unavailable_http.py`; FE `client.interceptors.test.ts` (`sso_registry_unavailable`).

### Postgres (пример)

```sql
SELECT client_class, client_id, current_session_id, last_seen_at, ip_address, user_agent
FROM sso_user_sessions
WHERE username = 'poet';

SELECT event_type, client_class, client_id, created_at
FROM sso_session_audit_events
WHERE username = 'poet'
ORDER BY created_at DESC
LIMIT 20;
```

### «Соединений: 2» при одной админке

Ожидаемо при **desktop leader-tab + mobile app online** (`веб: 1 · моб: 1`). Не путать с **6 вкладками desktop** — до leader-tab это давало `веб: 6` при SSO 1; после фикса должно быть `веб: 1`.

---

## История инцидентов (2026-05-23)

1. **`invalid_scope`** — у `empery-mobile` не были default scopes `profile`/`email` → harden `ensure_client_default_scopes`.
2. **Mobile SSO в канале browser** — mobile redirect на `empery-web` → redirect только на `empery-mobile`.
3. **Callback 200, mobile SSO пусто** — access token без `sub`/`sid`; enrich только из id_token без userinfo; у mobile не было scope **`basic`** и mapper **`sub-access-token`**.
4. **Duplicate web socket в одной вкладке** — `useSocketConnection` + `Services.socket` на desktop; устранено отключением App socket на `currentPage === 'desktop'`.
5. **«1 browser» vs `веб: 6`** — KC/SSO лимитируют Keycloak session, не вкладки; leader-tab + server supersede для **1 realtime desktop**.
6. **Toast «Сессия восстановлена»** — переименован в восстановление **окон** desktop shell.

Chronology: dated `worklog/session-summaries/2026-05-23-*` soft-retired → `trash/` (not living hubs).

---

## Критерии для агентов (Cursor)

При задачах SSO / admin online:

1. Не классифицировать mobile по User-Agent — только **`redirect_uri` / `oauth_client_id` / `azp`**.
2. **SSO browser = 1 Keycloak sid**; **presence web = 1 realtime sid** после leader-tab — `sessions_web > 1` это баг/legacy, не «несколько браузеров» в смысле KC.
3. После правок Keycloak mobile — harden + **re-login** на устройстве.
4. Поведенческий тест: `test_browser_presence_single_session.py`, приёмка 6 вкладок → `веб: 1`.
5. Лог `SSO registry skipped` при callback — **ERROR** после enrich (`auth_keycloak.py`).

Правила: **`.cursor/rules/keycloak-eliteew.mdc`**, **`.cursor/skills/keycloak-eliteew/SKILL.md`**.
