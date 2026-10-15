# Раскладки окон рабочего стола: кураторские шаблоны и сценарные пресеты

Канон кода (фронт): `shell_state.window_layout_presets`, `useDesktopExpansionSettings.ts`, геометрия snap в `desktopSnapGeometry.ts`, визуальный слой при перетаскивании — `SnapPreview.tsx`.

## Две связанные возможности

1. **Быстрая раскладка без сохранения** — кнопки «две колонки / три колонки / четыре четверти» применяют зоны snap к открытым окнам текущего виртуального стола (по z-index). Константы зон: `desktopCuratedWorkspaceLayoutTemplates.ts`; вызов: `applyCuratedWorkspaceLayout` / `onApplyCuratedWorkspaceLayout`.

2. **Именованный пресет в профиле** — те же зоны + привязка к текущим окнам сохраняются в `window_layout_presets` (`addWindowLayoutPreset`, `addWindowLayoutPresetFromCuratedTemplate`). Пользователь видит список в настройках и может применить или удалить пресет.

## Сценарные подписи (волна 3)

Те же три геометрии можно применять и сохранять под **человекочитаемыми именами** («редактор и чат», «студия и результат», обзор 2×2), без отдельного набора приложений: окна всегда из **текущих открытых** на столе.

| Сценарий (`DesktopScenarioWindowLayoutId`) | Геометрия (как у быстрых кнопок) | Код |
|-------------------------------------------|-----------------------------------|-----|
| `editorChat` | Две вертикальные половины (`halfHorizontal`) | `desktopScenarioWindowLayouts.ts` → `applyScenarioWorkspaceLayout` / `addWindowLayoutPresetFromScenario` |
| `studioResult` | Три вертикальные трети (`thirdsHorizontal`) | то же |
| `reviewQuarter` | Сетка 2×2 (`gridQuarters`) | то же |

i18n: `desktopUi.settingsPanel.expansionLayoutScenarioHint` и `settingsPanel.expansionLayoutScenario.<id>.*` в `ru` / `en` `desktopUi.json`.

## Доступность при snap

`SnapPreview` объявляет активную зону скринридеру через скрытый `aria-live` регион с **debounce ~180 ms**, чтобы дрожание курсора у границ зон не засыпало лентой объявлений. Декоративный оверлей помечен `aria-hidden`; подробнее — [`DESKTOP-SHELL-A11Y-CHECKLIST.md`](DESKTOP-SHELL-A11Y-CHECKLIST.md).

## Связанные документы

- [`DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md`](DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md) — §4 окна и пресеты.
- [`DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md`](DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md) — режим low-GPU и превью snap.
