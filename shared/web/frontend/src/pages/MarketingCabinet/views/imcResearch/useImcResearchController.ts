/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * IMC Research view controller: queries, mutations, list filters, form state,
 * and run/cancel/rerun/delete/copy/download/RAG handlers.
 *
 * Invariants:
 * - Public props/behavior match pre-atomization ImcResearchView.
 * - Delete from history remains project-lead only (UI gate; API enforces too).
 *
 * Related:
 * - ImcResearchView.tsx
 * - hooks/api/useImcResearch.ts
 */

import {
	useMarketingProjectRagSources,
	usePatchMarketingRagSource,
	usePostImcRunToProjectRag,
} from '@/hooks/api/useMarketingProjectRag';
import {
	useImcCancelResearch,
	useImcDeleteResearch,
	useImcProjectResearches,
	useImcRagHints,
	useImcRerunResearch,
	useImcResearchDetail,
	useImcResearchStatus,
	useImcRunResearch,
	useImcTypes,
} from '@/hooks/api/useImcResearch';
import { useNotifications } from '@/notifications';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarketingContentSource } from '../../hooks/useMarketingContentSource';
import { useMarketingShellClasses } from '../../hooks/useMarketingShellClasses';
import {
	marketingWebSearchApiFields,
	readStoredMarketingWebSearchQuality,
} from '../../marketingWebSearchQuality';
import { extractApiErrorMessage } from '../../utils';
import { imcMarkdownTextStats } from './imcResearchHelpers';
import type { ImcResearchViewProps } from './imcResearchTypes';

export function useImcResearchController({
	selectedProjectId,
	selectedCompanyId,
	focusedEntityId = null,
	isProjectLead = false,
	onSelectResearch,
	onClearResearchSelection,
}: ImcResearchViewProps) {
	const { t, i18n } = useTranslation('marketing');
	const statLocale = i18n.language.startsWith('ru') ? 'ru-RU' : 'en-US';
	const { success: notifySuccess } = useNotifications();
	const { contentPanel: mcShellContentPanel, checkboxControl } =
		useMarketingShellClasses();
	const contentSource = useMarketingContentSource();

	const typesQuery = useImcTypes(selectedCompanyId);
	const [listFilterStatus, setListFilterStatus] = useState<string>('');
	const [listFilterTypeKey, setListFilterTypeKey] = useState<string>('');
	const [listActiveOnly, setListActiveOnly] = useState(false);
	const [listLimit, setListLimit] = useState(40);
	const [listSearch, setListSearch] = useState('');
	const [listSort, setListSort] = useState<'newest' | 'oldest'>('newest');
	const listQuery = useImcProjectResearches(selectedProjectId ?? undefined, {
		limit: listLimit,
		status: listFilterStatus || undefined,
		type_key: listFilterTypeKey || undefined,
		active_only: listActiveOnly ? true : undefined,
	});
	const detailQuery = useImcResearchDetail(focusedEntityId ?? undefined);
	const statusQuery = useImcResearchStatus(focusedEntityId ?? undefined, {
		pollWhileActive: true,
	});
	const runMutation = useImcRunResearch();
	const cancelMutation = useImcCancelResearch();
	const rerunMutation = useImcRerunResearch();
	const deleteMutation = useImcDeleteResearch();
	const ragHintsQuery = useImcRagHints(selectedProjectId ?? undefined, {
		enabled:
			Boolean(selectedProjectId) &&
			listQuery.isSuccess &&
			(listQuery.data?.items?.length ?? 0) > 0,
	});
	const ragSourcesQuery = useMarketingProjectRagSources(
		selectedProjectId ?? undefined,
		{ enabled: Boolean(selectedProjectId && focusedEntityId) }
	);
	const postImcToRagMutation = usePostImcRunToProjectRag(
		selectedProjectId ?? undefined
	);
	const patchRagFromImcMutation = usePatchMarketingRagSource(
		selectedProjectId ?? undefined
	);

	const [typeKey, setTypeKey] = useState('');
	const [sourceUrl, setSourceUrl] = useState('');
	const [brief, setBrief] = useState('');
	const [focusKey, setFocusKey] = useState<string>('');
	const [compareLeftId, setCompareLeftId] = useState<string>('');
	const [compareRightId, setCompareRightId] = useState<string>('');
	const [deleteResearchId, setDeleteResearchId] = useState<string | null>(null);

	const types = typesQuery.data?.types ?? [];
	const imcFormIds = useId();
	const filterStatusSelectId = `${imcFormIds}-filter-status`;
	const filterTypeSelectId = `${imcFormIds}-filter-type`;
	const filterSortSelectId = `${imcFormIds}-filter-sort`;
	const listSearchInputId = `${imcFormIds}-list-search`;
	const listActiveOnlyId = `${imcFormIds}-list-active-only`;
	const fieldTypeSelectId = `${imcFormIds}-field-type`;

	const imcListScopeKey = `${selectedProjectId ?? ''}|${listFilterStatus}|${listFilterTypeKey}|${listActiveOnly}`;
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset loaded page when project or server filters change
	useEffect(() => {
		setListLimit(40);
	}, [imcListScopeKey]);

	const statusFilterOptions = useMemo(
		() => [
			{ value: '', label: t('imcView.filterStatusAll') },
			{ value: 'pending', label: t('imcView.runStatus.pending') },
			{ value: 'running', label: t('imcView.runStatus.running') },
			{ value: 'completed', label: t('imcView.runStatus.completed') },
			{ value: 'failed', label: t('imcView.runStatus.failed') },
			{ value: 'cancelled', label: t('imcView.runStatus.cancelled') },
			{ value: 'partial', label: t('imcView.runStatus.partial') },
		],
		[t]
	);

	const typeFilterOptions = useMemo(
		() => [
			{ value: '', label: t('imcView.filterTypeAll') },
			...types.map((x) => ({ value: x.type_key, label: x.display_name })),
		],
		[t, types]
	);

	const sortFilterOptions = useMemo(
		() => [
			{ value: 'newest', label: t('imcView.listSortNewest') },
			{ value: 'oldest', label: t('imcView.listSortOldest') },
		],
		[t]
	);

	const researchTypeOptions = useMemo(
		() =>
			types.map((x) => ({
				value: x.type_key,
				label: `${x.display_name} (${x.type_key})`,
			})),
		[types]
	);

	useEffect(() => {
		if (!typeKey && types.length > 0) {
			setTypeKey(types[0].type_key);
		}
	}, [typeKey, types]);

	useEffect(() => {
		if (!focusedEntityId) return;
		const element = document.querySelector(
			`[data-marketing-entity-id="${focusedEntityId}"]`
		);
		if (element instanceof HTMLElement) {
			element.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}, [focusedEntityId]);

	const useToolbarDoc = Boolean(
		contentSource?.selectedContentId &&
			contentSource.selectedProjectId === selectedProjectId &&
			contentSource.selectedCompanyId === selectedCompanyId
	);
	const toolbarContentId = useToolbarDoc
		? (contentSource?.selectedContentId ?? null)
		: null;

	const selectedType = types.find((x) => x.type_key === typeKey);
	const ragProjectOnly = Boolean(selectedType?.rag_project_only);

	const canRun = Boolean(
		selectedProjectId &&
			selectedCompanyId &&
			typeKey &&
			(ragProjectOnly || toolbarContentId || sourceUrl.trim() || brief.trim())
	);

	const handleRun = useCallback(() => {
		if (!selectedProjectId || !selectedCompanyId || !typeKey) return;
		const input_file_ids = toolbarContentId ? [toolbarContentId] : [];
		const context: Record<string, string> = {};
		if (brief.trim()) context.brief = brief.trim();
		if (focusKey === 'global' || focusKey === 'rf' || focusKey === 'mixed') {
			context.focus = focusKey;
		}
		const body = {
			type_key: typeKey,
			company_id: selectedCompanyId,
			project_id: selectedProjectId,
			input_file_ids,
			source_url: sourceUrl.trim() || undefined,
			context: Object.keys(context).length ? context : undefined,
			language: 'russian' as const,
			...marketingWebSearchApiFields(readStoredMarketingWebSearchQuality()),
		};
		runMutation.mutate(body, {
			onSuccess: (res) => {
				onSelectResearch(res.id);
			},
			onError: () => {},
		});
	}, [
		brief,
		focusKey,
		onSelectResearch,
		runMutation,
		selectedCompanyId,
		selectedProjectId,
		sourceUrl,
		toolbarContentId,
		typeKey,
	]);

	const handleCancel = useCallback(() => {
		if (!focusedEntityId) return;
		cancelMutation.mutate(focusedEntityId);
	}, [cancelMutation, focusedEntityId]);

	const handleRerun = useCallback(() => {
		if (!focusedEntityId) return;
		rerunMutation.mutate(focusedEntityId, {
			onSuccess: (res) => {
				onSelectResearch(res.id);
			},
			onError: () => {},
		});
	}, [focusedEntityId, onSelectResearch, rerunMutation]);

	const handleDeleteResearch = useCallback((runId: string) => {
		setDeleteResearchId(runId);
	}, []);

	const confirmDeleteResearch = useCallback(async () => {
		if (!deleteResearchId) return;
		const runId = deleteResearchId;
		try {
			await deleteMutation.mutateAsync(runId);
			if (runId === focusedEntityId) onClearResearchSelection();
			notifySuccess(t('imcView.deleteSuccess'));
		} catch {
			// toast handled by mutation or API layer if needed
		} finally {
			setDeleteResearchId(null);
		}
	}, [
		deleteResearchId,
		deleteMutation,
		focusedEntityId,
		onClearResearchSelection,
		notifySuccess,
		t,
	]);

	const compareLeftQuery = useImcResearchDetail(
		compareLeftId && compareLeftId !== compareRightId
			? compareLeftId
			: undefined
	);
	const compareRightQuery = useImcResearchDetail(
		compareRightId && compareLeftId !== compareRightId
			? compareRightId
			: undefined
	);

	const [copiedPulse, setCopiedPulse] = useState(false);
	const handleCopyResult = useCallback(async () => {
		const text = detailQuery.data?.result_text?.trim();
		if (!text) return;
		try {
			await navigator.clipboard.writeText(text);
			setCopiedPulse(true);
			window.setTimeout(() => setCopiedPulse(false), 2000);
		} catch {
			/* ignore */
		}
	}, [detailQuery.data?.result_text]);

	const handleDownloadMarkdown = useCallback(() => {
		const text = detailQuery.data?.result_text?.trim();
		if (!text || !focusedEntityId) return;
		const tk = detailQuery.data?.type_key ?? 'imc';
		const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${tk}_${focusedEntityId.slice(0, 8)}.md`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, [
		detailQuery.data?.result_text,
		detailQuery.data?.type_key,
		focusedEntityId,
	]);

	const handleCopyUgsRequestId = useCallback(async () => {
		const id = detailQuery.data?.ugs_request_id;
		if (!id) return;
		try {
			await navigator.clipboard.writeText(id);
		} catch {
			/* ignore */
		}
	}, [detailQuery.data?.ugs_request_id]);

	const handleApplyPayloadToForm = useCallback(() => {
		const payload = detailQuery.data?.input_payload;
		if (!payload || typeof payload !== 'object') return;
		const tk =
			typeof (payload as Record<string, unknown>).type_key === 'string'
				? ((payload as Record<string, unknown>).type_key as string)
				: '';
		if (tk) setTypeKey(tk);
		const su = (payload as Record<string, unknown>).source_url;
		setSourceUrl(typeof su === 'string' ? su : '');
		const ctx = (payload as Record<string, unknown>).context;
		if (ctx && typeof ctx === 'object' && !Array.isArray(ctx)) {
			const o = ctx as Record<string, unknown>;
			const briefVal = typeof o.brief === 'string' ? o.brief : '';
			if (briefVal) {
				setBrief(briefVal);
			} else if (typeof o.research_query === 'string') {
				setBrief(o.research_query);
			} else {
				setBrief('');
			}
			const fk = o.focus;
			if (fk === 'global' || fk === 'rf' || fk === 'mixed') {
				setFocusKey(fk);
			} else {
				setFocusKey('');
			}
		} else {
			setBrief('');
			setFocusKey('');
		}
		onClearResearchSelection();
		notifySuccess(t('imcView.metaApplied'));
	}, [
		detailQuery.data?.input_payload,
		notifySuccess,
		onClearResearchSelection,
		t,
	]);

	const inputPayloadRecord =
		detailQuery.data?.input_payload &&
		typeof detailQuery.data.input_payload === 'object' &&
		!Array.isArray(detailQuery.data.input_payload)
			? (detailQuery.data.input_payload as Record<string, unknown>)
			: null;

	const structuredPayload =
		detailQuery.data?.result_structured ?? detailQuery.data?.parsed_data;
	const structuredJson =
		structuredPayload && typeof structuredPayload === 'object'
			? JSON.stringify(structuredPayload, null, 2)
			: null;

	const handleDownloadStructuredJson = useCallback(() => {
		if (!structuredJson || !focusedEntityId) return;
		const tk = detailQuery.data?.type_key ?? 'imc';
		const blob = new Blob([structuredJson], {
			type: 'application/json;charset=utf-8',
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${tk}_${focusedEntityId.slice(0, 8)}_structured.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, [detailQuery.data?.type_key, focusedEntityId, structuredJson]);

	const rawListItems = listQuery.data?.items ?? [];
	const listTotal = listQuery.data?.total ?? 0;
	const filteredSortedListItems = useMemo(() => {
		const q = listSearch.trim().toLowerCase();
		let rows = rawListItems;
		if (q) {
			rows = rows.filter((x) => {
				const preview = (x.result_preview ?? '').toLowerCase();
				const by = (x.started_by_label ?? '').toLowerCase();
				return (
					x.display_name.toLowerCase().includes(q) ||
					x.type_key.toLowerCase().includes(q) ||
					preview.includes(q) ||
					by.includes(q)
				);
			});
		}
		const dir = listSort === 'newest' ? -1 : 1;
		return [...rows].sort(
			(a, b) =>
				dir *
				(new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
		);
	}, [rawListItems, listSearch, listSort]);

	const activeStatus = statusQuery.data?.status ?? detailQuery.data?.status;
	const canCancel =
		focusedEntityId &&
		activeStatus &&
		['pending', 'running'].includes(activeStatus);

	const canRerun =
		focusedEntityId &&
		activeStatus &&
		['completed', 'failed', 'cancelled'].includes(activeStatus);

	const completedForCompare = rawListItems.filter(
		(x) => x.status === 'completed'
	);
	const weakRagBanner =
		ragHintsQuery.data?.weak_coverage === true && !ragHintsQuery.isLoading;

	const imcLinkedRagRow = useMemo(() => {
		if (!focusedEntityId || !ragSourcesQuery.data?.items) {
			return null;
		}
		return (
			ragSourcesQuery.data.items.find(
				(x) =>
					x.source_kind === 'imc_research_run' &&
					x.imc_research_run_id === focusedEntityId
			) ?? null
		);
	}, [focusedEntityId, ragSourcesQuery.data?.items]);

	const resultTextTrimmed = (detailQuery.data?.result_text ?? '').trim();
	const resultBodyStats = useMemo(
		() => imcMarkdownTextStats(detailQuery.data?.result_text ?? ''),
		[detailQuery.data?.result_text]
	);
	const compareLeftStats = useMemo(
		() => imcMarkdownTextStats(compareLeftQuery.data?.result_text ?? ''),
		[compareLeftQuery.data?.result_text]
	);
	const compareRightStats = useMemo(
		() => imcMarkdownTextStats(compareRightQuery.data?.result_text ?? ''),
		[compareRightQuery.data?.result_text]
	);
	const canMutateProjectRag =
		Boolean(focusedEntityId && selectedProjectId) &&
		resultTextTrimmed.length >= 60;

	const handlePromoteImcToRag = useCallback(() => {
		if (!focusedEntityId) return;
		postImcToRagMutation.mutate(focusedEntityId, { onError: () => {} });
	}, [focusedEntityId, postImcToRagMutation]);

	const handleToggleImcRagLinked = useCallback(() => {
		if (!imcLinkedRagRow) return;
		patchRagFromImcMutation.mutate(
			{
				contentId: imcLinkedRagRow.content_id,
				body: {
					marketing_rag_included: !imcLinkedRagRow.marketing_rag_included,
				},
			},
			{ onError: () => {} }
		);
	}, [imcLinkedRagRow, patchRagFromImcMutation]);

	const selectedTypeTitle = selectedType
		? `${selectedType.display_name} (${selectedType.type_key})`
		: typeKey;

	const runError = runMutation.error
		? extractApiErrorMessage(runMutation.error, t('imcView.runFailed'))
		: null;

	const detailError =
		detailQuery.isError && focusedEntityId
			? extractApiErrorMessage(detailQuery.error, t('imcView.loadDetailFailed'))
			: null;

	const emptyContext = !selectedProjectId || !selectedCompanyId;

	return {
		t,
		statLocale,
		mcShellContentPanel,
		checkboxControl,
		emptyContext,
		isProjectLead,
		focusedEntityId,
		onSelectResearch,
		onClearResearchSelection,
		typesQuery,
		types,
		listQuery,
		listFilterStatus,
		setListFilterStatus,
		listFilterTypeKey,
		setListFilterTypeKey,
		listActiveOnly,
		setListActiveOnly,
		listLimit,
		setListLimit,
		listSearch,
		setListSearch,
		listSort,
		setListSort,
		statusFilterOptions,
		typeFilterOptions,
		sortFilterOptions,
		filterStatusSelectId,
		filterTypeSelectId,
		filterSortSelectId,
		listSearchInputId,
		listActiveOnlyId,
		rawListItems,
		listTotal,
		filteredSortedListItems,
		deleteMutation,
		handleDeleteResearch,
		deleteResearchId,
		setDeleteResearchId,
		confirmDeleteResearch,
		detailQuery,
		statusQuery,
		detailError,
		activeStatus,
		canCancel,
		canRerun,
		cancelMutation,
		rerunMutation,
		handleCancel,
		handleRerun,
		inputPayloadRecord,
		handleCopyUgsRequestId,
		handleApplyPayloadToForm,
		resultBodyStats,
		copiedPulse,
		handleCopyResult,
		handleDownloadMarkdown,
		canMutateProjectRag,
		imcLinkedRagRow,
		postImcToRagMutation,
		patchRagFromImcMutation,
		handlePromoteImcToRag,
		handleToggleImcRagLinked,
		structuredJson,
		handleDownloadStructuredJson,
		ragProjectOnly,
		weakRagBanner,
		fieldTypeSelectId,
		selectedTypeTitle,
		typeKey,
		setTypeKey,
		researchTypeOptions,
		sourceUrl,
		setSourceUrl,
		focusKey,
		setFocusKey,
		brief,
		setBrief,
		toolbarContentId,
		runError,
		canRun,
		runMutation,
		handleRun,
		completedForCompare,
		compareLeftId,
		setCompareLeftId,
		compareRightId,
		setCompareRightId,
		compareLeftQuery,
		compareRightQuery,
		compareLeftStats,
		compareRightStats,
	};
}

export type ImcResearchController = ReturnType<typeof useImcResearchController>;
