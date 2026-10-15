# SPA, Bearer-токен и граница доверия клиента

**Статус:** Канон (2026-05-23).

Краткая модель угроз для EliteEW: веб-клиент (`shared/web/frontend`) + API (`shared/api`) с OIDC (Keycloak) и заголовком `Authorization: Bearer`. Для операторов и разработчиков — **без** иллюзии «спрятать API» или «подписать JSON в браузере». Детали токенов и login flow — **`product/FRONTEND-AUTH.md`**, Keycloak — **`platform/docker-re_doc/KEYCLOAK-ELITEEW.md`**, CSP/nginx — **`platform/FRONTEND-SECURITY-NGINX-STATIC.md`**.

---

## 1. Границы доверия

| Зона | Доверие | Смысл |
|------|---------|--------|
| **Браузер пользователя** | Недоверенная | Любой JS, Network, localStorage/sessionStorage, расширения — под контролем пользователя или атакующего с XSS |
| **TLS до `app.eliteew.ru`** | Доверенный канал | Целостность и конфиденциальность на проводе |
| **API + Postgres/Redis** | Доверенная зона продукта | Аутентификация, авторизация, бизнес-правила, аудит |
| **Keycloak** | Доверенный IdP | Выдача и отзыв токенов, роли в JWT |

**Вывод:** фронтенд — UI и кэш, не «охранник». Видимость маршрутов и тел запросов в DevTools — **нормальная** модель угроз, как у Gmail/GitHub/Notion.

---

## 2. Что даёт и чего не даёт Bearer-токен

### Аутентификация (кто вызывает API)

- SPA получает access (и refresh) через OIDC (`oauth4webapi`, клиент `empery-web`, PKCE).
- Токены в **`localStorage`** («Запомнить меня») или **`sessionStorage`** (до закрытия вкладки). Ключи: `eliteew.keycloak.oidcTokens.v1`, см. **`product/FRONTEND-AUTH.md`**.
- API: middleware/зависимость **`require_oauth2_user`** → пользователь Keycloak → **`get_current_user_db_id`** → UUID в `users.id`.

**Имея валидный токен**, можно повторять запросы (curl, DevTools, скрипт) до истечения или отзыва. Это не баг — это свойство bearer-модели.

### Авторизация (что разрешено этому principal)

Токен **не заменяет** проверки:

- владелец строки (`user_id`, `config_id`, документ, run companion);
- роль приложения (`admin`, `emperyworld_admin`, UGS admin);
- feature flags / env gates на бэкенде.

Если обработчик проверяет только «JWT валиден» — возможны **IDOR** и эскалация прав при подстановке чужих `id` в path/body.

### Подпись тела запроса

В браузере **не** используется HMAC подписи JSON: секрет подписи нельзя хранить во фронте. Защита — **TLS + токен + серверная валидация**. Подпись запросов уместна для **сервер-сервер** и вебхуков, не для SPA пользователя.

---

## 3. Что EliteEW уже делает правильно

| Область | Реализация | Где смотреть |
|---------|------------|-------------|
| Единый вход auth API | `require_oauth2_user`, introspection/RS256 fallback | `api/core/oauth2_auth.py`, `api/middleware/oauth2_protection.py`, `api/services/keycloak_service.py` |
| Идентичность в БД | `get_current_user_db_id` | `api/dependencies/user_context.py` |
| Секреты не во фронте | Только `VITE_*` публичные URL/client id | **`platform/FRONTEND-SECURITY-NGINX-STATIC.md`**, `vite.config.ts` |
| Снижение XSS | CSP prod (`script-src 'self'`, без `unsafe-eval`), вынесенный preloader | nginx + `docker-entrypoint-csp.sh` |
| Источник правды desktop | Postgres `desktop_configs` / `desktop_items`, API PATCH/GET | **`product/desktop/DESKTOP-STATE-PERSISTENCE.md`** |
| Companion / EWA | Оркестрация, tools, планы — на сервере; клиент шлёт текст и `shell_context` | `api/ewa_platform/`, **`product/ewa/`** |
| Админ companion | Роль `admin` / `emperyworld_admin` на роутерах admin | `api/ewa_platform/gateways/routers/companion_admin.py` |
| Защищённые медиа | Blob через API + Bearer, не прямой `src` на `/api/...` | **`product/desktop/DESKTOP-STATE-PERSISTENCE.md`** §6 |
| Рассинхрон SPA после деплоя | deploy id в бандле = `app-build-version.txt`; reload / overlay | **`platform/docker-re_doc/FRONTEND-STALE-CHUNK-404.md`** |
| Верификация агентом | Трассировка + тесты на границах контракта | **`platform/AGENT-CODE-VERIFICATION-WORKFLOW.md`** |

Клиентское хранилище (localStorage, sessionStorage, IndexedDB) описано отдельно: **`platform/FRONTEND-TOOLCHAIN-AND-BUILD.md`** (раздел про storage в обсуждении с оператором — см. worklog); канон desktop persist — **`DESKTOP-STATE-PERSISTENCE.md`**.

---

## 4. Типичные «дыры» и риски (на что смотреть при ревью)

### 4.1 IDOR / слабая авторизация

**Симптом:** эндпоинт принимает `id` из URL/body и не сверяет с `get_current_user_db_id` (или ролью).

**Примеры зон риска (аудит, не список багов):**

- `PUT/PATCH/DELETE` по id сущностей desktop, контента, документов, task-runs companion;
- скачивание/превью unified content по UUID;
- admin-only мутации без `require_admin_user` / проверки роли.

**Митигация:** на каждый мутирующий и читающий чужие данные handler — явная проверка владельца или scope; pytest с двумя пользователями.

### 4.2 XSS → кража токена

**Симптом:** инъекция JS на origin `app.eliteew.ru` читает `localStorage` / перехватывает fetch.

**Митигация:** CSP, санитизация HTML (где рендерится пользовательский контент), не вставлять непроверенный HTML; короткий TTL access token, refresh rotation (Keycloak), см. **`KEYCLOAK-ELITEEW.md`**.

Текущий фронтенд-контур (2026-05):

- Ассистент и GAF assistant bubbles используют общий builder `sharedChatRehypePlugins.ts` с обязательным `rehype-sanitize`.
- Assistant markdown остаётся на `rehype-sanitize` с отдельными link/image guard правилами.
- `javascript:`/unsafe URL остаются в тексте как disabled span и не рендерятся как clickable `<a>`.

**Не путать:** роль **`admin` в приложении** ≠ администратор realm Keycloak.

### 4.3 Слепое доверие payload с клиента

**Симптом:** сервер исполняет «команды» из `shell_context`, structured action или tool args без нормализации и allowlist.

**Митигация:** уже заложено в companion (registry, orchestrator, sanitize); при новых типах action — слой B/C из **`AGENT-CODE-VERIFICATION-WORKFLOW.md`**.

### 4.4 «Безопасность через сокрытие»

**Не работает:** обфускация JS, закрытие OpenAPI от глаз, подпись тела в браузере, секрет в `VITE_*`.

**Работает:** серверные правила, rate limit, аудит, минимальные права ролей.

### 4.5 Утечка логики во фронте

**Риск:** низкий для confidentiality, средний для **абьюза** (обход UI, автоматизация). Критичные квоты, цены, удаление — только API.

---

## 5. Таблица угроз (кратко)

| Угроза | Вектор | Типичная тяжесть | Основная линия защиты |
|--------|--------|------------------|------------------------|
| Кража сессии | XSS, расширение, общий ПК | Высокая | CSP, санитизация, короткий access, logout |
| IDOR | Чужой UUID в запросе | Высокая | Проверка владельца на сервере |
| Replay API | curl + скопированный Bearer | Средняя | TTL токена, отзыв, аудит |
| Подмена client state | Фейковый `shell_context` | Средняя (продукт) | Нормализация, server-only tools |
| Просмотр кода/Network | DevTools | Низкая (security) | Не хранить секреты во фронте |
| Старый бандл после деплоя | Кэш JS | Средняя (доступность) | `app-build-version.txt`, no-cache `index.html` |

---

## 6. Как делают сильные продукты (ориентир)

| Подход | Примеры | Применимость к EliteEW |
|--------|---------|-------------------------|
| OAuth2 + короткий access | Google, Microsoft 365, GitHub | Уже: Keycloak + Bearer |
| Авторизация на ресурс | GitHub repo permissions, Stripe object scope | Цель каждого роутера |
| Секреты только на сервере | Stripe `sk_*` | Уже: `empery-api` secret только в API |
| Step-up / SCA | Банки, смена пароля | По необходимости для разрушительных admin-операций |
| E2E в клиенте | Signal | Только где продуктово нужно (GAF crypto — отдельный контур) |
| Не прятать API | Публичные REST/GitHub API | Норма; защита — токен + права |

---

## 7. Чеклист для разработчика (новый эндпоинт или фича)

1. **Auth:** зависимость `require_oauth2_user` / `get_current_user_db_id` (или явный admin gate).
2. **Authz:** для каждого id в path/body — «этот `users.id` владеет ресурсом?» или роль admin.
3. **Input:** Pydantic-схема, лимиты размера, запрет лишних полей где уместно.
4. **Client payload:** не исполнять слепо; allowlist intent/action (companion, desktop orch).
5. **Ответ:** не отдавать чужие PII; 404/403 единообразно (не раскрывать существование чужих id без политики).
6. **Тест:** минимум один тест «пользователь B не читает/не пишет ресурс пользователя A» на границе.
7. **Фронт:** не класть секреты в JS; защищённые URL — blob через API (см. desktop canon).

---

## 8. Чеклист для оператора / аудита

- [ ] CSP prod без LAN IP в `CSP_*_EXTRA` (см. **`FRONTEND-SECURITY-NGINX-STATIC.md`**).
- [ ] Keycloak: rotation refresh, audience `empery-api`, роли не смешивать с realm-management для app admin.
- [ ] Логи API: нет Bearer/Cookie в access log nginx (канон FEC).
- [ ] Admin EWA: доступ только у `admin` / `emperyworld_admin`; smoke — **`product/ewa/EWA-COMPANION-ADMIN-SMOKE-STACK0.md`**.
- [ ] Периодический прогон pytest на IDOR-критичных модулях (desktop, content, companion admin).

---

## 9. Чего не делать

- Не считать DevTools «уязвимостью» — считать **подсказкой**, что API должен быть корректен при произвольных параметрах с валидным токеном.
- Не хранить API secret, HMAC-ключ подписи запросов или private key во фронте.
- Не полагаться на «пользователь не умеет в curl».
- Не дублировать бизнес-решения только во фронте без серверного дубликата.

---

## 10. Связанные документы

- **`product/FRONTEND-AUTH.md`** — токены, `beginInteractiveLogin`, fetch/Socket.IO
- **`platform/docker-re_doc/KEYCLOAK-ELITEEW.md`** — клиенты, introspection, роли
- **`platform/FRONTEND-SECURITY-NGINX-STATIC.md`** — CSP, nginx, prod vs LAN
- **`platform/docker-re_doc/FRONTEND-STALE-CHUNK-404.md`** — кэш бандла, не auth
- **`product/desktop/DESKTOP-STATE-PERSISTENCE.md`** — сервер vs localStorage
- **`platform/AGENT-CODE-VERIFICATION-WORKFLOW.md`** — регрессии контракта
- **`platform/docker-re_doc/CONTAINER-SECURITY-THREAT-MODEL.md`** — compose-аудит с учётом периметра edge+NAT+SG (исторический host alias «punisher» = command-center / prod-core по контексту; живой расклад — [PRODUCTION-TOPOLOGY-STATE.md](PRODUCTION-TOPOLOGY-STATE.md))
- **`platform/docker-re_doc/EMPERY-EDGE-IP-OPERATIONS.md`** — edge SG / public ingress (не прямой WAN на LAN hosts)
