# MobileAndroid — scale & chrome policy (COMPACT / STANDARD / COMFORT)

**Тип:** Reference + How-to (Diátaxis)  
**Статус:** Канон  
**Дата:** 2026-06-14  
**Версия волны:** **0.2.97 (107)**  
**OTA SHA-256:** `53d78b5a9b928c8df6e01954942070407bc7a7898f57b8af79eb041185c02ece`

**Связанные документы:**

| Документ | Роль |
|----------|------|
| [MOBILE-ANDROID-GUIDELINES.md](MOBILE-ANDROID-GUIDELINES.md) | Обязательные UI/MVVM правила |
| `pack-cloud/mobile/core/ui/src/main/java/world/empery/mobile/core/ui/PremiumGlass.kt` | Glass/Premium primitives (living source) |
| [MOBILE-ANDROID-ADAPTIVE-LAYOUT.md](MOBILE-ANDROID-ADAPTIVE-LAYOUT.md) | Width class / foldable layout |
| [MOBILE-ANDROID-RELEASE-RUNBOOK.md](MOBILE-ANDROID-RELEASE-RUNBOOK.md) | OTA publish + prod-core |

---

## 1. Проблема и цель

До волны **0.2.97** экраны реагировали на масштаб UI и системный шрифт **разрозненно**: ad-hoc `fontScale >= 1.08f`, тяжёлые `PremiumHeroHeader` на EWDesk и Desktop Hub, дублирующие refresh-кнопки, раздувающиеся строки чатов при COMFORT.

**Цель:** единый контракт chrome для всех основных табов — контент на первом экране, без горизонтального overflow, touch targets ≥ 48dp физически даже на **COMPACT** density.

**Scope:** только `pack-cloud/mobile/` (UI). Backend/API не менялся.

---

## 2. Три оси масштабирования

| Ось | Источник | Влияние |
|-----|----------|---------|
| **UI preset** | Profile → Оформление → Масштаб (`MobileUiScale`: COMPACT / STANDARD / COMFORT) | `layoutDensityFactor`, icon-only на STANDARD/COMFORT |
| **System font** | Android Accessibility → Font size | `LocalDensity.current.fontScale` |
| **Width class** | `LocalMobileWindowLayout` | Колонки, master-detail, grid columns |

**Правило для агентов:** для заголовков, subtitle, кнопок и preview-текста использовать **`MobileScaleChromePolicy`**, а не сырые проверки `fontScale` в feature-модулях.

---

## 3. `MobileScaleChromePolicy` (канонический API)

**Файл:** `pack-cloud/mobile/core/ui/src/main/java/world/empery/mobile/core/ui/MobileScaleChromePolicy.kt`  
**Тесты:** `MobileScaleChromePolicyTest.kt`

### 3.1 Порог stacking

```kotlin
const val MOBILE_STACK_CHROME_FONT_SCALE_THRESHOLD = 1.08f
```

`compositeFontScale = uiScale.compositeFontScale(systemFontScale)` — учитывает preset **и** системный шрифт.

### 3.2 Поля политики

| Свойство | Когда true / значение | UX-эффект |
|----------|----------------------|-----------|
| `shouldStackChromeActions` | `compositeFontScale >= 1.08` | Горизонтальные action-ряды → Column; скрыть вторичный subtitle в header |
| `useIconOnlyActions` | COMFORT/STANDARD icon mode **или** large font | `ScaledOutlinedButton` / FAB без текста; `contentDescription` обязателен |
| `showSecondarySubtitle` | COMPACT **и** font &lt; порога | Редкий случай «показать больше» только на плотном preset |
| `maxHeroTitleLines` | 1 при stacking, иначе 2 | Ellipsis на title |
| `maxHeroSubtitleLines` | 0 при stacking; 1 на COMFORT; иначе 2 | Subtitle в hero/section |
| `maxBodyPreviewLines` | 2 / 3 / 4 | Preview постов EWDesk, message body в notifications |
| `maxCardTitleLines` | 2 при stacking, иначе 3 | Заголовки карточек ленты, profile rows |
| `maxCaptionLines` | 1 / 2 | UGS tool cells, metric captions |
| `maxDescriptionLines` | 2 / 3 | Desktop Hub store rows, hub descriptions |
| `maxNotificationMessageLines` | 3 / 4 | Тело строки Notification Center |
| `maxThreadPreviewLines` | 2 / 3 | AI chat list / thread previews |
| `maxMetadataLines` | 1 / 2 | Tags, source labels под title |
| `showInlineRowQuickActions` | inverse of stacking | Pin/mute, video-in-bar, metric pills |
| `bodyPreviewCharBudget` | 280 / 360 / 480 | Collapsed EWDesk plain-text preview (`MOBILE_BODY_PREVIEW_CHARS_*`) |
| `useWrappedFilterChips` | stacking или COMFORT | `FlowRow` вместо `LazyRow` для фильтров |
| `minimumTouchTargetDp` | 48–64 dp compose-space | Компенсация COMPACT `layoutDensityFactor` |
| `heroTrailingMaxWidthDp` | 96 / 112 / 160 dp | Trailing actions в `PremiumHeroHeader` |

### 3.3 Composable helpers

```kotlin
val chrome = rememberMobileScaleChromePolicy()
if (chrome.shouldStackChromeActions) { /* stack */ }
if (usesScaleAwareIconControls()) { /* icon-only FAB */ }
```

Также: `shouldStackChromeActions()`, `usesScaleAwareIconControls()`, `usesIconControls()` в `ScaledActionButtons.kt`.

### 3.4 Layout helpers (`MobileScaleChromeLayout.kt`)

Composable-слоты для feature-треков — **не** дублировать `if (chrome.shouldStackChromeActions)`:

| Helper | Назначение |
|--------|------------|
| `MobileScaleChromeStackOrRow` | Один слот контента: `Column` при stacking, иначе `Row` |
| `MobileScaleChromeInlineOnly` | Рендер только когда `showInlineRowQuickActions` (quick actions, metric pills) |
| `MobileScaleChromeStackedOnly` | Рендер только в stacked-режиме (search + full-width button) |
| `MobileScaleChromeInlineRow` | `Row` только когда не stacking |
| `MobileAdaptiveChromeContent` | `MobileAdaptiveContent` + stacked column wrapper |

**Тесты:** `MobileScaleChromeLayoutPolicyBridgeTest.kt` (policy flags); composable wiring — в feature smoke.

### 3.5 Scale-aware FAB (`ScaledActionButtons.kt`)

```kotlin
ScaledFloatingActionButton(
    onClick = { … },
    label = stringResource(R.string.…),
    icon = Icons.Filled.Add,
)
```

`FloatingActionButton` (icon-only + `contentDescription = label`) при `usesIconControls()`; иначе `ExtendedFloatingActionButton`.

### 3.6 A11y bridge (`MobileA11ySupport.kt`)

Non-compose проверки без дублирования порога:

```kotlin
shouldStackMobileChrome(uiScale, systemFontScale)
exceedsMobileChromeStackThreshold(compositeFontScale)
```

### 3.7 Touch targets

**Файл:** `MobileTouchTarget.kt`

- `mobileMinimumTouchTarget()` — `Modifier` extension с `minimumTouchTargetDp` из политики.
- `MobileIconButton` — обёртка над `IconButton` с semantics + min size.

**Invariant:** на COMPACT density 0.75× физический hit area не должен падать ниже ~48dp.

---

## 4. Изменения по экранам (0.2.97)

### 4.1 EWDesk (`FeedFeature.kt`)

| Было | Стало |
|------|-------|
| `PremiumHeroHeader` + refresh в шапке | Убрано полностью |
| Только pull-to-refresh shell + auto-refresh VM | Сохранено |
| Top area | Иконка уведомлений (top-right) + topic filters |
| Post cards | Scale-aware title stack, короче preview, `MobileIconButton` share |
| Filter empty | Отдельный empty state при фильтре без совпадений |

### 4.2 Desktop Hub (`DesktopHubFeature.kt`)

| Было | Стало |
|------|-------|
| `TopAppBar` + `PremiumHeroHeader` | Один compact `TopAppBar` (back + title + icon refresh/theme) |
| Store rows | `ScaledOutlinedButton` **Открыть**; `DesktopStoreSecondaryAction` для uninstall/badge |
| Large scale | Stats/actions stack; description `maxLines` уменьшен |
| Deeplink section scroll | Индексы `DesktopHubLazyColumnIndices` учитывают embedded SPA cards (handoff=10, store=17) |
| Theme/quiet | RU labels; config PATCH cycle + shell quiet-mode PATCH; quick-jump chips на Medium+ width |

### 4.3 Chat (`ChatFeature.kt`)

- List row: pin/mute/archive quick actions **скрыты** при `shouldStackChromeActions`.
- Active chat bar: video call buttons уходят в overflow menu при stacking.
- Composer: attachment row stacks; `mobileMinimumTouchTarget()` на icon buttons.
- Elite System: визуальное отличие без увеличения высоты строки.

### 4.4 UGS / AI (`UgsAiUi.kt`, `UgsHubFeature.kt`, chat screens)

- `UgsAiSubScreenTopBar`: subtitle по `maxHeroSubtitleLines`; refresh → `MobileIconButton`.
- `UgsAiHubHero`, tool cells: меньше caption lines при stacking.
- AI chat list: `ExtendedFloatingActionButton` → `FloatingActionButton` (icon-only) при large scale.
- Retry/error: `ScaledOutlinedButton` вместо raw `Button`.
- **UGS Songs (`UgsSongsScreen.kt`, `UgsSongsUi.kt`):** language/vocal chips → `FlowRow` при `useWrappedFilterChips`; genre остаётся `LazyRow`; form spacing + `PremiumLoadingCard` при MusicForge create+poll; API на `Dispatchers.IO`.

### 4.5 Friends (`FriendsScreenChrome.kt`)

- Subtitle hero скрыт при stacking.
- Metric pills скрыты при stacking (счётчики уже в subtitle когда он виден).
- Search + Add: вертикальный stack при stacking.

### 4.6 Profile (`ProfileFeature.kt`, `ProfileCategoryAccordion.kt`, `ProfileAppearanceChoices.kt`)

- Settings section hint скрыт при stacking.
- Hero: email скрыт при stacking; display name 1 line.
- Category accordion: subtitle категории скрыт при stacking.
- **Оформление → Масштаб:** premium choice tiles (`ProfileUiScalePicker`) вместо FilterChip; описание выбранного preset.
- **Обновления:** checking banner + urgency/release notes выше статусных pills.
- **Безопасность → периметр:** user copy без Keycloak/SSO/API jargon.

### 4.7 Notifications (`NotificationFeature.kt`)

- Header title/subtitle с ellipsis; unread subtitle скрыт при stacking.
- Refresh → `MobileIconButton`; mark-all-read → `ScaledOutlinedButton`.
- Row title/message: `maxLines` + ellipsis по политике.

### 4.8 Shared primitives (`PremiumGlass.kt`)

- `PremiumHeroHeader` — title/subtitle/trailing width из политики.
- `PremiumSectionCard` — `maxHeroTitleLines` / `maxHeroSubtitleLines` на section headers.

### 4.9 Media player (`core/media`)

| Было | Стало |
|------|-------|
| Фиксированные размеры dock/expanded chrome | `EmperyPlayerChromeScale.kt` → `resolveEmperyPlayerChromeMetrics` поверх `MobileScaleChromePolicy` |
| Dock swipe hint всегда | Скрыт при `shouldStackChromeActions` (крупный системный шрифт / COMFORT+stack) |
| Subtitle в dock всегда | Скрыт при stacking; title ellipsis по `maxHeroTitleLines` |
| Tool chips с текстом на COMFORT | Icon-only + `contentDescription` при `useIconOnlyActions` |
| Touch targets 44–48 dp фикс | `mobileMinimumTouchTarget()` на transport/favorite; COMPACT density compensation |

**Desktop parity (контракт, не shared code):** shared chrome tokens и now-playing UX на web — [DESKTOP-MUSIC-PLAYER.md](../desktop/DESKTOP-MUSIC-PLAYER.md) (dated audio+music UI full-summary → `trash/`); mobile favorites/queue sync — `MusicPlayerFavoritesRepository` + `shell_state.music_playlists`.

**Тесты:** `./gradlew :core:media:testDebugUnitTest` (`EmperyPlayerChromeScaleTest`).

---

## 5. UI contract (acceptance)

Проверять комбинации:

| UI preset | System font |
|-----------|-------------|
| COMPACT | 1.0 |
| STANDARD | 1.0 |
| COMFORT | 1.0 |
| STANDARD | Largest |
| COMFORT | Largest |

**Критерии на каждом главном экране:**

1. Первый viewport — полезный контент, не только шапка.
2. Нет horizontal overflow.
3. Кнопки не растягивают header.
4. Touch targets удобны на COMPACT.
5. Длинный текст → ellipsis, не layout break.
6. Icon-only actions имеют `contentDescription`.
7. Pull-to-refresh и error retry доступны (EWDesk без header refresh — только PTR + error state).

---

## 6. Верификация (автоматическая)

```bash
cd pack-cloud/mobile
./gradlew :core:ui:testDebugUnitTest \
  :core:media:testDebugUnitTest \
  :feature:feed:testDebugUnitTest \
  :feature:chat:testDebugUnitTest \
  :feature:desktop:testDebugUnitTest \
  :feature:ugs:testDebugUnitTest \
  :feature:friends:testDebugUnitTest \
  :feature:profile:testDebugUnitTest \
  :feature:notifications:testDebugUnitTest \
  :app:assembleProdRelease
```

**Release + prod-core OTA (2026-06-14):**

```bash
bash docker/scripts/mobile-apk-release-cycle.sh --yes --skip-lint --build --publish --prod-core --smoke
```

---

## 7. Ручной smoke (оператор)

1. Profile → **Обновления** — предлагает **0.2.97 (107)**.
2. System font **Largest** + Profile → Оформление → **COMFORT**.
3. **EWDesk:** посты сразу под фильтрами; pull-to-refresh; bell top-right.
4. **Desktop Hub:** один top bar; **Открыть** открывает store app.
5. **Chat:** строки не раздуваются; Elite System нормальной высоты.
6. **UGS / AI chat:** компактный top bar; FAB «+» icon-only на large scale.
7. **Friends / Profile / Notifications:** нет «простыни» из subtitle/metrics.
8. **Media player:** dock без overflow на Largest+COMFORT; expanded tool chips icon-only; swipe-hint скрыт при stacking.

Шаблон: [MOBILE-ANDROID-DEVICE-SMOKE-TEMPLATE.md](MOBILE-ANDROID-DEVICE-SMOKE-TEMPLATE.md).

---

## 8. Правила для новых экранов

1. **Не** добавлять `PremiumHeroHeader` на табы с собственным bottom nav label — только если hero даёт уникальное действие.
2. **Не** дублировать refresh: shell PTR + error retry достаточно (исключения: Notification Center, nested sub-screens с явным refresh в top bar).
3. Импортировать `rememberMobileScaleChromePolicy()` вместо `fontScale >= 1.08f`.
4. Длинные кнопки в header → `ScaledOutlinedButton` или `MobileIconButton`.
5. Section headers → `PremiumSectionCard` (уже scale-aware) или `MobileCompactSectionHeader`.
6. Новое поведение политики → unit test в `MobileScaleChromePolicyTest` (или bridge test для layout flags).
7. Layout stack/inline → `MobileScaleChromeLayout.kt`; FAB → `ScaledFloatingActionButton`; ad-hoc `maxLines if (shouldStack)` → поля §3.2.

---

## 9. File map (основные пути)

| Путь | Роль |
|------|------|
| `core/ui/MobileScaleChromePolicy.kt` | Политика + composable helpers |
| `core/ui/MobileScaleChromePolicyTest.kt` | Unit tests политики |
| `core/ui/MobileScaleChromeLayout.kt` | Stack/inline layout slots |
| `core/ui/MobileScaleChromeLayoutPolicyBridgeTest.kt` | Policy bridge tests |
| `core/ui/MobileA11ySupport.kt` | Composite font scale + chrome threshold bridge |
| `core/ui/MobileTouchTarget.kt` | Min touch target |
| `core/ui/ScaledActionButtons.kt` | Scale-aware buttons + `ScaledFloatingActionButton` |
| `core/ui/PremiumGlass.kt` | Hero/section cards |
| `core/ui/MobileCompactSectionHeader.kt` | Lightweight section title |
| `feature/feed/FeedFeature.kt` | EWDesk |
| `feature/desktop/DesktopHubFeature.kt` | Desktop Hub |
| `feature/chat/ChatFeature.kt` | GAF Chat (Мессенджер) |
| `feature/ugs/UgsAiUi.kt` | UGS shared chrome |
| `feature/ugs/UgsHubFeature.kt` | UGS Hub |
| `feature/ugs/UgsAiChatListScreen.kt` | AI chat list |
| `feature/ugs/UgsAiChatDetailScreen.kt` | AI chat thread |
| `feature/friends/FriendsScreenChrome.kt` | Friends hero |
| `feature/profile/ProfileFeature.kt` | Profile screen |
| `feature/profile/ProfileCategoryAccordion.kt` | Settings categories |
| `feature/notifications/NotificationFeature.kt` | Notification Center |
| `core/media/EmperyPlayerChromeScale.kt` | Media player scale metrics |
| `core/media/EmperyPlayerChrome.kt` | Shared player chrome (progress, chips, primary play) |
| `core/media/EmperyMediaPlayerUi.kt` | Now-playing dock + mini controls |

---

## 10. История версий (scale wave)

| versionName | versionCode | Тема |
|-------------|-------------|------|
| 0.2.96 | 106 | Avatar URL fix, desktop open, AI header (precursor) |
| **0.2.97** | **107** | **Full scale/chrome polish across main tabs** |

Предыдущая glass wave (0.2.74–0.2.78) soft-retired; living tokens — `PremiumGlass.kt` + this policy.
