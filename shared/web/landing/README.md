# EliteEW Landing (Secure Build + Podman)

Статический лендинг для `https://eliteew.ru`.

## Позиционирование

| Имя | Роль | Расшифровка |
|-----|------|-------------|
| **Empery World** | **Компания** | — |
| **EliteEW** | **Проект** | только **EliteEW** (без «Elite Empery World») |
| **EWA** | **Спутник** | только **EWA** (не «ЕВА», без расшифровок вроде Empery World Awakening) |
| **po&T**, **TZBrand** | **Авторы проекта** | указывать как авторов EliteEW; компания остаётся **Empery World** |

На лендинге Empery World — компания; EliteEW — главный проект компании, начатый в мае 2025 года. Авторы проекта — **po&T** и **TZBrand**. Спутник — **EWA** во всех локалях. Тексты для посетителей — **простым языком**, без внутреннего жаргона (канон: `documentation/product/handbook-kb-articles/kb-elitew-obzor-dlya-polzovatelya.md`, `documentation/product/ewa/EWA-BRAND-AND-PHILOSOPHY.md`). Проверка: `validate-naming-policy.mjs`.

## Контент (JSON)

Публичные тексты вынесены из HTML в JSON — один источник правды на язык:

```text
src/content/
├── landing.ru.json   # русский (канон)
└── landing.en.json   # английский
```

`main.js` загружает JSON (`fetch content/landing.{lang}.json`) и рендерит страницу. При сборке JSON копируется в `dist/content/`.

**Что править оператору:** только JSON-файлы (hero, продукты, путь развития, CTA). HTML — оболочка без текста.

Перед сборкой: `npm run validate:content` — структура RU/EN, запрет жаргона (`validate-plain-language.mjs`), терминология «программы» / «program store» (`validate-terminology.mjs`), **именование EliteEW / EWA** (`validate-naming-policy.mjs`), маркетинговые факты (`validate-marketing-facts.mjs`).

## Локализация (RU/EN)

- RU по умолчанию; EN — `landing.en.json`.
- Каталог на столе: **«программы»** (RU) и **«programs»** (EN); единственное **«приложение» / «Our app»** — только про EliteEW как продукт (meta description, VR/AR). На лендинге избегаем **«сервисы» / services** — говорим **программы** или **готовые продукты** (`terminology-lib.mjs`).
- **Именование:** только **EliteEW** (не Elite Empery World); спутник только **EWA** (не ЕВА, без расшифровок аббревиатуры) — `validate-naming-policy.mjs`.
- Переключатель `RU/EN` в desktop и mobile меню.
- Язык: `localStorage` (`eliteew.landing.lang`) или `?lang=en`.

## Контент-политика

- Публичный текст описывает **реальные** программы EliteEW, разработанные командой Empery World (собственная разработка, не off-the-shelf).
- Старт проекта можно указывать как **май 2025 года**; авторство проекта — **po&T** и **TZBrand**.
- Не используем выдуманные метрики («10/10», «7/7») и ложные «месячные релизы».
- Раздел «Путь развития» — **этапы проекта** (готово / развиваем / дальше), не маркетинговый таймлайн.
- В пользовательском контенте **не** упоминаем инфраструктурные и сторонние сервисы; избегаем SaaS, shell, roadmap, automation, «клиент» (в смысле приложения), agent и других внутренних терминов на публичной странице.
- FAQ (9 вопросов): «Справочник» / «Обращения»; «Чем EWA отличается от АМКА»; «Что значит VR и AR»; «Как войти» (учётная запись организации — [`kb-elitew-obzor-dlya-polzovatelya.md`](../../../documentation/product/handbook-kb-articles/kb-elitew-obzor-dlya-polzovatelya.md)).
- `index.html` shell meta (description, og/twitter, title, **keywords**) **синхронизирован** с `landing.ru.json` — проверка `validate-index-meta-shell.mjs`.
- `check:content-live` — plain-language + terminology scan на live JSON (`plain-language-lib.mjs`, `terminology-lib.mjs`); hero.lead VR/AR и FAQ≥9 для RU и EN.
- `check:index-meta-live` — live `index.html` meta (description, keywords, og/twitter alt) = `landing.ru.json`.
- Демо-видео: `kuku2.mp4` без наложенных субтитров — **не** подключаем WebVTT/`video.tracks` (текст под плеером — только `video.caption` для a11y).
- **Временное отключение demo-видео:** в `src/main.js` флаг `VIDEO_SECTION_ENABLED = false` скрывает секцию `#video`, пункт «Демо» в nav, hero/CTA/footer/mobile CTA и og:video / VideoObject JSON-LD. Контент `video` в JSON сохраняется для быстрого возврата — вернуть `true` после публикации нового MP4.
- **ТВРП** на лендинге не используется — продукт презентаций: студия в блоке «Контент и документы».

## UX (рендер из JSON)

- Продукты сгруппированы (`groupOrder`, `groupTitles`, `group` на карточке).
- Бейджи карточек: `labelTone` — `brand` | `ready` | `evolving`.
- Блок `ui`: тексты загрузки, «Наверх», меню, skip-link.
- Блок `identity`: подписи «Компания» / «Проект» для полоски в hero; **hover glow** gold (company) / purple (project).
- Секция `philosophy`: философия Empery World, **quote mark icon**, цитата (**hover gold glow**), три столпа (`key`: empery / world / awakening), карточки EWA/АМКА с `key` (`ewa` / `amka`), glow и accent border.
- Hero: полоска company/project, секционные eyebrow-метки (**hover gold accent**), иконки trust и продуктов по группам, scroll-hint внизу hero, favicon `logo_empery.png`, Open Graph meta.
- **Единая навигация по разделам:** только header (desktop) + mobile menu — `NAV_SECTIONS` + `content.nav`, scroll-spy (`getActiveNavSection` / `updateActiveNav`). Без дублирующих `#page-outline`, breadcrumb-bar и footer-nav по секциям.
- Header/nav: **фиксированная высота** шапки (без `header-compact` при скролле); при scroll только фон/тень (`header-scrolled`); md–lg — icon-only пункты по **ширине экрана**, не по scroll; без `scrollIntoView` активного пункта (нет «дёрганья»); asset `?v=` + `no-cache` на `main.js`/`output.css`.
- Philosophy EWA card: декоративный **symbol mark** (`ewaSymbolMarkSvg`) + glow; AMKA card — **symbol mark** (`amkaSymbolMarkSvg`, pink accent); pillar icon-wrap accent по `data-pillar`; **pillar/assistant hover glow** (EWA purple / AMKA pink).
- Hero chips: объекты `{ label, href }` — якоря на группы продуктов (`#products-core` и т.д.).
- Hero `stats`: три мини-карточки (20+ / EWA / 3+) с иконками и ссылками; **accent icon-wrap** по порядку (programs / EWA / platforms); **hover glow** на stat-link; CTA secondary/tertiary с иконками play/grid (**hash-link hover glow**).
- Hero `platforms`: полоска «Веб-стол · Android · VR и AR» с иконками; accent border у desktop pill; **platform pill hover glow** по `data-platform`.
- Секция `trust`: eyebrow/title/subtitle + **summary strip** (3 pill, **colored icon-wrap**, **hover glow**) + карточки с иконками, **accent border** (`data-trust-index`) и **status-colored hover glow**.
- Секция `journey`: пять шагов с optional `href`; **цвет иконки по `data-journey-index`**; active step — gold top border, **icon-wrap glow**, progress fill glow; **link hover glow** (non-active); стрелки между шагами на desktop.
- Products: sticky jump-nav по группам (`productJumpLabel`) — pill с иконкой группы; **active glow по `data-product-group`**; заголовок группы с `product-group-title-icon-wrap`; `groupHighlights` — баннер с **group-colored hover glow** по `data-group`.
- Roadmap: иконки по статусу (**status ring** на timeline node); **legend + summary strip hover**; карточки **слева/справа** от оси (`roadmap-card-side-left` — `calc(50% - 8rem)` + сдвиг влево; `-right` — `6.5rem`); **status top border**; **status-colored hover glow** на карточках; **номер этапа** `01…` по status.
- Mobile: нижняя CTA-панель (gradient top accent, play icon на «Демо», **secondary hover glow**); блокировка scroll при меню; RU/EN в footer.
- Video: eyebrow, play-hint overlay до старта (**hover darken**); `preload="none"` до viewport; подпись `video.caption` + **highlights** (3 pill, colored icon-wrap, **hover glow**); demo frame border glow + **hover intensify**.
- Roadmap: progress bar «Этапы проекта · N%» (`ui.roadmapProgress`); **fill glow** по градиенту done→planned.
- VR/AR: на лендинге **не** упоминаем Meta Quest и «шлем»; каноническая SEO-фраза **только** в `meta.description` («Наше приложение работает даже в VR и AR» / «Our app works in VR and AR too») — проверка `validate-marketing-facts.mjs`.
- Products: `groupIntros` под заголовком группы; accent border на карточках по группе; **hover — ярче top border + group-colored glow** (`data-product-group`).
- Metrics: stagger reveal + анимация чисел при появлении; **hover glow** по порядку карточек (4 accent).
- A11y: skip-link → `#main-content`; mobile menu hamburger ↔ close; `aria-controls`.
- SEO: JSON-LD Organization + WebSite + WebPage + SoftwareApplication.
- CTA: primary (app) + secondary (`cta.secondary` / `secondaryHref`, play icon via `renderHeroHashCta` → `#video`); панель с **gradient top accent**, hover glow и **icon-wrap glow**; иконка рабочего стола (`cta-icon-wrap`).
- Footer: **highlights** (app / demo / programs) с **цветными icon-wrap** и **accent hover glow**, **brand block** с `logo_empery.png` + pill EliteEW (logo hover glow), **util-links pill hover glow**, gradient CTA.
- Platforms pills — optional `href`; product groups — счётчик «N продуктов».
- Platform: **ecosystem strip** (4 pill-ссылки на группы продуктов, colored icon-wrap, **group-colored hover glow** по `data-ecosystem`) + **metricsLabel** divider; metric cards — **accent icon-wrap** по порядку.
- Hash `#section` после загрузки; retry при ошибке JSON; `aria-live` при смене языка.
- FAQ (`faq` в JSON): `<details>` аккордеон + JSON-LD FAQPage; нумерация `01…` у вопросов; **open-state accent** (gold inset border); **closed hover** border/background; счётчик «N вопросов»; пункт в header nav.
- Ready products: ribbon «Готово» (**hover brighten** on ready cards), glow на карточках; **hover intensify** на `.feature-card-ready`; `groupHighlights.clients` — баннер группы.
- Philosophy assistants: optional `href` на группы продуктов; loading skeleton; `<noscript>` banner.
- Platform metrics: optional `href` на секции; hero `badgeHref`; FAQ — один открытый пункт; prefetch app на hover CTA; у метрик иконка (`metricIconSvg`).
- JSON-LD BreadcrumbList; `og:locale:alternate`; scroll UI через `requestAnimationFrame`; «Наверх» скрывается при mobile CTA.
- Header nav: пункт **FAQ**; trust cards и roadmap phases — optional `href` в JSON.
- Footer **«Скопировать ссылку»** (`ui.copyLink` / `copyLinkDone`, **hover pill background**; **done state green glow**); FAQ deep links `#faq-item-N`.
- Video play overlay — `<button>` с `aria-label`; noscript banner sync при смене языка.
- `video.src` / `video.poster` в JSON; JSON-LD **VideoObject**; hash-nav обновляет URL + focus; mobile menu focus trap.
- Header **journey** («Ритм»); product cards → `#products-{group}` (`link: false` чтобы отключить); `meta.og.image`; hero secondary → `#video`; mobile CTA bar: **Демо** + **Открыть**.
- Hero tertiary **«Продукты»**; `video.durationLabel` / `video.caption`; `prefers-reduced-motion` для scroll; `aria-busy` при загрузке; `npm run validate:content`; `build:assets` копирует logo/mp4 в `dist/`.
- Header **video** («Демо» / Demo) после journey; journey scroll-spy (`.journey-step-active`); hero chips — horizontal scroll на mobile; product jump-nav — auto-scroll активной pill; FAQ indicator transition; `ui.mainNavLabel`; localized load-error retry; `validate:content` — parity ключей RU/EN; `npm run smoke:landing` / `scripts/smoke-landing.sh`.
- Journey **progress bar** (`ui.journeyProgress`, шаг N/5); у каждого шага иконка (`journeyIconSvg`); header nav auto-scroll активной pill; scroll-progress `role=progressbar` + `ui.scrollProgressLabel`; mobile menu `ui.mobileMenuLabel`; WebSite JSON-LD `inLanguage` ru+en.
- Video `aria-describedby` + keyboard play; JSON-LD `SoftwareApplication.featureList`; CTA `eyebrow`; video handlers без дубля при RU/EN.
- JSON-LD **ItemList** продуктов; fix `featureList` → `item.name`; OG `imageWidth`/`imageHeight` + `twitter:image:alt`; `meta robots`; preload `main.js`; `ui.langSwitcherLabel`; card/trust `aria-label`.
- Metric **count-up** (`data-metric-value`); copy-link **execCommand fallback**; roadmap/philosophy/metric `aria-label`; WebPage `about` + SoftwareApplication `url`; `npm run check:render`.
- Hash **:target flash**; hero badge/platform/chip `aria-label`; scroll-top **hover lift + gold glow**; prefetch alternate JSON; nginx static cache; Organization `description`.
- **robots.txt** + **sitemap.xml** (hreflang); VideoObject `duration`; video pause off-screen; `hashchange` nav; print styles; WebSite `ViewAction`; `ui.mainContentLabel`.
- CTA и nav: иконка внешней ссылки на `app.eliteew.ru` (`ui.externalLink` — title подсказка).
- JSON-LD `@id` graph (Organization/WebSite/WebPage/SoftwareApplication); `og:image:secure_url`; `viewport-fit=cover`; FAQ keyboard (↑/↓/Home/End); `/.well-known/security.txt`; `Cross-Origin-Opener-Policy`; `landing-build.txt`; smoke — CSP/COOP headers.
- FAQ **copy question link** (`ui.faqCopyLink*`); footer «Скопировать ссылку» — canonical без hash; `humans.txt`; sitemap `lastmod` при сборке; `npm run check:budget`; footer link `securityContact`.
- FAQ hash → **document.title** + breadcrumb (текст вопроса); `landing-meta.json` → WebPage `dateModified` + `article:modified_time`; FAQ JSON-LD `@id`; offline banner; product jump ←/→; prefetch JSON; `rel=help`; `validate:sitemap`.
- Offline layout: header с `--offline-banner-offset`; FAQ hash → og/twitter title; header/journey keyboard; `validate:meta`; optional `og-landing.png` в `build:assets`; ItemList/VideoObject `@id`.
- Header/footer nav keyboard; hero/CTA hash links `aria-label`; video Space/Enter; footer build stamp + sitemap link; `validate:dist` + `check:index`; `format-detection` meta.
- FAQ hash → og/twitter **description** (ответ); «Наверх» сбрасывает hash; `site.webmanifest`; Organization **contactPoint**; BreadcrumbList/ItemList `@id`; nginx no-cache для build meta; `validate:public`; footer **humans** link.
- FAQ hash → **og:url** с hash (canonical без hash); home/breadcrumb/«Наверх» сбрасывают hash; `validate:webmanifest` в `validate:public`; fix `build:seo` copy paths.
- **`og-landing.png`** 1200×630 (logo на тёмном фоне); `meta.og.image` в JSON; preload в shell; `validate:og`; video pause при **hidden tab** (`setupVideoTabPause`); `scripts/build-og-image.sh`.
- **Copy/share fallback** (`copyOrShareUrl` → Web Share API); **bfcache restore** (`restorePageFromBfcache`); **`validate:video`**; `video.uploadDate` в JSON; OG-подпись на картинке; print hide jump-nav/copy; smoke demo MP4.
- **Локализованные OG:** `og-landing.png` (EN) + `og-landing-ru.png` (RU); FAQ accordion **sync hash** + clear; **`validate:anchors`**; online → refresh build stamp.
- **Sitemap** RU + EN URLs + **FAQ fragment deep links** (`#faq-item-N` × locales); `landing-meta.json` **version** + `faqCount`; **`check:cache-headers`** (в т.ч. `/` no-cache); MP4 budget; hash **Back** closes FAQ; footer stamp hover = ISO + version.
- **Security/CSP parity:** index CSP ↔ nginx (`validate-csp-parity`, `validate-security-headers-config`); **`Cross-Origin-Resource-Policy: same-origin`**; **`Permissions-Policy`** с `fullscreen=(self)` / `picture-in-picture=(self)` для demo-видео; explicit nginx **`location = /`** (no-cache + security headers); **`/health`** с `X-Robots-Tag: noindex`; smoke **`check:security-headers`** (CSP, HSTS, Permissions-Policy, COOP, CORP) на `/`, JSON и `security.txt`; **`check:gzip`** + `Vary: Accept-Encoding`; **`check:mime-types`**; **`check:http-methods`** (POST/PUT/DELETE/OPTIONS → 403); **`check:charset`**; **`check:health`**; **`check:not-found`**; **`check:sitemap-live`**; **`check:spa-fallback`**; **`check:content-live`**; **`check:meta-live`**; **`check:mp4-live`**; **`check:seo-files-live`**; `validate-nginx-root-location`; `validate-nginx-health`; `validate-app-external-links`; `validate-footer-links`; `validate-humans`; `validate-lang-switcher-a11y`; `validate-index-prefetch`; `validate-print-styles`; **`og:video`** meta при наличии demo MP4; demo video **`controlslist="nodownload"`** + prefetch on play-hint hover/focus; lang toggles с **`lang="ru|en"`**; **`data-reduce-motion`** на `<html>`; `validate-nginx-gzip-config`; `validate-landing-build-txt`; `validate-logo-asset`; `meta author`; `data-landing-version`; `data-landing-lang`; reduced-motion live update; **scroll position preserved** on RU/EN switch (ratio, hash wins); **soft lang switch** (`is-lang-switching`, без skeleton flash) + abort stale fetch; **browser Back/Forward** (`pushState` + `popstate`, `history.state.landingLang`, hash/FAQ sync на том же языке); **history state preserved** on hash replace (`replaceHistoryUrl`); **bfcache** sync языка с URL; lang switcher keyboard (←/→); app CTA prefetch после re-render; `dns-prefetch` app.
- Анимации секций через `IntersectionObserver`; при `prefers-reduced-motion` — без motion.
- Переключение RU/EN без дублирования обработчиков (`AbortController`).
- Внешние ссылки на `app.eliteew.ru` — `rel="noopener noreferrer"`.

## Текущее состояние безопасности

- Без inline-script и inline-style (CSP без `unsafe-inline`).
- Логика в `src/main.js`, стили — `dist/output.css`.
- Multi-stage build + unprivileged nginx.
- CSP и security headers в `nginx/default.conf` + `nginx/security-headers.conf` (include в location с собственным `Cache-Control`, иначе nginx не наследует заголовки).
- Статика (`.css`, `.js`, `.png`, `.mp4`, `.json`, `.webmanifest`) — `Cache-Control: public, max-age=604800`; `index.html`, `landing-meta.json`, `landing-build.txt` — `no-cache`.

## Структура

```text
web/landing/
├── src/
│   ├── content/
│   │   ├── landing.ru.json
│   │   └── landing.en.json
│   ├── robots.txt
│   ├── sitemap.xml          # шаблон; dist/sitemap.xml генерируется в build:meta
│   ├── humans.txt
│   ├── site.webmanifest
│   ├── .well-known/
│   │   └── security.txt
│   ├── index.html          # оболочка
│   ├── main.js             # рендер + UX
│   └── styles.css
├── dist/                   # production-артефакты
├── scripts/
│   ├── validate-content.mjs
│   ├── validate-plain-language.mjs
│   ├── plain-language-lib.mjs
│   ├── validate-terminology.mjs
│   ├── validate-naming-policy.mjs
│   ├── naming-policy-lib.mjs
│   ├── validate-marketing-facts.mjs
│   ├── check-index-meta-live.mjs
│   ├── render-smoke.mjs
│   ├── write-build-meta.mjs
│   ├── check-asset-budget.mjs
│   ├── check-cache-headers.mjs
│   ├── check-security-headers.mjs
│   ├── check-gzip.mjs
│   ├── check-mime-types.mjs
│   ├── check-http-methods.mjs
│   ├── check-charset.mjs
│   ├── check-health.mjs
│   ├── check-not-found.mjs
│   ├── check-sitemap-live.mjs
│   ├── check-spa-fallback.mjs
│   ├── check-content-live.mjs
│   ├── check-landing-meta-live.mjs
│   ├── check-mp4-live.mjs
│   ├── check-seo-files-live.mjs
│   ├── validate-csp-parity.mjs
│   ├── validate-security-headers-config.mjs
│   ├── validate-docker-build-context.mjs
│   ├── validate-nginx-gzip-config.mjs
│   ├── validate-nginx-root-location.mjs
│   ├── validate-app-external-links.mjs
│   ├── validate-footer-links.mjs
│   ├── validate-humans.mjs
│   ├── validate-lang-switcher-a11y.mjs
│   ├── validate-index-prefetch.mjs
│   ├── validate-print-styles.mjs
│   ├── validate-nginx-health.mjs
│   ├── validate-sitemap.mjs
│   ├── validate-landing-meta.mjs
│   ├── validate-landing-build-txt.mjs
│   ├── validate-dist-manifest.mjs
│   ├── validate-robots.mjs
│   ├── validate-security-txt.mjs
│   ├── validate-webmanifest.mjs
│   ├── validate-og-image.mjs
│   ├── validate-logo-asset.mjs
│   ├── validate-video-asset.mjs
│   ├── validate-anchors.mjs
│   ├── build-js.mjs
│   ├── build-og-image.mjs
│   ├── validate-build-js.mjs
│   ├── build-og-image.sh       # обёртка → build-og-image.mjs (sharp)
│   ├── check-index-shell.mjs
│   └── smoke-landing.sh
├── nginx/default.conf
├── nginx/security-headers.conf
├── Dockerfile
├── run-podman-secure.sh
└── package.json
```

## Локальная сборка

Зависимости (dev): **Tailwind CSS 4**, **esbuild** (минификация `main.js`), **sharp** (OG PNG из `meta.og.imageAlt`), **serve** (локальный preview).

```bash
cd shared/web/landing
npm ci
npm run build:og    # опционально: перегенерировать og-landing*.png из JSON
npm run build
npm run preview     # http://127.0.0.1:29002 — статика из dist/
bash run-podman-secure.sh
npm run smoke:landing
```

Скрипт `build`:

1. `validate:content` — JSON, plain-language, terminology, marketing facts.
2. Компилирует CSS в `dist/output.css` (Tailwind).
3. Копирует `index.html`; **минифицирует** `src/main.js` → `dist/main.js` (esbuild) + `validate-build-js.mjs`.
4. Копирует `content/*.json` в `dist/content/`.
5. Копирует `logo_empery.png`, **`og-landing.png`** / **`og-landing-ru.png`**, и `*.mp4` в `dist/` (`build:assets`). Пересборка OG: `npm run build:og` (sharp, подписи из `meta.og.imageAlt`).
6. Копирует `robots.txt`, `humans.txt`, `site.webmanifest` в `dist/` (`build:seo`).
6. Копирует `/.well-known/security.txt` в `dist/.well-known/` (`build:seo`).
7. Пишет `dist/landing-build.txt` и `dist/landing-meta.json` с ISO timestamp (`build:meta`); генерирует `dist/sitemap.xml` с `<lastmod>`.

Проверка JSON: `npm run validate:content` (включена в `npm run build`).

Render smoke (секции + символы `main.js`): `npm run check:render`.

Asset budget (`main.js` ≤96 KiB / `output.css` ≤100 KiB / OG / demo MP4): `npm run check:budget` (включён в `npm run build`).

Cache headers (нужен запущенный контейнер): `npm run check:cache-headers`, `npm run check:security-headers`, `npm run check:gzip` и `npm run check:mime-types` (в `npm run smoke:landing`).

CSP/security config (без контейнера): `validate-csp-parity` и `validate-security-headers-config` в `validate:public`.

Smoke после деплоя: `npm run smoke:landing` (или `LANDING_SMOKE_URL=… bash scripts/smoke-landing.sh`).

## Secure Podman запуск

```bash
cd <repo>/shared/web/landing
bash run-podman-secure.sh
```

Контейнер: `127.0.0.1:29002 -> 8080`, health `/health`.

`PODMAN_PULL=missing` по умолчанию (не тянет базовые образы при каждом деплое; для принудительного обновления: `PODMAN_PULL=always bash run-podman-secure.sh`).

Multi-stage Dockerfile: build-стадия копирует `nginx/` и `Dockerfile` **до** `npm run build` (нужно для `validate:public` — CSP parity и docker build context).

## Публикация на `https://eliteew.ru`

См. reverse tunnel `29002` и `docker/scripts/yandex-tunnel/deploy-nginx-root-to-vm.sh` — без изменений.

## Быстрые проверки

```bash
curl -fsS http://127.0.0.1:29002/health
npm run smoke:landing
curl -fsSL "http://127.0.0.1:29002/content/landing.ru.json" | rg -n "EliteEW для Android|VR и AR"
```

Проверить security headers: `content-security-policy`, `cross-origin-opener-policy`, `x-frame-options`, `strict-transport-security`.
Проверить `/.well-known/security.txt`, `/humans.txt` и `/landing-build.txt`.
