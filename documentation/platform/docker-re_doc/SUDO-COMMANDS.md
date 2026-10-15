# Команды для выполнения с sudo (или от root)

**Status:** living host one-shot helpers. Topology SoT: [PRODUCTION-TOPOLOGY-STATE.md](../PRODUCTION-TOPOLOGY-STATE.md) §Current (living Comfy = `.141:31003`; Podman default).

Выполни эти команды **один раз** после применения изменений в репозитории.

## 1. Каталоги для Paperless (stack4)

Данные Paperless в `docker/data/stack4/paperless/`. Создай каталоги и выстави владельца (uid:gid 1000:1000 — пользователь в контейнере paperless):

```bash
cd <repo>
sudo mkdir -p docker/data/stack4/paperless/data docker/data/stack4/paperless/media docker/data/stack4/paperless/export
sudo chown -R 1000:1000 docker/data/stack4/paperless
```

Если раньше использовался `/srv/paperless/`, перенеси данные и снова выстави права:

```bash
# если данные были в /srv/paperless:
sudo cp -a /srv/paperless/data/. docker/data/stack4/paperless/data/
sudo cp -a /srv/paperless/media/. docker/data/stack4/paperless/media/
sudo cp -a /srv/paperless/export/. docker/data/stack4/paperless/export/
sudo chown -R 1000:1000 docker/data/stack4/paperless
```

## 2. Конфиг Elasticsearch в stack1

Compose stack1 ожидает конфиг в `docker/data/stack1/elasticsearch_config/`. Скопируй существующий каталог (если он был в корне репо):

```bash
cd <repo>
sudo mkdir -p docker/data/stack1/elasticsearch_config
sudo cp -a elasticsearch_config/. docker/data/stack1/elasticsearch_config/
# Старый каталог elasticsearch_config в корне можно потом удалить.
```

## 3. Убрать legacy ComfyUI из stack2 compose (если ещё крутится)

**Living ComfyUI** — gpu141 **`.141:31003`** (persistent `/var/lib/eliteew/comfyui`, rootful host-net). command-center `.136` retains a historical rollback launcher only. Canon: [PRODUCTION-TOPOLOGY-STATE.md](../PRODUCTION-TOPOLOGY-STATE.md) §Current, [LAN-WORKERS-141.md](LAN-WORKERS-141.md).

Если на хосте ещё остался старый контейнер `stack2-comfyui` из compose:

```bash
podman stop stack2-comfyui 2>/dev/null || true
podman rm stack2-comfyui 2>/dev/null || true
```

## 4. Данные Llama в stack2 (выполнено)

Модели Llama в stack2 llama data dir *[runtime under docker/data/stack2/]*; в `docker/env_file/.env.stack2` задано: `LLAMA_DATA_PATH=../data/stack2/llama`. При запуске stack2 с этим env-файлом Llama монтирует этот каталог.

## 5. Memory overcommit (Redis)

Redis (stack1) рекомендует `vm.overcommit_memory=1`. Без этого — WARNING в логах Redis.

```bash
cd <repo>
sudo ./docker/scripts/fix-memory-overcommit.sh
docker restart stack1-redis
```

> **stack5 / Crawl4AI снят** — перезапуск `stack5-crawl4ai` не актуален. Legacy notes — в `trash/` (не канон).

Или вручную: `sudo sysctl vm.overcommit_memory=1` и добавить `vm.overcommit_memory = 1` в `/etc/sysctl.conf`.

## 6. Internal Sites (LAN + WireGuard)

После запуска `docker/stack/stack12.yml` root-доступ нужен для трёх вещей: firewall, установка wildcard cert в системный nginx и systemd timer для автообновления.

### firewalld: закрыть 80/443 для внешнего интернета и оставить LAN/VPN + WireGuard

```bash
cd <repo>
sudo ./docker/scripts/internal-sites/apply-firewalld-internal-only.sh
sudo firewall-cmd --zone=public --list-all
```

### Установка wildcard cert в `/etc/nginx/ssl/offline-empery`

```bash
cd <repo>
sudo ./docker/scripts/internal-sites/install-offline-cert.sh
```

Если сертификат выпускался через manual DNS-01 / Certbot:

```bash
cd <repo>
sudo ./docker/scripts/internal-sites/install-offline-cert-from-certbot.sh
```

### Автопродление wildcard cert через systemd timer

```bash
cd <repo>
sudo cp docker/host_conf/internal-sites-cert-renew.service /etc/systemd/system/internal-sites-cert-renew.service
sudo cp docker/host_conf/internal-sites-cert-renew.timer /etc/systemd/system/internal-sites-cert-renew.timer
sudo systemctl daemon-reload
sudo systemctl enable --now internal-sites-cert-renew.timer
```

Этот timer имеет смысл включать только после появления `REGRU_USERNAME` / `REGRU_PASSWORD` и перехода на API-based renewal.
