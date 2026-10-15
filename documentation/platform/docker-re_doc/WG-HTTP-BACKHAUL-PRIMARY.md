# WG HTTP backhaul (primary) + SSH reserve

**Status:** канон (2026-07-18).
**Scope:** публичный HTTP(S) путь `edge nginx → prod-core` для **app / API / auth / meet web / landing** (acceptance). Edge routes `power` / `dewa` → `.136` — **retired / not acceptance** (soft-retired apps → `trash/`).
**Не путать с:** Meet **медиа** UDP (`13400 → 10.77.77.2:34000`) — [MEET-MEDIA-UDP-NATIVE-PATH.md](MEET-MEDIA-UDP-NATIVE-PATH.md); mobile WG `10.88.88.0/24` — mobile private tunnel docs.

**Связанные:** [YANDEX-VM-SSH-TUNNEL.md](YANDEX-VM-SSH-TUNNEL.md) (SSH reserve + keys + fail2ban) · [EMPERY-EDGE-IP-OPERATIONS.md](EMPERY-EDGE-IP-OPERATIONS.md) · [PRODUCTION-TOPOLOGY-STATE.md](../PRODUCTION-TOPOLOGY-STATE.md) · модуль `docker/scripts/yandex-tunnel/wg-backhaul/`.

---

## Почему так

До 2026-07-18 публичный HTTP шёл через reverse-SSH (`stack-yandex-tunnel`, `-R` на `127.0.0.1` edge). Инцидент: edge **fail2ban** забанил домашний WAN egress → публичный TCP **22** = `Connection refused` → туннель не поднимался → nginx **502**, при том что API/SPA на `.111` были здоровы. Admin SSH через Meet WG (`10.77.77.1`) при этом жил.

**Решение:** тот же Meet WG mesh (`10.77.77.0/24`, UDP **51821**), который уже несёт JVB media, стал **primary HTTP backhaul**. Reverse-SSH **сохранён** как ручной резерв (compose/keys не удаляются). Silent auto-fallback на SSH **запрещён**.

---

## Путь данных (primary)

```text
Client HTTPS
  → edge nginx (93.77.165.185:443)
  → upstream 10.77.77.2:<pub>   (Meet WG, mode=wg)
  → prod-core user systemd socat
       eliteew-wg-tcp-proxy@<pub>
  → 127.0.0.1:<local>  (living remotes only; power/dewa → .136 retired)
```

Режим на edge: файл **`/etc/eliteew-backhaul-mode`** = `wg` | `ssh`.
Nginx подключает includes из `docker/host_conf/backhaul/`:

| Mode | Upstreams file on edge | Meet set |
|------|------------------------|----------|
| `wg` | `eliteew-backhaul-upstreams-wg.inc` → `10.77.77.2:*` | `eliteew-meet-upstream-set-wg.inc` |
| `ssh` | `eliteew-backhaul-upstreams-ssh.inc` → `127.0.0.1:*` | `eliteew-meet-upstream-set-ssh.inc` |

Vhosts (`nginx-app-https-vm-mkcert.conf`, `nginx-auth-vm-mkcert.conf`, `nginx-root-landing.conf`) используют **именованные** upstreams (`eliteew_app_upstream`, …), а не захардкоженный `127.0.0.1`.

---

## Портовая карта (prod-core proxies)

Установка: `install-prodcore-tcp-proxy.sh` — bind только на **`10.77.77.2`** (не `0.0.0.0`).

| Pub on WG | Target | Назначение |
|-----------|--------|------------|
| 29001 | `127.0.0.1:29001` | `app.eliteew.ru` SPA |
| 29000 | `127.0.0.1:29000` | API / sites gateway |
| 29002 | `127.0.0.1:29002` | landing `eliteew.ru` |
| 36000 | `127.0.0.1:36000` | Keycloak via edge `auth` |
| 13402 | `127.0.0.1:34002` | Meet web (Jitsi) |
| 29173 | `192.168.1.136:4173` | **Retired residual proxy only** — was `power.eliteew.ru`; **not** acceptance; edge hostname returns **410** |
| 29180 | `127.0.0.1:29180` | Mobile OTA (`stack-mobile-release` on prod-core). **Not** `dewa.eliteew.ru` (edge `dewa`/`power` → **410**) |

Do **not** wire edge hostnames `power`/`dewa` to any backhaul upstream. `29180` stays for Mobile OTA health over WG; optional leftover `29173` is not part of edge nginx. Отдельный WG peer command-center (`10.77.77.3`) **не требуется**. Скрипт `install-cc-wg-peer.sh` — опциональный запасной путь, не часть baseline.

### Firewall (prod-core)

`eliteew-wg-tcp-proxy@*` binds **only** on `10.77.77.2`. On FedoraServer allowlist, traffic from edge `10.77.77.1` must be explicitly accepted for the pub TCP ports above (and `wg0` should sit in the same zone). Harden owner: `docker/scripts/prod-core/harden-prod-core-host.sh` + [PROD-CORE-HOST-HARDEN.md](../PROD-CORE-HOST-HARDEN.md). Symptom if missing: edge `curl http://10.77.77.2:29001/` → **No route to host**, public HTTPS **502**, while `127.0.0.1:29000/29001` stay healthy.

Meet **медиа** UDP остаётся: edge relay `13400` → `10.77.77.2:34000` (не через эти TCP proxies).

---

## Хосты WG

| Host | Interface / IP | Role |
|------|----------------|------|
| edge | `wg-meet-edge` `10.77.77.1` | WG server; nginx upstreams |
| prod-core | host `wg0` `10.77.77.2` | TCP proxies + JVB UDP target |
| command-center `.136` | LAN only (baseline) | builds / ComfyUI; **not** living power/dewa targets |

Mobile `wg-mobile` / `10.88.88` — другой контур, не трогать при backhaul работах.

---

## Операторские команды

Все с **command-center** (репо на `.136`, SSH к `.111` / edge).

### Verify

```bash
bash docker/scripts/yandex-tunnel/wg-backhaul/verify-wg-backhaul.sh
bash docker/scripts/yandex-tunnel/wg-backhaul/verify-wg-backhaul.sh --json
```

Один SSH на prod-core (addr/rtt/handshake/proxies) + один на edge + public curls.
Ожидание: `PASS` по `wg0`, proxies, `edge→10.77.77.2:29001`, public app/landing/auth.

### Tunables (MTU + keepalive)

```bash
# From command-center as owned — NEVER wrap with sudo (root SSH → Host key verification failed):
bash docker/scripts/yandex-tunnel/wg-backhaul/ensure-wg0-tunables.sh
# Script SSHs with -tt and prompts sudo on prod-core. If TTY still broken:
#   ssh -t owned@192.168.1.111
#   # then on prod-core (paste or scp the script):
#   bash ensure-wg0-tunables.sh --local
```

Template client: `meet-edge-wg/render-configs-reversed.sh` → `MTU = 1280`, `PersistentKeepalive = 25`.

### Continuous monitor

`access-gate-logwatch` (WG pill / `GET /api/wg-backhaul`) is **soft-retired → `trash/`**. Living regression: `verify-wg-backhaul.sh` (+ optional cron/timer if operator installs one). Do not resurrect logwatch for acceptance.

### Edge clock fallback over authenticated WG

Yandex SG may block outbound UDP/123. In that state `systemd-timesyncd` remains active but reports `NTPSynchronized=no`, edge nginx emits a stale `Date`, and Keycloak DPoP requests can fail with `lifespanInSeconds must be positive`.

Living fallback uses the fixed prod-core frontend endpoint `http://10.77.77.2:29001/app-build-version.txt` over `wg-meet-edge`; it never trusts a public HTTP time source:

```bash
bash docker/scripts/yandex-tunnel/wg-backhaul/install-edge-time-sync.sh
```

The root-only oneshot gets only `CAP_SYS_TIME`, accepts network traffic only to `10.77.77.2/32`, rejects corrections over 120 seconds, and leaves the clock unchanged on invalid/unreachable input. Timer interval is 60 seconds. If native NTP becomes synchronized, the fallback skips every adjustment automatically. Disable rollback without deleting files:

```bash
ssh eliteew-edge@93.77.165.185 \
  'sudo systemctl disable --now eliteew-edge-time-sync.timer'
```

### Переключение режима (только вручную)

```bash
# Резерв: поднять stack-yandex-tunnel + nginx ssh upstreams
bash docker/scripts/yandex-tunnel/wg-backhaul/activate-backhaul.sh ssh

# Primary: proxies + nginx wg; tunnel container stop (compose не удаляется)
bash docker/scripts/yandex-tunnel/wg-backhaul/activate-backhaul.sh wg
```

### Первичная / remount установка

```bash
# На prod-core (или через activate/deploy):
bash docker/scripts/yandex-tunnel/wg-backhaul/install-prodcore-tcp-proxy.sh

# Edge nginx flip + mode file:
bash docker/scripts/yandex-tunnel/wg-backhaul/deploy-edge-backhaul.sh wg
```

---

## Runtime guard

`yandex-tunnel-runtime-guard.sh` (timer):

1. Всегда sync **динамического WAN** в fail2ban `ignoreip` (admin SSH предпочтительно через `10.77.77.1`).
2. Если tunnel container **остановлен**, но WG proxy `29001` + `http://10.77.77.2:29001/` OK → **OK** (не revive SSH).
3. При outage предпочитает **reinstall/restart WG proxies**; **не** делает silent fallback на SSH reserve.

SSH reserve поднимается только оператором через `activate-backhaul.sh ssh`.

---

## Failure / Edge-Case Matrix

| Axis | Behavior |
|------|----------|
| **Offline-mode** | WG down / proxies dead → public 502; guard пытается чинить proxies; SSH не поднимается сам. Clock fallback logs `wg_source_unreachable`, does not alter time, and retries on the next timer tick. |
| **Dual-flag / conflict** | Одновременно живые SSH `-R` и WG mode nginx → путаница портов на edge `127.0.0.1`. Канон: mode file один; в `wg` tunnel **parked**; в `ssh` nginx смотрит на `127.0.0.1`. For time, synchronized native NTP always wins and the WG fallback skips. |
| **Permission / access** | Proxies — **user** systemd на prod-core (`loginctl enable-linger`); edge nginx/mode — admin SSH `eliteew-edge`. Clock fallback is root-only, bounded to `CAP_SYS_TIME` + `10.77.77.2/32`; no public NTP port is opened. TCP **22** on edge remains for reserve/admin. |
| **Regression** | `verify-wg-backhaul.sh` + public app health; `bash docker/scripts/yandex-tunnel/wg-backhaul/edge-time-sync-from-prod.sh --selftest`; on edge, timer active and `sudo /usr/local/libexec/eliteew-edge-time-sync-from-prod --check` reports delta within one second. |

---

## Troubleshooting

| Symptom | First check | Fix |
|---------|-------------|-----|
| Public 502, local `.111` health OK | `verify-wg-backhaul.sh`; edge mode; `systemctl --user status eliteew-wg-tcp-proxy@29001` | Restart proxies; `deploy-edge-backhaul.sh wg` |
| `meet.eliteew.ru/config.js` 502, app/auth OK; proxy `@13402` active; stack11 containers **healthy** | `curl -sf http://127.0.0.1:34002/config.js` on prod-core; `ss -lnt \| rg 34002` | Rootless Podman **host publish** died while container stayed Up. Recreate publish: `podman compose -f docker/stack/stack11.yml --env-file $ELITEEW_ENV_RUNTIME_DIR/.env.stack11 up -d --force-recreate --no-deps meet-jwt-gate` (and `jvb` if `*:34000/udp` missing). Then `apply-stack11-jvb-ice-static-mappings.sh`. Do **not** flip backhaul mode first. |
| `edge→10.77.77.2` fail | `wg show` handshake on edge + `.111` | Meet WG install/runbooks; SG UDP **51821** |
| Native PAR/token intermittently returns `500 unknown_error`; Keycloak logs `lifespanInSeconds must be positive` | Compare prod-core epoch with edge epoch; `timedatectl show -p NTPSynchronized`; check `eliteew-edge-time-sync.timer` | Install/restart the WG clock fallback. Never disable DPoP or its replay cache. |
| Admin SSH public 22 refused | fail2ban ban home WAN | SSH via `10.77.77.1`; guard WAN ignoreip; unban |
| `power` / `dewa` 502 or `000` | **Expected after soft-retire** — not living acceptance | Do not restore DEWA/EWPower without explicit restore-from-`trash/` task |
| Landing 502 | `.111:29002` / landing container | Landing autostart runbook; proxy 29002 already mapped |
| Need SSH path urgently | — | `activate-backhaul.sh ssh` then smoke app health |

Keys (не коммитить секреты): admin `~/.ssh/sgbot-deploy/ssh-key-sg-bot` (`eliteew-edge`); tunnel user `keys/yandex_tunnel_key` — только для reserve.

---

## Security Group (edge) — checklist after WG HTTP primary

| Port | Keep? | Notes |
|------|-------|-------|
| TCP 22 /32 home WAN | **Yes** | SSH reserve + admin; update `/32` when ISP rotates |
| UDP 51821 /32 peers | **Yes** | Meet WG = media + HTTP backhaul |
| TCP 443 managed `/32` | **Yes** | managed allowlist (historical access-gate / ip-verif soft-retired → `trash/`; do not resurrect without ТЗ) |
| UDP 13400 (+ TCP 13401) | **Yes** if Meet public | JVB relay |
| Do not | — | Close 22 «because tunnel parked»; open 51821 to `0.0.0.0/0` without decision |

Console if `yc` broken: VPC → Security groups. Canon setup table: [YANDEX-EDGE-VM-SETUP.md](YANDEX-EDGE-VM-SETUP.md).

---

## Файлы модуля

| Path | Role |
|------|------|
| `docker/scripts/yandex-tunnel/wg-backhaul/install-prodcore-tcp-proxy.sh` | user systemd socat map |
| `docker/scripts/yandex-tunnel/wg-backhaul/deploy-edge-backhaul.sh` | upload includes + mode + nginx reload |
| `docker/scripts/yandex-tunnel/wg-backhaul/activate-backhaul.sh` | operator `wg` \| `ssh` |
| `docker/scripts/yandex-tunnel/wg-backhaul/verify-wg-backhaul.sh` | PASS/FAIL (+ `--json`) smoke |
| `docker/scripts/yandex-tunnel/wg-backhaul/ensure-wg0-tunables.sh` | MTU + PersistentKeepalive on live `wg0` |
| `docker/scripts/yandex-tunnel/wg-backhaul/install-cc-wg-peer.sh` | optional CC peer (not baseline) |
| `docker/scripts/yandex-tunnel/wg-backhaul/install-edge-time-sync.sh` | installs root-only systemd timer on edge |
| `docker/scripts/yandex-tunnel/wg-backhaul/edge-time-sync-from-prod.sh` | bounded fixed-source WG clock sync + selftest |
| `docker/host_conf/backhaul/*.inc` | nginx upstreams + meet set |
| `docker/scripts/yandex-tunnel/yandex-tunnel-runtime-guard.sh` | WG-aware guard |
| `access-gate-logwatch` (`wg_backhaul.py`) | **Retired → `trash/`** — not living monitor |
