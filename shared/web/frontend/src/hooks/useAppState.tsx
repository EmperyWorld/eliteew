/**
 * Глобальное состояние shell-приложения: реализация в `AppStateProvider` (`contexts/AppStateContext.tsx`),
 * типы и reducer — `src/appState/`.
 */
export { useAppState } from '../contexts/AppStateContext';
export type {
	AppSettings,
	AppState,
	AppTheme,
	NavigationHistory,
	NotificationItem,
	PageType,
	ShellPageType,
} from '../appState/types';
export {
	APP_THEME_PRESET_DARK,
	APP_THEME_PRESET_LIGHT,
} from '../appState/initialState';
