/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Hub shell state for admin Users: view tabs, detail panel, URL sync, keyboard shortcuts, external open events.
 *
 * Related:
 * - `pages/Admin/users/useAdminUsersHubController.ts`
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { AdminDirectoryUserRow } from '../adminDirectoryUserTypes';
import { type AdminUserDetailTab } from '../adminUsersDetailTab';
import { replaceAdminUsersUrl } from '../adminUsersUrlFilters';
import {
	saveLastAdminUsersFilters,
	type AdminUsersFilterSnapshot,
} from '../adminUsersFilterPresets';
import { type AdminUsersHubView } from '../adminUsersHubView';
import {
	ADMIN_USERS_OPEN_EVENT,
	type AdminUsersOpenDetail,
} from './adminUsersExternalOpen';

export type AdminUsersHubShell = {
	hubView: AdminUsersHubView;
	setHubViewAndSync: (next: AdminUsersHubView) => void;
	handleOpenUserFromPresence: (userId: string) => void;
	panelUser: AdminDirectoryUserRow | null;
	setPanelUser: React.Dispatch<
		React.SetStateAction<AdminDirectoryUserRow | null>
	>;
	openUserPanel: (u: AdminDirectoryUserRow) => void;
	closeUserPanel: () => void;
	panelDetailTab: AdminUserDetailTab;
	handleDetailTabChange: (tab: AdminUserDetailTab) => void;
	handleCopyShareLink: () => void;
};

type UseAdminUsersHubShellOptions = {
	initialView: AdminUsersHubView;
	initialPanelDetailTab: AdminUserDetailTab;
	page: number;
	setPage: React.Dispatch<React.SetStateAction<number>>;
	currentFilterSnapshot: AdminUsersFilterSnapshot;
	debouncedSearch: string;
	setSearch: React.Dispatch<React.SetStateAction<string>>;
	searchInputRef: React.RefObject<HTMLInputElement | null>;
};

export function useAdminUsersHubShell(
	options: UseAdminUsersHubShellOptions
): AdminUsersHubShell {
	const {
		initialView,
		initialPanelDetailTab,
		page,
		setPage,
		currentFilterSnapshot,
		debouncedSearch,
		setSearch,
		searchInputRef,
	} = options;

	const { t } = useTranslation('desktopUi');
	const [hubView, setHubView] = React.useState<AdminUsersHubView>(initialView);
	const [panelUser, setPanelUser] =
		React.useState<AdminDirectoryUserRow | null>(null);
	const [panelDetailTab, setPanelDetailTab] =
		React.useState<AdminUserDetailTab>(initialPanelDetailTab);

	React.useEffect(() => {
		const timer = window.setTimeout(() => {
			const snapshot = {
				...currentFilterSnapshot,
				search: debouncedSearch,
			};
			saveLastAdminUsersFilters(snapshot);
			replaceAdminUsersUrl(snapshot, {
				page,
				userId: panelUser?.id ?? null,
				view: hubView,
				userTab: panelUser ? panelDetailTab : null,
			});
		}, 400);
		return () => window.clearTimeout(timer);
	}, [
		currentFilterSnapshot,
		debouncedSearch,
		page,
		panelUser,
		hubView,
		panelDetailTab,
	]);

	const setHubViewAndSync = React.useCallback(
		(next: AdminUsersHubView) => {
			setHubView(next);
			replaceAdminUsersUrl(
				{ ...currentFilterSnapshot, search: debouncedSearch },
				{ page, userId: panelUser?.id ?? null, view: next }
			);
		},
		[currentFilterSnapshot, debouncedSearch, page, panelUser?.id]
	);

	const handleOpenUserFromPresence = React.useCallback(
		(userId: string) => {
			const uid = userId.trim();
			if (!uid) return;
			setHubView('catalog');
			setSearch(uid);
			setPage(1);
			replaceAdminUsersUrl(
				{ ...currentFilterSnapshot, search: uid },
				{ page: 1, userId: uid, view: 'catalog' }
			);
		},
		[currentFilterSnapshot, setSearch, setPage]
	);

	const openUserPanel = React.useCallback((u: AdminDirectoryUserRow) => {
		setPanelUser(u);
		setPanelDetailTab('overview');
	}, []);

	const closeUserPanel = React.useCallback(() => {
		setPanelUser(null);
		setPanelDetailTab('overview');
		replaceAdminUsersUrl(
			{ ...currentFilterSnapshot, search: debouncedSearch },
			{
				page,
				userId: null,
				view: hubView,
				userTab: null,
			}
		);
	}, [currentFilterSnapshot, debouncedSearch, page, hubView]);

	const handleDetailTabChange = React.useCallback(
		(tab: AdminUserDetailTab) => {
			setPanelDetailTab(tab);
			if (!panelUser) return;
			replaceAdminUsersUrl(
				{ ...currentFilterSnapshot, search: debouncedSearch },
				{
					page,
					userId: panelUser.id,
					view: hubView,
					userTab: tab,
				}
			);
		},
		[currentFilterSnapshot, debouncedSearch, page, hubView, panelUser]
	);

	React.useEffect(() => {
		const handler = (ev: Event): void => {
			const detail = (ev as CustomEvent<AdminUsersOpenDetail>).detail;
			if (!detail?.search && !detail?.userId) return;
			setHubView('catalog');
			if (typeof detail.search === 'string') {
				setSearch(detail.search);
			}
			setPage(1);
			if (detail.userId) {
				replaceAdminUsersUrl(
					{
						...currentFilterSnapshot,
						search:
							typeof detail.search === 'string'
								? detail.search
								: currentFilterSnapshot.search,
					},
					{ page: 1, userId: detail.userId, view: 'catalog' }
				);
			}
		};
		window.addEventListener(ADMIN_USERS_OPEN_EVENT, handler);
		return () => window.removeEventListener(ADMIN_USERS_OPEN_EVENT, handler);
	}, [currentFilterSnapshot, setSearch, setPage]);

	const handleCopyShareLink = React.useCallback((): void => {
		try {
			replaceAdminUsersUrl(
				{ ...currentFilterSnapshot, search: debouncedSearch },
				{
					page,
					userId: panelUser?.id ?? null,
					view: hubView,
					userTab: panelUser ? panelDetailTab : null,
				}
			);
			void navigator.clipboard
				.writeText(window.location.href)
				.then(() =>
					toast.success(t('adminUsersHub.hubActions.shareLinkCopied'))
				)
				.catch(() => toast.error(t('adminUsersHub.clipboard.failed')));
		} catch {
			toast.error(t('adminUsersHub.clipboard.failed'));
		}
	}, [
		currentFilterSnapshot,
		debouncedSearch,
		page,
		panelUser,
		panelDetailTab,
		hubView,
		t,
	]);

	React.useEffect(() => {
		if (hubView !== 'catalog' || typeof window === 'undefined') return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && panelUser) {
				e.preventDefault();
				closeUserPanel();
				return;
			}
			if (
				e.key === '/' &&
				!e.ctrlKey &&
				!e.metaKey &&
				!e.altKey &&
				document.activeElement?.tagName !== 'INPUT' &&
				document.activeElement?.tagName !== 'TEXTAREA' &&
				document.activeElement?.tagName !== 'SELECT'
			) {
				e.preventDefault();
				searchInputRef.current?.focus();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [hubView, panelUser, closeUserPanel, searchInputRef]);

	return {
		hubView,
		setHubViewAndSync,
		handleOpenUserFromPresence,
		panelUser,
		setPanelUser,
		openUserPanel,
		closeUserPanel,
		panelDetailTab,
		handleDetailTabChange,
		handleCopyShareLink,
	};
}
