# Yandex Cloud VM: edge nginx + SSH-туннель (reserve) к prod-core

Краткий операторский гид: **публичный IP у edge-VM в Yandex**, **nginx на VM**.

> **Канон HTTP backhaul (primary):** **[WG-HTTP-BACKHAUL-PRIMARY.md](WG-HTTP-BACKHAUL-PRIMARY.md)** — Meet WG `10.77.77.2` + host TCP proxies; этот документ — ключи, SSH reserve, fail2ban, nginx deploy, historical SSH path.

**Primary (2026-07-18):** nginx → **`10.77.77.2:{29001,29000,36000,13402,…}`** по Meet WG (`wg-meet-edge` / host `wg0`, UDP **51821**). Режим: `/etc/eliteew-backhaul-mode` = `wg`. Модуль: `docker/scripts/yandex-tunnel/wg-backhaul/`.

**SSH reserve (conserved, not deleted):** `stack-yandex-tunnel` + `-R` на `127.0.0.1`. Failover: `bash docker/scripts/yandex-tunnel/wg-backhaul/activate-backhaul.sh ssh` → обратно `activate-backhaul.sh wg` (паркует container, не удаляет).

**Telegram ip-verif бот** — на **отдельной** машине; SG /32 на 443. Создание edge: **[YANDEX-EDGE-VM-SETUP.md](YANDEX-EDGE-VM-SETUP.md)**. Эксплуатация: **[EMPERY-EDGE-IP-OPERATIONS.md](EMPERY-EDGE-IP-OPERATIONS.md)** · `empery-edge-ip-menu.sh`. Workers: **[LAN-WORKERS-141.md](LAN-WORKERS-141.md)**.

На **prod-core** (reserve mode) — контейнер **`stack-yandex-tunnel`** (`autossh`, порты **`-R 29001`**, **`-R 29002`**, **`-R 29000`**, **`-R 36000`**, **`-R 13402`** → Jitsi **`127.0.0.1:34002`**, см. **`docker/stack/stack-yandex-tunnel.yml`**). В primary WG mode контейнер обычно **Exited** (parked).

### `meet.eliteew.ru` (Jitsi Web UI через туннель)

Выжимка: обратный порт **`13402`** на VM указывает на prod-core **`127.0.0.1:34002`** (HTTP **jitsi/web**); nginx на VM проксирует **`meet.eliteew.ru`** → **`http://127.0.0.1:13402`** (или WG upstream в primary mode); на vhost Meet **нет** **`X-Frame-Options SAMEORIGIN`** — иначе **iframe из `https://app.eliteew.ru`** ломается.

**Полный канон** (архитектура, проверки, JVB-медиа, troubleshooting): **`platform/docker-re_doc/JITSI-MEET-YANDEX-REVERSE-TUNNEL.md`**.

## Файлы в репозитории

| Назначение | Путь |
|------------|------|
| Compose | `docker/stack/stack-yandex-tunnel.yml` |
| Образ | `docker/builders/yandex-tunnel/Dockerfile` |
| Entrypoint | `docker/scripts/yandex-tunnel/yandex-tunnel-entrypoint.sh` |
| Резолв ключей (~/.ssh, `keys/`) | `docker/scripts/yandex-tunnel/_ssh_defaults.sh` |
| Compose `up` с автоключом | `docker/scripts/yandex-tunnel/compose-up.sh` |
| Пример env | `docker/env_file/.env.yandex-tunnel.example` → скопировать в **`.env.yandex-tunnel`** (не коммитить) |
| Known_hosts для VM | Файл на хосте (по умолчанию **`docker/data/stack-yandex-tunnel/known_hosts`**): **`StrictHostKeyChecking=yes`** в compose; заполнить **`ssh-keyscan -H "$YANDEX_VM_IP"`** |
| Проверка с prod-core / command-center | `docker/scripts/yandex-tunnel/check-yandex-tunnel.sh` |
| Ключ tunnel на VM | `docker/scripts/yandex-tunnel/print-vm-oneliner.sh`, `setup-vm-no-ssh.sh`, `vm-setup-all.sh` |
| Добавить pubkey в `~tunnel` по SSH admin | `docker/scripts/yandex-tunnel/add-tunnel-key-on-vm.sh` |
| Выкатить app nginx на VM (с command-center) | `docker/scripts/yandex-tunnel/deploy-nginx-app-to-vm.sh` (опция **`NGINX_APP_SITE_CONFIG`** для mkcert-конфига) |
| Выкатить auth nginx на VM (с command-center) | `docker/scripts/yandex-tunnel/deploy-nginx-auth-to-vm.sh` (опция **`NGINX_AUTH_SITE_CONFIG`**, по умолчанию `nginx-auth-vm-mkcert.conf`) |
| Выкатить root landing nginx (`eliteew.ru`) на VM | `docker/scripts/yandex-tunnel/deploy-nginx-root-to-vm.sh` (опция **`NGINX_ROOT_SITE_CONFIG`**) |
| **Edge ops (living)** — domains, TLS, nginx, Site Studio reconcile | CLI / scripts under `docker/scripts/yandex-tunnel/` + [EMPERY-EDGE-IP-OPERATIONS.md](EMPERY-EDGE-IP-OPERATIONS.md); EWPower «Периметр» UI / `EWPOWER-EDGE-CONTROL.md` — **soft-retired → `trash/`** |
| Скопировать mkcert TLS (host) → VM | `docker/scripts/yandex-tunnel/sync-mkcert-certs-to-yandex-vm.sh` (**sudo** на host с mkcert) |
| mkcert TLS на edge/host | `host_conf` / edge nginx (stack666 TLS pull retired → `trash/`; не активный путь) |
| Конфиг nginx VM под mkcert-пути | `docker/host_conf/nginx-app-https-vm-mkcert.conf` (named upstreams → backhaul includes) |
| Конфиг nginx VM для Keycloak | `docker/host_conf/nginx-auth-vm-mkcert.conf` (`eliteew_auth_upstream`) |
| Конфиг nginx VM для landing root-домена | `docker/host_conf/nginx-root-landing.conf` (`eliteew_landing_upstream`) |
| Backhaul upstream includes (wg/ssh) | `docker/host_conf/backhaul/*.inc` — см. [WG-HTTP-BACKHAUL-PRIMARY.md](WG-HTTP-BACKHAUL-PRIMARY.md) |
| WG primary install / failover / verify | `docker/scripts/yandex-tunnel/wg-backhaul/` |
| Диагностика 404 API | diagnose-app-404.sh *[absent — historical ops helper]* |
| Смена edge IP | `docker/scripts/yandex-tunnel/migrate-to-new-edge.sh` |
| DNS cutover smoke | `docker/scripts/yandex-tunnel/dns-cutover-smoke.sh` |
| Аудит managed rules SG | `docker/scripts/yandex-tunnel/audit-sg-managed-rules.sh` |
| Цветной мониторинг / security audit | `docker/scripts/yandex-tunnel/yandex-tunnel-security-monitor.sh` |

См. также **vps-alma-ssh** (другая VM / пользователь `punisher`): vps-alma-ssh/ *[absent — historical helper tree not in repo]*.

### Edge-VM (новый аккаунт / новый IP)

- **`YANDEX_VM_IP`**: в `docker/env_file/.env.yandex-tunnel` (не коммитить). После создания VM: `bash docker/scripts/yandex-tunnel/migrate-to-new-edge.sh <NEW_IP>`.
- **SG managed rules**: audit via `audit-sg-managed-rules.sh`; historical Telegram ip-verif soft-retired → `trash/` (не resurrect без ТЗ).
- **Ingress 443**: только managed `/32`; **22** — только WAN MikroTik `/32`.

### Текущая продуктовая VM (исторический пример)

- **Единственный edge (prod):** **`YANDEX_VM_IP=93.77.165.185`** в `docker/env_file/.env.yandex-tunnel`.
- **Админ SSH на edge:** пользователь **`eliteew-edge`** (`YANDEX_VM_ADMIN_USER`), ключ **`YANDEX_VM_ADMIN_KEY_PATH`** (канон: `~/.ssh/sgbot-deploy/ssh-key-sg-bot`).
- **Ключи на command-center / prod-core** (единая логика в **`docker/scripts/yandex-tunnel/_ssh_defaults.sh`**):
  1. **`YANDEX_VM_ADMIN_KEY_PATH`** / **`YANDEX_TUNNEL_KEY_PATH`** в `.env.yandex-tunnel`;
  2. **`keys/yandex_tunnel_key`** — только пользователь **`tunnel`** (reverse SSH из `stack-yandex-tunnel`);
  3. иначе **`~/.ssh/id_ed25519`**, затем **`~/.ssh/id_rsa`**.
- Поднять туннель с авто-выбором ключа: **`bash docker/scripts/yandex-tunnel/compose-up.sh`** (экспортирует **`YANDEX_TUNNEL_KEY_PATH`** для compose).
- Новая пара для **`tunnel`**: положить pubkey в `authorized_keys` пользователя **`tunnel`** на edge (см. `add-tunnel-key-on-vm.sh`).

### TLS: mkcert на host vs Let’s Encrypt на VM

- На **command-center/local host** основной край для доменов EliteEW часто поднят **mkcert**: **`docker/scripts/gen-main-cert-mkcert.sh`** пишет **`/etc/nginx/ssl/offline-empery/fullchain.pem`** и **`privkey.pem`** (SAN: **`*.eliteew.ru`**, **`*.sites.eliteew.ru`**, **`eliteew.ru`** — проверь `openssl x509 -in fullchain.pem -noout -ext subjectAltName`).
- Чтобы **та же пара** работала на VM Yandex (тот же туннель и HTTPS):
  1. **`bash docker/scripts/yandex-tunnel/sync-mkcert-certs-to-yandex-vm.sh`** (нужен **sudo** на host с сертификатами из‑за прав на `privkey`).
  2. **`NGINX_APP_SITE_CONFIG=/полный/путь/к/repo/docker/host_conf/nginx-app-https-vm-mkcert.conf bash docker/scripts/yandex-tunnel/deploy-nginx-app-to-vm.sh`**
  Или из корня репо:
  `NGINX_APP_SITE_CONFIG="$PWD/docker/host_conf/nginx-app-https-vm-mkcert.conf" bash docker/scripts/yandex-tunnel/deploy-nginx-app-to-vm.sh`
- **Доверие в браузере:** mkcert подписан **вашим локальным CA**; устройства без установленного корня mkcert увидят предупреждение. Для произвольных пользователей интернета после публикации DNS нужен **Let’s Encrypt** и штатный **`nginx-app-https.conf`** (пути `/etc/letsencrypt/live/app.eliteew.ru/...`).
- **Keycloak через тот же край:** `auth.eliteew.ru` должен быть отдельным vhost на VM и проксировать **`127.0.0.1:36000`** (reverse tunnel → `stack6-keycloak`). Если vhost отсутствует, запросы к `https://auth.eliteew.ru/realms/.../.well-known/openid-configuration` попадают в vhost приложения и возвращают `index.html`; SPA получает CORS/`Failed to fetch` вместо OIDC redirect. Для текущего wildcard TLS используйте **`docker/host_conf/nginx-auth-vm-mkcert.conf`** и выкатывайте его командой:
  `bash docker/scripts/yandex-tunnel/deploy-nginx-auth-to-vm.sh`

## Порядок работ (новая VM)

1. В Yandex Cloud: статический публичный IP, Security group — **TCP 22** (и **80/443** с интернета для Let’s Encrypt и пользователей).
2. На command-center: при необходимости скопировать ключи: `cp ~/.ssh/id_ed25519 ~/.ssh/id_ed25519.pub keys/` (и при желании `cp keys/id_ed25519 keys/yandex_tunnel_key` + **`.pub`**), либо полагаться на **`~/.ssh`** без **`keys/`**.
3. Подготовить VM: **`bash docker/scripts/yandex-tunnel/vm-setup-all.sh`** и выполнить блоки в консоли VM, или **`setup-vm-no-ssh.sh`** / **`print-vm-oneliner.sh`**.
4. На command-center (env staging): **`docker/env_file/.env.yandex-tunnel`** — **`YANDEX_VM_IP`**, **`YANDEX_VM_ADMIN_USER`**, при необходимости явные пути **`YANDEX_VM_ADMIN_KEY_PATH`** / **`YANDEX_TUNNEL_KEY_PATH`**.
5. Сборка и запуск туннеля:
   ```bash
   bash docker/scripts/yandex-tunnel/compose-up.sh build          # при первом разе
   bash docker/scripts/yandex-tunnel/compose-up.sh up -d --build  # образ + контейнер
   # далее достаточно:
   bash docker/scripts/yandex-tunnel/compose-up.sh
   ```
   Вручную то же самое, если задан абсолютный **`YANDEX_TUNNEL_KEY_PATH`** в env (в `.env` **не** раскрывается `$HOME` — нужен полный путь или **compose-up.sh**).
6. После добавления проброса Meet пересоздать контейнер туннеля: **`bash docker/scripts/yandex-tunnel/compose-up.sh up -d --force-recreate`**.
7. Проверка: **`bash docker/scripts/yandex-tunnel/check-yandex-tunnel.sh`** (runtime-aware: `ELITEEW_CONTAINER_RUNTIME`, затем Podman, затем Docker), затем публичный путь с явным DNS/IP:
   `APP="$(dig @8.8.8.8 +short app.eliteew.ru A | head -1)" && curl -sSIL --resolve "app.eliteew.ru:443:${APP}" https://app.eliteew.ru/`
   и Keycloak discovery:
   `AUTH="$(dig @8.8.8.8 +short auth.eliteew.ru A | head -1)" && curl -sS --resolve "auth.eliteew.ru:443:${AUTH}" https://auth.eliteew.ru/realms/empery/.well-known/openid-configuration`
   и Meet (TLS + ответ JWT-gate/Jitsi):
   `MEET="$(dig @8.8.8.8 +short meet.eliteew.ru A | head -1)" && curl -sSIL --resolve "meet.eliteew.ru:443:${MEET}" https://meet.eliteew.ru/`
   `403` на `/` допустим, если отвечает JWT-gate без `jwt`; `502` / connection refused — ошибка туннеля или upstream.
   (см. также `diagnose-app-404.sh`).

### Auto-remediation: zombie `-R` / tunnel flap (prod-core)

Типичный сбой после флапа edge: старый `sshd: tunnel` на VM держит `127.0.0.1:{29001,29000,13402,13400,…}`, новый `stack-yandex-tunnel` пишет `remote port forwarding failed`, публичный `app`/`meet` ломается, медиа Meet тормозит.

**Guard (канон):**

```bash
# разово
bash docker/scripts/yandex-tunnel/yandex-tunnel-runtime-guard.sh

# timer каждые 2 мин (user scope без sudo, или system от root)
bash docker/scripts/yandex-tunnel/install-yandex-tunnel-runtime-guard.sh auto
```

Поведение при **WG primary** (туннель parked, proxies healthy): guard пишет OK и **не** поднимает SSH.

При сигналах в **SSH reserve** mode (`remote port forwarding failed`, массовый SSH timeout/refused, контейнер down без здорового WG):

1. Предпочтительно: reinstall/restart `eliteew-wg-tcp-proxy@*` (если units есть) — без silent fallback на SSH.
2. Иначе на edge: `pkill -u tunnel` (освобождает `-R`) — admin SSH ключ (`_ssh_defaults.sh`).
3. На prod-core: `compose-up.sh up -d --force-recreate` (только если идём по SSH remediation ветке).
4. Рестарт `eliteew-jvb-media-relay-udp-wg` на edge.
5. Cooldown **10 мин** (`YANDEX_TUNNEL_GUARD_COOLDOWN_SEC`) против restart storm.

Лог: `docker/data/stack-yandex-tunnel/runtime-guard.log`.

Параллельно для UDP-native ICE mapping держи **Meet media guard**:
`bash docker/scripts/yandex-tunnel/meet-edge-wg/install-meet-media-runtime-guard.sh auto`
(см. [MEET-MEDIA-UDP-NATIVE-PATH.md](MEET-MEDIA-UDP-NATIVE-PATH.md)).

Проверка, что GAF video calls не зависли в `ringing`/`active`:

```bash
bash docker/scripts/yandex-tunnel/check-open-video-calls.sh
```

### Мониторинг и fail2ban на edge

Интерактивный мониторинг:

```bash
bash docker/scripts/yandex-tunnel/yandex-tunnel-security-monitor.sh
```

Быстрые команды:

```bash
bash docker/scripts/yandex-tunnel/yandex-tunnel-security-monitor.sh report 200
bash docker/scripts/yandex-tunnel/yandex-tunnel-security-monitor.sh suspicious 120
bash docker/scripts/yandex-tunnel/yandex-tunnel-security-monitor.sh install-fail2ban
bash docker/scripts/yandex-tunnel/yandex-tunnel-security-monitor.sh fail2ban-status
```

После `source docker/scripts/eliteew-docker-aliases.sh` доступен alias-функция `eetunnel`.

`install-fail2ban` ставит/обновляет `/etc/fail2ban/jail.d/eliteew-edge-tunnel.local` и фильтр
`/etc/fail2ban/filter.d/eliteew-nginx-botsearch.conf` (канон в репо:
`docker/host_conf/fail2ban/eliteew-nginx-botsearch.conf`):

- `sshd` через systemd backend;
- `nginx-http-auth` для `/var/log/nginx/error.log`;
- `nginx-botsearch` с **`backend = polling`** и `logpath = /var/log/nginx/access.log`
  (штатный filter с `journalmatch` иначе уходит в systemd и **не читает** access.log);
- расширенный WordPress match: `wp-admin/…`, `wp-login.php`, `xmlrpc.php`
  (stock `wp-admin.php` не ловил `/wp-admin/install.php`).

Неинтерактивно: `ELITEEW_EDGE_FAIL2BAN_YES=1 bash …/yandex-tunnel-security-monitor.sh install-fail2ban`.

**CMS probes vs Cloudflare:** публичные probe на `/wp-admin/`, `phpmyadmin`, `.env`, …
закрываются nginx **`return 444`** в `docker/host_conf/nginx-*.conf` (landing + app).
Не банить Cloudflare edge IP (`172.64/12` и соседние) — это shared egress, не атакующий origin.
fail2ban `nginx-botsearch` остаётся для **остаточных** 404 по access.log (не CF-бан за 444-пути).

После смены scanner-deny на edge:

```bash
bash docker/scripts/yandex-tunnel/deploy-nginx-root-to-vm.sh
NGINX_APP_SITE_CONFIG="$PWD/docker/host_conf/nginx-app-https-cloud-spa.conf" \
  bash docker/scripts/yandex-tunnel/deploy-nginx-app-to-vm.sh
# smoke (ожидаем empty reply / curl 52 или обрыв, не 301/404 HTML):
curl -sS -o /dev/null -w '%{http_code}\n' --max-time 8 https://eliteew.ru/wp-admin/install.php || true
```

**Динамический домашний WAN:** fail2ban не умеет ignore по MAC — только IP/CIDR. Статический `ignoreip` для домашнего egress **нельзя** полагаться (ISP/CGNAT ротация). `yandex-tunnel-runtime-guard.sh` на каждом тике:

1. узнаёт текущий egress (`ifconfig.me` / `api.ipify.org`);
2. по admin SSH **через WG** `10.77.77.1` (если публичный `:22` уже забанен) пишет `/etc/fail2ban/jail.d/eliteew-wan-ignore.local` и делает `addignoreip` + `unbanip` для этого IP.

Отключить sync: `YANDEX_TUNNEL_GUARD_SYNC_WAN_IGNOREIP=0`. Админ-хост WG: `YANDEX_TUNNEL_GUARD_EDGE_ADMIN_HOST` (default `10.77.77.1`).

Инцидент-паттерн: flap туннеля → fail2ban банит WAN `.111`/`.136` → публичный `:22` = `Connection refused` → 502 на `app`, пока ignore/unban не восстановлен (WG admin SSH при этом жив).

На edge с исходящим SG **TCP/443-only** стандартные Ubuntu sources на `http://` не подходят для `apt-get`. Скрипт перед установкой fail2ban переводит стандартные `mirror.yandex.ru` / `security.ubuntu.com` sources на `https://` и оставляет резервные копии `*.eliteew-http-to-https.bak`.

### Обновление nginx vhost на текущей VM

```bash
bash docker/scripts/yandex-tunnel/sync-mkcert-certs-to-yandex-vm.sh
NGINX_APP_SITE_CONFIG="$PWD/docker/host_conf/nginx-app-https-vm-mkcert.conf" \
  bash docker/scripts/yandex-tunnel/deploy-nginx-app-to-vm.sh
bash docker/scripts/yandex-tunnel/deploy-nginx-auth-to-vm.sh
bash docker/scripts/yandex-tunnel/deploy-nginx-root-to-vm.sh
```

После обновления проверяйте **app**, **auth** и **meet** с принудительным публичным IP/внешним DNS (см. блок **Порядок работ**), чтобы локальные LAN overrides не маскировали проблему.

### Root landing hardening (`eliteew.ru`)

Root-домен: `nginx-root-landing.conf` → `eliteew_landing_upstream` (WG: `10.77.77.2:29002`; SSH: `127.0.0.1:29002`).
Edge-конфиг должен оставаться тонким reverse proxy без API-логики и без доступа к приложению:

- `server_tokens off` на vhost, чтобы публичный `Server` не раскрывал версию nginx.
- Единый набор edge headers: HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP и CSP для **Next site_prod**: `script-src`/`style-src` включают `'unsafe-inline'` (RSC + Framer Motion); `form-action 'self'`. Не ужесточать обратно до static-landing CSP без nonce-программы.
- `limit_req` на root vhost для снижения шума от сканеров.
- Явный `404` для probe/API-like путей: `/docs`, `/redoc`, `/openapi.json`, `/.env`, `/.git/*`, `wp-config*`, `/api/fetch*`, `/proxy*`, `?url=...`, `?dest=...`.
- `POST` только на `location = /api/lead` (lead funnel); остальной `/` — GET/HEAD.
- `/health` остаётся публичным для landing smoke, но отдаёт только `healthy`, `text/plain` и `X-Robots-Tag: noindex, nofollow`.
- Upstream — Next standalone `stack0-eliteew-landing` (`shared/web/site_prod`); canon: [product/SITE-PROD-LANDING.md](../../product/SITE-PROD-LANDING.md).

Smoke после деплоя root vhost:

```bash
curl -sSI https://eliteew.ru/ | rg -i 'content-security-policy'
curl -sf https://eliteew.ru/health
curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://eliteew.ru/api/lead \
  -H 'Content-Type: application/json' \
  -d '{"intent":"demo","contact":{"email":"smoke@example.com","companySize":"100-1000"}}'
```

### App/Auth edge hardening (`app.eliteew.ru`, `auth.eliteew.ru`)

`app.eliteew.ru` → named upstream `eliteew_app_upstream` (WG: `10.77.77.2:29001`; SSH reserve: `127.0.0.1:29001`).
`auth.eliteew.ru` → `eliteew_auth_upstream` (WG: `10.77.77.2:36000`; SSH: `127.0.0.1:36000`).

Инварианты app edge:

- `server_tokens off` на `app`, `meet` и wildcard sites vhost.
- Не задавать второй CSP на app edge: CSP остаётся из frontend-контейнера, edge добавляет только HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP.
- Edge скрывает дублирующиеся upstream headers (`Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`), чтобы публичный ответ имел один согласованный набор.
- Явный `404` для probe/API-like путей: `/docs`, `/redoc`, `/openapi.json`, `/.env`, `/.git/*`, `wp-config*`, `/api/fetch*`, `/proxy*`, `?url=...`, `?dest=...`.
- Реальные `^~ /api/`, `^~ /socket.io/` и нормальные SPA deep-link пути должны продолжать проксироваться в frontend/API runtime.

Инварианты auth edge:

- `server_tokens off` на `auth.eliteew.ru` и `admin.eliteew.ru`.
- OIDC discovery для realm `empery` должен оставаться доступен:
  `https://auth.eliteew.ru/realms/empery/.well-known/openid-configuration`.
- CORS preflight на Keycloak остаётся ограничен значением `Access-Control-Allow-Origin: https://app.eliteew.ru`.
- `/metrics`, `/health`, `/.env` и подобные probe paths должны возвращать `404`.

Smoke после деплоя app/auth vhost:

```bash
curl -fsS https://app.eliteew.ru/api/health
curl -sSI https://app.eliteew.ru/ | grep -Ei '^(server|content-security-policy|permissions-policy|cross-origin-)'
curl -sS -o /dev/null -w '%{http_code}\n' https://app.eliteew.ru/openapi.json
curl -fsS https://auth.eliteew.ru/realms/empery/.well-known/openid-configuration
```

## Замечания

- SSH reserve требует, чтобы на **prod-core** слушали **127.0.0.1:29001** (фронт stack0), при использовании **36000** — Keycloak, при использовании **13402** — **Jitsi Web** (**`127.0.0.1:34002`**, см. **`docker/stack/stack11.yml`** / контейнер **`stack11-jitsi-web-elite`**). Primary HTTP = Meet WG ([WG-HTTP-BACKHAUL-PRIMARY.md](WG-HTTP-BACKHAUL-PRIMARY.md)).
- Опционально **`YANDEX_TUNNEL_PROXY`**: HTTP CONNECT до облака (см. `yandex-tunnel-entrypoint.sh`).
- Исторические копии вне дерева (`rar_docker`) не канон.
