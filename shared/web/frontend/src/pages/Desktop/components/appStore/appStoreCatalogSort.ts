/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure sort helpers for App Store catalog lists (default catalog order, name, price).
 *
 * Invariants:
 * - Sort is stable within each mode; catalog mode prioritizes `show_new_badge` then `sort_order`.
 *
 * Related:
 * - AppStore.tsx, AppStoreFeaturedRow.tsx
 */

import type { TFunction } from 'i18next';
import type { StoreAppResponse } from '../../services/desktopApi';
import type { StoreSortMode } from './appStoreCatalogTypes';

export function formatAppsCount(n: number, t: TFunction<'appStore'>): string {
	return t('appsCount', { count: n });
}

export function sortAppsByCatalogOrder(
	list: StoreAppResponse[]
): StoreAppResponse[] {
	const next = [...list];
	next.sort((a, b) => {
		const na = a.show_new_badge ? 1 : 0;
		const nb = b.show_new_badge ? 1 : 0;
		if (nb !== na) {
			return nb - na;
		}
		const o = a.sort_order - b.sort_order;
		if (o !== 0) return o;
		return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
	});
	return next;
}

export function applyStoreSortMode(
	list: StoreAppResponse[],
	mode: StoreSortMode
): StoreAppResponse[] {
	const next = [...list];
	if (mode === 'catalog') {
		return sortAppsByCatalogOrder(next);
	}
	if (mode === 'name') {
		next.sort((a, b) =>
			a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
		);
		return next;
	}
	next.sort((a, b) => {
		const ea = a.billing_exempt === true;
		const eb = b.billing_exempt === true;
		if (ea !== eb) return ea ? -1 : 1;
		const pa = a.ew_monthly_price ?? 0;
		const pb = b.ew_monthly_price ?? 0;
		if (pa !== pb) return pa - pb;
		return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
	});
	return next;
}
