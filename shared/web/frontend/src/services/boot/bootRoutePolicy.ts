/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure, dependency-free route policy shared by pre-React entry and runtime
 * Desktop/recovery gates.
 *
 * Invariants:
 * - OAuth callbacks always enter the full application before tab election.
 * - Empty hash and `#/desktop` resolve to the same default Desktop route.
 * - This module must not import React, auth, API, i18n, or Desktop modules.
 *
 * Related:
 * - `main.tsx`, `tabBootstrap.ts`
 * - `documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md`
 */

export type BootLocation = {
	pathname: string;
	search: string;
	hash: string;
};

export type BootRouteKind =
	| 'desktop'
	| 'admin'
	| 'login'
	| 'mobile-download'
	| 'other';

export type BootEntryPolicy = {
	route: BootRouteKind;
	segment: string;
	oauthCallback: boolean;
	singleTabEligible: boolean;
};

const OAUTH_PARAMETER_NAMES = new Set([
	'code',
	'state',
	'session_state',
	'iss',
]);

export function normalizeBootHashSegment(hash: string): string {
	const normalized = hash.replace(/^#/, '').trim();
	if (!normalized) {
		return '';
	}
	const first = normalized.split('?')[0]?.split('&')[0] ?? '';
	return first.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
}

function containsOAuthSearchParameter(search: string): boolean {
	const params = new URLSearchParams(search);
	for (const name of OAUTH_PARAMETER_NAMES) {
		if (params.has(name)) {
			return true;
		}
	}
	return false;
}

export function isOAuthBootCallback(location: BootLocation): boolean {
	if (containsOAuthSearchParameter(location.search)) {
		return true;
	}
	const normalizedHash = location.hash.replace(/^#/, '');
	const hashQueryIndex = normalizedHash.indexOf('?');
	const hashQuery =
		hashQueryIndex >= 0
			? normalizedHash.slice(hashQueryIndex + 1)
			: normalizedHash;
	return containsOAuthSearchParameter(hashQuery);
}

export function classifyBootRoute(location: BootLocation): {
	route: BootRouteKind;
	segment: string;
} {
	const path = location.pathname.replace(/\/+$/, '').toLowerCase();
	if (path === '/mobile-app' || path.endsWith('/mobile-app')) {
		return { route: 'mobile-download', segment: 'mobile-app-download' };
	}

	const segment = normalizeBootHashSegment(location.hash);
	if (!segment || segment === 'desktop' || segment.startsWith('desktop/')) {
		return { route: 'desktop', segment: segment || 'desktop' };
	}
	if (segment === 'admin' || segment === 'desktop-admin') {
		return { route: 'admin', segment };
	}
	if (segment === 'login') {
		return { route: 'login', segment };
	}
	if (segment === 'mobile-app-download') {
		return { route: 'mobile-download', segment };
	}
	return { route: 'other', segment };
}

export function resolveBootEntryPolicy(
	location: BootLocation
): BootEntryPolicy {
	const { route, segment } = classifyBootRoute(location);
	const oauthCallback = isOAuthBootCallback(location);
	return {
		route,
		segment,
		oauthCallback,
		singleTabEligible:
			!oauthCallback && (route === 'desktop' || route === 'admin'),
	};
}

export function isDesktopBootLocation(location: BootLocation): boolean {
	return classifyBootRoute(location).route === 'desktop';
}

export function readWindowBootLocation(): BootLocation {
	if (typeof window === 'undefined') {
		return { pathname: '/', search: '', hash: '' };
	}
	return {
		pathname: window.location.pathname,
		search: window.location.search,
		hash: window.location.hash,
	};
}
