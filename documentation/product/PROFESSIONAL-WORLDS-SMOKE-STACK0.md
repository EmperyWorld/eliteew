# Professional Worlds — stack0 smoke (operator)

Автоматизированный слой: `./docker/scripts/professional-worlds-stack0-smoke.sh` (API health + pytest bundle). Опционально `--with-vitest` для desktop client suite на хосте; `--with-playwright` для Playwright journey (`e2e/professional-worlds-desktop-journey.spec.ts`, нужны `DESKTOP_SHELL_E2E_RUN=1` и `MC_E2E_BASE_URL`); `--with-admin-metrics` для `GET /professional-worlds/admin/ops/metrics` (нужен `PW_SMOKE_ADMIN_BEARER`).

Канон продукта: [`PROFESSIONAL-WORLDS.md`](PROFESSIONAL-WORLDS.md).

## 1. Automated (CI / оператор перед релизом)

```bash
# из корня монорепо
./docker/scripts/professional-worlds-stack0-smoke.sh
./docker/scripts/professional-worlds-stack0-smoke.sh --with-vitest
MC_E2E_BASE_URL='https://app.eliteew.ru' ./docker/scripts/professional-worlds-stack0-smoke.sh --with-playwright
PW_SMOKE_ADMIN_BEARER='…' ./docker/scripts/professional-worlds-stack0-smoke.sh --with-admin-metrics
```

Переменные:

| Env | Default | Назначение |
|-----|---------|------------|
| `PW_SMOKE_API_CONTAINER` | `stack0-eliteew-api-prod` | API-контейнер для health/pytest |
| `ELITEEW_CONTAINER_RUNTIME` | `podman` | `podman` или `docker` |
| `MC_E2E_BASE_URL` | — | Authenticated SPA base URL для `--with-playwright` (skip с сообщением, если пусто) |
| `PW_SMOKE_ADMIN_BEARER` | — | Admin JWT для `--with-admin-metrics` (skip с сообщением, если пусто) |

Pytest внутри контейнера:

- `tests/test_professional_worlds_router_split.py`
- `tests/test_professional_worlds_runtime_config.py` (arch cap ≤800L + runtime SQL guards)
- `tests/test_professional_worlds_pack.py` (fixture `api/tests/fixtures/packs/`)
- `tests/test_professional_worlds_snapshot.py`
- `tests/test_professional_worlds.py`
- `tests/test_realtor_pro.py` (Realtor Pro domain barrel after Fast-Track split)
- `tests/test_professional_worlds_media_target_adapter.py` (media facade context_type)

Vitest (флаг `--with-vitest`, хост) — **фокусный Professional Worlds suite**:

```bash
cd shared/web/frontend
pnpm exec vitest run src/features/professional-worlds/
```

Ожидание: **385/385** (63 files, delete confirm + Cause-First measure sync, 2026-07-03).

Playwright (флаг `--with-playwright`, хост + auth storage):

```bash
cd shared/web/frontend
DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru \
  pnpm exec playwright test e2e/professional-worlds-desktop-journey.spec.ts
```

Проверяет: открытие PW на Desktop, sidebar group labels (Today / Listings / Clients & deals / My image / Drafts), Objects → default photos path («Choose from library», «Upload photos»; без batch/advanced до раскрытия). Пропускает шаг photos, если у аккаунта нет listings.

## 2. Deploy gate (frontend)

После изменений UI:

```bash
cd shared/web/frontend
pnpm run build:react-compiler
node scripts/verify-app-build-id.mjs
```

При mismatch deploy id — см. `documentation/platform/docker-re_doc/FRONTEND-STALE-CHUNK-404.md`, затем с **command-center** полный release `bash docker/scripts/eliteew-deploy.sh release stack0 --all` (или hotfix-линия `eeprodline`; локальный recreate на `.136` — только dev/fallback).

## 3. Manual checklist (desktop)

1. Открыть **Professional Worlds** на Desktop → vertical **Realtor**.
2. **Overview / normal-state visible redesign:** выбран tab **Пульс**, above the fold видны hero “Сегодня в работе”, next-best-step card, readiness rail, journey cards (profile / object / clients / guided tasks), trust note “Что не произойдёт автоматически”.
3. **Sidebar:** меню сгруппировано по ментальной модели риэлтора: `Сегодня`, `Объекты`, `Клиенты и сделки`, `Мой образ`, `Черновики`; runtime-названия вроде `Профиль специалиста`, `Публичное присутствие`, `Сценарии`, `Артефакты` не подменяют основные labels; locked rows по-прежнему фокусируются клавиатурой и показывают visible reason.
4. **Progress states:** first-run, mid-progress, complete отличаются hero title и primary CTA; complete появляется только после ready profile + onboarding steps + first listing.
5. **Objects → selected listing:** first screen starts with listing summary and editable facts; primary tasks read as description/materials and photos, not a module hub.
6. **Objects → Photos:** default area shows “Выбрать из медиатеки” and “Загрузить фото”; no visible batch/preset/job/runtime/support-ID wording before expanding advanced processing.
7. **Objects → post-create:** success card offers `Открыть объект`, `Добавить фото`, `Подготовить описание`; deal/showing/document/marketing jumps stay out of the default success block.
8. **Marketing** addon: создать кампанию (**Save campaign**); **Edit** → **Save changes**; toast success.
9. **Documents** addon: добавить строку чеклиста (**Save document**); **Edit** → **Save changes**.
10. **Clients** (buyers): сохранить buyer requirement (**Save requirement**); toast success.
11. **Deals pipeline**: сменить stage → toast «Deal stage updated»; **Add timeline event** с note → toast.
12. **Communications**: quick log (**Add log**) → toast «Communication logged».
13. **Objections**: **Save reply** → toast; **Edit** существующего ответа.
14. **Marketing → Publication channels**: **Add channel** → toast; сменить status select → при ошибке API — error toast (не raw Zod).
15. **Playbooks** (sidebar): Run сценарий; во время stream видны contract copy + **Stop waiting**. После Stop waiting нет “успеха”; **Recent runs → Refresh** показывает terminal state / resume path. Для run **Error** / **Cancelled** — **Resume**; вкладка **How it works** переключается без ошибок.
16. Locked section: выключить один addon или открыть вертикаль без раздела → sidebar row фокусируется клавиатурой, имеет badge и visible reason; клик не переводит в мёртвый раздел.
17. Offline / broken API response: state panel / banner / toast показывают понятное сообщение (`realtorPro.errors.apiContract` или fallback), а raw `Error.message` остаётся только в support details.
18. Outcome cards: Profile save говорит, что ничего не опубликовано автоматически; Objects → create listing ведёт к фото/описанию, а downstream действия требуют отдельного явного выбора.

### 3.12 Delete confirm (Cause-First Wave 1 / Delete MVP)

Предусловие: vertical **Realtor**, есть хотя бы один client, deal, saved draft, listing, showing и task (создать через Profession tools / Clients / Objects / Results при необходимости).

Общий контракт для всех шести поверхностей: клик **Remove** / **Удалить** / **Убрать** → modal с title + warning + **Cancel** / confirm; **без** поля typed DELETE; API **не** вызывается до confirm; после **204** строка исчезает + success toast где применимо; при ошибке API строка остаётся, modal можно закрыть.

| # | Surface | Где в UI | Проверка |
|---|---------|----------|----------|
| 1 | **Client** | Clients → directory row **Remove client** | Modal `clients.deleteTitle`; confirm → client gone; при linked deals — **409** banner, client остаётся |
| 2 | **Deal** | Clients → deal row **Remove deal** | Modal `deals.deleteTitle`; confirm → deal gone from directory/pipeline |
| 3 | **Saved draft** | Results (Artifacts) → library row **Remove draft** | Modal `artifacts.deleteTitle`; confirm → draft removed from list |
| 4 | **Listing** | Objects → saved listing **Remove from portfolio** | Modal `objects.deleteTitle`; confirm → listing hidden; deals lose listing link (FK null) |
| 5 | **Showing** | Profession tools → **Showings** → row **Remove showing** | Modal `realtorPro.showings.deleteTitle`; first click **не** удаляет; confirm → row gone + delete success toast |
| 6 | **Task** | Profession tools → **Tasks** → row **Remove task** | Modal `realtorPro.tasks.deleteTitle` (не showings copy); confirm → row gone |

Дополнительно для showings/tasks:

7. Showings: открыть modal → **Cancel** → showing остаётся в календаре; simulate API error (offline) → row не пропадает.
8. Tasks: то же для cancel и failed DELETE; task title виден в modal body как `itemName`.

### Domain-only visual smoke

Browser evidence for visual redesign is valid only through `https://app.eliteew.ru/#desktop`. If the current source build has not been deployed through baked/dev-bind stack0, the domain may still show the previous Overview pulse/metric UI; record that as “not yet deployed” rather than using localhost preview evidence.

### 3.11 Cross-app handoff lifecycle (waves 48–49)

Предусловие: есть listing с artifact в **Saved results**.

1. **Results → Send to apps** — создать handoff в **GAF Chat**; открыть destination.
2. Выбрать чат, отправить сообщение (текст из PW seed или с вложением).
3. Вернуться в PW → **Send to apps** → **Refresh status** у строки handoff: lifecycle **`published`** (или уже `published` без refresh, если report успел).
4. (Опционально) повторить для **EWRP**: handoff → Generate → дождаться PDF → Refresh → **`published`**.
5. Overview pulse: stale banner **не** считает `published` строки (только recovery-needed).

6. **EWDesk (admin):** handoff → EWDesk banner → **Open admin publish** → publish post → PW link **`published`** (Refresh optional).

### Mobile embedded (Android WebView)

Allowlist: Overview, Profile, Clients, Artifacts, **Listings/Objects photos** (`MOBILE_EMBEDDED_VIEWS` in `mobileEmbeddedViews.ts`). Profession tools / playbooks скрыты в embedded layout; Objects — read-only summary + photo upload only (без advanced batch AI).

Smoke: `#/mobile-professional-worlds` → session loading/retry copy localized → Profile save → Clients list без horizontal scroll → **Objects**: pick listing → upload photos / choose from library. В narrow/mobile surface sidebar is horizontal rail; primary actions remain visible without clipping.

### Reduced motion / low GPU

1. Browser devtools → emulate `prefers-reduced-motion: reduce` or OS setting → Job progress bar still exposes `role="progressbar"` and terminal message; no state depends on pulse/glow.
2. Desktop low-GPU mode on → media review badges and modal backdrop stay readable without blur/black overlay dependency.
3. Admin tabs/buttons remain keyboard focusable; motion-reduce path disables transitions without hiding selected state.

## 4. OpenAPI / client regression (optional, host)

Focused Vitest subset — см. [`PROFESSIONAL-WORLDS.md`](PROFESSIONAL-WORLDS.md) § локальная верификация.

## 5. Связанные каноны

- [`PROFESSIONAL-WORLDS.md`](PROFESSIONAL-WORLDS.md) — продукт, OpenAPI adoption, post-adoption UX
- [`PROFESSIONAL-WORLDS-NEXT-BASELINE.md`](PROFESSIONAL-WORLDS-NEXT-BASELINE.md) — status matrix
- [`FRONTEND-STALE-CHUNK-404.md`](../platform/docker-re_doc/FRONTEND-STALE-CHUNK-404.md) — deploy id gate
