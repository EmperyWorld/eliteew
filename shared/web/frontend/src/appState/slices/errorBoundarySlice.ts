import type { AppAction, AppState } from '../types';

export function applySetErrorBoundary(
	state: AppState,
	action: Extract<AppAction, { type: 'SET_ERROR_BOUNDARY' }>
): AppState {
	return {
		...state,
		errorBoundary: {
			...state.errorBoundary,
			...action.payload,
		},
	};
}
