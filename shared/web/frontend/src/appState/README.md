# `appState`

- **`types.ts`** — `AppState`, `AppAction`, `PageType`, `ShellPageType`, прочие публичные типы.
- **`initialState.ts`** — начальное состояние, `APP_THEME_PRESET_*` для desktop chrome.
- **`reducer.ts`** — корневой `appReducer`, делегирует в слайсы где уместно.
- **`slices/navigationSlice.ts`** — `SET_CURRENT_PAGE`, `ADD_NAVIGATION_HISTORY`.
- **`slices/notificationsSlice.ts`** — уведомления и `SET_ERROR`.
- **`slices/sessionSlice.ts`** — `SET_USER`, `SET_LOADING`, `SET_AUTHENTICATED`.
- **`slices/settingsSlice.ts`** — `UPDATE_SETTINGS`, `UPDATE_THEME`.
- **`slices/telemetrySlice.ts`** — `UPDATE_PERFORMANCE`, `UPDATE_WEBSOCKET`.
- **`slices/uiSlice.ts`** — sidebar и модалки (`TOGGLE_SIDEBAR`, `SET_SIDEBAR_COMPACT`, `TOGGLE_MODAL`).
- **`slices/errorBoundarySlice.ts`** — `SET_ERROR_BOUNDARY`.
- **`slices/resetSlice.ts`** — `RESET_STATE` (сохранение settings/theme).

Провайдер: `src/contexts/AppStateContext.tsx`.
