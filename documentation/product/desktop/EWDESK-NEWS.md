# EWDesk — новости компании (лента на рабочем столе)

**Status:** Канон продукта · optimization waves 1–10 **Done** (server pagination, filters, FTS, counts, realtime invalidate — chronology in `git log` / soft-retired program note under `trash/`).  
**Доказательства:** pytest / Vitest в program doc; chronology — `git log` (worklog retired).

**Код:** оркестратор `EWDeskApp.tsx` (default export, lazy-import path stable; ≤800 LOC) + extracts в `shared/web/frontend/src/pages/Desktop/components/ewDesk/` — `EwDeskFeedListSection`, `EwDeskFeedDetailSection`, `EwDeskAppHeader`, `useEwDeskAppKeyboard`, `EwDeskListContextMenu`, `EwDeskPwDraftBanner`, `EwDeskMobileBackBar`, `useEwDeskAppOptionFocus` (+ prior hooks/rows/media). API **`shared/api/routers/product_desktop_news.py`** (подключается из `product_desktop.py`, префикс `/api/v1/product-desktop`); контрактные хелперы **`shared/api/services/product_desktop/ewdesk_news_contract.py`**; таблица **`company_news_posts`**.

### Mobile Android (embedded SPA, OTA ≥ 0.2.164)

- Hash: `#/mobile-ewdesk` → `MobileEwDeskPage` → `EWDeskApp embeddedMobile`.
- Desktop parity: поиск, фильтры, starred, list/detail navigation; native compact feed на вкладке EWDesk остаётся.
- Точки входа: **Feed tab** (карточка «Полный EWDesk»), **Desktop Hub**. Канон: [MOBILE-ANDROID-EMBEDDED-SPA-UI-STYLE.md](../mobile/MOBILE-ANDROID-EMBEDDED-SPA-UI-STYLE.md) §4.7.

**Living product canon for EWDesk feed:** this file (API, media, admin, migrations, UX).

## API (чтение)

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/news` | Пагинированный список **`{ items, total, limit, offset, next_cursor? }`**. Query: **`q`** (full-text по title/body; при фрагменте UUID — также `id ILIKE`), **`limit`**, **`offset`** или **`cursor`** (keyset, без `q`), фильтры и **`sort`** |
| GET | `/news/counts` | `{ unread_count, starred_count, pinned_count, total_published, latest_published_at }` — единый источник для toolbar EWDesk и badge на иконке (общий React Query key `news-counts`) |
| GET/PATCH | `/news/my-state` | Синхронизация прочитанного/избранного между устройствами |
| GET | `/news/{id}` | Полный пост с Markdown-телом |
| GET | `/news-linked-{image\|video\|audio}/{content_id}` | Blob медиа (кэш React Query на клиенте, `Cache-Control: private, max-age=3600`). Object URL **не** отзывается при unmount строки/окна и **не** при refetch: список и деталь делят один URL, пока запись жива в кэше (`gcTime` 30 мин). Revoke — только при удалении query (GC / logout / `clear`). Иначе `blob:… ERR_FILE_NOT_FOUND` и `onError` прячет все медиа. |

**Состояние пользователя (миграция `20260527_ewdesk_user_news_state.sql`):** таблицы `ewdesk_user_news_state` (read/starred по посту) и `ewdesk_user_feed_meta` (`last_seen_published_at`). При первом входе клиент мигрирует localStorage → PATCH `/news/my-state`.

**Виджет на столе:** слот `ewdesk` — превью заголовков (`GET /news?limit=4`, отдельный React Query key `widget-preview`); **`GET /news/counts`** + **`GET /news/my-state`**; prefetch counts/state при mount workspace с debounce 8 с (`useEwDeskNewsDesktopPrefetch.ts`). Строки новее `last_seen_published_at` подсвечиваются в виджете.

**Realtime (Socket.IO):** при create/update/delete поста в админке сервер шлёт **`ewdesk.news_updated`** в комнату **`ewdesk_feed`**. `DesktopSocketNotificationsBridge` debounce ~220 ms → invalidate `['product-desktop','news']` и **`news-counts`**; toast с кнопкой «Открыть» (deeplink `EWDeskApp` + `ewDeskNewsId`). PATCH `/news/my-state`: всегда **`news-counts`**; лента **`news`** — только если в кэше активны фильтры «Непрочитанные»/«Избранное» (`ewDeskNewsQueryInvalidation.ts`).

**Лента в UI:** фильтры и сортировка на сервере; при **`q`** порядок — релевантность (`ts_rank`), подсветка совпадений в заголовке и excerpt (`ewDeskSearchHighlight.tsx`); без **`q`** подгрузка через **`next_cursor`** (keyset) или **`offset`** при поиске; IntersectionObserver (`useEwDeskNewsAutoLoadMore.ts`); toolbar badges — `useEwDeskNewsCounts.ts` + **`GET /news/counts`**. Состояние фильтров — `ewDesk/ewDeskListFilterState.ts`, сводка активных фильтров — `ewDeskActiveFilterParts.ts`. Список — `role="listbox"` + `aria-activedescendant` (`ewDeskListOptionDomId`); строка показывает **`body_excerpt`** (`ewDeskListExcerpt.ts`). Клавиатура: **Ctrl+F** / **/** — поиск; **?** — панель подсказок; **j/k**, **r**, **s**, **u**, **l** (копировать ссылку; см. `focusSearchHint`). Deeplink **`?ewdesk_news=`** (`ewDeskDeepLink.ts`, `useDesktopUrlLaunchEffects`) открывает пост по ID даже вне первой страницы ленты; toast при недоступном материале. Копирование ссылки — кнопка в шапке материала, контекстное меню строки, **l**. «Все прочитано» — confirm при ≥5 непрочитанных (`EWDESK_MARK_ALL_READ_CONFIRM_MIN`).

**Порядок маршрутов:** статические `/news/counts`, `/news/my-state` объявлены **до** `/news/{post_id}` — иначе FastAPI трактует literal-сегменты как UUID и отдаёт 422 (см. `test_product_desktop_news_routes.py`).

**Админка:** Unified Admin → раздел EWDesk — stable path `pages/Admin/EwDeskAdminSection.tsx` (thin facade); реализация в `pages/Admin/ewDeskAdmin/` (`EwDeskAdminSection.tsx`, `useEwDeskAdminSection.ts`, `EwDeskAdminEditNewsForm.tsx`, media previews, AI polish). Создание и правка постов; в списке — чекбоксы, «Перегенерить с ИИ» по выбранным (по одному запросу polish + сохранение на запись, последовательно).

**Стиль текста и обложек (v2, канон с 2026-06-14):** [EWDESK-POST-STYLE-V2.md](EWDESK-POST-STYLE-V2.md) — живой язык без шаблонных блоков; Comfy — абстрактная футуристика, без UI/текста в `clip_prompt`.

**Пакет из репозитория (редко, для оператора):** скрипт `shared/api/scripts/publish_ewdesk_news_batch_direct.py` в контейнере `stack0-eliteew-api-prod-baked` подставляет черновики и обложки из `host/comfyui/`. Для **новых** дат используйте **`--no-rewrite`** (текст уже в стиле v2). **Обновить** уже опубликованные посты (текст + обложка, даты не меняются): `shared/api/scripts/apply_ewdesk_batch_v2.py` + манифест `ewdesk_batch_manifest_v2_full.json`. Старый polish через LLM (`--rewrite` / админка «Перегенерить с ИИ») — legacy-шаблон; для пакетов предпочтителен v2-черновик.

ComfyUI на prod-core `.111` (часто LAN `127.0.0.1:31003` на хосте), workflow `01_top.json`, обёртка промпта — `ewdesk_comfy_heroes.py`. Полный манифест v2: `ewdesk_batch_manifest_v2_full.json`; пакет **14 июня – 17 августа 2026**: `ewdesk_batch_manifest_20260614_0817.json` + черновик `EWDESK-POSTS-BATCH-DRAFT-2026-06-14-08-17.md` (генератор `shared/api/scripts/generate_ewdesk_daily_batch_from_git.py`). Старые пакетные черновики soft-retired из `host/comfyui/` → `trash/` (apply требует явный `--draft-glob`). PNG: `ewdesk_comfy_out/<slug>.png`. Legacy только картинка: `regenerate_ewdesk_news_from_db.py --images-only`. Дата новой вставки — префикс `YYYY-MM-DD-` в slug; `--backfill-published-dates-only` — только даты.

Черновик текста можно **переписать с ИИ** (кнопка у подписи «Форматирование»): **`POST /api/v1/product-desktop/admin/news/polish-body`** (только админ), ответ API — JSON с полями `body` и опционально `title`. Системный промпт теперь ведёт модель в **фиксированный релизный шаблон** (эмоциональный стиль): короткий лид, блок `## Что вы почувствуете`, блок `## Что это даёт в реальной работе`, финальная цитата; при уместности — блок **«Быстрый переход»** с deeplink-ссылками на desktop-приложения в формате `/__eliteew-desktop-open-app__/ComponentName`. Промпт жёстко ограничивает текст рамкой user-facing (без технических терминов и внутреннего стека), требует русский язык и запрещает выдумывать факты. Модель отдаёт результат с маркерами `<<<EW_TITLE>>>` / `<<<EW_BODY>>>`, чтобы тело новости в Markdown не попадало внутрь JSON-строки (иначе часто ломается парсинг). Если есть только `<<<EW_BODY>>>`, тело отделяется парсером; запасной разбор — JSON; при ответе «просто Markdown» без JSON — весь ответ считается телом. Генерация через UGS, как у AI в редакторе документов.

## Текст поста

Тело хранится в БД как **строка** (как вводит администратор). В приложении EWDesk материал **рендерится как Markdown** (GFM: заголовки, списки, **жирный**, ссылки, код и т.д.) с санитизацией HTML (`rehype-sanitize`), по тому же контуру, что и ответы «Ассистента» — см. `ProductAssistantMarkdown`. Плагин **`remark-breaks`** сохраняет одиночные переносы строк как в обычном тексте. Редактирование в админке — многострочное поле; доступны **шаблоны** и кнопки **«ссылка на приложение»** (тот же формат, что в Ассистенте: `/__eliteew-desktop-open-app__/ComponentName` в Markdown-ссылке, в чтении — кнопка открытия приложения).

Список допустимых `ComponentName` на фронте: `assistantDesktopLinkComponents.ts` (`ASSISTANT_DESKTOP_LINK_APP_COMPONENTS`); для согласованности с GAF часть имён дублируется в `ALLOWED_DESKTOP_APP_COMPONENTS` в `api/gaf_chat/system_gaf_instruction.py`.

## Картинка к посту (опционально)

- Поле **`image_url`** в БД и в API: необязательная строка.
- Поле **`image_content_id`** (UUID, ссылка на `unified_content`): картинка из файлового менеджера.
- При выборе `image_content_id` в админке EWDesk сервер при сохранении поста выполняет best-effort оптимизацию: пытается создать производный файл **WebP** (если это уменьшает размер) и записывает в пост уже id этой оптимизированной версии. Если конвертация не удалась или не дала выигрыша по весу, остаётся исходный `image_content_id`.
- Поле **`video_content_id`**: видео из файлового менеджера; отдача **`GET /api/v1/product-desktop/news-linked-video/{content_id}`** при опубликованном посте (аналогично картинке).
- Поле **`audio_content_id`**: необязательное аудио из файлового менеджера; **независимо** от героя — можно только аудио, или аудио вместе с картинкой/видео. Отдача **`GET /api/v1/product-desktop/news-linked-audio/{content_id}`** при опубликованном посте с этим id.
- Между **`image_url`**, **`image_content_id`** и **`video_content_id`** — **взаимоисключение**: ровно один вариант героя (ссылка на картинку, картинка из CM или видео из CM). **`audio_content_id`** в это правило не входит.
- Допустимые значения для `image_url` (валидация на сервере): **HTTPS/HTTP URL** или **путь с корня сайта** (`/…`, не `//…`).
- Для `image_content_id` на сервере проверяется, что файл доступен админу и имеет тип изображения; отдача всем пользователям EWDesk — через **`GET /api/v1/product-desktop/news-linked-image/{content_id}`** (только если существует **опубликованный** пост с этим `image_content_id`; иначе 404). Клиент запрашивает изображение с авторизацией (blob), не через «голый» `<img src>` к `/content/.../download`.
- В интерфейсе EWDesk: миниатюра в списке, крупный блок под заголовком в чтении; при ошибке загрузки картинка скрывается. Клиентский blob URL живёт в React Query (`useEwDeskNewsBlob`): повторный mount списка/детали после soft-recovery не должен отзывать URL, пока кэш не собран GC; смена `blobUrl` сбрасывает локальный hide после `onError`.
- **CSP:** если картинка с внешнего хоста (только для `image_url`), в образе статики фронта может понадобиться расширение `img-src` (см. `platform/FRONTEND-SECURITY-NGINX-STATIC.md`, переменные `CSP_IMG_EXTRA` / конфиг nginx).

## Миграции

Колонка `image_url` добавляется миграцией:

`shared/api/migrations/applied/20260424_company_news_posts_image_url.sql`

Колонка `image_content_id`:

`shared/api/migrations/applied/20260408_company_news_posts_image_content_id.sql`

Колонка `video_content_id`:

`shared/api/migrations/applied/20260409_company_news_posts_video_content_id.sql`

Колонка `audio_content_id`:

`shared/api/migrations/applied/20260410_company_news_posts_audio_content_id.sql`

Full-text search (`search_vector`, GIN, trigger на title/body):

`shared/api/migrations/applied/20260528_ewdesk_news_search_vector.sql`

Состояние пользователя (read/starred, watermark ленты):

`shared/api/migrations/applied/20260527_ewdesk_user_news_state.sql`

Применение: `shared/api/migrations/apply_migrations.sh` (см. `shared/api/migrations/README.md`).
