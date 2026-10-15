# Edge-VM, туннель и auto-IP (операторский runbook)

Публичный периметр EliteEW (канон топологии: [PRODUCTION-TOPOLOGY-STATE.md](../PRODUCTION-TOPOLOGY-STATE.md) §Current):

| Узел | Роль |
|------|------|
| **edge-VM** `93.77.165.185` | Публичный nginx + TLS; Meet WG server; media relay |
| **prod-core** `.111` | Public runtime (stack0/1/6/11/12, proxies на `127.0.0.1`) — **не** build-хост |
| **command-center** `.136` | Builds, env staging, ComfyUI `:31003`; не публичный app runtime |
| **gpu141** `.141` | Remote embed/rerank/tool-router |

**HTTP path (primary, 2026-07-18):** edge nginx → Meet WG `10.77.77.2` → prod-core host TCP proxies. Канон: [WG-HTTP-BACKHAUL-PRIMARY.md](WG-HTTP-BACKHAUL-PRIMARY.md).  
**SSH reverse tunnel** (`stack-yandex-tunnel`, `-R` на `127.0.0.1`) — **manual reserve** only; silent auto-fallback запрещён.

**Модель доступа (prod):**

- SG edge **закрыта по умолчанию** (нет входа «со всего интернета»).
- Ingress HTTPS **443** и медиа-порты Meet — managed `/32` (access-gate / historical ip-verif reconciler; дерево `tg_bot_ip_verif/` soft-retired → `trash/` — восстанавливать только по явной задаче оператора).
- Единственное pre-license исключение — Air enrollment: один TCP-порт `62200–63200` временно открыт из `0.0.0.0/0` в отдельной `eliteew_air_enroll_security_group` и отображается только на изолированный WebSocket ingress. Baseline SG и `443` не расширяются.
- Медиа: [JITSI-MEET-YANDEX-REVERSE-TUNNEL.md](JITSI-MEET-YANDEX-REVERSE-TUNNEL.md).

Контейнерный аудит compose: [CONTAINER-SECURITY-THREAT-MODEL.md](CONTAINER-SECURITY-THREAT-MODEL.md).

Связанные документы:

- Создание edge: [YANDEX-EDGE-VM-SETUP.md](YANDEX-EDGE-VM-SETUP.md)
- SSH reserve / ключи / nginx deploy: [YANDEX-VM-SSH-TUNNEL.md](YANDEX-VM-SSH-TUNNEL.md)
- LAN workers: [LAN-WORKERS-141.md](LAN-WORKERS-141.md)
- Internal DNS / sites: [INTERNAL-SITES-ACCESS.md](INTERNAL-SITES-ACCESS.md)

## Интерактивное меню (канон)

Из корня монорепозитория:

```bash
bash docker/scripts/yandex-tunnel/empery-edge-ip-menu.sh
```

Пункты: сводка DNS/curl, cutover IP, туннель, аудит SG, мастер auto-IP, подменю `manage-remote-bot`, починка LAN 502.

Цветной мониторинг edge/tunnel и безопасности:

```bash
bash docker/scripts/yandex-tunnel/yandex-tunnel-security-monitor.sh
```

После `source docker/scripts/eliteew-docker-aliases.sh` короткие команды:

```bash
eetunnel report 200       # полный отчёт: local tunnel + remote edge
eetunnel suspicious 120   # быстрый grep подозрительных tunnel/nginx/auth логов
eetunnel fail2ban-status  # статус jail на edge
```

## Инвариант: весь `*.eliteew.ru` — только edge → prod-core

Публичные имена (`app`, `auth`, `admin`, `meet`, `*-site.eliteew.ru`, …) для клиентов:

`DNS → IP edge-VM` → **nginx на edge** → **Meet WG `10.77.77.2:<порт>`** (primary) → сервис на **prod-core** `127.0.0.1`.  
SSH reserve: edge `127.0.0.1:<порт>` ← `-R` с prod-core (когда `/etc/eliteew-backhaul-mode=ssh`).

| Имя | Порт на prod-core (localhost) | Edge upstream (WG / SSH `-R`) |
|-----|------------------------------|-------------------------------|
| `app.eliteew.ru` | 29001 (фронт) | 29001 |
| `auth.eliteew.ru` | 36000 (Keycloak proxy) | 36000 |
| `meet.eliteew.ru` | 34002 (Jitsi web / jwt-gate) | 13402 |
| `*-site.eliteew.ru` / Site Studio gateway | 29000 | 29000 |

Дополнительный **trusted desktop** путь (не публичный allowlist 443): WireGuard **`wg-portal`** UDP **51823**, tunnel IP `10.88.89.1`, split DNS `dnsmasq-portal` — [PORTAL-PRIVATE-TUNNEL-EDGE.md](PORTAL-PRIVATE-TUNNEL-EDGE.md). Не путать с mobile `51822` / Meet `51821`.

Запрещено:

- Исторический **stack666** LAN HTTPS на command-center — **retired → `trash/`** (не поднимать);
- публикация `29001` / `29000` / `36000` / `34002` на `0.0.0.0` на prod-core; **prod API:** `API_BIND_ADDRESS=127.0.0.1` ([SECURITY.md](SECURITY.md), [CONTAINER-SECURITY-THREAT-MODEL.md](CONTAINER-SECURITY-THREAT-MODEL.md));
- internal DNS / зона `sites` → LAN IP command-center `.136` (только **IP edge**);
- произвольные `/etc/hosts` для `*.eliteew.ru` не на edge IP.

Локальная отладка на prod-core / command-center — `http://127.0.0.1:<порт>`, не HTTPS по имени на LAN IP.

## Безопасность: валидация, не только запись

`/etc/hosts` и resolved **не являются криптографической защитой**. Закрытие обхода:

1. **Не слушать** LAN `:443` под `*.eliteew.ru` на `.136`/`.111` — stack666 retired; HTTPS только через edge.
2. **firewalld** — `block-lan-empery-https-firewalld.sh` отклоняет HTTP/HTTPS на LAN IP с частных подсетей.
3. **Периодическая проверка** — `validate-empery-tunnel-security.sh` (DNS, hosts, порты, backhaul).
4. **CSP публичного app** — без private LAN IP в HTML; living Comfy на gpu141 `.141:31003` доступен только из доверенного LAN — [LAN-WORKERS-141.md](LAN-WORKERS-141.md).

Установка resolver guard (один раз на host, переживает reboot):

```bash
sudo bash docker/scripts/internal-sites/configure-host-resolver-empery-tunnel.sh
```

Включает resolved + hosts, firewalld, гарантирует отсутствие LAN HTTPS bypass (stack666 already retired), ставит timer **`empery-tunnel-dns-guard.timer`**.

Ручная проверка:

```bash
sudo bash docker/scripts/internal-sites/validate-empery-tunnel-security.sh
# exit 0 — OK; exit 1 — подмена DNS/hosts или LAN HTTPS открыт
```

Канонический edge IP — **`YANDEX_VM_IP`** в `docker/env_file/.env.yandex-tunnel`.

## Топология узлов (кратко)

| Узел | Роль |
|------|------|
| **edge** | nginx `:443`, Meet WG, JVB media relay; публичный IP — **`YANDEX_VM_IP`** |
| **prod-core `.111`** | Public runtime; app binds `127.0.0.1`; WG peer `10.77.77.2` |
| **command-center `.136`** | Builds / env / ComfyUI; **нет** публичного app runtime; stack666 retired |
| **gpu141 `.141`** | Remote inference + living ComfyUI `:31003` — [LAN-WORKERS-141.md](LAN-WORKERS-141.md) |

DNS публично: `app` / `auth` / `meet` → **IP edge**.

## Auto-IP / SG managed rules

SG managed `/32` для пользовательского HTTPS — operational control plane (исторически Telegram ip-verif; дерево soft-retired → `trash/`). Живой аудит правил:

```bash
bash docker/scripts/yandex-tunnel/audit-sg-managed-rules.sh
bash docker/scripts/yandex-tunnel/empery-edge-ip-menu.sh
```

Не документировать resurrect OpenVPN AS / stack666 как путь доступа.

### Air enrollment SG and local ingress

Air enrollment has a separate control plane and never shares per-session mutations with `empery_world_security_group`.

| Layer | Contract |
|-------|----------|
| Yandex SG | Dedicated `eliteew_air_enroll_security_group`, attached only to canonical edge NIC; one exact TCP port/rule/session; source `0.0.0.0/0`; serialized REST LRO + `ACTIVE` read-back |
| Host routing | Timed nftables set of active public ports redirects to isolated local TLS **`:39443`**; direct public access to that listener is denied |
| nginx | Exact `/api/v1/desktop-client/air-enroll/ws` WebSocket only on `:39443`; primary upstream `10.77.77.2:29000`, SSH reserve `127.0.0.1:29000`; all other methods/paths denied. Normal `:443` app vhost returns **404** for that exact path |
| Control | Dedicated forced-command SSH account (`eliteew-air-enroll@10.77.77.1`) accepts only typed `open`, `close`, `reconcile`, `preflight`; source must be prod-core Meet WG `10.77.77.2`. Keep that peer in fail2ban `sshd` `ignoreip` |
| Cleanup | DB key dead → nft route removed → exact stored SG rule deleted/read back; kernel timeout + edge watchdog + API beat reconcile orphans |
| Overlap audit | Union of **all** NIC SGs must not already permit TCP `62200–63200` or local ingress `39443` from the audited sources; carve home-WAN ANY-port baseline rules before enablement |

Operational capacity is the live free-rule count, not the 1001-port allocation range. Every enable/preflight audits all SGs attached to the NIC so an overlapping rule cannot silently keep a port open. Cleanup failure is reported as `cleanup_degraded`, never as closed.

Empery live (2026-09-10): dedicated SG `enps2f4cdegi3hmttnmr` attached with baseline; edge SA **`bot-sb`** (folder operator) drives rule PATCH; control path verified `preflight` → `status=ready` over WG.

Tooling lives under `docker/scripts/yandex-tunnel/air-enroll/`: SG preparation is read-only unless `--apply --yes`; edge installation verifies the normal `443` deny, TLS pair, backhaul mode, nft gate, attached service account, dedicated-SG attachment/capacity and exact REST read-back before reporting ready.

Product and protocol SoT: [DESKTOP-CLIENT-AIR-ENROLL.md](../../product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md).

## Смена публичного IP edge

1. Создать/получить новую edge-VM со **статическим** IP ([YANDEX-EDGE-VM-SETUP.md](YANDEX-EDGE-VM-SETUP.md)).
2. С **command-center** (или host, где лежит clone + keys):

   ```bash
   bash docker/scripts/yandex-tunnel/migrate-to-new-edge.sh '<NEW_IP>'
   # SSH reserve recreate только если нужен reserve path:
   bash docker/scripts/yandex-tunnel/compose-up.sh up -d --force-recreate
   bash docker/scripts/yandex-tunnel/check-yandex-tunnel.sh
   ```

3. TLS/nginx на edge: `sync-mkcert-certs-to-yandex-vm.sh`, `deploy-nginx-app-to-vm.sh`, `deploy-nginx-auth-to-vm.sh`.
4. Meet WG peer/IP sync — [WG-HTTP-BACKHAUL-PRIMARY.md](WG-HTTP-BACKHAUL-PRIMARY.md).
5. DNS: A `app`, `auth`, `meet` → `<NEW_IP>`.
6. Смоук: `bash docker/scripts/yandex-tunnel/dns-cutover-smoke.sh '<NEW_IP>'`.

Или пункт cutover в `empery-edge-ip-menu.sh`.

## 502 на `app.eliteew.ru`

| Симптом | Причина | Действие |
|---------|---------|----------|
| 502 с интернета, DNS указывает на **старый** edge | Cutover не завершён | Обновить A-записи на актуальный `YANDEX_VM_IP`; снять nginx на старой VM |
| Текст «use edge VM + SSH tunnel» / HTML «Неверный DNS» | Браузер открыл **LAN IP**, не edge | `resolvectl query app.eliteew.ru`; `sudo bash docker/scripts/internal-sites/configure-host-resolver-empery-tunnel.sh`, затем F5 |
| Попали на LAN IP command-center `:443` | не канон (stack666 retired) | DNS → edge IP (`dig @<public-resolver> app.eliteew.ru`) |
| 502 при `backhaul=wg` | Meet WG / host proxy на prod-core | [WG-HTTP-BACKHAUL-PRIMARY.md](WG-HTTP-BACKHAUL-PRIMARY.md) verify; `curl` к `10.77.77.2:29001` с edge |
| 502 на `*-site.eliteew.ru` (SSH reserve mode) | Нет `-R 29000` | `stack-yandex-tunnel.yml` + recreate reserve tunnel |
| 200 на `--resolve app:443:<EDGE_IP>`, 502 в браузере | Кэш DNS / другой резолвер | `dig @<public-resolver>`, сброс кэша |

Публичный edge при живом туннеле (IP из `dig`):

```bash
APP="$(dig @8.8.8.8 +short app.eliteew.ru A | head -1)"
curl -sS -o /dev/null -w '%{http_code}\n' --resolve "app.eliteew.ru:443:${APP}" https://app.eliteew.ru/health
```

Ожидание: **200**.

## Туннель: порты reverse SSH

| Порт на edge | Назначение |
|--------------|------------|
| 29001 | `app.eliteew.ru` (фронт) |
| 29000 | `*.sites.eliteew.ru` (API gateway) |
| 36000 | вспомогательный |
| 13402 | Meet HTTP |
| 13400 / 13401 | JVB media |

Конфиг: `docker/stack/stack-yandex-tunnel.yml`, env: `docker/env_file/.env.yandex-tunnel`.

## Мониторинг

- **WG primary HTTP backhaul** — канон: [WG-HTTP-BACKHAUL-PRIMARY.md](WG-HTTP-BACKHAUL-PRIMARY.md). Модуль `docker/scripts/yandex-tunnel/wg-backhaul/`: nginx → `10.77.77.2` через Meet WG; SSH tunnel = ручной резерв (`activate-backhaul.sh ssh|wg`). Verify: `wg-backhaul/verify-wg-backhaul.sh`.
- Туннель (только SSH reserve mode): `bash docker/scripts/yandex-tunnel/check-yandex-tunnel.sh` (автовыбор `podman`/`docker`; Meet `/` может вернуть `403` от JWT-gate без `jwt`)
- Цветной мониторинг + security audit: `bash docker/scripts/yandex-tunnel/yandex-tunnel-security-monitor.sh report 200`
- Traffic / hostile-IP окно (с CC через Meet WG + ProxyJump `prod-core`): `bash docker/scripts/yandex-tunnel/audit-edge-traffic-last-hour.sh`
- fail2ban на edge: `bash docker/scripts/yandex-tunnel/yandex-tunnel-security-monitor.sh install-fail2ban` (интерактивное подтверждение `YES`; ставит jail `sshd`, `nginx-http-auth`, `nginx-botsearch` если фильтр есть).  
  С command-center публичный `:22` часто закрыт SG (home-WAN only) — для remote-команд: `YANDEX_VM_IP=10.77.77.1 YANDEX_EDGE_SSH_PROXYJUMP=prod-core`.
- Cron-пример: `docker/scripts/yandex-tunnel/cron-check-tunnel.example`
- SG audit: `bash docker/scripts/yandex-tunnel/audit-sg-managed-rules.sh`

Если edge SG закрывает исходящий TCP/80, установка пакетов через стандартные `http://` apt mirrors будет зависать. Мониторинг при установке fail2ban переводит стандартные Ubuntu/Yandex apt sources на `https://` с резервной копией `*.eliteew-http-to-https.bak`, чтобы работать при исходящем TCP/443-only.

## Дальше: LAN workers `.141`

См. [LAN-WORKERS-141.md](LAN-WORKERS-141.md) — remote embed/rerank/tool-router; firewalld/nftables **prod-core ↔ gpu141**. Edge и SG к placement inference не привязаны.
