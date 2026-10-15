/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Additive Desktop extras that must not sit in the critical workspace view-model:
 * badges, folder library previews, widgets panel props, server recent-content feed.
 *
 * Invariants:
 * - Empty defaults are stable references so first paint does not thrash.
 * - Critical shell stays usable with these zeros/empties.
 *
 * Related:
 * - DesktopDeferredShellExtrasContext.tsx
 * - documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md
 */

import type { DesktopWidgetsPanelProps } from '../components/DesktopWidgetsPanel';
import type {
	DesktopFolderPreviewEntry,
	RecentFile,
} from '../types/desktop.types';

export type DesktopDeferredShellExtras = {
	desktopItemBadgeCounts: Record<string, number>;
	taskbarAppBadgeCounts: Record<string, number>;
	folderChildCounts: Record<string, number>;
	folderPreviewByFolderId: Record<string, DesktopFolderPreviewEntry[]>;
	desktopWidgetsPanelProps: DesktopWidgetsPanelProps | null;
	recentLibraryOpened: RecentFile[];
	recentLibraryAdded: RecentFile[];
	recentLibraryGenerated: RecentFile[];
	recentLibraryUploaded: RecentFile[];
	recentLibraryProjects: RecentFile[];
	recentContentFeedLoading: boolean;
	recentContentFeedError: string | null;
	recentContentFeedLoadedAt: number | null;
	hasRecentContentFeedItems: boolean;
	refetchRecentContentFeed: () => void | Promise<void>;
	desktopUnreadCount: number;
	markAllAsRead: () => void;
};

const EMPTY_BADGE_COUNTS: Record<string, number> = {};
const EMPTY_FOLDER_PREVIEWS: Record<string, DesktopFolderPreviewEntry[]> = {};
const EMPTY_RECENT_FILES: RecentFile[] = [];
const NOOP_REFETCH = (): void => {};
const NOOP_MARK_ALL_READ = (): void => {};

export const deferredRecentContentFeedRefetchRef: {
	current: () => void | Promise<void>;
} = {
	current: NOOP_REFETCH,
};

export const EMPTY_DESKTOP_DEFERRED_SHELL_EXTRAS: DesktopDeferredShellExtras = {
	desktopItemBadgeCounts: EMPTY_BADGE_COUNTS,
	taskbarAppBadgeCounts: EMPTY_BADGE_COUNTS,
	folderChildCounts: EMPTY_BADGE_COUNTS,
	folderPreviewByFolderId: EMPTY_FOLDER_PREVIEWS,
	desktopWidgetsPanelProps: null,
	recentLibraryOpened: EMPTY_RECENT_FILES,
	recentLibraryAdded: EMPTY_RECENT_FILES,
	recentLibraryGenerated: EMPTY_RECENT_FILES,
	recentLibraryUploaded: EMPTY_RECENT_FILES,
	recentLibraryProjects: EMPTY_RECENT_FILES,
	recentContentFeedLoading: false,
	recentContentFeedError: null,
	recentContentFeedLoadedAt: null,
	hasRecentContentFeedItems: false,
	refetchRecentContentFeed: NOOP_REFETCH,
	desktopUnreadCount: 0,
	markAllAsRead: NOOP_MARK_ALL_READ,
};

export function desktopDeferredShellExtrasEqual(
	left: DesktopDeferredShellExtras,
	right: DesktopDeferredShellExtras
): boolean {
	return (
		left.desktopItemBadgeCounts === right.desktopItemBadgeCounts &&
		left.taskbarAppBadgeCounts === right.taskbarAppBadgeCounts &&
		left.folderChildCounts === right.folderChildCounts &&
		left.folderPreviewByFolderId === right.folderPreviewByFolderId &&
		left.desktopWidgetsPanelProps === right.desktopWidgetsPanelProps &&
		left.recentLibraryOpened === right.recentLibraryOpened &&
		left.recentLibraryAdded === right.recentLibraryAdded &&
		left.recentLibraryGenerated === right.recentLibraryGenerated &&
		left.recentLibraryUploaded === right.recentLibraryUploaded &&
		left.recentLibraryProjects === right.recentLibraryProjects &&
		left.recentContentFeedLoading === right.recentContentFeedLoading &&
		left.recentContentFeedError === right.recentContentFeedError &&
		left.recentContentFeedLoadedAt === right.recentContentFeedLoadedAt &&
		left.hasRecentContentFeedItems === right.hasRecentContentFeedItems &&
		left.refetchRecentContentFeed === right.refetchRecentContentFeed &&
		left.desktopUnreadCount === right.desktopUnreadCount &&
		left.markAllAsRead === right.markAllAsRead
	);
}
