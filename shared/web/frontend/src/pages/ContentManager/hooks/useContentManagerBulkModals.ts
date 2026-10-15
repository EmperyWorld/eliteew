/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owns copy and bulk-move modal state plus their Content Manager mutation handlers.
 *
 * Invariants:
 * - Batch delete remains owned by useContentManagerSelection.
 * - Batch copy names are collision-safe within the selected batch.
 *
 * Related:
 * - ContentManagerPro.tsx
 * - utils/contentManagerCopyName.ts
 * - utils/contentManagerFolderScopePatch.ts
 */
import { useCallback, useState } from 'react';
import type { TFunction } from 'i18next';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { notify } from '../../../notifications';
import { contentApi } from '../../../services/contentApi';
import { requestDesktopFolderLibraryCountsInvalidate } from '../../../services/unifiedContentEvents';
import { getApiErrorMessage } from '../../../utils/apiError';
import { logUxError } from '../../../utils/logger';
import { collectFolderIdsForLibraryMutation } from '../../Desktop/utils/desktopFolderLibraryCounts';
import type { TenancyProject } from './useTenancyOptions';
import { buildCopyNameForItem } from '../utils/contentManagerCopyName';
import { contentManagerDisplayLabel } from '../utils/contentManagerTextLike';
import { buildContentMoveScopePatch } from '../utils/contentManagerFolderScopePatch';
import { getContentRecoveryHint } from '../utils/contentManagerProRecovery';

export type UseContentManagerBulkModalsOptions = {
	t: TFunction<'contentManager'>;
	items: ContentItem[];
	filteredItems: ContentItem[];
	projects: TenancyProject[];
	selectedIds: ReadonlySet<string>;
	setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
	batchCopyLoading: boolean;
	setBatchCopyLoading: React.Dispatch<React.SetStateAction<boolean>>;
	setError: (message: string | null) => void;
	setSuccess: (message: string | null) => void;
	fetchContent: () => void | Promise<void>;
	fetchManagerActivity: () => void | Promise<void>;
};

export function useContentManagerBulkModals({
	t,
	items,
	filteredItems,
	projects,
	selectedIds,
	setSelectedIds,
	batchCopyLoading,
	setBatchCopyLoading,
	setError,
	setSuccess,
	fetchContent,
	fetchManagerActivity,
}: UseContentManagerBulkModalsOptions) {
	const [copyModalOpen, setCopyModalOpen] = useState(false);
	const [copyTargetItem, setCopyTargetItem] = useState<ContentItem | null>(
		null
	);
	const [copyLoading, setCopyLoading] = useState(false);
	const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
	const [bulkMoveLoading, setBulkMoveLoading] = useState(false);

	const openCopyFile = useCallback((item: ContentItem) => {
		setCopyTargetItem(item);
		setCopyModalOpen(true);
	}, []);
	const closeCopyFile = useCallback(() => {
		if (copyLoading) return;
		setCopyModalOpen(false);
		setCopyTargetItem(null);
	}, [copyLoading]);

	const confirmCopyFile = useCallback(
		async (name: string) => {
			if (!copyTargetItem) return;
			setCopyLoading(true);
			try {
				const created = await contentApi.copyContent(copyTargetItem.id, name);
				setCopyModalOpen(false);
				setCopyTargetItem(null);
				setSuccess(
					t('pro.copy.toastOk', {
						name: contentManagerDisplayLabel(created),
					})
				);
				setTimeout(() => setSuccess(null), 2500);
				await fetchContent();
				void fetchManagerActivity();
				requestDesktopFolderLibraryCountsInvalidate({
					folderIds: collectFolderIdsForLibraryMutation(
						items,
						[copyTargetItem.id],
						created.folder_item_id ?? null
					),
				});
			} catch (error) {
				const message = getApiErrorMessage(error);
				const hint = getContentRecoveryHint('update', error, t);
				logUxError(
					'useContentManagerBulkModals',
					'unified_content',
					'copy',
					error instanceof Error ? error : undefined,
					{ message, hint }
				);
				notify.error(t('pro.copy.notifyFailedTitle'), `${message}. ${hint}`, {
					duration: 6000,
				});
				throw error instanceof Error ? error : new Error(message);
			} finally {
				setCopyLoading(false);
			}
		},
		[copyTargetItem, fetchContent, fetchManagerActivity, items, setSuccess, t]
	);

	const batchCopyFiles = useCallback(async () => {
		if (selectedIds.size === 0 || batchCopyLoading) return;
		setBatchCopyLoading(true);
		try {
			const selectedItems = filteredItems.filter((item) =>
				selectedIds.has(item.id)
			);
			const reserved = new Set<string>();
			const copyJobs = selectedItems.map((item) => {
				const name = buildCopyNameForItem(item, t('pro.copy.prefix'), reserved);
				reserved.add(name);
				return { id: item.id, name };
			});
			const results = await Promise.allSettled(
				copyJobs.map((job) => contentApi.copyContent(job.id, job.name))
			);
			const failed = results.filter(
				(result) => result.status === 'rejected'
			).length;
			const succeeded = results.length - failed;
			if (succeeded === 0) throw new Error(t('errors.batchNoneCopied'));
			setSuccess(
				failed > 0
					? t('pro.copy.toastBatchPartial', { ok: succeeded, failed })
					: t('pro.copy.toastBatchOk', { count: succeeded })
			);
			setTimeout(() => setSuccess(null), 2500);
			await fetchContent();
			void fetchManagerActivity();
			requestDesktopFolderLibraryCountsInvalidate({
				folderIds: collectFolderIdsForLibraryMutation(
					items,
					selectedItems.map((item) => item.id),
					null
				),
			});
		} catch (error) {
			const message = getApiErrorMessage(error);
			const hint = getContentRecoveryHint('batch', error, t);
			logUxError(
				'useContentManagerBulkModals',
				'unified_content',
				'batch_copy',
				error instanceof Error ? error : undefined,
				{ message, hint }
			);
			notify.error(
				t('pro.copy.notifyBatchFailedTitle'),
				`${message}. ${hint}`,
				{ duration: 6000 }
			);
		} finally {
			setBatchCopyLoading(false);
		}
	}, [
		batchCopyLoading,
		fetchContent,
		fetchManagerActivity,
		filteredItems,
		items,
		selectedIds,
		setBatchCopyLoading,
		setSuccess,
		t,
	]);

	const requestMoveFile = useCallback(
		(id: string) => {
			setSelectedIds(new Set([id]));
			setBulkMoveOpen(true);
		},
		[setSelectedIds]
	);
	const closeBulkMove = useCallback(() => {
		if (!bulkMoveLoading) setBulkMoveOpen(false);
	}, [bulkMoveLoading]);

	const executeBulkMove = useCallback(
		async (targetFolderItemId: string | null) => {
			if (selectedIds.size === 0) return;
			setBulkMoveLoading(true);
			try {
				const patch = buildContentMoveScopePatch(targetFolderItemId, projects);
				const ids = Array.from(selectedIds);
				const results = await Promise.allSettled(
					ids.map((id) => contentApi.updateContent(id, patch))
				);
				const failed = results.filter(
					(result) => result.status === 'rejected'
				).length;
				if (failed === ids.length) {
					throw new Error(t('pro.bulkMove.allFailed'));
				}
				setBulkMoveOpen(false);
				setSuccess(
					failed > 0
						? t('pro.bulkMove.partial', { ok: ids.length - failed, failed })
						: t('pro.bulkMove.ok', { count: ids.length })
				);
				setTimeout(() => setSuccess(null), 2500);
				setSelectedIds(new Set());
				await fetchContent();
				void fetchManagerActivity();
				requestDesktopFolderLibraryCountsInvalidate({
					folderIds: collectFolderIdsForLibraryMutation(
						items,
						ids,
						targetFolderItemId
					),
				});
			} catch (error) {
				const message = getApiErrorMessage(error);
				setError(message);
				notify.error(t('pro.bulkMove.failed'), message, { duration: 6000 });
			} finally {
				setBulkMoveLoading(false);
			}
		},
		[
			fetchContent,
			fetchManagerActivity,
			items,
			projects,
			selectedIds,
			setError,
			setSelectedIds,
			setSuccess,
			t,
		]
	);

	return {
		copyModalOpen,
		copyTargetItem,
		copyLoading,
		openCopyFile,
		closeCopyFile,
		confirmCopyFile,
		batchCopyFiles,
		bulkMoveOpen,
		setBulkMoveOpen,
		bulkMoveLoading,
		requestMoveFile,
		closeBulkMove,
		executeBulkMove,
	};
}
