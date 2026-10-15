/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Selection and pager effects for AmkaView — preferRunIdRef stickiness, running→N−1, failed focus.
 *
 * Invariants:
 * - preferRunIdRef, runningStepIndex pager, and failed-step effects stay co-located here.
 *
 * Related:
 * - useAmkaViewLocalState.ts, useAmkaViewCompose.ts
 */

import { useEffect, type MutableRefObject } from 'react';

import type { AmkaRun } from '@/services/amka/marketingCabinetAmkaBridge';

export function useAmkaViewSelectionEffects(input: {
	selectedProjectId: string | null;
	preferRunIdRef: MutableRefObject<string | null>;
	selectedRunId: string | null;
	setSelectedRunId: (id: string | null) => void;
	runs: AmkaRun[];
	stepsLength: number;
	stepPageIndex: number;
	setStepPageIndex: (value: number | ((prev: number) => number)) => void;
	runningStepIndex: number | null;
	selectedRunStatus: AmkaRun['status'] | undefined;
	failedStepIndex: number | null;
}) {
	const {
		selectedProjectId,
		preferRunIdRef,
		selectedRunId,
		setSelectedRunId,
		runs,
		stepsLength,
		setStepPageIndex,
		runningStepIndex,
		selectedRunStatus,
		failedStepIndex,
	} = input;

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset selection when toolbar project changes
	useEffect(() => {
		preferRunIdRef.current = null;
		setSelectedRunId(null);
	}, [selectedProjectId]);

	useEffect(() => {
		const preferred = preferRunIdRef.current;
		if (preferred) {
			if (selectedRunId !== preferred) {
				setSelectedRunId(preferred);
			}
			if (runs.some((item) => item.id === preferred)) {
				preferRunIdRef.current = null;
			}
			return;
		}
		if (!runs.length) {
			return;
		}
		if (!selectedRunId) {
			setSelectedRunId(runs[0]?.id ?? null);
			return;
		}
		if (!runs.some((item) => item.id === selectedRunId)) {
			setSelectedRunId(runs[0]?.id ?? null);
		}
	}, [runs, selectedRunId, preferRunIdRef, setSelectedRunId]);

	useEffect(() => {
		setStepPageIndex((i) => {
			if (!stepsLength) return 0;
			return Math.min(Math.max(0, i), stepsLength - 1);
		});
	}, [stepsLength, setStepPageIndex]);

	/** Пока идёт этап N, по умолчанию смотрим N−1 с данными. */
	useEffect(() => {
		if (!stepsLength) {
			setStepPageIndex(0);
			return;
		}
		const r = runningStepIndex;
		if (r !== null) {
			setStepPageIndex(r > 0 ? r - 1 : 0);
			return;
		}
		if (selectedRunStatus === 'failed') {
			return;
		}
		setStepPageIndex(stepsLength - 1);
	}, [runningStepIndex, stepsLength, selectedRunStatus, setStepPageIndex]);

	/** Failed run: сфокусировать pager на первом упавшем шаге при открытии/смене run. */
	// biome-ignore lint/correctness/useExhaustiveDependencies: selectedRunId needed when two failed runs share the same failedStepIndex
	useEffect(() => {
		if (runningStepIndex !== null) return;
		if (selectedRunStatus !== 'failed') return;
		if (failedStepIndex === null) return;
		setStepPageIndex(failedStepIndex);
	}, [
		selectedRunId,
		selectedRunStatus,
		failedStepIndex,
		runningStepIndex,
		setStepPageIndex,
	]);
}
