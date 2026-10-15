# Yandex Cloud: создание edge-VM (новый аккаунт / новый IP)

Операторский канон для миграции публичного периметра EliteEW. Связанные документы:

- Обратный SSH и nginx: [YANDEX-VM-SSH-TUNNEL.md](YANDEX-VM-SSH-TUNNEL.md)
- Meet/JVB: [JITSI-MEET-YANDEX-REVERSE-TUNNEL.md](JITSI-MEET-YANDEX-REVERSE-TUNNEL.md)
- LAN workers на `192.168.1.141`: [LAN-WORKERS-141.md](LAN-WORKERS-141.md)

## Параметры ВМ

| Параметр | Значение |
|----------|----------|
| Имя | `eliteew-edge` |
| Платформа | `standard-v3` |
| vCPU / RAM | 2 / 4 GB |
| Диск | 20 GB `network-ssd` |
| ОС | **Ubuntu 22.04 LTS** |
| Публичный IP | **Статический** (новый; DNS `app` / `auth` / `meet` → этот IP) |

## Baseline Security Group `empery_world_security_group`

Создать в том же **folder**, что и ВМ. После cutover HTTP backhaul на Meet WG (2026-07-18) канон портов не меняется: WG уже был нужен для медиа; теперь он же несёт HTTP к `10.77.77.2`. Полный HTTP-путь: [WG-HTTP-BACKHAUL-PRIMARY.md](WG-HTTP-BACKHAUL-PRIMARY.md).

| Направление | Правило | Зачем |
|-------------|---------|--------|
| Ingress | **TCP 22** — только текущий **домашний WAN `/32`** (не `0.0.0.0/0`) | Admin SSH + **SSH reserve** (`stack-yandex-tunnel`). WAN ротируется → обновляй `/32` в консоли или через ops; fail2ban ignoreip sync — отдельно на VM |
| Ingress | **UDP 51821** — с IP peer’ов Meet WG (обычно home / prod-core egress `/32`, не весь интернет) | Meet WG server на edge (`wg-meet-edge`). Без этого нет ни медиа, ни HTTP backhaul |
| Ingress | **TCP 443** (и при необходимости **TCP 80** для ACME) — **не** `0.0.0.0/0` в baseline; только managed `/32` (`empery_world_security_group:*`). Historical access-gate / ip-verif reconciler soft-retired → `trash/` — maintain `/32` via Console / `audit-sg-managed-rules.sh` | Пользовательский HTTPS |
| Ingress | **UDP 13400**, **TCP 13401** — если Meet с интернета (часто тоже managed `/32`) | JVB media relay |
| Egress | any (или минимум TCP 443) | apt/API; при egress TCP/80-block см. fail2ban apt https workaround |

**Не трогать из‑за WG-HTTP cutover:** не закрывай TCP 22 «раз туннель parked» — резерв и admin с home WAN всё ещё нужны. Не открывай UDP 51821 на `0.0.0.0/0` без отдельного решения.

**Если `yc` CLI на command-center сломан** (`decrypt iam token fail`) — правь SG в **Yandex Cloud Console** → VPC → Security groups → `empery_world_security_group`. Аудит managed-правил: `bash docker/scripts/yandex-tunnel/audit-sg-managed-rules.sh`.

## Сервисный аккаунт

1. SA: `eliteew-edge-bot`
2. Роль на folder: **`vpc.securityGroups.editor`** (минимально достаточно для reconciler бота)
3. **Привязать SA к edge-VM** (в настройках ВМ → сервисный аккаунт)

Бот на edge: `YC_CLIENT_MODE=rest` — ключи SA на диск не класть.

## Dedicated Security Group for Air enrollment

Air enrollment is a narrow exception to the baseline `/32` perimeter. Create a separate **`eliteew_air_enroll_security_group`** in the same folder/network and attach it only to the canonical edge NIC.

HARD invariants:

- never add per-session rules to `empery_world_security_group`;
- verify the interface has a free SG slot (Yandex limit: 5 groups/interface) and the dedicated group has free rule capacity (50 rules/group);
- audit the effective union of every attached SG; refuse enablement if another group permits TCP `62200–63200` **or** isolated local ingress TCP **`39443`** (nft maps public high ports → that local port);
- each live session owns exactly one ingress TCP port from `62200–63200`, source `0.0.0.0/0`, with a description containing only session UUID and expiry;
- mutations run on the edge through the **instance-attached** service account and Yandex REST (`YC_CLIENT_MODE=rest`). No IAM key file and no `yc` login are runtime dependencies. Empery live edge uses folder SA **`bot-sb`**; folder role **`operator`** is enough for `instances.get`, `GET` SG, and `PATCH …/securityGroups/{id}/rules` (LRO). One-time NIC attach of the dedicated SG is Console (or a higher compute role) — not a runtime controller path;
- the controller itself accepts only the configured dedicated SG ID and verifies that the SG is attached to no other NIC;
- serialize `updateRules` operations, wait for the LRO, require SG `ACTIVE`, and read back the exact rule ID before revealing a code;
- close by DB invalidation → nft port removal → exact SG rule deletion/read-back. Watchdog reconciliation removes only rules owned by Air enrollment;
- control SSH from prod-core Meet WG (`10.77.77.2` → edge `10.77.77.1`) must remain unbanned: fail2ban `sshd` jail should ignore `10.77.77.2` (drop-in under `/etc/fail2ban/jail.d/`). A ban presents as `connection refused` on WG SSH even when the key is correct.

The public high port maps through a timed nftables set to one isolated TLS/WebSocket nginx ingress on local **`:39443`**. It does not expose the normal app vhost or general API. Full contract: [DESKTOP-CLIENT-AIR-ENROLL.md](../../product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md).

### Baseline SG overlap (enablement pitfall)

Broad baseline rules such as **ANY TCP/UDP from a home WAN `/32`** cover **every** destination port, including Air ports and `39443`. Preflight / enablement must carve those destinations out of the baseline rule (or refuse) so only the dedicated Air SG grants `62200–63200` from `0.0.0.0/0`. Do not widen baseline to `0.0.0.0/0`.

### Empery live IDs (2026-09-10, folder of the edge VM)

| Object | Id / name |
|--------|-----------|
| Edge instance | `eliteew-edge` / `bg0ae402lpvm2rvrqab2` / `93.77.165.185` |
| Dedicated Air SG | `eliteew_air_enroll_security_group` / `enps2f4cdegi3hmttnmr` (also in `.env.yandex-tunnel`) |
| Baseline SG | `empery_world_security_group` / `enpgso5uj3j11qdom94q` |
| Control path | prod-core `eliteew-air-enroll@10.77.77.1` via Meet WG |

Implementation:

- read-only plan, then explicit SG create/attach: `docker/scripts/yandex-tunnel/air-enroll/prepare-air-enroll-security-group.sh` (`--apply --yes` preserves all existing NIC groups);
- edge install/preflight: `docker/scripts/yandex-tunnel/air-enroll/install-air-enroll-edge.sh`;
- runtime forced commands: `preflight`, typed `open`, typed `close`, and `reconcile`; the account key is accepted only from prod-core WG `10.77.77.2`.

## После создания ВМ

Из корня репозитория на **command-center** (keys/env staging; SSH reserve compose обычно на **prod-core**):

```bash
# 1) SSH-пользователи (консоль Yandex или add-tunnel-key-on-vm.sh)
bash docker/scripts/yandex-tunnel/vm-setup-all.sh

# 2) Записать IP
NEW_IP='<публичный_IP_edge>'
# docker/env_file/.env.yandex-tunnel → YANDEX_VM_IP=$NEW_IP
bash docker/scripts/yandex-tunnel/migrate-to-new-edge.sh "$NEW_IP"

# 3) SG managed rules — audit/menu; historical Telegram ip-verif tree soft-retired → trash/
# 4) TLS + nginx
bash docker/scripts/yandex-tunnel/sync-mkcert-certs-to-yandex-vm.sh
NGINX_APP_SITE_CONFIG="$PWD/docker/host_conf/nginx-app-https-vm-mkcert.conf" \
  bash docker/scripts/yandex-tunnel/deploy-nginx-app-to-vm.sh
bash docker/scripts/yandex-tunnel/deploy-nginx-auth-to-vm.sh
bash run-meet-media-install.sh   # UDP-native медиа (канон); Meet WG primary HTTP: WG-HTTP-BACKHAUL-PRIMARY.md

# 5) SSH reserve tunnel (manual) — на prod-core, если нужен reserve path
bash docker/scripts/yandex-tunnel/compose-up.sh up -d --force-recreate
bash docker/scripts/yandex-tunnel/check-yandex-tunnel.sh

# 6) DNS cutover (когда готово)
bash docker/scripts/yandex-tunnel/dns-cutover-smoke.sh "$NEW_IP"

# 7) Операторское меню (backhaul + SG + LAN)
bash docker/scripts/yandex-tunnel/empery-edge-ip-menu.sh
```

После cutover и появления трафика — канон эксплуатации: **[EMPERY-EDGE-IP-OPERATIONS.md](EMPERY-EDGE-IP-OPERATIONS.md)** (502, auto-IP, смена IP).

## Что не ставить на edge

- Docker-стеки EliteEW (API, Postgres, llama)
- `yc` CLI (не обязателен при `YC_CLIENT_MODE=rest` на **хосте бота**)
- Старые edge (`158.160.205.181` и др.) — снять DNS и nginx после cutover, иначе **502** на старом IP
