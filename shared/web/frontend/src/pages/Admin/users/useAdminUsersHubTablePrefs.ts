/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * LocalStorage-backed table presentation prefs for admin Users hub
 * (channels compact, column visibility, auto-refresh).
 *
 * Invariants:
 * - Prefs persist independently of directory filter snapshot / named presets.
 *
 * Related:
 * - `pages/Admin/users/useAdminUsersHubFilters.ts`
 * - `pages/Admin/adminUsersTableColumns.ts`
 */

import * as React from 'react';
import {
	countVisibleTableColumns,
	loadAdminUsersTableColumns,
	saveAdminUsersTableColumns,
	type AdminUsersTableColumns,
} from '../adminUsersTableColumns';

const ADMIN_USERS_CHANNELS_COMPACT_KEY = 'eliteew.admin.users.channelsCompact';
const ADMIN_USERS_AUTO_REFRESH_KEY = 'eliteew.admin.users.autoRefresh';

export type AdminUsersHubTablePrefs = {
	channelsCompact: boolean;
	setChannelsCompact: React.Dispatch<React.SetStateAction<boolean>>;
	tableColumns: AdminUsersTableColumns;
	setTableColumns: React.Dispatch<React.SetStateAction<AdminUsersTableColumns>>;
	tableColSpan: number;
	autoRefresh: boolean;
	setAutoRefresh: React.Dispatch<React.SetStateAction<boolean>>;
};

export function useAdminUsersHubTablePrefs(): AdminUsersHubTablePrefs {
	const [channelsCompact, setChannelsCompact] = React.useState(() => {
		try {
			return localStorage.getItem(ADMIN_USERS_CHANNELS_COMPACT_KEY) === 'true';
		} catch {
			return true;
		}
	});
	const [tableColumns, setTableColumns] =
		React.useState<AdminUsersTableColumns>(loadAdminUsersTableColumns);
	const tableColSpan = React.useMemo(
		() => countVisibleTableColumns(tableColumns),
		[tableColumns]
	);
	const [autoRefresh, setAutoRefresh] = React.useState(() => {
		try {
			return localStorage.getItem(ADMIN_USERS_AUTO_REFRESH_KEY) === 'true';
		} catch {
			return false;
		}
	});

	React.useEffect(() => {
		try {
			localStorage.setItem(
				ADMIN_USERS_CHANNELS_COMPACT_KEY,
				channelsCompact ? 'true' : 'false'
			);
		} catch {
			/* ignore quota / private mode */
		}
	}, [channelsCompact]);

	React.useEffect(() => {
		saveAdminUsersTableColumns(tableColumns);
	}, [tableColumns]);

	React.useEffect(() => {
		try {
			localStorage.setItem(
				ADMIN_USERS_AUTO_REFRESH_KEY,
				autoRefresh ? 'true' : 'false'
			);
		} catch {
			/* ignore quota / private mode */
		}
	}, [autoRefresh]);

	return {
		channelsCompact,
		setChannelsCompact,
		tableColumns,
		setTableColumns,
		tableColSpan,
		autoRefresh,
		setAutoRefresh,
	};
}
