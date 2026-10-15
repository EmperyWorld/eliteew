/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Multi-select state and bulk actions for Content Manager files tab.
 *
 * Invariants:
 * - Bulk actions operate only on explicitly selected ids; scope copy comes from contentManagerListUx.
 * - Selection clears after successful batch delete.
 *
 * Related:
 * - ContentManagerPro.tsx, contentApi.ts, contentManagerListUx.ts
 */
import { useCallback, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { notify } from '../../../notifications';
import { contentApi } from '../../../services/contentApi';
import { requestDesktopFolderLibraryCountsInvalidate } from '../../../services/unifiedContentEvents';
import { getApiErrorMessage } from '../../../utils/apiError';
import { logUxError } from '../../../utils/logger';
import { collectFolderIdsForLibraryMutation } from '../../Desktop/utils/desktopFolderLibraryCounts';
import { getContentRecoveryHint } from '../utils/contentManagerProRecovery';
import { partitionSelectedByDeleteEligibility } from '../utils/contentManagerBulkEligibility';
import { resolveContentManagerSelectionCopy } from '../utils/contentManagerListUx';
import type { FilesBrowseMode, GroupBy } from '../contentManagerTypes';

export type UseContentManagerSelectionOptions = {
	t: TFunction<'contentManager'>;
	filteredItems: ContentItem[];
	items: ContentItem[];
	filesBrowseMode: FilesBrowseMode;
	groupBy: GroupBy;
	currentPage: number;
	setItems: React.Dispatch<React.SetStateAction<ContentItem[]>>;
	setTotalItems: React.Dispatch<React.SetStateAction<number>>;
	setError: (message: string | null) => void;
	setSuccess: (message: string | null) => void;
	onAfterBulkMutation: () => void | Promise<void>;
	assignCompanyId: string;
	assignProjectId: string;
	setAssignTenancyOpen: (open: boolean) => void;
	setAssignTenancyLoading: (loading: boolean) => void;
};

export function useContentManagerSelection({
	t,
	filteredItems,
	items,
	filesBrowseMode,
	groupBy,
	currentPage,
	setItems,
	setTotalItems,
	setError,
	setSuccess,
	onAfterBulkMutation,
	assignCompanyId,
	assignProjectId,
	setAssignTenancyOpen,
	setAssignTenancyLoading,
}: UseContentManagerSelectionOptions) {
	const [selectMode, setSelectMode] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [batchDownloadLoading, setBatchDownloadLoading] = useState(false);
	const [batchCopyLoading, setBatchCopyLoading] = useState(false);
	const [batchDeleteModalOpen, setBatchDeleteModalOpen] = useState(false);
	const selectionAnchorIndexRef = useRef<number | null>(null);

	const selectionCopy = resolveContentManagerSelectionCopy(
		filesBrowseMode,
		groupBy
	);

	const clearSelection = useCallback(() => {
		setSelectedIds(new Set());
		setSelectMode(false);
	}, []);

	const toggleSelection = useCallback(
		(
			id: string,
			opts?: {
				shiftKey?: boolean;
				index?: number;
				fromCheckbox?: boolean;
			}
		) => {
			if (opts?.fromCheckbox) {
				setSelectedIds((prev) => {
					const next = new Set(prev);
					if (next.has(id)) {
						next.delete(id);
					} else {
						next.add(id);
					}
					return next;
				});
				if (opts.index !== undefined) {
					selectionAnchorIndexRef.current = opts.index;
				}
				return;
			}

			const idx = opts?.index;
			const shift = opts?.shiftKey ?? false;

			if (
				shift &&
				idx !== undefined &&
				selectionAnchorIndexRef.current !== null
			) {
				const anchor = selectionAnchorIndexRef.current;
				const lo = Math.min(anchor, idx);
				const hi = Math.max(anchor, idx);
				const rangeIds = filteredItems.slice(lo, hi + 1).map((i) => i.id);
				setSelectedIds(new Set(rangeIds));
				return;
			}

			setSelectedIds((prev) => {
				const next = new Set(prev);
				if (next.has(id)) {
					next.delete(id);
				} else {
					next.add(id);
				}
				return next;
			});
			if (idx !== undefined) {
				selectionAnchorIndexRef.current = idx;
			}
		},
		[filteredItems]
	);

	const selectAllVisible = useCallback(() => {
		setSelectedIds(new Set(filteredItems.map((i) => i.id)));
		selectionAnchorIndexRef.current = 0;
	}, [filteredItems]);

	const requestBatchDelete = useCallback(() => {
		if (selectedIds.size === 0) {
			return;
		}
		setBatchDeleteModalOpen(true);
	}, [selectedIds.size]);

	const executeBatchDelete = useCallback(async () => {
		if (selectedIds.size === 0) {
			return;
		}
		try {
			const deleteEligibility = partitionSelectedByDeleteEligibility(
				items,
				selectedIds
			);
			if (deleteEligibility.eligible.length === 0) {
				throw new Error(t('errors.batchNoneDeleted'));
			}
			const ids = deleteEligibility.eligible.map((item) => item.id);
			const n = ids.length;
			const results = await Promise.allSettled(
				ids.map((id) => contentApi.deleteContent(id))
			);
			const failed = results.filter((r) => r.status === 'rejected').length;
			const succeeded = results.length - failed;
			if (succeeded === 0) {
				throw new Error(t('errors.batchNoneDeleted'));
			}
			const successIds = ids.filter(
				(_, idx) => results[idx]?.status === 'fulfilled'
			);
			setItems((prev) =>
				prev.filter((item) => !new Set(successIds).has(item.id))
			);
			setTotalItems((prev) => Math.max(0, prev - succeeded));
			setSelectedIds(new Set());
			setSelectMode(false);
			setSuccess(
				failed > 0
					? t('pro.toast.batchDeletedPartial', { ok: succeeded, failed })
					: t('pro.toast.batchDeletedOk', { count: n })
			);
			setTimeout(() => setSuccess(null), 2000);
			await onAfterBulkMutation();
			requestDesktopFolderLibraryCountsInvalidate({
				folderIds: collectFolderIdsForLibraryMutation(items, successIds, null),
			});
		} catch (err) {
			const msg = getApiErrorMessage(err);
			const hint = getContentRecoveryHint('batch', err, t);
			logUxError(
				'ContentManagerPro',
				'unified_content',
				'batch_delete',
				err instanceof Error ? err : undefined,
				{ message: msg, hint }
			);
			setError(msg);
			notify.error(t('pro.notify.batchDeleteFailed'), `${msg}. ${hint}`, {
				duration: 6000,
			});
			throw err instanceof Error ? err : new Error(msg);
		}
	}, [
		items,
		onAfterBulkMutation,
		selectedIds,
		setError,
		setItems,
		setSuccess,
		setTotalItems,
		t,
	]);

	const batchDownload = useCallback(async () => {
		if (selectedIds.size === 0 || batchDownloadLoading) {
			return;
		}
		setBatchDownloadLoading(true);
		try {
			await contentApi.batchDownloadToBrowser({
				contentIds: Array.from(selectedIds),
				archiveName: `files_${new Date().toISOString().slice(0, 10)}.zip`,
			});
			notify.success(t('pro.notify.zipStarted'), '', { duration: 4000 });
		} catch (err) {
			const msg = getApiErrorMessage(err);
			const hint = getContentRecoveryHint('batch', err, t);
			logUxError(
				'ContentManagerPro',
				'unified_content',
				'batch_download',
				err instanceof Error ? err : undefined,
				{ message: msg, hint }
			);
			setError(msg);
			notify.error(t('pro.notify.zipFailed'), `${msg}. ${hint}`, {
				duration: 6000,
			});
		} finally {
			setBatchDownloadLoading(false);
		}
	}, [batchDownloadLoading, selectedIds, setError, t]);

	const batchAssignToProject = useCallback(async () => {
		if (selectedIds.size === 0) {
			return;
		}
		const cid = assignCompanyId.trim();
		const pid = assignProjectId.trim();
		if (!cid || !pid) {
			notify.error(
				t('pro.batchAssign.needBoth'),
				t('pro.batchAssign.needBothDesc'),
				{ duration: 4000 }
			);
			return;
		}
		setAssignTenancyLoading(true);
		try {
			const ids = Array.from(selectedIds);
			const body = { company_id: cid, project_id: pid };
			const results = await Promise.allSettled(
				ids.map((id) => contentApi.updateContent(id, body))
			);
			const failed = results.filter((r) => r.status === 'rejected').length;
			if (failed === ids.length) {
				const first = results.find((r) => r.status === 'rejected') as
					| PromiseRejectedResult
					| undefined;
				throw first?.reason ?? new Error('batch assign failed');
			}
			setAssignTenancyOpen(false);
			setSuccess(
				failed > 0
					? t('pro.batchAssign.partial', { ok: ids.length - failed, failed })
					: t('pro.batchAssign.ok', { count: ids.length })
			);
			setTimeout(() => setSuccess(null), 2500);
			await onAfterBulkMutation();
		} catch (err) {
			const msg = getApiErrorMessage(err);
			setError(msg);
			notify.error(t('pro.notify.batchAssignFailed'), msg, { duration: 6000 });
		} finally {
			setAssignTenancyLoading(false);
		}
	}, [
		assignCompanyId,
		assignProjectId,
		onAfterBulkMutation,
		selectedIds,
		setAssignTenancyLoading,
		setAssignTenancyOpen,
		setError,
		setSuccess,
		t,
	]);

	const resetSelectionOnPageChange = useCallback(() => {
		selectionAnchorIndexRef.current = null;
	}, []);

	return {
		selectMode,
		setSelectMode,
		selectedIds,
		setSelectedIds,
		selectionCopy,
		toggleSelection,
		selectAllVisible,
		clearSelection,
		batchDownloadLoading,
		batchCopyLoading,
		setBatchCopyLoading,
		batchDeleteModalOpen,
		setBatchDeleteModalOpen,
		requestBatchDelete,
		executeBatchDelete,
		batchDownload,
		batchAssignToProject,
		selectionAnchorIndexRef,
		resetSelectionOnPageChange,
		currentPage,
	};
}
