import { initialAppState } from './initialState';
import {
	applyAddNavigationHistory,
	applySetCurrentPage,
} from './slices/navigationSlice';
import {
	applyAddNotification,
	applyMarkNotificationRead,
	applyRemoveNotification,
	applySetError,
} from './slices/notificationsSlice';
import { applyResetState } from './slices/resetSlice';
import {
	applySetAuthenticated,
	applySetLoading,
	applySetUser,
} from './slices/sessionSlice';
import { applyUpdateSettings, applyUpdateTheme } from './slices/settingsSlice';
import {
	applyUpdatePerformance,
	applyUpdateWebSocket,
} from './slices/telemetrySlice';
import { applySetErrorBoundary } from './slices/errorBoundarySlice';
import {
	applySetSidebarCompact,
	applyToggleModal,
	applyToggleSidebar,
} from './slices/uiSlice';
import type { AppAction, AppState } from './types';

export function appReducer(state: AppState, action: AppAction): AppState {
	const timestamp = Date.now();

	switch (action.type) {
		case 'SET_CURRENT_PAGE':
			return applySetCurrentPage(state, action, timestamp);

		case 'SET_USER':
			return applySetUser(state, action);

		case 'SET_LOADING':
			return applySetLoading(state, action);

		case 'SET_AUTHENTICATED':
			return applySetAuthenticated(state, action);

		case 'SET_ERROR':
			return applySetError(state, action, timestamp);

		case 'UPDATE_SETTINGS':
			return applyUpdateSettings(state, action);

		case 'UPDATE_THEME':
			return applyUpdateTheme(state, action);

		case 'ADD_NAVIGATION_HISTORY':
			return applyAddNavigationHistory(state, action);

		case 'ADD_NOTIFICATION':
			return applyAddNotification(state, action);

		case 'REMOVE_NOTIFICATION':
			return applyRemoveNotification(state, action);

		case 'MARK_NOTIFICATION_READ':
			return applyMarkNotificationRead(state, action);

		case 'SET_ERROR_BOUNDARY':
			return applySetErrorBoundary(state, action);

		case 'UPDATE_PERFORMANCE':
			return applyUpdatePerformance(state, action, timestamp);

		case 'UPDATE_WEBSOCKET':
			return applyUpdateWebSocket(state, action);

		case 'TOGGLE_SIDEBAR':
			return applyToggleSidebar(state);

		case 'SET_SIDEBAR_COMPACT':
			return applySetSidebarCompact(state, action);

		case 'TOGGLE_MODAL':
			return applyToggleModal(state, action);

		case 'RESET_STATE':
			return applyResetState(state, initialAppState);

		default:
			return state;
	}
}
