/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React bridge for the singleton Site Studio auto-fill runner state.
 *
 * Invariants:
 * - Components subscribe through `useSyncExternalStore`; the runner remains the only mutable source of stream state.
 * - Built-in UI messages expose i18n keys while raw message fields remain legacy/server fallbacks.
 *
 * Related:
 * - `features/site-studio/desktop/components/ImperorG/imperorGPipelineRunner.ts`
 * - `features/site-studio/desktop/components/ImperorG/ImperorGPanel.tsx`
 */
import { useCallback, useRef, useSyncExternalStore } from 'react';
import {
	cancelImperorGPipeline,
	dismissImperorGInterrupted,
	getImperorGPipelineSnapshot,
	getServerImperorGSnapshot,
	runImperorGPipeline,
	subscribeImperorGPipeline,
	type ImperorGPipelineSnapshot,
} from './imperorGPipelineRunner';
import type { ImperorGConfig } from '../../api-imperorg';

export type ImperorGPipelineStatus = ImperorGPipelineSnapshot['status'];

export interface UseImperorGReturn {
	status: ImperorGPipelineStatus;
	phases: ImperorGPipelineSnapshot['phases'];
	currentPhaseIndex: number;
	errorMessage: string | null;
	errorMessageKey: ImperorGPipelineSnapshot['errorMessageKey'];
	pipelineSummary: Record<string, unknown> | null;
	pipelineId: string | null;
	isLeader: boolean;
	recoveryHint: string | null;
	recoveryHintKey: ImperorGPipelineSnapshot['recoveryHintKey'];
	launch: (config: ImperorGConfig) => void;
	cancel: () => void;
	dismissInterrupted: () => void;
}

export function useImperorG(onComplete?: () => void): UseImperorGReturn {
	const onCompleteRef = useRef(onComplete);
	onCompleteRef.current = onComplete;

	const snap = useSyncExternalStore(
		subscribeImperorGPipeline,
		getImperorGPipelineSnapshot,
		getServerImperorGSnapshot
	);

	const launch = useCallback((config: ImperorGConfig) => {
		runImperorGPipeline(config, () => onCompleteRef.current?.());
	}, []);

	const cancel = useCallback(() => {
		cancelImperorGPipeline();
	}, []);

	const dismissInterrupted = useCallback(() => {
		dismissImperorGInterrupted();
	}, []);

	return {
		status: snap.status,
		phases: snap.phases,
		currentPhaseIndex: snap.currentPhaseIndex,
		errorMessage: snap.errorMessage,
		errorMessageKey: snap.errorMessageKey,
		pipelineSummary: snap.pipelineSummary,
		pipelineId: snap.pipelineId,
		isLeader: snap.isLeader,
		recoveryHint: snap.recoveryHint,
		recoveryHintKey: snap.recoveryHintKey,
		launch,
		cancel,
		dismissInterrupted,
	};
}
