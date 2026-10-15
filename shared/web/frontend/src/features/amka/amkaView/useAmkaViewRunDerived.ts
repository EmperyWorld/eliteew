/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Derived run/step metrics, select options, and actionable state for AmkaView.
 *
 * Invariants:
 * - Ensemble and error derivations match amkaViewUtils pre-atomization semantics.
 *
 * Related:
 * - useAmkaViewCompose.ts, @/features/amka/amkaViewUtils
 */

import { useMemo } from 'react';
import type { TFunction } from 'i18next';

import type {
	AmkaRun,
	AmkaRunStep,
} from '@/services/amka/marketingCabinetAmkaBridge';
import { buildAmkaOperationReview } from '@/features/amka/amkaOperationReviewModel';
import {
	AMKA_RUN_TERMINAL,
	countAmkaPlanEnsembleTasks,
	findFirstFailedEnsembleStep,
	findFirstFailedStepIndex,
	formatAmkaEnsembleErrorForUi,
	readBooleanField,
	readErrorSummary,
	resolveAmkaStepExecutionMode,
	summarizeAmkaEnsembleStepOutcomes,
} from '@/features/amka/amkaViewUtils';

export function useAmkaViewRunDerived(input: {
	t: TFunction<'marketing'>;
	selectedRun: AmkaRun | null;
	steps: AmkaRunStep[];
	imcTypeOptions: { type_key: string; display_name: string }[] | undefined;
	presetItems: { id: string; display_name: string }[] | undefined;
}) {
	const { t, selectedRun, steps, imcTypeOptions, presetItems } = input;

	const runningStepIndex = useMemo(() => {
		const i = steps.findIndex((s) => s.status === 'running');
		return i >= 0 ? i : null;
	}, [steps]);

	const failedEnsembleStep = useMemo(
		() =>
			selectedRun?.status === 'failed'
				? findFirstFailedEnsembleStep(steps)
				: null,
		[selectedRun?.status, steps]
	);

	const failedStepIndex = useMemo(
		() =>
			selectedRun?.status === 'failed' ? findFirstFailedStepIndex(steps) : null,
		[selectedRun?.status, steps]
	);

	const ensemblePlanTaskCount = useMemo(
		() => countAmkaPlanEnsembleTasks(selectedRun?.master_plan ?? []),
		[selectedRun?.master_plan]
	);

	const ensembleOutcomes = useMemo(
		() => summarizeAmkaEnsembleStepOutcomes(steps, ensemblePlanTaskCount),
		[steps, ensemblePlanTaskCount]
	);

	const hasTruncatedSectionAuditContext = useMemo(
		() =>
			steps.some(
				(s) =>
					s.stage_kind === 'section_audit' &&
					readBooleanField(s.report_payload, 'audit_context_truncated') === true
			),
		[steps]
	);

	const runError = useMemo(
		() => readErrorSummary(selectedRun?.error_payload),
		[selectedRun?.error_payload]
	);

	const runErrorMessage = useMemo(() => {
		const raw = runError?.message?.trim();
		if (!raw) {
			return null;
		}
		return formatAmkaEnsembleErrorForUi(t, raw) ?? raw;
	}, [runError?.message, t]);

	const plannedOperations = useMemo(
		() =>
			(selectedRun?.master_plan ?? []).flatMap((task) =>
				Array.isArray(task.operations) ? task.operations : []
			),
		[selectedRun]
	);

	const plannedDestructiveCount = useMemo(
		() =>
			plannedOperations.filter(
				(operation) => typeof operation === 'object' && operation?.destructive
			).length,
		[plannedOperations]
	);

	const operationReview = useMemo(
		() => buildAmkaOperationReview({ run: selectedRun, steps }),
		[selectedRun, steps]
	);

	const auditFallbackRatio = useMemo(() => {
		const s = selectedRun?.audit_llm_stats;
		if (!s || typeof s.total !== 'number' || s.total <= 0) return null;
		return { fallback: Number(s.fallback ?? 0), total: s.total };
	}, [selectedRun?.audit_llm_stats]);

	const imcTypeSelectOptions = useMemo(
		() => [
			{ value: '', label: t('amkaView.imcTypeDefault') },
			...(imcTypeOptions ?? []).map((row) => ({
				value: row.type_key,
				label: row.display_name,
			})),
		],
		[imcTypeOptions, t]
	);

	const imcFocusSelectOptions = useMemo(
		() => [
			{ value: 'mixed', label: t('amkaView.imcFocusMixed') },
			{ value: 'global', label: t('amkaView.imcFocusGlobal') },
			{ value: 'rf', label: t('amkaView.imcFocusRf') },
		],
		[t]
	);

	const presetStartOptions = useMemo(
		() => [
			{ value: '', label: t('amkaView.presetNone') },
			...(presetItems ?? []).map((p) => ({
				value: p.id,
				label: t('amkaView.presetNamedLabel', { name: p.display_name }),
			})),
		],
		[presetItems, t]
	);

	const autoCycleSelectOptions = useMemo(
		() =>
			[1, 2, 3, 4, 5].map((n) => ({
				value: String(n),
				label: String(n),
			})),
		[]
	);

	const stepJumpSelectOptions = useMemo(
		() =>
			steps.map((s, i) => {
				const title =
					s.title.length > 72 ? `${s.title.slice(0, 72)}…` : s.title;
				const execMode = resolveAmkaStepExecutionMode(s);
				const modeShort =
					execMode === 'desktop_ensemble'
						? t('amkaView.executionModeShort.desktop_ensemble')
						: execMode
							? execMode
							: null;
				const statusMark =
					s.status === 'failed'
						? t('amkaView.stepJumpFailedMark')
						: s.status === 'running'
							? t('amkaView.stepJumpRunningMark')
							: '';
				const prefix = [statusMark, modeShort ? `[${modeShort}]` : null]
					.filter(Boolean)
					.join(' ');
				return {
					value: String(i),
					label: `#${s.ordinal}${prefix ? ` ${prefix}` : ''} ${title}`,
					description: s.title.length > 72 ? s.title : undefined,
				};
			}),
		[steps, t]
	);

	const actionableState = useMemo(() => {
		if (!selectedRun) {
			return {
				canApprove: false,
				canContinueStep: false,
				canResume: false,
				canCancel: false,
			};
		}
		return {
			canApprove: selectedRun.status === 'awaiting_approval',
			canContinueStep: selectedRun.status === 'awaiting_step_approval',
			canResume:
				selectedRun.status === 'failed' || selectedRun.status === 'cancelled',
			canCancel: !AMKA_RUN_TERMINAL.has(selectedRun.status),
		};
	}, [selectedRun]);

	const runningStep =
		runningStepIndex !== null ? (steps[runningStepIndex] ?? null) : null;

	return {
		runningStepIndex,
		failedEnsembleStep,
		failedStepIndex,
		ensemblePlanTaskCount,
		ensembleOutcomes,
		hasTruncatedSectionAuditContext,
		runError,
		runErrorMessage,
		plannedOperations,
		plannedDestructiveCount,
		operationReview,
		auditFallbackRatio,
		imcTypeSelectOptions,
		imcFocusSelectOptions,
		presetStartOptions,
		autoCycleSelectOptions,
		stepJumpSelectOptions,
		actionableState,
		runningStep,
	};
}
