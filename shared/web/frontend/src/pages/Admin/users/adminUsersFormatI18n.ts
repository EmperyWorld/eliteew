/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * i18n-aware formatters for admin Users catalog channel cells.
 */

import type { TFunction } from 'i18next';

export function formatRelativeActivityI18n(
	iso: string | null | undefined,
	t: TFunction,
	_tick: number
): string | null {
	if (!iso) return null;
	try {
		const ts = new Date(iso).getTime();
		if (Number.isNaN(ts)) return null;
		const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
		if (sec < 60) return t('adminUsersHub.channels.secAgo', { n: sec });
		const min = Math.floor(sec / 60);
		if (min < 60) return t('adminUsersHub.channels.minAgo', { n: min });
		const h = Math.floor(min / 60);
		return t('adminUsersHub.channels.hoursAgo', { n: h });
	} catch {
		return null;
	}
}

export function channelStatusLabelI18n(
	active: boolean,
	live: boolean | undefined,
	t: TFunction
): string {
	if (live) return t('adminUsersHub.channels.online');
	if (active) return t('adminUsersHub.channels.recent');
	return t('adminUsersHub.channels.none');
}
