# Meet media — UDP-native (канон скриптов)

**Документация:** `documentation/platform/docker-re_doc/MEET-MEDIA-UDP-NATIVE-PATH.md` · methodology `JITSI-MEDIA-INCIDENT-2026-05-28.md`

## Архитектура (рабочая, 2026-05-21)

Дом **без** статического WAN / без проброса на MikroTik:

```text
Клиент Meet ──UDP──► edge 93.77.165.185:13400
                    kernel NAT (DNAT + MASQUERADE)
                    └──► WG ──► 10.77.77.2:34000 (JVB на punisher)

Сигналинг meet / App (HTTPS) ──► WG backhaul `10.77.77.2:13402|29001` (primary);
                                SSH `-R` = manual reserve (`wg-backhaul/activate-backhaul.sh`)

Punisher ──исходящий WG──► edge :51821
         (host wg-quick@wg0; rootless Podman для wg0 не использовать)
```

**Критично:** relay на edge шлёт на **`10.77.77.2:34000`**. LAN target
`192.168.1.136:34000` через edge WG даёт `No route to host` и обрывы звонка.
Userland `socat` с `fork` для RTP не использовать: живой звонок упирается в
`Too many open files`; продовый relay — kernel NAT rules в systemd service.
На punisher firewalld должен пропускать только `10.77.77.1 → udp/34000`;
иначе edge видит `ICMP admin prohibited filter` от `10.77.77.2`.

## Быстрый старт

С **punisher** (репозиторий + Docker + SSH к edge):

```bash
cd /path/to/powered_by_emperyworld
bash run-meet-media-install.sh
```

Или:

```bash
bash docker/scripts/yandex-tunnel/meet-edge-wg/install-meet-media.sh
```

Проверка:

```bash
bash docker/scripts/yandex-tunnel/meet-edge-wg/verify-meet-media.sh
```

## Скрипты

| Скрипт | Назначение |
|--------|------------|
| **`install-meet-media.sh`** | Развёртывание (канон) |
| **`install-host-wg-client.sh`** | Host/rootful WG-клиент `wg0` на punisher через `wg-quick@wg0` |
| **`verify-meet-media.sh`** | PASS/FAIL проверка всех слоёв |
| **`meet-media-runtime-guard.sh`** | Drift guard: чинит JVB ICE mapping и гасит legacy `meet-edge-wg` |
| **`install-meet-media-runtime-guard.sh`** | Установка systemd guard (`service+timer`, scope auto/system/user) |
| **`../yandex-tunnel-runtime-guard.sh`** | Auto-remediation zombie `-R` / recreate `stack-yandex-tunnel` + edge UDP relay |
| **`../install-yandex-tunnel-runtime-guard.sh`** | Timer для tunnel guard (каждые 2 мин) |
| **`../check-open-video-calls.sh`** | Open `ringing`/`active` rows in `video_calls` |
| **`fix-meet-media-path.sh`** | Починка relay→136 + WG host network (если ставили раннюю версию) |
| **`rollback-meet-media-udp.sh`** | Откат на TCP-relay (13400/SSH), остановка UDP-native |
| `render-configs-reversed.sh` | Генерация `docker/data/meet-edge-wg/*.conf` |
| `deploy-edge-wg-server.sh` | WG-сервер на edge VM |
| `deploy-home-wg-client-to-edge.sh` | Legacy rootless container WG-клиент; не использовать для prod quality |
| `deploy-jvb-media-relay-udp-wg-on-vm.sh` | Relay на edge (в `../`) |
| `mikrotik-fix-meet-wg.sh` | Только если WAN **статический** и нужен NAT на дом (устарело для CGNAT) |

## Rootless Podman caveat

UDP-native требует host-интерфейс **`wg0`** на punisher. Rootless Podman с
`network_mode: host` может показывать контейнер `meet-edge-wg` как `Up`, но не иметь
прав создать `wg0`:

```text
wg-quick: not found
RTNETLINK answers: Operation not permitted
```

В этом состоянии `verify-meet-media.sh` падает по `wg0`/handshake, а рабочим
остаётся только TCP-relay с сильными лагами. Для прод-медиа запускайте:

```bash
bash docker/scripts/yandex-tunnel/meet-edge-wg/install-host-wg-client.sh
```

Скрипт требует root/sudo, копирует `home-wg-client.conf` в `/etc/wireguard/wg0.conf`
и включает `wg-quick@wg0`. Если firewalld активен, он также добавляет правило
`10.77.77.1/32 → udp/34000` для JVB media.

## Автоконтроль drift (systemd guard)

Чтобы автоматически лечить повторяющийся drift `stack11` (сломанный `jvb.conf`
mapping `#13400` и/или запущенный legacy `meet-edge-wg`), установите timer:

```bash
bash docker/scripts/yandex-tunnel/meet-edge-wg/install-meet-media-runtime-guard.sh auto
```

`auto` выбирает:
- `system` scope, если есть root/non-interactive sudo (умеет авто-чинить firewalld);
- иначе `user` scope (чинит JVB mapping + legacy container; firewall только проверяет).

Полный system scope вручную:

```bash
sudo bash docker/scripts/yandex-tunnel/meet-edge-wg/install-meet-media-runtime-guard.sh system
```

Проверка:

```bash
systemctl --user status eliteew-meet-media-guard.timer
```

Лог guard: `docker/data/meet-edge-wg/runtime-guard.log`.

## Yandex Cloud Security Group (edge VM)

Inbound на **eliteew-edge** (`93.77.165.185`):

| Порт | Протокол | Назначение |
|------|----------|------------|
| 51821 | UDP | WireGuard |
| 13400 | UDP | Meet RTP (публичный ICE) |
| 22 | TCP | SSH админ (уже есть) |

## Логи и данные

| Путь | Содержимое |
|------|------------|
| `docker/data/meet-edge-wg/install-*.log` | Установка |
| `docker/data/meet-edge-wg/verify-*.log` | Проверка |
| `docker/data/meet-edge-wg/edge-wg-server.conf` | WG server (edge) |
| `docker/data/meet-edge-wg/home-wg-client.conf` | WG client (punisher) |
| `docker/scripts/yandex-tunnel/keys/meet-edge-wg/` | Ключи (не в git) |
| `docker/logs/stack11/jvb/jvb.log` | ICE / RTP |

## Smoke после установки

1. `bash docker/scripts/yandex-tunnel/meet-edge-wg/verify-meet-media.sh` — все **PASS**.
2. **Новая** комната Meet, 60 с только аудио.
3. JVB: `ICE connected`, `Selected pair … 93.77.165.185:13400/udp/srflx`.
4. Edge tcpdump: обратный UDP идёт `10.77.77.2:34000 -> 10.77.77.1:<client-port>`, без `admin prohibited filter`.

## Откат

```bash
bash docker/scripts/yandex-tunnel/meet-edge-wg/rollback-meet-media-udp.sh
```

Восстанавливает TCP-relay на edge (`eliteew-jvb-media-relay`). Качество голоса снова как на UDP-over-SSH.

## Устаревшее (не использовать при CGNAT)

- `deploy-home-docker.sh` — WG-сервер на punisher + NAT `31.x`
- `deploy-edge-client.sh` — edge → динамический WAN
- Канарейка ICE **13410** без рабочего WG
