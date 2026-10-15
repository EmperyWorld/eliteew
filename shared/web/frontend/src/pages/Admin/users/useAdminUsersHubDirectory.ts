/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin Users directory query, pagination, row selection, and live refresh for the hub catalog.
 *
 * Invariants:
 * - Directory query runs only when hub view is catalog.
 *
 * Related:
 * - `pages/Admin/users/useAdminUsersHubController.ts`
 * - `services/admin/api.ts`
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { adminApi } from '../../../services/admin/api';
import { log } from '../../../utils/logger';
import type { AdminDirectoryUserRow } from '../adminDirectoryUserTypes';
import { detectAdminUserChannelMismatch } from '../adminUserChannelMismatch';
import type { AdminUsersHubView } from '../adminUsersHubView';
import { buildAdminUsersRedisFilterHintKeys } from '../adminUsersRedisFilterHints';
import { useAdminUsersCatalogLiveRefresh } from './useAdminUsersCatalogLiveRefresh';
import { useAdminUsersMobileCatalog } from './useAdminUsersMobileCatalog';
import type {
	AdminUsersDirectoryFilterKey,
	AdminUsersDirectoryQueryParams,
} from './useAdminUsersHubFilters';

const PER_PAGE = 40;

export type AdminUsersHubDirectory = {
	page: number;
	setPage: React.Dispatch<React.SetStateAction<number>>;
	totalPages: number;
	payload: Awaited<ReturnType<typeof adminApi.getUsersDirectory>> | null;
	loading: boolean;
	error: string | null;
	refetchDirectory: () => void;
	invalidateDirectory: () => void;
	tableList: AdminDirectoryUserRow[];
	onlineOnPage: number;
	mismatchOnPage: number;
	selectedUserIds: string[];
	setSelectedUserIds: React.Dispatch<React.SetStateAction<string[]>>;
	toggleOne: (id: string) => void;
	toggleAll: () => void;
	mobileCatalog: boolean;
	redisFilterHintKeys: string[];
};

type UseAdminUsersHubDirectoryOptions = {
	hubView: AdminUsersHubView;
	page: number;
	setPage: React.Dispatch<React.SetStateAction<number>>;
	directoryQueryParams: AdminUsersDirectoryQueryParams;
	directoryFilterKey: AdminUsersDirectoryFilterKey;
	autoRefresh: boolean;
	panelUser: AdminDirectoryUserRow | null;
	setPanelUser: React.Dispatch<
		React.SetStateAction<AdminDirectoryUserRow | null>
	>;
	onlineOnly: boolean;
	anomalyOnly: boolean;
	mismatchOnly: boolean;
};

export function useAdminUsersHubDirectory(
	options: UseAdminUsersHubDirectoryOptions
): AdminUsersHubDirectory {
	const {
		hubView,
		page,
		setPage,
		directoryQueryParams,
		directoryFilterKey,
		autoRefresh,
		panelUser,
		setPanelUser,
		onlineOnly,
		anomalyOnly,
		mismatchOnly,
	} = options;

	const queryClient = useQueryClient();
	const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([]);
	const mobileCatalog = useAdminUsersMobileCatalog();

	const directoryQuery = useQuery({
		queryKey: [
			'desktop',
			'admin',
			'users',
			'directory',
			{
				page,
				perPage: PER_PAGE,
				...directoryFilterKey,
			},
		],
		queryFn: async () => {
			try {
				return await adminApi.getUsersDirectory({
					page,
					per_page: PER_PAGE,
					...directoryQueryParams,
				});
			} catch (e) {
				log.error(
					'AdminUsersHubSection',
					'directory load failed',
					e instanceof Error ? e : undefined
				);
				throw e;
			}
		},
		staleTime: 30_000,
		refetchOnWindowFocus: true,
		enabled: hubView === 'catalog',
	});

	const payload = directoryQuery.data ?? null;
	const loading = directoryQuery.isFetching;
	const error =
		directoryQuery.error instanceof Error
			? directoryQuery.error.message
			: directoryQuery.error
				? String(directoryQuery.error)
				: null;

	const invalidateDirectory = React.useCallback(() => {
		void queryClient.invalidateQueries({
			queryKey: ['desktop', 'admin', 'users'],
		});
	}, [queryClient]);

	const refetchDirectory = React.useCallback(() => {
		void directoryQuery.refetch();
	}, [directoryQuery.refetch]);

	const totalPages = payload
		? Math.max(1, Math.ceil(payload.total / payload.per_page))
		: 1;

	React.useEffect(() => {
		if (!autoRefresh || hubView !== 'catalog') return;
		const timer = window.setInterval(() => {
			void directoryQuery.refetch();
		}, 30_000);
		return () => window.clearInterval(timer);
	}, [autoRefresh, hubView, directoryQuery.refetch]);

	useAdminUsersCatalogLiveRefresh(directoryQuery.refetch, {
		enabled: hubView === 'catalog',
		skipWhenAutoRefresh: autoRefresh,
	});

	const list = payload?.users ?? [];
	const tableList = list as AdminDirectoryUserRow[];

	React.useEffect(() => {
		if (panelUser || typeof window === 'undefined') return;
		const uid = new URLSearchParams(window.location.search)
			.get('userId')
			?.trim();
		if (!uid) return;
		const hit = list.find((u) => u.id === uid);
		if (hit) setPanelUser(hit as AdminDirectoryUserRow);
	}, [list, panelUser, setPanelUser]);

	const onlineOnPage = tableList.filter((u) => u.presence_online).length;
	const mismatchOnPage = tableList.filter((u) =>
		detectAdminUserChannelMismatch(u)
	).length;

	const redisFilterHintKeys = React.useMemo(
		() =>
			buildAdminUsersRedisFilterHintKeys({
				redisAvailable: payload?.redis_available,
				onlineOnly,
				anomalyOnly,
				mismatchOnly,
			}),
		[payload?.redis_available, onlineOnly, anomalyOnly, mismatchOnly]
	);

	const toggleAll = React.useCallback((): void => {
		if (selectedUserIds.length === tableList.length) {
			setSelectedUserIds([]);
		} else {
			setSelectedUserIds(tableList.map((u) => u.id));
		}
	}, [selectedUserIds.length, tableList]);

	const toggleOne = React.useCallback((id: string): void => {
		setSelectedUserIds((prev) =>
			prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
		);
	}, []);

	return {
		page,
		setPage,
		totalPages,
		payload,
		loading,
		error,
		refetchDirectory,
		invalidateDirectory,
		tableList,
		onlineOnPage,
		mismatchOnPage,
		selectedUserIds,
		setSelectedUserIds,
		toggleOne,
		toggleAll,
		mobileCatalog,
		redisFilterHintKeys,
	};
}
