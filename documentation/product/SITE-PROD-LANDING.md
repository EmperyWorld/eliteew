# SITE-PROD — публичный лендинг EliteEW (`eliteew.ru`)

Канон позиционирования, контентной воронки и cutover для **нового** публичного лендинга. Не путать с SPA `app.eliteew.ru`, Site Studio (`{slug}-site.eliteew.ru`) или маркетинговым кабинетом AMKA.

## Границы

| | |
|--|--|
| **Продукт на сайте** | **EmpiierOS** (операционная система x86_64 на диске; copy SoT: артефакт `reestr-mintsifry/11-website/`) |
| **Позиционирование** | Локальное графическое рабочее место · Buildroot пол · без записи в реестре · цена по запросу · не облачный кабинет `app.eliteew.ru` |
| **Публичный URL** | `https://eliteew.ru` |
| **Целевой исходный код** | `shared/web/site_prod/` (Next.js **16.3.5** App Router + React **19.3** + TypeScript **7** + ESLint **10**; `pnpm lint` shims TS6 for `typescript-eslint@8` until upstream supports TS7) |
| **Архив в дереве** | `shared/web/landing/` — **не редактировать** в рамках программы site_prod; runtime заменяется cutover’ом, не правкой старого кода |
| **Не scope** | Desktop shell, Assistant, Vercel, CRM-интеграция лидов |

## Runtime status (living)

| Состояние | Источник кода | Контейнер / порт | Когда |
|-----------|---------------|------------------|-------|
| **Live (Target)** | `shared/web/site_prod/` | image `local/eliteew-site-prod:secure` → `stack0-eliteew-landing` `:29002` | **Cutover 2026-08-05** (`.136`→`.111`); public `https://eliteew.ru/` |
| **Deploy path** | тот же | `eliteew-landing-deploy.sh --yes` exports `LANDING_IMAGE` on recreate (prod-core git tree may lag) | каждый release landing |
| **Archived source** | `shared/web/landing/` | не редактировать; старый tag `local/eliteew-landing:secure` не default | до soft-retire |

Edge upstream port `:29002` unchanged. **CSP / methods** on edge vhost `docker/host_conf/nginx-root-landing.conf` are tuned for **Next site_prod** (not the old static landing):

| Directive / rule | Value | Why |
|------------------|-------|-----|
| `script-src` | `'self' 'unsafe-inline'` | Next.js RSC / App Router inline bootstrap |
| `style-src` | `'self' 'unsafe-inline'` | Framer Motion + runtime styles |
| `form-action` | `'self'` | funnel forms |
| `POST /api/lead` | allowed (`location = /api/lead`) | lead JSON API; other methods on `/` still GET/HEAD only |
| Brand mark | plain `<img src="/logo_empery.png">` (`BrandLogo`) | public edge historically **404** on `/_next/image`; static PNG is OK (upstream `:29002` optimizer works) |
| Deploy edge | `bash docker/scripts/yandex-tunnel/deploy-nginx-root-to-vm.sh` | after CSP/method changes |

**Invariant:** recreate on `.111` must use `LANDING_IMAGE=local/eliteew-site-prod:secure` (deploy script sets it). After script changes, sync `prod-core-landing-lib.sh` (+ `prod-core-landing-start.sh`) onto prod-core `docker/scripts/` so autostart defaults match — prod-core checkout is not auto-updated from git.

**Healthcheck (Cause):** rootless/pasta netns may bind Next to a LAN IPv4 (e.g. `192.168.1.111:8080`) while the image HEALTHCHECK probes `127.0.0.1` → container stays `unhealthy` even when `:29002/health` is 200. `prod-core-landing-lib.sh` overrides `--health-cmd` to probe **every IPv4** in the netns (and `Dockerfile` HEALTHCHECK matches). Host wait still uses `http://127.0.0.1:29002/health`.

Deploy (command-center):

```bash
bash docker/scripts/eliteew-landing-deploy.sh --yes
```

Local hardened:

```bash
bash shared/web/site_prod/run-podman-secure.sh
```

Топология cloud: [platform/PRODUCTION-TOPOLOGY-STATE.md](../platform/PRODUCTION-TOPOLOGY-STATE.md) §Current · Landing.

- **Проблема:** Shadow IT на mid-market (100–1000), BYOD / гибрид — утечки через личные мессенджеры, облака, AI/копипаст.
- **Решение:** разделение рабочего и личного (separation), не «контроль сотрудников».
- **Три столпа:** Sandboxing (цифровой купол) · Zero-Agent / безагентный доступ (браузер или Android APK) · Instant Provisioning (ссылка → рабочее место).
- **Ниша vs DLP:** быстрый рычаг поверх текущего стека; не замена firewall/антивируса.
- **JTBD (блок `#jobs`):** header chips (mid-market / BYOD / separation) → buying committee figure (`JOB_COMMITTEE_META`, flow CISO→CEO→employee) → три портрета в `src/content/jobs.ts`. Separation, не «контроль за людьми».

Подробные брифы и черновики копирайтинга (вне git): `/home/owned/site_doc/task.md`, `/home/owned/site_doc/dialog.md`. Живые строки UI в репозитории: `shared/web/site_prod/src/content/`. `[Brand TBD]` в исходных материалах → **EliteEW**.

## Storytelling flow (7 блоков)

Порядок на странице: **Hook → Problem → JTBD → Solution → Differentiation → Proof/FAQ → Closer → Quiz → Contact (combined lead pack)**.

Секции сидят на открытом `bg-(--color-bg)` — **без** общего `Section glass` пузыря (`rounded-2xl` + `bg-(--color-surface)`). Карточки/фигуры внутри секций остаются локальными surface.

1. **Hero (Hook)** — split H1 (pain + one-click promise); audience + trust chips; dual-path CTA cards (quiz / demo); Layering `TransformationScene`: clickable Stage A photos (risk imitation) + Stage B dome apps/files with imitation job UI (`BrandLogo`, tiles, session files, pillars).
2. **Problem** — header chips + figure «дверь / окна»; rose scenario cards with leak panels; door/agent gap tones; numbered risks; ROI CTA strip (`ProblemSection`).
3. **JTBD** — buying committee flow (CISO → CEO → employee) + портреты с tone badges (lead/buyer/user), боль/Jobs panel/резонанс (`JobsSection`); separation для employee.
4. **Solution** — header trust chips + Layer stack A/B + три столпа с tone badges (Isolation / BYOD / TtV) + dual CTA (`SolutionSection`).
5. **DLP vs EliteEW** — header chips + Time-to-Value figure + lead criterion «Скорость внедрения»; numbered duel cards; killer + TCO note; TCO CTA strip (`ComparisonSection`).
6. **Proof + FAQ** — Air Gap A/B + Fact/Hypothesis columns + expert kit (whitepaper placeholder + contact CTA); Objection Map accordion (`ProofSection`).
7. **Closer** — ladder chip + soft/hard path tones; friction + deliverable panel; no buy-or-leave (`CloserSection`).
8. **Quiz** — ladder chip + teal shell; А/Б/В options; risk-tone result + next-step strip + sticky lead (`QuizSection` / `RiskQuiz`).
9. **Contact** — ladder chip + numbered interest tones (demo/PoC/ROI/TCO); pack summary + sticky contact + one-POST submit strip (`CombinedLeadSection`, `intent=bundle`); якоря `#demo|#poc|#roi|#tco|#contact`.
10. **Footer** — Empery logo (`BrandLogo` / `public/logo_empery.png`) + brand + in-page nav (`#hook` = «Старт») + app link + canonical [MIT source](https://github.com/EmperyWorld/eliteew) + structured privacy panel (`SiteFooter` / `privacyPanel`).
11. **Header** — sticky glass chrome: Empery `BrandLogo` → `#hook`, active-section spy nav, Data Isolated chip, CTA `#contact`, mobile menu (`SiteHeader` + `HEADER_META`).

### CTA ladder (intents)

| Блок | CTA | Intent / target |
|------|-----|-----------------|
| Hero | Экспресс-аудит · Демо | `#quiz` · `#contact` (interest `demo`) |
| Problem | Стоимость утечки | `#contact` (interest `roi`) |
| Solution | Пилот Sandbox | `#contact` (interest `poc`) |
| Comparison | Таблица TCO | `#contact` (interest `tco_table`) |
| Closer | Аудит · PoC | `#quiz` · `#contact` |
| Contact pack | Комбинированный запрос | `POST /api/lead` `intent=bundle` + `interests[]` |

Quiz (3–5 вопросов) → risk profile на экране → контакт через `POST /api/lead` (`intent=quiz` + `quiz_results`). Demo/PoC/ROI/TCO — **одна** форма `#contact` (`CombinedLeadSection`): multi-select → `intent=bundle` + `interests`. Якоря `#demo|#poc|#roi|#tco` сохранены (preselect). Persist MVP: JSONL under `LEAD_DATA_DIR` (default `/tmp/eliteew-leads`) + опционально `LEAD_WEBHOOK_URL`. Без silent success при сбое API. Rate-limit на IP.

### Канонические формулировки (RU)

- **H1 (пример):** «Ваш бизнес — в личном мессенджере ваших сотрудников? Создайте защищенный рабочий контур за один клик».
- **Sub:** «Изолируйте корпоративные данные от личного хаоса сотрудников. Безопасная среда в браузере или Android без установки агентов контроля».
- **Closer:** «Обеспечьте безопасность ваших данных, не нарушая личное пространство сотрудников. Ваш цифровой периметр готов к развертыванию за 5 минут».

Engineering gate: claim «без установки агентов» сверять с фактической архитектурой продукта перед публикацией.

## Tone of Voice и red flags

**ToV:** спокойная экспертность — факты, TCO, time-to-value, минимизация рисков. Без «уникальный / революционный / лучший / инновационный».

| Запрещено | Вместо |
|-----------|--------|
| 100% защита / гарантируем безопасность | Механизмы минимизации рисков, изоляция данных, защита цифровых каналов |
| Слежка / мониторинг сотрудников / контроль за людьми | Разделение личного и корпоративного; целостность рабочего периметра; аудит использования ресурсов |
| Заменим весь ИБ-стек | Дополнительный слой для BYOD / гибридных команд |

**Лексика продукта:** Safe Workspace · цифровой периметр · среда изоляции (Sandbox) · безагентный доступ · развертывание без вмешательства в локальную ОС. Не продавать «ОС».

## Fact vs Hypothesis (блок Proof)

| Класс | Содержание |
|-------|------------|
| **Fact** | **Sandboxing (Cloud):** браузерный рабочий слой отделён от личного Shadow IT / «файлов на столе» ОС — **не** стерильный OS-sandbox и не запрет любых browser artifacts. **Agentless**; **Instant Provisioning**. FoFline = connected-client (local pack + WG/SOCKS), не air-gap. |
| **Hypothesis (PoC / policy)** | **Стерильный диск / wipe / clipboard quarantine** как универсальный Fact для всех edition — запрещено. Latency (~200 мс); аналоговые утечки (фото экрана) — минимизация, не абсолют |

**Edition honesty (CISO bar):** не продавать Landing Fact как FoFline sterile sandbox или «session never touches personal disk». Living FoFline security contract: `documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md`.

## Visual system (кратко)

Cyber-minimal Layering (brief `/home/owned/site_doc`): **stage chrome** A/B (кликабельные шаги + `flowHint`) → **device frame** (личный BYOD laptop, `LAYERING_DEVICE`) → слой хаоса Stage A с **generic** каналами (мессенджер / облако / AI-чат — без товарных знаков сторонних продуктов) → по CTA **стеклянный Safe Workspace купол** поверх (хаос остаётся blurred under). Stage chrome A/B (`transformVisual` + `TransformationScene`). Токены: `--color-bg` `#0B0E14`, `--color-accent` `#00F2FF`, `--color-surface` glass. Brand icons: `src/app/favicon.ico` + `icon.png` / `apple-icon.png` from `logo_empery.png`; header/footer mark: `public/logo_empery.png` via `BrandLogo`. Diagrams/UI — SVG/CSS; `prefers-reduced-motion` сокращает float/scale.

## Deploy cutover (оператор)

Build только на command-center `.136`. Run на prod-core `.111`.

**Done 2026-08-05:** `eliteew-landing-deploy.sh --yes` → image `local/eliteew-site-prod:secure` on `:29002`; smoke health + public title Safe Workspace. Follow-up: deploy exports `LANDING_IMAGE` (prod-core git may lag); sync `prod-core-landing-lib.sh` / `prod-core-landing-start.sh` onto `.111` when defaults change.

Repeat release:

1. `bash docker/scripts/eliteew-landing-deploy.sh --yes` on `.136`.
2. Smoke: `ssh 192.168.1.111 'curl -sf http://127.0.0.1:29002/health'` + `curl -sf https://eliteew.ru/health`.
3. Confirm `podman inspect stack0-eliteew-landing --format '{{.Config.Image}}'` → `…/eliteew-site-prod:secure`.

Старый tree `shared/web/landing/` оставлять в репо до отдельного soft-retire (`trash-move.sh`).

## Acceptance (контент)

- Separation, не surveillance; фокус Shadow IT / BYOD.
- Dual CTA + mid-block ladder; Fact vs Hypothesis явно.
- Нет fluff и абсолютных гарантий; privacy/DPA notice у форм сбора лидов.
- `shared/web/landing/**` без правок в программе site_prod.

## Related

- [platform/PRODUCTION-TOPOLOGY-STATE.md](../platform/PRODUCTION-TOPOLOGY-STATE.md) — cloud runtime / `:29002`
- [platform/DOCKER-STACKS-PROD-OVERVIEW.md](../platform/DOCKER-STACKS-PROD-OVERVIEW.md) — stack0-landing
- [platform/docker-re_doc/STACK-CONTAINER-CONTROL.md](../platform/docker-re_doc/STACK-CONTAINER-CONTROL.md) — landing pod
- [product/marketing/README.md](marketing/README.md) — кабинет AMKA (≠ этот лендинг)
- Исходные брифы оператора: `/home/owned/site_doc/` (вне git)

## EmpiierOS pages (2026-09-22)

Additive routes only. The `/` Safe Workspace funnel, lead API, and quiz stay in place.

| Path | Role |
|------|------|
| `/empiieros` | OS landing |
| `/empiieros/description` | Functional description |
| `/empiieros/price` | Price on request, no amount |
| `/empiieros/docs` | Docs index |

Copy lives in `src/content/empiieros.ts`. Header and footer gain a link outside the in-page anchor lists. A public HTTP 200 appears only after the landing image is rebuilt and deployed. Until then the registry SITE row stays fail.
