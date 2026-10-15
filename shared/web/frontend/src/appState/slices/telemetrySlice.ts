import type { AppAction, AppState } from '../types';

export function applyUpdatePerformance(
	state: AppState,
	action: Extract<AppAction, { type: 'UPDATE_PERFORMANCE' }>,
	timestamp: number
): AppState {
	return {
		...state,
		performance: {
			...state.performance,
			...action.payload,
			renderCount: state.performance.renderCount + 1,
			lastRenderTime: timestamp,
		},
	};
}

export function applyUpdateWebSocket(
	state: AppState,
	action: Extract<AppAction, { type: 'UPDATE_WEBSOCKET' }>
): AppState {
	return {
		...state,
		websocket: {
			...state.websocket,
			...action.payload,
		},
	};
}
