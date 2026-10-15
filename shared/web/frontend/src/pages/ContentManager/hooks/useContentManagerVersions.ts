/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owns selected-content details and version history workflows for Content Manager tabs.
 *
 * Invariants:
 * - Version restore refreshes list, stats, selected details, and both version collections.
 *
 * Related:
 * - ContentManagerPro.tsx
 * - UnifiedContent/components/tabs/VersionsTab.tsx
 */
import { useCallback, useEffect, useState } from 'react';
import type { TFunction } from 'i18next';
import type {
	Content as ContentItem,
	Version,
} from '../../../components/UnifiedContent/types';
import { contentApi } from '../../../services/contentApi';
import { getApiErrorMessage } from '../../../utils/apiError';
import type { ContentManagerTab } from '../contentManagerTypes';

export function useContentManagerVersions({
	t,
	activeTab,
	selectedContentId,
	setSelectedIds,
	setPreviewItem,
	fetchContent,
	fetchStats,
	setError,
	setSuccess,
}: {
	t: TFunction<'contentManager'>;
	activeTab: ContentManagerTab;
	selectedContentId: string | null;
	setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
	setPreviewItem: React.Dispatch<React.SetStateAction<ContentItem | null>>;
	fetchContent: () => void | Promise<void>;
	fetchStats: () => void | Promise<void>;
	setError: (message: string | null) => void;
	setSuccess: (message: string | null) => void;
}) {
	const [versions, setVersions] = useState<Version[]>([]);
	const [versionsLoading, setVersionsLoading] = useState(false);
	const [multiVersionItems, setMultiVersionItems] = useState<ContentItem[]>([]);
	const [multiVersionLoading, setMultiVersionLoading] = useState(false);
	const [selectedContentDetails, setSelectedContentDetails] =
		useState<ContentItem | null>(null);
	const [selectedContentLoading, setSelectedContentLoading] = useState(false);
	const [versionRestorePending, setVersionRestorePending] = useState<{
		contentId: string;
		versionNumber: number;
	} | null>(null);

	const fetchSelectedContentDetails = useCallback(async (contentId: string) => {
		setSelectedContentLoading(true);
		try {
			const response = await contentApi.getContent(contentId);
			setSelectedContentDetails(response);
			return response;
		} finally {
			setSelectedContentLoading(false);
		}
	}, []);
	const fetchVersionsForContent = useCallback(async (contentId: string) => {
		setVersionsLoading(true);
		try {
			setVersions(await contentApi.listVersions(contentId));
		} catch {
			setVersions([]);
		} finally {
			setVersionsLoading(false);
		}
	}, []);
	const fetchMultiVersionFiles = useCallback(async () => {
		setMultiVersionLoading(true);
		try {
			const response = await contentApi.listContentMultiVersion({
				offset: 0,
				limit: 200,
			});
			setMultiVersionItems(response.items);
		} catch {
			setMultiVersionItems([]);
		} finally {
			setMultiVersionLoading(false);
		}
	}, []);
	const clearSelectedDetails = useCallback(() => {
		setSelectedContentDetails(null);
		setVersions([]);
	}, []);
	const selectContentForVersionsTab = useCallback(
		(contentId: string) => {
			setSelectedIds(new Set([contentId]));
			setPreviewItem(null);
		},
		[setPreviewItem, setSelectedIds]
	);
	const handleVersionDownload = useCallback(
		async (versionId: string, versionNumber: number, name: string) => {
			try {
				await contentApi.downloadVersion(
					versionId,
					`${name}_v${versionNumber}`
				);
			} catch (error) {
				setError(getApiErrorMessage(error));
			}
		},
		[setError]
	);
	const handleVersionRestore = useCallback(
		(contentId: string, versionNumber: number) => {
			setVersionRestorePending({ contentId, versionNumber });
		},
		[]
	);
	const executeVersionRestore = useCallback(async () => {
		if (!versionRestorePending) return;
		const { contentId, versionNumber } = versionRestorePending;
		try {
			await contentApi.revertVersion(contentId, versionNumber, {
				change_description: `Reverted from Content Manager to version ${versionNumber}`,
			});
			setVersionRestorePending(null);
			setSuccess(t('pro.toast.versionRestored', { n: versionNumber }));
			setTimeout(() => setSuccess(null), 2500);
			await Promise.all([
				fetchContent(),
				fetchStats(),
				fetchSelectedContentDetails(contentId),
				fetchVersionsForContent(contentId),
				fetchMultiVersionFiles(),
			]);
		} catch (error) {
			setError(getApiErrorMessage(error));
			throw error instanceof Error
				? error
				: new Error(getApiErrorMessage(error));
		}
	}, [
		fetchContent,
		fetchMultiVersionFiles,
		fetchSelectedContentDetails,
		fetchStats,
		fetchVersionsForContent,
		setError,
		setSuccess,
		t,
		versionRestorePending,
	]);

	useEffect(() => {
		if (activeTab === 'versions') void fetchMultiVersionFiles();
	}, [activeTab, fetchMultiVersionFiles]);
	useEffect(() => {
		if (!selectedContentId) {
			clearSelectedDetails();
			return;
		}
		if (activeTab === 'versions' || activeTab === 'comments') {
			void fetchSelectedContentDetails(selectedContentId);
		}
	}, [
		activeTab,
		clearSelectedDetails,
		fetchSelectedContentDetails,
		selectedContentId,
	]);
	useEffect(() => {
		if (activeTab === 'versions' && selectedContentId) {
			void fetchVersionsForContent(selectedContentId);
		} else if (activeTab !== 'versions') {
			setVersions([]);
		}
	}, [activeTab, fetchVersionsForContent, selectedContentId]);

	return {
		versions,
		versionsLoading,
		multiVersionItems,
		multiVersionLoading,
		selectedContentDetails,
		selectedContentLoading,
		setSelectedContentDetails,
		setVersions,
		fetchSelectedContentDetails,
		selectContentForVersionsTab,
		handleVersionDownload,
		handleVersionRestore,
		versionRestorePending,
		setVersionRestorePending,
		executeVersionRestore,
		clearSelectedDetails,
	};
}
