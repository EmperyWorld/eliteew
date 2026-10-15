/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWRP job lifecycle actions from history/status: apply inputs, duplicate, retry, open, delete.
 *
 * Invariants:
 * - Opening/retry/duplicate clears edit draft and restarts polling via `stopPolling`.
 *
 * Related:
 * - `useEwrpGeneratorHistory.ts`, `useEwrpGeneratorPolling.ts`, `ewrpClientJobPolicy.ts`
 */

import { useCallback } from 'react';
import { notify } from '@/notifications';
import { contentApi } from '@/services/contentApi';
import {
	ewrpApi,
	type EwrpJobListItem,
	type EwrpStatusResponse,
} from '@/services/ewrpApi';
import type { ContentItem } from '../EwrpGeneratorChunks';
import {
	EWRP_RESTORE_KEY,
	parseEwrpStatusResponse,
} from '../EwrpGeneratorChunks';
import { notifyEwrpHttpError } from '../ewrpHttpErrors';
import { ewrpRetryEnergyCredits } from '../ewrpRetryPresentation';
import {
	type EwrpWebSearchQuality,
	isEwrpWebSearchQuality,
	writeStoredEwrpWebSearchQuality,
} from '../ewrpWebSearchQuality';

export type EwrpJobActionsBundle = {
	applyInputsFromJobId: (id: string) => Promise<void>;
	duplicateJobById: (id: string) => Promise<void>;
	retryJobById: (id: string) => Promise<void>;
	openJobFromHistory: (id: string) => Promise<void>;
	deleteJobFromHistory: (id: string, label: string | undefined) => void;
	executePendingDelete: () => Promise<void>;
};

export type UseEwrpJobActionsParams = {
	t: (key: string, opts?: Record<string, unknown>) => string;
	jobId: string | null;
	status: EwrpStatusResponse | null;
	numSlides: number;
	perSlideCredits: number;
	historyJobs: EwrpJobListItem[];
	deleteTarget: { id: string; label: string } | null;
	setTopic: React.Dispatch<React.SetStateAction<string>>;
	setTitle: React.Dispatch<React.SetStateAction<string>>;
	setNumSlides: React.Dispatch<React.SetStateAction<number>>;
	setExtraContext: React.Dispatch<React.SetStateAction<string>>;
	setWebSearchQuality: React.Dispatch<
		React.SetStateAction<EwrpWebSearchQuality>
	>;
	setPresentationTheme: React.Dispatch<React.SetStateAction<string>>;
	setFirstSlideStyle: React.Dispatch<React.SetStateAction<string>>;
	setSourceDocument: React.Dispatch<React.SetStateAction<ContentItem | null>>;
	setSourceDocumentLoading: React.Dispatch<React.SetStateAction<boolean>>;
	setApplyingInputsId: React.Dispatch<React.SetStateAction<string | null>>;
	setDuplicatingId: React.Dispatch<React.SetStateAction<string | null>>;
	setRetryingId: React.Dispatch<React.SetStateAction<string | null>>;
	setDeletingHistoryId: React.Dispatch<React.SetStateAction<string | null>>;
	setDeleteTarget: React.Dispatch<
		React.SetStateAction<{ id: string; label: string } | null>
	>;
	setJobId: React.Dispatch<React.SetStateAction<string | null>>;
	setStatus: React.Dispatch<React.SetStateAction<EwrpStatusResponse | null>>;
	setMainTab: React.Dispatch<
		React.SetStateAction<'generate' | 'presentations'>
	>;
	setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
	setDraftSlides: React.Dispatch<
		React.SetStateAction<import('@/services/ewrpApi').EwrpSlide[] | null>
	>;
	setIsHistoryModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
	stopPolling: () => void;
	refreshHistory: () => Promise<void>;
	focusPresentationsStatusColumn: () => void;
};

export function useEwrpJobActions(
	params: UseEwrpJobActionsParams
): EwrpJobActionsBundle {
	const {
		t,
		jobId,
		status,
		numSlides,
		perSlideCredits,
		historyJobs,
		deleteTarget,
		setTopic,
		setTitle,
		setNumSlides,
		setExtraContext,
		setWebSearchQuality,
		setPresentationTheme,
		setFirstSlideStyle,
		setSourceDocument,
		setSourceDocumentLoading,
		setApplyingInputsId,
		setDuplicatingId,
		setRetryingId,
		setDeletingHistoryId,
		setDeleteTarget,
		setJobId,
		setStatus,
		setMainTab,
		setIsEditing,
		setDraftSlides,
		setIsHistoryModalOpen,
		stopPolling,
		refreshHistory,
		focusPresentationsStatusColumn,
	} = params;

	const applyInputsFromStatus = useCallback(
		async (data: EwrpStatusResponse) => {
			const nextTopic = (data.topic ?? '').trim();
			if (nextTopic) setTopic(nextTopic);
			if (data.title != null && String(data.title).trim() !== '') {
				setTitle(String(data.title).trim());
			}
			if (
				typeof data.num_slides === 'number' &&
				data.num_slides >= 3 &&
				data.num_slides <= 20
			) {
				setNumSlides(data.num_slides);
			}
			if (data.extra_context != null) {
				setExtraContext(data.extra_context);
			} else {
				setExtraContext('');
			}
			if (
				data.web_search_quality &&
				isEwrpWebSearchQuality(data.web_search_quality)
			) {
				setWebSearchQuality(data.web_search_quality);
				writeStoredEwrpWebSearchQuality(data.web_search_quality);
			} else if (data.use_web_search) {
				setWebSearchQuality('standard');
				writeStoredEwrpWebSearchQuality('standard');
			}
			if (data.source_content_id) {
				setSourceDocumentLoading(true);
				try {
					const c = await contentApi.getContent(String(data.source_content_id));
					setSourceDocument({
						id: c.id,
						name: c.name,
						content_type: c.content_type,
						created_at: c.created_at,
					});
				} catch {
					setSourceDocument(null);
					notify.error(t('notify.sourceFileUnavailable'));
				} finally {
					setSourceDocumentLoading(false);
				}
			} else {
				setSourceDocument(null);
				setSourceDocumentLoading(false);
			}
			if (
				data.presentation_theme != null &&
				String(data.presentation_theme).trim() !== ''
			) {
				setPresentationTheme(String(data.presentation_theme).trim());
			} else {
				setPresentationTheme('classic');
			}
			const fsRaw =
				data.first_slide_style != null
					? String(data.first_slide_style).trim()
					: '';
			setFirstSlideStyle(
				fsRaw === 'title_only' || fsRaw === 'title_image_only'
					? 'title_only'
					: 'standard'
			);
		},
		[
			setTopic,
			setTitle,
			setNumSlides,
			setExtraContext,
			setWebSearchQuality,
			setPresentationTheme,
			setFirstSlideStyle,
			setSourceDocument,
			setSourceDocumentLoading,
			t,
		]
	);

	const applyInputsFromJobId = useCallback(
		async (id: string) => {
			setApplyingInputsId(id);
			try {
				const res = await ewrpApi.getStatus(id);
				const data = parseEwrpStatusResponse(res);
				if (!data) {
					notify.error(t('notify.loadJobFailed'));
					return;
				}
				await applyInputsFromStatus(data);
				setMainTab('generate');
				notify.success(t('notify.inputsApplied'));
			} catch {
				notify.error(t('notify.inputsLoadFailed'));
			} finally {
				setApplyingInputsId(null);
			}
		},
		[applyInputsFromStatus, setApplyingInputsId, setMainTab, t]
	);

	const duplicateJobById = useCallback(
		async (id: string) => {
			setDuplicatingId(id);
			try {
				const res = await ewrpApi.duplicate(id);
				const newId = (res as { data?: { id?: string } }).data?.id;
				if (!newId) {
					notify.error(t('notify.createJobFailed'));
					return;
				}
				const newIdStr = String(newId);
				stopPolling();
				setIsEditing(false);
				setDraftSlides(null);
				setJobId(newIdStr);
				setMainTab('presentations');
				window.localStorage.setItem(EWRP_RESTORE_KEY, newIdStr);
				setStatus({
					id: newIdStr,
					status: 'queued',
					progress: 0,
					error_message: null,
					pdf_url: null,
					slides: null,
				});
				notify.success(t('notify.duplicateQueued'));
				void refreshHistory();
			} catch (e: unknown) {
				notifyEwrpHttpError(e, t('notify.duplicateFailed'), notify, t);
			} finally {
				setDuplicatingId(null);
			}
		},
		[
			stopPolling,
			setIsEditing,
			setDraftSlides,
			setJobId,
			setMainTab,
			setStatus,
			setDuplicatingId,
			refreshHistory,
			t,
		]
	);

	const retryJobById = useCallback(
		async (id: string) => {
			setRetryingId(id);
			const historyRow = historyJobs.find((row) => row.id === id);
			const retryStatus = historyRow?.status ?? status?.status ?? 'failed';
			const retrySlides =
				historyRow?.num_slides ?? status?.num_slides ?? numSlides;
			try {
				const res = await ewrpApi.retry(id);
				const sameId = String(
					(res as { data?: { id?: string } }).data?.id ?? id
				);
				stopPolling();
				setIsEditing(false);
				setDraftSlides(null);
				setJobId(sameId);
				setMainTab('presentations');
				window.localStorage.setItem(EWRP_RESTORE_KEY, sameId);
				setStatus({
					id: sameId,
					status: 'queued',
					progress: 0,
					error_message: null,
					pdf_url: null,
					slides: null,
				});
				const billed = ewrpRetryEnergyCredits(
					retryStatus,
					retrySlides,
					perSlideCredits
				);
				if (billed === 0) {
					notify.success(t('notify.retryQueuedFree'));
				} else {
					notify.success(t('notify.retryQueuedBilled', { total: billed }));
				}
				void refreshHistory();
			} catch (e: unknown) {
				notifyEwrpHttpError(e, t('notify.retryFailed'), notify, t);
			} finally {
				setRetryingId(null);
			}
		},
		[
			historyJobs,
			status,
			numSlides,
			perSlideCredits,
			stopPolling,
			setIsEditing,
			setDraftSlides,
			setJobId,
			setMainTab,
			setStatus,
			setRetryingId,
			refreshHistory,
			t,
		]
	);

	const openJobFromHistory = useCallback(
		async (id: string) => {
			stopPolling();
			setIsEditing(false);
			setDraftSlides(null);
			try {
				const res = await ewrpApi.getStatus(id);
				const data = parseEwrpStatusResponse(res);
				if (!data) {
					notify.error(t('notify.loadJobFailed'));
					return;
				}
				setStatus(data);
				setJobId(id);
				setMainTab('presentations');
				setIsHistoryModalOpen(false);
				window.localStorage.setItem(EWRP_RESTORE_KEY, id);
				void refreshHistory();
				focusPresentationsStatusColumn();
			} catch {
				notify.error(t('notify.loadJobFailed'));
			}
		},
		[
			stopPolling,
			setIsEditing,
			setDraftSlides,
			setStatus,
			setJobId,
			setMainTab,
			setIsHistoryModalOpen,
			refreshHistory,
			focusPresentationsStatusColumn,
			t,
		]
	);

	const deleteJobFromHistory = useCallback(
		(id: string, label: string | undefined) => {
			setDeleteTarget({
				id,
				label: (label || t('labels.untitledJob')).trim(),
			});
		},
		[setDeleteTarget, t]
	);

	const executePendingDelete = useCallback(async () => {
		if (!deleteTarget) return;
		const id = deleteTarget.id;
		setDeletingHistoryId(id);
		try {
			await ewrpApi.deleteJob(id);
			if (jobId === id) {
				stopPolling();
				setJobId(null);
				setStatus(null);
				setIsEditing(false);
				setDraftSlides(null);
				window.localStorage.removeItem(EWRP_RESTORE_KEY);
			}
			notify.success(t('notify.jobDeleted'));
			void refreshHistory();
		} catch (e: unknown) {
			const msg =
				(e as { response?: { data?: { detail?: string } } })?.response?.data
					?.detail || t('notify.deleteJobFailed');
			throw new Error(String(msg));
		} finally {
			setDeletingHistoryId(null);
		}
	}, [
		deleteTarget,
		jobId,
		stopPolling,
		setDeletingHistoryId,
		setJobId,
		setStatus,
		setIsEditing,
		setDraftSlides,
		refreshHistory,
		t,
	]);

	return {
		applyInputsFromJobId,
		duplicateJobById,
		retryJobById,
		openJobFromHistory,
		deleteJobFromHistory,
		executePendingDelete,
	};
}
