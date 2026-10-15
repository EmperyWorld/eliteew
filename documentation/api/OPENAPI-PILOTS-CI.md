# Опциональный CI: обновление pilot OpenAPI и типов

Цель: периодически (или вручную) обновлять срезы схемы и `src/generated/*.ts` без обязательного шага на каждый PR. Политика изменений контракта (breaking vs additive) — **[OPENAPI-DIFF-POLICY.md](OPENAPI-DIFF-POLICY.md)**. Hub: [`README.md`](README.md).

Exports and pilots are **EliteEW** FastAPI only (`stack0-eliteew-api-*`). Retired DEWA OpenAPI artifacts are not inputs to this job.

## Предпосылки

- Runner с **Podman** или Docker и доступом к контейнеру API, **или** SSH к prod-core (`ELITEEW_OPENAPI_SSH_HOST`). Скрипт `export_openapi_docker.sh` использует `ELITEEW_CONTAINER_RUNTIME` (default **podman**) и default container **`stack0-eliteew-api-prod-baked`**.
- Frontend tooling: `pnpm run openapi:tooling:install` (isolated `openapi-typescript` + TypeScript 5.x).
- Репозиторий смонтирован в job; секреты не нужны для **экспорта схемы** (локальный импорт `api.main` внутри контейнера).

## Шаги job

1. `pnpm run openapi:tooling:install` (или `npm --prefix shared/web/frontend/tools/openapi-typescript-runtime install`).
2. Export: local `bash shared/api/scripts/export_openapi_docker.sh` **или** remote
   `ELITEEW_OPENAPI_SSH_HOST=192.168.1.111 ELITEEW_API_CONTAINER=stack0-eliteew-api-prod-baked bash shared/api/scripts/export_openapi_docker.sh`.
3. `cd shared/web/frontend && pnpm run openapi:extract-pilots && pnpm run openapi:pilots:lite` (или `openapi:pilots:full` / `openapi:refresh-pilots:full:prod-core`).
4. `OPENAPI_MARKETING_FULL=1 pnpm run openapi:check-pilot-freshness`.
5. Сохранить артефакты: `eliteew-openapi-export.json` (опционально), `shared/web/frontend/openapi/pilot/*.json`, `shared/web/frontend/src/generated/*.ts` в архив `openapi-pilots.tgz`. Состав `:lite` включает regenerable pilots (**ewa**, **doc-editor-v2**, **kbsew**, desktop, friends, …) plus hand-maintained EWA SSE overlays.

## Пример GitHub Actions (только `workflow_dispatch`)

Имя контейнера и путь к репо подставьте под свою инфраструктуру. Job не публикует дамп в публичный репозиторий без политики на размер и чувствительность схемы.

```yaml
name: openapi-pilots-refresh
on:
  workflow_dispatch:
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: pnpm
          cache-dependency-path: shared/web/frontend/pnpm-lock.yaml
      - name: Install frontend deps
        run: cd shared/web/frontend && pnpm install --frozen-lockfile
      - name: Export OpenAPI from API container
        env:
          ELITEEW_API_CONTAINER: stack0-eliteew-api-prod
        run: bash shared/api/scripts/export_openapi_docker.sh eliteew-openapi-export.json
      - name: Slice pilots and regenerate TS
        env:
          OPENAPI_EXPORT: ${{ github.workspace }}/eliteew-openapi-export.json
        run: cd shared/web/frontend && pnpm run openapi:extract-pilots && pnpm run openapi:pilots:lite
      - name: Upload bundle
        uses: actions/upload-artifact@v4
        with:
          name: openapi-pilots
          path: |
            eliteew-openapi-export.json
            shared/web/frontend/openapi/pilot/
            shared/web/frontend/src/generated/
```

На публичных GitHub runner **нет** вашего Docker-сетка с API — job выше имеет смысл на **self-hosted** runner рядом со stack0 или как шаблон для внутреннего CI.

## Локально (разработчик)

См. [`FRONTEND-BACKEND-HTTP.md`](FRONTEND-BACKEND-HTTP.md): `pnpm run openapi:export`, затем `openapi:extract-pilots` и `openapi:refresh-pilots`.

**Alternative to post-prod export for releases:** bake-time `--refresh-openapi-pilots` on `eliteew-deploy.sh release stack0 --all` exports from the **release tree** on command-center (not live `.111`) before SPA build — preferred when shipping API + FE types together. Helper: `docker/scripts/stack0-refresh-openapi-pilots.sh`. CI workflow above remains for scheduled / PR artifact refresh from a running container.
