# MobileAndroid: adaptive layout

Канон адаптивной оболочки Android-клиента (ширина экрана, навигация, multi-column, ultra-wide).

## Два разных «масштаба» (не путать)

| Что | Смысл | Где |
|-----|--------|-----|
| **Размер окна приложения** | Activity занимает доступный экран (DeX, планшет, fold unfolded) | `AndroidManifest` (`resizeableActivity`, без portrait-lock на tablet+), `MobileWindowOrientationPolicy` |
| **Структура layout внутри окна** | Больше колонок, rail, master-detail — без density zoom | `LocalMobileWindowLayout`, `MobileAdaptiveColumns`, feature-ветки |
| **A11y масштаб текста/иконок** | Только телефон, prefs в Profile | `MobileUiScale` / `LocalDensity` в `MainActivity`; bottom nav labels скрыты на COMFORT; rail labels только на Large+ expanded rail |

**0.2.50:** окно на tablet/DeX — **full-bleed** (`FULL_USER` + `resizeableActivity`); ultra-wide колонки/rail из **0.2.49** сохранены. Ограничение readable line length — только локально (пузыри чата, thread pane), не фиксированная ширина всего приложения.

## Источник правды

- `pack-cloud/mobile/core/ui/src/main/java/world/empery/mobile/core/ui/MobileWindowWidthClass.kt` — `Compact` (&lt;600dp), `Medium` (600–839), `Expanded` (840–1199), `Large` (1200–1599), `ExtraLarge` (≥1600).
- `pack-cloud/mobile/core/ui/src/main/java/world/empery/mobile/core/ui/MobileLayoutProfile.kt` — `Phone`, `Tablet`, `VrPanel`, `FoldableInner`.
- `pack-cloud/mobile/core/ui/src/main/java/world/empery/mobile/core/ui/LocalMobileWindowLayout.kt` — tiers, column counts, chat pane hints.
- `pack-cloud/mobile/core/ui/src/main/java/world/empery/mobile/core/ui/MobileWindowOrientationPolicy.kt` — portrait только phone; tablet/DeX — `FULL_USER`.
- `pack-cloud/mobile/core/ui/src/main/java/world/empery/mobile/core/ui/MobileAdaptiveLayout.kt` — `MobileAdaptiveColumns`; `MobileAdaptiveContent` — опциональные readable-зоны, не shell cap.
- `pack-cloud/mobile/app/src/main/java/world/empery/mobile/shell/MobileShellContentFrame.kt` — NavHost на **полную ширину** окна; `MobileShellNestedContextScaffold` для nested routes.
- `pack-cloud/mobile/app/src/main/java/world/empery/mobile/shell/MobileShellNavigation.kt` — hybrid nav, expanded rail на Large+.
- `pack-cloud/mobile/app/src/main/java/world/empery/mobile/shell/MobileShellTabErrors.kt` — агрегация tab errors → snackbar в shell.

## Shell navigation guidelines

| Concern | Rule |
|---------|------|
| Hybrid nav | `screenWidthDp >= 600` → `NavigationRail`; phone / Quest / fold narrow → bottom bar (`LocalMobileWindowLayout.useNavigationRail`). |
| Rail labels | Icon-only rail on Medium/Expanded; text labels only when `useExpandedNavigationRail` (Large+) **and** `MobileUiScale.showsBottomNavLabels` (COMFORT hides labels on bottom **and** rail). |
| Context strip | Nested routes (`notifications`, `ugs/*`) wrap content in `MobileShellNestedContextScaffold`; Feed tab stays selected on `notifications`. |
| Tab errors | `resolveFirstShellTabError` picks first non-blank error across feed/notifications/profile/friends/desktop-hub/ugs/chat; `MobileShellTabErrorSnackbarEffect` dedupes snackbars. |
| Deeplinks | Parsing/coercion in `MobileDeepLinks.kt` (T17); shell applies `ShellNavigationIntent` via `MobileBackStackPolicy` only. |
| Content width | Shell never caps NavHost width; readable max-width only inside feature screens (chat bubbles, thread pane). |

## Width tiers и колонки

| Tier | `screenWidthDp` | Feed / grids | Shell |
|------|-----------------|--------------|-------|
| Compact | &lt;600 | 1 col | bottom bar |
| Medium | 600–839 | 2 col | rail |
| Expanded | 840–1199 | 3 col | rail |
| Large | 1200–1599 | 4 col | expanded rail (labels when scale allows) |
| ExtraLarge | ≥1600 | 4 col | expanded rail (labels when scale allows), chat thread max-width |

## Ориентация и окно

| Профиль | Orientation | Окно |
|---------|-------------|------|
| Phone (`sw &lt; 600`) | portrait lock | resizeable |
| Tablet / DeX / fold wide | `FULL_USER` | resizeable, landscape allowed |
| Quest / Horizon 2D panel | `FULL_USER` (no portrait lock — avoids letterbox) | resizeable; widen panel in shell to grow window |

`MainActivity`: `android:resizeableActivity="true"`, `configChanges` включает `screenSize|smallestScreenSize|orientation`.

## Навигация (hybrid)

| Условие | Nav |
|--------|-----|
| `screenWidthDp >= 600` и не Quest panel | `NavigationRail` (icon-only until Large+) |
| Large+ | expanded rail with labels (unless COMFORT UI scale) |
| Телефон, Quest, FoldableInner &lt;600 | `NavigationBar` |

## Feature-ветки

| Экран | Compact | Medium+ | Expanded+ | Large+ |
|-------|---------|---------|-----------|--------|
| Feed | 1 col | 2 col | 3 col | 4 col |
| UGS tools | 2×2 compact grid | 3 col | 3 col | 4 col |

Реализация hub grid: `UgsHubLayoutPolicy.kt` + `UgsAiHubToolsGrid` в `feature/ugs/UgsAiUi.kt` — отдельный min cell (148dp compact), не общий feed cap `effectiveContentColumnCount`.
| Chat | full thread | master-detail (list full width until chat open) | master-detail | proportional list/thread panes; bubble max-width only |
| Profile | 1-col categories | 1-col | 2-col grid | 2-col grid |
| Friends / Notifications | full width | full width | full width | full width |

## Smoke matrix (ручная)

| Device | Width | Expected |
|--------|-------|----------|
| Phone portrait | 411dp | portrait window, bottom bar, feed 1 col |
| Tablet portrait | 600–839 | full-width window, rail, feed 2 col |
| Tablet landscape | 900–1199 | full-width window, rail, feed 2–3 col |
| DeX / monitor | 1600+ | resizable full-screen window, 4 col feed, expanded rail |

Regression: phone 411dp без regression; Quest bottom bar + 2 col.

См. [`MOBILE-ANDROID-DEVICE-SMOKE-TEMPLATE.md`](MOBILE-ANDROID-DEVICE-SMOKE-TEMPLATE.md), [`ANDROID-DEVELOPER-HANDBOOK.md`](ANDROID-DEVELOPER-HANDBOOK.md).
