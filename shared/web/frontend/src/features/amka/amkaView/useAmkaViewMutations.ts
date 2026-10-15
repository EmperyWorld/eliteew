/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mutation handlers for AmkaView start, approve, resume, continue, cancel, and export.
 *
 * Invariants:
 * - Approve/resume skip-key payloads and export server→client markdown fallback unchanged.
 *
 * Related:
 * - buildAmkaStartPayload.ts, useAmkaViewCompose.ts
 */

import type { MutableRefObject } from 'react';
import type { TFunction } from 'i18next';

import {
	downloadAmkaRunMarkdown,
	extractApiErrorMessage,
	marketingCabinetApi,
	type AmkaRun,
	type AmkaRunStep,
} from '@/services/amka/marketingCabinetAmkaBridge';
import type { useAmkaViewQueries } from '@/features/amka/amkaView/useAmkaViewQueries';
import { buildAmkaStartPayload } from '@/features/amka/amkaView/buildAmkaStartPayload';
import type {
	AmkaImcFocus,
	AmkaRunMode,
} from '@/features/amka/amkaView/amkaViewTypes';

type Queries = ReturnType<typeof useAmkaViewQueries>;

type NotifyFns = {
	success: (message: string) => void;
	error: (message: string) => void;
	warning: (title: string, message?: string) => void;
};

export function useAmkaViewMutations(input: {
	t: TFunction<'marketing'>;
	notify: NotifyFns;
	queries: Queries;
	selectedProjectId: string | null;
	selectedCompanyId: string | null;
	selectedRun: AmkaRun | null;
	steps: AmkaRunStep[];
	preferRunIdRef: MutableRefObject<string | null>;
	setSelectedRunId: (id: string | null) => void;
	setSkipSectionKeys: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	setSkipOperationKeys: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	setSkipStepIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
	exportIncludeCoreAlignment: boolean;
	userInstruction: string;
	sectionToggles: Record<string, boolean>;
	runMode: AmkaRunMode;
	autoCycleCount: number;
	perStepExecution: boolean;
	imcTypeKey: string;
	imcFocus: AmkaImcFocus;
	imcMaxWait: string;
	startPresetId: string;
	skipSectionKeys: Record<string, boolean>;
	skipOperationKeys: Record<string, boolean>;
	skipStepIds: Record<string, boolean>;
}) {
	const {
		t,
		notify,
		queries,
		selectedProjectId,
		selectedCompanyId,
		selectedRun,
		steps,
		preferRunIdRef,
		setSelectedRunId,
		setSkipSectionKeys,
		setSkipOperationKeys,
		setSkipStepIds,
		exportIncludeCoreAlignment,
		userInstruction,
		sectionToggles,
		runMode,
		autoCycleCount,
		perStepExecution,
		imcTypeKey,
		imcFocus,
		imcMaxWait,
		startPresetId,
		skipSectionKeys,
		skipOperationKeys,
		skipStepIds,
	} = input;

	const {
		createMutation,
		approveMutation,
		resumeMutation,
		continueMutation,
		cancelMutation,
	} = queries;

	const busy =
		createMutation.isPending ||
		approveMutation.isPending ||
		resumeMutation.isPending ||
		continueMutation.isPending ||
		cancelMutation.isPending;

	const handleStart = () => {
		if (!selectedProjectId || !selectedCompanyId) {
			notify.error(t('amkaView.startNeedProject'));
			return;
		}
		const { payload, selectedSections } = buildAmkaStartPayload({
			selectedProjectId,
			selectedCompanyId,
			userInstruction,
			sectionToggles,
			runMode,
			autoCycleCount,
			perStepExecution,
			imcTypeKey,
			imcFocus,
			imcMaxWait,
			startPresetId,
		});
		if (selectedSections.length === 0) {
			notify.error(t('amkaView.sectionSubsetEmpty'));
			return;
		}
		createMutation.mutate(payload, {
			onSuccess: (data) => {
				preferRunIdRef.current = data.run.id;
				setSelectedRunId(data.run.id);
				notify.success(t('amkaView.startSuccess'));
			},
			onError: (errValue) => {
				notify.error(
					extractApiErrorMessage(errValue, t('amkaView.startError'))
				);
			},
		});
	};

	const handleApprove = () => {
		if (!selectedRun) return;
		const skipKeys = Object.entries(skipSectionKeys)
			.filter(([, on]) => on)
			.map(([key]) => key);
		const skipOpKeys = Object.entries(skipOperationKeys)
			.filter(([, on]) => on)
			.map(([key]) => key);
		const skipStepIdList = Object.entries(skipStepIds)
			.filter(([, on]) => on)
			.map(([key]) => key);
		approveMutation.mutate(
			{
				runId: selectedRun.id,
				skip_section_keys: skipKeys,
				skip_step_ids: skipStepIdList,
				skip_operation_keys: skipOpKeys,
			},
			{
				onSuccess: (data) => {
					setSelectedRunId(data.run.id);
					setSkipSectionKeys({});
					setSkipStepIds({});
					setSkipOperationKeys({});
					notify.success(t('amkaView.approveSuccess'));
				},
				onError: (errValue) => {
					notify.error(
						extractApiErrorMessage(errValue, t('amkaView.approveError'))
					);
				},
			}
		);
	};

	const handleResume = () => {
		if (!selectedRun) return;
		const skipKeys = Object.entries(skipSectionKeys)
			.filter(([, on]) => on)
			.map(([key]) => key);
		const skipOpKeys = Object.entries(skipOperationKeys)
			.filter(([, on]) => on)
			.map(([key]) => key);
		const skipStepIdList = Object.entries(skipStepIds)
			.filter(([, on]) => on)
			.map(([key]) => key);
		resumeMutation.mutate(
			{
				runId: selectedRun.id,
				skip_section_keys: skipKeys,
				skip_step_ids: skipStepIdList,
				skip_operation_keys: skipOpKeys,
			},
			{
				onSuccess: (data) => {
					setSelectedRunId(data.run.id);
					setSkipSectionKeys({});
					setSkipStepIds({});
					setSkipOperationKeys({});
					notify.success(t('amkaView.resumeSuccess'));
				},
				onError: (errValue) => {
					notify.error(
						extractApiErrorMessage(errValue, t('amkaView.resumeError'))
					);
				},
			}
		);
	};

	const handleContinueStep = () => {
		if (!selectedRun) return;
		continueMutation.mutate(selectedRun.id, {
			onSuccess: (data) => {
				setSelectedRunId(data.run.id);
				notify.success(t('amkaView.continueStepSuccess'));
			},
			onError: (errValue) => {
				notify.error(
					extractApiErrorMessage(errValue, t('amkaView.continueStepError'))
				);
			},
		});
	};

	const handleExportReport = () => {
		if (!selectedRun) return;
		void (async () => {
			try {
				const md = await marketingCabinetApi.exportAmkaRunMarkdown(
					selectedRun.id,
					exportIncludeCoreAlignment
						? { includeCoreAlignment: true }
						: undefined
				);
				const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `amka-run-${selectedRun.id.slice(0, 8)}.md`;
				a.rel = 'noopener';
				document.body.appendChild(a);
				a.click();
				a.remove();
				URL.revokeObjectURL(url);
				notify.success(t('amkaView.exportReportSuccess'));
			} catch {
				downloadAmkaRunMarkdown(selectedRun, steps);
				notify.warning(
					t('amkaView.exportReportFallbackTitle'),
					t('amkaView.exportReportFallbackHint')
				);
			}
		})();
	};

	const handleCancel = () => {
		if (!selectedRun) return;
		cancelMutation.mutate(selectedRun.id, {
			onSuccess: (data) => {
				setSelectedRunId(data.run.id);
				notify.success(t('amkaView.cancelSuccess'));
			},
			onError: (errValue) => {
				notify.error(
					extractApiErrorMessage(errValue, t('amkaView.cancelError'))
				);
			},
		});
	};

	return {
		busy,
		createMutation,
		handleStart,
		handleApprove,
		handleResume,
		handleContinueStep,
		handleExportReport,
		handleCancel,
	};
}
