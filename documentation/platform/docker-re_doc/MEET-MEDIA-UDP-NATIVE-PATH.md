# Meet / Jitsi — UDP-native медиа (канон)

**Статус:** UDP-native media path восстановлен (2026-05-28) и повторно подтверждён операторским smoke (2026-06-03): host/rootful `wg0` активен, edge видит latest handshake, firewalld пропускает `10.77.77.1 → udp/34000`, JVB получает STUN/RTP и фиксирует `ICE connected` / selected pair через `93.77.165.185:13400/udp`.
**Скрипты:** `docker/scripts/yandex-tunnel/meet-edge-wg/README.md`
**Incident + методика:** [JITSI-MEDIA-INCIDENT-2026-05-28.md](JITSI-MEDIA-INCIDENT-2026-05-28.md)

## Симптомы до миграции

- Голос «робот», `large jump in sequence numbers` в JVB.
- ICE **connected** на `93.77.165.185:13400`, но транспорт **UDP→TCP→SSH**.

## Корневая причина (старый путь)

```text
Клиент ──UDP──► edge :13400 ──socat──► TCP ──SSH -R──► then-home-host ──socat──► JVB :34000
```

Opus по TCP/SSH — непригодно для VoIP. Тюнинг битрейта и `trust-bwe` **не** лечит транспорт.

## Рабочая схема (reversed WG + динамический WAN дома)

Дом **без** статического `31.x` / **без** проброса портов на MikroTik.
Публичный статический IP — **edge** `93.77.165.185`. JVB host = **prod-core `.111`** (`10.77.77.2`).

```text
Сигналинг (HTTPS/WSS)     Meet WG / SSH reserve → prod-core :34002
App (app.eliteew.ru)     Meet WG primary HTTP (см. WG-HTTP-BACKHAUL-PRIMARY.md)

Клиент Meet ──UDP RTP──► edge :13400
                         kernel NAT DNAT/MASQUERADE → 10.77.77.2:34000
                              ▲
                              └── WG-туннель
prod-core ──исходящий WG client──► edge :51821
         (host/rootful wg-quick@wg0; rootless Podman не подходит для prod)
         JVB слушает 0.0.0.0:34000 на хосте
```

### Критические инварианты

| # | Инвариант |
|---|-----------|
| 1 | Relay на edge: **`UDP 13400 → 10.77.77.2:34000`**; LAN target command-center `.136:34000` даёт `No route to host` через edge WG |
| 2 | WG-клиент prod-core: **host/rootful `wg0`** через `wg-quick@wg0`; rootless Podman-контейнер не считается рабочим, если `wg0` отсутствует на хосте |
| 3 | Edge WG server: peer **AllowedIPs = 10.77.77.2/32** |
| 4 | JVB ICE: только **`93.77.165.185:13400/udp`** (без канарейки :13410 без WG) |
| 5 | SG Yandex edge: **UDP 51821** + **UDP 13400** inbound |
| 6 | Не использовать userland `socat` с `fork` для RTP: живой звонок упирается в `Too many open files` |
| 7 | Host firewall prod-core: разрешить только **`10.77.77.1/32 → udp/34000`**; `ICMP admin prohibited filter` в edge tcpdump означает, что firewalld режет JVB port |
| 8 | После recreate `stack11` проверять `jvb.conf`: шаблон может вернуть `public-address="93.77.165.185#13400"` (`name=ip-0`); сразу пере-применять `apply-stack11-jvb-ice-static-mappings.sh` до smoke-звонка |
| 9 | Для авто-ремедиации drift держать **один** timer `eliteew-meet-media-guard.timer` в **system** scope (firewall fix). User-scope дубль не нужен: JVB на rootless Podman — через drop-in `CONTAINER_HOST=unix:///run/user/1000/podman/podman.sock`. Autostart уже вызывает `apply-stack11-jvb-ice-static-mappings.sh`. |
| 10 | **Host publish ≠ container health:** `stack11-meet-jwt-gate` / `jvb` могут быть `healthy` при мёртвом publish (`127.0.0.1:34002`, `*:34000/udp`). Тогда WG proxy `@13402` → connection refused → public Meet **502**, медиа без ICE. Smoke: `ss -lntu \| rg '34002\|34000'` + `verify-wg-backhaul.sh` (`meet_jwt_gate_local` / `public_meet_config`). Remediate: force-recreate `meet-jwt-gate` (+ `jvb` при необходимости), не трогая образы Jitsi |
| 11 | **ICE face = Meet WG IP:** `apply-stack11-jvb-ice-static-mappings.sh` / `fix-meet-media-path.sh` для профиля `yandex` ставят `local-address=10.77.77.2` (override `JITSI_JVB_LOCAL_ADDRESS`), не default-route LAN и не legacy `.136`. Иначе mapping не матчится на реальный harvester face. |
| 12 | **Не `org.ice4j.BIND_WILDCARD=true` на host-network JVB:** ice4j тогда отдаёт host candidate `ip=0.0.0.0:34000`, static mapping `10.77.77.2→93.77…:13400` не применяется, клиенты не видят/не слышат друг друга при живом сигналинге. Слушать `10.77.77.2:34000` (+ при необходимости LAN) и держать mapping face=`10.77.77.2`. |
| 13 | **colibri-ws nginx:** при host-network JVB `proxy_pass` на **литеральный IP:19090** (часто `169.254.1.2:19090` = `host.containers.internal`), не `host.containers.internal` (nginx runtime DNS → **502**) и не `:9090` (cockpit). Скрипт: `apply-stack11-jitsi-web-nginx-ws.sh` (`JITSI_JVB_COLIBRI_UPSTREAM`). Без colibri-ws ICE trickle мёртв → `neither failed nor connected` / mute UI. |
| 14 | **SCTP fallback (trial 2026-08-15):** если клиенты (Tauri/WebKit) **не открывают** `colibri-ws`, по [Docker handbook](https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-docker/) — `ENABLE_SCTP=1` + client `openBridgeChannel='datachannel'` / `preferSctp: true` (оставить XMPP websocket). JVB host-net: `sctp { enabled = true }` в `jvb.conf` без compose-recreate JVB. |
| 15 | **`stack11.yml` JVB = `network_mode: host`:** после recreate в **bridge** harvester слушает `10.89.x:34000`, а static mapping face=`10.77.77.2` → ICE Running без Completed, в браузере нет A/V при живом сигналинге. Канон: host-net + `XMPP_SERVER=localhost` (Prosody `127.0.0.1:5222`) + `custom-jvb.conf` public `:19090` (не ro-bind в `/config` — ломает cont-init `chown`). Apply: `apply-stack11-jvb-ice-static-mappings.sh` (ставит custom + ICE) и `apply-stack11-jitsi-web-nginx-ws.sh`. |

### Когда `eliteew-meet-media-guard` можно убрать

Guard **не** обязателен, если одновременно верно:

1. Permanent firewalld rich-rule `10.77.77.1/32 → udp/34000` уже в нужной zone и не сносится при harden/zone switch.
2. После каждого recreate `stack11` оператор/autostart гарантированно гоняет `apply-stack11-jvb-ice-static-mappings.sh` (уже в `podman-autostart-prod-core.sh`).
3. Legacy rootless `meet-edge-wg` не поднимается (host `wg0` канон).
4. Нет параллельного **user** + **system** timer (двойной прогон каждые 2 мин даёт шум; system без `CONTAINER_HOST` не видит rootless JVB).

Иначе **оставлять system timer** как safety-net для firewall drift (особенно после смены zone Workstation→Server). Host harden: `docker/scripts/prod-core/harden-prod-core-host.sh` оставляет system timer, отключает user-scope дубль.

> Важно для Podman rootless: `network_mode: host` в compose не гарантирует права на создание `wg0`.
> Если в `podman logs meet-edge-wg` видно `RTNETLINK answers: Operation not permitted`
> или `wg-quick: not found`, UDP-native не поднят. Нужен host-level `wg-quick up`
> через root/sudo/rootful systemd, либо временный откат на TCP-relay.
> После успешного `install-host-wg-client.sh` legacy rootless `meet-edge-wg` должен быть остановлен.

## Развёртывание

С **prod-core** (JVB / host `wg0`):

```bash
cd /path/to/powered_by_emperyworld
bash run-meet-media-install.sh
```

или:

```bash
bash docker/scripts/yandex-tunnel/meet-edge-wg/install-meet-media.sh
```

Если нужно поднять только host WireGuard-клиент после уже настроенного edge:

```bash
bash docker/scripts/yandex-tunnel/meet-edge-wg/install-host-wg-client.sh
```

Этот шаг требует root/sudo на prod-core: копирует
`docker/data/meet-edge-wg/home-wg-client.conf` в `/etc/wireguard/wg0.conf` и
включает `wg-quick@wg0`. Если firewalld активен, скрипт добавляет runtime +
permanent rich-rule для `10.77.77.1/32 → udp/34000`.

Проверка:

```bash
bash docker/scripts/yandex-tunnel/meet-edge-wg/verify-meet-media.sh
```

Логи: `docker/data/meet-edge-wg/install-*.log`, `verify-*.log`

### Авто-guard от повторного drift

```bash
bash docker/scripts/yandex-tunnel/meet-edge-wg/install-meet-media-runtime-guard.sh auto
```

`auto` ставит `system` scope, если есть root/non-interactive sudo; иначе ставит
`user` scope. Для полного авто-исправления firewalld используйте system scope:

```bash
sudo bash docker/scripts/yandex-tunnel/meet-edge-wg/install-meet-media-runtime-guard.sh system
```

Guard проверяет и лечит:
- возврат `jvb.conf` к `public-address="...#13400"` (`name=ip-0`);
- повторный запуск legacy rootless `meet-edge-wg`.

## Проверка звонка

1. `verify-meet-media.sh` — все **PASS** (WARN по логам до первого звонка — норма).
2. **Новая** комната Meet, ~60 с только аудио.
3. JVB (`docker/logs/stack11/jvb/jvb.log`):
   - `ICE connected`
   - `Selected pair … 93.77.165.185:13400/udp/srflx`
   - нет частых `large jump` на audio
4. Edge tcpdump: есть обратные пакеты `10.77.77.2:34000 -> 10.77.77.1:<client-port>` и нет `admin prohibited filter`.

## Откат на TCP-relay

```bash
bash docker/scripts/yandex-tunnel/meet-edge-wg/rollback-meet-media-udp.sh
```

Вернёт `eliteew-jvb-media-relay` (UDP-over-SSH). Голос снова с артефактами, но «как раньше».

Признаки отката в логах JVB:

- `ICE connected`;
- `Selected pair … 93.77.165.185:13400/udp/srflx`;
- частые `Received a suspiciously large buffer (size = 1502)`;
- `BandwidthAllocator ... bwe=-1`.

Это подтверждает, что signaling/ICE живы, но качество ломает транспорт TCP/SSH. Тюнинг 180p/битрейта может только уменьшить нагрузку, но не исправляет RTP transport.

## Почему не работало раньше (журнал)

| Попытка | Проблема |
|---------|----------|
| NAT MikroTik `31.x:51821` | Динамический WAN, входящий UDP не виден |
| Relay → `192.168.1.136:34000` | Для host `wg0` edge получает `No route to host`; relay должен идти на **`10.77.77.2:34000`** |
| ICE канарейка `:13410` | ICE без рабочего пути → тишина |
| Firewalld без `10.77.77.1/32 -> udp/34000` | Edge получает `ICMP admin prohibited filter`; `install-host-wg-client.sh` добавляет runtime + permanent rich-rule |

Починка: `fix-meet-media-path.sh` (включено в актуальный `install-meet-media.sh`).

## Устаревшее

- Проброс UDP на MikroTik / Keenetic для Meet WG — только при **статическом** WAN.
- `deploy-home-docker.sh` + `deploy-edge-client.sh` (WG client на prod-core).
- Параллельный ICE `:13410` без отдельного рабочего relay.

## Связанные документы

- `JITSI-MEDIA-INCIDENT-2026-05-28.md` — historical incident + evidence-first methodology
- `JITSI-MEET-YANDEX-REVERSE-TUNNEL.md` — порты сигналинга / edge
- `YANDEX-EDGE-VM-SETUP.md` — edge VM
- Operator confirmation session dumps → `trash/` (not living hubs)
