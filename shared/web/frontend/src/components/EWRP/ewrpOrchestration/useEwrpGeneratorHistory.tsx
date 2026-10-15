/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWRP presentations history modal: list state, pagination, virtual row render, delete target.
 *
 * Invariants:
 * - `refreshHistory` resets offset; `loadMoreHistory` dedupes by job id.
 *
 * Related:
 * - `useEwrpJobActions.ts`, `EwrpGeneratorModals.tsx`, `EwrpHistoryRow`
 */

import {
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
} from 'react';
import { notify } from '@/notifications';
import { ewrpApi, type EwrpJobListItem } from '@/services/ewrpApi';
import {
	EWRP_HISTORY_PAGE_SIZE,
	EWRP_VIRTUAL_LIST_THRESHOLD,
	EwrpHistoryRow,
	filterEwrpHistoryJobs,
} from '../EwrpGeneratorChunks';
import type { EwrpJobActionsBundle } from './useEwrpJobActions';

const noopAsync = async () => {};
const noopVoid = () => {};

export type UseEwrpGeneratorHistoryParams = {
	t: (key: string, opts?: Record<string, unknown>) => string;
	jobId: string | null;
	shellInset: string;
	secondaryBtnClass: string;
	perSlideCredits: number;
	historyJobs: EwrpJobListItem[];
	setHistoryJobs: React.Dispatch<React.SetStateAction<EwrpJobListItem[]>>;
	historyLoading: boolean;
	setHistoryLoading: React.Dispatch<React.SetStateAction<boolean>>;
	historyLoadingMore: boolean;
	setHistoryLoadingMore: React.Dispatch<React.SetStateAction<boolean>>;
	historyHasMore: boolean;
	setHistoryHasMore: React.Dispatch<React.SetStateAction<boolean>>;
	historyOffset: number;
	setHistoryOffset: React.Dispatch<React.SetStateAction<number>>;
	historyError: string | null;
	setHistoryError: React.Dispatch<React.SetStateAction<string | null>>;
	historySearch: string;
	setHistorySearch: React.Dispatch<React.SetStateAction<string>>;
	isHistoryModalOpen: boolean;
	setIsHistoryModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
	deletingHistoryId: string | null;
	applyingInputsId: string | null;
	duplicatingId: string | null;
	retryingId: string | null;
	deleteTarget: { id: string; label: string } | null;
	setDeleteTarget: React.Dispatch<
		React.SetStateAction<{ id: string; label: string } | null>
	>;
	historySearchInputRef: React.RefObject<HTMLInputElement | null>;
	historyModalPanelRef: React.RefObject<HTMLDivElement | null>;
	getJobActions: () => EwrpJobActionsBundle | null;
};

export function useEwrpGeneratorHistory(params: UseEwrpGeneratorHistoryParams) {
	const {
		t,
		jobId,
		shellInset,
		secondaryBtnClass,
		perSlideCredits,
		historyJobs,
		setHistoryJobs,
		historyLoading,
		setHistoryLoading,
		historyLoadingMore,
		setHistoryLoadingMore,
		historyHasMore,
		setHistoryHasMore,
		historyOffset,
		setHistoryOffset,
		setHistoryError,
		historySearch,
		setHistorySearch,
		isHistoryModalOpen,
		setIsHistoryModalOpen,
		deletingHistoryId,
		applyingInputsId,
		duplicatingId,
		retryingId,
		historySearchInputRef,
		getJobActions,
	} = params;

	const getJobActionsRef = useRef(getJobActions);
	getJobActionsRef.current = getJobActions;

	const closeHistoryModal = useCallback(() => {
		setIsHistoryModalOpen(false);
		setHistorySearch('');
	}, [setIsHistoryModalOpen, setHistorySearch]);

	const refreshHistory = useCallback(async () => {
		setHistoryLoading(true);
		setHistoryError(null);
		try {
			const jobs = await ewrpApi.listJobs(EWRP_HISTORY_PAGE_SIZE, 0);
			setHistoryJobs(jobs);
			setHistoryHasMore(jobs.length === EWRP_HISTORY_PAGE_SIZE);
			setHistoryOffset(jobs.length);
		} catch {
			setHistoryError(t('notify.historyLoadFailed'));
			setHistoryHasMore(false);
		} finally {
			setHistoryLoading(false);
		}
	}, [
		setHistoryJobs,
		setHistoryHasMore,
		setHistoryOffset,
		setHistoryError,
		setHistoryLoading,
		t,
	]);

	const loadMoreHistory = useCallback(async () => {
		if (historyLoadingMore || !historyHasMore || historyLoading) return;
		setHistoryLoadingMore(true);
		try {
			const next = await ewrpApi.listJobs(
				EWRP_HISTORY_PAGE_SIZE,
				historyOffset
			);
			setHistoryJobs((prev) => {
				const seen = new Set(prev.map((j) => j.id));
				const merged = [...prev];
				for (const j of next) {
					if (!seen.has(j.id)) {
						merged.push(j);
						seen.add(j.id);
					}
				}
				return merged;
			});
			setHistoryHasMore(next.length === EWRP_HISTORY_PAGE_SIZE);
			setHistoryOffset((o) => o + next.length);
		} catch {
			notify.error(t('notify.historyLoadMoreFailed'));
		} finally {
			setHistoryLoadingMore(false);
		}
	}, [
		historyOffset,
		historyHasMore,
		historyLoadingMore,
		historyLoading,
		setHistoryJobs,
		setHistoryHasMore,
		setHistoryOffset,
		setHistoryLoadingMore,
		t,
	]);

	useEffect(() => {
		void refreshHistory();
	}, [refreshHistory]);

	useEffect(() => {
		if (!isHistoryModalOpen) return;
		const timerId = window.setTimeout(() => {
			historySearchInputRef.current?.focus();
		}, 0);
		return () => clearTimeout(timerId);
	}, [isHistoryModalOpen, historySearchInputRef]);

	const deferredHistorySearch = useDeferredValue(historySearch);

	const filteredHistoryJobs = useMemo(
		() => filterEwrpHistoryJobs(historyJobs, deferredHistorySearch),
		[historyJobs, deferredHistorySearch]
	);

	const historyListVirtualized =
		filteredHistoryJobs.length >= EWRP_VIRTUAL_LIST_THRESHOLD;

	const historyListSummary = useMemo(() => {
		if (historyJobs.length === 0) {
			return null;
		}
		if (deferredHistorySearch.trim()) {
			return t('form.historyListCountFiltered', {
				filtered: filteredHistoryJobs.length,
				total: historyJobs.length,
			});
		}
		return t('form.historyListCount', { count: historyJobs.length });
	}, [
		historyJobs.length,
		filteredHistoryJobs.length,
		deferredHistorySearch,
		t,
	]);

	const renderVirtualHistoryRow = useCallback(
		(row: EwrpJobListItem, _index: number) => {
			const actions = getJobActionsRef.current();
			return (
				<EwrpHistoryRow
					row={row}
					isActive={jobId === row.id}
					shellInset={shellInset}
					secondaryBtnClass={secondaryBtnClass}
					deletingHistoryId={deletingHistoryId}
					applyingInputsId={applyingInputsId}
					duplicatingId={duplicatingId}
					retryingId={retryingId}
					onOpen={actions?.openJobFromHistory ?? noopAsync}
					onApplyInputs={actions?.applyInputsFromJobId ?? noopAsync}
					onDuplicate={actions?.duplicateJobById ?? noopAsync}
					onRetry={actions?.retryJobById ?? noopAsync}
					onDelete={actions?.deleteJobFromHistory ?? noopVoid}
					asListItem={false}
					rowSpacingClass="mb-2"
					creditsPerSlide={perSlideCredits}
				/>
			);
		},
		[
			jobId,
			shellInset,
			secondaryBtnClass,
			deletingHistoryId,
			applyingInputsId,
			duplicatingId,
			retryingId,
			perSlideCredits,
		]
	);

	const handleHistoryListEndReached = useCallback(() => {
		void loadMoreHistory();
	}, [loadMoreHistory]);

	return {
		closeHistoryModal,
		refreshHistory,
		loadMoreHistory,
		deferredHistorySearch,
		filteredHistoryJobs,
		historyListVirtualized,
		historyListSummary,
		renderVirtualHistoryRow,
		handleHistoryListEndReached,
	};
}
