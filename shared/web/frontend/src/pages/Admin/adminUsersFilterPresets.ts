/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Saved and last-used filter snapshots for admin Users directory (localStorage).
 *
 * Invariants:
 * - Preset list capped at MAX_NAMED_PRESETS; IDs are stable UUIDs for delete.
 *
 * Related:
 * - `pages/Admin/AdminUsersHubSection.tsx`
 */

export type AdminUsersTriFilter = 'all' | 'yes' | 'no';

export type AdminUsersFilterSnapshot = {
	search: string;
	roleFilter: string;
	activeFilter: AdminUsersTriFilter;
	trustedFilter: AdminUsersTriFilter;
	verifiedFilter: AdminUsersTriFilter;
	onlineOnly: boolean;
	groupFilter: string;
	anomalyOnly: boolean;
	ssoBrowserOnly: boolean;
	ssoMobileOnly: boolean;
	ssoDesktopOnly: boolean;
	mismatchOnly: boolean;
	sortValue: string;
};

export type AdminUsersNamedPreset = {
	id: string;
	name: string;
	savedAt: string;
	filters: AdminUsersFilterSnapshot;
};

const LAST_FILTERS_KEY = 'eliteew.admin.users.lastFilters.v1';
const NAMED_PRESETS_KEY = 'eliteew.admin.users.namedPresets.v1';
export const MAX_NAMED_PRESETS = 12;

export const DEFAULT_ADMIN_USERS_FILTERS: AdminUsersFilterSnapshot = {
	search: '',
	roleFilter: '',
	activeFilter: 'all',
	trustedFilter: 'all',
	verifiedFilter: 'all',
	onlineOnly: false,
	groupFilter: '',
	anomalyOnly: false,
	ssoBrowserOnly: false,
	ssoMobileOnly: false,
	ssoDesktopOnly: false,
	mismatchOnly: false,
	sortValue: 'created_at:desc',
};

function normalizeTriFilter(v: unknown): AdminUsersTriFilter {
	return v === 'yes' || v === 'no' ? v : 'all';
}

export function normalizeAdminUsersFilterSnapshot(
	raw: Partial<AdminUsersFilterSnapshot> | null | undefined
): AdminUsersFilterSnapshot {
	if (!raw) return { ...DEFAULT_ADMIN_USERS_FILTERS };
	return {
		search: typeof raw.search === 'string' ? raw.search : '',
		roleFilter: typeof raw.roleFilter === 'string' ? raw.roleFilter : '',
		activeFilter: normalizeTriFilter(raw.activeFilter),
		trustedFilter: normalizeTriFilter(raw.trustedFilter),
		verifiedFilter: normalizeTriFilter(raw.verifiedFilter),
		onlineOnly: Boolean(raw.onlineOnly),
		groupFilter: typeof raw.groupFilter === 'string' ? raw.groupFilter : '',
		anomalyOnly: Boolean(raw.anomalyOnly),
		ssoBrowserOnly: Boolean(raw.ssoBrowserOnly),
		ssoMobileOnly: Boolean(raw.ssoMobileOnly),
		ssoDesktopOnly: Boolean(raw.ssoDesktopOnly),
		mismatchOnly: Boolean(raw.mismatchOnly),
		sortValue:
			typeof raw.sortValue === 'string' && raw.sortValue.includes(':')
				? raw.sortValue
				: DEFAULT_ADMIN_USERS_FILTERS.sortValue,
	};
}

export function triFilterToApiBool(value: AdminUsersTriFilter): boolean | null {
	if (value === 'yes') return true;
	if (value === 'no') return false;
	return null;
}

export function loadLastAdminUsersFilters(): AdminUsersFilterSnapshot | null {
	try {
		const raw = localStorage.getItem(LAST_FILTERS_KEY);
		if (!raw) return null;
		return normalizeAdminUsersFilterSnapshot(
			JSON.parse(raw) as Partial<AdminUsersFilterSnapshot>
		);
	} catch {
		return null;
	}
}

export function saveLastAdminUsersFilters(
	snapshot: AdminUsersFilterSnapshot
): void {
	try {
		localStorage.setItem(LAST_FILTERS_KEY, JSON.stringify(snapshot));
	} catch {
		/* ignore */
	}
}

export function loadNamedAdminUsersPresets(): AdminUsersNamedPreset[] {
	try {
		const raw = localStorage.getItem(NAMED_PRESETS_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter(
				(p): p is AdminUsersNamedPreset =>
					typeof p === 'object' &&
					p !== null &&
					typeof (p as AdminUsersNamedPreset).id === 'string' &&
					typeof (p as AdminUsersNamedPreset).name === 'string' &&
					typeof (p as AdminUsersNamedPreset).filters === 'object'
			)
			.map((p) => ({
				...p,
				filters: normalizeAdminUsersFilterSnapshot(p.filters),
			}))
			.slice(0, MAX_NAMED_PRESETS);
	} catch {
		return [];
	}
}

export function persistNamedAdminUsersPresets(
	presets: AdminUsersNamedPreset[]
): void {
	try {
		localStorage.setItem(
			NAMED_PRESETS_KEY,
			JSON.stringify(presets.slice(0, MAX_NAMED_PRESETS))
		);
	} catch {
		/* ignore */
	}
}

export function addNamedAdminUsersPreset(
	name: string,
	filters: AdminUsersFilterSnapshot
): AdminUsersNamedPreset[] {
	const trimmed = name.trim();
	if (!trimmed) return loadNamedAdminUsersPresets();
	const preset: AdminUsersNamedPreset = {
		id:
			typeof crypto !== 'undefined' && crypto.randomUUID
				? crypto.randomUUID()
				: `preset-${Date.now()}`,
		name: trimmed,
		savedAt: new Date().toISOString(),
		filters: normalizeAdminUsersFilterSnapshot(filters),
	};
	const next = [preset, ...loadNamedAdminUsersPresets()].slice(
		0,
		MAX_NAMED_PRESETS
	);
	persistNamedAdminUsersPresets(next);
	return next;
}

export function deleteNamedAdminUsersPreset(
	id: string
): AdminUsersNamedPreset[] {
	const next = loadNamedAdminUsersPresets().filter((p) => p.id !== id);
	persistNamedAdminUsersPresets(next);
	return next;
}

export function hasNonDefaultAdminUsersFilters(
	s: AdminUsersFilterSnapshot
): boolean {
	const d = DEFAULT_ADMIN_USERS_FILTERS;
	return (
		s.search !== d.search ||
		s.roleFilter !== d.roleFilter ||
		s.activeFilter !== d.activeFilter ||
		s.trustedFilter !== d.trustedFilter ||
		s.verifiedFilter !== d.verifiedFilter ||
		s.onlineOnly !== d.onlineOnly ||
		s.groupFilter !== d.groupFilter ||
		s.anomalyOnly !== d.anomalyOnly ||
		s.ssoBrowserOnly !== d.ssoBrowserOnly ||
		s.ssoMobileOnly !== d.ssoMobileOnly ||
		s.ssoDesktopOnly !== d.ssoDesktopOnly ||
		s.mismatchOnly !== d.mismatchOnly ||
		s.sortValue !== d.sortValue
	);
}
