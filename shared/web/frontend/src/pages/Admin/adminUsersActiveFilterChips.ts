/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Build removable filter chip descriptors for admin Users catalog (i18n keys + clear by id).
 *
 * Related:
 * - `pages/Admin/adminUsersFilterPresets.ts`
 * - `pages/Admin/adminDirectorySort.ts`
 */

import {
	ADMIN_DIRECTORY_SORT_I18N,
	ADMIN_DIRECTORY_SORT_OPTIONS,
} from './adminDirectorySort';
import { shortenAdminUserId } from './adminUserRoles';
import {
	DEFAULT_ADMIN_USERS_FILTERS,
	type AdminUsersFilterSnapshot,
	type AdminUsersTriFilter,
} from './adminUsersFilterPresets';

export type AdminUsersFilterChipDef = {
	id: string;
	labelKey: string;
	labelParams?: Record<string, string>;
};

function triChip(
	field: 'active' | 'trusted' | 'verified',
	value: AdminUsersTriFilter
): AdminUsersFilterChipDef | null {
	if (value === 'all') return null;
	return {
		id: field,
		labelKey: `adminUsersHub.chips.${field}`,
		labelParams: {
			value:
				value === 'yes'
					? 'adminUsersHub.chips.triYes'
					: 'adminUsersHub.chips.triNo',
		},
	};
}

/** Chip defs use `labelParams.value` as nested i18n key for tri-state yes/no. */
export function buildAdminUsersFilterChipDefs(
	snapshot: AdminUsersFilterSnapshot
): AdminUsersFilterChipDef[] {
	const chips: AdminUsersFilterChipDef[] = [];
	const q = snapshot.search.trim();
	if (q)
		chips.push({
			id: 'search',
			labelKey: 'adminUsersHub.chips.search',
			labelParams: { q },
		});
	if (snapshot.roleFilter.trim()) {
		chips.push({
			id: 'role',
			labelKey: 'adminUsersHub.chips.role',
			labelParams: { role: snapshot.roleFilter.trim() },
		});
	}
	const active = triChip('active', snapshot.activeFilter);
	if (active) chips.push(active);
	const trusted = triChip('trusted', snapshot.trustedFilter);
	if (trusted) chips.push(trusted);
	const verified = triChip('verified', snapshot.verifiedFilter);
	if (verified) chips.push(verified);
	if (snapshot.onlineOnly) {
		chips.push({ id: 'online', labelKey: 'adminUsersHub.chips.onlineOnly' });
	}
	if (snapshot.groupFilter.trim()) {
		const g = snapshot.groupFilter.trim();
		chips.push(
			g === '__none__'
				? { id: 'group', labelKey: 'adminUsersHub.chips.groupNone' }
				: {
						id: 'group',
						labelKey: 'adminUsersHub.chips.group',
						labelParams: { id: shortenAdminUserId(g) },
					}
		);
	}
	if (snapshot.anomalyOnly) {
		chips.push({ id: 'anomaly', labelKey: 'adminUsersHub.chips.anomaly' });
	}
	if (snapshot.ssoBrowserOnly) {
		chips.push({
			id: 'ssoBrowser',
			labelKey: 'adminUsersHub.chips.ssoBrowser',
		});
	}
	if (snapshot.ssoMobileOnly) {
		chips.push({ id: 'ssoMobile', labelKey: 'adminUsersHub.chips.ssoMobile' });
	}
	if (snapshot.ssoDesktopOnly) {
		chips.push({
			id: 'ssoDesktop',
			labelKey: 'adminUsersHub.chips.ssoDesktop',
		});
	}
	if (snapshot.mismatchOnly) {
		chips.push({ id: 'mismatch', labelKey: 'adminUsersHub.chips.mismatch' });
	}
	if (snapshot.sortValue !== DEFAULT_ADMIN_USERS_FILTERS.sortValue) {
		const sortI18nKey =
			ADMIN_DIRECTORY_SORT_I18N[
				snapshot.sortValue as keyof typeof ADMIN_DIRECTORY_SORT_I18N
			] ??
			ADMIN_DIRECTORY_SORT_OPTIONS.find((o) => o.value === snapshot.sortValue)
				?.value ??
			snapshot.sortValue;
		chips.push({
			id: 'sort',
			labelKey: 'adminUsersHub.chips.sort',
			labelParams: { value: sortI18nKey },
		});
	}
	return chips;
}

/** @deprecated Use buildAdminUsersFilterChipDefs + i18n in UI. */
export type AdminUsersActiveFilterChip = {
	id: string;
	label: string;
};

/** @deprecated Use buildAdminUsersFilterChipDefs. */
export function buildAdminUsersActiveFilterChips(
	snapshot: AdminUsersFilterSnapshot
): AdminUsersActiveFilterChip[] {
	return buildAdminUsersFilterChipDefs(snapshot).map((d) => ({
		id: d.id,
		label: d.labelKey,
	}));
}

/** Returns a new snapshot with one chip filter cleared. */
export function clearAdminUsersFilterChip(
	chipId: string,
	current: AdminUsersFilterSnapshot
): AdminUsersFilterSnapshot {
	const base = { ...current };
	switch (chipId) {
		case 'search':
			return { ...base, search: '' };
		case 'role':
			return { ...base, roleFilter: '' };
		case 'active':
			return { ...base, activeFilter: 'all' };
		case 'trusted':
			return { ...base, trustedFilter: 'all' };
		case 'verified':
			return { ...base, verifiedFilter: 'all' };
		case 'online':
			return { ...base, onlineOnly: false };
		case 'group':
			return { ...base, groupFilter: '' };
		case 'anomaly':
			return { ...base, anomalyOnly: false };
		case 'ssoBrowser':
			return { ...base, ssoBrowserOnly: false };
		case 'ssoMobile':
			return { ...base, ssoMobileOnly: false };
		case 'ssoDesktop':
			return { ...base, ssoDesktopOnly: false };
		case 'mismatch':
			return { ...base, mismatchOnly: false };
		case 'sort':
			return { ...base, sortValue: DEFAULT_ADMIN_USERS_FILTERS.sortValue };
		default:
			return base;
	}
}
