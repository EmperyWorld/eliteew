# Руководство по разработке Android-приложения EliteEW

В данном документе собран весь опыт, архитектурные решения и оптимизации, примененные при разработке и рефакторинге мобильного Android-приложения EliteEW. Этот гайд обязателен к прочтению для всех разработчиков и AI-агентов, вносящих изменения в кодовую базу `pack-cloud/mobile/`.

## 1. Архитектура и Управление состоянием (MVVM + MVI)

*   **Единый источник истины:** Приложение использует `MainViewModel` как глобальный контейнер состояния, содержащий `MainUiState`.
*   **Дробление состояния (State Slicing):** **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** подписываться на весь `MainUiState` в корневых компонентах (например, в `MobileRoot`). Это вызывает лавинообразные рекомпозиции всего приложения.
    *   *Правильно:* Использовать `map` и `distinctUntilChanged()` для выделения узких `StateFlow` (например, `chatUiState`, `feedUiState`) и собирать их через `collectAsStateWithLifecycle()` непосредственно в экранах (в `NavHost`).
*   **Тяжелые вычисления:** Любые операции сортировки (например, `sortedOldestFirstForChat`), фильтрации, дедупликации списков (чаты, сообщения, посты) **должны** выполняться на `Dispatchers.Default` (через `withContext(Dispatchers.IO)` или `Dispatchers.Default`), чтобы не блокировать Main Thread.

## 2. Пользовательский интерфейс (UI/UX) и Jetpack Compose

*   **Стиль и Темы:** Приложение поддерживает стили `SYSTEM`, `GLASS` и `PREMIUM` (профиль → оформление).
    *   Используются токены Material 3 (`MaterialTheme.colorScheme`); палитры GLASS и PREMIUM **разные** (холодный cyan vs тёплое золото).
    *   **GLASS:** полупрозрачные карточки (`~0.58` alpha), белая обводка, голубой градиент фона; scaffold полупрозрачный.
    *   **PREMIUM:** плотные карточки (`~0.94` alpha), золотая обводка, тёплый/фиолетовый градиент фона.
    *   Аватар профиля: tap на фото в Profile → `POST profile/avatar` после WebP-сжатия (`MobileImageUploadCompress.kt`, тот же pipeline что GAF chat).
    *   **Мобильный профиль (синхронизация):** настройки оформления/a11y/уведомлений хранятся отдельно от веб-профиля в `users.preferences.mobile`. API: `GET/PATCH /api/v1/mobile-app/profile`. Клиент: `MobileProfileRepository` + `MobileProfileSync` (pull при логине, debounced push при изменениях; фон — upload в Unified Content + `background_content_id`). Категорийный mute остаётся device-local.
    *   **Content library (mobile CM lite):** экран `MobileContentLibraryScreen` — только `GET /content` (list profile `compact`), **без** bulk prefetch/download. List/player thumb: `GET …/thumbnail` **только** если `thumbnail_url` задан (`allowsStoredThumbnailFetch`); иначе mime/music-icon (без probe image/pdf/text/audio и без `/download` fallback). Tap на файле → bottom sheet (слушать / кэш / скачать / открыть). FAB — upload в unified content. Плеер prefetch — максимум current + next track (`EmperyMediaPlayerController.prefetchQueueWindow`).
    *   Общие примитивы — `PremiumGlass.kt` + `LocalMobileSurfaceStyle` (провайдер в `MainActivity`); не хардкодить один alpha для обоих стилей.
    *   **Glass/Premium tokens:** `PremiumGlass.kt` + [`MOBILE-ANDROID-SCALE-CHROME-POLICY.md`](MOBILE-ANDROID-SCALE-CHROME-POLICY.md); OTA/release — [`MOBILE-ANDROID-RELEASE-RUNBOOK.md`](MOBILE-ANDROID-RELEASE-RUNBOOK.md).
    *   **Канон scale/chrome (0.2.97+):** [`MOBILE-ANDROID-SCALE-CHROME-POLICY.md`](MOBILE-ANDROID-SCALE-CHROME-POLICY.md) — `MobileScaleChromePolicy`, touch targets, per-screen acceptance; **не** дублировать `fontScale >= 1.08f` в feature-модулях.
    *   **Composer / banners / chips (v0.2.78+):** `PremiumComposerShell` + `PremiumComposerFieldShape` для TextField; reply/edit/attachment banners → `PremiumRowSurface`; мелкие chips → `PremiumChipPill`; switch rows в Profile → `PremiumRowSurface`.
    *   Скругления карточек: `RoundedCornerShape(20.dp)`.
    *   Скругления сообщений в чате асимметричные: `topStart = 16.dp, topEnd = 16.dp, bottomStart = if (isMine) 16.dp else 4.dp, bottomEnd = if (isMine) 4.dp else 16.dp`.
*   **Кнопки "Обновить":** На основных табах (Профиль, Чаты, Друзья, UGS) ручные кнопки «Обновить» **отключены** — данные подтягиваются при входе, через Socket.IO и **pull-to-refresh**. **EWDesk (0.2.97+):** без header refresh — только shell pull-to-refresh и retry в error state; top-right — иконка уведомлений. Исключения: **Центр уведомлений** (compact header refresh) и nested sub-screens UGS/Desktop с icon refresh в top bar. Профиль: refresh/logout/access/notifications — icon-only inline под email, не в spotlight header; refresh жёлтый, logout красный с confirm, access — зелёный треугольник на `https://access.eliteew.ru/`, notifications — колокольчик-toggle.
*   **Premium UI (v0.2.16+ / 2026-09-03):** `PremiumSpotlightCard` and **`PremiumSectionCard`** do **not** render section hats (icon+title+subtitle). Content owns the panel; title/subtitle remain a11y `contentDescription` only. Nested UGS/Desktop/Notifications top bars are **icon chrome** (back/refresh) without title/subtitle columns. UGS Hub has no `UgsAiHubHero` — energy stays in overview metrics.
*   **Wallpaper:** custom background is a low-alpha Crop atmosphere + strong `background` scrim (not a readable full-bleed photo). Presets/picker unchanged in Profile.
*   **Cold start:** Android 12+ splash icon is `ic_splash_golden_hand` (frame from `start_app_mobile.mp4`); Compose then plays the framed golden-hand MP4 at 3× — not the cyan `ic_launcher` bars.*   **Chat unread (v0.2.18+):** badge только на аватаре; строка списка **не** меняет border/background/font. Сумма unread — badge на tab «Чат» в bottom navigation.
*   **Мессенджер list/thread:** поле создания нового чата не показывать постоянно в списке; запуск поиска пользователя — через plus-кнопку, видимую только на экране выбора чата. В переписке шапка компактная, без лишнего subtitle. При открытой клавиатуре в активной переписке в мессенджере скрывать root bottom navigation и применять к composer только `WindowInsets.ime`, как в UGS keyboard contract.
*   **Push-уведомления:** toggle живёт в **Профиль** рядом с refresh/access/logout как icon-only колокольчик; **Центр уведомлений** показывает список и refresh без настроек. Перед показом пуша проверять `notifications_enabled` из prefs.
*   **UGS Songs (MusicForge SFT TOP):** thin client на **`/api/v1/music-forge/*`** — `POST …/runs` → poll `GET …/runs/{id}` до `completed|failed|cancelled` (`MusicForgeMobileSupport.kt`, timeout ~31 min на `longPollingRetrofit`). Server lane = **SFT TOP** (Ideal TOP canon); mobile **не** шлёт `ugs_workflow` / XL Base lyrics→style→generate. Create body: `idea`, `language` (`ru|en|auto`; es/fr → `auto` + note в `constraints`), `style_hint`, `constraints` (vocal + TOP hint), `duration_seconds=220`. Pipeline pill: **MusicForge · SFT**. Форма «Создать» — **`MobileScaleChromePolicy`**: на COMFORT и при крупном системном шрифте язык/голос в **`FlowRow`**, жанры — горизонтальный скролл с `labelMedium`; pipeline pill скрывается при stacking. Долгий create+poll — **`withContext(Dispatchers.IO)`** + **`PremiumLoadingCard`**. История: merge `source_service=music_forge` + legacy `music_generator` (старые XL треки остаются видимы). Tap — **Play/Pause** через **`EmperyMediaPlayerHolder`**; bottom sheet — **Download** / **Delete**. CTA — зелёная **Создать песню**. Тема — **`UgsSongTopicPolicy`**. Канон: [`MUSIC-FORGE-IDEAL-TOP-SONG-CANON.md`](../MUSIC-FORGE-IDEAL-TOP-SONG-CANON.md), [`MUSIC-FORGE-APP.md`](../MUSIC-FORGE-APP.md). См. [`MOBILE-ANDROID-SCALE-CHROME-POLICY.md`](MOBILE-ANDROID-SCALE-CHROME-POLICY.md).
*   **Списки (LazyColumn):**
    *   Обязательно использовать `key` в `items`, чтобы Compose мог эффективно переиспользовать узлы.
    *   Для плавной анимации добавления элементов использовать `Modifier.animateItem()`.
    *   **Автоскролл в чате:** Использовать `listState.scrollToItem(lastIdx)` внутри `LaunchedEffect`. Избегать `animateScrollToItem` для больших списков, так как это вызывает лаги. Скролл должен срабатывать при открытии чата (`lastVisible == -1` или `listState.firstVisibleItemIndex == 0`) и при нахождении пользователя внизу списка (`lastVisible >= lastIdx - 2`).
*   **Отображение Markdown:** В ленте EWDesk посты приходят в формате Markdown. Рендер — `com.halilibo.compose-richtext` через `FeedMarkdownBody` (`feature/feed/FeedMarkdownRender.kt`): autolink, переписанные API asset URL (`EwDeskLinkedMediaUrls`), collapse/preview по `MobileScaleChromePolicy`. Hero media (video ExoPlayer, audio dock, cover image) — scale-aware aspect 4:3 (large font/COMPACT stacking) или 16:9. Ссылки `/__eliteew-desktop-open-app__/…` → `FeedUriHandler` / `toStoreAppIdForMobileShell()` → shell tab через `onOpenApp` (GAFChatApp → chat, UGSHubApp → ugs, …). **DEBT-X-01:** pull-to-refresh только через shell; education cards rail (DEBT-X-05) — `topContent` в `EwDeskFeedScreen`, не трогать при feed-правках.
    *   Ссылки вида `/__eliteew-desktop-open-app__/AppId` перехватываются через кастомный `UriHandler` и маршрутизируются во внутренние вкладки приложения (GAFChatApp -> Chat, UGSHubApp -> UGS и т.д.).
*   **Аватарки:** Везде, где нужен аватар пользователя (Профиль, Друзья, Чат), использовать `ProfileAvatarPlaceholder`.
    *   *Важно:* URL аватарок с сервера часто приходят относительными (начинаются с `/`). Компонент `ProfileAvatarPlaceholder` автоматически подставляет `https://app.eliteew.ru` перед передачей в `Coil`.
    *   Системные аккаунты (`isSystemAccount = true`) в чатах отображают иконку приложения (`applicationInfo.icon`), а не инициалы.

## 3. Работа с сетью и API (Retrofit + Socket.IO)

*   **Таймауты для AI:** Обычные запросы используют таймаут 30 секунд. Для долгих генераций (UGS: Изображения, Песни, Презентации) **обязательно** использовать `longPollingRetrofit` с таймаутом 180 секунд (`timeoutSeconds = 180L`).
*   **Скачивание файлов (PDF, MP3, PNG):**
    *   **Запрещено** открывать ссылки на скачивание защищенного контента в браузере (вызовет ошибку авторизации).
    *   *Правильно:* Скачивать файл напрямую через Retrofit (`@Streaming suspend fun downloadContent(): ResponseBody`), сохранять его локально и открывать через `Intent.ACTION_VIEW`.
    *   На Android Q (API 29) и выше использовать `MediaStore.Downloads`. На старых версиях — `getExternalFilesDir` + `FileProvider`.
*   **Ограничение истории:** При запросе истории генераций (изображения, песни, презентации) устанавливать `limit = 10`, чтобы не перегружать память устройства и сеть.
*   **Realtime (Socket.IO):**
    *   Мост `RealtimeChatBridge` слушает события `gaf_chat.message_new`, `notification` и др.
    *   При получении события, если приложение в фоне или открыт другой экран, вызывается `NotificationHelper.showNotification` для отображения системного пуша.

## 4. База данных (Room)

*   **Миграции:** Любое изменение структуры таблиц (например, добавление полей `partnerName`, `partnerAvatarUrl`, `isSystemAccount` в `ChatEntity`) **требует** создания новой версии базы данных и написания миграции (например, `MIGRATION_3_4`).
    *   *Никогда* не меняйте схему без инкремента `version` в `@Database` и добавления миграции в `ALL_MIGRATIONS`. В противном случае приложение будет падать (crash) у пользователей при обновлении (destructive fallback работает только в debug-сборках).
*   **Кэширование:** Данные (чаты, друзья, профиль) кэшируются в Room для мгновенного отображения при холодном старте, пока идет фоновый запрос к API.

## 5. Уведомления (FCM и Локальные)

*   Приложение использует `MobileFirebaseMessagingService` для получения FCM-токена и (опционально) data-пушей.
*   Основной поток уведомлений сейчас идет через **Socket.IO** (когда приложение активно или в фоне, но не убито).
*   `NotificationHelper` отвечает за создание каналов (`NotificationChannel`) и вывод уведомлений в системную шторку (со звуком и иконкой).
*   **Настройки пользователя:** Перед показом уведомления (как из FCM, так и из Socket.IO) всегда проверяется настройка `notifications_enabled` из `SharedPreferences` (`empery_mobile_ui`). Если пользователь отключил уведомления в Профиле, пуши игнорируются.

## 6. Сборка и Релиз

*   **Embedded SPA (desktop route в WebView):** канон — [`MOBILE-ANDROID-EMBEDDED-SPA-WEBVIEW-TEMPLATE.md`](MOBILE-ANDROID-EMBEDDED-SPA-WEBVIEW-TEMPLATE.md), UI/layout — [`MOBILE-ANDROID-EMBEDDED-SPA-UI-STYLE.md`](MOBILE-ANDROID-EMBEDDED-SPA-UI-STYLE.md). Маршруты `#/mobile-*` (EWA, Ассистент, Связи, Feedback, Notifications, Файловый менеджер, EWDesk, Professional Worlds, App Store, Desktop Settings), OTA **≥ 0.2.154** (полный набор embedded — **≥ 0.2.167**). Host `EmperyMobileEmbeddedSpaWebViewActivity` (`useWideViewPort = true` — layout по `embeddedMobile`, см. UI-STYLE §3.1), registry `MobileEmbeddedOidcBridgeRegistry`, SPA `recoverMobileEmbeddedSession()`. Перед открытием WebView — `AuthRepository.ensureFreshAccessToken()`.
*   Сборка релизного APK: `./gradlew :app:assembleProdRelease -Pmobile.android.ci=true --no-daemon`
*   При добавлении новых иконок или ресурсов, убедитесь, что они импортируются из правильного пакета (например, `androidx.compose.material.icons.filled.AutoAwesome`).
*   Следите за импортами, чтобы не было конфликтов (например, `feature.profile.ProfileAvatarPlaceholder` при совпадении имен).