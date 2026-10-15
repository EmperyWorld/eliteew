import type { AppAction, AppState } from '../types';

export function applySetError(
	state: AppState,
	action: Extract<AppAction, { type: 'SET_ERROR' }>,
	timestamp: number
): AppState {
	return {
		...state,
		error: action.payload,
		notifications: action.payload
			? [
					...state.notifications,
					{
						id: `error_${timestamp}`,
						type: 'error',
						title: 'System Error',
						message: action.payload,
						timestamp: new Date(),
						read: false,
						persistent: false,
					},
				]
			: state.notifications,
	};
}

export function applyAddNotification(
	state: AppState,
	action: Extract<AppAction, { type: 'ADD_NOTIFICATION' }>
): AppState {
	return {
		...state,
		notifications: [action.payload, ...state.notifications.slice(0, 49)],
	};
}

export function applyRemoveNotification(
	state: AppState,
	action: Extract<AppAction, { type: 'REMOVE_NOTIFICATION' }>
): AppState {
	return {
		...state,
		notifications: state.notifications.filter((n) => n.id !== action.payload),
	};
}

export function applyMarkNotificationRead(
	state: AppState,
	action: Extract<AppAction, { type: 'MARK_NOTIFICATION_READ' }>
): AppState {
	return {
		...state,
		notifications: state.notifications.map((n) =>
			n.id === action.payload ? { ...n, read: true } : n
		),
	};
}
