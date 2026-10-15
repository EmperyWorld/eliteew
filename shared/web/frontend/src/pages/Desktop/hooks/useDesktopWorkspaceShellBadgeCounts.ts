/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Icon/taskbar badge counts, folder library counts/previews, and GAF/EWDesk/friends
 * unread totals. Not part of Desktop critical first paint.
 *
 * Invariants:
 * - Must not be statically imported from the DesktopWorkspaceContent view-model
 *   head/tail clusters; mount only via deferred extras runtime.
 *
 * Related:
 * - DesktopDeferredShellExtrasRuntime.tsx
 * - documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md
 */

import { useFriendsOverview } from '@/features/friends/hooks/useFriendsOverview';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import {
	DESKTOP_FOLDER_LIBRARY_COUNTS_INVALIDATE_EVENT,
	type DesktopFolderLibraryCountsInvalidateDetail,
} from '../../../services/unifiedContentEvents';
import { useGAFUnreadCount } from '../components/GAFChat/hooks/useGAFUnreadCount';
import { useEwDeskUnreadCount } from '../components/ewDesk/useEwDeskUnreadCount';
import { useEwDeskNewsDesktopPrefetch } from '../components/ewDesk/useEwDeskNewsDesktopPrefetch';
import type {
	DesktopFolderPreviewEntry,
	DesktopItem,
} from '../types/desktop.types';
import {
	useDesktopFolderLibraryCounts,
	invalidateDesktopFolderLibraryCounts,
} from './useDesktopFolderLibraryCounts';
import { useDesktopFolderLibraryPreviews } from './useDesktopFolderLibraryPreviews';
import {
	countNestedDesktopChildrenByFolderId,
	mergeFolderIconBadgeCounts,
	mergeFolderIconPreviewEntries,
} from '../utils/desktopFolderLibraryCounts';
import { filterFolderIconBadgeCountsForDesktop } from '../utils/desktopFolderIconBadgePolicy';

export function useDesktopWorkspaceShellBadgeCounts(params: {
	displayItems: DesktopItem[];
	/** Full desktop item list (incl. nested); used for per-folder child counts. */
	allDesktopItems: DesktopItem[];
	installedApps: DesktopItem[];
	authUserId: string | undefined;
}) {
	const { displayItems, allDesktopItems, installedApps, authUserId } = params;
	const queryClient = useQueryClient();

	useEffect(() => {
		const onInvalidate = (event: Event) => {
			const detail = (
				event as CustomEvent<DesktopFolderLibraryCountsInvalidateDetail>
			).detail;
			void invalidateDesktopFolderLibraryCounts(queryClient, detail?.folderIds);
		};
		window.addEventListener(
			DESKTOP_FOLDER_LIBRARY_COUNTS_INVALIDATE_EVENT,
			onInvalidate
		);
		return () => {
			window.removeEventListener(
				DESKTOP_FOLDER_LIBRARY_COUNTS_INVALIDATE_EVENT,
				onInvalidate
			);
		};
	}, [queryClient]);

	useEwDeskNewsDesktopPrefetch(Boolean(authUserId));
	const gafUnreadTotal = useGAFUnreadCount(Boolean(authUserId));
	const ewDeskUnreadTotal = useEwDeskUnreadCount(Boolean(authUserId));
	const friendsOverviewQuery = useFriendsOverview({ enabled: !!authUserId });
	const friendsIncomingTotal =
		friendsOverviewQuery.data?.stats.incomingRequestsCount ?? 0;

	const desktopItemBadgeCounts = useMemo(() => {
		const map: Record<string, number> = {};
		if (gafUnreadTotal > 0) {
			for (const item of displayItems) {
				if (item.type === 'app' && item.appComponent === 'GAFChatApp') {
					map[item.id] = gafUnreadTotal;
				}
			}
		}
		if (ewDeskUnreadTotal > 0) {
			for (const item of displayItems) {
				if (item.type === 'app' && item.appComponent === 'EWDeskApp') {
					map[item.id] = ewDeskUnreadTotal;
				}
			}
		}
		if (friendsIncomingTotal > 0) {
			for (const item of displayItems) {
				if (item.type === 'app' && item.appComponent === 'SocialHubApp') {
					map[item.id] = friendsIncomingTotal;
				}
			}
		}
		return map;
	}, [displayItems, ewDeskUnreadTotal, friendsIncomingTotal, gafUnreadTotal]);

	const taskbarAppBadgeCounts = useMemo(() => {
		const map: Record<string, number> = {};
		for (const app of installedApps) {
			if (app.appComponent === 'GAFChatApp' && gafUnreadTotal > 0) {
				map[app.id] = gafUnreadTotal;
			}
			if (app.appComponent === 'EWDeskApp' && ewDeskUnreadTotal > 0) {
				map[app.id] = ewDeskUnreadTotal;
			}
			if (app.appComponent === 'SocialHubApp' && friendsIncomingTotal > 0) {
				map[app.id] = friendsIncomingTotal;
			}
		}
		return map;
	}, [ewDeskUnreadTotal, friendsIncomingTotal, gafUnreadTotal, installedApps]);

	const rootFolderIds = useMemo(
		() =>
			displayItems
				.filter((item) => item.type === 'folder' && !item.parentId)
				.map((item) => item.id),
		[displayItems]
	);

	const folderLibraryCounts = useDesktopFolderLibraryCounts(
		rootFolderIds,
		Boolean(authUserId)
	);

	const folderChildCounts = useMemo(() => {
		const nested = countNestedDesktopChildrenByFolderId(allDesktopItems);
		const merged = mergeFolderIconBadgeCounts(nested, folderLibraryCounts);
		return filterFolderIconBadgeCountsForDesktop(merged, allDesktopItems);
	}, [allDesktopItems, folderLibraryCounts]);

	const nestedFolderPreviewByFolderId = useMemo(() => {
		const byParent: Record<string, DesktopItem[]> = {};
		for (const item of allDesktopItems) {
			const pid = item.parentId;
			if (!pid) continue;
			if (!byParent[pid]) byParent[pid] = [];
			byParent[pid].push(item);
		}
		const nested: Record<string, DesktopFolderPreviewEntry[]> = {};
		for (const [folderId, children] of Object.entries(byParent)) {
			const sorted = [...children].sort((a, b) =>
				(a.name || '').localeCompare(b.name || '', undefined, {
					sensitivity: 'base',
				})
			);
			const slice = sorted.slice(0, 4);
			if (slice.length === 0) continue;
			nested[folderId] = slice.map((c) => ({
				id: c.id,
				type: c.type,
				fileType: c.fileType,
				appComponent: c.appComponent,
			}));
		}
		return nested;
	}, [allDesktopItems]);

	const folderIdsNeedingLibraryPreview = useMemo(
		() =>
			rootFolderIds.filter((id) => {
				if ((nestedFolderPreviewByFolderId[id]?.length ?? 0) >= 4) {
					return false;
				}
				return (folderLibraryCounts[id] ?? 0) > 0;
			}),
		[folderLibraryCounts, nestedFolderPreviewByFolderId, rootFolderIds]
	);

	const folderLibraryPreviews = useDesktopFolderLibraryPreviews(
		folderIdsNeedingLibraryPreview,
		Boolean(authUserId)
	);

	const mergedFolderPreviewByFolderId = useMemo(() => {
		const out = { ...nestedFolderPreviewByFolderId };
		for (const [folderId, libraryEntries] of Object.entries(
			folderLibraryPreviews
		)) {
			if (libraryEntries.length === 0) continue;
			const merged = mergeFolderIconPreviewEntries(
				out[folderId] ?? [],
				libraryEntries
			);
			if (merged.length > 0) {
				out[folderId] = merged;
			}
		}
		return out;
	}, [folderLibraryPreviews, nestedFolderPreviewByFolderId]);

	return {
		desktopItemBadgeCounts,
		taskbarAppBadgeCounts,
		folderChildCounts,
		folderPreviewByFolderId: mergedFolderPreviewByFolderId,
	};
}

export type DesktopWorkspaceShellBadgeCounts = ReturnType<
	typeof useDesktopWorkspaceShellBadgeCounts
>;
