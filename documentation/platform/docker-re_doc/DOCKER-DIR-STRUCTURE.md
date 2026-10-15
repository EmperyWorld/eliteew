# Назначение файлов и каталогов в docker/

Dockerfile активных стеков — в **`docker/builders/`** (исторический docker/build не используется). Soft-retire junk → **`trash/`**. Каталог **the docker rar_docker tree (not living; do not recreate)** не живой (отсутствует в дереве; не воссоздавать).

**Где что крутится:** builds — **command-center `.136`**; public runtime — **prod-core `.111`**; living ComfyUI — **gpu141 `.141:31003`** via `docker/scripts/lan-workers/`.

## Активно используемые

| Путь | Назначение |
|------|------------|
| **builders/** | Контексты сборки: `stack0-api`, `stack0-frontend`, stack4 OCR, stack6 Keycloak, stack9 voice, `site-edge-carrier`, **`yandex-tunnel/`** (Dockerfile reverse SSH). Live stack12 DNS = CoreDNS in compose (no dnsmasq builder). |
| **env_file/** | Переменные окружения по стакам (.env.stack0.backend, .env.stack1, .env.stack2, …). Не коммитить секреты. Staging plaintext — command-center; prod-core runtime env — tmpfs Config Plane. |
| **keycloak/themes/eliteew/** | Живая login-тема Keycloak (`stack6.yml` mount `../keycloak/themes` → `/opt/keycloak/themes:ro`). |
| **stack/** | Compose: stack0_b/f (+ baked/dev-bind overrides), stack1…stack12, **stack-yandex-tunnel.yml**, meet-edge-wg, mobile-release, **EWA postgres**. Inventory: **`docker/stack/README.md`**. EWC postgres compose soft-retired → `trash/` (Wave D1). **stack3.yml / stack5.yml** (+ `stack5/searxng.settings.yml`) **/ stack9.yml** — compose retained for build/docs (не resurrect на prod без ТЗ). Soft-retired: **stack666** / OpenVPN → `trash/`. `stack12.yml` — CoreDNS; см. **INTERNAL-DNS.md**. |
| **data/** | Данные стаков (stack1 … stack11). Пути в compose: `../data/stackN/...`. |
| **logs/** | Логи на хосте: stackN/имя_сервиса/. |
| **scripts/** | Ops CLI: **`eliteew-deploy.sh`** (user-facing `release` / `hotfix` / `release runtime`), implementers `eeprodline.sh` / `eliteew-stack0-baked-deploy.sh` / `eliteew-ops-lib.sh`, `eliteew-container-control.py`, Keycloak/Comfy (`start-comfyui-clean.sh`)/Meet helpers. Thin `dewa-ops-prod-line-*.sh` → `trash/`. **scripts/lan-workers/** — gpu141 (`README.md`). **scripts/yandex-tunnel/** — edge / Meet WG / WG backhaul / **`check-yandex-tunnel.sh`** (`README.md`). **scripts/prod-core/** / **mobile-private-tunnel/** — host + Mobile WG maps. **scripts/internal-sites/** — CoreDNS / firewalld / cert helpers (`README.md`). Site Edge CLIs: **`site-edge-carrier-deploy.sh`**, **`site-edge-iot-provision.sh`**, **`site-edge-iot-verify.sh`**. |
| **site-edge-iot/** | Fedora IoT edge-node provision (Ignition/Butane). Cross-link with **`builders/site-edge-carrier/`** + Site Edge CLIs — see **`docker/README.md`** §Site Edge and **`SITE-EDGE-CARRIER.md`**. |
| **schemas/** | `compose-spec.json` for IDE / compose validate (not runtime). |
| **tmp/** | Gitignored scratch (bake/release logs, locks). Not product canon; soft-retire stale contents via `trash-move`. |

## Конфиги хоста и инфраструктуры

| Путь | Назначение |
|------|------------|
| **conf.d/offline-empery.conf** | Конфиг для **хостового** nginx (не в контейнере): TLS-терминация и прокси на контейнеры (*.eliteew.ru). Inventory: **`docker/conf.d/README.md`**. Копировать в `/etc/nginx/conf.d/` на хосте (`sudo cp docker/conf.d/offline-empery.conf /etc/nginx/conf.d/ && sudo nginx -t && sudo systemctl reload nginx`). В compose не монтируется. Pair: modular edge configs in **`docker/host_conf/`**. |
| **host_conf/** | Edge/host nginx (mkcert↔LE pairs), backhaul includes, nftables fragment, podman-egress, optional cert-renew timer. См. `docker/host_conf/README.md`. |
| **systemd/** | Host units: historical `.136` Comfy rollback launcher, prod-core podman-autostart, gpu141 llama-remote and living ComfyUI. Inventory: **`docker/systemd/README.md`**. |

## Документация

Канон — **`documentation/platform/docker-re_doc/`** (отдельный symlink внутри `docker/` не создаётся).

| Файл | Назначение |
|------|------------|
| **DOCKER-DIR-STRUCTURE.md** | Этот файл — назначение каталогов и файлов. |
| **DOCKER-SELINUX-BIND-MOUNTS.md** | SELinux labels для bind-mounts. |
| **SECURITY.md** | Рекомендации по безопасности. |
| **SEGMENTATION.md** | Сегментация/сети. |
| **SUDO-COMMANDS.md** | Команды для выполнения с sudo (каталоги, права). |
| **KEYCLOAK-ELITEEW.md** | Keycloak realm + living theme path. |
| **../SITE-EDGE-CARRIER.md** | Site Edge + Fedora IoT provisioning (platform root). |

## Прочее

| Путь | Назначение |
|------|------------|
| **keys/** | Каталог для ключей (**`yandex_tunnel_key`**, **`glock_key`** / legacy **`gateway_alive_key`**). Для reverse SSH — см. **YANDEX-VM-SSH-TUNNEL.md** (каталог в `.gitignore`). |
| **docker/README.md** | Operator tree map (living); keep in sync with this file. |

**Не воссоздавать:** the docker rar_docker tree (not living; do not recreate), исторический docker/build.
