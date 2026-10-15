/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared App Store admin helpers (debounce, sort, datalist, datetime).
 *
 * Invariants:
 * - Admin HTTP via `desktopAdminApi`; tab content is self-contained (no marketing AMKA).
 *
 * Related:
 * - `pages/Desktop/DesktopAppStoreAdminPage.tsx` (public barrel)
 * - `documentation/product/desktop/DESKTOP-APP-STORE-ADMIN-INTERFACE-AUDIT-NOTE.md`
 */
import * as React from 'react';
import { useEffect, useState } from 'react';
import type { CatalogAppResponse } from '../services/desktopAdminApi';
import { KNOWN_DESKTOP_APP_COMPONENTS } from '../utils/desktopAppRegistry';
import type { CatalogSortField } from './types';

export function useDebouncedValue<T>(value: T, delayMs: number): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const id = window.setTimeout(() => setDebounced(value), delayMs);
		return () => window.clearTimeout(id);
	}, [value, delayMs]);
	return debounced;
}

export function sortableAdminColumnKeyDown(
	field: CatalogSortField,
	onSort: (f: CatalogSortField) => void
): React.KeyboardEventHandler<HTMLTableCellElement> {
	return (e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onSort(field);
		}
	};
}

const APP_COMPONENT_OPTIONS = Array.from(KNOWN_DESKTOP_APP_COMPONENTS).sort(
	(left, right) => left.localeCompare(right)
);

export function catalogGroupsSortKey(app: CatalogAppResponse): string {
	return (app.access_groups ?? [])
		.map((g) => g.name)
		.sort()
		.join(', ');
}

export function formatCatalogGroupsCell(app: CatalogAppResponse): string {
	const names = (app.access_groups ?? []).map((g) => g.name).sort();
	return names.length > 0 ? names.join(', ') : '—';
}

export function AppComponentDatalist(): React.ReactElement {
	return (
		<datalist id="desktop-app-component-options">
			{APP_COMPONENT_OPTIONS.map((componentName) => (
				<option key={componentName} value={componentName} />
			))}
		</datalist>
	);
}

export function isoToDatetimeLocalValue(
	iso: string | null | undefined
): string {
	if (!iso) {
		return '';
	}
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) {
		return '';
	}
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
