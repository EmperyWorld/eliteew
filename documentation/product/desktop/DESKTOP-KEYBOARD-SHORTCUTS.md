# Desktop keyboard shortcuts

Reference for EliteEW Desktop (useKeyboardShortcuts). Win = Meta (Windows/Cmd).

## Window management

| Shortcut | Action |
|----------|--------|
| Win + Arrow Left/Right/Up/Down | Snap window left/right/maximize/bottom |
| Win + Arrow Left/Right (Command Palette) | **Split left / split right** — same geometry as drag snap (`snap_window_left` / `snap_window_right` palette actions) |
| Win + Arrow Down (Command Palette) | **Restore** active window from maximized (`restore_active_window`) |
| Win + Shift + Arrow | Move active window within the desktop workspace |
| Alt + Tab | Task Switcher (or cycle app) |
| Alt + Shift + Tab | Cycle app previous |
| Alt + F4 | Close active window |
| Alt + Space | Window menu |
| Alt + Escape | Close active window |

## Desktop and apps

| Shortcut | Action |
|----------|--------|
| Win + D | Show desktop (minimize all) |
| Win + E | Open Explorer |
| Win + S | Quick Search |
| Win + F | Quick Search / desktop search focus |
| Win + R | Open Run |
| Win + I | Open Desktop Settings |
| Win + U | Open Social Hub on the profile tab |
| Win + K | Command palette |
| Ctrl + K | Command palette (⌘K on macOS) |
| Win + 1..9 | Open app at pinned position 1–9 |
| Win + Tab | Cycle to next app window |
| Win + V | Clipboard history |

## Widgets and UI

| Shortcut | Action |
|----------|--------|
| Win + W | Toggle widgets panel |
| Win + N | Toggle notifications |
| Win + Shift + N | New folder |
| Ctrl + Shift + N | New folder |
| Win + Alt + S | Screenshot |
| Win + Shift + S | Screenshot region |

## Virtual desktops

| Shortcut | Action |
|----------|--------|
| Win + Ctrl + Tab | Next desktop |
| Win + Ctrl + D | Create desktop |
| Win + Ctrl + Arrow Left/Right | Previous/next desktop |

## System

| Shortcut | Action |
|----------|--------|
| Ctrl + Alt + Delete | Task Manager |
| Ctrl + Alt + L | Lock desktop |
| F1 | Help |
| F5 | Refresh |
| F11 | Toggle fullscreen |

## Media (when available)

| Shortcut | Action |
|----------|--------|
| AudioVolumeUp/Down/Mute | Volume |
| BrightnessUp/Down | Brightness |

## Implementation

- Handlers are defined in `web/frontend/src/pages/Desktop/hooks/useKeyboardShortcuts.ts`.
- Wired in `DesktopWorkspaceContent.tsx` (desktop settings, Social Hub profile tab priming, pinned app quick access, Quick Search, clipboard).
- **Command palette (2026-06-30, plan UI 02/20 R12):** `CommandPalette.tsx` exposes *Split left*, *Split right*, *Maximize window*, *Restore window* with OS-correct shortcut badges via `getCommandPaletteShortcutLabel` / `desktopUi.shortcuts.windows.*`.
- Human-readable help modal and command palette kbd badges read the same `shortcuts.*.keys` i18n registry (`getCommandPaletteShortcutLabel`, `formatShortcutKeysForPlatform`).
