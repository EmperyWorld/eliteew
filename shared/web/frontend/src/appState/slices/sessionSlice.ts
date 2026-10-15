/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Session auth reducers for app state (user, loading, authenticated + mobile-embedded route).
 *
 * Invariants:
 * - Authenticated desktop default is `desktop`; mobile-embedded hash pages stay on ShellPageType.
 *
 * Related:
 * - appState/types.ts · utils/pageRouting.ts
 */
import type { AppAction, AppState, PageType, ShellPageType } from '../types';
import { normalizePageCandidate } from '../../utils/pageRouting';

const MOBILE_EMBEDDED_PAGES = [
	'mobile-ewa-companion',
	'mobile-handbook',
	'mobile-social-hub',
	'mobile-feedback-hub',
	'mobile-notifications',
	'mobile-content-manager',
	'mobile-ewdesk',
	'mobile-professional-worlds',
	'mobile-app-store',
	'mobile-desktop-settings',
] as const satisfies readonly PageType[];

type MobileEmbeddedPage = (typeof MOBILE_EMBEDDED_PAGES)[number];

function isMobileEmbeddedPage(page: string): page is MobileEmbeddedPage {
	return (MOBILE_EMBEDDED_PAGES as readonly string[]).includes(page);
}

function resolveMobileEmbeddedRoute(): MobileEmbeddedPage | null {
	if (typeof window === 'undefined') {
		return null;
	}
	const fromHash = normalizePageCandidate(window.location.hash);
	return fromHash && isMobileEmbeddedPage(fromHash) ? fromHash : null;
}

export function applySetUser(
	state: AppState,
	action: Extract<AppAction, { type: 'SET_USER' }>
): AppState {
	if (state.user === action.payload) {
		return state;
	}
	return { ...state, user: action.payload };
}

export function applySetLoading(
	state: AppState,
	action: Extract<AppAction, { type: 'SET_LOADING' }>
): AppState {
	if (state.isLoading === action.payload) {
		return state;
	}
	return { ...state, isLoading: action.payload };
}

export function applySetAuthenticated(
	state: AppState,
	action: Extract<AppAction, { type: 'SET_AUTHENTICATED' }>
): AppState {
	const nextAuthenticated = action.payload;
	const mobileEmbeddedRoute = resolveMobileEmbeddedRoute();
	const nextCurrentPage: ShellPageType = nextAuthenticated
		? state.currentPage === 'login'
			? (mobileEmbeddedRoute ?? 'desktop')
			: state.currentPage
		: (mobileEmbeddedRoute ??
			(isMobileEmbeddedPage(state.currentPage) ? state.currentPage : 'login'));
	if (
		state.isAuthenticated === nextAuthenticated &&
		state.currentPage === nextCurrentPage
	) {
		return state;
	}
	return {
		...state,
		isAuthenticated: nextAuthenticated,
		currentPage: nextCurrentPage,
	};
}
