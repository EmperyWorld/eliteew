import { DARK_THEME, LIGHT_THEME } from '../initialState';
import type { AppAction, AppState } from '../types';

export function applyUpdateSettings(
	state: AppState,
	action: Extract<AppAction, { type: 'UPDATE_SETTINGS' }>
): AppState {
	const updatedSettings = { ...state.settings, ...action.payload };
	const newTheme = updatedSettings.theme === 'light' ? LIGHT_THEME : DARK_THEME;

	return {
		...state,
		settings: updatedSettings,
		theme:
			updatedSettings.theme !== state.settings.theme ? newTheme : state.theme,
	};
}

export function applyUpdateTheme(
	state: AppState,
	action: Extract<AppAction, { type: 'UPDATE_THEME' }>
): AppState {
	return {
		...state,
		theme: { ...state.theme, ...action.payload },
	};
}
