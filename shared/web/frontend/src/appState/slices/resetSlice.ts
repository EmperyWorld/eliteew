import type { AppState } from '../types';

export function applyResetState(
	state: AppState,
	initialAppState: AppState
): AppState {
	return {
		...initialAppState,
		settings: state.settings,
		theme: state.theme,
	};
}
