# Файловый менеджер и Unified Content (EliteEW)

**Status:** living product SoT (large hub). Prefer thin locks for new FE work under `shared/web/frontend/src/pages/ContentManager/` Vitest; Doc Editor open paths → [ULTIMATE-DOC-EDITOR.md](ULTIMATE-DOC-EDITOR.md) / [DOCUMENT-EDITOR-V2.md](DOCUMENT-EDITOR-V2.md).

**Обновлено:** 2026-07-23 · living product hub (см. `documentation/INDEX.md` Product hubs).

Описание приложения **Файловый менеджер (ContentManagerPro)**, API **`/api/v1/content`** и правил доступа к файлам в разрезе компаний и проектов (включая зал маркетинга). Doc Editor open paths: legacy `DocEditor` / V2 `DocEditorV2` — [ULTIMATE-DOC-EDITOR.md](ULTIMATE-DOC-EDITOR.md), [DOCUMENT-EDITOR-V2.md](DOCUMENT-EDITOR-V2.md).

## Что это

- **Unified Content** — единая таблица **`unified_content`** в PostgreSQL и хранилище файлов (S3-совместимое, в проде обычно SeaweedFS).
- **Файловый менеджер (ContentManagerPro)** — основное окно файлового менеджера на рабочем столе (`ContentManagerPro`, desktop mount `web/frontend/src/pages/Desktop/components/desktopWindowAppContent.tsx`): сетка/список, метаданные, версии, комментарии, шаринг, дубликаты, активность. **Wave 4 FE structural split (2026-07-18):** `ContentManagerPro.tsx` (~35 LOC) — thin shell; оркестрация в `useContentManagerProController` и Wave 4 hooks; presentation в `ContentManagerProMainSurface` / `ContentManagerProFilesTabBridge` / `ContentManagerProModals` без смены URL/API. **F-01 / Wave 4b (2026-08-11):** controller wires existing `useContentManagerProControllerShellState` / `Derived` / `Effects` + `buildContentManagerProControllerAssemblyContext` (controller under 800 LOC); tab bodies extracted to `ContentManagerProMainSurfaceTabPanels` (MainSurface under 800 LOC). Copy API is live: `POST /api/v1/content/{id}/copy` in `unified_content_crud.py` (canvas “route missing” was stale). **Режим «Все файлы»** на вкладке «Файлы» запрашивает список без `folder_item_id` / `folder_unassigned` (вся видимая библиотека в текущих ACL и фильтрах компании/проекта); доступна группировка **по папке** и цветовая метка папки на карточках/строках. В этом режиме список грузится **постранично с сервера** (до **200** строк за запрос, query `cursor` / response `next_cursor` через `useContentManagerAllFilesQuery`); UI показывает «Загружено X из Y» и кнопку **«Загрузить ещё»** без клиентского лимита **10 000**. Нижняя offset-пагинация скрыта; при группировке по папке внутри каждой папки сортировка по дате (**сначала новые**), отображаются порциями по **10** файлов с кнопкой «Показать ещё 10». **Экскурсия:** запуск — `GuideTourLaunchButton` в правом верхнем углу sticky-шапки; `ContentManagerGuideModal.tsx`, корень DOM `content-manager-pro-root`, подсветка `data-cm-guide`, `onPrepareStep` / `spotlightLayoutKey` для смены вкладок, озвучка `public/audio/content-manager-guide/ru/*.wav`, `localStorage` `cm-guide-audio-enabled`. См. [GUIDED-TOUR-EXCURSION.md](GUIDED-TOUR-EXCURSION.md).
- **Массовая загрузка:** в шапке «Загрузить» — выбор **несколького числа файлов** (`input multiple`); drag-and-drop обрабатывает **все** сброшенные файлы. На бэкенд каждый файл уходит отдельным `POST /api/v1/content`; в режиме проводника загрузка привязывается к выбранной папке через `folder_item_id`, кроме явного «Без папки» / каталога / «Все файлы». На клиенте очередь **последовательная**, в UI — общий прогресс и счётчик «текущий из N», при частичных ошибках — предупреждение с числом успешных и неуспешных. ZIP для выбранных файлов показывает busy-состояние и success-toast после старта скачивания.
- **Копирование файлов:** контекстное меню карточки/строки — «Создать копию» открывает модалку с автоименем (`Копия — …` / `Copy of …`); имя можно изменить или сбросить к авто-префиксу. Массовое действие «Копировать» для выделенных файлов создаёт копии сразу с автоименами (суффикс `_2`, `_3` при коллизиях в одной пачке). API: `POST /api/v1/content/{id}/copy`, клиент — `contentApi.copyContent`.
- **Аудио → Music Player (2026-08-08):** ПКМ / ⋯ на `content_type=audio` — пункт «Открыть в Music Player» (`requestPlayAndOpenMusicPlayer`: глобальный NowPlaying + окно Music Player). Preview уже имел handoff через `AuthenticatedAudioPreview`. Лок: `ContentManager/components/__tests__/contentManagerOpenInMusicPlayer.contract.test.ts`.
- **Перенос между папками проводника:** drag-and-drop в папку проекта (`eliteew-proj-{uuid}`) синхронизирует `folder_item_id`, `project_id` и `company_id`; перенос в обычную папку или «Без папки» сбрасывает привязку к компании/проекту. Клиент: `buildContentMoveScopePatch`; бэкенд дублирует merge/clear в `PATCH /content/{id}` при смене `folder_item_id`. Контекстное меню файла — «Переместить в папку…» (та же модалка, что массовый перенос).
- **Explorer parity (2026-07-11):** хранилища остаются раздельными (`desktop_items` для папок/приложений, `unified_content` для файлов), но folder UI читает их через единый контракт **`GET /api/v1/content/folder-view`**. В режиме проводника основная панель получает из одного ответа `desktop_children` (показывает только `FOLDER`) и compact `files`; левое дерево по-прежнему отдельно загружает полный `GET /desktop/items`. **`useFolderView` (TanStack Query, `auto: true`, `staleTime` 15s + `keepPreviousData`)** — кэш folder-view при смене папки/фильтров/страницы; library/desktop refresh инвалидирует ключ `['contentManager','folderView']`. Hybrid search и режим «Все файлы» сохраняют `useContentList` / `useContentManagerAllFilesQuery` (cursor) / search API. ПКМ / ⋯ по узлу дерева и по карточке папки — Open / New folder / Rename / Delete (не system) / Refresh через `POST|PATCH|DELETE /api/v1/desktop/items`. После create/rename/delete папки CM вызывает **`requestDesktopItemsRefresh`** (`eliteew-desktop-items-refresh`): событие обновляет дерево, desktop snapshot и текущий folder-view. На delete передаётся `removedItemIds`, чтобы stale bulk `PUT /desktop/items` не воскресил папку. Одиночное удаление файла: trash на grid-карточке, в preview, Delete без режима выбора на focused row; bulk delete только по `can_delete`. Отдельный audit-док soft-retired (2026-07-18); контракт — этот hub §Explorer parity; регрессия — Vitest `src/pages/ContentManager/`, `desktopFolderWindow/__tests__/`.
- Тот же API используют виджеты (`ProjectContentWidget`), зал маркетинга (открытие менеджера с `initialCabinetScope`) и другие части продукта.
- **Макет встроенного desktop-окна на вкладке «Файлы»:** двухколоночный — слева прокручиваемая колонка: `sr-only` заголовок → библиотека (`filesLibraryChrome`) → при необходимости область кабинета → **поиск** (поле, расширенный поиск; режимы **«По тексту»** / **«Умный поиск»**) → **папки рабочего стола** в режиме проводника. Справа над сеткой (`#content-manager-files-panel`) — **`ContentManagerFilesPanelTopChrome`** (`filesPanelTabsSlot`: `ContentManagerTabStrip` `railIconRow`): иконки **разделов**, **источника списка** (проводник / каталог / все файлы), **разбора по папкам**, быстрого порядка, фильтров, вида, выбора; пульсирующая **«?»** — при наведении подсказки над каждой кнопкой (`files.toolbarHints.*`); затем компактная цепочка **`ContentManagerFilesWayfinding`** («Файлы / режим / папка»), панель массовых действий и сетка. В полноэкранном режиме на вкладке «Файлы» те же вкладки разделов переносятся в эту полоску, в шапке страницы остаются только действия библиотеки. Видимой плашки «Приложение / Файловый менеджер / счётчик» нет — заголовок для доступности остаётся в `ContentManagerPro` (`sr-only`). Контекст выбранной папки задаётся деревом слева и дублируется компактным breadcrumb над списком; пустая выбранная папка не считается фильтрованным результатом и получает folder-specific empty state + upload CTA. Во внешнем (не splitted) режиме по-прежнему `ContentManagerFilesWayfinding` под тулбаром; сортировка, фильтры, вид и выбор не дублируются в этой полосе — они в `ContentManagerFilesPanelTopChrome` над сеткой. Справа — панель сетки/списка и пагинация (`ContentManagerPro` + `ContentManagerFilesTab`, пропы `filesLeadingChrome`, `filesPanelTabsSlot`, `filesLibraryChrome`). На других вкладках шапка остаётся в верхней полосе окна. **`#content-manager-pro-main` inset (2026-08-05):** desktop embedded files-split — `data-cm-main-inset="desktop-split"` (`px-3` / `sm:px-3.5`); mobile embedded — `mobile-split` (`px-2 py-2`); лок — `ContentManagerProMainSurface.main-inset.contract.test.ts`.
- **Папка на рабочем столе** (окно `type === 'folder'` в `EnhancedWindow`): `useFolderContents` читает **`contentApi.getFolderView`**, поэтому compact-файлы и прямые вложенные desktop children приходят атомарно. Виртуальная папка «Без папки» передаёт `folder_unassigned=true` и всегда получает пустой `desktop_children`; `content` не задаёт folder selector и сохраняет обзор общей библиотеки. Кнопка «Файловый менеджер» / `openContentManager` открывает `ContentManagerPro` с `WindowInitialPayload.contentManagerFolderItemId`, чтобы на вкладке «Файлы» сразу был выбран тот же проводник (для `content` — режим «Все файлы» с группировкой по папке). Загрузка из окна папки: `POST /api/v1/content` с `folder_item_id` в query, кроме папки `content` (загрузка без привязки к папке, как у общей библиотеки). **Wave 2 (desktop «folder window»):** видимые строки и контекстное меню локализованы ключами **`desktopUi.folderWindow`** (ru/en); мног файловая загрузка показывает общий прогресс (`contentApi.uploadContent` + `onProgress`); при полном провале очереди — отдельное сообщение об ошибке; в режиме «список» при большом числе строк (порядка **400+**) включён **`VirtualList`** с догрузкой у нижней границы списка; модалка переименования — **`useDesktopModalFocusTrap`**; в пустом состоянии коротко поясняется разница между файлами библиотеки и ярлыками на столе (`emptyClarify`). **Wave 3 (2026-06-30):** drop overlay при drag-over списка, preview prev/next в окне папки — паритет с CM preview modal; регрессия — `desktopFolderWindow/__tests__/` (Vitest).

Клиентские запросы к API с фронтенда должны идти через **`api` / `apiClient`** из `web/frontend/src/services/api` и обёртки вроде `contentApi` (`services/contentApi.ts`), а не разрозненный `fetch`.

## Основной API

> **FE type contracts (wave E, 2026-07-28):** `AdvancedVisibilityFilter` / `FilterVisibility` end-to-end; all-files `setTotalItems` accepts `SetStateAction<number>`; project folder create uses OpenAPI `parent_item_id`; Paperless picker uses `DESKTOP_OVERLAY.panelSurface` + embedded modal z `{backdrop,content}` and button variants `accent`/`neutral`. Doc Editor V2: see [DOCUMENT-EDITOR-V2.md](DOCUMENT-EDITOR-V2.md) §0.

| Метод | Путь | Назначение |
| -------- | ------ | ------------ |
| GET | `/api/v1/content` | Список с фильтрами и пагинацией |
| GET | `/api/v1/content/folder-view` | Единый read-контракт folder UI: `{ folder_item_id, unfiled, desktop_children, files }`; `files` — compact pagination, `folder_item_id + folder_unassigned` вместе дают 400 |
| GET | `/api/v1/content/multi-version` | Только **свои** файлы, у которых в `content_versions` больше одной строки (вкладка «Версии»: список файлов с историей) |
| GET | `/api/v1/content/quota/me` | Использование хранилища текущего пользователя (`storage_used_bytes`, `storage_quota_bytes`, `storage_remaining_bytes`; см. §Квота хранилища) |
| GET | `/api/v1/content/manager/activity` | Лента действий для вкладки «Статистика» из `content_audit_log` по текущему пользователю |
| GET | `/api/v1/content/view-history` | История просмотров из таблицы `content_user_file_views` (не localStorage) |
| POST | `/api/v1/content/{id}/record-view` | Учёт открытия/просмотра файла (upsert в `content_user_file_views`) |
| DELETE | `/api/v1/content/view-history` | Очистить историю просмотров пользователя в БД |
| POST | `/api/v1/content` | Загрузка файла (multipart). Для `text/*` (и JSON/XML) `create_content` сразу пишет `extracted_text` (+ word/char) — паритет с `replace-file`, без ожидания async processor. |
| GET | `/api/v1/content/{id}` | Метаданные объекта |
| GET | `/api/v1/content/{id}/download` | Authenticated Blob/fallback скачивание |
| POST / GET | `/api/v1/content/{id}/download-ticket`, `/api/v1/content/{id}/download-by-ticket` | Короткоживущий ticket URL для native browser download без Bearer в query |
| POST | `/api/v1/content/{id}/replace-file` | Замена тела файла при том же `id` (сохранение из редактора и т.п.). **До** overwrite сервис снимает предыдущее тело в `content_versions` (`replace_file_content` + `preserve_version`); затем индексация/очередь обработки. EWA `file_rewrite` использует тот же путь. |
| PATCH / DELETE | `/api/v1/content/{id}` | Обновление метаданных / удаление или **убрать из библиотеки** (см. ниже) |
| POST | `/api/v1/content/{id}/copy` | Копия файла в библиотеку текущего пользователя под новым именем (тело `{ "name": "…" }`; дедуп по hash отключён — всегда новая строка; visibility private; папка/company/project наследуются только если копирующий — владелец источника) |
| GET / POST | `/api/v1/content/search*` | Обычный/расширенный поиск, autocomplete и подсказки тегов. **`GET /search?mode=keyword|hybrid`:** `keyword` — только **Elasticsearch** ([`ContentSearchService`](../../shared/api/services/unified_content/content_search_service.py)); `hybrid` — ES + **Qdrant** RRF через [`SemanticSearchService`](../../shared/api/services/unified_content/semantic_search_service.py) (индексация векторов — [`unified_content_qdrant_service.py`](../../shared/api/services/unified_content/unified_content_qdrant_service.py), коллекция `eliteew_documents`; rerank по умолчанию нет). **Chroma / `UNIFIED_VECTOR_READ_BACKEND=chroma` — не living path:** env с `chroma` логирует `[STEP] unified_content_search_chroma_retired` и деградирует hybrid к ES-only (без silent vector success). В CM Pro на вкладке «Файлы» переключатель **Текст / Умный** (`searchMode` → `contentApi.searchContent(..., { mode: 'hybrid' })`). |
| GET / POST / DELETE | `/api/v1/content/{id}/shares*` | Управление доступом и списком получателей |
| GET / POST | `/api/v1/content/{id}/versions*`, `/api/v1/content/versions/{version_id}/download-ticket` | История версий, восстановление и ticket-first скачивание версии |
| GET / POST / DELETE | `/api/v1/content/{id}/comment*` | Комментарии к файлу |
| POST / GET | `/api/v1/content/batch-download*`, `/api/v1/content/download-owned-archive*` | ZIP-скачивание выбранных файлов и архива владельца; ticket-варианты дают native browser download |
| GET | `/api/v1/content/{id}/document-body`, `/api/v1/content/{id}/document-structure` | Проекции Unified Content для встроенного редактора документов |

Реализация сервиса: facade `api/services/unified_content/content_storage_service.py` (+ mixins `content_storage_{create,list,delete,shared}.py`). HTTP: parent-агрегатор `api/routers/unified_content.py` (mount + re-export); доменные child-модули `unified_content_{upload,query,crud,download,comments,admin,deps}.py`; отдельно уже были `unified_content_{search,versions,shares,processing}.py` (см. `platform/ATOMIC-ROUTER-DECOMPOSITION-CANON.md`).

### Поиск: living backends (2026-07-18)

| Режим | Keyword leg | Vector leg | Примечание |
|-------|-------------|------------|------------|
| `mode=keyword` | Elasticsearch (`ContentSearchService`) | — | Полнотекст, ACL в ES-фильтрах |
| `mode=hybrid` | Elasticsearch | Qdrant (`eliteew_documents`) | RRF в `SemanticSearchService`; ACL после merge в PG |
| Chroma / `stack1-chroma` | **retired** | **retired** | Не использовать для нового функционала; при stale env `UNIFIED_VECTOR_READ_BACKEND=chroma` — structured log + ES-only degrade |

Индексация для hybrid: OCR/extract → ES (`content_search_service`) + Qdrant upsert (`index_unified_content_qdrant`). Пакет `chromadb` отсутствует в stack0-api; клиент в `database_manager.get_chromadb_client()` raises removed.

### `download` / `thumbnail`: коды ответа при ошибках хранилища

- `GET /api/v1/content/{id}/download` и `GET /api/v1/content/{id}/thumbnail`:
  - **до Seaweed:** уже `broken_quarantined` / Redis negative-cache → стабильный **`404`** (никогда не `500` из-за `HTTPException` внутри bare `except Exception`);
  - возвращают **`404`**, когда объект в S3-совместимом хранилище реально отсутствует или повреждён;
  - возвращают **`503`**, когда SeaweedFS отвечает транзиентной ошибкой (`ServiceUnavailable`, `SlowDown`, timeout-подобные коды) — это сигнал «повторить позже», а не «файл потерян».
- Клиентские `detail` для storage-ошибок стабильны и не содержат сырой текст исключений/путей backend-хранилища; неожиданные `500` получают `X-Error-ID`, подробности остаются только в серверных логах.
- Отдельно: `InternalError` в SeaweedFS часто означает «есть filer/S3 metadata, но chunk недоступен на volume», поэтому в контракте маршрутов это трактуется как повреждённый объект (**`404`**), а не как временный `503`. Volume needle 404 часто приходит клиенту как `IncompleteRead(0 bytes read)` → **not-found** / `seaweed_needle_missing`.
- В backend-коде это разделяется на исключения `SeaweedFileNotFoundError` / `SeaweedFileCorruptedError` (404) и `SeaweedStorageUnavailableError` (503).
- **Fail-fast:** на 404-классе (not-found / corrupted) retrieve делает **одну** попытку (без 3–4 ретраев IncompleteRead).
- **Auto-quarantine:** при доказанном 404-классе на **download** объект помечается `storage_integrity_status=broken_quarantined` (идемпотентно), снимается из ES/search, исключается из folder-view/list/previews и появляется только во вкладке **«Битые файлы»**. Транзиент **не** карантинит. Owner scan: `POST /api/v1/content/broken/scan`. Полный контракт: [CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md](CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md).
- **Thumbnail lazy heal:** отсутствие `thumbnail_path` или пропавший derivative для image/PDF/text → generate+persist JPEG (upload: `DocumentProcessor`; GET: `document_thumbnail.try_lazy_heal_thumbnail`). Отсутствие derivative **не** карантинит оригинал. Video/office без path → стабильный 404.
- **Mobile list thumbs:** native library / songs / player artwork вызывают `/thumbnail` только при `thumbnail_url`; иначе mime/music-icon. Default list already excludes `broken_quarantined`. Lazy-heal срабатывает при явном GET (веб/legacy), не от массового mobile probe.
- **Post-upload verify:** после `store()` в Seaweed — **`verify_object_readable`** (1-byte read); `stat_object` недостаточен (orphan filer metadata). См. [CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md](CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md) §Fail-fast storage read.
- **Cross-app UX:** Image Studio / creative thumbs при storage **404** убирают строку из локального списка и открывают File Manager на вкладке **«Битые файлы»** (`contentManagerInitialTab=brokenFiles` через `desktop-open-app`).
- **FE grid:** при наличии `thumbnail_path` сбой `/thumbnail` **не** fallback’ит на `/download` (иначе снова бьёт Seaweed по уже карантинному объекту).

### Auth session hold × blob concurrency (perf)

**SoT process plan:** `documentation/plans/platform/API-AUTH-SESSION-POOL-AND-CONTENT-BLOB-PERF-PLAN.md` *[operator-local process plan; gitignored — not living canon]*. Broken storage ≠ pool ERR ([CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md](CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md)).

| Инвариант | Норма |
|-----------|--------|
| **I1** | Bearer `/download` и `/thumbnail` не должны держать SQLAlchemy на время Seaweed retrieve + stream. Meta/ACL/quarantine — до release; bytes — без SA. |
| **I2** | Design **A** (locked): blob-specific / short-lived auth session closed before bytes; ticket byte-GET уже без oauth2 SA. |
| **I6** | FE: prefer `thumbnail_path`/WebP; bounded concurrent blob fetches — `CM_BLOB_FETCH_MAX_CONCURRENT` (`contentManagerBlobFetchConcurrency.ts`). |
| Capacity | Не поднимать `POSTGRES_POOL_*` первым; бюджет — [STACK1-POSTGRES-TUNING.md](../platform/docker-re_doc/STACK1-POSTGRES-TUNING.md). |

**As-is (after Waves 1–4):** Bearer `/download`|/thumbnail` use `require_oauth2_user_short_session`. Ticket byte-GET without oauth2 SA. `GET /folder-view` — один shared SA session. Wave 2: `pii_key` на connect, fail-closed. FE: `withBlobFetchConcurrency` (cap 6) на thumbnail/download в `ContentThumbnail` и `HoverPreview`; prefer stored thumb/WebP; no download fallback after stored-thumb fail.

**Observability:** не смешивать `[WRN] content_storage_quarantine` с `[ERR] encryption.pii_key` / QueuePool; target metric names в STACK1-POSTGRES-TUNING §Observability.

### Дубликаты (user library audit)

Вкладка **«Дубликаты»** (`DuplicateFinder`): owner-only `GET /api/v1/content/duplicates`.

| Класс | Критерий | Действия UI |
|-------|----------|-------------|
| Точные | одинаковый `file_hash` | чекбоксы + bulk delete; «Просмотр»; удалить отдельную копию (не «оригинал» = первый по `created_at`) |
| Потенциальные | одинаковый `file_size`, разные/пустые хеши (до 50 групп) | «Просмотр» (`getContent` → `FilePreviewModal`); удалить любой файл после confirm; копировать имя |

Карантин `broken_quarantined` исключён из группировки. Soft-delete через обычный `DELETE /content/{id}`.

### Битые файлы (user quarantine)

Peer к вкладке «Дубликаты». Владелец видит список `broken_quarantined` без soft-delete (`deleted_at` остаётся NULL).

| Действие | API | Поведение |
|----------|-----|-----------|
| Список | `GET /api/v1/content/broken` | Owner-only |
| Проверить снова | `POST /api/v1/content/{id}/storage-recheck` | Один fail-fast probe; успех → снять карантин + UI status «вернулся в библиотеку»; провал (`ok:false`, HTTP 200) → остаётся в «Битых» + UI status «в хранилище по-прежнему не найден» |
| Удалить окончательно | `POST /api/v1/content/{id}/permanent-delete` | Немедленный hard-purge (PG + Seaweed + best-effort ES/Qdrant); не 30-дневный soft-only |

Admin `scan-missing-blobs` → `blob_missing` + soft-delete — отдельный ops-путь; не смешивать с user tab.

OpenAPI: owner broken paths в `content.openapi.json` (см. [CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md](CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md) §OpenAPI / FE types).

### WebP-отображение

Сетка и preview отдают **WebP** display/thumbnail derivative (`image/webp`), когда он есть; иначе legacy JPEG thumb. Оригинал сохраняется. **«Скачать оригинал»** и обычное «Скачать» в v1 — authenticated/ticket download оригинала. Derive после upload — async; backfill для старых image. SoT: [CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md](CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md).

### Ticketed direct downloads

Обычный save-as для Unified Content теперь идёт ticket-first:

1. UI делает authenticated `POST /api/v1/content/{id}/download-ticket` (или version/batch/archive ticket endpoint).
2. Backend проверяет `require_oauth2_user`, резолвит DB user id и прогоняет тот же ACL (`ContentStorageService.get_content(...)` / `VersionManager` / manifest check).
3. В Redis кладётся opaque ticket на короткий TTL (**120 секунд**) с scope `user_id + resource/manifest + disposition`; JWT/Bearer в URL не попадает.
4. Браузер открывает `GET .../download-by-ticket?ticket=...` без Authorization header; router валидирует ticket, допускает короткий replay grace для browser retry/range, затем **повторно** проверяет ACL перед отдачей bytes.
5. Если ticket mint недоступен (Redis/network), `contentApi` возвращается на старый authenticated Blob fallback и UI показывает visible busy-copy («Готовим скачивание...»), а не silent no-op.

**Observability (download tickets):** `ContentDownloadTicketService` пишет in-process счётчики в `performance_metrics.get_metrics()` — `issue_ok` / `issue_fail`, `consume_ok` / `consume_fail`, buckets `consume_fail_by_reason` (`empty_ticket`, `redis_unavailable`, `not_found`, `wrong_kind`, `reuse_denied`, `exception`) и `issue_by_kind`. Снимок доступен оператору через `GET /api/v1/desktop/admin/content-ops/metrics` (`metrics.download_tickets`); поле `blob_fallback_expected` дублирует `issue_fail` как server-side сигнал, что UI обычно уходит в authenticated Blob fallback без отдельного FE beacon. Redis probe `download_ticket_redis` в diagnostics/probe остаётся infra-check, не заменяет runtime counters.

Превью остаются Blob/object URL: `<img>`, `<audio>`, `<video>`, `iframe` не могут передать Bearer header. Save-as из Файловый менеджер, desktop folder window и file preview использует `contentApi.downloadContentToBrowser(...)`, `downloadVersionToBrowser(...)`, `batchDownloadToBrowser(...)`, `downloadOwnedArchiveToBrowser(...)`.

### Uploaded content response isolation

Original content downloads enforce browser isolation at the byte-response builder, after
storage retrieval and independently of ticket issuance. HTML, SVG, XML, JavaScript, CSS and
other MIME types outside the explicit preview allowlist always use `attachment`, even when
the caller or an existing ticket requests `inline`. Original bytes, MIME and filenames are
preserved. Supported raster images, audio/video, PDF, plain text, Markdown and JSON may
remain inline; a MIME label is not evidence that bytes are safe.

Every 200/206/304/416 byte response carries CSP `sandbox` without `allow-scripts` or
`allow-same-origin`, plus `script-src 'none'`, `object-src 'none'`, `base-uri 'none'`,
`form-action 'none'`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`.
This also isolates mislabeled bytes and partial responses. The ETag namespace is versioned
so old validators do not revalidate a response from before this policy. Existing fresh
browser cache entries can survive until their previous cache lifetime expires; deployment
must account for that window.

Cloud `/api/` and frontend `/api/` proxy configurations preserve upstream CSP and disposition.
Do not replace the per-document sandbox with the SPA's CSP. The mkcert edge replaces nosniff
with the same value; edge Referrer-Policy may replace backend no-referrer with
strict-origin-when-cross-origin, so no-referrer is not an end-to-end guarantee.
Ticket TTL, reuse rules and ACL checks are unchanged; no ticket migration
is needed. Version/archive downloads remain attachments. Fetch-based viewers still read the
original bytes and retain their existing sanitization requirements: HTTP CSP does not follow
bytes copied into a new Blob URL or DOM.

### Подпись файла в списке, API и при скачивании

- В **`unified_content`** поле **`name`** — основное имя/идентификатор в библиотеке; **`title`** — необязательный явный заголовок (для документов Doc Editor при создании/сохранении выставляется в ту же строку, что и отображаемый заголовок, чтобы список и детальная выдача совпадали).
- **Правило для UI и `Content-Disposition`:** показывать и собирать имя скачивания как **`title`, если непустой, иначе `name`**; расширение файла — из **`original_filename`** (как `resolvedContentDownloadFileName` / `build_content_disposition_filename` на бэкенде).
- **`GET /api/v1/content`** возвращает те же метаданные столбцов, что и детальная выборка, **без** тяжёлого **`extracted_text`** (счётчики `word_count` / `character_count`, `sub_type`, `source_*`, `related_content` в списке присутствуют).
- Для файлов **`.md` / `.markdown`**, если в БД стоит **`text/plain`** (или пустой mime), в ответах списка/детали и при **`GET .../download`** отдаётся **`text/markdown`**.

Фоновая обработка документов (`DocumentProcessor`): для `.md`, `.txt` и др. текстовых суффиксов текст и HTML для редактора берутся **локально (UTF-8)**, без Tika — иначе извлечённый текст Markdown часто оказывается одной строкой; Tika по-прежнему для PDF/DOCX и т.п. Уже сохранённые записи с испорченным `extracted_text` можно **переобработать**: `POST /api/v1/content/{id}/reprocess` (владелец / `can_edit`, роутер `api/routers/unified_content_processing.py`) или пункт контекстного меню в Файловый менеджер («Обновить предпросмотр и текст») для типов document / presentation / spreadsheet; либо замена файла. При **`processing_status=failed`** (любой тип с сохранёнными байтами) в карточке/строке файла показывается баннер «Ошибка обработки» с кнопкой **«Повторить обработку»** — тот же endpoint ставит задачу в очередь и после успеха переиндексирует ES/Qdrant. Повтор во время `pending`/`processing` → **409**. Для **Markdown** (`.md`), если файл «склеен» (очень длинные строки или почти нет переводов строк), перед рендером применяется **лёгкая эвристика** вставки переносов (заголовки `##`, метки вроде `Триггер:`, `---` перед `#`) — см. `api/services/markdown_glue_normalize.py`. Если расширение `.md`, а **тело — HTML** (экспорт из редактора), контент обрабатывается как HTML: в превью остаётся разметка, а `extracted_text` собирается снятием тегов — см. `api/services/html_fragment_extract.py` и ветку `native_utf8_html_in_md_suffix` в `DocumentProcessor`. Полностью восстановить структуру без переносов в исходнике нельзя, но поиск и предпросмотр текста становятся читабельнее.

### Частые параметры списка (`GET /content`)

- **`project_id`**, **`company_id`** — фильтр по скоупу (обязательна проверка доступа на роутере).
- **`folder_item_id`**, **`folder_unassigned`** — привязка к папке рабочего стола. Если **оба** не заданы, фильтр по папке не применяется (плоский список библиотеки — режим «Все файлы» в UI).
- **`visibility`**, **`content_type`**, **`mime_type`**, **`tags`**, **`search`**, **`source_service`**.
- **`min_file_size`** — минимальный `file_size` в байтах (включительно); `COALESCE(file_size, 0) >= min_file_size`. Отрицательное значение → **422**.
- **`processing_status`** — точное совпадение с enum Unified Content: `pending` | `processing` | `completed` | `failed` (регистр не важен). Неизвестное значение → **422**.
- **`content_type`** — только enum Unified Content (`document`, `image`, …). UI-алиасы Файловый менеджер (`pdf`, `text`, `code`, `archive`) на роутере нормализуются в canonical type + опциональный **`mime_type`** (напр. `pdf` → `document` + `application/pdf`; префикс `text/` — LIKE по MIME).
- **`owner_only`** — только объекты текущего пользователя (узкий режим, напр. музыкальный генератор); **не** расширяется «файлами проекта» других владельцев.
- **`sort_field`**, **`sort_order`**, **`offset`**, **`limit`**, **`cursor`** (keyset, без `search` ranking и без `group_by_type`; mutually exclusive с `offset>0`), **`group_by_type`**.

Файловый менеджер UI (пресеты «крупные файлы» / «ошибка обработки») передаёт эти параметры в `GET /content` и `GET /content/folder-view`; клиентская фильтрация по размеру/статусу на странице списка **не** применяется.
### Folder UI (`GET /content/folder-view`)

- `folder_item_id` выбирает папку по desktop `item_id`; `folder_unassigned=true` выбирает файлы без папки. Одновременная передача обоих селекторов запрещена (`400`).
- `desktop_children` содержит только **прямых** детей из `desktop_items` (targeted query parent + children; без полной загрузки дерева и без strip-apps мутации на read). Для `folder_unassigned=true` — дети корня рабочего стола (`parent_id IS NULL`) для навигации проводника; файлы без папки — в `files`.
- `files` использует `ContentListCompactResponse` и принимает `search`, `sort_field`, `sort_order`, `content_type`, `mime_type`, `min_file_size`, `processing_status`, `offset`, `limit`.
- Авторизация и ACL файлов остаются в Unified Content query service; ownership desktop-папки проверяется до возврата children.

### Студия «Генератор песен»: оценка результата

После успешной генерации в интерфейсе студии пользователь может отметить **«Нравится»** или **«Не нравится»**. **Нравится** выполняет `PATCH` с `folder_item_id` системной папки «Музыка», добавляет трек в избранное музыкального плеера и вызывает `POST /api/v1/music-generator/record-like-recipe` (ответ204). Запись JSON-снимка метаданных на диск у API **включена только** если задана переменная окружения **`MUSIC_GENERATOR_LIKED_RECIPES_DIR`** (каталог на стороне API, подкаталог `liked-recipes/<user_id>/`); иначе эндпоинт остаётся no-op, а перенос в папку и избранное всё равно выполняются на клиенте. **Не нравится** открывает выбор причины; клиент вызывает **`POST /api/v1/music-generator/record-dislike-feedback`** (снимок рецепта + код причины; ответ 204), затем удаляет объект через `DELETE /content/{id}` и убирает трек из плейлистов плеера. Таблица **`music_generator_dislike_feedback`** (миграция `20260425_music_generator_dislike_feedback.sql`).

## Доступ на чтение (список и видимость в SQL)

Пользователь видит строку, если выполняется одно из условий (упрощённо):

1. **`user_id` совпадает** с текущим пользователем контента (`get_content_user_id` / alternate id при рассинхроне Keycloak).
2. **`visibility = public`**, но **не** чужие аватарки профиля: записи с `source_service = 'user_profile'` (загрузка аватара в `user_profile_service`) не попадают в библиотеку других пользователей; свои по-прежнему видны по п.1. Прямые ссылки `/api/v1/content/{id}/download` для публичного файла по-прежнему работают.
3. **Друзья** — `visibility = friends` и взаимная дружба (`check_mutual_friendship`).
4. **Shared** — запись в **`content_shares`** (SSOT). Поле **`shared_with_user_ids`** — legacy dual-read до **P3** (колонку **не** DROP в Wave next; follow-up — dual-read removal на read+write путях). Новые share-пути пишут только таблицу.

**Инвариант ACL:** при непустом **`project_id`** `ContentQueryService.list_content` (и `GET /content`) вызывает **`assert_project_accessible` до SQL-фильтра**; без доступа — **404** или **403** (удалённый проект), строки проекта не отдаются.

Дополнительно, после успешной проверки доступа, в выборку включаются **все строки с тем же `project_id`**, даже если владелец файла — руководитель или другой участник. Это нужно для общих «файлов проекта» в маркетинговом кабинете без ручного шаринга каждого файла.

Без фильтра `project_id` чужие приватные файлы чужих проектов **не** раскрываются.

Строки, скрытые получателем через **`content_user_library_removals`**, в списках текущего пользователя **не показываются** (у владельца и других получателей файл остаётся видимым).

## Удаление и «убрать из библиотеки»

Один HTTP-метод **`DELETE /api/v1/content/{id}`**; семантика зависит от того, **владелец** ли вы файла. В ответах списка и детали API выставляет **`is_owner`**, **`can_edit`** (владелец; для файлов с **`project_id`** дополнительно то же правило, что у `replace-file`: руководитель проекта или `can_upload_project_vault` — иначе `can_edit: false`, UI не предлагает сохранить) и **`can_delete`** (владелец **или** получатель, который может убрать файл у себя).

| Кто действует | Что происходит | UI Файловый менеджер | Assistant (`file_delete`) |
|---------------|----------------|--------------------|-------------------------------|
| **Владелец** | Soft-delete: `unified_content.deleted_at`, снятие из поиска, audit `DELETED` | Кнопка **«Удалить»**, модалка **`ConfirmDeleteModal`** (`variant="desktop"`, непрозрачная shell-панель) с предупреждением о безвозвратном удалении | Подтверждение → «удалила файл» / soft-delete |
| **Получатель** (явный share, GAF-вложение с `content_shares`, и т.п.) | **`ShareService.leave_shared_content`**: снятие строки **`content_shares`**, обновление ACL поиска; audit `UNSHARED` (`recipient_self_remove`) или `REMOVED_FROM_LIBRARY` | Кнопка **«Убрать»**, модалка «убрать из вашей библиотеки»; копия у отправителя **не** удаляется | Подтверждение → «убрала из библиотеки» |
| **Получатель** (доступ только через **`visibility = friends`** или friend-shared subset **без** отдельной строки share) | Запись в **`content_user_library_removals`** — скрытие **только для этого пользователя**; audit `REMOVED_FROM_LIBRARY` | То же **«Убрать»** | То же «убрать из библиотеки» |

**Мессенджер:** при отправке вложения получатель видит файл в Файловый менеджер как чужой; «убрать» снимает **его** доступ (share), не трогая файл у отправителя. См. также [handbook-kb-articles/kb-content-manager-ubrat-fayl-iz-biblioteki.md](handbook-kb-articles/kb-content-manager-ubrat-fayl-iz-biblioteki.md).

**Не путать:** «убрать из библиотеки» ≠ удаление сообщения или вложения в ленте GAF (контекстное меню сообщения). Это операция над **Unified Content** в вашей библиотеке.

**Платформенный admin:** при `allow_delete_as_platform_admin` (проверка на роутере) возможен soft-delete чужого контента — отдельный audit-путь; обычные пользователи и companion этим не пользуются.

Реализация: `content_storage_service.delete_content`, `share_service.leave_shared_content`, миграция `shared/api/migrations/applied/20260524_content_user_library_removals.sql`. **Assistant** file ops scope — папка **EwaFile** (`ewa_file`): см. [ewa/EWA-COMPANION-FILE-CATALOG.md](ewa/EWA-COMPANION-FILE-CATALOG.md). Тесты: `tests/test_unified_content_library_removal.py`, `tests/test_ewa_companion_file_delete_owner_gate.py`, `tests/test_ewa_companion_catalog_scope.py`.

### Retention и hard-purge (оператор)

После soft-delete строка остаётся в **`unified_content`** с **`deleted_at`**, пока не истечёт окно удержания или оператор не выполнит безвозвратное удаление.

| Механизм | Назначение |
|----------|------------|
| **`UNIFIED_CONTENT_HARD_PURGE_DAYS`** | Минимальный возраст soft-delete перед hard-purge (по умолчанию **30**; **`0`** = все soft-deleted). Используется CLI, admin API и beat. |
| **`UNIFIED_CONTENT_HARD_PURGE_BEAT_ENABLED`** | Плановый Celery beat hard-purge (**по умолчанию выкл** — `0`). Включить явно на command-center / prod runtime env. |
| **`UNIFIED_CONTENT_HARD_PURGE_INTERVAL_HOURS`** | Интервал beat (по умолчанию **24** ч). |
| **`UNIFIED_CONTENT_HARD_PURGE_BATCH_LIMIT`** | Макс. строк за один тик beat (по умолчанию **500**). |
| **`POST /api/v1/content/admin/hard-purge-soft-deleted`** | Ручной запуск (admin); `dry_run=true` по умолчанию. |
| CLI **`api/scripts/hard_purge_soft_deleted_content.py`** | Операторский прогон с `--apply`; по умолчанию dry-run. |

Hard-purge удаляет объект из SeaweedFS (если был), best-effort чистит Qdrant-чанки и **DELETE** строки из PostgreSQL. Логи: префикс **`[STEP] storage_hard_purge_*`**. Метрики: **`unified_content_hard_purge_runs_total`**, **`unified_content_hard_purge_last_purged`**. В **Unified Admin → Content** overview: **`soft_deleted_purge_eligible`**, **`hard_purge_retention_days`**, **`hard_purge_beat_enabled`**.

## Доступ на запись в vault проекта

Загрузка (`POST` с **`project_id`**) и операции, привязывающие контент к папке проекта, проверяются **`assert_user_may_write_project_vault`** (`api/utils/project_vault_permissions.py`):

- пользователь имеет доступ к проекту (`assert_project_accessible`);
- и либо он **руководитель проекта** (`projects.created_by`), либо участник с правом **`can_upload_project_vault`** в `project_members.permissions`.

Тот же критерий для проекции **`can_edit`** на файлах с `project_id`: `resolve_owner_can_edit` → `viewer_may_write_project_vault` (`project_vault_lifecycle.py`), чтобы редактор не вызывал `replace-file` вслепую.

**Архив проекта в кабинете** (`DELETE /api/v1/projects/{id}`): всегда soft-delete **всех** строк `unified_content` с этим **`project_id`** (любой `folder_item_id`, в т.ч. `ewa_file`), сброс `project_id`/`folder_item_id`, удаление ярлыков **`eliteew-proj-{uuid}`** на рабочем столе у всех пользователей. Для уже архивированных проектов backfill: `migrations/applied/20260617_project_delete_vault_cleanup_backfill.sql`.

Пока у файла остаётся `project_id` удалённого проекта, API отдаёт **`can_edit: false`** (даже владельцу); `replace-file` и vault-write возвращают **403** с текстом «Проект удалён…», не 404.

## Связь с маркетинговым кабинетом

- В кабинете выбор компании/проекта задаёт контекст; открытие файлового менеджера передаёт **`initialCabinetScope`** (компания/проект) в **ContentManagerPro**.
- Участнику для работы с файлами проекта нужны соответствующие **модули** в `cabinet_modules` и при загрузке — **`can_upload_project_vault`** (если он не руководитель).

Подробнее о правах и модулях: [marketing/MARKETING-CABINET.md](marketing/MARKETING-CABINET.md).

## Кэширование

Для списков без «друзей»/«от друзей» и **без** `project_id` может использоваться кэш пользовательских списков (UserCache). Запросы **с `project_id`** обходят кэш списка — см. `list_content` в `content_query_service` / `unified_content_query.py`.

## Квота хранилища пользователя

- **Env:** `CONTENT_USER_STORAGE_QUOTA_BYTES` — лимит на пользователя в **байтах** (integer). **Default:** `10737418240` (10 GiB) — `UnifiedConfig.content_user_storage_quota_bytes` / `get_content_user_storage_quota_bytes()`; override через stack0 env (Config Plane / `.env.stack0.backend` на command-center), если ключ задан.
- **Источник правды в API:** `UnifiedConfig.content_user_storage_quota_bytes` → `ContentStorageService.USER_QUOTA_BYTES` / `get_content_user_storage_quota_bytes()` в `content_storage_service.py`.
- **Эндпоинты:** `GET /api/v1/content/quota/me` (`storage_quota_bytes`, `storage_remaining_bytes`, `storage_quota_mb`) и upload/replace (`_check_quota`) используют **один** конфиг; admin quota pages — тот же лимит через `ContentStorageService.USER_QUOTA_BYTES`.
- **Фронт:** вкладка «Статистика» показывает usage bar из `GET /content/quota/me`. Клиент нормализует `storage_used_bytes` / `storage_quota_bytes` (и legacy `bytes_used` / `quota_bytes`) в `contentApi.getQuotaMe()`; Wave 4 assembly прокидывает `quotaLoading` / `quotaError` / `onQuotaRetry` в `ContentManagerStatsTab`. Не показывать «лимит не задан», если API вернул квоту; не показывать «0 Б», когда usage > 0.

## Наблюдаемость

- **Unified Admin → Content** (`?section=content`): overview, SeaweedFS/Redis probe, **paged multi-user quota** (`GET …/content-ops/quota/users` + single `…/quota/users/{id}`), processing failures, **storage ops** (scan missing blobs, migrate BYTEA→SeaweedFS, hard-purge soft-deleted), Diagnostics **index ops** (`POST /api/v1/content/reindex-all`, `GET /api/v1/content/duplicates`). API: `/api/v1/desktop/admin/content-ops/*` (`require_admin_user`); legacy equivalents remain on `/api/v1/content/admin/*`. Сервис: `api/services/unified_content/content_admin_ops_service.py`.
- **Регрессия:** `bash docker/scripts/content-manager-excellence-verify.sh` — API slice (`run-stack0-api-tests.sh`, `-k` unified_content / folder_view / download_ticket / admin_content) + Vitest: `ContentManager/`, desktop folder window, `UnifiedContent/picker/`, `contentApi.downloads`; E2E CM→DocEditor: `pnpm run test:e2e:doc-editor` (см. `ULTIMATE-DOC-EDITOR-E2E-CI.md`, workflow `doc-editor-e2e.yml`).
- Логи приложения: `podman logs` / файлы `docker/logs/stack0/`; см. `platform/docker-re_doc/AGENT-LOGS-QUICKREF.md`, `.cursor/rules/project-and-deploy.mdc`.
- После изменений в API: перезапуск **`stack0-eliteew-api-prod`**.
- Frontend telemetry для открытия документов в Desktop DocEditor идёт через событие `desktop-telemetry`:
  - `doc_editor_load_start` — начало загрузки (`targetType`: `docEditor` или `unifiedContent`);
  - `doc_editor_load_finish` — финал загрузки (`status`: `success` / `not_found` / `forbidden` / `network` / `unknown` / `canceled`, плюс `durationMs`).
  - `doc_editor_tab_switch` — переключение активной вкладки (`fromTargetType` -> `toTargetType`) в уже открытом окне редактора.
  - `doc_editor_leave_guard` — срабатывание защиты от ухода/закрытия (`channel`: `beforeunload` / `window_close` / `direct_close`, `reason`: `dirty` / `loading` / `saving` / `empty_state` / `clean`, `blocked`: `true|false`).
- Оба события передают `requestId` (`docOpenRequestId`) без пользовательских данных — это сквозной trace-id от deep-link открытия до фактической загрузки файла в редакторе.
- Rollout/регрессия: при включённой телеметрии проверять, что на одно открытие документа есть пара start+finish с одинаковым `requestId`, доля `not_found|forbidden` не растёт после релиза, p95 `durationMs` для `unifiedContent` не деградирует, а `doc_editor_leave_guard` с `reason=dirty` не появляется в «чистом» сценарии открытия файла из Файловый менеджер.

## Производительность

### Backend (list / search / folder-view)

- **Batch ACL (Wave next):** `list_content`, `get_content_batch` и hybrid `semantic_search_service._apply_access_control` используют SSOT **`content_acl_batch.py`** — один prefetch `content_shares` + один batch `check_mutual_friendship` на страницу (без per-row SELECT в цикле). Флаги `can_delete` / access остаются default-deny.
- **`GET /content/folder-view`:** targeted load parent folder + direct children; **не** грузит полное дерево `desktop_items` и **не** вызывает strip-apps / installed-apps mutation на read (это остаётся на `GET /desktop/items`). `ensure_system_folders` сохраняется.

### Frontend

- Виртуализация в **`ContentManagerFilesListBody`**: dense grid (≥32, desktop, без inline-preview) — **`ContentManagerFilesGridVirtualBlock`** → `VirtualGrid` с **измерением высоты ряда** (estimate из `estimateContentManagerVirtualGridRowHeightPx`, не фиксированные 200px); dense list (>50 строк в группе) — **`VirtualList`**; иначе CSS grid + `content-visibility`. Пороги: `utils/contentManagerVirtualization.ts`. Сводка: **[FRONTEND-VIRTUAL-LIST-AND-PERF-PATTERNS.md](FRONTEND-VIRTUAL-LIST-AND-PERF-PATTERNS.md)**.
- Кэш: folder-view — TanStack Query (`useFolderView`); catalog list сохраняет previous items на refetch (keepPreviousData-like).
- Worklog journals soft-retired (2026-07-18); исторические пункты по VirtualList / `FileManagerPanel` сведены в [FRONTEND-VIRTUAL-LIST-AND-PERF-PATTERNS.md](FRONTEND-VIRTUAL-LIST-AND-PERF-PATTERNS.md).
- Полноэкранный корень (`!embedded`): два декоративных слоя «глубины» оформлены классами Tailwind (**`bg-[radial-gradient(…)]`**, **`bg-[linear-gradient(…)]`**, **`bg-size-[32px_32px]`**, **`mask-[radial-gradient(…)]`**) без inline `style` — см. **`ContentManagerPro.tsx`** (root); канон утилит: **`product/FRONTEND-DEVELOPER-ENTRY.md`**.

## Встроенный выбор файла из библиотеки

Единый модуль **`shared/web/frontend/src/components/UnifiedContent/picker/`**: центрированная модалка на **`DesktopAppModalFrame`** (`UnifiedContentPickerModal`), тело списка (`UnifiedContentPickerPanel`), данные через **`contentApi.listContent`** и TanStack Query (`useUnifiedContentPickerQuery`, ключ **`unifiedContentPickerQueryKey`**). Подписи строк совпадают с менеджером: **`unifiedContentDisplayLabel`** в `UnifiedContent/utils/contentDisplayLabel.ts` и **`contentManagerDisplayLabel`** в `pages/ContentManager/utils/contentManagerTextLike.ts` (тот же источник). Действия подтверждения не должны жить только внизу длинного списка: при выборе файла/файлов picker показывает persistent action strip над scrollable list, а footer закреплён у нижней границы панели.

Использование в продукте: Мессенджер (`GafContentLibraryPicker` + `GafContentLibraryPickerPanel` с верхней кнопкой «прикрепить» после выбора), редактор документов (`FileGrabber`, в том числе встроенный режим для `FileLibraryPanel`), транскрибация (`FileUploadArea`), админка EWDesk (`EwDeskContentMediaPicker`), Site Studio — нативный select (`ContentStudioPicker`), экспорт профиля (`FileGrabber`).

## Карта модуля (god-files и поверхности)

LOC — снимок рабочей копии (2026-07-18); цели — ориентир для следующих split-волн, не CI gate.

### God-files (LOC targets)

| Слой | Файл | LOC (≈) | Цель / примечание |
|------|------|---------|-------------------|
| FE orchestrator | `ContentManagerPro.tsx` | ~35 | ≤800; **Wave 4 (2026-07-18):** thin shell → `useContentManagerProController` + `assembleContentManagerProMainSurfaceProps` |
| FE orchestrator (controller) | `hooks/useContentManagerProController.ts` + Wave 4 sub-hooks (`useContentManagerContentListOrchestration`, `useContentManagerFileOperations`, `useContentManagerUploadDragSurface`, `useContentManagerEmbeddedShellBridge`, `useContentManagerFilesUiDerived`, …) | ~870 / — | Wiring + prop assembly; list/folder-view в `useContentManagerContentListOrchestration` |
| FE files tab | `ContentManagerFilesTab.tsx` | ~510 | ≤800; Wave 4 split (2026-07-18): list body, selection bar, explorer tree, pagination, hooks |
| FE files tab (children) | `ContentManagerFiles{ListBody,SelectionBar,ExplorerTree,Pagination,SplitRailCollapsed}.tsx`, `hooks/useContentManagerFiles*.ts(x)`, `contentManagerFilesTabTypes.ts` | — | Держать orchestrator <800 LOC |
| FE presentation | `ContentManagerProMainSurface.tsx`, `ContentManagerProFilesTabBridge.tsx`, `ContentManagerProModals.tsx` | ~813 / ~266 / ~309 | Держать дочерние модули <1000 LOC |
| FE shell | `ContentManagerProShell.tsx` | ~40 | Тонкая обёртка mount / layout |
| API router (parent) | `api/routers/unified_content.py` | ~110 | Aggregator: mount child routers + re-export deps |
| API router (children) | `unified_content_{deps,upload,query,crud,download,comments,admin}.py` | ~520 / ~890 / ~490 / ~790 / ~420 / ~160 / ~480 | Split 2026-07-18; каждый child <1000 LOC |
| API router (siblings) | `unified_content_{search,versions,shares,processing}.py` | — | Уже были вынесены до parent split |
| API service (facade) | `api/services/unified_content/content_storage_service.py` | ~1350 | Core: ACL reads, update, blocks, quota, admin |
| API service (mixins) | `content_storage_{create,list,delete,shared}.py` | ~350 / ~850 / ~200 / ~175 | P1 split 2026-07-18; import paths unchanged via facade re-exports |

Legacy client aggregation cap (`CONTENT_LIST_AGGREGATE_MAX_ITEMS = 10_000` в `hooks/contentListAggregation.ts`) остаётся только для opt-in `aggregateAllPages`; режим **«Все файлы»** использует **`useContentManagerAllFilesQuery`** (server `cursor` / `next_cursor`, 200 строк за запрос).

### Поверхности (где живёт CM / Unified Content UI)

| Поверхность | Entry / пропы | Путь |
|-------------|---------------|------|
| Desktop окно **Файловый менеджер (ContentManagerPro)** | `desktopWindowAppContent.tsx` → `ContentManagerPro` | `pages/ContentManager/` |
| Mobile embedded WebView | `#/mobile-content-manager`, `embedded embeddedMobile` | `MobileContentManagerPage.tsx` → `ContentManagerPro` |
| Зал маркетинга | `initialCabinetScope` (company/project) | тот же `ContentManagerPro` |
| Окно папки на столе | `EnhancedWindow` `type === 'folder'`, `useFolderContents` | `pages/Desktop/components/EnhancedWindow.tsx` |
| Unified Content picker (модалка) | `UnifiedContentPickerModal` / `contentApi.listContent` | `components/UnifiedContent/picker/` |
| GAF вложения | `GafContentLibraryPicker` | `pages/Desktop/components/GAFChat/components/` |
| Виджет файлов проекта | `ProjectContentWidget` | marketing / desktop widgets |
| Unified Admin (operator) | `?section=content`, не CM Pro UI | `/api/v1/desktop/admin/content-ops/*` |

Soft-retired audit docs (ссылки убраны из living canon): `CONTENT-MANAGER-AUDIT-UX-WAVES-2026-05-28.md`, `CONTENT-MANAGER-EXPLORER-PARITY-AUDIT-2026-07-11.md` — отсутствуют в дереве; истина в этом hub.

## Кодовая карта (кратко)

| Компонент | Путь |
| ----------- | ------ |
| Файловый менеджер (ContentManagerPro) (thin shell) | `shared/web/frontend/src/pages/ContentManager/ContentManagerPro.tsx` |
| Wave 4 controller / types | `.../hooks/useContentManagerProController.ts`, `contentManagerProTypes.ts`, `assembleContentManagerProMainSurfaceProps.ts` |
| Wave 3 presentation surface / Files-tab bridge / modal stack | `.../components/ContentManagerProMainSurface.tsx`, `ContentManagerProFilesTabBridge.tsx`, `ContentManagerProModals.tsx` |
| Окно папки рабочего стола (сетка/список, DnD/upload, связка с CM); хук списка | `.../pages/Desktop/components/EnhancedWindow.tsx` (`type === 'folder'`), `.../pages/Desktop/hooks/useFolderContents.ts` |
| Вкладка «Файлы» (тулбар, фильтры, проводник, сетка/список, пагинация); слот расширенного поиска | `.../ContentManager/ContentManagerFilesTab.tsx` (`advancedSearchSlot`) |
| Высота виртуального списка (режим list, >50 строк в группе) и сетка: ResizeObserver на scroll-контейнере list body. Сетка: при «тяжёлом» списке (≥32 карточек, не mobile, нет inline-превью) — `ContentManagerFilesGridVirtualBlock` → `VirtualGrid`; иначе CSS grid + `content-visibility` на карточках | `ContentManagerFilesListBody.tsx`, `utils/contentManagerVirtualization.ts` |
| UX-резолверы списка: активные фильтры без смешивания с explorer-навигацией; copy для visible/page selection scope; **pagination total** при client-side фильтрах | `.../ContentManager/utils/contentManagerListUx.ts`, `.../utils/contentManagerListPagination.ts` |
| Saved views (умные коллекции): apply → `activeTab=files`, сброс page, catalog vs explorer | `.../hooks/useContentManagerFilesUiDerived.ts` |
| Полоска основных вкладок (files / versions / shared / …) | `.../ContentManager/components/ContentManagerTabStrip.tsx` |
| Действия шапки (обновить / загрузить / архив своих файлов + скрытый input) | `.../ContentManager/components/ContentManagerHeaderActions.tsx` |
| Подтверждение скачивания ZIP всех своих файлов | `.../ContentManager/components/ContentManagerOwnedArchiveModal.tsx` (кнопка «Мой архив» открывает модалку, затем `POST /content/download-owned-archive`) |
| Вкладки «Версии» (список файлов с `content_versions` > 1), «Мне предоставили доступ» (кнопка просмотра) | `.../UnifiedContent/components/tabs/VersionsTab.tsx`, `SharedTab.tsx` |
| Вкладка «Статистика» (карточки, лог активности, недавние просмотры) | `.../ContentManager/components/ContentManagerStatsTab.tsx` |
| Вкладка «Теги» (клик → `filterTag` + `?tags=` на «Файлы») | `.../ContentManager/components/ContentManagerTagsTab.tsx` |
| Вкладка «Комментарии» без выбора: CTA «Перейти к файлам» + недавние просмотры | `.../components/ContentManagerProMainSurface.tsx` |
| Карточка сетки / строка списка, TYPE_CONFIG, видимость для подписей | `.../components/ContentManagerFileCard.tsx`, `ContentManagerFileRow.tsx`, `ContentManagerTypeConfig.tsx`, `.../utils/contentManagerVisibility.ts` |
| Модалка предпросмотра (вне инлайн-карточки), навигация previous/next по текущему видимому списку | `.../components/ContentManagerPreviewModal.tsx` |
| Модалка редактирования метаданных | `.../components/ContentManagerEditModal.tsx` |
| Модалка пакетного назначения компании/проекта с inline-validation company+project | `.../components/ContentManagerBatchAssignModal.tsx` |
| Превью файлов (blob), DnD-подпись, recovery hints | `.../ContentManager/components/ContentManagerPreviews.tsx`, `.../utils/contentManagerDrag.ts`, `.../utils/contentManagerProRecovery.ts` |
| Контекстное меню карточки, error boundary вкладок, плитка статистики, маппинг recent type | `.../ContentManager/components/ContentManagerActionMenu.tsx`, `ContentManagerTabErrorBoundary.tsx`, `ContentManagerStatsCard.tsx`, `.../utils/mapContentTypeToRecentType.ts` |
| Хук списка; bounded aggregation для режима «Все файлы» | `.../ContentManager/hooks/useContentList.ts`, `.../ContentManager/hooks/contentListAggregation.ts` |
| Стабильные колбэки вкладок (комментарии / дубликаты / shared refresh) | `ContentManagerPro.tsx` — `handleFileCommentsAfterUpdate`, `handleDuplicateFinderChange`, `handleSharedContentsRefresh` |
| Типы вкладок/фильтров URL, режимов списка | `.../ContentManager/contentManagerTypes.ts` |
| Синхронизация `cm_tab` / `cm_ft` / `cm_fv` с адресной строкой | `.../ContentManager/hooks/useContentManagerUrlSync.ts` |
| Открытие по событию и deep link (`CONTENT_MANAGER_OPEN_CONTENT`) | `.../ContentManager/hooks/useContentManagerOpenContentEffects.ts` |
| Цель загрузки в текущую папку проводника | `.../ContentManager/utils/contentManagerUploadTarget.ts` |
| Хлебные кроски пути на вкладке «Файлы» (каталог / проводник) | `.../ContentManager/components/ContentManagerFilesWayfinding.tsx` |
| Вложенные папки проводника (main panel) | `.../utils/contentManagerExplorerNestedFolders.ts`, `.../components/ContentManagerExplorerNestedFoldersPanel.tsx` — **compact** horizontal grid tiles (`CM_NESTED_FOLDER_*` in `contentManagerNestedFoldersChrome.ts`, 2026-08-05): `role=group` + open button + sibling ⋯ (без nested `<button>`), `border-l-4` + `getFolderAccentBorderClass`, optional `meta.folder_icon`; лок `ContentManagerExplorerNestedFoldersPanel.test.tsx` |
| Контекстное меню папки (дерево + панель) | `.../components/ContentManagerFolderContextMenu.tsx` |
| Единый picker из библиотеки (модалка, хук списка, persistent action strip для длинных списков) | `shared/web/frontend/src/components/UnifiedContent/picker/` |
| GAF-specific picker из Файловый менеджер в чат | `.../pages/Desktop/components/GAFChat/components/GafContentLibraryPicker.tsx`, `GafContentLibraryPickerPanel.tsx` |
| HTTP-клиент контента | `shared/web/frontend/src/services/contentApi.ts` |
| Роутер | `shared/api/routers/unified_content.py` |
| SQL / list / ACL | `shared/api/services/unified_content/content_storage_service.py`, `content_storage_list.py`, `content_storage_shared.py` |
| Безопасные тексты storage-ошибок | `shared/api/utils/content_storage_error_detail.py` |
| Права vault | `shared/api/utils/project_vault_permissions.py`, `shared/api/utils/project_vault_lifecycle.py` |
| Проверка доступа к проекту | `shared/api/core/project_scope_access.py` |

## Статьи базы знаний (пользовательский контур)

Короткие тексты для встроенного справочника — каталог [`handbook-kb-articles/README.md`](handbook-kb-articles/README.md). По Файловый менеджер:

| Тема | Статья |
|------|--------|
| Обзор, папки на столе, Content Library | [`handbook-kb-articles/kb-content-manager-i-fayly.md`](handbook-kb-articles/kb-content-manager-i-fayly.md) |
| **Удалить (владелец) vs убрать из библиотеки (получатель)**, GAF, share, companion | [`handbook-kb-articles/kb-content-manager-ubrat-fayl-iz-biblioteki.md`](handbook-kb-articles/kb-content-manager-ubrat-fayl-iz-biblioteki.md) |
| Фильтры, сетка/список, сортировка, вкладки | [`handbook-kb-articles/kb-content-manager-filtry-vidy-i-sortirovka.md`](handbook-kb-articles/kb-content-manager-filtry-vidy-i-sortirovka.md) |
| Загрузка, «Мой архив», ZIP | [`handbook-kb-articles/kb-content-manager-zagruzka-i-moy-arhiv.md`](handbook-kb-articles/kb-content-manager-zagruzka-i-moy-arhiv.md) |
| Загрузка: компания, проект, видимость, друзья | [`handbook-kb-articles/kb-content-manager-zagruzka-vidimost-druzya.md`](handbook-kb-articles/kb-content-manager-zagruzka-vidimost-druzya.md) |
| Умные коллекции, поиск, каталог/проводник | [`handbook-kb-articles/kb-content-manager-umnye-kollekcii-i-poisk.md`](handbook-kb-articles/kb-content-manager-umnye-kollekcii-i-poisk.md) |
| Разложить «Без папки» / Content по системным папкам | [`handbook-kb-articles/kb-content-manager-razlozhit-fayly-po-papkam.md`](handbook-kb-articles/kb-content-manager-razlozhit-fayly-po-papkam.md) |
