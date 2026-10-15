import type { AppAction, AppState } from '../types';

export function applyToggleSidebar(state: AppState): AppState {
	return {
		...state,
		sidebar: {
			...state.sidebar,
			isOpen: !state.sidebar.isOpen,
		},
	};
}

export function applySetSidebarCompact(
	state: AppState,
	action: Extract<AppAction, { type: 'SET_SIDEBAR_COMPACT' }>
): AppState {
	return {
		...state,
		sidebar: {
			...state.sidebar,
			isCompact: action.payload,
		},
	};
}

export function applyToggleModal(
	state: AppState,
	action: Extract<AppAction, { type: 'TOGGLE_MODAL' }>
): AppState {
	return {
		...state,
		modals: {
			...state.modals,
			[action.payload]: !state.modals[action.payload],
		},
	};
}
