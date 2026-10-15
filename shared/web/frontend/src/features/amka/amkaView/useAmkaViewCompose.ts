/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Composes AmkaView hooks, derived state, mutations, and shell styles for the thin parent.
 *
 * Related:
 * - ../AmkaView.tsx, useAmkaViewLocalState.ts
 */

import { useTranslation } from 'react-i18next';

import { useNotifications } from '@/notifications';
import type { AmkaViewProps } from '@/features/amka/amkaView/amkaViewTypes';
import { useAmkaViewShellStyles } from '@/features/amka/amkaView/amkaViewShellStyles';
import { useAmkaViewLocalState } from '@/features/amka/amkaView/useAmkaViewLocalState';
import { useAmkaViewMutations } from '@/features/amka/amkaView/useAmkaViewMutations';
import { useAmkaViewQueries } from '@/features/amka/amkaView/useAmkaViewQueries';
import { useAmkaViewRunDerived } from '@/features/amka/amkaView/useAmkaViewRunDerived';
import { useAmkaViewSelectionEffects } from '@/features/amka/amkaView/useAmkaViewSelectionEffects';

export function useAmkaViewCompose({
	selectedProjectId,
	selectedCompanyId,
	canEditAmkaOperatorConfig = false,
}: AmkaViewProps) {
	const { t } = useTranslation('marketing');
	const { success, error, warning } = useNotifications();

	const local = useAmkaViewLocalState(canEditAmkaOperatorConfig);
	const shell = useAmkaViewShellStyles();
	const queries = useAmkaViewQueries(
		selectedProjectId,
		selectedCompanyId,
		local.selectedRunId
	);

	const runs = queries.runsQuery.data?.items ?? [];
	const selectedRun = queries.detailQuery.data?.run ?? null;
	const steps = queries.detailQuery.data?.steps ?? [];
	const { progressStreamLive } = queries.detailQuery;

	const derived = useAmkaViewRunDerived({
		t,
		selectedRun,
		steps,
		imcTypeOptions: queries.imcTypesQuery.data?.types,
		presetItems: queries.presetsQuery.data?.items,
	});

	useAmkaViewSelectionEffects({
		selectedProjectId,
		preferRunIdRef: local.preferRunIdRef,
		selectedRunId: local.selectedRunId,
		setSelectedRunId: local.setSelectedRunId,
		runs,
		stepsLength: steps.length,
		stepPageIndex: local.stepPageIndex,
		setStepPageIndex: local.setStepPageIndex,
		runningStepIndex: derived.runningStepIndex,
		selectedRunStatus: selectedRun?.status,
		failedStepIndex: derived.failedStepIndex,
	});

	const stepPageSafeIndex = Math.min(
		local.stepPageIndex,
		Math.max(0, steps.length - 1)
	);
	const currentStep = steps[stepPageSafeIndex] ?? null;

	const mutations = useAmkaViewMutations({
		t,
		notify: { success, error, warning },
		queries,
		selectedProjectId,
		selectedCompanyId,
		selectedRun,
		steps,
		preferRunIdRef: local.preferRunIdRef,
		setSelectedRunId: local.setSelectedRunId,
		setSkipSectionKeys: local.setSkipSectionKeys,
		setSkipOperationKeys: local.setSkipOperationKeys,
		setSkipStepIds: local.setSkipStepIds,
		exportIncludeCoreAlignment: local.exportIncludeCoreAlignment,
		userInstruction: local.userInstruction,
		sectionToggles: local.sectionToggles,
		runMode: local.runMode,
		autoCycleCount: local.autoCycleCount,
		perStepExecution: local.perStepExecution,
		imcTypeKey: local.imcTypeKey,
		imcFocus: local.imcFocus,
		imcMaxWait: local.imcMaxWait,
		startPresetId: local.startPresetId,
		skipSectionKeys: local.skipSectionKeys,
		skipOperationKeys: local.skipOperationKeys,
		skipStepIds: local.skipStepIds,
	});

	return {
		t,
		selectedProjectId,
		selectedCompanyId,
		canEditAmkaOperatorConfig,
		...local,
		...shell,
		queries,
		runs,
		selectedRun,
		steps,
		progressStreamLive,
		...derived,
		stepPageSafeIndex,
		currentStep,
		...mutations,
	};
}

export type AmkaViewCompose = ReturnType<typeof useAmkaViewCompose>;
