import { DIAGNOSTIC_MODULE_ORDER } from './diagnosticDefinition';
import { computeDiagnosticProgressPercent } from './diagnosticProgress';
import type { CustomerDiagnosticSessionState } from './diagnosticTypes';
import { reconcileCompletedModules } from './diagnosticSessionLoadHints';

export type DiagnosticSessionSaveParts = {
	payloadState: CustomerDiagnosticSessionState;
	progress_percent: number;
	allDone: boolean;
	/** Deprecated client field — server computes; always undefined on wire. */
	computed_results: undefined;
	mark_completed: boolean;
	/** Deprecated client field — server computes; always undefined on wire. */
	completed_module_metrics: undefined;
	signature: string;
};

/** Стабильная подпись тела PATCH — без client scores (server authoritative). */
function stableStateSnapshot(state: CustomerDiagnosticSessionState): unknown {
	return {
		version: state.version,
		uiPhase: state.uiPhase,
		activeModuleId: state.activeModuleId,
		step: state.step,
		completedModules: [...state.completedModules].sort(),
		answers: state.answers,
	};
}

export function buildDiagnosticSessionSaveParts(
	draft: CustomerDiagnosticSessionState,
	prevCompleted: Set<string>
): DiagnosticSessionSaveParts {
	const completed = reconcileCompletedModules(draft);
	const withCompleted: CustomerDiagnosticSessionState = {
		...draft,
		completedModules: completed,
	};
	const progress = computeDiagnosticProgressPercent(withCompleted);
	const allDone = DIAGNOSTIC_MODULE_ORDER.every((m) => completed.includes(m));
	const uiPhase = allDone ? 'complete' : withCompleted.uiPhase;
	const payloadState: CustomerDiagnosticSessionState = {
		...withCompleted,
		completedModules: completed,
		uiPhase,
	};
	// Keep prevCompleted in signature so newly completed modules still trigger PATCH
	// even when state signature alone would match (server needs to score additions).
	const newlyCompleted = DIAGNOSTIC_MODULE_ORDER.filter(
		(m) => completed.includes(m) && !prevCompleted.has(m)
	);
	const progress_percent = allDone ? 100 : progress;
	const signature = JSON.stringify({
		state: stableStateSnapshot(payloadState),
		progress_percent,
		mark_completed: allDone,
		newlyCompleted,
	});

	return {
		payloadState,
		progress_percent,
		allDone,
		computed_results: undefined,
		mark_completed: allDone,
		completed_module_metrics: undefined,
		signature,
	};
}
