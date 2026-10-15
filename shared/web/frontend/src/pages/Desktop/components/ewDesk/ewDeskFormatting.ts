/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Date/time formatting helpers for EWDesk list and detail panes.
 *
 * Invariants:
 * - Reuse a single Intl.DateTimeFormat instance for list rendering performance.
 *
 * Related:
 * - EWDeskApp.tsx, EwDeskNewsListRow.tsx
 */

import { formatDistanceToNow } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';

let cachedNewsDateFormatter: Intl.DateTimeFormat | null = null;

function getNewsDateFormatter(): Intl.DateTimeFormat {
	if (!cachedNewsDateFormatter) {
		cachedNewsDateFormatter = new Intl.DateTimeFormat(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short',
		});
	}
	return cachedNewsDateFormatter;
}

export function formatEwDeskNewsDate(iso: string | null): string {
	if (!iso) return '';
	try {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return getNewsDateFormatter().format(d);
	} catch {
		return iso;
	}
}

export function formatEwDeskRelativeNewsDate(
	iso: string | null,
	lang: string | undefined
): string {
	if (!iso) return '';
	try {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		const locale = lang?.toLowerCase().startsWith('ru') ? ru : enUS;
		return formatDistanceToNow(d, { addSuffix: true, locale });
	} catch {
		return '';
	}
}
