# Keycloak и EliteEW: конфигурация и эксплуатация

Документ описывает развёртывание Keycloak (stack6), связь с приложением EliteEW и скрипты настройки. **Секреты в репозиторий не помещать** — только переменные окружения и плейсхолдеры.

Стабилизационный backlog (audit / ops follow-ups) по product-id `keycloak-auth`: [PRODUCT-AUDIT-STABILITY-BACKLOG.md](../PRODUCT-AUDIT-STABILITY-BACKLOG.md)#keycloak-auth--keycloak--sso.

> Runtime по умолчанию: **Podman**. Команды `docker` используются только как исторический/совместимый контекст.

## Архитектура

| Компонент | Назначение |
|-----------|------------|
| `stack6-keycloak` | Keycloak 26.x (образ с фиксированным тегом в `docker/stack/stack6.yml`) |
| `stack6-keycloak-postgres` | БД Keycloak (PostgreSQL), данные в volume на хосте |
| Прокси (nginx на хосте) | TLS и заголовки `X-Forwarded-*` к `127.0.0.1:<KEYCLOAK_HOST_PORT>` |
| EliteEW API | Проверка JWT (JWKS + при необходимости introspection), confidential-клиент |
| EliteEW frontend | OIDC в браузере: **`oauth4webapi`** + фасад в `keycloak.ts`, публичный клиент **`empery-web`**, PKCE authorization redirect; code exchange идёт через backend `POST /api/v1/auth/sso/callback`, чтобы SSO registry мог заменить browser `sid`. Интерактивный login запускается через единый helper `beginInteractiveLogin` (`authRedirect.ts`) |

Публичный URL Keycloak (issuer для токенов): значение **`KEYCLOAK_PUBLIC_URL`** (например `https://auth.example.com`). Внутри compose-сети API обращается к Keycloak по **`KEYCLOAK_URL`** (например `http://stack6-keycloak:8080`). Для Yandex reverse-tunnel edge `auth.eliteew.ru` обязан быть отдельным nginx vhost → `127.0.0.1:36000`; общий app-vhost возвращает SPA HTML и ломает OIDC discovery.

### Образ Keycloak (обновления)

Живой pin: **`quay.io/keycloak/keycloak:26.7.1`** в [`docker/stack/stack6.yml`](../../../docker/stack/stack6.yml) (`STACK6_KEYCLOAK_IMAGE`). Prod-core **living (2026-09-18):** baked `localhost/eliteew-keycloak:prod-stack6-20260908-0936` (SPI JAR inside), `command: ["start","--optimized"]`.

`KC_TRANSACTION_XA_ENABLED` is a **build-time** option. The first Wave 3 bake omitted `--transaction-xa-enabled=false` while compose always sets that env; `start --optimized` then printed `kc.transaction-xa-enabled` mismatch and **exited 2**. Durable fix: Containerfile `kc.sh build … --transaction-xa-enabled=false`. Rebake `prod-stack6-20260813-2245` proved persist with `podman run --entrypoint kc.sh … show-config` **before load** (`kc.transaction-xa-enabled = false (Persisted)`). A running container with the same compose env may report `(ENV)`; that is not the persist proof. Do not ship `--optimized` without the pre-load `(Persisted)` line. Living smoke requires `--optimized`, healthy, SPI JAR, and no `kc.transaction-xa-enabled` log mismatch.

Wave 3 bake CLI (command-center only — never `podman build` on `.111`):

```bash
TAG="prod-stack6-$(date +%Y%m%d-%H%M)"
bash docker/scripts/eliteew-deploy.sh release stack6 --all --build-only --tag "$TAG"
podman run --rm --user 0 --entrypoint /opt/keycloak/bin/kc.sh \
  "localhost/eliteew-keycloak:$TAG" show-config \
  | rg 'kc.transaction-xa-enabled =  false \(Persisted\)'
# live recreate only on explicit operator command:
bash docker/scripts/eliteew-deploy.sh release stack6 --all --skip-build --yes --tag "$TAG"
PROD_CORE_SSH_HOST=192.168.1.111 bash docker/scripts/stack6-keycloak-smoke.sh
```

Provider source: [`docker/keycloak/providers/eliteew-binding/`](../../../docker/keycloak/providers/eliteew-binding/) (Maven `--release 21`, APIs **26.7.1**). Host JDK may be 25.

**Atomic browser flow is source-default inactive; production is explicitly enforced.** Harden creates and machine-validates `eliteew-desktop-conditional-access-v2`, but does **not** attach it to `empery-desktop` / `empery-fofline` unless `ELITEEW_KC_ATOMIC_AUTH_ENFORCE=1`. The v2 graph is explicit `binding pre-auth → username/password → conditional OTP → session limiter → binding post-auth`; it does not attempt to “link” a copied Keycloak flow. `KEYCLOAK_ATOMIC_CANDIDATE_ONLY_OVERRIDE=1` validates a candidate without changing client bindings even when the sourced env says enforce off. If an atomic override is already live, env drift to off is blocked unless the operator also gives explicit `KEYCLOAK_ATOMIC_ROLLBACK_CONFIRM=1`; no silent client-override/PAR/DPoP clearing. `empery-web` / `empery-mobile` stay on the current realm browser flow. Exact graph owner: `docker/scripts/keycloak-atomic-native-flow-verify.sh`; incident/cause: `product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md` §9.15.

SPI calls EliteEW `POST /api/v1/desktop-client/auth/internal/{precheck,commit,refresh-decision}` with header `X-Desktop-Client-Binding-Spi-Token` = `DESKTOP_CLIENT_BINDING_SPI_TOKEN` (Config Plane / stack6 env). Empty token → SPI fail-closed. Product/admin JWT is not a bypass.

Обновлять runtime только осознанно: бэкап realm/БД, bake на `.136`, load/recreate на `.111`, smoke (`bash docker/scripts/stack6-keycloak-smoke.sh`). Не `podman build` на prod-core.

## Кастомная тема входа

В stack6 compose default pin — **`quay.io/keycloak/keycloak:26.7.1`**. Живая тема входа EliteEW: **`docker/keycloak/themes/eliteew/login/`** → bind-mount **`../keycloak/themes:/opt/keycloak/themes:z,ro`** в `docker/stack/stack6.yml` (весь каталог `themes/`, не только `login/`). Тема наследует bundled **`keycloak.v2`** и переопределяет только CSS, messages и footer fragment.

Инварианты темы:

- не редактировать bundled resources Keycloak внутри образа;
- не добавлять внешние шрифты, изображения или скрипты на страницу входа;
- не переопределять `login.ftl` без отдельного аудита после обновления Keycloak;
- держать каталог themes доступным на запись только доверенным операторам: FreeMarker theme-файлы выполняются Keycloak на сервере;
- визуал и copy — только `eliteew-login.css` + `messages_*.properties` + `footer.ftl`; форма логина и OIDC/PKCE-поток не трогаются.

Визуал (2026-07): premium green gamma (emerald/teal на тёмном фоне), короткие RU/EN тексты без повторов бренда в заголовке, кнопке и футере; футер — одна строка про доверенное устройство, без маркетингового перечисления OIDC/PKCE.

Выбор темы выполняет **`docker/scripts/keycloak-harden-empery-realm.sh`** через realm `loginTheme` и client attribute **`login_theme`** для публичных клиентов **`empery-web`**, **`empery-mobile`**, **`empery-apk-distro`**. По умолчанию используется **`KEYCLOAK_LOGIN_THEME=eliteew`**; для быстрого rollback можно задать **`KEYCLOAK_LOGIN_THEME=keycloak.v2`** и повторно выполнить harden-скрипт.

После изменения файлов темы:

1. Пересоздать stack6, чтобы read-only bind-mount попал в контейнер:
   ```bash
   ELITEEW_CONTAINER_RUNTIME=podman python3 docker/scripts/eliteew-container-control.py \
     --repo-root <repo> --yes recreate --include stack6
   ```
2. Применить realm-настройку:
   ```bash
   ./docker/scripts/keycloak-harden-empery-realm.sh docker/env_file/.env.stack6
   ```
3. Smoke: открыть login через `https://app.eliteew.ru/` или Account Console **`https://auth.eliteew.ru/realms/empery/account`** и проверить, что страница грузится без внешних asset-запросов и OIDC redirect остаётся PKCE-flow клиента **`empery-web`**.

## Клиенты realm `empery`

| Client ID | Тип | Назначение |
|-----------|-----|------------|
| **empery-web** | Публичный | Браузер (SPA), PKCE, refresh/logout **без** client secret |
| **empery-mobile** | Публичный | Нативный MobileAndroid (in-app SSO WebView + backend SSO callback), PKCE, custom-scheme callback **без** client secret |
| **empery-desktop** | Публичный | Native Tauri desktop-client WebviewWindow на `https://app.eliteew.ru`, PKCE; SSO `client_class=desktop`; **не** mobile custom-scheme и **не** kiosk `KEYCLOAK_WEB_EXTRA_*`. **Living:** created on prod-core via harden 2026-08-07 (`keycloak-harden-empery-realm.sh`). |
| **empery-fofline** | Публичный | **FoFline:** PKCE; SSO `client_class=fofline`; XOR vs `empery-web` (`SSO_FOFLINE_BROWSER_XOR_POLICY`, default `displace`). **Target product** = local SPA pack in FoFline shell. Harden via `keycloak-harden-empery-realm.sh` (prod client id `c9f209f0-78d3-4bbb-a2fd-5891dd9a5668`). **L3 local origin redirects** (in harden base): `fofline-spa://localhost/*`, `http://fofline-spa.localhost/*`, `https://fofline-spa.localhost/*` — do not hang on `empery-web` / `empery-desktop`. **Live applied 2026-08-09** on prod-core (run current harden from command-center against `.111` `stack6-keycloak` + runtime `.env.stack6`; do not rely on stale `<repo>` copy on prod-core). Canon: [`product/desktop/DESKTOP-FOFLINE-EDITION.md`](../../product/desktop/DESKTOP-FOFLINE-EDITION.md). |
| **empery-api** | Confidential | Сервер: introspection, секрет только на бэкенде; browser flows отключены |
| **eliteew-binding-spi** | Confidential | Wave 3: service account + role `desktop-binding-decision` for a later JWT cutover. **Living SPI auth** is `DESKTOP_CLIENT_BINDING_SPI_TOKEN` (header), not this client secret. Harden creates the client even when atomic enforce is off. |
| account, account-console, admin-cli, broker, realm-management, security-admin-console | Встроенные Keycloak | Не удалять; описания можно заполнить скриптом харднинга |

Аудитория JWT для API задаётся маппером audience и переменными **`JWT_AUDIENCE`** / **`KEYCLOAK_VERIFY_AUDIENCE`** на стороне EliteEW (см. `shared/api/core/unified_config.py`).

## Админ EliteEW в realm `empery` (не администратор Keycloak)

Нужно различать:

| Роль | Где задаётся | Эффект |
|------|----------------|--------|
| **Админ приложения EliteEW** | Realm `empery`, клиентские или realm-роли (ниже) | Доступ в приложении по логике API (`admin` в эффективной роли) |
| **Администратор Keycloak** | Realm **`master`**, учётная запись вроде `keycloak` / bootstrap | Полный доступ к Admin Console ко всем realm |
| **Админ только realm `empery` в Keycloak** | В `empery`: роли клиента **`realm-management`** (`realm-admin`, `manage-users`, …) | Правка пользователей/клиентов **в Keycloak** для realm `empery` — это **не** требуется для работы EliteEW как приложения |

Пользователю, который должен быть **только админом EliteEW**, **не** назначайте роли клиента **`realm-management`** и **не** добавляйте его в realm **`master`** как администратора.

### Как EliteEW понимает «админа»

В коде (`shared/api/core/token_roles.py`; совместимость имён в `shared/api/core/keycloak_token_roles.py`) роли из JWT (`realm_access` + `resource_access` для **`empery-api` / `empery-web` / `empery-mobile` / `empery-desktop` / `empery-fofline`**) мапятся так:

| JWT role(s) | Эффективная `User.role` (runtime) | `users.role` в PG (`persistable_*`) | Доступ |
|-------------|-------------------------|--------------------------------------|--------|
| **`emperyworld_admin`** | `emperyworld_admin` | **`admin`** (CHECK `users_role_valid`) | Unified Admin + привилегированные мутации (`require_emperyworld_admin` смотрит JWT/runtime, не колонку PG) |
| **`admin`** или **`msi`** (без `emperyworld_admin`) | `admin` | `admin` | Unified Admin (`require_admin_user`); **не** проходит `require_emperyworld_admin` |
| иначе | `emperyworld_member` (и т.п.) | `brotherhood_member` | без Admin |

Устаревшие алиасы realm-ролей в токене **игнорируются** (`collect_token_roles`).

**Нельзя** схлопывать `emperyworld_admin` → `admin` в **runtime** `User.role` / `get_effective_role_from_payload`: иначе SPA/API гейты на privileged ops всегда false/403.  
**Нужно** схлопывать при **persist** в `users.role` (`persistable_users_role_from_payload`): иначе каждый SSO sync UPDATE падает на CHECK и сыплет `without DB row attach`.

**OAuth2ProtectionMiddleware** для префиксов вроде `/api/admin/` проверяет админ-доступ через `payload_has_admin_access` (любая из `admin` / `msi` / `emperyworld_admin`).

Передача JWT в query допускается **только** для явно разрешённых путей (сейчас прокси картинки ComfyUI: `/api/doc-editor/ai/image/view`), чтобы не цеплять произвольные URL с подстрокой `/view`.

### Рекомендуемая схема: группа + client role `msi`

1. **Realm `empery` → Groups → Create group**
   Например: `eliteew-admins` (имя на ваш вкус).

2. **Realm `empery` → Clients → `empery-api` → Roles → Create role**
   Имя: **`msi`** (ровно так, без лишних пробелов).

3. **Groups → `eliteew-admins` → Role mapping**
   - **Client roles** → клиент **`empery-api`** → роль **`msi`**.
   - При необходимости продублируйте ту же роль для публичных клиентов **`empery-web`** / **`empery-mobile`**, если в токене не видно роли с первого шага (обычно достаточно только `empery-api`).

4. **Users → пользователь `keysray` (или нужный username) → Groups → Join** группу `eliteew-admins`.

5. Пользователь **выходит и входит заново** (или обновляет сессию), чтобы в access token попали новые роли.

### Альтернатива без группы

**Users → пользователь → Role mapping → Assign role → Filter by clients → `empery-api` → `msi`** (то же самое по смыслу, без группы).

### Проверка

- В Keycloak: **Users → keysray → Effective role / Consents** — должны быть видны роли клиента `empery-api`.
- После входа в приложение запросы к API несут JWT; эффективная роль в приложении должна стать **`admin`**.

## Файлы и env

| Файл | Роль |
|------|------|
| `docker/stack/stack6.yml` | Compose Keycloak + Postgres |
| `docker/keycloak/themes/eliteew/login/` | Read-only Keycloak login theme EliteEW (`parent=keycloak.v2`) |
| `docker/env_file/.env.stack6` | Секреты и hostname для stack6 (**не коммитить** с реальными паролями в публичный репозиторий) |
| `docker/env_file/.env.stack0.backend` | Переменные API: `KEYCLOAK_*`, `KEYCLOAK_WEB_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET` и т.д. |

### Имена переменных (без значений)

**Stack6 / Keycloak-сервер**

- `STACK6_KEYCLOAK_POSTGRES_USER`, `STACK6_KEYCLOAK_USER` — UID/GID контейнеров
- `KEYCLOAK_HOST_PORT`, `KEYCLOAK_POSTGRES_HOST_PORT` — порты на localhost
- `KC_HOSTNAME`, `KC_HOSTNAME_ADMIN` — **полные URL** со схемой (`https://...`), Keycloak 26+
- `KEYCLOAK_DB_PASSWORD` — пароль роли PostgreSQL для БД Keycloak
- `KEYCLOAK_ADMIN`, `KEYCLOAK_ADMIN_PASSWORD` — bootstrap admin (только при первичной инициализации БД)
- `KC_PROXY_TRUSTED_ADDRESSES` (опционально) — доверенные CIDR для `X-Forwarded-*`
- `KEYCLOAK_KCADM_USER` — пользователь realm **master** для `kcadm.sh` (часто `keycloak`, не путать с именем в `.env`)
- `KEYCLOAK_APP_PUBLIC_URL`, `KEYCLOAK_REALM_DISPLAY_NAME`, `KEYCLOAK_REALM_DISPLAY_HTML` — подстановки для скрипта метаданных
- `KEYCLOAK_LOGIN_THEME` — login theme realm `empery`, по умолчанию **`eliteew`**; rollback на официальный вид: **`keycloak.v2`**.
- `KEYCLOAK_PASSWORD_POLICY`, `KEYCLOAK_REALM_SSL_REQUIRED` — политика паролей и уровень SSL realm
- `KEYCLOAK_WEB_EXTRA_REDIRECT_URIS` (опционально) — дополнительные **Valid redirect URIs** для **`empery-web`** (SPA, localhost). **Mobile custom-scheme** — только **`empery-mobile`** (`KEYCLOAK_MOBILE_*`), см. **`SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md`**.
- `KEYCLOAK_WEB_EXTRA_POST_LOGOUT_REDIRECT_URIS`, `KEYCLOAK_WEB_EXTRA_WEB_ORIGINS` (опционально) — доп. post-logout redirect и **Web origins** для того же скрипта
- `KEYCLOAK_MOBILE_CLIENT_ID` — публичный клиент native mobile, по умолчанию **`empery-mobile`**.
- `KEYCLOAK_MOBILE_EXTRA_REDIRECT_URIS`, `KEYCLOAK_MOBILE_EXTRA_POST_LOGOUT_REDIRECT_URIS`, `KEYCLOAK_MOBILE_EXTRA_WEB_ORIGINS` — дополнительные URI/origins для **`empery-mobile`**.
- `KEYCLOAK_DESKTOP_CLIENT_ID` — публичный клиент Tauri desktop-client, по умолчанию **`empery-desktop`**.
- `KEYCLOAK_DESKTOP_EXTRA_REDIRECT_URIS`, `KEYCLOAK_DESKTOP_EXTRA_POST_LOGOUT_REDIRECT_URIS`, `KEYCLOAK_DESKTOP_EXTRA_WEB_ORIGINS` — доп. URI/origins для **`empery-desktop`** (не копировать kiosk/`KEYCLOAK_WEB_EXTRA_*` и не вешать mobile custom-scheme).
- Frontend: `VITE_KEYCLOAK_DESKTOP_CLIENT_ID` (профиль `desktopNative`).
- `KEYCLOAK_FOFLINE_CLIENT_ID` — публичный клиент FoFline, по умолчанию **`empery-fofline`** (W1).
- `KEYCLOAK_FOFLINE_EXTRA_REDIRECT_URIS`, `KEYCLOAK_FOFLINE_EXTRA_POST_LOGOUT_REDIRECT_URIS`, `KEYCLOAK_FOFLINE_EXTRA_WEB_ORIGINS` — доп. URI/origins для **`empery-fofline`** (не копировать kiosk/mobile; base includes Tauri localhost origins).
- `SSO_FOFLINE_BROWSER_XOR_POLICY` — `displace` (default) | `deny` | `off` — browser↔fofline exclusivity in SSO registry.
- Frontend (W2+): `VITE_KEYCLOAK_FOFLINE_CLIENT_ID` when FoFline OIDC profile lands.
- `ELITEEW_KC_ATOMIC_AUTH_ENFORCE` — только явный production cutover включает v2 override + обязательные PAR/DPoP для desktop/FoFline.
- `KEYCLOAK_ATOMIC_FLOW_ALIAS`, `KEYCLOAK_ATOMIC_FORMS_FLOW_ALIAS`, `KEYCLOAK_ATOMIC_OTP_FLOW_ALIAS`, `KEYCLOAK_ATOMIC_SESSION_LIMIT_CONFIG_ALIAS` — versioned native flow aliases; defaults are v2. **Do not pin v1:** its copied-flow “link” is empty and disabled.
- `KEYCLOAK_ATOMIC_CANDIDATE_ONLY_OVERRIDE=1` — create/reconcile + exact graph validation, but do not change native client bindings or PAR/DPoP flags; override form wins after sourcing an older runtime env.
- `KEYCLOAK_ATOMIC_AUTH_ENFORCE_OVERRIDE=1` — positive one-run recovery override when Config Plane drift is being repaired; persistent truth still belongs in the encrypted bundle.
- `KEYCLOAK_ATOMIC_ROLLBACK_CONFIRM=1` — explicit destructive security-mode rollback acknowledgement. Without it, enforce-off cannot clear an already-live atomic override **or** mandatory DPoP/PAR client flags (already-clear clients are a no-op).
- `KEYCLOAK_BROWSER_FLOW_ALIAS` — копия browser flow с лимитером, по умолчанию **`eliteew-browser-session-limit`**.
- `KEYCLOAK_BIND_BROWSER_SESSION_LIMIT_FLOW` — по умолчанию **`false`**: если **`true`**, harden привязывает realm `browserFlow` к flow с User Session Count Limiter. На prod включать только после staging-проверки.
- `KEYCLOAK_USER_REALM_SESSION_LIMIT` / `KEYCLOAK_USER_CLIENT_SESSION_LIMIT` — лимиты User Session Count Limiter, по умолчанию **`2`** realm-сессии и **`1`** client-сессия на пользователя.
- `KEYCLOAK_SESSION_LIMIT_BEHAVIOR` — по умолчанию **`Terminate oldest session`**: новый вход выбивает старую сессию того же класса.
- `KEYCLOAK_EVENTS_EXPIRATION_SECONDS`, `KEYCLOAK_ADMIN_EVENTS_ENABLED`, `KEYCLOAK_ADMIN_EVENTS_DETAILS_ENABLED` — retention и admin-event аудит realm.

**EliteEW API**

- `KEYCLOAK_URL`, `KEYCLOAK_PUBLIC_URL`, `KEYCLOAK_REALM`
- `KEYCLOAK_CLIENT_ID` — обычно `empery-api` (confidential)
- `KEYCLOAK_CLIENT_SECRET` — **только на сервере**, должен совпадать с секретом клиента в Keycloak Admin
- `KEYCLOAK_WEB_CLIENT_ID` — обычно `empery-web`
- `KEYCLOAK_MOBILE_CLIENT_ID` — обычно `empery-mobile`
- `KEYCLOAK_VERIFY_AUDIENCE`, `JWT_AUDIENCE`
- `KEYCLOAK_HTTP_VERIFY_TLS` — по умолчанию `true`: проверка TLS для прямых HTTP-вызовов к `KEYCLOAK_URL` (например revoke токена в `/api/auth/logout`). Значение `false` только в закрытом dev/lab при самоподписанном TLS или отладочном MITM.

**Frontend (сборка)**

- `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_CLIENT_ID` (по умолчанию в коде — `empery-web`)
- `VITE_KEYCLOAK_API_CLIENT_ID` — при необходимости согласовать с ролями в токене (`empery-api`)

### Android WebView shell (archived)

Исторический модуль `EliteEWWebViewAndroid` (сейчас **soft-retired EliteEWWebViewAndroid under `trash/`**, не в корне репо) добавлял в user-agent маркер `EmperyWorldAndroidWebView` и жил на том же SPA/OIDC flow, что Chrome: загрузка `https://app.eliteew.ru`, discovery/PKCE на `https://auth.eliteew.ru`. Persisted tokens — **`sessionStorage` по умолчанию**, **`localStorage`** только при «Запомнить меня» / `persistSession: true`. Custom-scheme callback для этого приложения не использовался. Активный нативный клиент — **`pack-cloud/mobile/`** (`empery-mobile`).

Между доменами **`app.eliteew.ru`** и **`auth.eliteew.ru`** нельзя полагаться на «тихий» SSO через iframe к IdP: Keycloak отдаёт **X-Frame-Options: sameorigin** (аналог того, что в старом `keycloak-js` задавалось **`checkLoginIframe: false`**). Поэтому после полной перезагрузки страницы SPA не восстанавливает сессию только по SSO-cookie между разными origin.

Frontend сохраняет OIDC **`token` / `refreshToken` / `idToken`** под ключом **`eliteew.keycloak.oidcTokens.v1`** в **`sessionStorage` по умолчанию** (сброс после закрытия вкладки) или в **`localStorage`** при «Запомнить меня» / явном `persistSession: true`; режим выбирает `keycloak.ts` (`persistSession` + `eliteew.keycloak.persistencePref.v1`). Восстановление сессии — фасад **`AuthOidcFacade`** в `shared/web/frontend/src/services/keycloak.ts`: **`initKeycloak()`** из **`services/boot/authBootstrap.ts`** до **`AuthProvider`**. Если refresh token недействителен, запись очищается и выполняется redirect на login. Logout / `session_replaced` — **шестишаговый cascade** в `AuthContext` (не `localStorage.clear()`); канон: **`documentation/product/FRONTEND_BROWSER_CACHE_MODEL.md` §3.4**, **`FRONTEND-AUTH.md`**. Это повышает требования к **CSP и защите от XSS** (токены доступны JS).

Легаси-ключ **`eliteew.androidWebView.keycloakTokens.v1`** при чтении автоматически переносится в **`eliteew.keycloak.oidcTokens.v1`**.

### Нативное Android (`empery-mobile`, in-app WebView / PKCE)

Идемпотентный скрипт **`docker/scripts/keycloak-harden-empery-realm.sh`** задаёт для **`empery-mobile`** все custom-scheme **`redirect_uri`** из флаворов приложения (**prod** / **stage** / **dev** / **tg** / **tunnelbeta**), **default client scopes** (`basic`, `profile`, `email`, `roles`, `web-origins`) и protocol mappers **`sub-access-token`** + **`session-id-access-token`**. Без **`basic`** и **`sub`** в access token реестр SSO на API **не создаёт** строку `mobile` (лог: `SSO registry skipped: missing sid/session_state`). **Custom-scheme redirect не должны висеть на `empery-web`** — иначе Keycloak может выдать токен `empery-web` для мобильного callback. Подробно: **`documentation/platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md`**.

Колбэк авторизации должен **точно** совпасть с записью в **Valid redirect URIs**. Иначе в логах Keycloak будет **`LOGIN_ERROR` / `invalid_redirect_uri`**.

- В **Admin Console**: **Clients → `empery-mobile` → Settings** — добавить в **Valid redirect URIs** ваш callback (обычно custom scheme приложения без лишних слешей: `scheme:/path`).
- То же значение задаёт приложение как **`redirect_uri`** в запросе к `/protocol/openid-connect/auth`.
- Для **Logout** добавьте тот же (или свой) URI в **`Valid post logout redirect URIs`** или прогоните harden-скрипт с env ниже — атрибут **`post.logout.redirect.uris`** обновится вместе с redirect.

`pack-cloud/mobile` — отдельный нативный контракт: in-app SSO WebView на Keycloak (`empery-mobile`, PKCE) → custom scheme callback → `POST /api/v1/auth/sso/callback`. На обычных телефонах login cookie-контейнер теперь scoped к app WebView, а не к Chrome/Custom Tabs; reinstall/clear app data должен сбрасывать это состояние. Не возвращайте web route `/oauth2/start` как основной login.

Через **репозиторий** (без правок секретов в git): в **`.env.stack6`** (локально у оператора) задать переменную **`KEYCLOAK_MOBILE_EXTRA_REDIRECT_URIS`** — список через запятую, например:

`KEYCLOAK_MOBILE_EXTRA_REDIRECT_URIS=world.empery.mobile.dev:/oauth2redirect`

Опционально: **`KEYCLOAK_MOBILE_EXTRA_POST_LOGOUT_REDIRECT_URIS`**, **`KEYCLOAK_MOBILE_EXTRA_WEB_ORIGINS`** (для браузера/гибрида; для чистого custom scheme второе часто не нужно).

Затем выполнить **`./docker/scripts/keycloak-harden-empery-realm.sh docker/env_file/.env.stack6`**.

### Mobile redirect URI wire form (обязательно)

Android `Uri` / AppAuth сериализует custom-scheme как **host-form** `world.empery.mobile://oauth2redirect`. Canon:

| Layer | Form |
|-------|------|
| BuildConfig alias (accepted) | `world.empery.mobile:/oauth2redirect` |
| Wire / token exchange / Keycloak Valid redirect URIs (primary) | `world.empery.mobile://oauth2redirect` |
| Harden baseline | **both** host-form and path-form for each flavor |

Код: `MobileOAuthRedirectUris.canonicalize` + `OidcAuthManager` / `AuthRepository` pending redirect. Без host-form в Keycloak → `LOGIN_ERROR` / `invalid_redirect_uri`.

### Embedded SPA refresh owner (обязательно)

Для `#/mobile-*` WebView **единственный** владелец refresh токена `empery-mobile` — native `AuthRepository` (mutex). SPA вызывает `@JavascriptInterface` **`EmperyMobileNativeOidc.refreshSessionJson()`**; **не** `POST /api/auth/refresh` (иначе Keycloak `Maximum allowed refresh token reuse exceeded` при параллельном native OkHttp refresh).

### Stack6 single-node cache + file logs

- Compose: **`KC_CACHE=local`** (без JDBC_PING/JGroups JOIN к мёртвым peer после recreate).
- Перед up/recreate: **`bash docker/scripts/stack6-prepare-host-dirs.sh`** (UID 1000 пишет `/logs/keycloak.log`). Deploy sync также `chown 1000:0` на prod-core log dir.
- Smoke: **`bash docker/scripts/stack6-keycloak-smoke.sh`** (входит в `eliteew-migration-command-center.sh smoke`).

**Белый экран во внешнем браузере при входе с Android:** это обычно **не** из‑за зарегистрированного `redirect_uri` (он нужен только на этапе ответа Keycloak). Частые причины: **блокировщик рекламы** во встроенном/альтернативном браузере (например Cromite с подписками — ломает скрипты страницы логина), сеть или сбой темы IdP. В приложении **`pack-cloud/mobile`** после правки вход открывает **системный chooser браузера** для `/auth/sso/login`, чтобы можно было явно выбрать Chrome (или временно отключить блокировщик для домена IdP).

См. **`.cursor/rules/android-mobile-adb-workflow.mdc`**.

Иные предупреждения из лога:

| Событие | Смысл |
|---------|--------|
| **`LOGOUT_ERROR` / `session_expired`** | Фронт/Android вызвал end-session или logout при уже недействительной браузерной SSO-сессии. Часто **шум**, не ошибка redirect. |
| **`LOGIN_ERROR` / `expired_code`** с `restart_after_timeout` | Авторизационный код устарел; повторите вход (**PKCE-код нужно обменять вовремя**). |
| **`LOGIN_ERROR` / `invalid_user_credentials`**, realm **`master`**, клиент **`security-admin-console`** | Неверный пароль **администратора Keycloak** (не связано с мобильным SSO). |

В Desktop Shell есть отдельное действие приложения **F5 / ПКМ → «Обновить»**: оно перезагружает состояние рабочего стола из API (`refreshStorage()`), но не обязано выполнять browser reload. Настоящий reload страницы — кнопка браузера, меню браузера или повторная навигация на текущий URL; именно этот сценарий зависит от persisted OIDC tokens.

### Hardening для браузерных refresh token

Так как refresh token доступен JavaScript-коду SPA, realm/client-настройки должны ограничивать ущерб при XSS или компрометации браузерного окружения:

- **refresh-token rotation включён**: `revokeRefreshToken=true`, `refreshTokenMaxReuse=0`;
- **короткий access token**: `accessTokenLifespan=900` секунд;
- **SSO idle/max (Continuity W1):** `ssoSessionIdleTimeout=43200` (12h), `ssoSessionMaxLifespan=86400` (24h) — realm-wide ceiling for `empery-web` / `empery-mobile` / `empery-desktop` / `empery-fofline` (client attrs cannot extend past realm). Env overrides: `KEYCLOAK_SSO_SESSION_IDLE_TIMEOUT_SEC`, `KEYCLOAK_SSO_SESSION_MAX_LIFESPAN_SEC`;
- **Remember Me ограничен 14 днями**: `ssoSessionIdleTimeoutRememberMe=1209600`, `ssoSessionMaxLifespanRememberMe=1209600`;
- **Declared policy metadata (Continuity W0/W1):** SPA/API must not infer idle/max from a failed refresh — `GET /api/v1/auth/sso/session-policy` + FE `webBrowserSsoSessionPolicy.ts`. Canon: [`WEB-SSO-SESSION-CONTINUITY-CONTRACT.md`](../WEB-SSO-SESSION-CONTINUITY-CONTRACT.md) / plan §W1. **Prod apply:** re-run `keycloak-harden-empery-realm.sh` then kcadm readback;
- **offline tokens не используются в браузере**: у публичных клиентов **`empery-web`**, **`empery-mobile`** и **`empery-apk-distro`** harden-скрипт удаляет **`offline_access`** из optional и default scopes;
- **browser flows сужены**: `standardFlowEnabled=true`, `implicitFlowEnabled=false`, `directAccessGrantsEnabled=false`, PKCE S256, `webOrigins` только на разрешённые origin.

Frontend дополнительно использует колбэки фасада **`onAuthSuccess` / `onAuthError` / `onTokenExpired`** (см. `shared/web/frontend/src/contexts/AuthContext.tsx`): после успешного **`updateToken()`** новая пара токенов сохраняется в **активном хранилище** (`sessionStorage` или `localStorage` по режиму Remember Me), при ошибке refresh/logout — полный **§3.4 cache cascade** + очистка persisted auth keys в **браузерном** профиле. В **embedded Mobile SPA WebView** (`mobileEmbedded`, маршруты `#/mobile-ewa-companion`, `#/mobile-handbook`, …) refresh failure **не** вызывает logout — `recoverMobileEmbeddedSession()` и silent re-sync. Это обязательно при `revokeRefreshToken=true`, иначе ротация refresh-токена могла бы остаться только в памяти до следующего полного reload.

### Concurrent sessions: 1 browser + 1 mobile

Целевой контракт:

- **browser** — public client **`empery-web`**, максимум **1** активная client-сессия на пользователя;
- **mobile** — public client **`empery-mobile`**, максимум **1** активная client-сессия на пользователя;
- realm cap — максимум **2** SSO-сессии на пользователя, чтобы browser и mobile могли жить одновременно;
- поведение лимитера — **Terminate oldest session**, то есть новый вход выбивает старую сессию того же client bucket.

Harden-скрипт создаёт копию built-in flow **`eliteew-browser-session-limit`**, добавляет REQUIRED execution **User Session Count Limiter** (`userRealmLimit=2`, `userClientLimit=1`). **Привязка** realm `browserFlow` к этой копии выполняется **только** если **`KEYCLOAK_BIND_BROWSER_SESSION_LIMIT_FLOW=true`** (по умолчанию **`false`**). Без явного opt-in realm остаётся на стандартном browser flow — иначе на prod возможен login loop (incident 2026-06-19). Браузерный SPA остаётся на **`empery-web`**; backend SSO facade для native MobileAndroid выбирает **`empery-mobile`** по custom-scheme `redirect_uri`.

Важно: Keycloak завершает старую SSO-сессию, но уже выданный access token может оставаться криптографически валидным до `accessTokenLifespan`. Поэтому API дополнительно ведёт таблицу **`sso_user_sessions`** по `sub + client_class + sid/session_state`. Заменять current `sid` разрешено только в OAuth callback `POST /api/v1/auth/sso/callback` (для browser — после `X-SSO-Replace-Confirm: 1`); обычные bearer-token API и Socket.IO connect только проверяют current session и отвечают `401 reason=session_replaced` / `auth:session_replaced` для не-current `sid`. Это не даёт двум живым Keycloak-сессиям одного класса перетягивать registry через фоновые API-запросы или refresh-issued access tokens. События пишутся в **`sso_session_audit_events`** и видны через **`eelogin`**.

## Скрипты

Запуск из **корня монорепозитория** `powered_by_emperyworld`, с указанием env-файла stack6:

```bash
./docker/scripts/keycloak-harden-empery-realm.sh docker/env_file/.env.stack6
```

Скрипт идемпотентно:

- настраивает realm **empery** (безопасность, токены, refresh-token rotation, сессии, отображаемое имя, `frontendUrl`);
- настраивает **master** (без саморегистрации, brute-force protection, password policy, user/admin events);
- создаёт/обновляет **empery-web**, **empery-mobile** и **empery-api** (redirect URIs, PKCE, audience mapper, запрет `offline_access` для public clients, метаданные, root/base URL);
- **post-bake stack6 release (обязательно):** после каждого `eliteew-deploy.sh release stack6 --all` / rebake Keycloak на prod-core прогоните harden против runtime `.env.stack6` на `.111` — иначе drift: нет `eliteew-binding-spi`, нет flow `eliteew-desktop-conditional-access-v1`, legacy `dewa-*` / `ewpower-*` могут остаться enabled. При `KEYCLOAK_ENABLE_*=false` скрипт **выключает** существующие soft-retired clients;
- создаёт группу **`eliteew-admins`** + client role **`msi`** на `empery-api` + join `KEYCLOAK_ELITEEW_ADMINS_USERS` (default `keysray`);
- добавляет **`sub-access-token`** на `empery-web` (parity с mobile/desktop);
- отключает **`empery-parity`** по умолчанию (`KEYCLOAK_ENABLE_EMPERY_PARITY=false`);
- назначает login theme realm `empery` и публичным клиентам (по умолчанию **`eliteew`**);
- создаёт/обновляет browser flow **`eliteew-browser-session-limit`** с **User Session Count Limiter** (binding к realm — только при **`KEYCLOAK_BIND_BROWSER_SESSION_LIMIT_FLOW=true`**);
- создаёт explicit native flow **`eliteew-desktop-conditional-access-v2`**, проверяет восемь execution + порядок до client binding и отказывается привязывать неполный граф; candidate-only оставляет текущие bindings без изменений;
- включает user/admin events с retention;
- проставляет описания встроенным клиентам.

Устаревший путь **`keycloak-configure-empery-api-client.sh`** вызывает тот же harden-скрипт.

Дополнительно в репозитории могут быть: восстановление bootstrap admin, правка redirect для admin console — см. `docker/scripts/keycloak-*.sh`.

## После изменений в конфиге API

По правилам проекта: перезапуск API-контейнера, проверка health (см. `.cursor/rules/project-and-deploy.mdc`).

## Безопасность (кратко)

- Прокси: `KC_PROXY_HEADERS=xforwarded`; **`KC_PROXY_TRUSTED_ADDRESSES`** по умолчанию в compose покрывает loopback + RFC1918 (edge/WG/LAN proxies). stack666 LAN proxy retired — не нужен отдельный trust для него; при жёстком периметре сузьте список до реальных nginx/proxy IP в env.
- Realm: политика паролей, brute force, `sslRequired`, отключение лишней регистрации, refresh-token rotation для SPA.
- Тема входа: только локальные trusted resources, read-only mount, наследование `keycloak.v2`; не подключать сторонние CDN/JS на login page.
- Секреты только в env / vault, не в git.
- Порт management Keycloak (**9000**) наружу не публиковать; метрики не светить в интернет без защиты.

## Типовые проблемы

1. **`Provided hostname-admin is not a valid URL`** — в `KC_HOSTNAME` / `KC_HOSTNAME_ADMIN` нужны полные URL `https://...`.
2. **`password authentication failed for user keycloak`** — пароль БД не совпадает с тем, что заложен в volume PostgreSQL (см. комментарии в `stack6.yml`).
3. **401 после смены клиентов** — фронт должен использовать **empery-web**, секрет на бэкенде — только для **empery-api**; проверить audience и мапперы.
4. **Роли в UI пустые** — client roles могут быть на **empery-api**; фронт агрегирует роли с `empery-web` и `empery-api`, API также принимает роли из `empery-mobile` (см. `shared/web/frontend/src/services/keycloak.ts`, `shared/api/core/token_roles.py`).
5. **502 на `https://auth.<домен>/` (ответ nginx)** — upstream Keycloak на хосте недоступен или порт не совпадает с nginx. На машине с nginx: убедиться, что **`proxy_pass`** (см. `docker/host_conf/nginx-auth-vm.conf`, по умолчанию `127.0.0.1:36000`) совпадает с **`KEYCLOAK_HOST_PORT`** в `docker/env_file/.env.stack6`; `podman ps` — **`stack6-keycloak`** **Up**; `curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:<порт>/realms/master` — ожидается **200**; иначе `podman logs stack6-keycloak --tail 80`. После смены порта — перезапуск stack6 и **`nginx -t` + reload**. Для offline-конфига на хосте: **`./docker/scripts/fix-offline-nginx-keycloak-upstream.sh`** (правит только server `auth.eliteew.ru` в `/etc/nginx/conf.d/offline-empery.conf`).
6. **`invalid_redirect_uri` с мобильным клиентом** — в **Clients → `empery-mobile`** добавьте **точный** callback (`Valid redirect URIs`) или задайте **`KEYCLOAK_MOBILE_EXTRA_REDIRECT_URIS`** и снова выполните **`keycloak-harden-empery-realm.sh`** (см. раздел «Нативное Android»).
7. **`invalid_scope (openid profile email)` на мобильном входе** — у **`empery-mobile`** не назначены default client scopes. Повторите **`keycloak-harden-empery-realm.sh`** (функция `ensure_client_default_scopes`) или вручную в **Clients → `empery-mobile` → Client scopes** добавьте **`profile`** и **`email`** как Default.
8. **Петля редиректов / «Non-secure context» в логах `DefaultCookieProvider` («proxy not trusted»)** — источник TCP к Keycloak не входит в **`KC_PROXY_TRUSTED_ADDRESSES`**, заголовки `X-Forwarded-Proto=https` игнорируются. Типично: host nginx / Meet WG / pasta bridge subnet вне списка. Решение: расширить список (дефолт в **`docker/stack/stack6.yml`** — loopback + RFC1918) или задать **`KC_PROXY_TRUSTED_ADDRESSES`** в **`docker/env_file/.env.stack6`**, затем recreate stack6 на **prod-core**.
9. **`stack6-keycloak-postgres` не стартует на Podman rootless (`wrong ownership` / `chmod ... Operation not permitted`)** — ownership bind-mount в `docker/data/stack6/keycloak-postgres` не соответствует uid контейнера (`70:70`) в user namespace Podman. Исправление:
   ```bash
   podman unshare sh -lc '
     chown -R 70:70 <repo>/docker/data/stack6/keycloak-postgres \
                     <repo>/docker/logs/stack6/keycloak-postgres
     chown -R 1000:0 <repo>/docker/logs/stack6/keycloak
   '
   ELITEEW_CONTAINER_RUNTIME=podman python3 docker/scripts/eliteew-container-control.py \
     --repo-root <repo> --yes recreate --include stack6
   ```
10. **Desktop сразу показывает «Неправильное имя пользователя или пароль», `LOGIN_ERROR invalid_user_credentials`, `userId=null`, а `oidc_auth_form_submit` отсутствует** — пройти весь путь, не останавливаться на browser override. Запрещённый v1-граф `preauth REQUIRED → empty/DISABLED link → postauth REQUIRED` запускает post-auth без пользователя; living graph — validated v2 (§Architecture above). Для v2 проверить, что `DESKTOP_CLIENT_BINDING_SPI_TOKEN` непуст и одинаков в Keycloak + stack0 API, а API middleware передаёт только exact `POST /api/v1/desktop-client/auth/internal/{precheck,commit,refresh-decision}` их собственному SPI-token guard. Keycloak materializes custom PAR fields under client-note names `client_request_param_<field>`: SPI must read `client_request_param_eliteew_ticket` (and prefixed `dpop_jkt` fallback), not only raw `eliteew_ticket`. В API access log после ticket должен появиться `/auth/internal/precheck`; его отсутствие означает отказ до decision service. Нельзя лечить это отключением ticket/PAR/DPoP или очередным WebView form hook.
11. **`eliteew_binding_preauth_deny reason=precheck`, но API не видит успешный `/auth/internal/precheck`** — проверить transport до decision service. Cloud prod-baked обязан использовать same-host endpoint `http://eliteew-api-prod:8000/api/v1/desktop-client`, заданный в `stack6.prod-baked.override.yml` (опциональный input `ELITEEW_BINDING_INTERNAL_API_BASE_URL`), а не публичный `app.eliteew.ru` hairpin. `BindingHttpClient` обязан фиксировать `HttpClient.Version.HTTP_1_1`: стандартная Java h2c-попытка даёт Uvicorn `400` до SPI guard. Keycloak и API должны состоять в `ew_net_9O11`; SPI token остаётся обязательным и одинаковым с обеих сторон. Не переводить endpoint в public route и не отключать fail-closed circuit.
12. **PAR/token endpoint возвращает `500 unknown_error`, Keycloak stacktrace содержит `DPoPReplayCheck` / `lifespanInSeconds must be positive`** — DPoP proof попал в допустимый active-window, но его `iat` уже слишком стар для положительного replay-cache TTL. Сравнить `date +%s` на prod-core и edge, затем `timedatectl show -p NTPSynchronized` на edge. При блокировке UDP/123 living fallback — `install-edge-time-sync.sh`: фиксированный prod-core nginx `Date` через Meet WG, bounded correction, native NTP precedence. Не отключать `dpopBoundAccessTokens`, replay check или PAR.

## SMTP и письма

Настройка **Realm → Email** (SMTP, From, SSL) выполняется вручную в Admin Console; в скрипт не выносится из-за секретов и политики почты.

Сброс пароля пользователем: в SPA-профиле кнопка **«Сбросить пароль по email»** открывает Keycloak `login-actions/reset-credentials` (`buildKeycloakPasswordResetUrl` в `keycloak.ts`). Требует `resetPasswordAllowed=true` на realm `empery` (harden) и рабочий SMTP. Пароль меняется только в Keycloak, не через legacy `POST /api/v1/profile/change-password`.

## Ссылки

### Официальная документация Keycloak (актуальная ветка на keycloak.org)

- Развёртывание за **reverse proxy**, заголовки `X-Forwarded-*`: [Reverse proxy](https://www.keycloak.org/server/reverseproxy)
- **Hostname** / публичные URL (`KC_HOSTNAME`, KC 26+): [Hostname](https://www.keycloak.org/server/hostname)
- Конфигурация **сервера** (общий обзор): [Server configuration](https://www.keycloak.org/server/configuration)
- **Securing applications** (OIDC/OAuth2, SPA, confidential clients, токены): [Securing applications](https://www.keycloak.org/docs/latest/securing_apps/)
- **Server Administration** (realm, clients, roles, mappers): [Server Administration Guide](https://www.keycloak.org/docs/latest/server_admin/)
- **Themes / custom login UI** (`parent`, `styles`, read-only trusted theme deployment): [Working with themes](https://www.keycloak.org/ui-customization/themes)

### В монорепозитории

- Правила Cursor: **`.cursor/rules/keycloak-eliteew.mdc`**
- Фронт: один источник токена для HTTP/WS — **`shared/web/frontend/src/services/authSession.ts`** (re-export фасада **`keycloak.ts`**), инициализация **`services/boot/authBootstrap.ts`**; нормализация redirect URI без циклов модулей — **`redirectUriNormalize.ts`**. Подробнее: **`product/FRONTEND-AUTH.md`**
- API: **`shared/api/core/token_roles.py`**, **`shared/api/core/keycloak_token_roles.py`**, **`shared/api/services/keycloak_service.py`**, **`shared/api/core/oauth2_auth.py`**, env — **`shared/api/core/unified_config.py`**
- Compose Keycloak: **`docker/stack/stack6.yml`**
- Правила деплоя: **`.cursor/rules/project-and-deploy.mdc`**
