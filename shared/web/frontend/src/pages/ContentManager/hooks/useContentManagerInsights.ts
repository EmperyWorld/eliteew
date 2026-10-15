/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owns Content Manager stats, activity, view history, tags, sharing, and current-user supporting data.
 *
 * Invariants:
 * - Tab activation refreshes only the data required by that tab.
 * - View recording is best-effort and never blocks opening a file.
 *
 * Related:
 * - ContentManagerPro.tsx
 * - components/ContentManagerStatsTab.tsx
 */
import { useCallback, useEffect, useState } from 'react';
import type { TFunction } from 'i18next';
import type { Activity } from '../../../components/UnifiedContent/hooks/useActivityLog';
import type {
	Content as ContentItem,
	ContentStats,
	ShareResponse,
} from '../../../components/UnifiedContent/types';
import {
	contentApi,
	type ContentViewHistoryApiItem,
} from '../../../services/contentApi';
import { log } from '../../../utils/logger';
import type { ContentManagerTab } from '../contentManagerTypes';
import { useContentManagerQuota } from './useContentManagerQuota';
import { mapManagerActivityRow } from '../utils/mapManagerActivity';

export function useContentManagerInsights({
	t,
	activeTab,
	fetchContent,
}: {
	t: TFunction<'contentManager'>;
	activeTab: ContentManagerTab;
	fetchContent: () => void | Promise<void>;
}) {
	const [stats, setStats] = useState<ContentStats | null>(null);
	const [statsLoading, setStatsLoading] = useState(true);
	const {
		quotaBytesUsed,
		quotaBytesLimit,
		quotaLoading,
		quotaError,
		fetchQuota,
	} = useContentManagerQuota();
	const [managerActivities, setManagerActivities] = useState<Activity[]>([]);
	const [managerActivityLoading, setManagerActivityLoading] = useState(false);
	const [viewHistoryEntries, setViewHistoryEntries] = useState<
		ContentViewHistoryApiItem[]
	>([]);
	const [viewHistoryLoading, setViewHistoryLoading] = useState(false);
	const [popularTags, setPopularTags] = useState<
		Array<{ tag: string; count: number }>
	>([]);
	const [sharedContents, setSharedContents] = useState<ShareResponse[]>([]);
	const [sharedLoading, setSharedLoading] = useState(false);
	const [currentContentUserId, setCurrentContentUserId] = useState('');

	const fetchManagerActivity = useCallback(async () => {
		setManagerActivityLoading(true);
		try {
			const response = await contentApi.getManagerActivity(50);
			setManagerActivities(
				response.items.map((row) => mapManagerActivityRow(row, t))
			);
		} catch {
			setManagerActivities([]);
		} finally {
			setManagerActivityLoading(false);
		}
	}, [t]);
	const fetchStats = useCallback(async () => {
		setStatsLoading(true);
		try {
			const [response] = await Promise.all([
				contentApi.getStats(),
				fetchQuota({ silent: true }),
			]);
			setStats(response);
		} catch (error) {
			log.warn(
				'useContentManagerInsights',
				`fetchStats: ${error instanceof Error ? error.message : String(error)}`
			);
		} finally {
			setStatsLoading(false);
		}
	}, [fetchQuota]);
	const fetchViewHistory = useCallback(async () => {
		setViewHistoryLoading(true);
		try {
			const response = await contentApi.getViewHistory(50);
			setViewHistoryEntries(response.items);
		} catch {
			setViewHistoryEntries([]);
		} finally {
			setViewHistoryLoading(false);
		}
	}, []);
	const registerView = useCallback(
		async (content: ContentItem) => {
			if (!content.id) return;
			try {
				await contentApi.recordContentView(content.id);
			} catch {
				// View history is enrichment; opening the file must remain available.
			}
			void fetchViewHistory();
		},
		[fetchViewHistory]
	);
	const clearViewHistoryDb = useCallback(async () => {
		try {
			await contentApi.clearViewHistory();
			setViewHistoryEntries([]);
		} catch {
			// Clearing history is non-critical and the existing rows remain visible.
		}
	}, []);
	const fetchTags = useCallback(async () => {
		try {
			setPopularTags(await contentApi.getPopularTags(20));
		} catch (error) {
			log.warn(
				'useContentManagerInsights',
				`fetchTags: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}, []);
	const fetchSharedContents = useCallback(async () => {
		setSharedLoading(true);
		try {
			setSharedContents(await contentApi.listReceivedShares());
		} catch {
			setSharedContents([]);
		} finally {
			setSharedLoading(false);
		}
	}, []);
	const fetchCurrentContentUserId = useCallback(async () => {
		try {
			setCurrentContentUserId(await contentApi.getCurrentUserId());
		} catch {
			setCurrentContentUserId('');
		}
	}, []);

	useEffect(() => {
		void fetchStats();
		void fetchTags();
		void fetchManagerActivity();
		void fetchViewHistory();
	}, [fetchManagerActivity, fetchStats, fetchTags, fetchViewHistory]);
	useEffect(() => {
		if (activeTab === 'stats') {
			void fetchStats();
			void fetchManagerActivity();
			void fetchViewHistory();
		}
		if (activeTab === 'shared') void fetchSharedContents();
		if (activeTab === 'comments' && !currentContentUserId) {
			void fetchCurrentContentUserId();
		}
	}, [
		activeTab,
		currentContentUserId,
		fetchCurrentContentUserId,
		fetchManagerActivity,
		fetchSharedContents,
		fetchStats,
		fetchViewHistory,
	]);

	const handleDuplicateFinderChange = useCallback(() => {
		void Promise.all([fetchContent(), fetchStats()]).then(() => undefined);
	}, [fetchContent, fetchStats]);
	const handleBrokenFilesChange = useCallback(() => {
		void Promise.all([fetchContent(), fetchStats()]).then(() => undefined);
	}, [fetchContent, fetchStats]);
	const handleSharedContentsRefresh = useCallback(() => {
		void fetchSharedContents();
	}, [fetchSharedContents]);

	return {
		stats,
		statsLoading,
		quotaBytesUsed,
		quotaBytesLimit,
		quotaLoading,
		quotaError,
		fetchQuota,
		managerActivities,
		managerActivityLoading,
		viewHistoryEntries,
		viewHistoryLoading,
		popularTags,
		sharedContents,
		sharedLoading,
		currentContentUserId,
		fetchManagerActivity,
		fetchStats,
		registerView,
		clearViewHistoryDb,
		handleDuplicateFinderChange,
		handleBrokenFilesChange,
		handleSharedContentsRefresh,
	};
}
