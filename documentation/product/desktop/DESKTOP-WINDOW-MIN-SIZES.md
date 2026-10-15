# Минимальные размеры окон рабочего стола

Дата: 2026-06-30 (обновлено; первоначально 2026-04-20)

## Источник правды в коде

Единый реестр: **`shared/web/frontend/src/pages/Desktop/utils/desktopWindowMinSizeRegistry.ts`**

| Экспорт | Назначение |
|---------|------------|
| `DESKTOP_APP_WINDOW_MIN_SIZES` | Явная карта `appComponent` → `{ minWidth, minHeight }` для first-party приложений |
| `DESKTOP_WINDOW_MIN_SIZE_TIERS` | Именованные пресеты (compact, feed, doc, workspace, …) — переиспользовать при добавлении приложения |
| `DESKTOP_WINDOW_MIN_SIZE_DEFAULTS` | Fallback: папка `520×360`, неизвестное приложение `600×420` |
| `getDesktopWindowMinSize(win)` | Полный расчёт по `WindowState` (папка, GAF по title alias, реестр, fallback) |
| `getDesktopWindowMinSizeForAppComponent(id)` | Только по `appComponent` (App Store, подсказки) |
| `isGafDesktopWindow(win)` | GAF Chat без `appComponent`, но с локализованным заголовком |

Потребители: **`EnhancedWindow.tsx`** (react-rnd clamp + **min-size hint banner** при достижении лимита resize, plan UI 02/20 R04), **`useWindowManager.ts`** (restore / work-area), **`AppStoreCard.tsx`** (карточка «мин. размер окна»), пресеты раскладки в **`DesktopWorkspaceContent.tsx`**.

**UX hint (2026-06-30, plan 02/20 R04):** при `onResize` react-rnd, когда ширина/высота упираются в `getDesktopWindowMinSize`, shell показывает однострочный баннер `desktopUi.windowChrome.minSizeHint` (дружелюбный текст с px, без internal id). Copy helper: **`desktopWindowChromeCopy.ts`** → `buildDesktopWindowMinSizeHint`.

## Правила

1. **Не дублировать числа** в компонентах приложений — добавить или изменить запись в `DESKTOP_APP_WINDOW_MIN_SIZES`.
2. Новое тяжёлое приложение: выбрать tier из `DESKTOP_WINDOW_MIN_SIZE_TIERS` или задать явный размер, если tier не подходит.
3. **GAF Chat:** `appComponent === 'GAFChatApp'` или заголовок из `GAF_DESKTOP_TITLE_ALIASES` → tier `chat` (`840×560`).
4. **Неизвестный `appComponent`:** `DESKTOP_WINDOW_MIN_SIZE_DEFAULTS.app` (`600×420`) — обратная совместимость для каталога и сторонних окон.
**P4 / L6 clamp (2026-08-05):** `EnhancedWindow` must **import** `readDesktopWorkArea` from `desktopSnapGeometry` when clamping position after minimize/restore — a bare call without import crashes the shell (`ReferenceError: readDesktopWorkArea is not defined`). Lock: `EnhancedWindow.workArea.import.contract.test.ts`.

## Tier-ы (пресеты)

| Tier | minWidth × minHeight | Типичное использование |
|------|----------------------|-------------------------|
| compact | 560 × 440 | Уведомления, виджет-полка, избранное дашборда, плеер, буфер |
| feed | 720 × 520 | App Store, EWDesk, настройки shell |
| doc | 720 × 480 | Файловый менеджер, Doc Editor v1 |
| social | 760 × 560 | Связи, Feedback Hub |
| studio | 760 × 560 | Студия ГУ, музыкальные студии |
| chat | 840 × 560 | GAF Chat, Ассистент |
| video | 860 × 560 | Видеозвонок |
| editor | 880 × 560 | Doc Editor V2, студии изображения/видео |
| presentation | 960 × 520 | EWRP, презентации, «О проекте» |
| workspace | 980 × 680 | Кабинеты, EWA, UGS, админка, сайты |
| iframe | 800 × 560 | Local Service iframe |

## First-party `appComponent` (реестр)

Все ключи из `DESKTOP_APP_WINDOW_MIN_SIZES` покрывают приложения из `desktopWindowAppContent.tsx` и `DEFAULT_APPS`. Legacy: `FriendsApp`, `UserProfile` → tier `social`.

## Проверка

```bash
cd shared/web/frontend
pnpm exec biome check --write src/pages/Desktop/utils/desktopWindowMinSizeRegistry.ts
pnpm exec vitest run src/pages/Desktop/utils/__tests__/desktopWindowMinSizeRegistry.test.ts
```

## Связанные документы

- `documentation/product/desktop/DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md` — window runtime / guardrails
- `.cursor/rules/desktop-shell-and-windows.mdc` — слой окон и EnhancedWindow
