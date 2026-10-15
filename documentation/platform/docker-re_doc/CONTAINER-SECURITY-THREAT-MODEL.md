# Контейнерная безопасность: модель угроз и аудит compose

**Статус:** канон (2026-05-25).  
**Аудитория:** операторы Docker, DevSecOps, агенты Cursor.

Краткий канон после статического аудита `docker/stack/*.yml` и Dockerfile с учётом **фактического периметра EliteEW**: **prod-core `.111`** за NAT **без прямого WAN-входа**; публичный вход только через **edge-VM (Yandex) → Meet WG primary** (SSH reverse = manual reserve); ingress на edge закрыт security group (managed `/32`). Канон: [EMPERY-EDGE-IP-OPERATIONS.md](EMPERY-EDGE-IP-OPERATIONS.md), [WG-HTTP-BACKHAUL-PRIMARY.md](WG-HTTP-BACKHAUL-PRIMARY.md), [PRODUCTION-TOPOLOGY-STATE.md](../PRODUCTION-TOPOLOGY-STATE.md) §Current.

**Не дублирует:** переименование Redis-команд — [SECURITY.md](SECURITY.md); сети `ew_net_*` — [SEGMENTATION.md](SEGMENTATION.md).

---

## 1. Зоны доверия

| Зона | Что входит | Типичный противник |
|------|------------|-------------------|
| **Internet → edge** | HTTPS `:443`, медиа Meet на edge-VM | Клиент с IP в SG managed `/32` |
| **Edge → prod-core** | Meet WG `10.77.77.2` (primary) / SSH `-R` reserve → `127.0.0.1` (фронт, auth, meet gate, Site Studio gateway) | Компрометация edge nginx / WG / autossh / SG |
| **LAN** | prod-core ↔ gpu141 (embed/rerank/tool-router); command-center Comfy; опциональный `STACK1_CLIENT_BIND` | Компрометация соседнего хоста в L2/L3 |
| **Docker internal** | `ew_net_*`, API как hub на нескольких сетях | RCE в контейнере, supply-chain образа |
| **Host post-exploitation** | `podman/docker inspect`, env, тома данных | Insider, root на prod-core / command-center |

**Инвариант прод:** пользовательский трафик **не** должен попадать на prod-core / command-center минуя edge+SG+backhaul. stack666 LAN HTTPS — **retired → `trash/`**; app binds — `127.0.0.1`.

---

## 2. Периметр и оценка рисков compose

Многие находки generic-аудита («порт БД на `0.0.0.0` = доступ из интернета») для **prod EliteEW не применимы**, если:

- prod-core **не** имеет публичного IP и **нет** dst-nat с WAN на приложения (MikroTik);
- stack1/stack0 bind по умолчанию **`127.0.0.1`** (`STACK1_CLIENT_BIND`, `API_BIND_ADDRESS`, …);
- медиа Jitsi наружу идёт через **edge relay + SG**, а не через прямой WAN на prod-core.

| Класс риска в generic-аудите | При периметре edge+NAT+SG | Актуальная зона |
|------------------------------|---------------------------|-----------------|
| Postgres/Qdrant/Redis на host port | Низкий для internet scan | LAN `.141`, post-RCE в Docker |
| JVB `34000/34001` на интерфейсах prod-core | Низкий для WAN | LAN, misconfigured port-forward |
| WireGuard `privileged` (meet-edge-wg) | Зависит от публикации UDP | VPN peer path, не публичный app |
| Remote llama `0.0.0.0` на workers | Не internet | nftables/firewalld prod-core↔gpu141 |

**DevSecOps score (контейнеры, prod EliteEW): ~7.5/10** — сильный внешний периметр; gaps в defense-in-depth **после** входа (auth vector DB, API hub, secrets в env, root в GPU-образах).

---

## 3. Реестр рисков (приоритет для EliteEW)

### High — актуально даже с закрытым периметром

| ID | Риск | Compose / образ | Митигация |
|----|------|-----------------|-----------|
| H1 | **API на всех `ew_net_*`** — lateral movement после RCE | `stack0_b.yml` | Сузить сети по роли воркера; отдельные read-only consumers |
| H2 | **Chroma / Qdrant / ES без auth** внутри `ew_net_2847` | `stack1.yml` | API key Qdrant; ограничение по docker network; ES xpack при необходимости |
| H3 | **Секреты в `environment` / env_file** → `docker inspect` | stack0, stack6, stack11 | Docker Secrets / файлы в tmpfs; минимум в inspect |
| H4 | **Reverse SSH `network_mode: host`** | `stack-yandex-tunnel.yml` | Мониторинг туннеля; firewalld egress; known_hosts volume |
| H5 | **Floating tag `llama.cpp:server-cuda`** | `stack2.yml`, remote embed | Pin digest; скан CVE в CI |
| H6 | **llama / Paperless от root** | `stack2` (`STACK2_LLAMA_USER:-0:0`), `stack4` paperless | Non-root где поддерживает образ |
| H7 | **LAN workers: широкий bind** | `STACK1_CLIENT_BIND`, remote llama `0.0.0.0` | Prod-core: `127.0.0.1`; nftables allowlist prod-core↔gpu141 — [LAN-WORKERS-141.md](LAN-WORKERS-141.md) |

### Medium

| ID | Риск | Заметка |
|----|------|---------|
| M1 | Нет `read_only: true` на root FS | nginx meet-gate, stateless API-прокси |
| M2 | `:latest` (Tika, Gotenberg, Paperless, frontend tag) | Pin версий в prod |
| M3 | `privileged` / `SYS_ADMIN` (WG, Jibri profile) | Держать Jibri/recording выключенным без ТЗ |
| M4 | Meet JWT-gate: referer/origin bypass | Релевантно только для клиентов, уже прошедших SG |
| M5 | stack9 runtime `pip install` в command | Immutable образ |

### Low / осознанно принято

| ID | Риск | Почему Low в prod |
|----|------|-------------------|
| L1 | JVB слушает `0.0.0.0:34000` на prod-core | NAT + media через edge; не публиковать на роутере |
| L2 | stack666 LAN HTTPS / OpenVPN AS | Retired → `trash/` (не поднимать) |
| L3 | CoreDNS `user: 0:0` | Внутренний DNS; bind только на доверенный интерфейс — [INTERNAL-DNS.md](INTERNAL-DNS.md) |

---

## 4. Контроли, уже реализованные (не регрессить)

- **`no-new-privileges:true`** на большинстве сервисов stack0/1/2/4/6/9.
- **Non-root** frontend (`1000:1000`), stack1 DB (`STACK1_UID_*`), Keycloak (`1000:0`).
- **Сегментация `ew_net_*`** — frontend **не** на data-tier ([SEGMENTATION.md](SEGMENTATION.md)).
- **Дефолт bind `127.0.0.1`** для stack1, stack0_f, meet-jwt-gate `:34002`.
- **Redis** `requirepass` + rename-command ([SECURITY.md](SECURITY.md)).
- **Meet:** JWT для комнат, guests off, `stack11-meet-jwt-gate` перед web.
- **API:** код `:ro`, **`/var/run/docker.sock` не монтировать** (комментарий в `stack0_b.yml`).
- **Keycloak** pinned tag (`stack6.yml`).
- **Edge SG + bot:** один IP, TTL, порты 443 + медиа — [EMPERY-EDGE-IP-OPERATIONS.md](EMPERY-EDGE-IP-OPERATIONS.md).

---

## 5. Roadmap (без смены периметра)

1. **LAN:** `STACK1_CLIENT_BIND=127.0.0.1` на prod-core; nftables только нужные порты к gpu141.
2. **Data-tier:** Qdrant API key; документировать отсутствие auth Chroma/ES как **internal-trust** риск.
3. **Images:** digest pin llama; убрать `:latest` stack4.
4. **Monitoring:** алерт если prod-core слушает app-порты на WAN-интерфейсе; `validate-empery-tunnel-security.sh` по timer.
5. **Опционально:** secrets в tmpfs / Config Plane; `read_only` + tmpfs для nginx gate.

---

## 6. Smoke (prod-core, без секретов в выводе)

```bash
# Слушатели: app-порты только 127.0.0.1 (не 0.0.0.0 на WAN)
ss -tulpn | grep -E ':2900[01]|:34002|:36000|:3000[0-9]' || true

# Bind postgres (ожидание 127.0.0.1 в prod)
podman inspect stack1-postgres --format '{{json .HostConfig.PortBindings}}'

# Privileged контейнеры
podman ps -q | xargs -r podman inspect --format '{{.Name}} privileged={{.HostConfig.Privileged}}' | grep 'privileged=true'

# Периметр DNS/backhaul (exit 0 = OK)
sudo bash docker/scripts/internal-sites/validate-empery-tunnel-security.sh
```

---

## Связанные документы

- [SECURITY.md](SECURITY.md) — Redis rename / compose hardening
- [EMPERY-EDGE-IP-OPERATIONS.md](EMPERY-EDGE-IP-OPERATIONS.md) — edge, SG, backhaul
- [WG-HTTP-BACKHAUL-PRIMARY.md](WG-HTTP-BACKHAUL-PRIMARY.md) — Meet WG primary HTTP
- [YANDEX-VM-SSH-TUNNEL.md](YANDEX-VM-SSH-TUNNEL.md) — SSH reserve / nginx deploy
- [LAN-WORKERS-141.md](LAN-WORKERS-141.md) — gpu141 allowlist
- [JITSI-MEET-YANDEX-REVERSE-TUNNEL.md](JITSI-MEET-YANDEX-REVERSE-TUNNEL.md) — meet + media path
- [PRODUCTION-TOPOLOGY-STATE.md](../PRODUCTION-TOPOLOGY-STATE.md) — current hosts / stacks
