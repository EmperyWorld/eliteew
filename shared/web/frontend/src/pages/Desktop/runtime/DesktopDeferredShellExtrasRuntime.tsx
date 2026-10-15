/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Deferred Desktop extras engine: badge/unread graphs, widgets panel props, and
 * server recent-content feed. Renders nothing; writes into extras context.
 *
 * Invariants:
 * - Mounted only after `deferredRuntimeReady`.
 * - Must not remount critical shell; context updates are additive.
 *
 * Related:
 * - DesktopDeferredShellExtrasContext.tsx
 * - documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md
 */

import { memo, useLayoutEffect } from 'react';
import { useNotificationStore } from '@/notifications/context';
import { useDesktopDeferredExpansion } from '../context/DesktopDeferredExpansionContext';
import { useSetDesktopDeferredShellExtras } from '../context/DesktopDeferredShellExtrasContext';
import { useDesktopRecentContentFeed } from '../hooks/useDesktopRecentContentFeed';
import { useDesktopWorkspaceShellBadgeCounts } from '../hooks/useDesktopWorkspaceShellBadgeCounts';
import { useDesktopWorkspaceWidgetsPanelProps } from '../hooks/useDesktopWorkspaceWidgetsPanelProps';
import {
	EMPTY_DESKTOP_DEFERRED_SHELL_EXTRAS,
	deferredRecentContentFeedRefetchRef,
	desktopDeferredShellExtrasEqual,
} from './desktopDeferredShellExtras';
import type { DesktopDeferredShellExtrasInput } from './desktopDeferredShellExtrasInput';

function DesktopDeferredShellExtrasRuntimeInner(
	input: DesktopDeferredShellExtrasInput
): null {
	const setExtras = useSetDesktopDeferredShellExtras();
	const expansionSettings = useDesktopDeferredExpansion();
	const { unreadCount: desktopUnreadCount, markAllAsRead } =
		useNotificationStore();
	const badges = useDesktopWorkspaceShellBadgeCounts({
		displayItems: input.displayItems,
		allDesktopItems: input.allDesktopItems,
		installedApps: input.installedApps,
		authUserId: input.authUserId,
	});
	const feed = useDesktopRecentContentFeed();
	const { desktopWidgetsPanelProps } = useDesktopWorkspaceWidgetsPanelProps({
		isMobile: input.isMobile,
		config: input.config,
		expansionSettings: {
			widgetsLayout: expansionSettings.widgetsLayout,
			workspaceProfiles: expansionSettings.workspaceProfiles,
			appCollections: expansionSettings.appCollections,
			contentShortcuts: expansionSettings.contentShortcuts,
			setWidgetsPanelOffset: expansionSettings.setWidgetsPanelOffset,
			setWidgetSlotPosition: expansionSettings.setWidgetSlotPosition,
			nudgeAllWidgetSlotPositions: expansionSettings.nudgeAllWidgetSlotPositions,
			ensureFreeWidgetSlotPositions: expansionSettings.ensureFreeWidgetSlotPositions,
		},
		activeDesktopId: input.activeDesktopId,
		desktopWidgetsStyle: input.desktopWidgetsStyle,
		recentLibraryOpened: feed.recentLibraryOpened,
		desktopUnreadCount,
		markAllAsRead,
		bumpNotificationCenterOpen: input.bumpNotificationCenterOpen,
		openDesktopAppByComponent: input.openDesktopAppByComponent,
		openContentShortcut: input.openContentShortcut,
		openAppCollection: input.openAppCollection,
		openRecentDesktopFile: input.openRecentDesktopFile,
	});

	useLayoutEffect(() => {
		deferredRecentContentFeedRefetchRef.current = feed.refetch;
		const next = {
			desktopItemBadgeCounts: badges.desktopItemBadgeCounts,
			taskbarAppBadgeCounts: badges.taskbarAppBadgeCounts,
			folderChildCounts: badges.folderChildCounts,
			folderPreviewByFolderId: badges.folderPreviewByFolderId,
			desktopWidgetsPanelProps,
			recentLibraryOpened: feed.recentLibraryOpened,
			recentLibraryAdded: feed.recentLibraryAdded,
			recentLibraryGenerated: feed.recentLibraryGenerated,
			recentLibraryUploaded: feed.recentLibraryUploaded,
			recentLibraryProjects: feed.recentLibraryProjects,
			recentContentFeedLoading: feed.isLoading,
			recentContentFeedError: feed.error,
			recentContentFeedLoadedAt: feed.lastLoadedAt,
			hasRecentContentFeedItems: feed.hasRecentContentFeedItems,
			refetchRecentContentFeed: feed.refetch,
			desktopUnreadCount,
			markAllAsRead,
		};
		setExtras((prev) =>
			desktopDeferredShellExtrasEqual(prev, next) ? prev : next
		);
		return () => {
			deferredRecentContentFeedRefetchRef.current =
				EMPTY_DESKTOP_DEFERRED_SHELL_EXTRAS.refetchRecentContentFeed;
			setExtras(EMPTY_DESKTOP_DEFERRED_SHELL_EXTRAS);
		};
	}, [
		badges.desktopItemBadgeCounts,
		badges.folderChildCounts,
		badges.folderPreviewByFolderId,
		badges.taskbarAppBadgeCounts,
		desktopWidgetsPanelProps,
		feed.error,
		feed.hasRecentContentFeedItems,
		feed.isLoading,
		feed.lastLoadedAt,
		feed.recentLibraryAdded,
		feed.recentLibraryGenerated,
		feed.recentLibraryOpened,
		feed.recentLibraryProjects,
		feed.recentLibraryUploaded,
		feed.refetch,
		desktopUnreadCount,
		markAllAsRead,
		setExtras,
	]);

	return null;
}

export const DesktopDeferredShellExtrasRuntime = memo(
	DesktopDeferredShellExtrasRuntimeInner
);
