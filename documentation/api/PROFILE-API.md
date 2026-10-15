# Profile API

Канон HTTP-контракта профиля пользователя EliteEW: предпочтения UI, accessibility, desktop shell motion и связь с фронтом. Hub: [`README.md`](README.md).

**Код:** `shared/api/routers/user_profile.py` (canonical `/api/v1/profile`), схемы `shared/api/schemas/user_profile.py`  
**Фронт:** `shared/web/frontend/src/types/profile.ts`, `UserPreferencesApp`, `useDesktopWorkspaceVisualProfileBridge`

**Auth:** routes under `/api/v1/profile/*` require Keycloak SSO; API JWT audience **`empery-api`** ([`KEYCLOAK-ELITEEW.md`](../platform/docker-re_doc/KEYCLOAK-ELITEEW.md)).

**OpenAPI:** pilot-спеки (`desktop.openapi.json` и др.) **не** экспортируют полный `UIPreferences`. Источник истины — Pydantic-схема + TS-типы ниже. При расширении enum (например `desktop_icon_style`) деплой API должен опережать фронт, иначе `PATCH` вернёт **422**.

**Миграции / env:** поля desktop shell motion и Visual Studio живут в JSON `preferences.ui` существующей таблицы пользователя. **Отдельных SQL-миграций и env-ключей нет.**

---

## Endpoints

| Method | Path | Назначение |
|--------|------|------------|
| `GET` | `/api/v1/profile/preferences` | Полный снимок `UserPreferences` |
| `PATCH` | `/api/v1/profile/preferences` | Частичное обновление (merge по секциям) |

Заголовки ответа: **`Cache-Control: no-store`**, **`Pragma: no-cache`**. После успешного `PATCH` фронт обновляет React-контекст телом ответа (`refresh(nextFromServer)`), без лишнего GET.

---

## `UIPreferences` — desktop-relevant fields

Тип на фронте: `UIPreferences` в `src/types/profile.ts`. Валидатор на бэке: `UIPreferences` в `user_profile.py`.

### Visual Studio (типографика, сцена, tooltips)

| Поле | Тип | Default | Назначение |
|------|-----|---------|------------|
| `desktop_font_body` | `manrope` \| `poppins` \| `raleway` \| `montserrat` | `manrope` | Основной шрифт UI (`@fontsource`) |
| `desktop_font_display` | `system` \| `cinzel` \| `playfair` \| `cormorant` \| `raleway` | `system` | Акцентный шрифт заголовков; `system` = как body |
| `desktop_scene_depth` | `soft` \| `balanced` \| `immersive` | `balanced` | Виньетка `#desktop-main`, immersive-hover иконок, база для parallax |
| `desktop_wallpaper_crossfade_enabled` | `bool` | `true` | Crossfade смены обоев (~0.5 s) |
| `desktop_styled_tooltips` | `bool` | `true` | `TooltipV2` на chrome; `false` → нативные `title`. В CSS Grid — **`DesktopChromeTooltip fullWidth`** (см. **`WallpaperPicker`**) |

### Shell motion (2026-06-21)

| Поле | Тип | Default | Назначение |
|------|-----|---------|------------|
| `desktop_shell_reduce_motion` | `bool` | `false` | Минимальные анимации shell независимо от ОС |
| `desktop_shell_parallax_enabled` | `bool` | `true` | Pointer parallax обоев на `#desktop-main` |
| `desktop_shell_parallax_intensity` | `subtle` \| `normal` \| `strong` | `normal` | Масштаб смещения (0.65 / 1 / 1.4) |
| `desktop_shell_window_morph_enabled` | `bool` | `true` | Shared `layoutId` minimize ↔ taskbar chip |
| `desktop_shell_motion_speed` | `slow` \| `normal` \| `fast` | `normal` | Множитель длительности spring/transition |

**Effective reduce motion** (фронт, не отдельное поле API): `true`, если любое из:

- OS `prefers-reduced-motion: reduce`
- `accessibility.reduce_motion === true`
- `animations_enabled === false`
- `desktop_shell_reduce_motion === true`

При effective reduce motion **parallax и morph принудительно off** (`resolveDesktopShellMotion.ts` → `DesktopShellMotionPrefsContext`).

### Chrome presets (см. также `DESKTOP-WINDOW-SHELL-STYLE.md`)

| Поле | Назначение |
|------|------------|
| `desktop_window_style` | Пресет рамки/фона окон |
| `desktop_taskbar_style` | Пресет панели задач (те же ключи, что окна) |
| `desktop_widgets_style` | Пресет плавающего виджета |
| `desktop_icon_style` | Пресет иконок (+ `prism` / `mercury` / `vhs`) |
| `desktop_panel_opacity` | Плотность подложки taskbar (0.35–1) |
| `desktop_ui_scale` | Масштаб UI shell |
| `desktop_reduce_backdrop_blur` | Снижение blur на `#desktop-main` (perf) |
| `desktop_open_apps_maximized` | Новые окна сразу maximized |
| `desktop_floating_widget_visible` | Видимость плавающего виджета |

### Глобальные UI flags

| Поле | Влияние на desktop |
|------|-------------------|
| `animations_enabled` | `false` → effective reduce motion для shell |
| `compact_mode`, `sidebar_collapsed`, `default_view` | Вне Settings Center стола; упоминать со ссылкой на общие настройки аккаунта |
| `desktop_gaf_chat_sidebar_collapsed` | GAF Chat: свёрнутый сайдбар (аватарки) vs развёрнутый список; default `true` |

---

## PATCH semantics

- Тело: `{ "ui": { ...partial fields } }` и/или другие секции `UserPreferences`.
- Неизвестные ключи отсекаются валидатором; enum нормализуется (legacy `clear`/`solid` taskbar → `glass`/`framed` и т.д.).
- Debounce на фронте: `desktop_panel_opacity` ~450 ms; остальные Visual Studio / motion toggles — optimistic UI + немедленный PATCH (или batched через preferences context).

---

## Related docs

- Settings Center UX: `documentation/product/desktop/DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md` §1.4, §1.7
- Window/taskbar presets: `documentation/product/DESKTOP-WINDOW-SHELL-STYLE.md`
- Performance + motion deep-link: `documentation/product/desktop/DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md`
- A11y checklist: `documentation/product/desktop/DESKTOP-SHELL-A11Y-CHECKLIST.md`
