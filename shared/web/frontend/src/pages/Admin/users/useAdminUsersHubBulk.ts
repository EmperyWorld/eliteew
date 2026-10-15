/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bulk access-group assignment and CSV export handlers for admin Users hub catalog.
 *
 * Invariants:
 * - Bulk group updates only selected user IDs; select-all-matching capped at 200 rows.
 *
 * Related:
 * - `pages/Admin/users/useAdminUsersHubController.ts`
 * - `pages/Admin/adminUsersCsvExport.ts`
 */

import * as React from 'react';
import { toast } from 'sonner';
import type { TFunction } from 'i18next';
import { adminApi } from '../../../services/admin/api';
import { updateUserAccessGroup } from '../../Desktop/services/desktopAdminApi';
import type { AdminDirectoryUserRow } from '../adminDirectoryUserTypes';
import { adminUsersCsvHeaderLabelI18n } from '../adminUsersCsvHeaderI18n';
import { downloadAdminUsersCsv } from '../adminUsersCsvExport';
import { adminUserRoleLabelI18n } from '../adminUserRolesI18n';
import type { AdminUsersTableColumns } from '../adminUsersTableColumns';
import type { AdminUsersDirectoryQueryParams } from './useAdminUsersHubFilters';

export type AdminUsersHubBulk = {
	bulkOpen: boolean;
	closeBulkModal: () => void;
	openBulkModal: () => void;
	handleBulkApply: (groupId: string | null) => Promise<void>;
	bulkBusy: boolean;
	bulkProgress: { done: number; total: number } | null;
	selectAllBusy: boolean;
	handleSelectAllMatchingFilter: () => Promise<void>;
	handleExportAllMatchingCsv: () => Promise<void>;
	handleExportSelectedCsv: () => void;
};

type UseAdminUsersHubBulkOptions = {
	t: TFunction<'desktopUi'>;
	selectedUserIds: string[];
	setSelectedUserIds: React.Dispatch<React.SetStateAction<string[]>>;
	payload: Awaited<ReturnType<typeof adminApi.getUsersDirectory>> | null;
	directoryQueryParams: AdminUsersDirectoryQueryParams;
	tableColumns: AdminUsersTableColumns;
	list: AdminDirectoryUserRow[];
	invalidateDirectory: () => void;
};

export function useAdminUsersHubBulk(
	options: UseAdminUsersHubBulkOptions
): AdminUsersHubBulk {
	const {
		t,
		selectedUserIds,
		setSelectedUserIds,
		payload,
		directoryQueryParams,
		tableColumns,
		list,
		invalidateDirectory,
	} = options;

	const [bulkOpen, setBulkOpen] = React.useState(false);
	const [bulkBusy, setBulkBusy] = React.useState(false);
	const [bulkProgress, setBulkProgress] = React.useState<{
		done: number;
		total: number;
	} | null>(null);
	const [selectAllBusy, setSelectAllBusy] = React.useState(false);

	const closeBulkModal = React.useCallback(() => {
		if (!bulkBusy) setBulkOpen(false);
	}, [bulkBusy]);

	const openBulkModal = React.useCallback(() => {
		setBulkOpen(true);
	}, []);

	const handleBulkApply = React.useCallback(
		async (groupId: string | null): Promise<void> => {
			if (selectedUserIds.length === 0) return;
			const total = selectedUserIds.length;
			setBulkBusy(true);
			setBulkProgress({ done: 0, total });
			let ok = 0;
			let fail = 0;
			try {
				for (const id of selectedUserIds) {
					try {
						await updateUserAccessGroup(id, {
							app_access_group_id: groupId,
						});
						ok += 1;
					} catch {
						fail += 1;
					}
					setBulkProgress({ done: ok + fail, total });
				}
				setSelectedUserIds([]);
				setBulkOpen(false);
				if (fail === 0) {
					toast.success(
						t('adminUsersHub.hubActions.bulkGroupOk', { count: ok })
					);
				} else {
					toast.warning(
						t('adminUsersHub.hubActions.bulkGroupPartial', { ok, fail })
					);
				}
				invalidateDirectory();
			} finally {
				setBulkBusy(false);
				setBulkProgress(null);
			}
		},
		[selectedUserIds, setSelectedUserIds, invalidateDirectory, t]
	);

	const handleSelectAllMatchingFilter =
		React.useCallback(async (): Promise<void> => {
			if (!payload) return;
			if (payload.total > 200) {
				toast.warning(t('adminUsersHub.hubActions.tooManyFilter'), {
					description: t('adminUsersHub.hubActions.tooManyFilterDesc', {
						total: payload.total,
					}),
				});
				return;
			}
			setSelectAllBusy(true);
			try {
				const data = await adminApi.getUsersDirectory({
					...directoryQueryParams,
					page: 1,
					per_page: Math.min(200, payload.total),
				});
				setSelectedUserIds(data.users.map((u) => u.id));
				toast.success(
					t('adminUsersHub.hubActions.selectAllMatching', {
						count: data.users.length,
					})
				);
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				toast.error(msg);
			} finally {
				setSelectAllBusy(false);
			}
		}, [payload, directoryQueryParams, setSelectedUserIds, t]);

	const handleExportSelectedCsv = React.useCallback((): void => {
		const selected = list.filter((u) => selectedUserIds.includes(u.id));
		if (selected.length === 0) return;
		downloadAdminUsersCsv(selected, {
			tableColumns,
			roleLabel: (role) => adminUserRoleLabelI18n(role, t),
			headerLabel: (key) => adminUsersCsvHeaderLabelI18n(key, t),
		});
		toast.success(
			t('adminUsersHub.hubActions.exportRows', { count: selected.length })
		);
	}, [list, selectedUserIds, tableColumns, t]);

	const handleExportAllMatchingCsv =
		React.useCallback(async (): Promise<void> => {
			if (!payload) return;
			if (payload.total > 200) {
				toast.warning(t('adminUsersHub.hubActions.tooManyExport'), {
					description: t('adminUsersHub.hubActions.tooManyExportDesc', {
						total: payload.total,
					}),
				});
				return;
			}
			setSelectAllBusy(true);
			try {
				const data = await adminApi.getUsersDirectory({
					...directoryQueryParams,
					page: 1,
					per_page: Math.min(200, payload.total),
				});
				downloadAdminUsersCsv(data.users as AdminDirectoryUserRow[], {
					tableColumns,
					roleLabel: (role) => adminUserRoleLabelI18n(role, t),
					headerLabel: (key) => adminUsersCsvHeaderLabelI18n(key, t),
				});
				toast.success(
					t('adminUsersHub.hubActions.exportRows', { count: data.users.length })
				);
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				toast.error(msg);
			} finally {
				setSelectAllBusy(false);
			}
		}, [payload, directoryQueryParams, tableColumns, t]);

	return {
		bulkOpen,
		closeBulkModal,
		openBulkModal,
		handleBulkApply,
		bulkBusy,
		bulkProgress,
		selectAllBusy,
		handleSelectAllMatchingFilter,
		handleExportAllMatchingCsv,
		handleExportSelectedCsv,
	};
}
