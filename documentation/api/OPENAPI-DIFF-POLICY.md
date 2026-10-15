# EliteEW: политика OpenAPI diff и пилотные срезы

## Назначение

Стабильность контракта между **`shared/api`** и **`shared/web/frontend`**: изменения путей, схем и `operationId` не должны «тихо» ломать клиент. Hub: [`README.md`](README.md).

Living OpenAPI surface is **EliteEW only**. Do not treat retired DEWA dumps (`dewa-openapi-export.json`, `generated/dewa-openapi.json`) as contract sources.

Authenticated API routes expect Keycloak JWT audience **`empery-api`** ([`KEYCLOAK-ELITEEW.md`](../platform/docker-re_doc/KEYCLOAK-ELITEEW.md)).

## Источники истины

- Полный экспорт схемы: **`shared/api/scripts/export_openapi_docker.sh`** → `documentation/api/eliteew-openapi-export.json` (gitignored), или локальный скрипт из **[FRONTEND-BACKEND-HTTP.md](FRONTEND-BACKEND-HTTP.md)**.
- Пилотные JSON и сгенерированные типы: **`shared/web/frontend/openapi/pilot/`**, **`shared/web/frontend/src/generated/`**.
- **Same-release FE types without waiting for live prod:** stack0 Line A opt-in **`--refresh-openapi-pilots`** (tree export on `.136` before `pnpm build`) — see **[FRONTEND-BACKEND-HTTP.md](FRONTEND-BACKEND-HTTP.md)** §Bake-time and **[PROD-CORE-MIGRATION-BAKED-IMAGES.md](../platform/docker-re_doc/PROD-CORE-MIGRATION-BAKED-IMAGES.md)**.
- FE↔BE gap: living **[FE-BE-GAP-MATRIX.md](FE-BE-GAP-MATRIX.md)** (+ manual triage **[FE-BE-GAP-MATRIX.manual.md](FE-BE-GAP-MATRIX.manual.md)**).

## Правила PR

1. **Ломающее изменение** (удалён путь, изменён обязательный body, переименован `operationId`, используемый фронтом): в одном PR с кодом API — обновление затронутых пилотов (`openapi:extract-pilots` + `openapi:pilots`) **или** явная задача с блокировкой merge (label) и ссылкой на issue.
2. **Добавление** endpoint: пилот обновляется, если маршрут входит в область существующего pilot slice (marketing, desktop, voice-gateway и т.д.); иначе — запись в **[FE-BE-GAP-MATRIX.manual.md](FE-BE-GAP-MATRIX.manual.md)** или инвентаре.
3. **Не коммитить** сырой полный `eliteew-openapi-export.json` без политики размера/секретов; для CI артефакты см. **[OPENAPI-PILOTS-CI.md](OPENAPI-PILOTS-CI.md)**.

## Верификация diff локально

```bash
cd shared/web/frontend
pnpm run openapi:export:prod-core   # or openapi:export with local API
pnpm run openapi:extract-pilots && pnpm run openapi:pilots
OPENAPI_MARKETING_FULL=1 pnpm run openapi:check-pilot-freshness
git diff --exit-code openapi/pilot src/generated || echo "Pilot drift — review"
```

## Автоматизация

- **Управляемый** workflow (self-hosted, Docker): **[OPENAPI-PILOTS-CI.md](OPENAPI-PILOTS-CI.md)** — `openapi-pilots-refresh.yml`, не обязательный gate на каждый PR.
- **Обязательный** gate на PR: см. `.github/workflows/eliteew-pr-gate.yml` (frontend/backend); полный экспорт OpenAPI в отсутствии runner с API остаётся вне обязательного минимума.
