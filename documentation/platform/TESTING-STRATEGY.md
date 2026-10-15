# Testing strategy (EliteEW)

**Статус:** канон.
**Scope:** когда и как запускать тесты фронта, бэкенда и контрактную верификацию.

---

## Layers

| Layer | Tooling | When |
|-------|---------|------|
| **A — Linters/format** | Ruff (API), Biome (FE) | Every code change |
| **B — Semantic trace** | Manual trace + grep | Contract/intent/router changes — [AGENT-CODE-VERIFICATION-WORKFLOW.md](AGENT-CODE-VERIFICATION-WORKFLOW.md) |
| **C — Behavioral tests** | pytest, Vitest | Boundary tests for normalizers, early returns, HTTP contracts |

---

## Backend (API)

> Операторский runtime по умолчанию: **Podman**.

### Canonical: immutable test container

**Prefer** for full suite and CI-like runs — code copied into image, **no** bind-mount drift with host venv:

```bash
bash docker/scripts/run-stack0-api-tests.sh
bash docker/scripts/run-stack0-api-tests.sh tests/test_remediation_hardening_s1.py -q
```

Artifacts: `docker/builders/stack0-api/Dockerfile.test-runner`, `docker/stack/stack0_test.yml`.
Details: [docker-re_doc/STACK0-BACKEND-IMAGES.md](docker-re_doc/STACK0-BACKEND-IMAGES.md).

### Dev / targeted (optional)

Inside running API container with bind-mounted `shared/api` (stack0 prod dev loop):

```bash
podman exec stack0-eliteew-api-prod sh -lc 'cd /app/api && PYTHONPATH=. .venv/bin/python -m pytest tests/test_api_health_smoke.py -q'
```

Use when iterating on a single test against live mount; **not** a substitute for immutable runner before merge.

### Host venv

Локальный venv бэкенда на **хосте** (IDE, Ruff, pytest, basedpyright) — **`.venv`**, **не** a nested `.venv` under the api package dir *[forbidden — use repo-root .venv]*. Совпадает с layout контейнера: venv на уровень выше каталога пакета `api` (`/app/.venv` + `/app/api`).

**Podman-контейнеры stack0 (prod/dev) не меняются** — у образа свой `.venv` внутри; команды ниже только для host.

Установка / обновление host venv (**тот же prod surface, что в Docker `api.lock`**):

```bash
# Рекомендуемый путь (repo root)
bash scripts/eliteew/sync-host-api-venv.sh
```

**Host toolchain:** на Fedora для source-сборок C-расширений нужен **`python3-devel`** (`Python.h`). Скрипт предупреждает, если заголовков нет. На Python **3.14** пакеты без `cp314` wheel падают на compile — канон: `httptools>=0.8` (есть wheel; `0.6.x` — только sdist).

Ручной эквивалент:

```bash
cd shared/api
UV_PROJECT_ENVIRONMENT=../../.venv uv sync --extra dev
UV_PROJECT_ENVIRONMENT=../../.venv uv pip install --index-strategy unsafe-best-match \
  -c ../../docker/builders/stack0-api/constraints.txt \
  -c ../../docker/builders/stack0-api/requirements/locks/api.lock \
  -r requirements.txt --python ../../.venv/bin/python
```

**Канон prod-зависимостей:** `docker/builders/stack0-api/requirements/*.in` + `requirements/locks/*.lock`.
`shared/api/requirements.txt` — тонкий overlay: `-r` на `api.in` + dev/test tooling (без torch/spacy/CUDA).

Перекомпиляция локов после правки `.in`:

```bash
bash docker/builders/stack0-api/scripts/recompile-locks.sh
```

`UV_PROJECT_ENVIRONMENT` задан в `.vscode/settings.json` (`terminal.integrated.env.linux`) — в терминале Cursor достаточно `uv sync` из `shared/api` (env pin → `.venv`).

Примеры на хосте:

```bash
# pytest (узко)
cd shared/api
PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/test_json_safe_smoke.py -q

# Ruff / uv run (с env из IDE)
cd shared/api && UV_PROJECT_ENVIRONMENT=../../.venv uv run ruff check routers/desktop.py
```

Full gate before merge — immutable container (см. выше), не только host venv.

Host-скрипты (`scripts/eliteew/validate-local.sh`, smoke под `docker/scripts/*`) **обязаны** `source scripts/eliteew/backend-venv-env.sh` — выставляет `UV_PROJECT_ENVIRONMENT=.venv` и падает, если существует a nested `.venv` under the api package dir *[forbidden — use repo-root .venv]*. CI (`.github/workflows/eliteew-pr-gate.yml`) использует отдельный `${GITHUB_WORKSPACE}/.venv-eliteew-api`, не host layout.

---

## Frontend

From `shared/web/frontend`:

| Command | Purpose |
|---------|---------|
| `pnpm run check:local` | typecheck + lint + test |
| `pnpm run check:release` | + i18n + bundle/deploy id |
| `pnpm run build:react-compiler` | After behavior-changing FE |

Entry: [product/FRONTEND-DEVELOPER-ENTRY.md](../product/FRONTEND-DEVELOPER-ENTRY.md).

---

## OpenAPI / FE–BE contracts

After API route changes:

```bash
cd shared/web/frontend
pnpm run openapi:export
pnpm run openapi:refresh-pilots
pnpm run api:gap-matrix
```

Canon: [api/FE-BE-ALIGNMENT.md](../api/FE-BE-ALIGNMENT.md).

---

## Audit cadence integration

Periodic audit-cadence / hard-acceptance one-shots soft-retired → `trash/`. Living gates: this document + [AGENT-CODE-VERIFICATION-WORKFLOW.md](AGENT-CODE-VERIFICATION-WORKFLOW.md) + immutable runner in §API tests above.

---

## Agent completion (DoD)

- Prefer **narrow** pytest/Vitest slices for the changed contract — not a full suite unless the operator asks.
- Semantic layers B/C/E: [AGENT-CODE-VERIFICATION-WORKFLOW.md](AGENT-CODE-VERIFICATION-WORKFLOW.md).
- Close with a **Commit Package** and wait for approval — [AGENT-VERIFIED-PROPOSAL-PROTOCOL.md](AGENT-VERIFIED-PROPOSAL-PROTOCOL.md). No autonomous `git commit`.
- Soft-retired DEWA/EWGen trees under `trash/` are out of test scope unless restored by the operator.

## Related

- This document §API tests (immutable runner) — diataxis how-to hub soft-retired → `trash/`
- `.cursor/rules/agent-code-verification.mdc`
- [AGENT-CAUSE-FIRST-AND-PREMIUM-UI.md](AGENT-CAUSE-FIRST-AND-PREMIUM-UI.md)
