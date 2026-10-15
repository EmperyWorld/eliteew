# Переход фона рабочего стола (обои / тема)

Дата: 2026-04-20 (обновлено: **2026-07-28** — без `background-position` в transition)

## Где в коде

- CSS-переход для `background` / `backgroundImage` на `#desktop-main` задаётся в [`useDesktopWorkspaceMainSurfaceEffects`](../../../shared/web/frontend/src/pages/Desktop/hooks/useDesktopWorkspaceMainSurfaceEffects.ts) через **`DESKTOP_WORKSPACE_MOTION.backgroundCrossfadeSec`** в [`desktopVisualSystem.tsx`](../../../shared/web/frontend/src/pages/Desktop/utils/desktopVisualSystem.tsx).
- Pointer parallax (`useDesktopWallpaperParallax`) пишет **`background-position`** (и CSS vars) отдельно — **не** включать `background-position` в `transition` кроссфейда, иначе idle pointer / parallax даёт CSS ease shimmer (инцидент 2026-07-28).

## Инварианты

- Эффект должен оставаться привязанным к **`storageLoading`**, чтобы после снятия loading shell повторно применить фон (см. [`DESKTOP-WORKSPACE-SHELL-INCIDENTS.md`](DESKTOP-WORKSPACE-SHELL-INCIDENTS.md)).
- Transition property list: **`background`**, **`background-image`** only — без `background-position` / shorthand, который анимирует position.
- Не добавлять второй полноэкранный слой с постоянным **backdrop-filter** ради кроссфейда без замера перфа ([`DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md`](DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md)).

## Настройка длительности

Менять только **`backgroundCrossfadeSec`** (и при необходимости easing в том же `useLayoutEffect`), затем ручной смоук смены обоей и F5.
