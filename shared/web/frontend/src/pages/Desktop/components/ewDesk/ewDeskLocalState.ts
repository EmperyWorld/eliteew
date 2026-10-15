/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * localStorage/sessionStorage persistence for EWDesk read markers, stars, reading width.
 *
 * Invariants:
 * - Caps prevent unbounded growth; invalid JSON yields empty sets.
 *
 * Related:
 * - useEwDeskUserStateSync.ts, EWDeskApp.tsx
 */

import {
	EW_DESK_READ_IDS_KEY,
	EW_DESK_READING_WIDTH_KEY,
	EW_DESK_STARRED_IDS_KEY,
	MAX_EW_DESK_READ_IDS,
	MAX_EW_DESK_STARRED_IDS,
	type EwDeskReadingWidth,
} from './ewDeskConstants';

export function loadEwDeskReadingWidth(): EwDeskReadingWidth {
	try {
		const raw = sessionStorage.getItem(EW_DESK_READING_WIDTH_KEY);
		if (raw === 'narrow' || raw === 'wide' || raw === 'comfortable') {
			return raw;
		}
	} catch {
		// ignore
	}
	return 'comfortable';
}

export function persistEwDeskReadingWidth(w: EwDeskReadingWidth): void {
	try {
		sessionStorage.setItem(EW_DESK_READING_WIDTH_KEY, w);
	} catch {
		// ignore
	}
}

export function loadEwDeskReadIds(): Set<string> {
	try {
		const raw = localStorage.getItem(EW_DESK_READ_IDS_KEY);
		if (!raw) return new Set();
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return new Set();
		return new Set(
			parsed
				.filter((x): x is string => typeof x === 'string')
				.slice(0, MAX_EW_DESK_READ_IDS)
		);
	} catch {
		return new Set();
	}
}

export function persistEwDeskReadIds(ids: Set<string>): void {
	try {
		const arr = [...ids].slice(0, MAX_EW_DESK_READ_IDS);
		localStorage.setItem(EW_DESK_READ_IDS_KEY, JSON.stringify(arr));
	} catch {
		// ignore
	}
}

export function loadEwDeskStarredIds(): Set<string> {
	try {
		const raw = localStorage.getItem(EW_DESK_STARRED_IDS_KEY);
		if (!raw) return new Set();
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return new Set();
		return new Set(
			parsed
				.filter((x): x is string => typeof x === 'string')
				.slice(0, MAX_EW_DESK_STARRED_IDS)
		);
	} catch {
		return new Set();
	}
}

export function persistEwDeskStarredIds(ids: Set<string>): void {
	try {
		const arr = [...ids].slice(0, MAX_EW_DESK_STARRED_IDS);
		localStorage.setItem(EW_DESK_STARRED_IDS_KEY, JSON.stringify(arr));
	} catch {
		// ignore
	}
}
