# Музыкальный плеер (Desktop)

**Full implementation summary (2026-05-31)** soft-retired → `trash/` (`ELITEEW-AUDIO-PLAYER-AND-MUSIC-UI-FULL-SUMMARY-2026-05-31.md`). Living SoT is **this document** (+ [`MUSIC-FORGE-APP.md`](../MUSIC-FORGE-APP.md) for studio).

Приложение рабочего стола **«Музыкальный плеер»** (`MusicPlayer`): список аудио из Content API, воспроизведение через глобальный `<audio>` в `**NowPlayingContext`**, интеграция с оболочкой десктопа (шапка, виджет, трей, Media Session).

## Назначение

- **Пользователь:** воспроизведение файлов из папки **«Музыка»** и/или всего каталога аудио (режим «Вся музыка»), поиск, теги, сохранённые плейлисты (**в `shell_state` на сервере**, привязка к пользователю), очередь, shuffle/repeat, A–B loop, горячие клавиши.
- **Разработчик:** ниже — карта модулей, API, устойчивость к гонкам и сознательные оптимизации рендера (без дублирования простыни из `documentation/worklog/` — там остаются покоммитные пометки).

Пользовательские формулировки для справочника/KB: `**product/handbook-kb-articles/kb-muzykalnyj-pleer-i-generator-pesen.md`** (плеер vs генератор песен).

## Точки входа в коде


| Область                                                     | Путь                                                                                                 |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Тонкий оркестратор страницы                                 | `shared/web/frontend/src/pages/MusicPlayer/MusicPlayerPage.tsx`                                     |
| Константы страницы и persisted list preferences             | `.../MusicPlayer/musicPlayerPageConstants.ts`                                                        |
| Skeleton каталога                                           | `.../MusicPlayer/MusicPlayerLoadingSkeleton.tsx`                                                     |
| Изолированный A–B loop effect                               | `.../MusicPlayer/MusicPlayerAbLoopEffect.tsx`                                                        |
| Каталог: fetch/race/abort/pagination/refresh                 | `.../MusicPlayer/useMusicPlayerCatalog.ts`                                                           |
| Search/tag/origin/playlist projection и hydration           | `.../MusicPlayer/useMusicPlayerTrackPipeline.ts`                                                     |
| Create/rename/delete/import/export плейлистов                | `.../MusicPlayer/useMusicPlayerPlaylistActions.ts`                                                   |
| Foreground shortcuts, Escape и relative seek                | `.../MusicPlayer/useMusicPlayerPageShortcuts.ts`                                                     |
| Play/favorite/context/delete действия трека                  | `.../MusicPlayer/useMusicPlayerTrackActions.ts`                                                      |
| Выбор плейлиста (выпадающий список)                         | `.../MusicPlayer/MusicPlayerPlaylistPicker.tsx`                                                      |
| Иконка «любимое» (шестиугольник)                            | `.../MusicPlayer/MusicPlayerFavoriteHex.tsx`                                                         |
| Список треков (plain / virtual)                             | `.../MusicPlayer/MusicPlayerTrackList.tsx`                                                           |
| Memoized строка списка                                      | `.../MusicPlayer/MusicTrackRow.tsx`                                                                  |
| Master–detail body (list + stage dock + now-playing)      | `.../MusicPlayer/MusicPlayerMasterDetail.tsx`                                                        |
| Wide stage dock (now playing summary + embedded queue)      | `.../MusicPlayer/MusicPlayerStageDock.tsx`                                                           |
| Нижняя панель «Сейчас играет»                               | `.../MusicPlayer/MusicPlayerNowPlayingBar.tsx`                                                       |
| Shared stall hint (все now-playing поверхности)             | `.../components/Audio/NowPlayingLoadHint.tsx`                                                        |
| Общие chrome-токены (inset, footer strip, utility chips, track-list header/gaps, ultrawide layout) | `.../MusicPlayer/musicPlayerChrome.ts`                                                               |

**Ultrawide master–detail (2026-08-08):** `@container` layout at ≥1100px container width — catalog left, stage dock (~22rem) right with now-playing summary + embedded queue. Narrow keeps stacked queue above the list. Dock open preference: `eliteew.music-player.stage-dock.v1` (default open). Wide list adds Created / Source columns; grid bumps to `xl:4` / `2xl:5`. Lock: `MusicPlayer/__tests__/musicPlayerStageDock.chrome.contract.test.ts`.

**Premium track list chrome (2026-08-05):** column header `#` / Track / Duration (+ Created / Source on wide) — sentence-case via `MUSIC_PLAYER_TRACK_LIST_HEADER_CLASS` (no CSS `uppercase`); partial-metadata banner uses quiet desktop tokens (`MUSIC_PLAYER_PRESENTATION_GAPS_BANNER_CLASS`), not amber wash. Lock: `MusicPlayer/__tests__/musicPlayerTrackListChrome.premium.contract.test.ts`.

**Premium chrome toolbar (2026-08-05):** `MusicPlayerSecondaryToolbar` — `MUSIC_PLAYER_CHROME_TOOLBAR_*` / `musicPlayerToolbarPillClass` / `musicPlayerToolbarChipClass`; sentence-case source/playlist/sort meta; duration-sort warning without amber shout. Lock: `MusicPlayer/__tests__/musicPlayerChromeToolbar.premium.contract.test.ts`.

**Premium now-playing bar (2026-08-05):** quieter footer strip (`musicPlayerFooterStripClass`), sentence-case «Сейчас играет» via `MUSIC_PLAYER_NOW_PLAYING_EYEBROW_CLASS` + shared `AudioTrackMeta` default (no `uppercase`); utility chips aligned with toolbar meta. Lock: `MusicPlayer/__tests__/musicPlayerNowPlayingChrome.premium.contract.test.ts`.

| Диалоги (плейлист, горячие клавиши)                         | `.../MusicPlayer/MusicPlayerDialogs.tsx`                                                             |
| Типы, размер страницы, ключ legacy localStorage (миграция)  | `.../MusicPlayer/musicPlayerTypes.ts`                                                                |
| Синхронизация плейлистов с `GET/PATCH /desktop/shell-state` | `.../MusicPlayer/musicPlayerPlaylistsSync.ts`                                                        |
| Утилиты (длительность, сравнения, abort)                    | `.../MusicPlayer/musicPlayerUtils.ts`                                                                |
| Потоковый URL + Range blob для Unified Content              | `.../MusicPlayer/musicPlayerAudioDownload.ts`, `musicPlayerAudioRange.ts`                            |
| Резолвер источника global now-playing (stream → blob)       | `.../MusicPlayer/nowPlayingTrackAudioSource.ts`                                                      |
| Виртуальный список (оценка высоты, ключи)                   | `.../MusicPlayer/musicPlayerListVirtual.ts`                                                          |
| Глобальное воспроизведение                                  | `shared/web/frontend/src/pages/Desktop/context/NowPlayingContext.tsx`                               |
| Media Session (обложка, действия)                           | `shared/web/frontend/src/pages/Desktop/utils/mediaSessionMusic.ts`                                  |
| Виджет рабочего стола «Сейчас играет»                       | `.../Desktop/components/DesktopWorkspaceFloatingWidget.tsx` (`DesktopFloatingWidgetNowPlayingStrip`) |
| Пункты трея                                                 | `.../Desktop/hooks/useDesktopTrayItems.ts`                                                           |


Регистрация приложения в каталоге десктопа: см. `**documentation/product/desktop/DESKTOP-API-AND-APPS.md**` (компонент `MusicPlayer`).

## Данные и API

- **Список:** `GET /api/v1/content` с `content_type=audio`, пагинация (`limit` / `offset`), сортировка `sort_field` / `sort_order` (часть полей совпадает с UI; для **«Длительность»** на сервер уходит запасное поле, финальная сортировка по длительности — на клиенте после загрузки метаданных).
- **Фильтр папки:** при режиме «Папка Музыка» передаётся `folder_item_id=music` (см. запрос в `useMusicPlayerCatalog`).
- **Отмена и гонки:** список запрашивается с `AbortController`; счётчик «рейса» предотвращает применение устаревшего ответа при быстром смене фильтра/сортировки.
- **Догрузка:** `IntersectionObserver` на sentinel внутри прокручиваемой области + кнопка «Загрузить ещё»; учёт `hasMore` / `isLoadingMore` через ref, чтобы не дублировать запросы.
- **Плейлисты:** массив `**music_playlists`** в `**desktop_configs.shell_state**` (через `**GET/PATCH /api/v1/desktop/shell-state**`, то же хранилище, что и `now_playing` и др.). На сервере — валидация и лимиты в `**shared/api/routers/desktop.py**` (`_sanitize_music_playlists_shell`). Запись на клиенте — **debounce** (~400 ms) и сброс при размонтировании. При первом входе после обновления **одноразовая миграция** из старого `localStorage` (`PLAYLIST_STORAGE_KEY` в `musicPlayerTypes.ts`), если на сервере только пустой «Любимые», а локально уже есть данные.

### Плейлисты и «Любимые»

- Встроенный плейлист с фиксированным id `**FAVORITES_PLAYLIST_ID`** (`musicPlayerTypes.ts`), имя **«Любимые»**, всегда есть после нормализации `**normalizePlaylistsWithFavorites`** (в т.ч. при первом запуске и миграции старых данных). Удалить его нельзя — только **очистить** треки; пользовательские плейлисты по-прежнему можно удалить целиком. При нормализации **сливаются дубликаты** записей с одним и тем же `id` и дедуплицируются id треков у «Любимые».
- Выбор плейлиста — выпадающий список `**MusicPlayerPlaylistPicker`** (прокрутка, счётчик треков, иконка у «Любимые»).
- Для выбранного плейлиста показывается detail-header: имя, количество треков, суммарная длительность и primary actions (дублировать/переименовать/сохранить как новый/удалить или очистить для favorites).
- Rename-flow работает через тот же диалог имени плейлиста с валидацией: пустое имя и дубликаты запрещены, системное имя **«Любимые»** зарезервировано, встроенный favorites-плейлист не переименовывается.
- Быстрое дублирование создаёт новый плейлист с авто-именованием `(<копия>)` и числовым суффиксом при конфликте (`(копия 2)`, `(копия 3)` ...), затем переводит selection на созданную копию.
- В detail-header доступны **Экспорт/Импорт** плейлистов в JSON: экспорт пишет envelope `eliteew.music_playlists.v1` с полем `music_playlists` в shell-state wire-форме (`id`, `name`, `track_ids`), импорт принимает и envelope, и «сырой» массив `music_playlists` и нормализует favorites.
- Избранное у трека: кнопка-**шестиугольник** в строке (`MusicPlayerFavoriteHex` + `MusicPlayerTrackList`), переключение без запуска воспроизведения; то же через контекстное меню. Имя **«Любимые»** зарезервировано для сохранения из диалога «новый плейлист».
- **Catalog prune (2026-07-17):** удаление id из плейлистов в shell выполняется только после **полной** загрузки audio-каталога (`catalogLoaded` в `MusicLibraryContext`) и только при **смене набора треков каталога**, не на каждый toggle «в любимые» (иначе свежий лайк сразу вычищался). `toggleFavorite` всегда нормализует список плейлистов, чтобы пустой pre-hydrate state всё равно создавал «Любимые» с новым id.
- **Playlist hydration (2026-07-17):** при выборе плейлиста (в т.ч. «Любимые») недостающие id догружаются через `GET /api/v1/content/batch` (чанки ≤100), чтобы список не ограничивался первой страницей каталога (`PAGE_SIZE=50`).
- Favorite toggle даёт немодальное feedback-сообщение в шапке плеера + `aria-live` статус без toast/modal, чтобы не перехватывать фокус у клавиатурной навигации по списку.
- **Удаление трека из каталога:** пункт **«Удалить из каталога…»** в контекстном меню строки — `DELETE /api/v1/content/{id}` (`contentApi.deleteContent`), подтверждение в диалоге браузера. После успеха трек исчезает из списка, **очереди** и id удаляются из всех **плейлистов** (с сохранением в shell state); если удалён **текущий** трек, воспроизведение сбрасывается (`setTrack(null)`).

## Воспроизведение и контекст

- **Старт воспроизведения (2026-06):** глобальный плеер сначала пробует **потоковое воспроизведение** через короткоживущий download-ticket URL (браузер сам запрашивает HTTP Range — звук начинается раньше, без «фейкового» прогресса загрузки). Если ticket/stream недоступен или вернул пустой URL, остаётся прежний путь: полная загрузка blob с retry и кеш в IndexedDB. Локальный IDB-кеш по-прежнему имеет **приоритет** — офлайн-повтор без сети. Ревизия трека (`version` / `v` query) участвует и в ключе IDB-кеша, и в ticket/blob fetch.
- **Порядок резолва источника** (`nowPlayingTrackAudioSource.ts`): **1)** blob из IndexedDB по ключу `{contentId}:{version|unversioned}`; **2)** inline stream URL (ticket); **3)** authenticated blob download + запись в IDB. Пустой stream URL и ошибка ticket ведут себя одинаково — fallback на blob без отдельного UX-слоя.

### API: download-ticket и HTTP Range (backend)

Контракт в `shared/api/routers/unified_content.py`; узкие pytest — `shared/api/tests/test_unified_content_download_range.py`, ticket service — `test_content_download_ticket_service.py`.

| Шаг | Маршрут | Auth | Назначение для плеера |
| --- | --- | --- | --- |
| 1 | `POST /api/v1/content/{content_id}/download-ticket` | Bearer | Выдать короткоживущий ticket; для старта воспроизведения SPA шлёт `disposition: "inline"` и опционально `v` (ревизия трека). |
| 2 | `GET /api/v1/content/{content_id}/download-by-ticket?ticket=…` | **Публичный** (opaque ticket, без JWT в URL) | Прямой URL для `<audio src>`; disposition и `v` берутся из ticket payload; ACL перепроверяется на сервере. |
| 3 | `GET /api/v1/content/{content_id}/download?disposition=inline&v=…` | Bearer | Fallback blob-путь с клиентской сборкой Range-чанков (`musicPlayerAudioDownload.ts`). |

Общий билдер байтов `_build_content_download_response` обслуживает и Bearer `download`, и `download-by-ticket`:

- заголовок `Accept-Ranges: bytes` на полном ответе `200`;
- `Range: bytes=…` → `206 Partial Content` + `Content-Range`;
- невалидный диапазон → `416 Requested Range Not Satisfiable`;
- `Content-Disposition: inline` для ticket с `disposition: inline` (потоковое воспроизведение).

Ticket TTL/replay: Redis, см. `content_download_ticket_service.py` (`CONTENT_DOWNLOAD_TICKET_TTL_SECONDS`, grace reuse для одного клиента).
- **Долгая загрузка:** если подготовка трека (ticket, blob или ожидание `canplay`) длится дольше ~15 с, **все** now-playing поверхности показывают пользовательский hint (`desktopUi.musicPlayer.nowPlayingBar.loadingStalled` / `loadingStalledHint`) и кнопку «Повторить» через shared-примитив `NowPlayingLoadHint` (`src/components/Audio/NowPlayingLoadHint.tsx`); воспроизведение при этом не прерывается автоматически.

| Поверхность | Файл | Stall hint + retry |
|-------------|------|--------------------|
| Нижняя панель Music Player | `MusicPlayerNowPlayingBar.tsx` | полный hint (текст + подсказка + retry) |
| Плавающий виджет | `DesktopWorkspaceFloatingWidget.tsx` | compact через `MiniAudioControls` |
| Панель виджетов | `DesktopWidgetsPanel.tsx` | compact в meta + `MiniAudioControls` (non-compact slot) |
| Трей / volume popover | `taskbarStrip/TaskbarVolumeControl.tsx` (mounted from `TaskbarRightToolbar.tsx`) | compact над mini-transport |

### Taskbar volume — planes & deferred OS mixer (2026-09-09)

**Status: DEFERRED — known; do not change globally until explicit operator task.**

| Plane | Mechanism | Controlled by |
|-------|-----------|---------------|
| **A. In-app media** | Shared `<audio>.volume` + `shell_state.now_playing.volume` | Taskbar `TaskbarVolumeControl`, Music Player bar, mini-controls |
| **B. Offline native** | rodio/cpal `native_audio_set_volume` | `MusicPlayerPanel` only — **not** SPA taskbar |
| **C. UI / notification sounds** | Web Audio + `desktop_sound_*` prefs | Notification Hub — independent of taskbar slider |

**What the taskbar slider is today:** NowPlaying **media gain** only (looks like an OS tray widget; is not).

**What it is not:** PulseAudio / PipeWire / ALSA master, notification loudness, or `native_audio` offline panel volume. Hardware volume keys change the **OS** mixer and do not sync with this slider.

**Deferred (explicit non-goals until tasked):**

- Replace NowPlaying slider with host mixer (`pactl` / `wpctl`) without a separate IA.
- One control that mutates both media gain and OS master.
- Bidirectional sync HW keys ↔ NowPlaying.
- Wire `native_audio_set_volume` into SPA taskbar as “system” volume.
- Merge notification mute with media mute.

**If revisited:** prefer honest copy («громкость плеера») first; any OS mixer work as a **separate** read-only or mutate surface (same discipline as host-network: mutate stays privileged; product stays thin) — never a silent substitute for plane A.

- Жёсткая ошибка (403/404/decode/empty blob) по-прежнему через `nowPlaying.*` + retry в строке трека / mini-controls.
- `**NowPlayingContext`** держит один `<audio>` и состояние. Для **меньшего числа ререндеров** страницы плеера контекст разделён:
  - **Transport** — всё, кроме `currentTime`, плюс `**getCurrentTime()`** для императивного чтения позиции без подписки на тики.
  - **Time** — только `currentTime` (подписка для прогресс-бара и эффектов, завязанных на время).
- Хуки: `useNowPlayingTransport()`, `useNowPlayingTime()`; `**useNowPlaying()`** склеивает оба для мест, где нужен полный снимок (виджет, совместимость).
- **Media Session** (системные кнопки/уведомления): см. `mediaSessionMusic.ts` и вызовы из контекста.
- **Событие** `desktop-music-track-changed` — диспатчится при смене трека (для подписчиков в оболочке).

## Аудит-база (Audio Player plan · 2026-05)

### Инварианты контекстов

- `NowPlayingContext` (`src/pages/Desktop/context/NowPlayingContext.tsx`, implementation `context/nowPlaying/*`):
  - один глобальный `<audio>` на весь desktop shell;
  - при новом `playTrack` предыдущий fetch/blob lifecycle прерывается/ревокается;
  - ducking микрофона меняет только runtime-gain (`audio.volume`), но не перезаписывает пользовательскую `state.volume`.
- `MusicPlaybackDomainContext` (`src/pages/Desktop/context/MusicPlaybackDomainContext.tsx`):
  - канонический вход внешнего playback-хэндофа — `desktop-music-play-track`;
  - очередность переходов `next/prev/repeat/shuffle` живёт в доменном слое поверх transport;
  - `music_playback` (rate/repeat/shuffle/queue) пишется в `shell_state` с debounce через coalesced PATCH.
- `MusicLibraryContext` (`src/pages/Desktop/context/MusicLibraryContext.tsx`):
  - плейлисты хранятся в `shell_state.music_playlists`, локальный `PLAYLIST_STORAGE_KEY` используется только для одноразовой миграции;
  - **2026-07-06:** полный audio-каталог не грузится на desktop mount; `ensureCatalogLoaded()` вызывается при первом открытии `MusicPlayerPage`;
  - при удалении трека из каталога очищаются stale-ссылки в current track, queue и playlists.

### Shell-state поля, связанные с music

Канон wire-полей в `DesktopShellStateOut/DesktopShellStatePatch` (`src/pages/Desktop/services/desktopApi.ts`, `api/routers/desktop.py`):

- `now_playing`: `track`, `volume` (durable transport metadata); playback position — tab-scoped `sessionStorage` (`eliteew-nowplaying-position`, см. `nowPlayingPositionSession.ts`), не PATCH;
- `music_playback`: `playback_rate`, `shuffle`, `repeat`, `queue` (режимы и очередь);
- `music_playlists`: сохранённые плейлисты (включая `FAVORITES_PLAYLIST_ID` после нормализации);
- `window_snapshot`/desktop widgets сами не дублируют queue, а читают transport/события now-playing.

### I18n покрытие (проверено в `desktopUi` + EWA)

- Подтверждены ключи ошибок playback (`desktopUi.nowPlaying.*`): `error403`, `error404`, `errorStoragePending`, `errorAborted`, `errorDecode`, `errorEmpty`, `errorLoadFallback`.
- Stall/degraded loading copy: `desktopUi.musicPlayer.nowPlayingBar.loadingStalled`, `loadingStalledHint` (ru/en).
- `music_play_track` CTA в EWA operations уже i18n-ключом (`ewaCompanion.operationsPlayReadyTrackNow`), server action fallback/intent labels тоже ключевые.
- На текущем этапе основной UI `MusicPlayerPage` покрыт ключами `desktopUi.musicPlayer.*` (ru/en), locale-aware sort/compare, a11y landmarks (`trackList.regionAria` / `gridAria`, `header.searchAria`). Persisted favorites canonical name — `FAVORITES_PLAYLIST_CANONICAL_NAME` в `musicPlayerTypes.ts`.

### Browser storage ключи (music scope)

- Legacy localStorage migration:
  - `eliteew-nowplaying` (`LEGACY_LOCAL_STORAGE_KEY` в `nowPlaying/constants.ts`, re-export через `NowPlayingContext`) — только read/remove при миграции track+volume в shell-state; position уходит в sessionStorage;
  - `eliteew-music-playlists` (`PLAYLIST_STORAGE_KEY`) — read/remove для миграции плейлистов в `shell_state.music_playlists`.
- Tab-scoped playback position:
  - `eliteew-nowplaying-position` (`nowPlayingPositionSession.ts`) — checkpoint позиции в рамках вкладки (F5/refresh); не синхронизируется cross-device.
- Session deep-link:
  - `eliteew.desktop.deepLink.pendingMusicPlay` (`PENDING_MUSIC_PLAY`) — cold-start fallback для handoff.
- IndexedDB cache:
  - DB `eliteew-music-audio-cache`, store `audio_blobs` (`musicAudioBlobCache.ts`), управляется через `VITE_MUSIC_IDB_CACHE*`.
  - При logout / смене пользователя store очищается через `clearCachedAudioBlobs()` из `clearDesktopShellStateCache()` (`AuthContext` → `desktopApi.ts`).

### Autoplay unlock race (2026-08-08, tightened 2026-08-09)

`captureNowPlayingUserActivation` (`nowPlayingAudioUnlock.ts`) — **только** мост жеста через **async** gap перед новым `src` (ticket/blob fetch): muted `play()` → при неизменённом `src` делает `pause` + unmute; если к `then` уже подставлен **другой** `src`, unlock **не** вызывает `pause` и только снимает свой mute.

**Cause (2026-08-09):** sync resume / in-place play / seek-resume вызывали unlock **перед** `audio.play()` на уже загруженном треке. `src` не менялся → deferred unlock `pause` гасил слышимый play (~мс звука → Pause). **Fix:** unlock остаётся **одним** вызовом в `playTrackCb` перед async load; `play()` / `playInPlace` / seek-resume делают только `audio.play()` в жесте. Stream attach теперь сразу пишет `loadedTrackIdRef` (как blob), чтобы resume не ошибочно remint’ил через `playTrackCb`+unlock. Locks: `nowPlayingAudioUnlock.test.ts` (same-src anti-pattern), `NowPlayingContext.resume.test.tsx`, `nowPlayingSeekAbort.contract.test.ts`.

### Same-track click + hard media recovery (2026-08-08)

Browser DevTools: click по уже играющему треку remint’ил ticket stream → часто `MEDIA_ERR_NETWORK` / FFmpegDemuxer при mid-track seek-on-reload; UI оставался `loadingStage=playing` при живом `audio.error`.

**Cause fixes** (`useNowPlayingController`, `audioHelpers`, `useNowPlayingAudioListeners`):

1. **Same healthy track** (`resolveSameTrackPlayAction`): playing → pause in place; paused → resume; ended → restart `currentTime=0` — **без** teardown/`playTrackCb` remint.
2. **Hard `MEDIA_ERR_*` (не ABORTED):** `error` listener → honest `withTrackError` + `loadedTrackIdRef=null`; один auto-recover с **`preferBlob: true`** (ticket mid-seek fragile).
3. **`play` / `seek` / `retryCurrentTrack`:** при hard error → `forceReload` + preferBlob, позиция через `initialSeekRef`.
4. Diagnostics: не оставлять `playing` при живом hard `audio.error`.

Locks: `audioHelpers.sameTrack.test.ts`, `nowPlayingSeekAbort.contract.test.ts` (same-track + error listener clauses).

### Ticket stream vs Файловый менеджер preview (Tauri / WebView)

| Path | Transport | MIME |
|------|-----------|------|
| Файловый менеджер «Просмотр» | Authenticated **blob** + `normalizeAudioBlob` → `audio/*` | Forced |
| Music Player NowPlaying (browser SPA) | Prefer **download-by-ticket** stream URL | Server `Content-Type` via `normalized_mime_type` (audio ext + empty/octet → `audio/*`) |
| Music Player NowPlaying (**Tauri**) | Prefer authenticated **blob** (skip ticket stream) | Same as preview + `normalizeAudioBlob` |
| Music Player NowPlaying (**EmpiierOS** `foflineNative`, no Tauri) | `GET /content/{id}/download` bytes → `AudioContext.decodeAudioData` → `AudioBufferSourceNode`. No `HTMLMediaElement.src` to `download-by-ticket` or `blob:` | Decode failure is `AUDIO_DECODE_ERROR`. Do not retry a ticket media URL. |

WebView2 / WebKit в Tauri часто отвергают progressive ticket stream (MIME/Range) → UI «ошибка декодирования» / долгий remint→blob / stutter. **Cause fixes:**

1. **Backend MIME (2026-08-08):** `api/utils/content_mime_normalization.py` maps empty/`application/octet-stream` + audio extension → `audio/mpeg` etc. for ticket downloads.
2. **Tauri prefers blob:** `shouldPreferNowPlayingBlobOverTicketStream` in `nowPlayingTrackAudioSource.ts` (skip stream fail→remint→chunked blob dance).
3. **MusicForge / `music-generator` surface prefers blob** (same helper) — auto-play after generation skips fragile ticket stream.
4. **Stream still has remint + `loadBlobFallback`** for browser; classify via `HTMLMediaElement.error.code`.
5. **Poisoned IDB cache (2026-08-08):** magic-byte gate in `normalizeAudioBlob.looksLikeAudioBytes` + `musicAudioBlobCache` (refuse put / delete on bad get). Decode from `idb-cache` also triggers `loadBlobFallback` (`idb-decode-blob-fallback`) after deleting the bad key — JSON/HTML error bodies labeled `audio/mpeg` no longer sticky-fail «почти все треки».
6. **`loadedTrackIdRef` only after canplay / typed blob attach** — not on bare `audio.src = streamUrl` (else widget «Play» on broken src → instant decode). Cleared at start of `playTrackCb`.
7. **EmpiierOS FoFline (2026-09-20):** GStreamer cancels `fofline-spa:` ticket URLs and `blob:fofline-spa:` and leaves ALSA held. The pack plays from memory (`foflineDecodedPlayback.ts`). Pause/stop calls `source.stop()`, closes the `AudioContext`, and `removeAttribute('src'); load()` on any leftover `<audio>`. Browser and Tauri keep `<audio src>`. Do not add Pulse/PipeWire from this pack. If decode is dead on glass after a pack that never sets those media URLs, stop — the OS owns an ALSA helper. Do not invent it here.

Locks: `normalizeAudioBlob.test.ts`, `attachStreamBlobFallback.contract.test.ts`, `nowPlayingTrackAudioSource.test.ts`, `test_content_mime_normalization.py`.

### Theme-token покрытие (music surfaces)

- **Layout (2026-06):** … Пользовательские строки — `desktopUi.musicPlayer.*` (очередь, контекстное меню, empty states, toolbar, track row, **header**, **playlist/delete dialogs**, **notifications**, **now-playing transport**, **playlist picker**, **shortcuts help**, **duplicate naming**).
- Now-playing bar + transport controls используют `--desktop-*` токены (`MusicPlayerNowPlayingBar`, `MiniAudioControls`), включая focus ring по accent.
- Shared authenticated preview (`AuthenticatedAudioPreview`) и Файловый менеджер preview-контейнер используют те же desktop surface/text/border токены.
- Floating widget/mini-strip (`DesktopFloatingWidgetNowPlayingStrip`) — quiet `FLOATING_WIDGET_NOW_PLAYING_*` chrome (`widgetChromeStyles.ts`); sentence-case «Сейчас играет»; без accent radial wash.

### Native `<audio controls>`: где оставляем осознанно

В reusable surfaces, где это уместно, нативные контролы заменены shared-примитивами (`InlineAudioPreview`/`MiniAudioControls`): например fallback preview в UGS result card и EWDesk news audio attachment.

Нативный `<audio controls>` **оставляем** только там, где превью должно быть изолированным и не выглядеть как часть глобального Music Player:

- GAF voice-message surfaces (`GafChatVoiceMessagePlayer`, `GafChatAttachmentBlock`) — это per-message chat playback с отдельной UX-моделью, не очередь Music Player.
- Generic document/media inspectors (`FilePreviewModal`, `ContentManagerFileCard` inline) — быстрый file-inspect контур; **handoff** в Music Player: ПКМ «Открыть в Music Player» / preview `AuthenticatedAudioPreview` → `requestPlayAndOpenMusicPlayer` (exclusive NowPlaying transport).
- **MusicForge result** with `content_id`: **no** local `<audio>` — only global NowPlaying (`requestPlayInMusicPlayer` / CTA `requestPlayAndOpenMusicPlayer`) so auto-play and «Слушать в плеере» cannot dual-stream with widget/taskbar.
- Operator/knowledge surfaces (`VoiceTranscriptionPanel`, админ/маркетинг аудио-вставки) — служебные review-панели, где нативный контрол даёт максимально предсказуемое поведение без лишнего UI-слоя.

### Lightweight checklist для следующих изменений плеера

Перед merge любого изменения music playback:

1. Проверить контракт пути `source action -> desktop-music-play-track -> MusicPlaybackDomain -> NowPlaying`.
2. Проверить очистку state при удалении треков (current track, queue, playlists, persisted shell-state).
3. Проверить audio lifecycle (`fetch abort`, ticket stream vs blob `URL.revokeObjectURL`, cache hit/miss telemetry).
4. **Seek / scrub:** `AbortError` от прерванного `play()` и `MediaError.MEDIA_ERR_ABORTED` после перемотки stream **не** должны становиться sticky UI «Загрузка отменена»; seek при активном play возобновляет `play()` (`useNowPlayingController.seek`, `attachLoadedAudioSource`). Hard `MEDIA_ERR_NETWORK`/`DECODE` → preferBlob remount + honest error (не zombie «playing»). Lock: `nowPlayingSeekAbort.contract.test.ts`, `audioHelpers.sameTrack.test.ts`.
5. **Same-track row click:** healthy loaded id → pause/resume in place (не remint ticket).
6. Проверить i18n для новых ошибок/CTA минимум в `ru/en`.
7. Прогнать Biome + targeted Vitest + `pnpm run build:react-compiler`.
8. Если менялся wire API/shell-state — обновить `api/routers/desktop.py` tests и этот документ.

### Ручной smoke (оператор)

1. Сгенерировать трек (Music Generator или EWA run) и дождаться появления в библиотеке.
2. В EWA operations нажать **Play now** и проверить, что трек стартует в global now-playing без открытия отдельного inline `<audio>`.
3. В Music Player выбрать этот же трек, проверить `shuffle/repeat/queue` persistence после reload desktop shell.
4. Смоделировать временно недоступный blob (или ранний доступ к свежему файлу) и проверить retry/error copy (`errorStoragePending`/fallback).
5. Очистить audio cache (IDB path) и повторно воспроизвести трек, подтвердив network fetch + повторное кеширование.
6. Во время воспроизведения перемотать scrubber / ←→ seek: трек должен продолжить играть **без** sticky «Загрузка отменена. Повторить».
7. Клик по **тому же** играющему треку в списке → пауза (без «Загрузка трека»); повторный клик → resume; hard network error → retry/blob recovery без zombie «playing».

## Список треков (UI)

- Ниже порога `**MUSIC_LIST_VIRTUAL_THRESHOLD`** — обычный список; при включённой анимации появления (короткие списки) — `motion.li` с ограниченной задержкой по индексу.
- От порога и выше — `**@tanstack/react-virtual**`: переменная оценка высоты строки, `overscan` зависит от длины списка, прокрутка к текущему треку с учётом видимых виртуальных элементов и `**requestAnimationFrame**` после измерения.
- **Строка трека** (`MusicTrackRow.tsx`): `memo` с явным сравнением полей `Content` (теги и metadata — без `JSON.stringify`); badge ошибки воспроизведения — `desktopUi.musicPlayer.trackRow.playbackErrorBadge` (list + grid). `MusicPlayerTrackList.tsx` сохраняет re-export строки для стабильности тестовых импортов.
- **Вторичная мета-информация строки:** где данные доступны, строка показывает style, BPM, source app и дату создания; на узкой ширине — chips под заголовком, на ultrawide (`@container` ≥1100px) — колонки **Created** / **Source** (style/BPM остаются chips).
- **Плотность списка:** переключатель `Комфортный/Плотный` в secondary-toolbar меняет плотность строк (отступы, размеры превью, типографика, колонка длительности) и сохраняется локально (`eliteew.music-player.list-density.v1`).
- **Режим отображения:** переключатель `Список/Сетка` включает artwork-first карточки (`sm:2` / `lg:3` / `xl:4` / `2xl:5`); в сетке generated-аудио поднимается выше и помечается бейджем `Generated`, при этом play/context/favorite остаются на карточке.
- **Skeleton загрузки:** при первичном `loading` вместо одиночного спиннера показываются skeleton-структуры, совпадающие с текущим режимом (`Список`/`Сетка`) и плотностью (`Комфортный`/`Плотный`).
- **Partial failure:** если список загрузился, но у части элементов нет обложки/длительности, показывается неблокирующий warning-баннер (`desktopUi.musicPlayer.presentationGaps.*`); playback при этом не блокируется.
- **Empty states:** `MusicPlayerEmptyState` различает пустую библиотеку, пустую папку «Музыка», фильтрованный ноль и ветки «Любимые»; для пустой папки «Музыка» показывается сравнение «Папка Музыка vs Вся музыка» и CTA «Показать всю музыку».
- **Empty CTAs:** из пустой библиотеки/папки «Музыка» доступны «Сгенерировать музыку» (`MusicForgeApp` via `requestOpenDesktopApp`) и «Загрузить в Файловый менеджер» (deep-link с `contentManagerFolderItemId: music`). Legacy component ids `MusicGenerator` / `MusicEvolutionApp` redirect to MusicForge.
- **Теги:** overflow через `+N`/«Свернуть»; активный тег — отдельный chip «Фильтр: #tag» с быстрым сбросом.
- **Фильтр происхождения:** `Все / Сгенерированные / Загруженные` (persist `eliteew.music-player.origin-filter.v1`), client-side через `isGeneratedMusicTrack`.
- **Сортировка:** «Создано» (API `date` → `created_at`), «Изменено» (client-side `updated_at` в загруженном списке), предупреждение при сортировке по длительности если metadata неполная.
- **Оболочка списка** (`MusicPlayerTrackList`): кастомное сравнение пропсов — если массив `**items`** новый по ссылке, но совпадает длина и ссылки на те же объекты по индексам, лишний ререндер не делается.
- **Поиск:** строка ввода обновляет состояние сразу; **фильтрация списка** идёт через `**useDeferredValue`**, чтобы не блокировать ввод на длинных списках (визуально — лёгкое «догоняние» отображаемого фильтра).
- **Stage dock / queue:** toolbar toggle «Показать/Скрыть сцену и очередь» (`eliteew.music-player.stage-dock.v1`, default open). Narrow: stacked `MusicPlayerQueuePanel` above the list. Wide (`@container` ≥1100px): `MusicPlayerStageDock` beside the catalog (now-playing summary + embedded queue); stacked strip is hidden. Same reorder / move-to-top / add-current-list actions.
- **Playlist detail header:** под селектором плейлистов выводится карточка выбранного плейлиста (имя/кол-во/длительность) и быстрые действия, включая rename-flow с защитой reserved-name.

## Производительность и устойчивость (сводка)

Изменения вводились итеративно; актуальная структура зафиксирована ниже, хронология доступна в git history. Смысловые группы:

1. **Transport vs time** — подписка страницы на обновления позиции убрана с основного дерева; A–B loop и аналоги сидят на `useNowPlayingTime` там, где нужны тики.
2. **`handlePlayTrack`** живёт в `useMusicPlayerTrackActions` и сохраняет стабильную ссылку, чтобы memo-компонент **`MusicTrackRow`** не сбрасывался при каждом обновлении transport-контекста (play/pause/loading и т.д.).
3. `**startTransition`** — смена сегмента «Музыка / Вся музыка», теги, плейлист, сортировка, сброс фильтров в пустом состоянии; ввод поиска **без** transition.
4. **Индексы** — `Map` id→индекс для порядка воспроизведения и виртуального списка; `Set` для фильтра по плейлисту внутри `useMemo`.
5. **Обработчики** — именованные `useCallback` распределены по владельцам: каталог (`useMusicPlayerCatalog`), projection/hydration (`useMusicPlayerTrackPipeline`), плейлисты, действия трека и клавиатура (`useMusicPlayerPageShortcuts`, ref на transport).
6. **Виджет и трей** — мини-плеер и трей используют transport (и время только там, где нужна полоска прогресса).

## Горячие клавиши (Music Player window)

Активны только когда окно **Music Player** в foreground (`windowSurface.backgroundLevel === 'foreground'`) и фокус **не** в `input` / `textarea` / `contentEditable`. При открытом модальном окне shortcuts help клавиши транспорта отключены.

| Клавиша | Действие |
|---------|----------|
| Space | play / pause (заблокировано при `isLoading`) |
| ← / → | seek ± выбранный шаг (5 / 10 / 30 с) |
| ↑ / ↓ | громкость ±0.1 |
| R | repeat: off → all → one |
| S | shuffle toggle |
| `/` или `?` | фокус на поиск |
| Ctrl/Cmd + F | фокус на поиск |

Глобальных desktop-shortcuts для repeat/shuffle нет — только Media Session (системные медиа-клавиши). Копирайт: `desktopUi.musicPlayer.header.hotkeysInline`, модалка `musicPlayer.shortcutsModal.*`.

## Безопасность и CSP

Воспроизведение через **blob:** после загрузки файла — см. таблицу в `**platform/FRONTEND-SECURITY-NGINX-STATIC.md`**.

## Client edition / offline (honesty)

Manifest `shared/apps/music_player/app.manifest.yaml`: `edition_default.client: true`, `offline_capable: partial`.

| Surface | Behavior |
|---------|----------|
| Desktop SPA (cloud / online) | Full catalog, shell_state playlists, NowPlaying stream/blob/IDB (`<audio>` in `NowPlayingContext`) |
| Tauri client offline panel (`0.4.19+`) | Native OS picker → opaque TTL grant → `native_audio_play_from_grant` (Wave 7 / F-11/F-13). **No** `native_audio_play_bytes` / HTML5 `<audio>` fallback. Copy: cloud library unavailable offline; SPA deep-link CTA when online path exists |

**Offline native engine (desktop-client):**

| Item | Path / contract |
|------|-----------------|
| Panel | `pack-organization/connection-agent/src/features/shell/apps/MusicPlayerPanel.tsx` |
| Bridge | `nativeAudioPlayBytes` / pause / resume / stop / seek / volume in `src/lib/tauri-bridge/commands.ts` |
| Rust | `src-tauri/src/native_audio.rs` + `commands/native_audio.rs` (single mutex engine) |
| Stage | `app_data_dir/native-audio/current.<ext>` only (sanitized name) |
| Dual play | New play stops the previous track |
| Seek while idle | Defined no-op (`code=idle`) |
| Transport toggle | Single-flight (`transportInFlightRef`) + `playingRef` so a second click before re-render cannot flip play→pause |
| Locks | `MusicPlayerPanel.honesty.contract.test.ts`, `nativeAudio.contract.test.ts`, Rust `native_audio` unit tests |

Do **not** claim remote `GET /content` or `music_playlists` sync in the offline panel. Pack note: `platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md`. Contract: `pack-organization/connection-agent/src/features/shell/apps/MusicPlayerPanel.honesty.contract.test.ts`.

## Mobile parity (watch)

Android has playlist favorites normalization (`MusicPlayerPlaylistsSupport.kt`) and expanded player chrome — **not** full Desktop Music Player (virtual list, queue UI, A–B, origin filters). Treat feature parity as watch, not a desktop blocker. Stability backlog: `music-player-005`.

## Smoke / verify

```bash
# API sanitize (no token)
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/test_desktop_shell_state_music_playlists.py -q

# Stack0 wire (Bearer required)
MUSIC_PLAYER_SMOKE_TOKEN=… bash docker/scripts/music-player-stack0-smoke.sh

# Desktop Playwright (opt-in)
DESKTOP_SHELL_E2E_RUN=1 MC_E2E_BASE_URL=https://app.eliteew.ru \
  pnpm exec playwright test e2e/music-player-desktop-smoke.spec.ts
```

## Связанные документы

- Оболочка десктопа и UGS: `**product/desktop/UGS-DESKTOP-SHELL.md**`
- Панель задач (паттерны memo, prefs): `**product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md**`
- Производительность фоновых монтирований: `**.cursor/rules/desktop-performance-background-mounts.mdc**`
- Desktop shell + окна: `**.cursor/rules/desktop-shell-and-windows.mdc**`
- Генератор песен (отдельный продукт): `**product/MUSIC-GENERATOR.md**`
