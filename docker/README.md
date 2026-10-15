# Docker Directory Guide

Операционная карта каталога `docker/` для EliteEW.

## Быстрый старт

- Compose-стеки: `docker/stack/*.yml`
- Env-файлы: `docker/env_file/.env.*`
- Данные томов: `docker/data/`
- Логи контейнеров: `docker/logs/`
- Скрипты операций: `docker/scripts/` (см. `docker/scripts/README.md`)
- Канон по структуре и правам: см. раздел «Документация» ниже
- **Короткие команды для любой cwd:** `source …/docker/scripts/eliteew-docker-aliases.sh` в `~/.bashrc` → `eec`, `eectl`, `eesd`, `eesr`, **`eedeploy`** (см. [`STACK-CONTAINER-CONTROL.md`](../documentation/platform/docker-re_doc/STACK-CONTAINER-CONTROL.md); справка в shell: **`???`**).

## Структура `docker/`

```text
docker/
  builders/                 # Dockerfile / build contexts (канон; не docker/build/)
    stack0-api|frontend/    # stack0 bake
    stack4-* / stack6-keycloak / stack9-* / comfyui /
    site-edge-carrier/      # site edge image
    yandex-tunnel/          # Dockerfile reverse SSH tunnel (Wave D1)
  conf.d/                   # host nginx monolith (см. conf.d/README.md)
  data/                     # bind-данные стеков (не коммитить секреты)
  env_file/                 # .env для compose; в git — только *.example + README
  host_conf/                # host-level network/nginx/systemd configs (README)
  keycloak/themes/          # тема login Keycloak (stack6)
  logs/                     # bind-логи стеков
  schemas/                  # compose-spec.json (IDE / validate)
  scripts/                  # ops CLI (зеркало: scripts/docker → сюда)
    yandex-tunnel/          # edge / Meet WG / check-yandex-tunnel.sh
    lan-workers/            # gpu141: embed/rerank/tool-router (не Comfy)
    internal-sites/         # CoreDNS / firewalld / cert helpers
  site-edge-iot/            # Fedora IoT edge node provision (companion to site-edge-carrier)
  stack/                    # compose YAML + stack-local config (см. stack/README.md)
    stack11/ nginx/         # Meet JWT gate snippet
    mobile-release/         # OTA nginx.conf
    profiles/               # stack2 model overrides
  systemd/                  # host units (см. systemd/README.md)
  tmp/                      # gitignored scratch (bake logs/locks); не канон
  # keys/                   # gitignored SSH keys (yandex_tunnel_key, …)
```

> Soft-retired junk (`stack666`, OpenVPN `stack/rar`+`secrets`, `stack2.yml.backup`, `stack-ewc-postgres.yml`) → `trash/` (не канон).  
> **Wave D1 (2026-08-15):** yandex root → `builders/yandex-tunnel` + `scripts/yandex-tunnel`; `tmp/` emptied; EWC compose retired.  
> **Wave D2 (2026-08-15):** `docker/stack/README.md` compose inventory.  
> **Wave D3 (2026-08-15):** README maps under `scripts/{yandex-tunnel,lan-workers,prod-core,mobile-private-tunnel}/` + Site Edge cross-link (§ниже).  
> **Wave D4 (2026-08-15):** `conf.d/` + `systemd/` READMEs; `scripts/internal-sites/` map + track living CLIs.  
> Compose/builders for stack0–12 / stack9 / stack3 / stack5 **kept** even if a stack is not running on prod.  
> **Не воссоздавать:** `docker/rar_docker/`, `docker/build/`.

## Site Edge (одна карта)

Один Edge-Node = OS flash + Site-Image + operator CLIs. Канон: [`SITE-EDGE-CARRIER.md`](../documentation/platform/SITE-EDGE-CARRIER.md).

| Tree | Role |
|------|------|
| **`docker/site-edge-iot/`** | Fedora IoT Butane/Ignition (см. `site-edge-iot/README.md`) |
| **`docker/builders/site-edge-carrier/`** | Immutable Site-Image Dockerfile |
| **`docker/scripts/site-edge-carrier-deploy.sh`** | Build → transfer → `podman run` |
| **`docker/scripts/site-edge-iot-provision.sh`** / **`site-edge-iot-verify.sh`** | Flash + verify |

Related script maps: `scripts/yandex-tunnel/README.md`, `scripts/lan-workers/README.md`, `scripts/prod-core/README.md`, `scripts/mobile-private-tunnel/README.md`.

Канон по стекам/правам/сборкам живёт в **`documentation/platform/docker-re_doc/`**
(не в `docker/re_doc/` — этот путь устарел и намеренно не симлинкуется).

Зеркало CLI: **`scripts/docker` → `docker/scripts`** (symlink).

Env-шаблоны: `docker/env_file/.env.<stack>.example` → копировать в `.env.<stack>`
(например `.env.stack9.example` → `.env.stack9`).

## Важные инварианты

- Запускать compose из корня репозитория с явным `--env-file`.
- Не коммитить реальные `.env` с секретами; править только `*.example` в git.
- Runtime по умолчанию — **Podman** (`ELITEEW_CONTAINER_RUNTIME=podman`).
- После перемещения путей внутри `docker/` обязательно синхронизировать:
  - bind-монты в `docker/stack/*.yml`,
  - документацию в `documentation/platform/docker-re_doc/*`,
  - при необходимости скрипты в `docker/scripts/*`.

## Документация

- Общая структура: [`DOCKER-DIR-STRUCTURE.md`](../documentation/platform/docker-re_doc/DOCKER-DIR-STRUCTURE.md)
- Безопасность: [`SECURITY.md`](../documentation/platform/docker-re_doc/SECURITY.md)
- Сегментация сетей: [`SEGMENTATION.md`](../documentation/platform/docker-re_doc/SEGMENTATION.md)
- Yandex reverse tunnel: [`YANDEX-VM-SSH-TUNNEL.md`](../documentation/platform/docker-re_doc/YANDEX-VM-SSH-TUNNEL.md)
- LAN workers (GPU `.141`): [`LAN-WORKERS-141.md`](../documentation/platform/docker-re_doc/LAN-WORKERS-141.md) — скрипты `docker/scripts/lan-workers/`
- CSP фронта (prod vs LAN): [`FRONTEND-SECURITY-NGINX-STATIC.md`](../documentation/platform/FRONTEND-SECURITY-NGINX-STATIC.md)
- Jitsi через туннель: [`JITSI-MEET-YANDEX-REVERSE-TUNNEL.md`](../documentation/platform/docker-re_doc/JITSI-MEET-YANDEX-REVERSE-TUNNEL.md)
- **Prod deploy (baked):** [`PROD-CORE-MIGRATION-BAKED-IMAGES.md`](../documentation/platform/docker-re_doc/PROD-CORE-MIGRATION-BAKED-IMAGES.md) — line A via `eliteew-deploy.sh release stack0 --all`; **сборка только на command-center**, на `.111` — load + recreate

## Полезные команды

```bash
# Проверить compose-конфиг конкретного стека (Podman)
podman compose -f docker/stack/stack0_b.yml --env-file docker/env_file/.env.stack0.backend config

# Полный упорядоченный recreate (из корня репозитория)
python3 docker/scripts/eliteew-container-control.py --yes recreate

# Из любой директории (после source docker/scripts/eliteew-docker-aliases.sh): eesr, eectl, eec
# Либо абсолютным путём:
#   bash /path/to/powered_by_emperyworld/docker/scripts/eliteew-container-console.sh

# Пользовательское интерактивное меню
bash docker/scripts/eliteew-container-console.sh

# Проверить yandex tunnel
bash docker/scripts/yandex-tunnel/check-yandex-tunnel.sh

# Edge + auto-IP (cutover, DNS smoke, бот SG)
bash docker/scripts/yandex-tunnel/empery-edge-ip-menu.sh
```
