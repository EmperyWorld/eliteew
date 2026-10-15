# docker/builders — image build contexts (canonical)

Все Dockerfile активных стеков живут здесь — **не** в устаревшем `docker/build/`
(каталог отсутствует; любые ссылки на `docker/build/` считать ошибкой документации).

| Каталог | Стек / образ |
|---------|----------------|
| `stack0-api/` | stack0 backend multi-target (`api`, workers, beat); см. `STACK0-BACKEND-IMAGES.md` |
| `stack6-keycloak/` | Keycloak 26.7.1 + EliteEW binding SPI (`Containerfile`); bake via `eliteew-deploy.sh release stack6` |
| `stack4-ocrmypdf/`, `stack4-tesseract/` | stack4 OCR helpers |
| `stack9-cosyvoice3/`, `stack9-whisper-fast/`, `stack9-f5-tts/`, `stack9-qwen3-tts/`, `stack9-silero/` | stack9 voice (Silero = v5_5_ru GPU) |
| `stack0-frontend/` | SPA bake image |
| `comfyui/` | ComfyUI image helpers |
| `site-edge-carrier/` | Site Edge carrier image |
| `yandex-tunnel/` | Reverse SSH tunnel (`Dockerfile`; compose `stack-yandex-tunnel.yml`) |
| ~~`stack12-dnsmasq/`~~ | retired empty placeholder → `trash/` (live stack12 = CoreDNS in compose) |

## Сборка stack0 backend

```bash
bash docker/scripts/build-stack0-backend-images.sh   # все таргеты из env STACK0_*_IMAGE
bash docker/scripts/build-stack0-api-image.sh        # только target api (по умолчанию)
```

Контекст: **`docker/builders/stack0-api`**.

## Сборка через compose

```bash
podman compose -f docker/stack/stack9.yml build
podman compose -f docker/stack/stack4.yml build
```

Документация: **`documentation/platform/docker-re_doc/DOCKER-BUILD-COMMANDS.md`**,
**`documentation/platform/docker-re_doc/STACK0-BACKEND-IMAGES.md`**.

Проверка stack0 env roles: `bash docker/scripts/stack0-env-materialize-roles.sh --check`.
