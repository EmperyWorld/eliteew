import { LAST_VISITED_PAGE_LOCAL_KEY } from '../../constants/storageKeys';
import { log } from '../../utils/logger';
import {
	isOAuthCallbackHash,
	navigateDesktopShell,
} from '../../utils/pageRouting';
import type { AppAction, AppState, ShellPageType } from '../types';

export function applySetCurrentPage(
	state: AppState,
	action: Extract<AppAction, { type: 'SET_CURRENT_PAGE' }>,
	timestamp: number
): AppState {
	const nextPage = navigateDesktopShell(action.payload) as ShellPageType;
	if (nextPage === state.currentPage) {
		return state;
	}
	try {
		if (nextPage !== 'login' && !isOAuthCallbackHash(action.payload)) {
			localStorage.setItem(LAST_VISITED_PAGE_LOCAL_KEY, nextPage);
			log.info(
				'navigationSlice',
				`Saved current page to localStorage: ${nextPage}`
			);
		}
	} catch (error) {
		log.warn(
			'Failed to save last visited page to localStorage:',
			String(error)
		);
	}

	return {
		...state,
		currentPage: nextPage,
		navigationHistory: [
			...state.navigationHistory.slice(-9),
			{
				id: `nav_${timestamp}`,
				page: nextPage,
				timestamp,
				title: nextPage.replace('-', ' ').toUpperCase(),
			},
		],
		performance: {
			...state.performance,
			pageLoadTimes: {
				...state.performance.pageLoadTimes,
				[nextPage]: timestamp,
			},
		},
	};
}

export function applyAddNavigationHistory(
	state: AppState,
	action: Extract<AppAction, { type: 'ADD_NAVIGATION_HISTORY' }>
): AppState {
	return {
		...state,
		navigationHistory: [...state.navigationHistory.slice(-9), action.payload],
	};
}
