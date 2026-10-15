/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Directory filter React state, snapshot apply, query params, and page-reset for Users hub.
 *
 * Invariants:
 * - Page resets to 1 when any directory filter changes (via injected setPage).
 *
 * Related:
 * - `pages/Admin/users/useAdminUsersHubFilters.ts`
 */

import * as React from 'react';
import {
	toggleDirectoryColumnSort,
	type AdminDirectorySortBy,
} from '../adminDirectorySort';
import {
	normalizeAdminUsersFilterSnapshot,
	type AdminUsersFilterSnapshot,
} from '../adminUsersFilterPresets';
import {
	buildAdminUsersDirectoryFilterKey,
	buildAdminUsersDirectoryQueryParams,
	hasActiveAdminUsersDirectoryFilters,
	parseSortForDirectoryQuery,
} from './adminUsersDirectoryQuery';
import { useDebouncedValue } from './useDebouncedValue';

export type AdminUsersDirectoryFilterState = {
	search: string;
	setSearch: React.Dispatch<React.SetStateAction<string>>;
	debouncedSearch: string;
	searchInputRef: React.RefObject<HTMLInputElement | null>;
	roleFilter: string;
	setRoleFilter: React.Dispatch<React.SetStateAction<string>>;
	activeFilter: AdminUsersFilterSnapshot['activeFilter'];
	setActiveFilter: React.Dispatch<
		React.SetStateAction<AdminUsersFilterSnapshot['activeFilter']>
	>;
	trustedFilter: AdminUsersFilterSnapshot['trustedFilter'];
	setTrustedFilter: React.Dispatch<
		React.SetStateAction<AdminUsersFilterSnapshot['trustedFilter']>
	>;
	verifiedFilter: AdminUsersFilterSnapshot['verifiedFilter'];
	setVerifiedFilter: React.Dispatch<
		React.SetStateAction<AdminUsersFilterSnapshot['verifiedFilter']>
	>;
	onlineOnly: boolean;
	setOnlineOnly: React.Dispatch<React.SetStateAction<boolean>>;
	groupFilter: string;
	setGroupFilter: React.Dispatch<React.SetStateAction<string>>;
	mismatchOnly: boolean;
	setMismatchOnly: React.Dispatch<React.SetStateAction<boolean>>;
	anomalyOnly: boolean;
	setAnomalyOnly: React.Dispatch<React.SetStateAction<boolean>>;
	ssoBrowserOnly: boolean;
	setSsoBrowserOnly: React.Dispatch<React.SetStateAction<boolean>>;
	ssoMobileOnly: boolean;
	setSsoMobileOnly: React.Dispatch<React.SetStateAction<boolean>>;
	ssoDesktopOnly: boolean;
	setSsoDesktopOnly: React.Dispatch<React.SetStateAction<boolean>>;
	sortValue: string;
	setSortValue: React.Dispatch<React.SetStateAction<string>>;
	sort_by: ReturnType<typeof parseSortForDirectoryQuery>['sort_by'];
	sort_dir: ReturnType<typeof parseSortForDirectoryQuery>['sort_dir'];
	toggleColumnSort: (key: AdminDirectorySortBy) => void;
	currentFilterSnapshot: AdminUsersFilterSnapshot;
	applyFilterSnapshot: (raw: AdminUsersFilterSnapshot) => void;
	directoryQueryParams: ReturnType<typeof buildAdminUsersDirectoryQueryParams>;
	directoryFilterKey: ReturnType<typeof buildAdminUsersDirectoryFilterKey>;
	hasActiveFilters: boolean;
};

export function useAdminUsersDirectoryFilterState(options: {
	initialFilters: AdminUsersFilterSnapshot;
	setPage: React.Dispatch<React.SetStateAction<number>>;
}): AdminUsersDirectoryFilterState {
	const { initialFilters, setPage } = options;

	const [search, setSearch] = React.useState(initialFilters.search);
	const debouncedSearch = useDebouncedValue(search, 400);
	const [roleFilter, setRoleFilter] = React.useState(initialFilters.roleFilter);
	const [activeFilter, setActiveFilter] = React.useState(
		initialFilters.activeFilter
	);
	const [trustedFilter, setTrustedFilter] = React.useState(
		initialFilters.trustedFilter
	);
	const [verifiedFilter, setVerifiedFilter] = React.useState(
		initialFilters.verifiedFilter
	);
	const [onlineOnly, setOnlineOnly] = React.useState(initialFilters.onlineOnly);
	const [groupFilter, setGroupFilter] = React.useState(
		initialFilters.groupFilter
	);
	const [mismatchOnly, setMismatchOnly] = React.useState(
		initialFilters.mismatchOnly
	);
	const [anomalyOnly, setAnomalyOnly] = React.useState(
		initialFilters.anomalyOnly
	);
	const [ssoBrowserOnly, setSsoBrowserOnly] = React.useState(
		initialFilters.ssoBrowserOnly
	);
	const [ssoMobileOnly, setSsoMobileOnly] = React.useState(
		initialFilters.ssoMobileOnly
	);
	const [ssoDesktopOnly, setSsoDesktopOnly] = React.useState(
		initialFilters.ssoDesktopOnly
	);
	const [sortValue, setSortValue] = React.useState(initialFilters.sortValue);
	const searchInputRef = React.useRef<HTMLInputElement | null>(null);

	const currentFilterSnapshot = React.useMemo(
		(): AdminUsersFilterSnapshot => ({
			search,
			roleFilter,
			activeFilter,
			trustedFilter,
			verifiedFilter,
			onlineOnly,
			groupFilter,
			anomalyOnly,
			ssoBrowserOnly,
			ssoMobileOnly,
			ssoDesktopOnly,
			mismatchOnly,
			sortValue,
		}),
		[
			search,
			roleFilter,
			activeFilter,
			trustedFilter,
			verifiedFilter,
			onlineOnly,
			groupFilter,
			anomalyOnly,
			ssoBrowserOnly,
			ssoMobileOnly,
			ssoDesktopOnly,
			mismatchOnly,
			sortValue,
		]
	);

	const applyFilterSnapshot = React.useCallback(
		(raw: AdminUsersFilterSnapshot) => {
			const s = normalizeAdminUsersFilterSnapshot(raw);
			setSearch(s.search);
			setRoleFilter(s.roleFilter);
			setActiveFilter(s.activeFilter);
			setTrustedFilter(s.trustedFilter);
			setVerifiedFilter(s.verifiedFilter);
			setOnlineOnly(s.onlineOnly);
			setGroupFilter(s.groupFilter);
			setAnomalyOnly(s.anomalyOnly);
			setSsoBrowserOnly(s.ssoBrowserOnly);
			setSsoMobileOnly(s.ssoMobileOnly);
			setSsoDesktopOnly(s.ssoDesktopOnly);
			setMismatchOnly(s.mismatchOnly);
			setSortValue(s.sortValue);
		},
		[]
	);

	const { sort_by, sort_dir } = React.useMemo(
		() => parseSortForDirectoryQuery(sortValue),
		[sortValue]
	);

	const directoryQueryInput = React.useMemo(
		() => ({
			debouncedSearch,
			roleFilter,
			activeFilter,
			trustedFilter,
			verifiedFilter,
			onlineOnly,
			groupFilter,
			anomalyOnly,
			ssoBrowserOnly,
			ssoMobileOnly,
			ssoDesktopOnly,
			mismatchOnly,
			sortValue,
			sort_by,
			sort_dir,
		}),
		[
			debouncedSearch,
			roleFilter,
			activeFilter,
			trustedFilter,
			verifiedFilter,
			onlineOnly,
			groupFilter,
			anomalyOnly,
			ssoBrowserOnly,
			ssoMobileOnly,
			ssoDesktopOnly,
			mismatchOnly,
			sortValue,
			sort_by,
			sort_dir,
		]
	);

	const directoryQueryParams = React.useMemo(
		() => buildAdminUsersDirectoryQueryParams(directoryQueryInput),
		[directoryQueryInput]
	);

	const directoryFilterKey = React.useMemo(
		() => buildAdminUsersDirectoryFilterKey(directoryQueryInput),
		[directoryQueryInput]
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset page when filters change
	React.useEffect(() => {
		setPage(1);
	}, [
		debouncedSearch,
		roleFilter,
		activeFilter,
		trustedFilter,
		verifiedFilter,
		onlineOnly,
		groupFilter,
		anomalyOnly,
		ssoBrowserOnly,
		ssoMobileOnly,
		ssoDesktopOnly,
		mismatchOnly,
		sortValue,
	]);

	const toggleColumnSort = React.useCallback(
		(key: AdminDirectorySortBy) => {
			setSortValue(toggleDirectoryColumnSort(key, { sort_by, sort_dir }));
		},
		[sort_by, sort_dir]
	);

	const hasActiveFilters =
		hasActiveAdminUsersDirectoryFilters(directoryQueryInput);

	return {
		search,
		setSearch,
		debouncedSearch,
		searchInputRef,
		roleFilter,
		setRoleFilter,
		activeFilter,
		setActiveFilter,
		trustedFilter,
		setTrustedFilter,
		verifiedFilter,
		setVerifiedFilter,
		onlineOnly,
		setOnlineOnly,
		groupFilter,
		setGroupFilter,
		mismatchOnly,
		setMismatchOnly,
		anomalyOnly,
		setAnomalyOnly,
		ssoBrowserOnly,
		setSsoBrowserOnly,
		ssoMobileOnly,
		setSsoMobileOnly,
		ssoDesktopOnly,
		setSsoDesktopOnly,
		sortValue,
		setSortValue,
		sort_by,
		sort_dir,
		toggleColumnSort,
		currentFilterSnapshot,
		applyFilterSnapshot,
		directoryQueryParams,
		directoryFilterKey,
		hasActiveFilters,
	};
}
